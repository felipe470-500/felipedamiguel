import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Consulta de dados do veículo pela placa usando o serviço API Placas
// (https://apiplacas.com.br). Formato confirmado pela documentação oficial:
// GET https://wdapi2.com.br/consulta/{PLACA}/{TOKEN}

type PlateLookupResult = {
  plate: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  color: string | null;
  fuel: string | null;
  vin: string | null;
};

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickYear(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && value >= 1900 && value <= 2100) return value;
    if (typeof value === "string") {
      const match = value.match(/\b(19|20)\d{2}\b/);
      if (match) return Number(match[0]);
    }
  }
  return null;
}

function normalizeFuel(raw: string | null): string | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  if (text.includes("flex") || (text.includes("gasolina") && text.includes("alcool"))) return "Flex";
  if (text.includes("álcool") || text.includes("alcool") || text.includes("etanol")) return "Etanol";
  if (text.includes("gasolina")) return "Gasolina";
  if (text.includes("diesel")) return "Diesel";
  if (text.includes("gnv") || text.includes("gás")) return "GNV";
  if (text.includes("elétr") || text.includes("eletr")) return "Elétrico";
  if (text.includes("híbrido") || text.includes("hibrido")) return "Híbrido";
  return null;
}

/** Separa "Fiat Strada Endurance 1.4" em modelo + versão quando possível. */
function splitModelVersion(
  marca: string | null,
  modelo: string | null,
): { model: string | null; version: string | null } {
  if (!modelo) return { model: null, version: null };
  let rest = modelo;
  if (marca && rest.toLowerCase().startsWith(marca.toLowerCase())) {
    rest = rest.slice(marca.length).trim();
  }
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { model: rest || null, version: null };
  return { model: parts[0], version: parts.slice(1).join(" ") || null };
}

export const lookupVehicleByPlateFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        plate: z.string().min(7, "Informe a placa"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PlateLookupResult> => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);

    const token = process.env["APIPLACAS_TOKEN"];
    if (!token) {
      throw new Error(
        "Consulta de placa ainda não configurada: falta cadastrar a chave da API Placas no projeto.",
      );
    }

    const plate = data.plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) {
      throw new Error("Placa inválida. Use o formato AAA9999 ou AAA9A99.");
    }

    const res = await fetch(`https://wdapi2.com.br/consulta/${plate}/${token}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`A consulta de placa falhou (código ${res.status}). Tente novamente.`);
    }
    const body = (await res.json()) as Record<string, unknown>;

    const erro = pickString(body["erro"], body["error"], body["mensagem"]);
    if (erro && !body["marca"] && !body["modelo"]) {
      throw new Error(`Placa não encontrada: ${erro}`);
    }

    const extra = (body["extra"] ?? {}) as Record<string, unknown>;
    const marca = pickString(body["marca"], body["Marca"], extra["marca"]);
    const modelo = pickString(body["modelo"], body["Modelo"], extra["modelo"]);
    const { model, version } = splitModelVersion(marca, modelo);

    return {
      plate,
      brand: marca,
      model,
      version,
      manufactureYear: pickYear(body["ano"], body["ANO"], extra["ano_fabricacao"]),
      modelYear: pickYear(body["anoModelo"], body["ano_modelo"], extra["ano_modelo"]),
      color: pickString(body["cor"], body["Cor"], extra["cor"]),
      fuel: normalizeFuel(pickString(extra["combustivel"], body["combustivel"], extra["Combustível"])),
      vin: pickString(extra["chassi"], body["chassi"]),
    };
  });

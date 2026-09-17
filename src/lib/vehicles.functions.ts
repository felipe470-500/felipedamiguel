import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { missingRequiredFields } from "@/lib/vehicles-store";


const nullableText = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

const VehicleInput = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string(),
  year: z.string().default(""),
  km: z.string().default(""),
  price: z.string().default(""),
  tag: z.string().nullable().optional(),
  images: z.array(z.string()).default([]),
  plate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  brand: nullableText,
  model: nullableText,
  version: nullableText,
  manufactureYear: nullableNumber,
  modelYear: nullableNumber,
  mileageKm: nullableNumber,
  priceCents: nullableNumber,
  color: nullableText,
  fuel: nullableText,
  transmission: nullableText,
  bodyType: nullableText,
  doors: nullableNumber,
  vin: nullableText,
  optionalFeatures: z.array(z.string()).optional(),
  status: nullableText,
});

const STRUCTURED_COLUMNS =
  "brand, model, version, manufacture_year, model_year, mileage_km, price_cents, color, fuel, transmission, body_type, doors, vin, optional_features, status";


type VehicleListItem = {
  id: string;
  name: string;
  year: string;
  km: string;
  price: string;
  tag: string | null;
  images: string[];
  position: number;
  plate: string | null;
  description: string | null;
  brand: string | null;
  model: string | null;
  version: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  mileageKm: number | null;
  priceCents: number | null;
  color: string | null;
  fuel: string | null;
  transmission: string | null;
  bodyType: string | null;
  doors: number | null;
  vin: string | null;
  optionalFeatures: string[];
  status: string | null;
};

export const listVehiclesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const res = await supabaseAdmin
    .from("vehicles")
    .select(`id, name, year, km, price, tag, images, position, plate, description, ${STRUCTURED_COLUMNS}`)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => {
    const v = row as Record<string, unknown>;
    return {
      id: v["id"] as string,
      name: (v["name"] as string) ?? "",
      year: (v["year"] as string) ?? "",
      km: (v["km"] as string) ?? "",
      price: (v["price"] as string) ?? "",
      tag: (v["tag"] as string | null) ?? null,
      images: (v["images"] as string[] | null) ?? [],
      position: (v["position"] as number) ?? 0,
      plate: (v["plate"] as string | null) ?? null,
      description: (v["description"] as string | null) ?? null,
      brand: (v["brand"] as string | null) ?? null,
      model: (v["model"] as string | null) ?? null,
      version: (v["version"] as string | null) ?? null,
      manufactureYear: (v["manufacture_year"] as number | null) ?? null,
      modelYear: (v["model_year"] as number | null) ?? null,
      mileageKm: (v["mileage_km"] as number | null) ?? null,
      priceCents: (v["price_cents"] as number | null) ?? null,
      color: (v["color"] as string | null) ?? null,
      fuel: (v["fuel"] as string | null) ?? null,
      transmission: (v["transmission"] as string | null) ?? null,
      bodyType: (v["body_type"] as string | null) ?? null,
      doors: (v["doors"] as number | null) ?? null,
      vin: (v["vin"] as string | null) ?? null,
      optionalFeatures: (v["optional_features"] as string[] | null) ?? [],
      status: (v["status"] as string | null) ?? null,
    } satisfies VehicleListItem;
  });
});

export const saveVehiclesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        vehicles: z.array(VehicleInput),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeMedia } = await import("@/lib/media-normalize.server");

    // Preserva os IDs existentes (links compartilhados continuam válidos) e
    // só remove os veículos ausentes DEPOIS que a gravação der certo.
    const keepIds: string[] = [];

    // Bloqueio central: veículo publicado (fora de Rascunho) precisa dos campos obrigatórios.
    // Cadastros novos e já migrados são exigidos; o estoque antigo ainda não preenchido
    // continua salvável até ser completado (aparece como pendente nos painéis).
    const blocked = data.vehicles
      .filter((v) => {
        const migrated = Boolean(v.brand || v.model || v.version || v.priceCents || v.mileageKm);
        return !v.id || migrated;
      })
      .map((v) => ({ name: v.name, missing: missingRequiredFields(v) }))
      .filter((item) => item.missing.length > 0);
    if (blocked.length > 0) {
      throw new Error(
        `Este veículo não está pronto para integração. ${blocked
          .map((item) => `${item.name || "Sem nome"}: faltam ${item.missing.join(", ")}`)
          .join(" | ")}`,
      );
    }

    if (data.vehicles.length > 0) {
      const rows = data.vehicles.map((v, i) => ({
        ...(v.id ? { id: v.id } : {}),
        name: v.name,
        year: v.year ?? "",
        km: v.km ?? "",
        price: v.price ?? "",
        tag: v.tag ?? null,
        images: (v.images ?? []).map(normalizeMedia),
        plate: v.plate ?? null,
        description: v.description ?? null,
        position: i,
        brand: v.brand ?? null,
        model: v.model ?? null,
        version: v.version ?? null,
        manufacture_year: v.manufactureYear ?? null,
        model_year: v.modelYear ?? null,
        mileage_km: v.mileageKm ?? null,
        price_cents: v.priceCents ?? null,
        color: v.color ?? null,
        fuel: v.fuel ?? null,
        transmission: v.transmission ?? null,
        body_type: v.bodyType ?? null,
        doors: v.doors ?? null,
        vin: v.vin ?? null,
        optional_features: v.optionalFeatures ?? [],
        status: v.status ?? "AVAILABLE",
      }));


      const existing = rows.filter((r) => "id" in r);
      const created = rows.filter((r) => !("id" in r));

      if (existing.length > 0) {
        const { data: up, error: upErr } = await supabaseAdmin
          .from("vehicles")
          .upsert(existing, { onConflict: "id" })
          .select("id");
        if (upErr) throw new Error(upErr.message);
        keepIds.push(...(up ?? []).map((r) => r.id));
      }

      if (created.length > 0) {
        const { data: ins, error: insErr } = await supabaseAdmin
          .from("vehicles")
          .insert(created)
          .select("id");
        if (insErr) throw new Error(insErr.message);
        keepIds.push(...(ins ?? []).map((r) => r.id));
      }
    }

    // Remove apenas os que não estão mais no catálogo enviado.
    const del = supabaseAdmin.from("vehicles").delete();
    const { error: delErr } =
      keepIds.length > 0
        ? await del.not("id", "in", `(${keepIds.join(",")})`)
        : await del.neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });

export const uploadVehicleImageFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        dataUrl: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const match = data.dataUrl.match(/^data:((?:image|video)\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) throw new Error("Arquivo inválido (apenas imagens e vídeos são suportados)");
    const contentType = match[1];
    const base64 = match[2];
    const bytes = Buffer.from(base64, "base64");
    const extTemp = (contentType.split("/")[1] || "bin").replace("jpeg", "jpg");
    const ext = extTemp === "quicktime" ? "mov" : extTemp;
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from("vehicle-images")
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(error.message);

    return { url: `/api/public/vehicle-image?path=${encodeURIComponent(path)}` };
  });

/**
 * Cria uma URL assinada para upload direto ao storage (bypass do worker).
 * Necessário para vídeos grandes que estouram o limite de memória (~150MB) do worker.
 */
export const createVehicleUploadUrlFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        contentType: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const extTemp = (data.contentType.split("/")[1] || "bin").replace("jpeg", "jpg").split(";")[0];
    const ext = extTemp === "quicktime" ? "mov" : extTemp;
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data: signed, error } = await supabaseAdmin.storage
      .from("vehicle-images")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar URL de upload");

    return {
      path,
      token: signed.token,
      publicUrl: `/api/public/vehicle-image?path=${encodeURIComponent(path)}`,
    };
  });






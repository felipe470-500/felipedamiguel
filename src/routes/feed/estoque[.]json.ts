import { createFileRoute } from "@tanstack/react-router";

/**
 * Feed público de estoque para CRM externo (AutoSíntese).
 * Raiz = array JSON puro, sem paginação, lido do banco a cada request.
 */

const FEED_ORIGIN = "https://miguelveiculosfsa.com";

const VIDEO_RE = /\.(mp4|mov|m4v|webm|ogg|mkv|avi|quicktime)(\?|$)/i;

type Entry = { re: RegExp; marca: string; modelo: string; tipo?: string };

// Dicionário modelo -> marca/tipo. Os nomes no catálogo geralmente começam pelo
// modelo (ex.: "Corolla Gli 1.8"), então inferimos a marca pelo modelo conhecido.
// Ordem importa: modelos compostos vêm antes.
const CATALOG: Entry[] = [
  { re: /corolla\s*cross/i, marca: "Toyota", modelo: "Corolla Cross", tipo: "SUV" },
  { re: /grand\s*siena/i, marca: "Fiat", modelo: "Grand Siena", tipo: "Sedan" },
  { re: /golf\s*variant/i, marca: "Volkswagen", modelo: "Golf Variant", tipo: "Perua" },
  { re: /(palio\s*)?(week?end|welkend)/i, marca: "Fiat", modelo: "Palio Weekend", tipo: "Perua" },
  { re: /t[\s-]?cross/i, marca: "Volkswagen", modelo: "T-Cross", tipo: "SUV" },
  { re: /\bhb20\b/i, marca: "Hyundai", modelo: "HB20", tipo: "Hatch" },
  { re: /\bhr[\s-]?v\b|\bhrv\b/i, marca: "Honda", modelo: "HR-V", tipo: "SUV" },
  { re: /\bgol\b|\bgol\s*g\d/i, marca: "Volkswagen", modelo: "Gol", tipo: "Hatch" },
  { re: /voyage/i, marca: "Volkswagen", modelo: "Voyage", tipo: "Sedan" },
  { re: /saveiro/i, marca: "Volkswagen", modelo: "Saveiro", tipo: "Picape" },
  { re: /\bpolo\b/i, marca: "Volkswagen", modelo: "Polo", tipo: "Hatch" },
  { re: /virtus/i, marca: "Volkswagen", modelo: "Virtus", tipo: "Sedan" },
  { re: /ni[rv]+us/i, marca: "Volkswagen", modelo: "Nivus", tipo: "SUV" },
  { re: /jetta/i, marca: "Volkswagen", modelo: "Jetta", tipo: "Sedan" },
  { re: /\bgolf\b/i, marca: "Volkswagen", modelo: "Golf", tipo: "Hatch" },
  { re: /\bfox\b/i, marca: "Volkswagen", modelo: "Fox", tipo: "Hatch" },
  { re: /\bup\b/i, marca: "Volkswagen", modelo: "Up!", tipo: "Hatch" },
  { re: /amarok/i, marca: "Volkswagen", modelo: "Amarok", tipo: "Picape" },
  { re: /\btaos\b/i, marca: "Volkswagen", modelo: "Taos", tipo: "SUV" },
  { re: /strada/i, marca: "Fiat", modelo: "Strada", tipo: "Picape" },
  { re: /\btoro\b/i, marca: "Fiat", modelo: "Toro", tipo: "Picape" },
  { re: /cronos/i, marca: "Fiat", modelo: "Cronos", tipo: "Sedan" },
  { re: /\bmobi\b/i, marca: "Fiat", modelo: "Mobi", tipo: "Hatch" },
  { re: /\bpulse\b/i, marca: "Fiat", modelo: "Pulse", tipo: "SUV" },
  { re: /palio/i, marca: "Fiat", modelo: "Palio", tipo: "Hatch" },
  { re: /siena/i, marca: "Fiat", modelo: "Siena", tipo: "Sedan" },
  { re: /punto/i, marca: "Fiat", modelo: "Punto", tipo: "Hatch" },
  { re: /\buno\b/i, marca: "Fiat", modelo: "Uno", tipo: "Hatch" },
  { re: /\bargo\b/i, marca: "Fiat", modelo: "Argo", tipo: "Hatch" },
  { re: /\bonix\b/i, marca: "Chevrolet", modelo: "Onix", tipo: "Hatch" },
  { re: /\bs10\b/i, marca: "Chevrolet", modelo: "S10", tipo: "Picape" },
  { re: /\bspin\b/i, marca: "Chevrolet", modelo: "Spin", tipo: "Van" },
  { re: /cobalt/i, marca: "Chevrolet", modelo: "Cobalt", tipo: "Sedan" },
  { re: /cru[iz]+e/i, marca: "Chevrolet", modelo: "Cruze" },
  { re: /montana/i, marca: "Chevrolet", modelo: "Montana", tipo: "Picape" },
  { re: /captiva/i, marca: "Chevrolet", modelo: "Captiva", tipo: "SUV" },
  { re: /astra/i, marca: "Chevrolet", modelo: "Astra", tipo: "Hatch" },
  { re: /tracker/i, marca: "Chevrolet", modelo: "Tracker", tipo: "SUV" },
  { re: /prisma/i, marca: "Chevrolet", modelo: "Prisma", tipo: "Sedan" },
  { re: /corolla/i, marca: "Toyota", modelo: "Corolla", tipo: "Sedan" },
  { re: /hilux/i, marca: "Toyota", modelo: "Hilux", tipo: "Picape" },
  { re: /etios/i, marca: "Toyota", modelo: "Etios", tipo: "Hatch" },
  { re: /\byaris\b/i, marca: "Toyota", modelo: "Yaris" },
  { re: /civic/i, marca: "Honda", modelo: "Civic", tipo: "Sedan" },
  { re: /\bcity\b/i, marca: "Honda", modelo: "City", tipo: "Sedan" },
  { re: /\bfit\b/i, marca: "Honda", modelo: "Fit", tipo: "Hatch" },
  { re: /creta/i, marca: "Hyundai", modelo: "Creta", tipo: "SUV" },
  { re: /tucson/i, marca: "Hyundai", modelo: "Tucson", tipo: "SUV" },
  { re: /\bix35\b/i, marca: "Hyundai", modelo: "ix35", tipo: "SUV" },
  { re: /sandero/i, marca: "Renault", modelo: "Sandero", tipo: "Hatch" },
  { re: /du[es]+ter/i, marca: "Renault", modelo: "Duster", tipo: "SUV" },
  { re: /\bkwid\b/i, marca: "Renault", modelo: "Kwid", tipo: "Hatch" },
  { re: /\blogan\b/i, marca: "Renault", modelo: "Logan", tipo: "Sedan" },
  { re: /captur/i, marca: "Renault", modelo: "Captur", tipo: "SUV" },
  { re: /ecosport/i, marca: "Ford", modelo: "EcoSport", tipo: "SUV" },
  { re: /ranger/i, marca: "Ford", modelo: "Ranger", tipo: "Picape" },
  { re: /fiesta/i, marca: "Ford", modelo: "Fiesta", tipo: "Hatch" },
  { re: /fusion/i, marca: "Ford", modelo: "Fusion", tipo: "Sedan" },
  { re: /\bf\s?250\b/i, marca: "Ford", modelo: "F-250", tipo: "Picape" },
  { re: /verona/i, marca: "Ford", modelo: "Verona", tipo: "Sedan" },
  { re: /\bfocus\b/i, marca: "Ford", modelo: "Focus", tipo: "Hatch" },
  { re: /\bka\b/i, marca: "Ford", modelo: "Ka", tipo: "Hatch" },
  { re: /renegade/i, marca: "Jeep", modelo: "Renegade", tipo: "SUV" },
  { re: /compass/i, marca: "Jeep", modelo: "Compass", tipo: "SUV" },
  { re: /versa/i, marca: "Nissan", modelo: "Versa", tipo: "Sedan" },
  { re: /kicks/i, marca: "Nissan", modelo: "Kicks", tipo: "SUV" },
  { re: /frontier/i, marca: "Nissan", modelo: "Frontier", tipo: "Picape" },
  { re: /\bmarch\b/i, marca: "Nissan", modelo: "March", tipo: "Hatch" },
  { re: /pajero/i, marca: "Mitsubishi", modelo: "Pajero", tipo: "SUV" },
  { re: /\bl\s?200\b/i, marca: "Mitsubishi", modelo: "L200", tipo: "Picape" },
  { re: /triton/i, marca: "Mitsubishi", modelo: "Triton", tipo: "Picape" },
  { re: /\b320i\b|\bbmw\b/i, marca: "BMW", modelo: "320i", tipo: "Sedan" },
  { re: /\ba3\b|\baudi\b/i, marca: "Audi", modelo: "A3" },
  { re: /\b208\b|peugeot/i, marca: "Peugeot", modelo: "208", tipo: "Hatch" },
  { re: /\bjeep\b/i, marca: "Jeep", modelo: "Jeep" },
];

const BRAND_PREFIX_RE =
  /^(volkswagen|vw|fiat|chevrolet|gm|toyota|honda|hyundai|renault|ford|jeep|nissan|mitsubishi|bmw|audi|peugeot|citroen|citroën)\s+/i;

function identify(name: string) {
  for (const e of CATALOG) {
    if (e.re.test(name)) return e;
  }
  return undefined;
}

function buildVersao(name: string, entry: Entry | undefined, tag: string | null): string {
  let rest = name.replace(BRAND_PREFIX_RE, "").trim();
  if (entry) rest = rest.replace(entry.re, " ").replace(/\s+/g, " ").trim();
  const extra = (tag ?? "").trim();
  const joined = [rest, extra].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  // Evita repetição quando o nome e a tag trazem a mesma palavra ("Cross Cross, 1.6")
  const words = joined.split(" ");
  const dedup = words.filter((w, i) => {
    const prev = words[i - 1];
    return !prev || prev.replace(/[,.]$/, "").toLowerCase() !== w.replace(/[,.]$/, "").toLowerCase();
  });
  return dedup.join(" ").replace(/^[,\-–]+|[,\-–]+$/g, "").trim();
}

function parseValor(price: string): number | undefined {
  let s = (price ?? "").replace(/r\$?/gi, "").replace(/\s/g, "").trim();
  if (!s) return undefined;
  s = s.replace(/,\d{1,2}$/, ""); // remove centavos
  const digits = s.replace(/\D/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseKm(km: string): number | undefined {
  const digits = (km ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

function parseAnos(year: string): { fab?: number; mod?: number } {
  const raw = (year ?? "").trim();
  const m = raw.match(/(\d{4})\s*(?:[\/\-]\s*(\d{2,4}))?/);
  if (!m) return {};
  const fab = Number(m[1]);
  if (!Number.isFinite(fab)) return {};
  let mod = fab;
  if (m[2]) {
    mod = m[2].length === 2 ? Number(String(fab).slice(0, 2) + m[2]) : Number(m[2]);
    if (!Number.isFinite(mod)) mod = fab;
  }
  return { fab, mod };
}

function photoUrl(src: string): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("data:") || src.startsWith("blob:")) return undefined;
  if (VIDEO_RE.test(src)) return undefined;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/api/")) {
    const separator = src.includes("?") ? "&" : "?";
    return `${FEED_ORIGIN}${src}${separator}format=jpg`;
  }
  return `${FEED_ORIGIN}/api/public/vehicle-image?path=${encodeURIComponent(src)}&format=jpg`;
}

export const Route = createFileRoute("/feed/estoque.json")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("vehicles")
            .select("id, name, year, km, price, tag, images, position, plate, description")
            .order("position", { ascending: true })
            .order("created_at", { ascending: true });

          if (error) throw new Error(error.message);

          const feed = (data ?? []).map((v) => {
            const name = (v.name ?? "").trim();
            const entry = identify(name);
            const { fab, mod } = parseAnos(v.year ?? "");
            const valor = parseValor(v.price ?? "");
            const kmNum = parseKm(v.km ?? "");
            const versao = buildVersao(name, entry, v.tag ?? null);
            const fotos = (v.images ?? [])
              .map(photoUrl)
              .filter((u): u is string => Boolean(u));

            const out: Record<string, unknown> = {
              id: v.id,
              marca: entry?.marca ?? "",
              modelo: entry?.modelo ?? name,
              foto: fotos,
            };
            if (versao) out.versao = versao;
            if (entry?.tipo) out.tipoVeiculo = entry.tipo;
            if (fab) out.anoFabricacao = fab;
            if (mod) out.anoModelo = mod;
            if (kmNum !== undefined) out.km = kmNum;
            if (valor !== undefined) out.valor = valor;
            if (v.plate) out.placa = v.plate;
            const obs = (v.description ?? "").trim();
            if (obs) out.observacao = obs;
            return out;
          });

          return new Response(JSON.stringify(feed), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: "Falha ao consultar o estoque" }),
            { status: 500, headers: { "content-type": "application/json; charset=utf-8" } },
          );
        }
      },
    },
  },
});

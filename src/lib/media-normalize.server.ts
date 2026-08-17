/**
 * Normaliza um valor de mídia salvo no banco: se alguém gravou a URL do proxy
 * dentro do parâmetro `path` (prefixo duplicado), extrai o nome do arquivo real.
 */
export function normalizeMedia(src: string): string {
  let out = src;
  for (let i = 0; i < 5; i++) {
    const m = out.match(/^\/api\/public\/vehicle-image\?path=(.+)$/);
    if (!m) break;
    const decoded = decodeURIComponent(m[1]);
    if (decoded === out) break;
    out = decoded;
  }
  return out.startsWith("/api/") || out.startsWith("http") || out.startsWith("data:")
    ? out
    : `/api/public/vehicle-image?path=${encodeURIComponent(out)}`;
}


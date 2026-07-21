/**
 * Retorna a origem canônica do site para uso em links de compartilhamento.
 *
 * Quando o admin está acessando pelo domínio de preview do Lovable
 * (id-preview--*.lovable.app ou *.lovableproject.com), esses links EXPIRAM
 * assim que uma nova versão é publicada — então clientes recebem links quebrados
 * que caem na página inicial. Este helper força o uso do domínio de produção.
 */
const PRODUCTION_ORIGIN = "https://felipedamiguel.life";

const PREVIEW_HOSTNAME_PATTERNS = [
  /id-preview--/i,
  /\.lovableproject\.com$/i,
  /\.lovable\.app$/i,
  /^localhost$/i,
  /^127\./,
];

export function getCanonicalOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  const host = window.location.hostname;
  const isPreview = PREVIEW_HOSTNAME_PATTERNS.some((rx) => rx.test(host));
  if (isPreview) return PRODUCTION_ORIGIN;
  return window.location.origin;
}

export function buildVehicleShareUrl(vehicleId: string): string {
  return `${getCanonicalOrigin()}/?vehicle=${encodeURIComponent(vehicleId)}`;
}

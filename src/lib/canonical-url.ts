/**
 * Retorna a origem canônica do site para uso em links de compartilhamento.
 *
 * Os links compartilhados SEMPRE usam o domínio oficial da Miguel Veículos,
 * independentemente de onde o botão foi clicado (site oficial, www, prévia do
 * Lovable ou localhost). Links de prévia expiram a cada nova publicação, então
 * nunca devem ser enviados a clientes.
 */
const PRODUCTION_ORIGIN = "https://miguelveiculosfsa.com";

export function getCanonicalOrigin(): string {
  return PRODUCTION_ORIGIN;
}

export function buildVehicleShareUrl(vehicleId: string): string {
  return `${getCanonicalOrigin()}/?vehicle=${encodeURIComponent(vehicleId)}`;
}

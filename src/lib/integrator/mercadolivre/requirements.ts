/**
 * Checklist de integração do Mercado Livre.
 * Base: documentação oficial (fotos obrigatórias na criação e na atualização,
 * seller_contact obrigatório para contas car_dealer, atributos BRAND/MODEL/
 * VEHICLE_YEAR e localização cidade/estado).
 */
import { hasText, type Requirement } from "../validation";

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export const MERCADOLIVRE_REQUIREMENTS: readonly Requirement[] = [
  { key: "brand", label: "Marca", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.brand) },
  { key: "model", label: "Modelo", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.model) },
  {
    key: "year",
    label: "Ano do modelo ou de fabricação",
    scope: "vehicle",
    check: ({ vehicle }) => Boolean(vehicle.modelYear || vehicle.manufactureYear),
  },
  {
    key: "price",
    label: "Preço",
    scope: "vehicle",
    check: ({ vehicle }) => Boolean(vehicle.priceCents && vehicle.priceCents > 0),
  },
  {
    key: "mileage",
    label: "Quilometragem",
    scope: "vehicle",
    check: ({ vehicle }) => typeof vehicle.mileageKm === "number" && vehicle.mileageKm >= 0,
  },
  {
    key: "photos",
    label: "Pelo menos 1 foto",
    scope: "vehicle",
    check: ({ vehicle }) => vehicle.photos.length > 0,
  },
  {
    key: "store.whatsapp",
    label: "WhatsApp da loja (com DDD)",
    scope: "store",
    hint: "Configurações da loja",
    check: ({ store }) => {
      const d = digits(store?.whatsapp ?? store?.phone ?? null);
      const n = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
      return /^\d{10,11}$/.test(n);
    },
  },
  {
    key: "store.city",
    label: "Cidade da loja",
    scope: "store",
    hint: "Configurações da loja",
    check: ({ store }) => hasText(store?.city ?? null),
  },
  {
    key: "store.state",
    label: "Estado da loja (UF)",
    scope: "store",
    hint: "Configurações da loja",
    check: ({ store }) => /^[A-Za-z]{2}$/.test((store?.stateCode ?? "").trim()),
  },
  {
    key: "integration.connected",
    label: "Conta do Mercado Livre conectada",
    scope: "integration",
    hint: "Integrações → Mercado Livre",
    check: ({ integrationConnected }) => integrationConnected !== false,
  },
];

/**
 * Mapeamento explícito: nosso modelo -> modelo exigido pelo Mercado Livre.
 * Usado pelo conector e exibido no painel para auditoria.
 */
export const MERCADOLIVRE_FIELD_MAP: ReadonlyArray<{ ours: string; theirs: string; note?: string }> = [
  { ours: "brand", theirs: "attributes[BRAND].value_name" },
  { ours: "model", theirs: "attributes[MODEL].value_name" },
  { ours: "version", theirs: "attributes[TRIM].value_name" },
  { ours: "modelYear / manufactureYear", theirs: "attributes[VEHICLE_YEAR].value_name" },
  { ours: "mileageKm", theirs: "attributes[KILOMETERS].value_name", note: "em km" },
  { ours: "fuel", theirs: "attributes[FUEL_TYPE].value_name", note: "valores traduzidos" },
  { ours: "transmission", theirs: "attributes[TRANSMISSION].value_name", note: "valores traduzidos" },
  { ours: "bodyType", theirs: "attributes[BODYWORK].value_name", note: "valores traduzidos" },
  { ours: "doors", theirs: "attributes[DOORS].value_name" },
  { ours: "color", theirs: "attributes[COLOR].value_name" },
  { ours: "plate", theirs: "attributes[LICENSE_PLATE].value_name" },
  { ours: "vin", theirs: "attributes[VIN_LAST_DIGITS].value_name", note: "6 últimos dígitos" },
  { ours: "priceCents", theirs: "price", note: "em reais inteiros" },
  { ours: "photos", theirs: "pictures[].source" },
  { ours: "description", theirs: "POST /items/{id}/description", note: "sem telefone/site/endereço" },
  { ours: "store.city / store.stateCode", theirs: "location.city / location.state" },
  { ours: "store.whatsapp", theirs: "seller_contact.phone2" },
  { ours: "status", theirs: "status (active / paused / closed)" },
];

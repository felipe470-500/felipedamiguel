import type { CanonicalVehicle } from "@/lib/integrator/connector";

import { ML_CARS_CATEGORY } from "./constants";

export type MlStoreContact = {
  /** Apenas dígitos, sem +, espaços ou hífen. Obrigatório para contas car_dealer a partir de 01/10/2026. */
  countryCode: string;
  whatsapp: string;
  city: string;
  stateId: string;
};

export type MlAttribute = { id: string; value_name: string };

export type MlItemPayload = {
  title: string;
  category_id: string;
  price: number;
  currency_id: "BRL";
  listing_type_id: "silver";
  available_quantity: 1;
  channels: ["marketplace"];
  pictures: { source: string }[];
  location: {
    city: { name: string };
    state: { id: string };
    country: { id: "BR" };
  };
  seller_contact: { country_code2: string; phone2: string };
  attributes: MlAttribute[];
};

const FUEL_MAP: Record<string, string> = {
  flex: "Flex",
  gasolina: "Gasolina",
  etanol: "Etanol",
  diesel: "Diesel",
  gnv: "GNV",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
};

const TRANSMISSION_MAP: Record<string, string> = {
  manual: "Manual",
  automatico: "Automática",
  automatica: "Automática",
  automatizado: "Automatizada",
  cvt: "CVT",
};

function normalizeKey(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function buildTitle(vehicle: CanonicalVehicle, fallbackName: string): string {
  const parts = [vehicle.brand, vehicle.model, vehicle.version, vehicle.doors ? `${vehicle.doors}P` : null]
    .filter((part): part is string => Boolean(part && String(part).trim()));
  const base = parts.length >= 2 ? parts.join(" ") : fallbackName;
  const year = vehicle.modelYear ?? vehicle.manufactureYear;
  const title = year && !base.includes(String(year)) ? `${base} ${year}` : base;
  return title.slice(0, 60).trim();
}

/** Erros de validação que impedem a publicação — retornados antes de chamar a API. */
export function validateForMercadoLivre(
  vehicle: CanonicalVehicle,
  contact: MlStoreContact | null,
): string[] {
  const issues: string[] = [];
  if (!vehicle.brand) issues.push("Marca não preenchida");
  if (!vehicle.model) issues.push("Modelo não preenchido");
  if (!vehicle.modelYear && !vehicle.manufactureYear) issues.push("Ano não preenchido");
  if (!vehicle.priceCents || vehicle.priceCents <= 0) issues.push("Preço não preenchido");
  if (vehicle.photos.length === 0) issues.push("É obrigatório ter pelo menos 1 foto");
  if (!contact) issues.push("Dados de contato e localização da loja não configurados");
  else {
    if (!/^\d{1,3}$/.test(contact.countryCode)) issues.push("Código do país inválido (só dígitos)");
    if (!/^\d{10,11}$/.test(contact.whatsapp)) issues.push("WhatsApp da loja inválido (só dígitos, com DDD)");
    if (!contact.city) issues.push("Cidade da loja não configurada");
    if (!/^BR-[A-Z]{2}$/.test(contact.stateId)) issues.push("Estado da loja inválido (formato BR-GO)");
  }
  return issues;
}

export function buildItemPayload(
  vehicle: CanonicalVehicle,
  contact: MlStoreContact,
  options: { fallbackName: string; categoryId?: string },
): MlItemPayload {
  const year = String(vehicle.modelYear ?? vehicle.manufactureYear ?? "");
  const attributes: MlAttribute[] = [
    { id: "BRAND", value_name: vehicle.brand ?? "" },
    { id: "MODEL", value_name: vehicle.model ?? "" },
    { id: "VEHICLE_YEAR", value_name: year },
    { id: "ITEM_CONDITION", value_name: "Usado" },
  ];
  if (vehicle.version) attributes.push({ id: "TRIM", value_name: vehicle.version });
  if (vehicle.doors) attributes.push({ id: "DOORS", value_name: String(vehicle.doors) });
  if (typeof vehicle.mileageKm === "number") {
    attributes.push({ id: "KILOMETERS", value_name: `${vehicle.mileageKm} km` });
  }
  if (vehicle.fuel) {
    attributes.push({ id: "FUEL_TYPE", value_name: FUEL_MAP[normalizeKey(vehicle.fuel)] ?? vehicle.fuel });
  }
  if (vehicle.transmission) {
    attributes.push({
      id: "TRANSMISSION",
      value_name: TRANSMISSION_MAP[normalizeKey(vehicle.transmission)] ?? vehicle.transmission,
    });
  }
  if (vehicle.color) attributes.push({ id: "COLOR", value_name: vehicle.color });
  if (vehicle.plate) attributes.push({ id: "LICENSE_PLATE", value_name: vehicle.plate.toUpperCase() });
  if (vehicle.vin && vehicle.vin.length >= 6) {
    attributes.push({ id: "VIN_LAST_DIGITS", value_name: vehicle.vin.slice(-6) });
  }

  return {
    title: buildTitle(vehicle, options.fallbackName),
    category_id: options.categoryId ?? ML_CARS_CATEGORY,
    price: Math.round((vehicle.priceCents ?? 0) / 100),
    currency_id: "BRL",
    listing_type_id: "silver",
    available_quantity: 1,
    channels: ["marketplace"],
    pictures: vehicle.photos.slice(0, 12).map((source) => ({ source })),
    location: {
      city: { name: contact.city },
      state: { id: contact.stateId },
      country: { id: "BR" },
    },
    seller_contact: { country_code2: contact.countryCode, phone2: contact.whatsapp },
    attributes: attributes.filter((attribute) => attribute.value_name.trim().length > 0),
  };
}

/**
 * Atualização: desde 12/03/2026 o array pictures é obrigatório também no PUT,
 * e seller_contact passa a ser obrigatório em 01/10/2026 para contas car_dealer.
 */
export function buildUpdatePayload(
  vehicle: CanonicalVehicle,
  contact: MlStoreContact,
  options: { fallbackName: string; categoryId?: string },
): Partial<MlItemPayload> {
  const full = buildItemPayload(vehicle, contact, options);
  return {
    title: full.title,
    price: full.price,
    pictures: full.pictures,
    location: full.location,
    seller_contact: full.seller_contact,
    attributes: full.attributes,
  };
}

/** Descrição é enviada em chamada separada, sem telefone/site/endereço no corpo. */
export function buildDescriptionText(vehicle: CanonicalVehicle, fallbackName: string): string {
  const raw = vehicle.description?.trim() || fallbackName;
  return raw
    .replace(/\b\d{2}\s?\d{4,5}-?\d{4}\b/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .trim();
}

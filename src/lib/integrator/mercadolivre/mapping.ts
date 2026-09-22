import type { CanonicalVehicle } from "@/lib/integrator/connector";
import type { StoreProfileData } from "@/lib/integrator/validation";

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
  name?: string;
  family_name?: string;
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
  seller_contact: { country_code2: string; phone2: string; name?: string; family_name?: string };
  attributes: MlAttribute[];
};

/** Valores aceitos pela categoria MLB1744 (consultados na API de atributos). */
const FUEL_MAP: Record<string, string> = {
  flex: "Gasolina e álcool",
  "flex fuel": "Gasolina e álcool",
  "gasolina e alcool": "Gasolina e álcool",
  "alcool/gasolina": "Gasolina e álcool",
  "gasolina/alcool": "Gasolina e álcool",
  bicombustivel: "Gasolina e álcool",
  gasolina: "Gasolina",
  alcool: "Álcool",
  etanol: "Etanol",
  diesel: "Diesel",
  "diesel s10": "Diesel",
  gnv: "Gasolina e gás natural",
  "gasolina/gnv": "Gasolina e gás natural",
  "flex/gnv": "Gasolina-Álcool e gás natural",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
  "hibrido flex": "Híbrido/Flex",
  "hibrido gasolina": "Híbrido/Gasolina",
  "hibrido diesel": "Híbrido/Diesel",
};

const FUEL_VALUES = new Set(Object.values(FUEL_MAP));

const TRANSMISSION_MAP: Record<string, string> = {
  manual: "Manual",
  automatico: "Automática",
  automatica: "Automática",
  automatizado: "Semiautomática",
  cvt: "Automática CVT",
};

const BODY_MAP: Record<string, string> = {
  hatch: "Hatch",
  hatchback: "Hatch",
  sedan: "Sedã",
  suv: "SUV",
  picape: "Pick-Up",
  pickup: "Pick-Up",
  perua: "Perua",
  minivan: "Minivan",
  van: "Van",
  conversivel: "Conversível",
  cupe: "Coupé",
  coupe: "Coupé",
  furgao: "Furgão",
  caminhaoleve: "Caminhão leve",
  monovolume: "Monovolume",
  offroad: "Off-Road",
  roadster: "Roadster",
  crossover: "Crossover",
};

function normalizeKey(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Converte a ficha da loja no contato exigido pelo Mercado Livre. */
export function contactFromStoreProfile(store: StoreProfileData | null): MlStoreContact | null {
  if (!store) return null;
  const whatsapp = (store.whatsapp ?? store.phone ?? "").replace(/\D/g, "").slice(-11);
  const city = (store.city ?? "").trim();
  const stateCode = (store.stateCode ?? "").trim().toUpperCase();
  if (!/^\d{10,11}$/.test(whatsapp) || !city || !/^[A-Z]{2}$/.test(stateCode)) return null;
  return { countryCode: "55", whatsapp, city, stateId: `BR-${stateCode}` };
}

export function buildTitle(vehicle: CanonicalVehicle, fallbackName: string): string {
  const parts = [vehicle.brand, vehicle.model, vehicle.version, vehicle.doors ? `${vehicle.doors}P` : null].filter(
    (part): part is string => Boolean(part && String(part).trim()),
  );
  const base = parts.length >= 2 ? parts.join(" ") : fallbackName;
  const year = vehicle.modelYear ?? vehicle.manufactureYear;
  const title = year && !base.includes(String(year)) ? `${base} ${year}` : base;
  return title.slice(0, 60).trim();
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
    const mapped = FUEL_MAP[normalizeKey(vehicle.fuel)] ?? vehicle.fuel.trim();
    // A categoria só aceita valores da lista oficial; enviar texto livre faz o ML descartar o atributo.
    if (FUEL_VALUES.has(mapped)) attributes.push({ id: "FUEL_TYPE", value_name: mapped });
  }
  if (vehicle.transmission) {
    attributes.push({
      id: "TRANSMISSION",
      value_name: TRANSMISSION_MAP[normalizeKey(vehicle.transmission)] ?? vehicle.transmission,
    });
  }
  if (vehicle.bodyType) {
    attributes.push({
      id: "VEHICLE_BODY_TYPE",
      value_name: BODY_MAP[normalizeKey(vehicle.bodyType)] ?? vehicle.bodyType,
    });
  }
  if (vehicle.color) attributes.push({ id: "COLOR", value_name: vehicle.color });
  if (vehicle.plate) attributes.push({ id: "LICENSE_PLATE", value_name: vehicle.plate.toUpperCase() });
  if (vehicle.vin && vehicle.vin.length >= 6) {
    attributes.push({ id: "VIN_LAST_DIGITS", value_name: vehicle.vin.slice(-6) });
  }

  return {
    title: buildTitle(vehicle, options.fallbackName),
    family_name: "Miguel Veículos",
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
    seller_contact: {
      country_code2: contact.countryCode,
      phone2: contact.whatsapp,
      name: "Lara",
      family_name: "Miguel Veículos",
    },
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
    family_name: full.family_name,
    price: full.price,
    pictures: full.pictures,
    location: full.location,
    seller_contact: full.seller_contact,
    attributes: full.attributes,
  };
}

/** Descrição é enviada em chamada separada, sem telefone/site/endereço no corpo. */
export function buildDescriptionText(vehicle: CanonicalVehicle, fallbackName: string): string {
  const base = vehicle.description?.trim() || fallbackName;
  const optionals = vehicle.optionalFeatures?.length ? `\n\nOpcionais: ${vehicle.optionalFeatures.join(", ")}` : "";
  return `${base}${optionals}`
    .replace(/\b\d{2}\s?\d{4,5}-?\d{4}\b/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .trim();
}

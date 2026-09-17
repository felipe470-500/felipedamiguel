/**
 * Motor de validação do integrador.
 *
 * ESTOQUE CENTRAL -> VALIDADOR -> REGRAS DA PLATAFORMA -> CONECTOR -> API
 *
 * Este arquivo é genérico: não conhece nenhuma plataforma. Cada conector
 * declara sua própria lista de requisitos (checklist de integração) e o
 * motor devolve um relatório de prontidão padronizado.
 */
import type { CanonicalVehicle } from "./connector";

export type StoreProfileData = {
  tradeName: string | null;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postalCode: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  stateCode: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RequirementScope = "vehicle" | "store" | "integration";

export type ReadinessInput = {
  vehicle: CanonicalVehicle;
  store: StoreProfileData | null;
  /** Status da conexão da loja com a plataforma, quando aplicável. */
  integrationConnected?: boolean;
};

export type Requirement = {
  key: string;
  label: string;
  scope: RequirementScope;
  /** Onde o usuário resolve a pendência. */
  hint?: string;
  check: (input: ReadinessInput) => boolean;
};

export type RequirementResult = {
  key: string;
  label: string;
  scope: RequirementScope;
  ok: boolean;
  hint: string | null;
};

export type ReadinessReport = {
  platformId: string;
  platformName: string;
  /** false quando a plataforma ainda não foi configurada/conectada. */
  configured: boolean;
  ready: boolean;
  results: RequirementResult[];
  missing: RequirementResult[];
};

export function evaluateRequirements(
  requirements: readonly Requirement[],
  input: ReadinessInput,
): RequirementResult[] {
  return requirements.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    scope: requirement.scope,
    ok: Boolean(requirement.check(input)),
    hint: requirement.hint ?? null,
  }));
}

export function buildReadinessReport(
  platform: { id: string; name: string; requirements: readonly Requirement[]; configured?: boolean },
  input: ReadinessInput,
): ReadinessReport {
  const results = evaluateRequirements(platform.requirements, input);
  const missing = results.filter((result) => !result.ok);
  const configured = platform.configured ?? true;
  return {
    platformId: platform.id,
    platformName: platform.name,
    configured,
    ready: configured && missing.length === 0,
    results,
    missing,
  };
}

export function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Requisitos mínimos do estoque central — valem para qualquer plataforma.
 */
export const CORE_VEHICLE_REQUIREMENTS: readonly Requirement[] = [
  { key: "brand", label: "Marca", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.brand) },
  { key: "model", label: "Modelo", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.model) },
  {
    key: "year",
    label: "Ano (fabricação ou modelo)",
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
  { key: "photos", label: "Pelo menos 1 foto", scope: "vehicle", check: ({ vehicle }) => vehicle.photos.length > 0 },
  {
    key: "status",
    label: "Status do veículo",
    scope: "vehicle",
    check: ({ vehicle }) => vehicle.status !== "DRAFT",
  },
];

/** Campos recomendados: não bloqueiam o estoque, mas plataformas costumam exigir. */
export const EXTENDED_VEHICLE_REQUIREMENTS: readonly Requirement[] = [
  { key: "version", label: "Versão", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.version) },
  { key: "color", label: "Cor", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.color) },
  { key: "fuel", label: "Combustível", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.fuel) },
  { key: "transmission", label: "Câmbio", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.transmission) },
  { key: "bodyType", label: "Carroceria", scope: "vehicle", check: ({ vehicle }) => hasText(vehicle.bodyType) },
  { key: "doors", label: "Número de portas", scope: "vehicle", check: ({ vehicle }) => Boolean(vehicle.doors) },
  {
    key: "description",
    label: "Descrição",
    scope: "vehicle",
    check: ({ vehicle }) => hasText(vehicle.description),
  },
];

export function evaluateCoreReadiness(vehicle: CanonicalVehicle): RequirementResult[] {
  return evaluateRequirements(CORE_VEHICLE_REQUIREMENTS, { vehicle, store: null });
}

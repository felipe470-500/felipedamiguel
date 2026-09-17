/**
 * Registro de plataformas do integrador e seus requisitos (checklist de
 * integração). Cada plataforma declara aqui o que exige do veículo e da loja.
 * O Mercado Livre é apenas a primeira; as demais entram sem mexer no motor.
 */
import { ML_PLATFORM_ID } from "./mercadolivre/constants";
import { MERCADOLIVRE_REQUIREMENTS } from "./mercadolivre/requirements";
import {
  buildReadinessReport,
  CORE_VEHICLE_REQUIREMENTS,
  type ReadinessInput,
  type ReadinessReport,
  type Requirement,
} from "./validation";

export type PlatformDefinition = {
  id: string;
  name: string;
  /** false = conector ainda não implementado/configurado nesta instalação. */
  available: boolean;
  requirements: readonly Requirement[];
};

export const PLATFORM_REGISTRY: readonly PlatformDefinition[] = [
  {
    id: ML_PLATFORM_ID,
    name: "Mercado Livre",
    available: true,
    requirements: MERCADOLIVRE_REQUIREMENTS,
  },
  { id: "napista", name: "Na Pista", available: false, requirements: CORE_VEHICLE_REQUIREMENTS },
  { id: "olx", name: "OLX", available: false, requirements: CORE_VEHICLE_REQUIREMENTS },
  { id: "webmotors", name: "Webmotors", available: false, requirements: CORE_VEHICLE_REQUIREMENTS },
  { id: "icarros", name: "iCarros", available: false, requirements: CORE_VEHICLE_REQUIREMENTS },
  { id: "mobiauto", name: "MobiAuto", available: false, requirements: CORE_VEHICLE_REQUIREMENTS },
];

export function getPlatform(platformId: string): PlatformDefinition | null {
  return PLATFORM_REGISTRY.find((platform) => platform.id === platformId) ?? null;
}

export function evaluatePlatformReadiness(
  platformId: string,
  input: ReadinessInput,
): ReadinessReport {
  const platform = getPlatform(platformId);
  if (!platform) {
    return {
      platformId,
      platformName: platformId,
      configured: false,
      ready: false,
      results: [],
      missing: [],
    };
  }
  return buildReadinessReport(
    {
      id: platform.id,
      name: platform.name,
      requirements: platform.requirements,
      configured: platform.available && (input.integrationConnected ?? true),
    },
    input,
  );
}

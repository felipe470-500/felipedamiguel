import type { CanonicalVehicle } from "@/lib/integrator/connector";

import {
  categorizeMlError,
  getValidAccessToken,
  mlFetch,
  type SupabaseAdmin,
} from "./api.server";
import { ML_CARS_CATEGORY, ML_PLATFORM_ID, ML_SITE_ID } from "./constants";
import {
  buildDescriptionText,
  buildItemPayload,
  buildUpdatePayload,
  validateForMercadoLivre,
  type MlStoreContact,
} from "./mapping";

const PUBLIC_ORIGIN = process.env["PUBLIC_SITE_ORIGIN"] ?? "https://miguelveiculosfsa.com";
const VIDEO_RE = /\.(mp4|mov|m4v|webm|ogg|mkv|avi)(\?|$)/i;

function absolutePhotoUrl(src: string): string | null {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return null;
  if (VIDEO_RE.test(src)) return null;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/api/")) {
    const separator = src.includes("?") ? "&" : "?";
    return `${PUBLIC_ORIGIN}${src}${separator}format=jpg`;
  }
  return `${PUBLIC_ORIGIN}/api/public/vehicle-image?path=${encodeURIComponent(src)}&format=jpg`;
}

type VehicleRow = {
  id: string;
  store_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  manufacture_year: number | null;
  model_year: number | null;
  price_cents: number | null;
  price: string | null;
  mileage_km: number | null;
  color: string | null;
  fuel: string | null;
  transmission: string | null;
  doors: number | null;
  description: string | null;
  plate: string | null;
  vin: string | null;
  status: CanonicalVehicle["status"];
  images: string[] | null;
  internal_code: number | null;
  record_version: number;
};

const VEHICLE_COLUMNS =
  "id, store_id, name, brand, model, version, manufacture_year, model_year, price_cents, price, mileage_km, color, fuel, transmission, doors, description, plate, vin, status, images, internal_code, record_version";

function parsePriceCents(row: VehicleRow): number | null {
  if (typeof row.price_cents === "number" && row.price_cents > 0) return row.price_cents;
  const digits = (row.price ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits) * 100;
}

export function toCanonicalVehicle(row: VehicleRow): CanonicalVehicle {
  const photos = (row.images ?? [])
    .map((src) => absolutePhotoUrl(src))
    .filter((src): src is string => Boolean(src));
  return {
    id: row.id,
    storeId: row.store_id,
    internalCode: row.internal_code,
    brand: row.brand,
    model: row.model,
    version: row.version,
    manufactureYear: row.manufacture_year,
    modelYear: row.model_year,
    priceCents: parsePriceCents(row),
    mileageKm: row.mileage_km,
    color: row.color,
    fuel: row.fuel,
    transmission: row.transmission,
    doors: row.doors,
    description: row.description,
    plate: row.plate,
    vin: row.vin,
    status: row.status,
    photos,
    videos: [],
    recordVersion: row.record_version,
  };
}

export type MlIntegrationRow = {
  id: string;
  store_id: string;
  status: "NOT_CONNECTED" | "CONNECTED" | "DEGRADED" | "BLOCKED";
  external_store_id: string | null;
  last_error: string | null;
  capabilities: Record<string, unknown>;
};

export async function ensureMlIntegration(
  supabaseAdmin: SupabaseAdmin,
  storeId: string,
): Promise<MlIntegrationRow> {
  const { data, error } = await supabaseAdmin
    .from("store_integrations")
    .select("id, store_id, status, external_store_id, last_error, capabilities")
    .eq("store_id", storeId)
    .eq("platform_id", ML_PLATFORM_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as MlIntegrationRow;

  const { data: created, error: insertError } = await supabaseAdmin
    .from("store_integrations")
    .insert({
      store_id: storeId,
      platform_id: ML_PLATFORM_ID,
      status: "NOT_CONNECTED",
      capabilities: {},
    })
    .select("id, store_id, status, external_store_id, last_error, capabilities")
    .single();
  if (insertError || !created) throw new Error(insertError?.message ?? "Falha ao criar integração");
  return created as MlIntegrationRow;
}

export function readContact(capabilities: Record<string, unknown>): MlStoreContact | null {
  const contact = capabilities["contact"] as Record<string, unknown> | undefined;
  if (!contact) return null;
  const countryCode = String(contact["countryCode"] ?? "55").replace(/\D/g, "");
  const whatsapp = String(contact["whatsapp"] ?? "").replace(/\D/g, "");
  const city = String(contact["city"] ?? "").trim();
  const stateId = String(contact["stateId"] ?? "").trim().toUpperCase();
  if (!whatsapp || !city || !stateId) return null;
  return { countryCode, whatsapp, city, stateId };
}

async function logSync(
  supabaseAdmin: SupabaseAdmin,
  input: {
    storeId: string;
    storeIntegrationId: string;
    vehicleId?: string | null;
    operation: string;
    outcome: "SUCCESS" | "FAILURE";
    httpStatus?: number | null;
    errorCategory?: string | null;
    message?: string | null;
  },
): Promise<void> {
  await supabaseAdmin.from("sync_logs").insert({
    store_id: input.storeId,
    store_integration_id: input.storeIntegrationId,
    vehicle_id: input.vehicleId ?? null,
    correlation_id: crypto.randomUUID(),
    operation: input.operation,
    attempt: 1,
    outcome: input.outcome,
    http_status: input.httpStatus ?? null,
    error_category: input.errorCategory ?? null,
    message: input.message?.slice(0, 500) ?? null,
    response_summary: {},
  });
}

async function saveVehicleIntegration(
  supabaseAdmin: SupabaseAdmin,
  input: {
    vehicleId: string;
    storeIntegrationId: string;
    externalId?: string | null;
    externalStatus?: string | null;
    syncStatus: "SUCCEEDED" | "FAILED" | "PENDING";
    httpStatus?: number | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("vehicle_integrations")
    .select("id, external_id")
    .eq("vehicle_id", input.vehicleId)
    .eq("store_integration_id", input.storeIntegrationId)
    .maybeSingle();

  const row = {
    vehicle_id: input.vehicleId,
    store_integration_id: input.storeIntegrationId,
    external_id: input.externalId ?? existing?.external_id ?? null,
    external_status: input.externalStatus ?? null,
    sync_status: input.syncStatus,
    last_synced_at: new Date().toISOString(),
    last_http_status: input.httpStatus ?? null,
    last_error_code: input.errorCode ?? null,
    last_error_message: input.errorMessage?.slice(0, 500) ?? null,
  };
  if (existing?.id) {
    await supabaseAdmin.from("vehicle_integrations").update(row).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("vehicle_integrations").insert(row);
  }
}

export type MlSyncOutcome = {
  ok: boolean;
  externalId?: string;
  externalStatus?: string;
  httpStatus?: number;
  issues?: string[];
  errorMessage?: string;
};

/** Cria ou atualiza o anúncio do veículo no Mercado Livre, conforme já exista item_id. */
export async function syncVehicleToMl(
  supabaseAdmin: SupabaseAdmin,
  storeId: string,
  vehicleId: string,
): Promise<MlSyncOutcome> {
  const integration = await ensureMlIntegration(supabaseAdmin, storeId);
  const contact = readContact(integration.capabilities ?? {});

  const { data: vehicleRow, error: vehicleError } = await supabaseAdmin
    .from("vehicles")
    .select(VEHICLE_COLUMNS)
    .eq("id", vehicleId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (vehicleError) throw new Error(vehicleError.message);
  if (!vehicleRow) throw new Error("Veículo não encontrado");

  const vehicle = toCanonicalVehicle(vehicleRow as unknown as VehicleRow);
  const issues = validateForMercadoLivre(vehicle, contact);
  if (issues.length > 0 || !contact) {
    await saveVehicleIntegration(supabaseAdmin, {
      vehicleId,
      storeIntegrationId: integration.id,
      syncStatus: "FAILED",
      errorCode: "VALIDATION",
      errorMessage: issues.join("; "),
    });
    await logSync(supabaseAdmin, {
      storeId,
      storeIntegrationId: integration.id,
      vehicleId,
      operation: "SYNC",
      outcome: "FAILURE",
      errorCategory: "VALIDATION",
      message: issues.join("; "),
    });
    return { ok: false, issues };
  }

  const tokens = await getValidAccessToken(supabaseAdmin, integration.id);
  const { data: link } = await supabaseAdmin
    .from("vehicle_integrations")
    .select("external_id")
    .eq("vehicle_id", vehicleId)
    .eq("store_integration_id", integration.id)
    .maybeSingle();

  const options = { fallbackName: (vehicleRow as unknown as VehicleRow).name };
  const existingItemId = link?.external_id ?? null;

  const result = existingItemId
    ? await mlFetch<{ id: string; status: string }>(tokens.accessToken, `/items/${existingItemId}`, {
        method: "PUT",
        body: buildUpdatePayload(vehicle, contact, options),
      })
    : await mlFetch<{ id: string; status: string }>(tokens.accessToken, "/items", {
        method: "POST",
        body: buildItemPayload(vehicle, contact, { ...options, categoryId: ML_CARS_CATEGORY }),
      });

  if (!result.ok) {
    const category = categorizeMlError(result.status);
    await saveVehicleIntegration(supabaseAdmin, {
      vehicleId,
      storeIntegrationId: integration.id,
      syncStatus: "FAILED",
      httpStatus: result.status,
      errorCode: category,
      errorMessage: result.errorMessage ?? null,
    });
    await logSync(supabaseAdmin, {
      storeId,
      storeIntegrationId: integration.id,
      vehicleId,
      operation: existingItemId ? "UPDATE" : "CREATE",
      outcome: "FAILURE",
      httpStatus: result.status,
      errorCategory: category,
      message: result.errorMessage ?? null,
    });
    return {
      ok: false,
      httpStatus: result.status,
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    };
  }

  const itemId = result.body?.id ?? existingItemId!;
  // Descrição sempre em chamada separada, como exige a API.
  await mlFetch(tokens.accessToken, `/items/${itemId}/description`, {
    method: existingItemId ? "PUT" : "POST",
    body: { plain_text: buildDescriptionText(vehicle, options.fallbackName) },
  });

  await saveVehicleIntegration(supabaseAdmin, {
    vehicleId,
    storeIntegrationId: integration.id,
    externalId: itemId,
    externalStatus: result.body?.status ?? "active",
    syncStatus: "SUCCEEDED",
    httpStatus: result.status,
  });
  await logSync(supabaseAdmin, {
    storeId,
    storeIntegrationId: integration.id,
    vehicleId,
    operation: existingItemId ? "UPDATE" : "CREATE",
    outcome: "SUCCESS",
    httpStatus: result.status,
    message: `Anúncio ${itemId}`,
  });

  return {
    ok: true,
    externalId: itemId,
    ...(result.body?.status ? { externalStatus: result.body.status } : {}),
    httpStatus: result.status,
  };
}

export async function changeListingStatus(
  supabaseAdmin: SupabaseAdmin,
  storeId: string,
  vehicleId: string,
  status: "paused" | "active" | "closed",
): Promise<MlSyncOutcome> {
  const integration = await ensureMlIntegration(supabaseAdmin, storeId);
  const { data: link } = await supabaseAdmin
    .from("vehicle_integrations")
    .select("external_id")
    .eq("vehicle_id", vehicleId)
    .eq("store_integration_id", integration.id)
    .maybeSingle();
  if (!link?.external_id) return { ok: false, errorMessage: "Veículo ainda não tem anúncio no Mercado Livre" };

  const tokens = await getValidAccessToken(supabaseAdmin, integration.id);
  const result = await mlFetch<{ status: string }>(tokens.accessToken, `/items/${link.external_id}`, {
    method: "PUT",
    body: { status },
  });

  const operation = status === "paused" ? "PAUSE" : status === "active" ? "ACTIVATE" : "CLOSE";
  await logSync(supabaseAdmin, {
    storeId,
    storeIntegrationId: integration.id,
    vehicleId,
    operation,
    outcome: result.ok ? "SUCCESS" : "FAILURE",
    httpStatus: result.status,
    errorCategory: result.ok ? null : categorizeMlError(result.status),
    message: result.ok ? `Anúncio ${link.external_id} -> ${status}` : result.errorMessage ?? null,
  });
  await saveVehicleIntegration(supabaseAdmin, {
    vehicleId,
    storeIntegrationId: integration.id,
    externalId: link.external_id,
    externalStatus: result.ok ? status : null,
    syncStatus: result.ok ? "SUCCEEDED" : "FAILED",
    httpStatus: result.status,
    errorMessage: result.ok ? null : result.errorMessage ?? null,
  });

  return result.ok
    ? { ok: true, externalId: link.external_id, externalStatus: status, httpStatus: result.status }
    : { ok: false, httpStatus: result.status, ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}) };
}

/** Remoção definitiva: fecha o anúncio e em seguida marca deleted; 409 exige nova tentativa. */
export async function deleteListing(
  supabaseAdmin: SupabaseAdmin,
  storeId: string,
  vehicleId: string,
): Promise<MlSyncOutcome> {
  const closed = await changeListingStatus(supabaseAdmin, storeId, vehicleId, "closed");
  if (!closed.ok || !closed.externalId) return closed;

  const integration = await ensureMlIntegration(supabaseAdmin, storeId);
  const tokens = await getValidAccessToken(supabaseAdmin, integration.id);

  let last = await mlFetch(tokens.accessToken, `/items/${closed.externalId}`, {
    method: "PUT",
    body: { deleted: "true" },
  });
  for (let attempt = 0; !last.ok && last.status === 409 && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    last = await mlFetch(tokens.accessToken, `/items/${closed.externalId}`, {
      method: "PUT",
      body: { deleted: "true" },
    });
  }

  await logSync(supabaseAdmin, {
    storeId,
    storeIntegrationId: integration.id,
    vehicleId,
    operation: "DELETE",
    outcome: last.ok ? "SUCCESS" : "FAILURE",
    httpStatus: last.status,
    errorCategory: last.ok ? null : categorizeMlError(last.status),
    message: last.ok ? `Anúncio ${closed.externalId} removido` : last.errorMessage ?? null,
  });

  return last.ok
    ? { ok: true, externalId: closed.externalId, externalStatus: "deleted", httpStatus: last.status }
    : { ok: false, httpStatus: last.status, ...(last.errorMessage ? { errorMessage: last.errorMessage } : {}) };
}

export type MlQuota = {
  available: number | null;
  status: string | null;
  expiresAt: string | null;
};

export async function getSilverQuota(
  supabaseAdmin: SupabaseAdmin,
  storeIntegrationId: string,
  mlUserId: number,
): Promise<MlQuota> {
  const tokens = await getValidAccessToken(supabaseAdmin, storeIntegrationId);
  const result = await mlFetch<{
    status?: string;
    date_expires?: string;
    listing_details?: { remaining_listings?: number }[];
  }>(tokens.accessToken, `/users/${mlUserId}/classifieds_promotion_packs/silver`);
  if (!result.ok || !result.body) return { available: null, status: null, expiresAt: null };
  const remaining = result.body.listing_details?.reduce(
    (total, detail) => total + (detail.remaining_listings ?? 0),
    0,
  );
  return {
    available: typeof remaining === "number" ? remaining : null,
    status: result.body.status ?? null,
    expiresAt: result.body.date_expires ?? null,
  };
}

export type MlHealth = { health: number | null; level: string | null; goals: unknown[] };

export async function getItemHealth(
  supabaseAdmin: SupabaseAdmin,
  storeIntegrationId: string,
  itemId: string,
): Promise<MlHealth> {
  const tokens = await getValidAccessToken(supabaseAdmin, storeIntegrationId);
  const result = await mlFetch<{ health?: number; level?: string; goals?: unknown[] }>(
    tokens.accessToken,
    `/items/${itemId}/health`,
  );
  return {
    health: result.body?.health ?? null,
    level: result.body?.level ?? null,
    goals: result.body?.goals ?? [],
  };
}

/** Preditor de categoria oficial — evita fixar MLB1744 quando o título não for de carro. */
export async function predictCategory(
  supabaseAdmin: SupabaseAdmin,
  storeIntegrationId: string,
  title: string,
): Promise<string> {
  const tokens = await getValidAccessToken(supabaseAdmin, storeIntegrationId);
  const result = await mlFetch<{ category_id?: string }[]>(
    tokens.accessToken,
    `/sites/${ML_SITE_ID}/domain_discovery/search?limit=1&q=${encodeURIComponent(title)}`,
  );
  return result.body?.[0]?.category_id ?? ML_CARS_CATEGORY;
}

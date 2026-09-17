import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const vehicleSchema = z.object({ vehicleId: z.string().uuid() });
const statusSchema = z.object({
  vehicleId: z.string().uuid(),
  status: z.enum(["paused", "active", "closed"]),
});
const contactSchema = z.object({
  countryCode: z.string().regex(/^\d{1,3}$/),
  whatsapp: z.string().regex(/^\d{10,11}$/),
  city: z.string().min(2).max(80),
  stateId: z.string().regex(/^BR-[A-Z]{2}$/),
});

type AdminContext = { storeId: string };

async function requireStoreAdmin(context: {
  supabase: { from: (table: string) => any };
  userId: string;
}): Promise<AdminContext> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("store_id, role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const row = (data ?? []).find(
    (item: { store_id: string | null; role: string }) =>
      item.store_id && (item.role === "admin" || item.role === "manager" || item.role === "integration_operator"),
  );
  if (!row?.store_id) throw new Error("Sem permissão para gerenciar integrações");
  return { storeId: row.store_id as string };
}

export const getMercadoLivreStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId } = await requireStoreAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureMlIntegration, resolveMlStoreData, getSilverQuota } = await import(
      "@/lib/integrator/mercadolivre/service.server"
    );

    const integration = await ensureMlIntegration(supabaseAdmin, storeId);
    const { store, contact } = await resolveMlStoreData(supabaseAdmin, storeId, integration.capabilities ?? {});
    const storeReady = Boolean(contact);


    const { data: credential } = await supabaseAdmin
      .from("integration_credentials")
      .select("masked_identifier, expires_at, updated_at")
      .eq("store_integration_id", integration.id)
      .maybeSingle();

    const { count: listings } = await supabaseAdmin
      .from("vehicle_integrations")
      .select("id", { count: "exact", head: true })
      .eq("store_integration_id", integration.id)
      .not("external_id", "is", null);

    const mlUserId = integration.external_store_id ? Number(integration.external_store_id) : null;
    let quota: { available: number | null; status: string | null; expiresAt: string | null } | null = null;
    if (credential && mlUserId) {
      try {
        quota = await getSilverQuota(supabaseAdmin, integration.id, mlUserId);
      } catch {
        quota = null;
      }
    }

    const appConfigured = Boolean(
      process.env["MERCADOLIVRE_CLIENT_ID"] && process.env["MERCADOLIVRE_CLIENT_SECRET"],
    );

    return {
      appConfigured,
      status: integration.status,
      connected: Boolean(credential),
      account: credential?.masked_identifier ?? null,
      tokenExpiresAt: credential?.expires_at ?? null,
      lastError: integration.last_error,
      contact,
      storeReady,
      storeProfile: store,
      listings: listings ?? 0,
      quota,
    };
  });

export const saveMercadoLivreContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { storeId } = await requireStoreAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureMlIntegration } = await import("@/lib/integrator/mercadolivre/service.server");

    const integration = await ensureMlIntegration(supabaseAdmin, storeId);
    const capabilities = { ...(integration.capabilities ?? {}), contact: data };
    const { error } = await supabaseAdmin
      .from("store_integrations")
      .update({ capabilities })
      .eq("id", integration.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startMercadoLivreOAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId } = await requireStoreAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureMlIntegration } = await import("@/lib/integrator/mercadolivre/service.server");
    const { buildAuthorizationUrl, signState } = await import("@/lib/integrator/mercadolivre/api.server");

    const integration = await ensureMlIntegration(supabaseAdmin, storeId);
    const state = signState({ storeIntegrationId: integration.id, issuedAt: Date.now() });
    return { url: buildAuthorizationUrl(state) };
  });

export const disconnectMercadoLivreFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId } = await requireStoreAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureMlIntegration } = await import("@/lib/integrator/mercadolivre/service.server");

    const integration = await ensureMlIntegration(supabaseAdmin, storeId);
    await supabaseAdmin.from("integration_credentials").delete().eq("store_integration_id", integration.id);
    await supabaseAdmin
      .from("store_integrations")
      .update({ status: "NOT_CONNECTED", external_store_id: null, last_error: null })
      .eq("id", integration.id);
    return { ok: true };
  });

export const syncVehicleToMercadoLivreFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => vehicleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { storeId } = await requireStoreAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncVehicleToMl } = await import("@/lib/integrator/mercadolivre/service.server");
    return syncVehicleToMl(supabaseAdmin, storeId, data.vehicleId);
  });

export const changeMercadoLivreListingStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { storeId } = await requireStoreAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { changeListingStatus } = await import("@/lib/integrator/mercadolivre/service.server");
    return changeListingStatus(supabaseAdmin, storeId, data.vehicleId, data.status);
  });

export const deleteMercadoLivreListingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => vehicleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { storeId } = await requireStoreAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deleteListing } = await import("@/lib/integrator/mercadolivre/service.server");
    return deleteListing(supabaseAdmin, storeId, data.vehicleId);
  });

export const listMercadoLivreVehiclesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId } = await requireStoreAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureMlIntegration, resolveMlStoreData, toCanonicalVehicle, mlReadiness, VEHICLE_COLUMNS } =
      await import("@/lib/integrator/mercadolivre/service.server");
    const integration = await ensureMlIntegration(supabaseAdmin, storeId);
    const { store } = await resolveMlStoreData(supabaseAdmin, storeId, integration.capabilities ?? {});

    const [{ data: vehicles, error }, { data: links }] = await Promise.all([
      supabaseAdmin
        .from("vehicles")
        .select(`${VEHICLE_COLUMNS}, year, km, position`)
        .eq("store_id", storeId)
        .order("position", { ascending: true })
        .limit(300),
      supabaseAdmin
        .from("vehicle_integrations")
        .select("vehicle_id, external_id, external_status, sync_status, last_error_message, last_synced_at")
        .eq("store_integration_id", integration.id),
    ]);
    if (error) throw new Error(error.message);

    const byVehicle = new Map((links ?? []).map((link) => [link.vehicle_id, link]));
    return (vehicles ?? []).map((row) => {
      const vehicle = toCanonicalVehicle(row as never);
      const report = mlReadiness(vehicle, store, integration.status === "CONNECTED");
      const source = row as unknown as { id: string; name: string; price: string; year: string };
      return {
        id: source.id,
        name: source.name,
        price: source.price,
        year: source.year,
        status: vehicle.status,
        photos: vehicle.photos.length,
        listing: byVehicle.get(source.id) ?? null,
        readiness: {
          ready: report.ready,
          configured: report.configured,
          results: report.results,
          missing: report.missing.map((item) => ({ label: item.label, scope: item.scope, hint: item.hint })),
        },
      };
    });
  });

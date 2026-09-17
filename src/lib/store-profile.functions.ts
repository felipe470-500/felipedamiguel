import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optionalText = z.string().trim().max(160).nullable().optional();

const profileSchema = z.object({
  tradeName: z.string().trim().min(2).max(120),
  legalName: optionalText,
  taxId: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: optionalText,
  postalCode: optionalText,
  street: optionalText,
  streetNumber: optionalText,
  complement: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  stateCode: z.string().trim().max(2).nullable().optional(),
  countryCode: z.string().trim().max(2).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

type StoreContext = { storeId: string };

async function requireStore(context: {
  supabase: { from: (table: string) => any };
  userId: string;
}): Promise<StoreContext> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("store_id, role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const row = (data ?? []).find((item: { store_id: string | null }) => item.store_id);
  if (!row?.store_id) throw new Error("Sem permissão para gerenciar esta loja");
  return { storeId: row.store_id as string };
}

export const getStoreProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId } = await requireStore(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readStoreProfile } = await import("@/lib/integrator/mercadolivre/service.server");
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .maybeSingle();
    const profile = await readStoreProfile(supabaseAdmin, storeId);
    return { storeId, storeName: store?.name ?? "", profile };
  });

export const saveStoreProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { storeId } = await requireStore(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      store_id: storeId,
      trade_name: data.tradeName,
      legal_name: data.legalName ?? null,
      tax_id: data.taxId ?? null,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
      email: data.email ?? null,
      postal_code: data.postalCode ?? null,
      street: data.street ?? null,
      street_number: data.streetNumber ?? null,
      complement: data.complement ?? null,
      neighborhood: data.neighborhood ?? null,
      city: data.city ?? null,
      state_code: (data.stateCode ?? "").toUpperCase() || null,
      country_code: (data.countryCode ?? "BR").toUpperCase() || "BR",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    };
    const { error } = await supabaseAdmin
      .from("store_profiles")
      .upsert(row, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Painel de prontidão: checklist de cada plataforma para cada veículo. */
export const getVehiclesReadinessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId } = await requireStore(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readStoreProfile, toCanonicalVehicle, VEHICLE_COLUMNS } = await import(
      "@/lib/integrator/mercadolivre/service.server"
    );
    const { PLATFORM_REGISTRY, evaluatePlatformReadiness } = await import(
      "@/lib/integrator/platform-rules"
    );
    const { evaluateCoreReadiness } = await import("@/lib/integrator/validation");

    const [store, { data: vehicles, error }, { data: integrations }] = await Promise.all([
      readStoreProfile(supabaseAdmin, storeId),
      supabaseAdmin
        .from("vehicles")
        .select(VEHICLE_COLUMNS)
        .eq("store_id", storeId)
        .order("position", { ascending: true })
        .limit(500),
      supabaseAdmin.from("store_integrations").select("platform_id, status").eq("store_id", storeId),
    ]);
    if (error) throw new Error(error.message);

    const connected = new Map(
      (integrations ?? []).map((row) => [row.platform_id, row.status === "CONNECTED"]),
    );

    return (vehicles ?? []).map((row) => {
      const vehicle = toCanonicalVehicle(row as never);
      return {
        id: vehicle.id,
        name: (row as { name: string }).name,
        core: evaluateCoreReadiness(vehicle),
        platforms: PLATFORM_REGISTRY.map((platform) =>
          evaluatePlatformReadiness(platform.id, {
            vehicle,
            store,
            integrationConnected: platform.available ? connected.get(platform.id) ?? false : false,
          }),
        ),
      };
    });
  });

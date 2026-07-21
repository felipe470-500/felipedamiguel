import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ADMIN_PASSWORD = "felipe2026";

export const getSiteSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("lead_gate_enabled")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { lead_gate_enabled: data?.lead_gate_enabled ?? false };
});

export const setLeadGateFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.password !== ADMIN_PASSWORD) throw new Error("Senha incorreta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({ lead_gate_enabled: data.enabled })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveLeadFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        whatsapp: z.string().trim().min(6).max(30),
        payment_type: z.enum(["avista", "parcelado"]),
        payment_value: z.string().trim().max(60).optional().nullable(),
        desired_car: z.string().trim().max(120).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leads").insert({
      name: data.name,
      whatsapp: data.whatsapp,
      payment_type: data.payment_type,
      payment_value: data.payment_value ?? null,
      desired_car: data.desired_car ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLeadsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string() }).parse(input))
  .handler(async ({ data }) => {
    if (data.password !== ADMIN_PASSWORD) throw new Error("Senha incorreta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("leads")
      .select("id, name, whatsapp, payment_type, payment_value, desired_car, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listSellerProfilesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("seller_profiles")
    .select("seller_id, avatar_url");
  if (error) {
    if (error.message.toLowerCase().includes("does not exist") || error.message.toLowerCase().includes("relation")) {
      return [];
    }
    throw new Error(error.message);
  }
  return data ?? [];
});

export const saveSellerProfileFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        sellerId: z.string(),
        avatarUrl: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.password !== ADMIN_PASSWORD) throw new Error("Senha incorreta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("seller_profiles")
      .upsert({
        seller_id: data.sellerId,
        avatar_url: data.avatarUrl ?? null,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


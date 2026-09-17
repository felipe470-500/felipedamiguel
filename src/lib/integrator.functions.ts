import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bootstrapSchema = z.object({ password: z.string().min(1) });

export const bootstrapIntegratorAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bootstrapSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, organization_id")
      .eq("code", "MIGUEL")
      .single();
    if (storeError || !store) throw new Error("Loja principal não encontrada");

    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const displayName =
      typeof context.claims.user_metadata === "object" && context.claims.user_metadata !== null
        ? String((context.claims.user_metadata as Record<string, unknown>).full_name ?? email ?? "Administrador")
        : email ?? "Administrador";

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      user_id: context.userId,
      display_name: displayName,
      email,
    });
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: context.userId,
        organization_id: store.organization_id,
        store_id: store.id,
        role: "admin",
      },
      { onConflict: "user_id,organization_id,store_id,role" },
    );
    if (roleError) throw new Error(roleError.message);
    return { ok: true };
  });

export const getIntegratorDashboardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("store_id, role")
      .eq("user_id", context.userId);
    if (rolesError) throw new Error(rolesError.message);
    const storeId = roles?.find((role) => role.store_id)?.store_id;
    if (!storeId) return { authorized: false as const };

    const [vehicles, integrations, jobs, leads, logs] = await Promise.all([
      context.supabase.from("vehicles").select("status").eq("store_id", storeId),
      context.supabase
        .from("store_integrations")
        .select("id, status, last_error, updated_at, platforms(id, name, capabilities)")
        .eq("store_id", storeId),
      context.supabase.from("sync_jobs").select("status").eq("store_id", storeId),
      context.supabase.from("leads").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      context.supabase
        .from("sync_logs")
        .select("id, operation, outcome, http_status, message, created_at, platforms:store_integrations(platforms(name))")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    const issues = (
      [
        ["vehicles", vehicles.error],
        ["integrations", integrations.error],
        ["jobs", jobs.error],
        ["leads", leads.error],
        ["logs", logs.error],
      ] as const
    )
      .filter(([, error]) => Boolean(error))
      .map(([label, error]) => `${label}: ${error?.message ?? "erro desconhecido"}`);
    if (issues.length) console.error("[integrator-dashboard]", issues.join(" | "));

    const vehicleRows = vehicles.data ?? [];
    const jobRows = jobs.data ?? [];
    return {
      authorized: true as const,
      storeId,
      role: roles?.[0]?.role ?? "seller",
      metrics: {
        vehicles: vehicleRows.length,
        available: vehicleRows.filter((row) => row.status === "AVAILABLE").length,
        pending: jobRows.filter((row) => row.status === "PENDING" || row.status === "RETRY").length,
        errors: jobRows.filter((row) => row.status === "FAILED" || row.status === "DEAD_LETTER").length,
        leads: leads.count ?? 0,
        connected: (integrations.data ?? []).filter((row) => row.status === "CONNECTED").length,
      },
      integrations: integrations.data ?? [],
      logs: logs.data ?? [],
    };
  });
import { createFileRoute } from "@tanstack/react-router";

type MlNotification = {
  _id?: string;
  resource?: string;
  user_id?: number;
  topic?: string;
  application_id?: number;
  attempts?: number;
  sent?: string;
  received?: string;
};

/**
 * Receptor de notificações do Mercado Livre (tópicos configurados no DevCenter).
 * Responde 200 rapidamente — o ML reenvia se não receber 200 em poucos segundos —
 * e guarda o evento para processamento posterior.
 */
export const Route = createFileRoute("/api/public/integrations/mercadolivre/notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: MlNotification | null = null;
        try {
          payload = (await request.json()) as MlNotification;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        if (!payload?.topic || !payload.resource) {
          return new Response("invalid payload", { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: integration } = await supabaseAdmin
            .from("store_integrations")
            .select("id")
            .eq("platform_id", "mercadolivre")
            .eq("external_store_id", String(payload.user_id ?? ""))
            .maybeSingle();

          await supabaseAdmin.from("webhook_events").insert({
            platform_id: "mercadolivre",
            store_integration_id: integration?.id ?? null,
            external_event_id: payload._id ?? null,
            // O ML não assina o corpo; a origem é validada pelo application_id da nossa app.
            signature_valid: Boolean(payload.application_id),
            payload: payload as unknown as Record<string, unknown>,
            status: "RECEIVED",
          });
        } catch {
          // Nunca devolver erro ao ML por falha interna de gravação: evita reenvio infinito.
        }

        return new Response("ok", { status: 200, headers: { "cache-control": "no-store" } });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});

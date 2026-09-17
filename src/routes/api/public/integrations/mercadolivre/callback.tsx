import { createFileRoute } from "@tanstack/react-router";

function redirectTo(path: string): Response {
  return new Response(null, { status: 302, headers: { location: path, "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/public/integrations/mercadolivre/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        if (oauthError) return redirectTo(`/integracoes/mercado-livre?erro=${encodeURIComponent(oauthError)}`);
        if (!code || !state) return redirectTo("/integracoes/mercado-livre?erro=parametros_ausentes");

        const { verifyState, exchangeAuthorizationCode, saveTokens } = await import(
          "@/lib/integrator/mercadolivre/api.server"
        );
        const verified = verifyState(state);
        if (!verified) return redirectTo("/integracoes/mercado-livre?erro=estado_invalido");

        try {
          const tokens = await exchangeAuthorizationCode(code);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await saveTokens(supabaseAdmin, verified.storeIntegrationId, tokens);
          await supabaseAdmin
            .from("store_integrations")
            .update({
              status: "CONNECTED",
              external_store_id: String(tokens.userId),
              last_error: null,
              last_health_check_at: new Date().toISOString(),
            })
            .eq("id", verified.storeIntegrationId);
          return redirectTo("/integracoes/mercado-livre?conectado=1");
        } catch (error) {
          const message = error instanceof Error ? error.message : "falha_desconhecida";
          return redirectTo(`/integracoes/mercado-livre?erro=${encodeURIComponent(message)}`);
        }
      },
    },
  },
});

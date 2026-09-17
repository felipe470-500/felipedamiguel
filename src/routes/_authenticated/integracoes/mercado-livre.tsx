import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Pause, Play, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  changeMercadoLivreListingStatusFn,
  deleteMercadoLivreListingFn,
  disconnectMercadoLivreFn,
  getMercadoLivreStatusFn,
  listMercadoLivreVehiclesFn,
  startMercadoLivreOAuthFn,
  syncVehicleToMercadoLivreFn,
} from "@/lib/mercadolivre.functions";

export const Route = createFileRoute("/_authenticated/integracoes/mercado-livre")({
  validateSearch: (search: Record<string, unknown>) => ({
    conectado: typeof search["conectado"] === "string" ? search["conectado"] : undefined,
    erro: typeof search["erro"] === "string" ? search["erro"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Mercado Livre | Integrador Miguel Veículos" },
      {
        name: "description",
        content: "Conecte a conta do Mercado Livre e sincronize automaticamente os anúncios do estoque.",
      },
      { property: "og:title", content: "Mercado Livre | Integrador Miguel Veículos" },
      { property: "og:description", content: "Publicação, atualização e pausa automática de anúncios no Mercado Livre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MercadoLivrePage,
});

function MercadoLivrePage() {
  const search = useSearch({ from: "/_authenticated/integracoes/mercado-livre" });
  const queryClient = useQueryClient();

  const getStatus = useServerFn(getMercadoLivreStatusFn);
  const listVehicles = useServerFn(listMercadoLivreVehiclesFn);
  const startOAuth = useServerFn(startMercadoLivreOAuthFn);
  const disconnect = useServerFn(disconnectMercadoLivreFn);
  const syncVehicle = useServerFn(syncVehicleToMercadoLivreFn);
  const changeStatus = useServerFn(changeMercadoLivreListingStatusFn);
  const removeListing = useServerFn(deleteMercadoLivreListingFn);

  const status = useQuery({ queryKey: ["ml-status"], queryFn: () => getStatus({ data: {} } as never) });
  const vehicles = useQuery({ queryKey: ["ml-vehicles"], queryFn: () => listVehicles({ data: {} } as never) });

  const [feedback, setFeedback] = useState<string | null>(null);


  const connectMutation = useMutation({
    mutationFn: () => startOAuth({ data: {} } as never),
    onSuccess: (result: { url: string }) => {
      const opened = window.open(result.url, "_blank", "noopener,noreferrer");
      if (!opened) {
        try {
          window.top!.location.href = result.url;
        } catch {
          window.location.href = result.url;
        }
      } else {
        setFeedback(
          "Abrimos o login do Mercado Livre em uma nova aba. Depois de autorizar, volte e atualize esta página.",
        );
      }
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: { type: string; vehicleId: string }) => {
      if (action.type === "sync") return syncVehicle({ data: { vehicleId: action.vehicleId } });
      if (action.type === "delete") return removeListing({ data: { vehicleId: action.vehicleId } });
      return changeStatus({
        data: { vehicleId: action.vehicleId, status: action.type as "paused" | "active" },
      });
    },
    onSuccess: (result: { ok: boolean; issues?: string[]; errorMessage?: string }) => {
      setFeedback(
        result.ok
          ? "Anúncio atualizado no Mercado Livre."
          : result.issues?.join(" · ") ?? result.errorMessage ?? "Não foi possível concluir.",
      );
      void queryClient.invalidateQueries({ queryKey: ["ml-vehicles"] });
      void queryClient.invalidateQueries({ queryKey: ["ml-status"] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const data = status.data;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link to="/integrador" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <h1 className="text-2xl font-bold">Mercado Livre</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Publique e mantenha os anúncios do estoque sincronizados automaticamente.
      </p>

      {search.conectado ? (
        <p className="mt-4 rounded-md bg-primary/10 px-4 py-3 text-sm text-primary">Conta conectada com sucesso.</p>
      ) : null}
      {search.erro ? (
        <p className="mt-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Falha ao conectar: {search.erro}
        </p>
      ) : null}
      {feedback ? (
        <p className="mt-4 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">{feedback}</p>
      ) : null}

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Conexão da conta</h2>
        {status.isLoading ? (
          <Skeleton className="mt-4 h-20 w-full" />
        ) : !data?.appConfigured ? (
          <p className="mt-3 text-sm text-destructive">
            Falta cadastrar o App ID e a Secret Key da aplicação do Mercado Livre nas configurações seguras do projeto.
          </p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={data.connected ? "default" : "secondary"}>
                {data.connected ? "Conectado" : "Não conectado"}
              </Badge>
              {data.account ? <span className="text-muted-foreground">{data.account}</span> : null}
              {data.tokenExpiresAt ? (
                <span className="text-muted-foreground">
                  Acesso válido até {new Date(data.tokenExpiresAt).toLocaleString("pt-BR")}
                </span>
              ) : null}
            </div>
            {data.quota ? (
              <p className="text-muted-foreground">
                Pacote de publicação: {data.quota.status ?? "—"} · anúncios restantes:{" "}
                {data.quota.available ?? "—"}
              </p>
            ) : data.connected ? (
              <p className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" /> Não foi possível ler o pacote de publicação. Sem pacote ativo o
                Mercado Livre recusa novas publicações.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {data.connected ? "Reconectar conta" : "Conectar conta"}
              </Button>
              {data.connected ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    await disconnect({ data: {} } as never);
                    void queryClient.invalidateQueries({ queryKey: ["ml-status"] });
                  }}
                >
                  Desconectar
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Dados da loja usados nesta integração</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A partir de 01/10/2026 o WhatsApp é obrigatório em toda criação e atualização de anúncio de concessionária.
          Estes dados vêm das Configurações da loja e valem para todas as plataformas.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={data?.storeReady ? "default" : "secondary"}>
            {data?.storeReady ? "Dados da loja configurados" : "Dados da loja incompletos"}
          </Badge>
          {data?.contact ? (
            <span className="text-muted-foreground">
              +{data.contact.countryCode} {data.contact.whatsapp} · {data.contact.city}/
              {data.contact.stateId.replace("BR-", "")}
            </span>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link to="/configuracoes-loja">Editar dados da loja</Link>
          </Button>
        </div>
      </section>


      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Veículos e anúncios</h2>
        {vehicles.isLoading ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {(vehicles.data ?? []).map((vehicle) => (
              <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{vehicle.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {vehicle.year} · {vehicle.photos} foto(s) ·{" "}
                    {vehicle.listing?.external_id ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> anúncio {vehicle.listing.external_id} (
                        {vehicle.listing.external_status ?? "—"})
                      </span>
                    ) : (
                      "sem anúncio"
                    )}
                    {vehicle.listing?.last_error_message ? ` · ${vehicle.listing.last_error_message}` : ""}
                  </p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs">
                      <Badge variant={vehicle.readiness.ready ? "default" : "secondary"}>
                        {vehicle.readiness.ready
                          ? "Pronto para publicação"
                          : `Faltam ${vehicle.readiness.missing.length} item(ns)`}
                      </Badge>
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {vehicle.readiness.results.map((item) => (
                        <li key={item.key}>
                          {item.ok ? "✅" : "❌"} {item.label}
                          {!item.ok && item.hint ? ` — ${item.hint}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionMutation.isPending}
                    onClick={() => actionMutation.mutate({ type: "sync", vehicleId: vehicle.id })}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Sincronizar
                  </Button>
                  {vehicle.listing?.external_id ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionMutation.isPending}
                        onClick={() => actionMutation.mutate({ type: "paused", vehicleId: vehicle.id })}
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionMutation.isPending}
                        onClick={() => actionMutation.mutate({ type: "active", vehicleId: vehicle.id })}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionMutation.isPending}
                        onClick={() => actionMutation.mutate({ type: "delete", vehicleId: vehicle.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

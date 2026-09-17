import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CarFront,
  CheckCircle2,
  Clock3,
  LogOut,
  PlugZap,
  RefreshCw,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapIntegratorAdminFn, getIntegratorDashboardFn } from "@/lib/integrator.functions";

export const Route = createFileRoute("/_authenticated/integrador")({
  head: () => ({
    meta: [
      { title: "Painel do integrador | Miguel Veículos" },
      { name: "description", content: "Gestão central do estoque, integrações, sincronizações e leads da Miguel Veículos." },
      { property: "og:title", content: "Painel do integrador | Miguel Veículos" },
      { property: "og:description", content: "Painel privado do integrador automotivo e do estoque central." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: IntegratorDashboard,
});

const metricCards = [
  { key: "vehicles", label: "Veículos", icon: CarFront },
  { key: "available", label: "Disponíveis", icon: CheckCircle2 },
  { key: "pending", label: "Pendentes", icon: Clock3 },
  { key: "errors", label: "Erros", icon: AlertTriangle },
  { key: "leads", label: "Leads", icon: Users },
  { key: "connected", label: "Conectadas", icon: PlugZap },
] as const;

function IntegratorDashboard() {
  const getDashboard = useServerFn(getIntegratorDashboardFn);
  const bootstrap = useServerFn(bootstrapIntegratorAdminFn);
  const queryClient = useQueryClient();
  const [legacyPassword, setLegacyPassword] = useState("");
  const [activationError, setActivationError] = useState("");
  const [activating, setActivating] = useState(false);
  const dashboard = useQuery({ queryKey: ["integrator-dashboard"], queryFn: () => getDashboard() });

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    setActivating(true);
    setActivationError("");
    try {
      await bootstrap({ data: { password: legacyPassword } });
      setLegacyPassword("");
      await queryClient.invalidateQueries({ queryKey: ["integrator-dashboard"] });
    } catch {
      setActivationError("Senha administrativa incorreta.");
    } finally {
      setActivating(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/acesso");
  }

  if (dashboard.isLoading) {
    return <main className="min-h-screen bg-background p-6"><div className="mx-auto max-w-7xl space-y-5"><Skeleton className="h-16 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-72 w-full" /></div></main>;
  }

  if (dashboard.isError) {
    return <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground"><div className="text-center"><AlertTriangle className="mx-auto mb-4 size-10 text-destructive" /><h1 className="text-xl font-semibold">Não foi possível carregar o integrador</h1><Button className="mt-5" onClick={() => dashboard.refetch()}><RefreshCw className="size-4" />Tentar novamente</Button></div></main>;
  }

  if (!dashboard.data?.authorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <form onSubmit={activate} className="w-full max-w-md border border-border bg-card p-7 shadow-[var(--shadow-card)]">
          <Boxes className="mb-5 size-10 text-primary" />
          <h1 className="text-2xl font-bold">Ativar primeiro administrador</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use uma única vez a senha do painel antigo para vincular sua conta à Miguel Veículos.</p>
          <div className="mt-6 space-y-2"><Label htmlFor="legacy-password">Senha administrativa atual</Label><Input id="legacy-password" type="password" value={legacyPassword} onChange={(event) => setLegacyPassword(event.target.value)} required /></div>
          {activationError && <p className="mt-3 text-sm text-destructive">{activationError}</p>}
          <Button className="mt-5 w-full" disabled={activating}>{activating ? "Ativando..." : "Ativar minha conta"}</Button>
        </form>
      </main>
    );
  }

  const data = dashboard.data;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground"><Boxes className="size-5" /></div><div><p className="text-xs font-medium uppercase text-muted-foreground">Miguel Veículos</p><h1 className="text-lg font-bold">Integrador automotivo</h1></div></div>
          <div className="flex items-center gap-2"><Button asChild variant="outline" size="sm"><Link to="/admin">Painel atual</Link></Button><Button variant="ghost" size="icon" aria-label="Sair" title="Sair" onClick={signOut}><LogOut className="size-4" /></Button></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-7"><Badge variant="outline">Fundação operacional</Badge><h2 className="mt-3 text-3xl font-bold">Visão geral</h2><p className="mt-1 text-sm text-muted-foreground">Estoque central, plataformas e processamento em uma única visão.</p></div>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {metricCards.map(({ key, label, icon: Icon }) => <article key={key} className="border border-border bg-card p-4"><div className="flex items-center justify-between text-muted-foreground"><span className="text-xs font-medium uppercase">{label}</span><Icon className="size-4" /></div><strong className="mt-5 block text-3xl">{data.metrics[key]}</strong></article>)}
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <div><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold">Plataformas</h3><Badge variant="secondary">{data.integrations.length} configuradas</Badge></div><div className="border border-border bg-card">
            {data.integrations.length === 0 ? <div className="p-8 text-center"><PlugZap className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">Nenhuma plataforma conectada</p><p className="mt-1 text-sm text-muted-foreground">O Mercado Livre será o primeiro conector da fase inicial.</p></div> : data.integrations.map((integration) => <div key={integration.id} className="flex items-center justify-between border-b border-border p-4 last:border-0"><div><p className="font-medium">{integration.platforms?.name ?? "Plataforma"}</p><p className="text-xs text-muted-foreground">Atualizada em {new Date(integration.updated_at).toLocaleString("pt-BR")}</p></div><Badge variant={integration.status === "CONNECTED" ? "default" : "outline"}>{integration.status}</Badge></div>)}
          </div></div>
          <div><h3 className="mb-3 text-lg font-semibold">Atividade recente</h3><div className="border border-border bg-card">
            {data.logs.length === 0 ? <div className="p-8 text-center"><Clock3 className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">Nenhuma sincronização ainda</p><p className="mt-1 text-sm text-muted-foreground">As operações aparecerão aqui assim que o primeiro conector estiver ativo.</p></div> : data.logs.map((log) => <div key={log.id} className="border-b border-border p-4 last:border-0"><div className="flex items-center justify-between"><span className="font-medium">{log.operation}</span><Badge variant={log.outcome === "SUCCEEDED" ? "default" : "destructive"}>{log.http_status ?? log.outcome}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</p></div>)}
          </div></div>
        </section>
      </div>
    </main>
  );
}
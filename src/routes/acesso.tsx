import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CarFront, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/acesso")({
  head: () => ({
    meta: [
      { title: "Acesso ao integrador | Miguel Veículos" },
      { name: "description", content: "Acesso seguro da equipe ao integrador automotivo Miguel Veículos." },
      { property: "og:title", content: "Acesso ao integrador | Miguel Veículos" },
      { property: "og:description", content: "Área segura de gestão do estoque e das integrações automotivas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) return setError("Não foi possível entrar. Confira seus dados.");
    await navigate({ to: "/integrador" });
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setBusy(false);
      setError("Não foi possível entrar com o Google.");
      return;
    }
    if (!result.redirected) await navigate({ to: "/integrador" });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
      <section className="w-full max-w-md border border-border bg-card p-7 shadow-[var(--shadow-card)]">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground"><CarFront /></div>
          <div><p className="font-semibold">Miguel Veículos</p><h1 className="text-2xl font-bold">Integrador automotivo</h1></div>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle} disabled={busy}>
          Entrar com Google
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou use seu e-mail<span className="h-px flex-1 bg-border" /></div>
        <form className="space-y-4" onSubmit={signInWithPassword}>
          <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={busy}><LockKeyhole className="size-4" />{busy ? "Entrando..." : "Entrar"}</Button>
        </form>
      </section>
    </main>
  );
}
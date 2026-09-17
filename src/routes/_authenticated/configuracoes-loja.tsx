import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getStoreProfileFn, saveStoreProfileFn } from "@/lib/store-profile.functions";

export const Route = createFileRoute("/_authenticated/configuracoes-loja")({
  head: () => ({
    meta: [
      { title: "Configurações da loja | Integrador Miguel Veículos" },
      {
        name: "description",
        content: "Dados cadastrais, contato e endereço da loja usados por todas as integrações.",
      },
      { property: "og:title", content: "Configurações da loja | Integrador Miguel Veículos" },
      { property: "og:description", content: "Ficha única da loja reaproveitada por todos os conectores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StoreSettingsPage,
});

type FormState = {
  tradeName: string;
  legalName: string;
  taxId: string;
  phone: string;
  whatsapp: string;
  email: string;
  postalCode: string;
  street: string;
  streetNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  stateCode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
};

const EMPTY: FormState = {
  tradeName: "",
  legalName: "",
  taxId: "",
  phone: "",
  whatsapp: "",
  email: "",
  postalCode: "",
  street: "",
  streetNumber: "",
  complement: "",
  neighborhood: "",
  city: "",
  stateCode: "",
  countryCode: "BR",
  latitude: "",
  longitude: "",
};

function StoreSettingsPage() {
  const queryClient = useQueryClient();
  const getProfile = useServerFn(getStoreProfileFn);
  const saveProfile = useServerFn(saveStoreProfileFn);

  const query = useQuery({ queryKey: ["store-profile"], queryFn: () => getProfile({ data: {} } as never) });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const profile = query.data?.profile;
    if (!profile) {
      if (query.data?.storeName) setForm((old) => ({ ...old, tradeName: old.tradeName || query.data.storeName }));
      return;
    }
    setForm({
      tradeName: profile.tradeName ?? "",
      legalName: profile.legalName ?? "",
      taxId: profile.taxId ?? "",
      phone: profile.phone ?? "",
      whatsapp: profile.whatsapp ?? "",
      email: profile.email ?? "",
      postalCode: profile.postalCode ?? "",
      street: profile.street ?? "",
      streetNumber: profile.streetNumber ?? "",
      complement: profile.complement ?? "",
      neighborhood: profile.neighborhood ?? "",
      city: profile.city ?? "",
      stateCode: profile.stateCode ?? "",
      countryCode: profile.countryCode ?? "BR",
      latitude: profile.latitude == null ? "" : String(profile.latitude),
      longitude: profile.longitude == null ? "" : String(profile.longitude),
    });
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveProfile({
        data: {
          tradeName: form.tradeName,
          legalName: form.legalName || null,
          taxId: form.taxId || null,
          phone: form.phone || null,
          whatsapp: form.whatsapp || null,
          email: form.email || null,
          postalCode: form.postalCode || null,
          street: form.street || null,
          streetNumber: form.streetNumber || null,
          complement: form.complement || null,
          neighborhood: form.neighborhood || null,
          city: form.city || null,
          stateCode: form.stateCode || null,
          countryCode: form.countryCode || "BR",
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
        },
      }),
    onSuccess: () => {
      setFeedback("Dados da loja salvos. Todas as integrações passam a usar estas informações.");
      void queryClient.invalidateQueries({ queryKey: ["store-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["ml-status"] });
      void queryClient.invalidateQueries({ queryKey: ["ml-vehicles"] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  function field(key: keyof FormState, label: string, extra?: { placeholder?: string; numeric?: boolean }) {
    return (
      <div>
        <Label htmlFor={`store-${key}`}>{label}</Label>
        <Input
          id={`store-${key}`}
          value={form[key]}
          placeholder={extra?.placeholder ?? ""}
          inputMode={extra?.numeric ? "numeric" : undefined}
          onChange={(event) => setForm((old) => ({ ...old, [key]: event.target.value }))}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link to="/integrador" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <h1 className="text-2xl font-bold">Configurações da loja</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Estes dados são preenchidos uma única vez e usados automaticamente por todas as integrações.
      </p>

      {feedback ? (
        <p className="mt-4 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">{feedback}</p>
      ) : null}

      {query.isLoading ? (
        <Skeleton className="mt-6 h-72 w-full" />
      ) : (
        <form
          className="mt-6 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Identificação</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {field("tradeName", "Nome da loja")}
              {field("legalName", "Razão social")}
              {field("taxId", "CNPJ", { placeholder: "00.000.000/0001-00" })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Contato</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {field("phone", "Telefone", { placeholder: "6133330000", numeric: true })}
              {field("whatsapp", "WhatsApp (DDD + número)", { placeholder: "61821069510", numeric: true })}
              {field("email", "E-mail")}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Endereço</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {field("postalCode", "CEP", { numeric: true })}
              {field("street", "Endereço")}
              {field("streetNumber", "Número")}
              {field("complement", "Complemento")}
              {field("neighborhood", "Bairro")}
              {field("city", "Cidade")}
              {field("stateCode", "Estado (UF)", { placeholder: "GO" })}
              {field("countryCode", "País", { placeholder: "BR" })}
              {field("latitude", "Latitude")}
              {field("longitude", "Longitude")}
            </div>
          </section>

          <Button type="submit" disabled={mutation.isPending}>
            Salvar dados da loja
          </Button>
        </form>
      )}
    </main>
  );
}

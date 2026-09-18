import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { getAdminPassword, ADMIN_SESSION_KEY, mediaUrl } from "@/lib/vehicles-store";
import {
  listPlateSuggestionsFn,
  resolvePlateSuggestionFn,
  scanPlatesBatchFn,
} from "@/lib/plate-scan.functions";
import { lookupVehicleByPlateFn } from "@/lib/plate-lookup.functions";

export const Route = createFileRoute("/revisar-placas")({
  head: () => ({
    meta: [
      { title: "Revisar placas identificadas | Miguel Veículos" },
      {
        name: "description",
        content:
          "Área restrita para conferir e confirmar as placas que a inteligência identificou nas fotos dos veículos do estoque.",
      },
      { property: "og:title", content: "Revisar placas identificadas | Miguel Veículos" },
      {
        property: "og:description",
        content: "Confirme, edite ou descarte as placas lidas automaticamente nas fotos do estoque.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ReviewPlatesPage,
});

type Suggestion = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  plate: string | null;
  confidence: number;
  photoIndex: number | null;
  photoUrl: string | null;
  status: string;
};

function ReviewPlatesPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const listSuggestions = useServerFn(listPlateSuggestionsFn);
  const scanBatch = useServerFn(scanPlatesBatchFn);
  const resolveSuggestion = useServerFn(resolvePlateSuggestionFn);
  const lookupPlate = useServerFn(lookupVehicleByPlateFn);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
  }, []);

  async function refresh() {
    setError("");
    try {
      const res = await listSuggestions({ data: { password: getAdminPassword() } });
      setItems(res.suggestions);
      setRemaining(res.remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authed) {
      setLoading(false);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function handleScan(limit: number) {
    setScanning(true);
    setError("");
    setMsg("");
    try {
      const res = await scanBatch({ data: { password: getAdminPassword(), limit } });
      const found = res.processed.filter((p) => p.plate).length;
      setMsg(
        `${res.processed.length} veículo(s) analisado(s) · ${found} placa(s) identificada(s) · ${res.remaining} ainda sem análise.`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  async function handleConfirm(item: Suggestion) {
    const plate = (edits[item.id] ?? item.plate ?? "").trim();
    setError("");
    setMsg("");
    try {
      const res = await resolveSuggestion({
        data: { password: getAdminPassword(), id: item.id, action: "confirm", plate },
      });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      let extra = "";
      try {
        const info = await lookupPlate({ data: { password: getAdminPassword(), plate: res.plate ?? plate } });
        const parts = [info.brand, info.model, info.version, info.modelYear, info.color].filter(Boolean);
        if (parts.length > 0) {
          extra = ` Dados encontrados para conferência no cadastro: ${parts.join(" ")}.`;
        }
      } catch {
        /* consulta é opcional */
      }
      setMsg(`Placa ${res.plate} salva em ${item.vehicleName}.${extra}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleReject(item: Suggestion) {
    setError("");
    try {
      await resolveSuggestion({
        data: { password: getAdminPassword(), id: item.id, action: "reject" },
      });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!authed) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Revisar placas identificadas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre primeiro no painel do vendedor para acessar esta área.
        </p>
        <Link to="/admin" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Ir para o painel
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao painel
          </Link>
          <h1 className="mt-1 text-xl font-bold">Revisar placas identificadas</h1>
          <p className="text-xs text-muted-foreground">
            {remaining} veículo(s) sem placa ainda não analisados.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleScan(3)}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
          >
            <Search className="h-3.5 w-3.5" /> {scanning ? "Analisando…" : "Testar em 3 veículos"}
          </button>
          <button
            onClick={() => handleScan(5)}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Search className="h-3.5 w-3.5" /> Analisar próximos 5
          </button>
        </div>
      </header>

      {msg && <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-xs text-foreground">{msg}</p>}
      {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex gap-3">
              {item.photoUrl ? (
                <img
                  src={mediaUrl(item.photoUrl)}
                  alt={`Foto do veículo ${item.vehicleName}`}
                  className="h-24 w-32 flex-none rounded-lg object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-24 w-32 flex-none items-center justify-center rounded-lg bg-secondary text-[10px] text-muted-foreground">
                  sem foto
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">{item.vehicleName || "Veículo sem nome"}</h2>
                {item.plate ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Confiança da leitura: {Math.round(item.confidence * 100)}%
                      {item.photoIndex != null ? ` · Foto ${item.photoIndex + 1}` : ""}
                      {item.status === "REVIEW" ? " · REVISAR" : ""}
                    </p>
                    <input
                      value={edits[item.id] ?? item.plate}
                      onChange={(e) =>
                        setEdits((prev) => ({ ...prev, [item.id]: e.target.value.toUpperCase() }))
                      }
                      className="mt-2 w-36 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-bold tracking-widest"
                    />
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    PLACA NÃO IDENTIFICADA — nenhuma foto mostrou a placa com clareza.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.plate && (
                    <button
                      onClick={() => handleConfirm(item)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Check className="h-3.5 w-3.5" /> Confirmar
                    </button>
                  )}
                  <button
                    onClick={() => handleReject(item)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <X className="h-3.5 w-3.5" /> {item.plate ? "Não é esta placa" : "Dispensar"}
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma placa aguardando revisão. Use os botões acima para analisar as fotos do estoque.
          </p>
        )}
      </div>
    </main>
  );
}

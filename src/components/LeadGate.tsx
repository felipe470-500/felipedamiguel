import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Car } from "lucide-react";
import { saveLeadFn } from "@/lib/settings.functions";

const STORAGE_KEY = "fdm_lead_ok";

export function hasPassedLeadGate(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function LeadGate({ onDone }: { onDone: () => void }) {
  const saveLead = useServerFn(saveLeadFn);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [desiredCar, setDesiredCar] = useState("");
  const [paymentType, setPaymentType] = useState<"avista" | "parcelado">("parcelado");
  const [paymentValue, setPaymentValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !whatsapp.trim()) {
      setError("Preencha nome e WhatsApp.");
      return;
    }
    setSubmitting(true);
    try {
      await saveLead({
        data: {
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          payment_type: paymentType,
          payment_value: paymentValue.trim() || null,
          desired_car: desiredCar.trim() || null,
        },
      });
      localStorage.setItem(STORAGE_KEY, "1");
      onDone();
    } catch (e) {
      setError(`Não foi possível enviar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-background/95 px-4 py-8 backdrop-blur-md">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[image:var(--gradient-accent)] shadow-[var(--shadow-glow)]">
            <Car className="h-4 w-4 text-primary-foreground" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">Miguel Veículos</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Acesso ao catálogo
            </p>
          </div>
        </div>

        <h2 className="mt-4 text-xl font-bold tracking-tight">
          Antes de entrar, preciso de alguns dados
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assim eu já preparo as melhores ofertas pra você.
        </p>

        <div className="mt-5 space-y-3">
          <Field label="Seu nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Nome completo"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              required
            />
          </Field>
          <Field label="WhatsApp">
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              maxLength={30}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              required
            />
          </Field>
          <Field label="Qual carro está buscando?">
            <input
              value={desiredCar}
              onChange={(e) => setDesiredCar(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Hilux, Onix, SUV até 80 mil…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>



          <Field label="Forma de pagamento">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType("parcelado")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  paymentType === "parcelado"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Parcelado
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("avista")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  paymentType === "avista"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                À vista
              </button>
            </div>
          </Field>

          <Field
            label={
              paymentType === "parcelado"
                ? "Quanto pode pagar de parcela? (opcional)"
                : "Valor que pretende pagar à vista (opcional)"
            }
          >
            <input
              value={paymentValue}
              onChange={(e) => setPaymentValue(e.target.value)}
              maxLength={60}
              placeholder={paymentType === "parcelado" ? "Ex.: R$ 1.500/mês" : "Ex.: R$ 60.000"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-6 py-3.5 text-base font-semibold text-whatsapp-foreground shadow-[var(--shadow-card)] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <MessageCircle className="h-5 w-5" />
          {submitting ? "Enviando…" : "Acessar catálogo"}
        </button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Seus dados são usados apenas para atendimento.
        </p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

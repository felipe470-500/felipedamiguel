import { MessageCircle, X } from "lucide-react";
import { SELLERS, formatSellerPhone, whatsappLink, type Seller } from "@/lib/sellers";
import { trackEvent, type TrackingParams } from "@/lib/analytics";



export function SellerPickerDialog({
  open,
  onClose,
  message,
  source,
  title = "Escolha com quem falar",
  subtitle = "Selecione um vendedor para continuar no WhatsApp.",
  profiles,
  extraParams,
}: {
  open: boolean;
  onClose: () => void;
  /** Mensagem pré-preenchida no WhatsApp. */
  message?: string;
  /** Nome de origem para tracking (hero, catalog, vehicle_card, etc). */
  source: string;
  title?: string;
  subtitle?: string;
  profiles?: Record<string, string | null>;
  extraParams?: TrackingParams;
}) {
  if (!open) return null;

  function choose(seller: Seller) {
    const params: TrackingParams = { source, seller: seller.name, ...extraParams };
    if (params.vehicle_name && !params.content_name) {
      params.content_name = params.vehicle_name;
    }
    trackEvent("Lead", params);
    trackEvent("Contact", params);
    const url = whatsappLink(seller.phone, message);

    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) window.location.href = url;
    onClose();
  }


  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {SELLERS.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => choose(s)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-colors hover:border-whatsapp hover:bg-card"
              >
                <div className="flex items-center gap-3">
                  {profiles?.[s.id] ? (
                    <img
                      src={profiles[s.id]!}
                      alt={s.name}
                      className="h-9 w-9 rounded-full object-cover border border-border bg-muted"
                    />
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-whatsapp/15 text-whatsapp">
                      <MessageCircle className="h-4 w-4" />
                    </span>
                  )}
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatSellerPhone(s.phone)}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-whatsapp">Falar</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}



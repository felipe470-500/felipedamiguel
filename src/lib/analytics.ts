export const META_PIXEL_ID = "296429546487036";
// IDs do Google: preencha SOMENTE com os IDs reais da conta (nunca valores de exemplo).
// Enquanto estiverem vazios, nenhum script do Google é carregado no site.
export const GOOGLE_TAG_ID = ""; // Google Analytics 4 — começa com "G-"
export const GOOGLE_ADS_ID = ""; // Google Ads — começa com "AW-"
export const GOOGLE_ADS_WHATSAPP_LABEL = ""; // rótulo da conversão "Clique no WhatsApp" criada no Google Ads

const AM_KEY = "fdm_am";

export interface AdvancedMatchingData {
  em?: string;
  ph?: string;
}

/** Normaliza telefone BR para o formato aceito pelo Meta (somente dígitos, com DDI 55). */
function normalizePhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function normalizeEmail(raw: string): string | undefined {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

/** Lê os dados de correspondência avançada já informados pelo usuário neste navegador. */
export function getAdvancedMatching(): AdvancedMatchingData {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(AM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AdvancedMatchingData;
    const data: AdvancedMatchingData = {};
    if (parsed.em) data.em = parsed.em;
    if (parsed.ph) data.ph = parsed.ph;
    return data;
  } catch {
    return {};
  }
}

/**
 * Salva e reaplica os dados reais informados pelo usuário (somente email/telefone).
 * Nunca envie CPF, endereço ou dados de pagamento aqui.
 */
export function setAdvancedMatching(input: { email?: string | null; phone?: string | null }) {
  if (typeof window === "undefined") return;
  const data: AdvancedMatchingData = { ...getAdvancedMatching() };
  const em = input.email ? normalizeEmail(input.email) : undefined;
  const ph = input.phone ? normalizePhone(input.phone) : undefined;
  if (em) data.em = em;
  if (ph) data.ph = ph;
  if (!data.em && !data.ph) return;
  try {
    localStorage.setItem(AM_KEY, JSON.stringify(data));
  } catch {
    /* ignora */
  }
  const fbq = (window as any).fbq;
  if (typeof fbq === "function") {
    // Reinicializa o pixel já com Advanced Matching (não afeta eventos existentes).
    fbq("init", META_PIXEL_ID, data);
  }
}

export function initAnalytics() {
  if (typeof window === "undefined") return;

  // 1. Facebook Pixel
  if (!(window as any).fbq) {
    const w = window as any;
    const n: any = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    };
    w.fbq = n;
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = document.createElement("script");
    t.async = true;
    t.src = "https://connect.facebook.net/en_US/fbevents.js";
    const s = document.getElementsByTagName("script")[0];
    s?.parentNode?.insertBefore(t, s);
    // Advanced Matching manual: envia email/telefone em texto puro APENAS
    // quando o usuário já informou esses dados no site (o pixel faz o hash).
    const am = getAdvancedMatching();
    if (am.em || am.ph) {
      w.fbq("init", META_PIXEL_ID, am);
    } else {
      w.fbq("init", META_PIXEL_ID);
    }
    w.fbq("track", "PageView");
  }

  // 2. Google tag (GA4 e/ou Google Ads): só carrega quando houver ID real configurado
  const googleIds = [GOOGLE_TAG_ID, GOOGLE_ADS_ID].filter((id) => id.trim() !== "");
  if (googleIds.length > 0 && !(window as any).gtag) {
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${googleIds[0]}`;
    script.async = true;
    document.head.appendChild(script);

    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).gtag = function () {
      (window as any).dataLayer.push(arguments);
    };
    (window as any).gtag("js", new Date());
    googleIds.forEach((id) => (window as any).gtag("config", id));
  }
}

export interface TrackingParams {
  source?: string;
  seller?: string;
  vehicle_name?: string;
  vehicle_year?: string;
  vehicle_price?: string;
  [key: string]: string | number | boolean | undefined;
}

const standardEvents = new Set([
  "PageView",
  "ViewContent",
  "Lead",
  "Purchase",
  "CompleteRegistration",
  "Contact",
  "Search",
]);

export function trackEvent(event: string, params: TrackingParams) {
  if (typeof window === "undefined") return;

  // Garante que o fbq e gtag estejam disponíveis antes do disparo do evento
  initAnalytics();

  const metaParams: Record<string, unknown> = { ...params };
  if (params.vehicle_name && !params.content_name) {
    metaParams.content_name = params.vehicle_name;
  }

  const fbq = (window as any).fbq;
  if (typeof fbq === "function") {
    if (standardEvents.has(event)) {
      fbq("track", event, metaParams);
    } else {
      fbq("trackCustom", event, metaParams);
    }
  }

  const gtag = (window as any).gtag;
  if (typeof gtag === "function") {
    gtag("event", event.toLowerCase().replace(/\s+/g, "_"), metaParams);
  }
}

/**
 * Clique em qualquer botão de WhatsApp da loja. Gera UM único evento por plataforma:
 *  - Meta Pixel: "Contact"
 *  - Google Analytics 4: "whatsapp_click" (somente se GOOGLE_TAG_ID estiver preenchido)
 *  - Google Ads: conversão (somente se GOOGLE_ADS_ID e GOOGLE_ADS_WHATSAPP_LABEL estiverem preenchidos)
 * Parâmetros: source (origem do clique) e, quando houver, vehicle_id, vehicle_name, vehicle_year, vehicle_price.
 */
export function trackWhatsAppClick(params: TrackingParams) {
  if (typeof window === "undefined") return;

  initAnalytics();

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") clean[key] = value;
  }

  const fbq = (window as any).fbq;
  if (typeof fbq === "function") {
    const metaParams =
      clean.vehicle_name && !clean.content_name ? { ...clean, content_name: clean.vehicle_name } : clean;
    fbq("track", "Contact", metaParams);
  }

  const gtag = (window as any).gtag;
  if (typeof gtag === "function") {
    if (GOOGLE_TAG_ID) {
      gtag("event", "whatsapp_click", { ...clean, send_to: GOOGLE_TAG_ID, transport_type: "beacon" });
    }
    if (GOOGLE_ADS_ID && GOOGLE_ADS_WHATSAPP_LABEL) {
      gtag("event", "conversion", {
        send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_WHATSAPP_LABEL}`,
        transport_type: "beacon",
      });
    }
  }
}

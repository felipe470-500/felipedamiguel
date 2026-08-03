export const META_PIXEL_ID = "296429546487036";
export const GOOGLE_TAG_ID = "G-XXXXXXXXXX";

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
    w.fbq("init", META_PIXEL_ID);
    w.fbq("track", "PageView");
  }

  // 2. Google Analytics (GA4)
  if (!(window as any).gtag) {
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`;
    script.async = true;
    document.head.appendChild(script);

    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).gtag = function() {
      (window as any).dataLayer.push(arguments);
    };
    (window as any).gtag('js', new Date());
    (window as any).gtag('config', GOOGLE_TAG_ID);
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
  "Search"
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

export function trackWhatsAppClick(params: TrackingParams) {
  trackEvent("Contact", params);
}

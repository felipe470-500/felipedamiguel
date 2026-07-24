export const META_PIXEL_ID = "296429546487036";
export const GOOGLE_TAG_ID = "G-XXXXXXXXXX";

export function initAnalytics() {
  if (typeof window === "undefined") return;

  // 1. Facebook Pixel
  if (!(window as any).fbq) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    (window as any).fbq('init', META_PIXEL_ID);
    (window as any).fbq('track', 'PageView');
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

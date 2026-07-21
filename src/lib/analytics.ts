export interface TrackingParams {
  source?: string;
  seller?: string;
  vehicle_name?: string;
  vehicle_year?: string;
  vehicle_price?: string;
  [key: string]: string | number | boolean | undefined;
}


export function trackEvent(event: string, params: TrackingParams) {
  if (typeof window === "undefined") return;

  const metaParams: Record<string, unknown> = { ...params };
  if (params.vehicle_name && !params.content_name) {
    metaParams.content_name = params.vehicle_name;
  }

  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (fbq) {
    fbq("track", event, metaParams);
    fbq("trackCustom", event, metaParams);
  }

  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (gtag) {
    gtag("event", event.toLowerCase().replace(/\s+/g, "_"), metaParams);
  }
}

export function trackWhatsAppClick(params: TrackingParams) {
  trackEvent("WhatsAppClick", params);
  trackEvent("Contact", params);
}


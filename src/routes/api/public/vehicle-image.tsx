import { createFileRoute } from "@tanstack/react-router";

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|ogg|mkv|avi|quicktime)(\?|$)/i;

function isVideoPath(p: string): boolean {
  return VIDEO_EXT_RE.test(p);
}

// TTL curto para signed URLs de imagem (browser cacheia o 302 quase pelo mesmo tempo)
const IMAGE_SIGNED_TTL = 60 * 60 * 24; // 24h
const IMAGE_CACHE_MAXAGE = 60 * 60 * 20; // 20h — evita servir 302 com URL prestes a expirar
const VIDEO_SIGNED_TTL = 60 * 60; // 1h por request (proxy revalida)

// Cache em memória para assinar as URLs de forma estável (evita que a URL mude a cada fragmento/range de áudio/vídeo)
const urlCache = new Map<string, { url: string; expires: number }>();

async function getSignedUrlCached(
  supabaseAdmin: any,
  safePath: string,
  ttl: number,
  transform?: any
): Promise<string> {
  const cacheKey = `${safePath}:${JSON.stringify(transform || {})}`;
  const cached = urlCache.get(cacheKey);
  const now = Date.now();

  // Se já tiver em cache e faltar mais de 10 minutos para expirar, retorna ela
  if (cached && cached.expires > now + 10 * 60 * 1000) {
    return cached.url;
  }

  const { data, error } = await supabaseAdmin.storage
    .from("vehicle-images")
    .createSignedUrl(safePath, ttl, transform ? { transform } : undefined);

  if (error || !data?.signedUrl) {
    throw new Error("Failed to sign URL: " + (error?.message || "Not found"));
  }

  urlCache.set(cacheKey, {
    url: data.signedUrl,
    expires: now + ttl * 1000,
  });

  return data.signedUrl;
}

export const Route = createFileRoute("/api/public/vehicle-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path");
        if (!path) return new Response("Missing path", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const safePath = path.replace(/^\/+/, "");
        const video = isVideoPath(safePath);

        let signedUrl: string;
        try {
          signedUrl = await getSignedUrlCached(
            supabaseAdmin,
            safePath,
            video ? VIDEO_SIGNED_TTL : IMAGE_SIGNED_TTL,
            !video ? { width: 800, resize: "contain", quality: 80 } : undefined
          );
        } catch (err) {
          return new Response("Not found", { status: 404 });
        }

        // IMAGENS: 302 com cache permanente no browser e na CDN Edge (Cloudflare/Vercel) para velocidade de sub-50ms
        if (!video) {
          return new Response(null, {
            status: 302,
            headers: {
              location: signedUrl,
              "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
            },
          });
        }

        // VÍDEOS: proxy com Content-Type: video/mp4 e suporte a Range.
        // Muitos .mov do iPhone são H.264/AAC e tocam em qualquer navegador quando
        // servidos como video/mp4 (o Chrome Android recusa video/quicktime).
        const range = request.headers.get("range");
        const upstreamHeaders: Record<string, string> = {};
        if (range) upstreamHeaders["range"] = range;

        const upstream = await fetch(signedUrl, { headers: upstreamHeaders });
        const headers = new Headers();
        headers.set("content-type", "video/mp4");
        headers.set("accept-ranges", "bytes");
        headers.set("cache-control", "public, max-age=3600");
        const cl = upstream.headers.get("content-length");
        if (cl) headers.set("content-length", cl);
        const cr = upstream.headers.get("content-range");
        if (cr) headers.set("content-range", cr);

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        });
      },
    },
  },
});

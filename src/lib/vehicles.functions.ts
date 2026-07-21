import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Senha admin (mesma do client). Validada também no servidor para proteger writes.
const ADMIN_PASSWORD = "felipe2026";

const VehicleInput = z.object({
  name: z.string(),
  year: z.string().default(""),
  km: z.string().default(""),
  price: z.string().default(""),
  tag: z.string().nullable().optional(),
  images: z.array(z.string()).default([]),
  plate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const listVehiclesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let res = await supabaseAdmin
    .from("vehicles")
    .select("id, name, year, km, price, tag, images, position, plate, description")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
    
  if (res.error && (res.error.message.toLowerCase().includes("column") || res.error.message.toLowerCase().includes("description") || res.error.message.toLowerCase().includes("plate"))) {
    const fallback = await supabaseAdmin
      .from("vehicles")
      .select("id, name, year, km, price, tag, images, position")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (fallback.error) throw new Error(fallback.error.message);
    
    return (fallback.data ?? []).map((v) => ({
      ...v,
      plate: null,
      description: null,
    })) as Array<{
      id: string;
      name: string;
      year: string;
      km: string;
      price: string;
      tag: string | null;
      images: string[];
      position: number;
      plate: string | null;
      description: string | null;
    }>;
  }
  
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as Array<{
    id: string;
    name: string;
    year: string;
    km: string;
    price: string;
    tag: string | null;
    images: string[];
    position: number;
    plate: string | null;
    description: string | null;
  }>;
});

export const saveVehiclesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        vehicles: z.array(VehicleInput),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.password !== ADMIN_PASSWORD) throw new Error("Senha incorreta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Substitui o catálogo inteiro pelo conteúdo enviado pelo admin
    const { error: delErr } = await supabaseAdmin
      .from("vehicles")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(delErr.message);

    if (data.vehicles.length > 0) {
      const rows = data.vehicles.map((v, i) => ({
        name: v.name,
        year: v.year ?? "",
        km: v.km ?? "",
        price: v.price ?? "",
        tag: v.tag ?? null,
        images: v.images ?? [],
        plate: v.plate ?? null,
        description: v.description ?? null,
        position: i,
      }));
      const { error: insErr } = await supabaseAdmin.from("vehicles").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

export const uploadVehicleImageFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        dataUrl: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.password !== ADMIN_PASSWORD) throw new Error("Senha incorreta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const match = data.dataUrl.match(/^data:((?:image|video)\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) throw new Error("Arquivo inválido (apenas imagens e vídeos são suportados)");
    const contentType = match[1];
    const base64 = match[2];
    const bytes = Buffer.from(base64, "base64");
    const extTemp = (contentType.split("/")[1] || "bin").replace("jpeg", "jpg");
    const ext = extTemp === "quicktime" ? "mov" : extTemp;
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from("vehicle-images")
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(error.message);

    return { url: `/api/public/vehicle-image?path=${encodeURIComponent(path)}` };
  });

/**
 * Cria uma URL assinada para upload direto ao storage (bypass do worker).
 * Necessário para vídeos grandes que estouram o limite de memória (~150MB) do worker.
 */
export const createVehicleUploadUrlFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        contentType: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.password !== ADMIN_PASSWORD) throw new Error("Senha incorreta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const extTemp = (data.contentType.split("/")[1] || "bin").replace("jpeg", "jpg").split(";")[0];
    const ext = extTemp === "quicktime" ? "mov" : extTemp;
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data: signed, error } = await supabaseAdmin.storage
      .from("vehicle-images")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar URL de upload");

    return {
      path,
      token: signed.token,
      publicUrl: `/api/public/vehicle-image?path=${encodeURIComponent(path)}`,
    };
  });






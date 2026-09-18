import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Confiança mínima para considerar que a IA realmente leu a placa. */
const MIN_CONFIDENCE = 0.5;
/** A partir daqui a leitura é considerada boa (abaixo vira "REVISAR"). */
const GOOD_CONFIDENCE = 0.8;
/** Máximo de fotos analisadas por veículo (evita custo e tempo excessivos). */
const MAX_PHOTOS = 12;

export type PlateSuggestion = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  plate: string | null;
  confidence: number;
  photoIndex: number | null;
  photoUrl: string | null;
  status: string;
};

function storagePathFromUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return null;
  const match = url.match(/[?&]path=([^&]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  if (url.startsWith("/api/")) return null;
  return url;
}

function isImagePath(path: string): boolean {
  return !/\.(mp4|mov|m4v|webm|ogg|mkv|avi|quicktime)$/i.test(path);
}

/**
 * Varre um lote pequeno de veículos sem placa, analisando TODAS as fotos de cada um
 * até encontrar uma placa legível. Nada é gravado no cadastro: o resultado fica na
 * fila "Revisar placas identificadas" aguardando confirmação do usuário.
 */
export const scanPlatesBatchFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        limit: z.number().min(1).max(5).default(3),
        vehicleIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readPlateFromDataUrl } = await import("@/lib/plate-ocr.server");

    // Veículos sem placa cadastrada.
    let query = supabaseAdmin
      .from("vehicles")
      .select("id, name, plate, images")
      .order("created_at", { ascending: true });
    if (data.vehicleIds && data.vehicleIds.length > 0) {
      query = query.in("id", data.vehicleIds);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const { data: done } = await supabaseAdmin.from("plate_suggestions").select("vehicle_id");
    const alreadyScanned = new Set((done ?? []).map((r) => r.vehicle_id as string));

    const pending = (rows ?? []).filter((r) => {
      const plate = (r.plate as string | null) ?? "";
      const images = (r.images as string[] | null) ?? [];
      if (plate.trim().length >= 7) return false;
      if (images.length === 0) return false;
      if (!data.vehicleIds && alreadyScanned.has(r.id as string)) return false;
      return true;
    });

    const batch = pending.slice(0, data.limit);
    const results: { vehicleId: string; vehicleName: string; plate: string | null; confidence: number; photoIndex: number | null }[] = [];

    for (const row of batch) {
      const images = ((row.images as string[] | null) ?? []).slice(0, MAX_PHOTOS);
      let best: { plate: string; confidence: number; index: number; url: string } | null = null;

      for (let i = 0; i < images.length; i++) {
        const url = images[i]!;
        const path = storagePathFromUrl(url);
        if (!path || !isImagePath(path)) continue;
        const file = await supabaseAdmin.storage.from("vehicle-images").download(path);
        if (file.error || !file.data) continue;
        const bytes = Buffer.from(await file.data.arrayBuffer());
        if (bytes.byteLength > 6 * 1024 * 1024) continue;
        const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
        let reading: { plate: string | null; confidence: number };
        try {
          reading = await readPlateFromDataUrl(dataUrl);
        } catch (e) {
          // Créditos/limite: interrompe o lote e devolve o que já foi feito.
          throw new Error(e instanceof Error ? e.message : String(e));
        }
        if (reading.plate && reading.confidence >= MIN_CONFIDENCE) {
          if (!best || reading.confidence > best.confidence) {
            best = { plate: reading.plate, confidence: reading.confidence, index: i, url };
          }
          if (reading.confidence >= GOOD_CONFIDENCE) break;
        }
      }

      const status = best ? (best.confidence >= GOOD_CONFIDENCE ? "PENDING" : "REVIEW") : "NOT_FOUND";
      await supabaseAdmin.from("plate_suggestions").upsert(
        {
          vehicle_id: row.id as string,
          plate: best?.plate ?? null,
          confidence: best?.confidence ?? 0,
          photo_index: best ? best.index : null,
          photo_url: best?.url ?? null,
          status,
          scanned_at: new Date().toISOString(),
          resolved_at: null,
        },
        { onConflict: "vehicle_id" },
      );

      results.push({
        vehicleId: row.id as string,
        vehicleName: (row.name as string) ?? "",
        plate: best?.plate ?? null,
        confidence: best?.confidence ?? 0,
        photoIndex: best ? best.index : null,
      });
    }

    return { processed: results, remaining: Math.max(0, pending.length - batch.length) };
  });

/** Lista as placas identificadas aguardando confirmação. */
export const listPlateSuggestionsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("plate_suggestions")
      .select("id, vehicle_id, plate, confidence, photo_index, photo_url, status")
      .in("status", ["PENDING", "REVIEW", "NOT_FOUND"])
      .order("confidence", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.vehicle_id as string);
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const { data: vs } = await supabaseAdmin.from("vehicles").select("id, name").in("id", ids);
      for (const v of vs ?? []) names.set(v.id as string, (v.name as string) ?? "");
    }

    // Quantos veículos ainda faltam ser analisados.
    const { data: all } = await supabaseAdmin.from("vehicles").select("id, plate, images");
    const scanned = new Set((rows ?? []).map((r) => r.vehicle_id as string));
    const { data: resolved } = await supabaseAdmin
      .from("plate_suggestions")
      .select("vehicle_id")
      .in("status", ["CONFIRMED", "REJECTED"]);
    for (const r of resolved ?? []) scanned.add(r.vehicle_id as string);
    const remaining = (all ?? []).filter((v) => {
      const plate = ((v.plate as string | null) ?? "").trim();
      const images = (v.images as string[] | null) ?? [];
      return plate.length < 7 && images.length > 0 && !scanned.has(v.id as string);
    }).length;

    return {
      remaining,
      suggestions: (rows ?? []).map((r) => ({
        id: r.id as string,
        vehicleId: r.vehicle_id as string,
        vehicleName: names.get(r.vehicle_id as string) ?? "Veículo",
        plate: (r.plate as string | null) ?? null,
        confidence: Number(r.confidence ?? 0),
        photoIndex: (r.photo_index as number | null) ?? null,
        photoUrl: (r.photo_url as string | null) ?? null,
        status: (r.status as string) ?? "PENDING",
      })) satisfies PlateSuggestion[],
    };
  });

/** Confirma (grava a placa no cadastro) ou descarta a sugestão. */
export const resolvePlateSuggestionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        id: z.string().uuid(),
        action: z.enum(["confirm", "reject"]),
        plate: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isPlateFormatValid, normalizePlate } = await import("@/lib/plate-ocr.server");

    const { data: row, error } = await supabaseAdmin
      .from("plate_suggestions")
      .select("id, vehicle_id, plate")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Sugestão não encontrada.");

    if (data.action === "reject") {
      await supabaseAdmin
        .from("plate_suggestions")
        .update({ status: "REJECTED", resolved_at: new Date().toISOString() })
        .eq("id", data.id);
      return { ok: true, plate: null as string | null };
    }

    const plate = normalizePlate(data.plate ?? (row.plate as string | null) ?? "");
    if (!isPlateFormatValid(plate)) throw new Error("Placa inválida. Use o formato AAA1B23 ou AAA1234.");

    const { error: upErr } = await supabaseAdmin
      .from("vehicles")
      .update({ plate })
      .eq("id", row.vehicle_id as string);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin
      .from("plate_suggestions")
      .update({ status: "CONFIRMED", plate, resolved_at: new Date().toISOString() })
      .eq("id", data.id);

    return { ok: true, plate };
  });

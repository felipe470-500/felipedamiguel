import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Lê a placa do veículo a partir de uma foto usando o Lovable AI Gateway.
 * Nunca inventa placa: quando a leitura é duvidosa devolve plate = null.
 */
export const readPlateFromImageFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string(), dataUrl: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { assertAdminPassword } = await import("@/lib/admin-auth.server");
    assertAdminPassword(data.password);

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Serviço de leitura de placa indisponível.");
    if (!data.dataUrl.startsWith("data:image/")) {
      return { plate: null as string | null, confidence: 0 };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Leia a placa do veículo brasileiro nesta foto. Responda em json. " +
                  "Se a placa não estiver totalmente legível, devolva plate null e confidence baixa. " +
                  "Nunca invente caracteres. Formatos válidos: AAA9A99 ou AAA9999.",
              },
              { type: "input_image", image_url: data.dataUrl },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "plate_reading",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                plate: { type: ["string", "null"] },
                confidence: { type: "number" },
              },
              required: ["plate", "confidence"],
            },
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      if (res.status === 402) throw new Error("Créditos de IA insuficientes para ler a placa.");
      if (res.status === 429) throw new Error("Muitas leituras seguidas. Tente novamente em instantes.");
      throw new Error(`Falha ao ler a placa (${res.status}). ${detail.slice(0, 160)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as { type?: string; delta?: string };
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          }
        } catch {
          /* ignora eventos parciais */
        }
      }
    }

    let plate: string | null = null;
    let confidence = 0;
    try {
      const parsed = JSON.parse(text) as { plate?: unknown; confidence?: unknown };
      if (typeof parsed.plate === "string") plate = parsed.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (typeof parsed.confidence === "number") confidence = parsed.confidence;
    } catch {
      plate = null;
    }

    const valid =
      !!plate && (/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) || /^[A-Z]{3}[0-9]{4}$/.test(plate));
    if (!valid) return { plate: null as string | null, confidence };
    return { plate, confidence };
  });

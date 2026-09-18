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
    const { readPlateFromDataUrl } = await import("@/lib/plate-ocr.server");
    return await readPlateFromDataUrl(data.dataUrl);
  });

export type Vehicle = {
  id: string;
  name: string;
  year: string;
  km: string;
  price: string;
  /** Lista de imagens (primeira é a principal). */
  images: string[];
  tag?: string | null;
  plate?: string | null;
  description?: string | null;
};


/**
 * Lê um arquivo de imagem, redimensiona (máx 1280px) e devolve um data URL
 * JPEG comprimido. Se for vídeo, lê diretamente como data URL sem redimensionar.
 */
export function fileToCompressedDataURL(
  file: File,
  maxSize = 1280,
  quality = 0.8,
): Promise<string> {
  if (file.type.startsWith("video/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") {
          resolve(e.target.result);
        } else {
          reject(new Error("Falha ao ler o vídeo"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("data:video/")) return true;
  const lowercase = url.toLowerCase();
  return (
    lowercase.includes(".mp4") ||
    lowercase.includes(".mov") ||
    lowercase.includes(".quicktime") ||
    lowercase.includes(".webm") ||
    lowercase.includes(".avi") ||
    lowercase.includes(".ogg") ||
    lowercase.includes(".mkv")
  );
}

// WhatsApp link único do Felipe (link de mensagem direta)
export const WHATSAPP_LINK = "https://wa.me/message/QBRI64EHLEE4H1";
export const WHATSAPP_DISPLAY = "(61) 99998-4235";
export const WHATSAPP_TEL = "+5561999984235";

// Admin: senha simples (altere aqui quando quiser)
export const ADMIN_PASSWORD = "felipe2026";
export const ADMIN_SESSION_KEY = "fdm_admin_ok";
export const ADMIN_SELLER_ID_KEY = "fdm_admin_seller_id";
export const ADMIN_SELLER_NAME_KEY = "fdm_admin_seller_name";




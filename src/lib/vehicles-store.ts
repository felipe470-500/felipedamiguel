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
  /** Campos estruturados do estoque central (usados pelas integrações). */
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  manufactureYear?: number | null;
  modelYear?: number | null;
  mileageKm?: number | null;
  priceCents?: number | null;
  color?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  bodyType?: string | null;
  doors?: number | null;
  vin?: string | null;
  optionalFeatures?: string[];
  status?: string | null;
};

export const FUEL_OPTIONS = ["Flex", "Gasolina", "Etanol", "Diesel", "GNV", "Elétrico", "Híbrido"];
export const TRANSMISSION_OPTIONS = ["Manual", "Automático", "Automatizado", "CVT"];
export const BODY_OPTIONS = [
  "Hatch",
  "Sedã",
  "SUV",
  "Picape",
  "Van",
  "Minivan",
  "Conversível",
  "Cupê",
  "Perua",
];
export const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "AVAILABLE", label: "Disponível" },
  { value: "RESERVED", label: "Reservado" },
  { value: "SOLD", label: "Vendido" },
  { value: "ARCHIVED", label: "Arquivado" },
];



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

// Admin: a senha NÃO fica no código do cliente. Ela é validada no servidor
// (variável de ambiente ADMIN_PASSWORD) e guardada só na sessão do navegador.
export const ADMIN_PWD_KEY = "fdm_admin_pwd";
export function getAdminPassword(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ADMIN_PWD_KEY) || "";
}
export const ADMIN_SESSION_KEY = "fdm_admin_ok";
export const ADMIN_SELLER_ID_KEY = "fdm_admin_seller_id";
export const ADMIN_SELLER_NAME_KEY = "fdm_admin_seller_name";




/**
 * Monta a URL final da mídia.
 * Os valores salvos no banco já vêm como `/api/public/vehicle-image?path=...`
 * (ou data:/http:). Só envolvemos no proxy quando for um nome de arquivo puro,
 * evitando duplicar o prefixo dentro do próprio parâmetro `path`.
 */
export function mediaUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (
    src.startsWith("/api/") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  ) {
    return src;
  }
  return `/api/public/vehicle-image?path=${encodeURIComponent(src)}`;
}

/** Campos obrigatórios do estoque central (valem no site e nas integrações). */
export const REQUIRED_VEHICLE_FIELDS: { key: keyof Vehicle; label: string }[] = [
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo" },
  { key: "version", label: "Versão" },
  { key: "manufactureYear", label: "Ano de fabricação" },
  { key: "modelYear", label: "Ano do modelo" },
  { key: "mileageKm", label: "Quilometragem" },
  { key: "priceCents", label: "Preço" },
  { key: "color", label: "Cor" },
  { key: "fuel", label: "Combustível" },
  { key: "transmission", label: "Câmbio" },
  { key: "bodyType", label: "Carroceria" },
  { key: "doors", label: "Número de portas" },
  { key: "description", label: "Descrição" },
];

/**
 * Lista o que falta para o veículo ficar pronto. Rascunhos ficam livres:
 * só é exigido quando o veículo sai de Rascunho.
 */
export function missingRequiredFields(vehicle: Partial<Vehicle>): string[] {
  if ((vehicle.status ?? "AVAILABLE") === "DRAFT") return [];
  const missing = REQUIRED_VEHICLE_FIELDS.filter(({ key }) => {
    const value = vehicle[key];
    if (typeof value === "number") return !Number.isFinite(value) || value < 0;
    return !(typeof value === "string" && value.trim().length > 0);
  }).map(({ label }) => label);
  if (!vehicle.images || vehicle.images.length === 0) missing.push("Pelo menos 1 foto");
  return missing;
}

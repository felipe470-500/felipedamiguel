export type Seller = {
  id: string;
  name: string;
  /** Número no formato internacional, apenas dígitos (55 + DDD + número). */
  phone: string;
};

export const SELLERS: Seller[] = [
  { id: "djan", name: "Djean", phone: "5561998418014" },
  { id: "caio", name: "Caio Victor", phone: "5561996093726" },
  { id: "felipe", name: "Felipe Miranda", phone: "5561996409981" },
  { id: "miguel", name: "Miguel", phone: "5561996290937" },
  { id: "vixtor", name: "Victor Hugo", phone: "5561995957439" },
  { id: "anderson", name: "Anderson Miguel", phone: "5561999021887" },
  { id: "felipe-vendedor", name: "Felipe", phone: "5561999984235" },
];

export function whatsappLink(phone: string, message?: string): string {
  const base = `https://wa.me/${phone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Formata como (DD) 9XXXX-XXXX a partir do número internacional (55...). */
export function formatSellerPhone(phone: string): string {
  const m = phone.match(/^55(\d{2})(\d{5})(\d{4})$/);
  if (!m) return phone;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

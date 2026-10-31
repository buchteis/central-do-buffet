export function normalizeWhatsAppPhone(phone: string | null | undefined) {
  const raw = (phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+") || digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function waLink(phone: string | null | undefined, message: string) {
  const number = normalizeWhatsAppPhone(phone);
  const text = encodeURIComponent(message);
  return `whatsapp://send?phone=${number}&text=${text}`;
}

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  // Suporta tanto {{var}} quanto {var}
  return tpl
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "")
    .replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export const DEFAULT_WA_CONTRACT_TEMPLATE =
  "Olá {cliente}! Segue o link para {acao} do seu contrato: {link}";

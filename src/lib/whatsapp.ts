export function waLink(phone: string | null | undefined, message: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : digits ? `55${digits}` : "";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  // Suporta tanto {{var}} quanto {var}
  return tpl
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "")
    .replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

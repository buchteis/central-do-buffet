export const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n ?? 0),
  );

export const brlCompact = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1000)
    return "R$ " + new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v / 1000) + "k";
  return brl(v);
};

const parseDate = (d: string | Date): Date => {
  if (d instanceof Date) return d;
  // Date-only string like "2026-07-16" → local midnight to avoid TZ shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + "T00:00:00");
  return new Date(d);
};

export const formatDateBR = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = parseDate(d);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
};

export const formatDateFullBR = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = parseDate(d);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
    date,
  );
};

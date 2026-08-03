/**
 * Cálculo do orçamento.
 *
 * Regras:
 * - Adultos: valor por pessoa do pacote.
 * - Crianças: quantidade x valor por criança (definido manualmente).
 * - Itens unitários (ex.: barril): quantidade x preço unitário — independem do nº de convidados.
 * - Acréscimos: itens manuais (descrição + valor) somados ao total.
 *
 * Total = Subtotal Pessoas + Subtotal Itens Unitários + Acréscimos.
 */
export type QuoteExtraItem = {
  description: string;
  value: number;
};

export type QuoteUnitItem = {
  product_id?: string | null;
  name: string;
  unit?: string;
  unit_price: number;
  qty: number;
};

export type QuoteInputs = {
  pricePerPerson: number;
  adults: number;
  childrenCount: number;
  childPrice: number;
  customExtras?: QuoteExtraItem[];
  unitItems?: QuoteUnitItem[];
};

export type QuoteBreakdown = {
  adultsSubtotal: number;
  childrenSubtotal: number;
  unitItemsSubtotal: number;
  extras: number;
  subtotal: number;
  total: number;
  entry: number;
  balance: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcQuote(input: QuoteInputs): QuoteBreakdown {
  const adultsSubtotal = (input.adults || 0) * (input.pricePerPerson || 0);
  const childrenSubtotal = (input.childrenCount || 0) * (input.childPrice || 0);
  const extras = (input.customExtras ?? []).reduce((sum, e) => sum + (Number(e.value) || 0), 0);
  const unitItemsSubtotal = (input.unitItems ?? []).reduce(
    (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.unit_price) || 0),
    0,
  );
  const subtotal = adultsSubtotal + childrenSubtotal;
  const total = round2(subtotal + unitItemsSubtotal + extras);
  const entry = round2(total * 0.5);
  const balance = round2(total - entry);
  return {
    adultsSubtotal: round2(adultsSubtotal),
    childrenSubtotal: round2(childrenSubtotal),
    unitItemsSubtotal: round2(unitItemsSubtotal),
    extras: round2(extras),
    subtotal: round2(subtotal),
    total,
    entry,
    balance,
  };
}

/** Normaliza nome para comparação (sem acentos, minúsculo, sem espaços duplicados). */
const normName = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Remove pacotes sem valor por pessoa que apenas duplicam um item unitário
 * com o mesmo nome (ex.: "Barril de Chopp" cadastrado como pacote e como item unitário).
 */
export function dedupePackages<T extends { name?: string | null; price_per_person?: number | null }>(
  packages: T[],
  unitItems: { name?: string | null; qty?: number | null }[] = [],
): T[] {
  const unitNames = new Set(
    (unitItems ?? [])
      .filter((i) => (Number(i?.qty) || 0) > 0)
      .map((i) => normName(i?.name))
      .filter(Boolean),
  );
  const seen = new Set<string>();
  return (packages ?? []).filter((p) => {
    const key = normName(p?.name);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    const ppp = Number(p?.price_per_person ?? 0) || 0;
    if (ppp <= 0 && unitNames.has(key)) return false;
    return true;
  });
}

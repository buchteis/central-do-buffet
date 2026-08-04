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

/** Só letras/números — tolera pontuação e espaçamento diferentes. */
const compactName = (s: unknown) => normName(s).replace(/[^a-z0-9]/g, "");

/** Distância de Levenshtein simples (para tolerar erros de digitação: "choop" vs "chopp"). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Nomes "iguais o suficiente" (contém ou até 2 caracteres de diferença). */
function similarName(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tolerance = Math.min(a.length, b.length) >= 6 ? 2 : 1;
  return levenshtein(a, b) <= tolerance;
}

/**
 * Remove pacotes sem valor por pessoa que apenas duplicam um item unitário
 * com o mesmo nome (ex.: "Barril de Choop" pacote x "Barril de Chopp" item unitário).
 */
export function dedupePackages<T extends { name?: string | null; price_per_person?: number | null }>(
  packages: T[],
  unitItems: { name?: string | null; qty?: number | null }[] = [],
): T[] {
  const unitNames = (unitItems ?? [])
    .filter((i) => (Number(i?.qty) || 0) > 0)
    .map((i) => compactName(i?.name))
    .filter(Boolean);
  const seen = new Set<string>();
  return (packages ?? []).filter((p) => {
    const key = compactName(p?.name);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    const ppp = Number(p?.price_per_person ?? 0) || 0;
    // Pacote sem valor que espelha um item unitário → não exibe (evita linha duplicada R$ 0,00).
    if (ppp <= 0 && unitNames.some((u) => similarName(key, u))) return false;
    return true;
  });
}


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
  const mirrorsUnitItems = (rawName: string): boolean => {
    if (unitNames.length === 0) return false;
    // Nome pode vir combinado ("Barril A + Barril B", "Barril A e Barril B").
    const parts = String(rawName ?? "")
      .split(/\s*(?:\+|\/|,|\be\b)\s*/i)
      .map((p) => compactName(p))
      .filter(Boolean);
    if (parts.length === 0) return false;
    return parts.every((p) => unitNames.some((u) => similarName(p, u)));
  };
  return (packages ?? []).filter((p) => {
    const key = compactName(p?.name);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    const ppp = Number(p?.price_per_person ?? 0) || 0;
    // Pacote sem valor que espelha um ou mais itens unitários → não exibe (evita linha duplicada R$ 0,00).
    if (ppp <= 0 && mirrorsUnitItems(String(p?.name ?? ""))) return false;
    return true;
  });
}



/* -------------------------------------------------------------------------- */
/* Faixas de preço por nº de convidados — regra ÚNICA do sistema              */
/* Usada no link público, em Orçamentos e em Eventos, e espelhada no banco    */
/* (função submit_public_quote_v2) para que cliente e buffet vejam o mesmo.   */
/* -------------------------------------------------------------------------- */
export type PriceTier = {
  id?: string;
  package_id?: string;
  min_guests: number;
  max_guests: number;
  price_per_person: number | string | null;
  /** Valor TOTAL da faixa quando o pacote é de preço fechado. */
  price_fixed?: number | string | null;
  position?: number | null;
  updated_at?: string | null;
};


/** Ordenação determinística: posição, faixa e, em empate, a faixa editada mais recentemente. */
function sortTiers(tiers: PriceTier[]): PriceTier[] {
  return [...tiers].sort((a, b) => {
    const pa = Number(a.position ?? 0);
    const pb = Number(b.position ?? 0);
    if (pa !== pb) return pa - pb;
    if (a.min_guests !== b.min_guests) return a.min_guests - b.min_guests;
    const ua = String(a.updated_at ?? "");
    const ub = String(b.updated_at ?? "");
    if (ua !== ub) return ua < ub ? 1 : -1; // mais recente primeiro
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

/**
 * Preço por pessoa de um pacote para um nº de convidados.
 * - Sem faixas → preço base do pacote.
 * - Dentro da faixa → preço da faixa.
 * - Fora das faixas → faixa mais próxima (abaixo/acima).
 */
export function resolveTierPrice(tiers: PriceTier[], guests: number, basePrice = 0): number {
  const list = sortTiers(tiers ?? []);
  if (list.length === 0) return Number(basePrice) || 0;
  const g = Number(guests) || 0;
  const inRange = list.find((t) => g >= t.min_guests && g <= t.max_guests);
  if (inRange) return Number(inRange.price_per_person) || 0;
  const byMin = [...list].sort((a, b) => a.min_guests - b.min_guests);
  if (g < byMin[0].min_guests) return Number(byMin[0].price_per_person) || 0;
  const below = [...list].filter((t) => t.max_guests < g).sort((a, b) => b.max_guests - a.max_guests);
  if (below.length) return Number(below[0].price_per_person) || 0;
  return Number(byMin[byMin.length - 1].price_per_person) || 0;
}

/* -------------------------------------------------------------------------- */
/* Preço fechado (fixed) x preço por pessoa (per_person) — regra ÚNICA        */
/* Usada em Pacotes, Orçamentos, Eventos, PDF/Contrato e no link público.      */
/* -------------------------------------------------------------------------- */
export type PricingType = "per_person" | "fixed";

export type PackageLike = {
  id?: string;
  name?: string | null;
  pricing_type?: string | null;
  price_per_person?: number | string | null;
};

export type PackagePricing = {
  isFixed: boolean;
  /** Valor por pessoa (em preço fechado = total ÷ convidados). */
  unitPrice: number;
  /** Valor total do pacote para o nº de convidados informado. */
  totalPrice: number;
  /** Valor fechado da faixa (0 quando é por pessoa). */
  priceFixed: number;
  tierFound: boolean;
};

/** Valor fechado (total) da faixa correspondente ao nº de convidados. */
export function resolveTierFixed(tiers: PriceTier[], guests: number, baseFixed = 0): number {
  const list = sortTiers(tiers ?? []);
  if (list.length === 0) return Number(baseFixed) || 0;
  const g = Number(guests) || 0;
  const inRange = list.find((t) => g >= t.min_guests && g <= t.max_guests);
  if (inRange) return Number(inRange.price_fixed ?? 0) || 0;
  const byMin = [...list].sort((a, b) => a.min_guests - b.min_guests);
  if (g < byMin[0].min_guests) return Number(byMin[0].price_fixed ?? 0) || 0;
  const below = [...list].filter((t) => t.max_guests < g).sort((a, b) => b.max_guests - a.max_guests);
  if (below.length) return Number(below[0].price_fixed ?? 0) || 0;
  return Number(byMin[byMin.length - 1].price_fixed ?? 0) || 0;
}

/**
 * Preço de um pacote conforme o tipo de cobrança.
 * - per_person: preço da faixa (ou base) x convidados.
 * - fixed: valor fechado da faixa (independe do nº de convidados);
 *   unitPrice é apenas a divisão informativa por convidado.
 */
export function resolvePackagePricing(
  pkg: PackageLike | null | undefined,
  tiers: PriceTier[] = [],
  guests = 0,
): PackagePricing {
  if (!pkg) return { isFixed: false, unitPrice: 0, totalPrice: 0, priceFixed: 0, tierFound: false };
  const list = (tiers ?? []).filter((t) => !pkg.id || !t.package_id || t.package_id === pkg.id);
  const g = Number(guests) || 0;
  const tierFound = list.some((t) => g >= t.min_guests && g <= t.max_guests);
  const isFixed = String(pkg.pricing_type ?? "per_person") === "fixed";

  if (isFixed) {
    const priceFixed = resolveTierFixed(list, g, 0);
    return {
      isFixed: true,
      priceFixed,
      totalPrice: priceFixed,
      unitPrice: g > 0 ? priceFixed / g : 0,
      tierFound,
    };
  }

  const unitPrice = resolveTierPrice(list, g, Number(pkg.price_per_person ?? 0) || 0);
  return { isFixed: false, priceFixed: 0, unitPrice, totalPrice: unitPrice * g, tierFound };
}

/** Snapshot salvo em quotes.extras.packages (compatível com o formato antigo). */
export type PackageSnapshot = {
  package_id: string;
  name: string;
  pricing_type: PricingType;
  price_per_person: number;
  price_fixed: number;
};

/** Total de uma lista de pacotes já resolvidos (snapshot) para N convidados. */
export function packagesTotal(packages: Partial<PackageSnapshot>[] = [], guests = 0): number {
  const g = Number(guests) || 0;
  return round2(
    (packages ?? []).reduce((sum, p) => {
      if (String(p?.pricing_type ?? "per_person") === "fixed") return sum + (Number(p?.price_fixed) || 0);
      return sum + (Number(p?.price_per_person) || 0) * g;
    }, 0),
  );
}

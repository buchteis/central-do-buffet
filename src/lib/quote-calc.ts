/**
 * Cálculo do orçamento.
 *
 * Regras:
 * - Adultos: valor por pessoa do pacote.
 * - Crianças: quantidade x valor por criança (definido manualmente).
 * - Acréscimos: itens manuais (descrição + valor) somados ao total.
 */
export type QuoteExtraItem = {
  description: string;
  value: number;
};

export type QuoteInputs = {
  pricePerPerson: number;
  adults: number;
  childrenCount: number;
  childPrice: number;
  customExtras?: QuoteExtraItem[];
};

export type QuoteBreakdown = {
  adultsSubtotal: number;
  childrenSubtotal: number;
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
  const extras = (input.customExtras ?? []).reduce(
    (sum, e) => sum + (Number(e.value) || 0),
    0,
  );
  const subtotal = adultsSubtotal + childrenSubtotal;
  const total = round2(subtotal + extras);
  const entry = round2(total * 0.5);
  const balance = round2(total - entry);
  return {
    adultsSubtotal: round2(adultsSubtotal),
    childrenSubtotal: round2(childrenSubtotal),
    extras: round2(extras),
    subtotal: round2(subtotal),
    total,
    entry,
    balance,
  };
}

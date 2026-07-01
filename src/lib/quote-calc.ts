/**
 * Cálculo do orçamento (versão MVP).
 *
 * Regras:
 * - Adultos: 100% do valor por pessoa.
 * - Crianças 7-10 anos: 50%.
 * - Crianças 0-6 anos: gratuito.
 * - Feijão tropeiro / farofa rica: adicional fixo por pessoa cobrada.
 */
export type QuoteExtras = {
  feijaoTropeiro?: boolean;
  farofaRica?: boolean;
};

export type QuoteInputs = {
  pricePerPerson: number;
  adults: number;
  children7to10: number;
  children0to6: number;
  extras?: QuoteExtras;
};

export type QuoteBreakdown = {
  chargeableEquivalent: number; // "pessoas equivalentes" cobradas
  subtotal: number;
  extras: number;
  total: number;
  entry: number;
  balance: number;
};

const EXTRA_FEIJAO = 6; // R$ por pessoa cobrada
const EXTRA_FAROFA = 4; // R$ por pessoa cobrada

export function calcQuote(input: QuoteInputs): QuoteBreakdown {
  const equivalent = input.adults + input.children7to10 * 0.5;
  const subtotal = equivalent * (input.pricePerPerson || 0);
  let extras = 0;
  if (input.extras?.feijaoTropeiro) extras += equivalent * EXTRA_FEIJAO;
  if (input.extras?.farofaRica) extras += equivalent * EXTRA_FAROFA;
  const total = Math.round((subtotal + extras) * 100) / 100;
  const entry = Math.round(total * 50) / 100;
  const balance = Math.round((total - entry) * 100) / 100;
  return {
    chargeableEquivalent: equivalent,
    subtotal,
    extras,
    total,
    entry,
    balance,
  };
}

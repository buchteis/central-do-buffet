import { describe, expect, it } from "vitest";
import { relevantPackagePricing } from "./whatsapp-agent.server";

describe("relevantPackagePricing", () => {
  const packageByPerson = {
    cobranca: "por pessoa",
    preco_base: 120,
    faixas_de_preco: [
      { min_guests: 1, max_guests: 50, price_per_guest: 100, price_fixed: null },
      { min_guests: 60, max_guests: 100, price_per_guest: 90, price_fixed: null },
    ],
  };

  it("calculates a total using the matching guest range", () => {
    expect(relevantPackagePricing(packageByPerson, 45)).toMatchObject({
      convidados_considerados: 45,
      faixa_encontrada: true,
      preco_por_pessoa_aplicavel: 100,
      estimativa_total: 4500,
      faixas_relevantes: [packageByPerson.faixas_de_preco[0]],
    });
  });

  it("uses the base per-person price when the package has no configured ranges", () => {
    expect(
      relevantPackagePricing(
        { cobranca: "por pessoa", preco_base: 125, faixas_de_preco: [] },
        20,
      ),
    ).toMatchObject({
      faixa_encontrada: true,
      preco_por_pessoa_aplicavel: 125,
      estimativa_total: 2500,
    });
  });

  it("returns equally close ranges without inventing a price between tiers", () => {
    expect(relevantPackagePricing(packageByPerson, 55)).toMatchObject({
      convidados_considerados: 55,
      faixa_encontrada: false,
      preco_por_pessoa_aplicavel: null,
      estimativa_total: null,
      faixas_relevantes: packageByPerson.faixas_de_preco,
    });
  });

  it("returns the fixed total and guest capacity from the matching tier", () => {
    expect(
      relevantPackagePricing(
        {
          cobranca: "preço fechado",
          preco_base: null,
          faixas_de_preco: [
            { min_guests: 20, max_guests: 50, price_per_guest: null, price_fixed: 8000 },
          ],
        },
        40,
      ),
    ).toMatchObject({
      convidados_considerados: 40,
      faixa_encontrada: true,
      estimativa_total: 8000,
      faixas_relevantes: [{ min_guests: 20, max_guests: 50, price_fixed: 8000 }],
    });
  });
});

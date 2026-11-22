import { describe, expect, it } from "vitest";
import { buildContractSchedule } from "./contract-installments";

describe("cronograma do contrato", () => {
  it("entrada + saldo em 3 parcelas soma exatamente o total", () => {
    const s = buildContractSchedule(1000, 400, 3, "2026-12-01", "2027-01-10");
    expect(s.map((i) => i.amount)).toEqual([400, 200, 200, 200]);
    expect(s.map((i) => i.due_date)).toEqual(["2026-12-01", "2027-01-10", "2027-02-10", "2027-03-10"]);
  });
  it("centavos restantes vão para a última parcela", () => {
    const s = buildContractSchedule(100, 0, 3, "2026-12-01", "2026-12-01");
    expect(s.map((i) => i.amount)).toEqual([33.33, 33.33, 33.34]);
  });
  it("vencimento no dia 31 cai no último dia do mês", () => {
    expect(buildContractSchedule(200, 0, 2, "x", "2027-01-31")[1]?.due_date).toBe("2027-02-28");
  });
});

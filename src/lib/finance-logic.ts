/**
 * Regras financeiras únicas — usadas pela Dashboard e pelo Financeiro
 * para que os dois sempre mostrem exatamente os mesmos valores.
 *
 * Fonte da verdade: EVENTOS (+ transações manuais).
 * - Receita recebida: eventos "pago"/"concluido" + transações de entrada pagas
 * - A receber: eventos "agendado"/"em_andamento" + transações de entrada pendentes
 * - Despesas pagas: transações de saída pagas
 * - Saldo atual: recebido + a receber - despesas pagas
 * - Cancelados são sempre ignorados.
 */
export const RECEIVED_EVENT_STATUSES: string[] = ["pago", "concluido"];
export const RECEIVABLE_EVENT_STATUSES: string[] = ["agendado", "em_andamento"];
export const FINANCE_EVENT_STATUSES: string[] = [...RECEIVED_EVENT_STATUSES, ...RECEIVABLE_EVENT_STATUSES];

export type FinanceTotals = {
  recebido: number;
  receber: number;
  saidas: number;
  saidasPagas: number;
  saldo: number;
};

export const emptyFinanceTotals = (): FinanceTotals => ({
  recebido: 0,
  receber: 0,
  saidas: 0,
  saidasPagas: 0,
  saldo: 0,
});

export const financeBalance = (t: Omit<FinanceTotals, "saldo">) => t.recebido + t.receber - t.saidasPagas;

type EventLike = { status?: string | null; total_value?: number | string | null };
type TxLike = { type?: string | null; status?: string | null; amount?: number | string | null };

/** Calcula os totais financeiros a partir de eventos + transações (mesma regra nas duas telas). */
export function computeFinanceTotals(events: EventLike[] = [], transactions: TxLike[] = []): FinanceTotals {
  const totals = emptyFinanceTotals();

  for (const e of events) {
    const st = String(e?.status ?? "").toLowerCase();
    const amount = Number(e?.total_value ?? 0) || 0;
    if (RECEIVED_EVENT_STATUSES.includes(st)) totals.recebido += amount;
    else if (RECEIVABLE_EVENT_STATUSES.includes(st)) totals.receber += amount;
  }

  for (const t of transactions) {
    const st = String(t?.status ?? "pendente").toLowerCase();
    if (st === "cancelado") continue;
    const amount = Number(t?.amount ?? 0) || 0;
    if (t?.type === "entrada") {
      if (st === "pago") totals.recebido += amount;
      else totals.receber += amount;
    } else {
      totals.saidas += amount;
      if (st === "pago") totals.saidasPagas += amount;
    }
  }

  totals.saldo = financeBalance(totals);
  return totals;
}

/**
 * Regras financeiras únicas — usadas pela Dashboard e pelo Financeiro
 * para que os dois sempre mostrem exatamente os mesmos valores.
 *
 * Fonte da verdade: EVENTOS (+ transações manuais e parcelas).
 * - Quando um evento tem parcelas, elas substituem o valor integral do evento nos totais.
 * - Receita recebida: eventos "pago"/"concluido", parcelas e transações pagas
 * - A receber: eventos "agendado"/"em_andamento", parcelas e transações pendentes
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

type EventLike = { id?: string | null; status?: string | null; total_value?: number | string | null };
type TxLike = { type?: string | null; status?: string | null; amount?: number | string | null };
type InstallmentLike = {
  event_id?: string | null;
  status?: string | null;
  amount?: number | string | null;
};

/** Calcula totais sem somar o valor do evento novamente quando há parcelas vinculadas. */
export function computeFinanceTotals(
  events: EventLike[] = [],
  transactions: TxLike[] = [],
  installments: InstallmentLike[] = [],
): FinanceTotals {
  const totals = emptyFinanceTotals();
  const installmentsByEvent = new Map<string, InstallmentLike[]>();

  for (const installment of installments) {
    if (String(installment?.status ?? "").toLowerCase() === "cancelado") continue;
    const eventId = installment?.event_id ?? null;
    if (eventId) {
      const eventInstallments = installmentsByEvent.get(eventId) ?? [];
      eventInstallments.push(installment);
      installmentsByEvent.set(eventId, eventInstallments);
    } else {
      addInstallmentToTotals(totals, installment);
    }
  }

  for (const e of events) {
    const st = String(e?.status ?? "").toLowerCase();
    const eventInstallments = e?.id ? installmentsByEvent.get(e.id) : null;
    if (eventInstallments) {
      let scheduledAmount = 0;
      for (const installment of eventInstallments) {
        scheduledAmount += Number(installment?.amount ?? 0) || 0;
        addInstallmentToTotals(totals, installment);
      }
      const remainder = Math.max((Number(e?.total_value ?? 0) || 0) - scheduledAmount, 0);
      if (RECEIVED_EVENT_STATUSES.includes(st)) totals.recebido += remainder;
      else if (RECEIVABLE_EVENT_STATUSES.includes(st)) totals.receber += remainder;
      continue;
    }
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

function addInstallmentToTotals(totals: FinanceTotals, installment: InstallmentLike) {
  const amount = Number(installment?.amount ?? 0) || 0;
  if (String(installment?.status ?? "pendente").toLowerCase() === "pago") totals.recebido += amount;
  else totals.receber += amount;
}

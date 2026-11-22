import { brl, formatDateBR } from "@/lib/format";

export type ScheduleItem = { number: number; total: number; label: string; amount: number; due_date: string };

function addMonths(iso: string, m: number) {
  const [y, mo, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, mo - 1 + m, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return dt.toISOString().slice(0, 10);
}

/** Entrada (se > 0) + saldo dividido em N parcelas mensais; soma sempre igual ao total. */
export function buildContractSchedule(total: number, entry: number, parcels: number, entryDate: string, firstDue: string): ScheduleItem[] {
  const t = Math.round(total * 100);
  const e = Math.min(Math.max(Math.round(entry * 100), 0), t);
  const n = Math.max(1, Math.min(24, Math.floor(parcels) || 1));
  const rest = t - e;
  const items: Omit<ScheduleItem, "number" | "total">[] = [];
  if (e > 0) items.push({ label: "Entrada", amount: e / 100, due_date: entryDate });
  if (rest > 0) {
    const base = Math.floor(rest / n);
    for (let i = 0; i < n; i++) {
      const cents = i === n - 1 ? rest - base * (n - 1) : base;
      items.push({ label: `Parcela ${i + 1} de ${n}`, amount: cents / 100, due_date: addMonths(firstDue, i) });
    }
  }
  return items.map((it, i) => ({ ...it, number: i + 1, total: items.length }));
}

export function scheduleText(items: ScheduleItem[]) {
  if (!items.length) return "Pagamento à vista";
  return items.map((i) => `${i.label}: ${brl(i.amount)} — vencimento ${formatDateBR(i.due_date)}`).join("\n");
}

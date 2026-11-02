/**
 * Regra dos avisos do Dashboard: um aviso só aparece quando há MAIS itens
 * do que na última vez em que o usuário o viu (ou seja, só itens novos).
 */
export type DashAlertCount = { key: string; count: number };

export function unseenDashboardAlerts<T extends DashAlertCount>(
  alerts: T[],
  seen: Record<string, number>,
): T[] {
  return alerts.filter((a) => a.count > 0 && a.count > (seen[a.key] ?? 0));
}

/** Grava a contagem atual de cada tipo (inclusive zero, para que um item novo volte a avisar). */
export function markDashboardSeen(
  counts: DashAlertCount[],
  seen: Record<string, number>,
): Record<string, number> {
  const next = { ...seen };
  for (const c of counts) next[c.key] = c.count;
  return next;
}

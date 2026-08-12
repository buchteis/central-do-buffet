/**
 * Pipeline (Kanban) de Orçamentos — regra ÚNICA de colunas/status.
 *
 * As colunas usam status que já existem no enum `quote_status` do banco,
 * então mover cards não exige migração e não afeta Contratos/Eventos.
 */
export type StageId = "novo" | "contato" | "degustacao" | "proposta" | "fechado" | "perdido";

export type StageDef = {
  id: StageId;
  /** Status gravado no banco ao mover o card para esta coluna. */
  status: string;
  /** Todos os status legados que caem nesta coluna. */
  match: string[];
  label: string;
  short: string;
  tone: string;
  dot: string;
};

export const PIPELINE: StageDef[] = [
  {
    id: "novo",
    status: "novo",
    match: ["novo"],
    label: "Novo / Recebido",
    short: "Novo",
    tone: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    dot: "bg-slate-400",
  },
  {
    id: "contato",
    status: "em_analise",
    match: ["em_analise", "em_andamento", "primeiro_contato", "negociacao", "aguardando"],
    label: "Em Análise / Contato",
    short: "Contato",
    tone: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    dot: "bg-blue-500",
  },
  {
    id: "degustacao",
    status: "visitado",
    match: ["visitado"],
    label: "Degustação Agendada",
    short: "Degustação",
    tone: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    dot: "bg-violet-500",
  },
  {
    id: "proposta",
    status: "enviado",
    match: ["enviado"],
    label: "Proposta / Minuta Enviada",
    short: "Proposta",
    tone: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    dot: "bg-amber-500",
  },
  {
    id: "fechado",
    status: "fechado",
    match: ["fechado", "aprovado"],
    label: "Fechado / Aprovado",
    short: "Fechado",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  {
    id: "perdido",
    status: "cancelado",
    match: ["cancelado", "recusado"],
    label: "Perdido / Cancelado",
    short: "Perdido",
    tone: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    dot: "bg-rose-500",
  },
];

export function stageOfStatus(status: string | null | undefined): StageId {
  const s = String(status ?? "novo");
  const found = PIPELINE.find((c) => c.match.includes(s));
  return found?.id ?? "contato";
}

export function stageDef(id: StageId): StageDef {
  return PIPELINE.find((c) => c.id === id) ?? PIPELINE[0];
}

/** Status de orçamentos "abertos" (em negociação) — usados em contadores. */
export const OPEN_QUOTE_STATUSES: string[] = [
  ...PIPELINE.filter((c) => c.id !== "fechado" && c.id !== "perdido").flatMap((c) => c.match),
];

/** Status que representam orçamento perdido/cancelado (nunca somam valores). */
export const LOST_QUOTE_STATUSES: string[] = stageDef("perdido").match;

export function isOpenQuote(status: string | null | undefined) {
  return OPEN_QUOTE_STATUSES.includes(String(status ?? ""));
}

/* ------------------------------ dados do card ----------------------------- */

export type QuoteAny = Record<string, any>;

export function requesterOf(q: QuoteAny) {
  return ((q?.extras as any)?.requester ?? {}) as Record<string, any>;
}

export function quoteClientName(q: QuoteAny): string {
  return q?.clients?.name ?? requesterOf(q).name ?? "Sem nome";
}

export function quotePhone(q: QuoteAny): string | null {
  const r = requesterOf(q);
  return q?.clients?.whatsapp ?? q?.clients?.phone ?? r.whatsapp ?? r.phone ?? null;
}

export function quotePackagesLabel(q: QuoteAny): string {
  const snap = (q?.extras as any)?.packages;
  if (Array.isArray(snap) && snap.length > 0) {
    return snap.map((p: any) => p?.name).filter(Boolean).join(" + ") || "pacote escolhido";
  }
  return q?.packages?.name ?? "pacote escolhido";
}

export function quoteUnitItems(q: QuoteAny) {
  const snap = (q?.extras as any)?.unit_items;
  if (!Array.isArray(snap)) return [];
  return snap
    .map((i: any) => ({
      name: i?.name ?? "Item",
      unit: i?.unit ?? "un",
      unit_price: Number(i?.unit_price ?? 0) || 0,
      qty: Number(i?.qty ?? 0) || 0,
    }))
    .filter((i) => i.qty > 0);
}

export function quoteGuests(q: QuoteAny): number {
  return Number(q?.adults ?? 0) + Number(q?.children_7_10 ?? 0) + Number(q?.children_0_6 ?? 0);
}

/** Origem do orçamento: link público, WhatsApp ou manual. */
export function quoteOrigin(q: QuoteAny): { label: string; tone: string } {
  const r = requesterOf(q);
  const src = String(r.source ?? (q as any).source ?? "").toLowerCase();
  if (src.includes("whats")) return { label: "WhatsApp", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
  if (Object.keys(r).length > 0 || src.includes("link") || src.includes("public") || src.includes("form"))
    return { label: "Link Público", tone: "bg-primary/10 text-primary border-primary/20" };
  return { label: "Manual", tone: "bg-muted text-muted-foreground border-border" };
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr + "T00:00:00") : new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export type QuoteAlert = { label: string; tone: string };

/** Avisos destacados no card (degustação, pendências, restrições). */
export function quoteAlerts(q: QuoteAny): QuoteAlert[] {
  const alerts: QuoteAlert[] = [];
  const stage = stageOfStatus(q?.status);
  const d = daysUntil(q?.event_date);

  if (stage === "degustacao")
    alerts.push({ label: "Lembrete de degustação", tone: "bg-violet-500/15 text-violet-700 border-violet-500/30" });

  if (stage === "proposta")
    alerts.push({ label: "Contrato pendente", tone: "bg-amber-500/15 text-amber-800 border-amber-500/30" });

  if (stage === "fechado" && !q?.paid)
    alerts.push({ label: "Pagamento pendente", tone: "bg-rose-500/15 text-rose-700 border-rose-500/30" });

  if (d !== null && d >= 0 && d <= 7 && stage !== "perdido")
    alerts.push({
      label: d === 0 ? "Evento é hoje" : `Evento em ${d} dia(s)`,
      tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    });

  const notes = String(q?.notes ?? "");
  if (/alergi|intoler|restri|vegan|vegetarian|gluten|glúten|lactose|kosher|halal/i.test(notes))
    alerts.push({ label: "Restrição alimentar", tone: "bg-orange-500/15 text-orange-700 border-orange-500/30" });

  return alerts;
}

/** Cor de destaque da data conforme proximidade. */
export function eventDateTone(dateStr: string | null | undefined): string {
  const d = daysUntil(dateStr);
  if (d === null) return "text-muted-foreground";
  if (d < 0) return "text-muted-foreground line-through";
  if (d <= 7) return "text-rose-600 font-bold";
  if (d <= 30) return "text-amber-600 font-semibold";
  return "text-muted-foreground";
}

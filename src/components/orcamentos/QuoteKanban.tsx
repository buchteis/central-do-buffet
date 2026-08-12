import { useState } from "react";
import { cn } from "@/lib/utils";
import { brl, formatDateBR } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PIPELINE,
  eventDateTone,
  quoteAlerts,
  quoteClientName,
  quoteGuests,
  quoteOrigin,
  quotePackagesLabel,
  stageOfStatus,
  type QuoteAny,
  type StageId,
} from "@/lib/quote-pipeline";
import { Users, CalendarDays } from "lucide-react";

type Props = {
  quotes: QuoteAny[];
  onOpen: (q: QuoteAny) => void;
  onMove: (q: QuoteAny, stage: StageId) => void;
};

function QuoteCard({
  q,
  onOpen,
  onDragStart,
  dragging,
}: {
  q: QuoteAny;
  onOpen: (q: QuoteAny) => void;
  onDragStart: () => void;
  dragging: boolean;
}) {
  const origin = quoteOrigin(q);
  const alerts = quoteAlerts(q);
  const guests = quoteGuests(q);
  const time = (q.event_time ?? "").toString().slice(0, 5);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onOpen(q)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(q)}
      className={cn(
        "cursor-pointer select-none bg-card border border-border rounded-xl p-3 shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40 active:cursor-grabbing",
        dragging && "opacity-40 rotate-1 shadow-xl",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{quoteClientName(q)}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {q.event_type || quotePackagesLabel(q)}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
            origin.tone,
          )}
        >
          {origin.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className={cn("inline-flex items-center gap-1", eventDateTone(q.event_date))}>
          <CalendarDays className="size-3 shrink-0" />
          {formatDateBR(q.event_date)}
          {time && ` · ${time}`}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Users className="size-3 shrink-0" />
          {guests} conv.
        </span>
      </div>

      <div className="mt-2 font-mono font-bold text-sm">{brl(q.total_value)}</div>

      {alerts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {alerts.map((a, i) => (
            <span key={i} className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", a.tone)}>
              {a.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuoteKanban({ quotes, onOpen, onMove }: Props) {
  const isMobile = useIsMobile();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<StageId | null>(null);
  const [tab, setTab] = useState<StageId>("novo");

  const byStage = new Map<StageId, QuoteAny[]>();
  PIPELINE.forEach((c) => byStage.set(c.id, []));
  quotes.forEach((q) => byStage.get(stageOfStatus(q.status))!.push(q));

  const drop = (stage: StageId) => {
    const q = quotes.find((x) => x.id === dragId);
    setDragId(null);
    setOverStage(null);
    if (q && stageOfStatus(q.status) !== stage) onMove(q, stage);
  };

  if (isMobile) {
    const items = byStage.get(tab) ?? [];
    const total = items.reduce((s, q) => s + Number(q.total_value ?? 0), 0);
    return (
      <div className="space-y-3">
        <div className="-mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-1">
            {PIPELINE.map((c) => (
              <button
                key={c.id}
                onClick={() => setTab(c.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition",
                  tab === c.id ? c.tone : "bg-muted/40 text-muted-foreground border-border",
                )}
              >
                <span className={cn("size-2 rounded-full", c.dot)} />
                {c.short}
                <span className="opacity-70">{(byStage.get(c.id) ?? []).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>{items.length} orçamento(s)</span>
          <span className="font-mono">{brl(total)}</span>
        </div>
        <div className="space-y-2">
          {items.map((q) => (
            <div key={q.id} className="space-y-1">
              <QuoteCard q={q} onOpen={onOpen} onDragStart={() => setDragId(q.id)} dragging={false} />
              <select
                value={stageOfStatus(q.status)}
                onChange={(e) => onMove(q, e.target.value as StageId)}
                className="w-full text-[11px] border border-border rounded-lg bg-background px-2 py-2"
              >
                {PIPELINE.map((c) => (
                  <option key={c.id} value={c.id}>
                    Mover para: {c.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8">Nenhum orçamento nesta etapa.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4 scroll-smooth">
      <div className="flex gap-3 min-w-max">
        {PIPELINE.map((c) => {
          const items = byStage.get(c.id) ?? [];
          const total = items.reduce((s, q) => s + Number(q.total_value ?? 0), 0);
          return (
            <div
              key={c.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(c.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === c.id ? null : s))}
              onDrop={() => drop(c.id)}
              className={cn(
                "w-80 shrink-0 bg-muted/30 rounded-2xl border flex flex-col max-h-[75vh] transition-colors",
                overStage === c.id ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div className="p-3 border-b border-border">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border",
                    c.tone,
                  )}
                >
                  <span className={cn("size-2 rounded-full", c.dot)} />
                  {c.label}
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{items.length} orçamento(s)</span>
                  <span className="font-mono">{brl(total)}</span>
                </div>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {items.map((q) => (
                  <QuoteCard
                    key={q.id}
                    q={q}
                    onOpen={onOpen}
                    onDragStart={() => setDragId(q.id)}
                    dragging={dragId === q.id}
                  />
                ))}
                {items.length === 0 && (
                  <div className="text-[11px] text-muted-foreground text-center py-6">
                    Arraste cards para cá
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

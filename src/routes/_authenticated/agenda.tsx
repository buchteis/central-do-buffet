import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Meu Churras" }] }),
  component: AgendaPage,
});

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function AgendaPage() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const monthEnd = new Date(cursor.year, cursor.month + 1, 1);

  const { data: events } = useQuery({
    queryKey: ["agenda", cursor.year, cursor.month],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, event_date, event_time, status, clients(name)")
        .gte("event_date", monthStart.toISOString().slice(0, 10))
        .lt("event_date", monthEnd.toISOString().slice(0, 10));
      return data ?? [];
    },
  });

  const byDay = new Map<string, any[]>();
  for (const e of events ?? []) {
    const list = byDay.get(e.event_date) ?? [];
    list.push(e);
    byDay.set(e.event_date, list);
  }

  const firstWeekday = monthStart.getDay(); // 0 = Sun
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === cursor.year &&
    today.getMonth() === cursor.month &&
    today.getDate() === d;

  function move(delta: number) {
    setCursor((c) => {
      const nm = c.month + delta;
      const y = c.year + Math.floor(nm / 12);
      const m = ((nm % 12) + 12) % 12;
      return { year: y, month: m };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão mensal dos seus eventos</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-full px-1 py-1">
          <button
            onClick={() => move(-1)}
            className="size-8 rounded-full hover:bg-accent flex items-center justify-center"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-bold min-w-[160px] text-center">
            {monthNames[cursor.month]} {cursor.year}
          </span>
          <button
            onClick={() => move(1)}
            className="size-8 rounded-full hover:bg-accent flex items-center justify-center"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div
              key={d}
              className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(90px,1fr)]">
          {cells.map((d, i) => {
            const dateKey =
              d != null
                ? `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                : null;
            const dayEvents = dateKey ? byDay.get(dateKey) ?? [] : [];
            return (
              <div
                key={i}
                className={cn(
                  "border-r border-b border-border p-2 min-h-[90px] text-xs",
                  (i + 1) % 7 === 0 && "border-r-0",
                  d == null && "bg-muted/20",
                )}
              >
                {d != null && (
                  <>
                    <div
                      className={cn(
                        "size-6 rounded-full flex items-center justify-center font-bold text-[11px]",
                        isToday(d) && "bg-primary text-primary-foreground",
                      )}
                    >
                      {d}
                    </div>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className="truncate px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold"
                          title={e.clients?.name ?? ""}
                        >
                          {e.event_time?.slice(0, 5) ?? ""} {e.clients?.name ?? "Evento"}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{dayEvents.length - 3}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

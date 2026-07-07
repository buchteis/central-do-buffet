import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X, MessageCircle, FileText, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { brl, formatDateFullBR } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Meu Churras" }] }),
  component: AgendaPage,
});

const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const statusColor: Record<string, string> = {
  agendado: "bg-blue-500 text-white",
  pagamento_parcial: "bg-amber-500 text-white",
  pago: "bg-emerald-500 text-white",
  em_andamento: "bg-primary text-primary-foreground",
  concluido: "bg-slate-400 text-white",
  cancelado: "bg-rose-500 text-white",
};

type ViewMode = "mes" | "semana" | "dia";

function AgendaPage() {
  const [view, setView] = useState<ViewMode>("mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const range = getRange(view, cursor);

  const { data: events } = useQuery({
    queryKey: ["agenda", view, range.start, range.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, event_date, event_time, status, total_value, event_address, guest_count, notes, clients(name, phone, whatsapp), packages(name)")
        .gte("event_date", range.start)
        .lt("event_date", range.end)
        .order("event_date");
      return data ?? [];
    },
  });

  const { data: selectedEvent } = useQuery({
    queryKey: ["event-detail", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, clients(name, phone, whatsapp, address), packages(name), event_staff(id, role, amount, employees(name))")
        .eq("id", selected!)
        .maybeSingle();
      return data;
    },
  });

  function shift(delta: number) {
    const d = new Date(cursor);
    if (view === "mes") d.setMonth(d.getMonth() + delta);
    else if (view === "semana") d.setDate(d.getDate() + 7 * delta);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatDateFullBR(cursor)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-full p-1">
            {(["dia","semana","mes"] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("px-3 py-1 text-xs font-bold rounded-full capitalize", view === v && "bg-background shadow")}>
                {v === "mes" ? "Mês" : v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-card border border-border rounded-full px-1 py-1">
            <button onClick={() => shift(-1)} className="size-8 rounded-full hover:bg-accent flex items-center justify-center"><ChevronLeft className="size-4" /></button>
            <button onClick={() => setCursor(new Date())} className="text-xs font-bold px-3">Hoje</button>
            <button onClick={() => shift(1)} className="size-8 rounded-full hover:bg-accent flex items-center justify-center"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px]">
        {Object.entries({ agendado: "Agendado", pagamento_parcial: "Parcial", pago: "Pago", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" }).map(([k, l]) => (
          <div key={k} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", statusColor[k])} />{l}</div>
        ))}
      </div>

      {view === "mes" && <MonthView cursor={cursor} events={events ?? []} onSelect={setSelected} />}
      {view === "semana" && <WeekView cursor={cursor} events={events ?? []} onSelect={setSelected} />}
      {view === "dia" && <DayView cursor={cursor} events={events ?? []} onSelect={setSelected} />}

      {selected && (
        <EventPanel event={selectedEvent} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function getRange(view: ViewMode, cursor: Date) {
  if (view === "mes") {
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return { start: iso(s), end: iso(e) };
  }
  if (view === "semana") {
    const s = new Date(cursor);
    s.setDate(cursor.getDate() - cursor.getDay());
    const e = new Date(s);
    e.setDate(s.getDate() + 7);
    return { start: iso(s), end: iso(e) };
  }
  const s = new Date(cursor);
  const e = new Date(cursor);
  e.setDate(s.getDate() + 1);
  return { start: iso(s), end: iso(e) };
}

function iso(d: Date) { return d.toISOString().slice(0, 10); }

function MonthView({ cursor, events, onSelect }: { cursor: Date; events: any[]; onSelect: (id: string) => void }) {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<string, any[]>();
  events.forEach((e) => {
    const list = byDay.get(e.event_date) ?? [];
    list.push(e);
    byDay.set(e.event_date, list);
  });

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
          <div key={d} className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(110px,1fr)]">
        {cells.map((d, i) => {
          const key = d ? `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
          const dayEvents = key ? byDay.get(key) ?? [] : [];
          return (
            <div key={i} className={cn("border-r border-b border-border p-2 min-h-[110px]", (i + 1) % 7 === 0 && "border-r-0", d == null && "bg-muted/20")}>
              {d != null && (
                <>
                  <div className={cn("size-6 rounded-full flex items-center justify-center font-bold text-[11px]", isToday(d) && "bg-primary text-primary-foreground")}>{d}</div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <button key={e.id} onClick={() => onSelect(e.id)} className={cn("w-full text-left truncate px-1.5 py-0.5 rounded text-[10px] font-semibold", statusColor[e.status])}>
                        {e.event_time?.slice(0, 5) ?? ""} {e.clients?.name ?? "Evento"}
                      </button>
                    ))}
                    {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, events, onSelect }: { cursor: Date; events: any[]; onSelect: (id: string) => void }) {
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - cursor.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const byDay = new Map<string, any[]>();
  events.forEach((e) => {
    const list = byDay.get(e.event_date) ?? [];
    list.push(e);
    byDay.set(e.event_date, list);
  });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = iso(d);
          const ev = byDay.get(key) ?? [];
          const isToday = iso(new Date()) === key;
          return (
            <div key={key} className="border-r border-border last:border-r-0 min-h-[400px] p-2">
              <div className={cn("text-center py-2 border-b border-border mb-2", isToday && "text-primary font-bold")}>
                <div className="text-[10px] uppercase text-muted-foreground">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()]}</div>
                <div className="text-lg font-extrabold">{d.getDate()}</div>
              </div>
              <div className="space-y-1">
                {ev.map((e) => (
                  <button key={e.id} onClick={() => onSelect(e.id)} className={cn("w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold", statusColor[e.status])}>
                    <div>{e.event_time?.slice(0, 5) ?? "—"}</div>
                    <div className="truncate">{e.clients?.name ?? "Evento"}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ cursor, events, onSelect }: { cursor: Date; events: any[]; onSelect: (id: string) => void }) {
  const key = iso(cursor);
  const dayEvents = events.filter((e) => e.event_date === key).sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6h — 23h

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {dayEvents.length === 0 ? (
        <div className="p-16 text-center text-sm text-muted-foreground">Nenhum evento nesta data.</div>
      ) : (
        <div className="divide-y divide-border">
          {hours.map((h) => {
            const slot = dayEvents.filter((e) => Number((e.event_time ?? "00").slice(0, 2)) === h);
            return (
              <div key={h} className="grid grid-cols-[80px_1fr] min-h-[64px]">
                <div className="p-3 text-xs font-mono text-muted-foreground border-r border-border">{String(h).padStart(2, "0")}:00</div>
                <div className="p-2 space-y-1">
                  {slot.map((e) => (
                    <button key={e.id} onClick={() => onSelect(e.id)} className={cn("w-full text-left px-3 py-2 rounded-lg", statusColor[e.status])}>
                      <div className="text-xs font-bold">{e.event_time?.slice(0, 5)} · {e.clients?.name}</div>
                      <div className="text-[11px] opacity-80">{e.guest_count ?? 0} pessoas · {brl(e.total_value)}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventPanel({ event, onClose }: { event: any; onClose: () => void }) {
  if (!event) return (
    <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm flex items-center justify-center">
      <div className="text-sm">Carregando…</div>
    </div>
  );
  const c = event.clients;
  const phone = c?.whatsapp || c?.phone;
  return (
    <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border overflow-y-auto p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className={cn("inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full mb-2", statusColor[event.status])}>{event.status}</div>
            <h2 className="text-xl font-extrabold">{c?.name ?? "Evento"}</h2>
            <p className="text-xs text-muted-foreground">{formatDateFullBR(event.event_date)} · {event.event_time?.slice(0, 5) ?? "—"}</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-full hover:bg-accent flex items-center justify-center"><X className="size-4" /></button>
        </div>

        <div className="space-y-4 text-sm">
          <Info label="Local" value={event.event_address || c?.address || "—"} />
          <Info label="Convidados" value={String(event.guest_count ?? 0)} />
          <Info label="Pacote" value={event.packages?.name ?? "—"} />
          <Info label="Valor total" value={brl(event.total_value)} />
          <Info label="Telefone" value={c?.phone || "—"} />
          <Info label="WhatsApp" value={c?.whatsapp || "—"} />
          {event.notes && <Info label="Observações" value={event.notes} />}

          <div>
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">Equipe escalada</div>
            {(event.event_staff ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground">Sem escala definida.</div>
            ) : (
              <ul className="space-y-1">
                {event.event_staff.map((s: any) => (
                  <li key={s.id} className="flex justify-between text-xs bg-muted/40 rounded px-2 py-1.5">
                    <span className="font-semibold">{s.employees?.name}</span>
                    <span className="text-muted-foreground">{s.role} · {brl(s.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {phone && (
            <a href={waLink(phone, `Olá ${c?.name}! Sobre seu evento em ${formatDateFullBR(event.event_date)}...`)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 h-10 rounded-lg bg-emerald-500 text-white text-xs font-bold">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
          <a href={`/contratos?event=${event.id}`} className="flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <FileText className="size-4" /> Contrato
          </a>
          <a href={`/financeiro?event=${event.id}`} className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border text-xs font-bold col-span-2">
            <DollarSign className="size-4" /> Registrar pagamento
          </a>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

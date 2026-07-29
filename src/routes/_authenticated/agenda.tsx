import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  Filter,
  MessageCircle,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { brl, formatDateFullBR } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Central do Buffet" }] }),
  component: AgendaPage,
});

const statusColor: Record<string, string> = {
  agendado: "bg-blue-500 text-white",
  em_andamento: "bg-primary text-primary-foreground",
  pago: "bg-emerald-500 text-white",
  concluido: "bg-slate-400 text-white",
  cancelado: "bg-rose-500 text-white",
  realizado: "bg-slate-600 text-white",
};

const statusOptions = [
  { key: "agendado", label: "Agendado" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "pago", label: "Pago" },
  { key: "concluido", label: "Concluído" },
  { key: "cancelado", label: "Cancelado" },
];

type ViewMode = "mes" | "semana" | "dia";
type Filters = { statuses: string[]; packageId: string; query: string };

function AgendaPage() {
  const [view, setView] = useState<ViewMode>("mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ statuses: [], packageId: "", query: "" });
  const qc = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    };
    const channel = supabase
      .channel("agenda-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_staff" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const range = getRange(view, cursor);

  const { data: packages } = useQuery({
    queryKey: ["packages-list"],
    queryFn: async () => {
      const { data } = await supabase.from("packages").select("id, name").order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: events } = useQuery({
    queryKey: ["agenda", view, range.start, range.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(
          "id, event_date, event_time, status, total_value, event_address, guest_count, notes, package_id, clients(name, phone, whatsapp), packages(name)",
        )
        .gte("event_date", range.start)
        .lt("event_date", range.end)
        .neq("status", "realizado")
        .order("event_date");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return (events ?? []).filter((e: any) => {
      if (filters.statuses.length && !filters.statuses.includes(e.status)) return false;
      if (filters.packageId && e.package_id !== filters.packageId) return false;
      if (q && !(e.clients?.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, filters]);

  const moveEvent = useMutation({
    mutationFn: async ({
      id,
      date,
      time,
    }: {
      id: string;
      date: string;
      time?: string | null;
    }) => {
      const patch: any = { event_date: date };
      if (time !== undefined) patch.event_time = time;
      const { error } = await supabase.from("events").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Evento reagendado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: selectedEvent } = useQuery({
    queryKey: ["event-detail", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(
          "*, clients(name, phone, whatsapp, address), packages(name), event_staff(id, role, amount, employee_id, employees(name, role))",
        )
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

  const activeFilters =
    filters.statuses.length + (filters.packageId ? 1 : 0) + (filters.query ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatDateFullBR(cursor)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-full p-1">
            {(["dia", "semana", "mes"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full capitalize",
                  view === v && "bg-background shadow",
                )}
              >
                {v === "mes" ? "Mês" : v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-card border border-border rounded-full px-1 py-1">
            <button
              onClick={() => shift(-1)}
              className="size-8 rounded-full hover:bg-accent flex items-center justify-center"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => setCursor(new Date())} className="text-xs font-bold px-3">
              Hoje
            </button>
            <button
              onClick={() => shift(1)}
              className="size-8 rounded-full hover:bg-accent flex items-center justify-center"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        packages={packages ?? []}
        activeCount={activeFilters}
      />

      <div className="flex flex-wrap gap-3 text-[11px]">
        {statusOptions.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", statusColor[s.key])} />
            {s.label}
          </div>
        ))}
        <div className="ml-auto text-muted-foreground">
          Dica: arraste um evento para outra data ou horário.
        </div>
      </div>

      {view === "mes" && (
        <MonthView
          cursor={cursor}
          events={filtered}
          onSelect={setSelected}
          onDropEvent={(id, date) => moveEvent.mutate({ id, date })}
        />
      )}
      {view === "semana" && (
        <WeekView
          cursor={cursor}
          events={filtered}
          onSelect={setSelected}
          onDropEvent={(id, date) => moveEvent.mutate({ id, date })}
        />
      )}
      {view === "dia" && (
        <DayView
          cursor={cursor}
          events={filtered}
          onSelect={setSelected}
          onDropEvent={(id, date, time) => moveEvent.mutate({ id, date, time })}
        />
      )}

      {selected && <EventPanel event={selectedEvent} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
  packages,
  activeCount,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  packages: any[];
  activeCount: number;
}) {
  const toggleStatus = (s: string) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s];
    setFilters({ ...filters, statuses: next });
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex flex-wrap gap-2 items-center">
      <div className="flex items-center gap-2 pr-2 border-r border-border">
        <Filter className="size-4 text-muted-foreground" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Filtros {activeCount > 0 && `(${activeCount})`}
        </span>
      </div>
      <input
        value={filters.query}
        onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        placeholder="Buscar cliente…"
        className="bg-muted/50 rounded-full px-3 py-1.5 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <select
        value={filters.packageId}
        onChange={(e) => setFilters({ ...filters, packageId: e.target.value })}
        className="bg-muted/50 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Todos os pacotes</option>
        {packages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        {statusOptions.map((s) => {
          const active = filters.statuses.includes(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleStatus(s.key)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border transition",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {activeCount > 0 && (
        <button
          onClick={() => setFilters({ statuses: [], packageId: "", query: "" })}
          className="ml-auto text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <X className="size-3" /> Limpar
        </button>
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

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function useDrag() {
  const [dragId, setDragId] = useState<string | null>(null);
  return {
    dragId,
    onDragStart: (id: string) => (e: React.DragEvent) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    },
    onDragEnd: () => setDragId(null),
    allowDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
  };
}

function MonthView({
  cursor,
  events,
  onSelect,
  onDropEvent,
}: {
  cursor: Date;
  events: any[];
  onSelect: (id: string) => void;
  onDropEvent: (id: string, date: string) => void;
}) {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const drag = useDrag();

  const byDay = new Map<string, any[]>();
  events.forEach((e) => {
    const list = byDay.get(e.event_date) ?? [];
    list.push(e);
    byDay.set(e.event_date, list);
  });

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  const [over, setOver] = useState<string | null>(null);

  return (
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
      <div className="grid grid-cols-7 auto-rows-[minmax(110px,1fr)]">
        {cells.map((d, i) => {
          const key = d
            ? `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
            : null;
          const dayEvents = key ? byDay.get(key) ?? [] : [];
          const isOver = over === key;
          return (
            <div
              key={i}
              onDragOver={key ? (e) => { drag.allowDrop(e); setOver(key); } : undefined}
              onDragLeave={() => setOver(null)}
              onDrop={
                key
                  ? (e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) onDropEvent(id, key);
                      setOver(null);
                    }
                  : undefined
              }
              className={cn(
                "border-r border-b border-border p-2 min-h-[110px] transition-colors",
                (i + 1) % 7 === 0 && "border-r-0",
                d == null && "bg-muted/20",
                isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
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
                      <button
                        key={e.id}
                        draggable
                        onDragStart={drag.onDragStart(e.id)}
                        onDragEnd={drag.onDragEnd}
                        onClick={() => onSelect(e.id)}
                        className={cn(
                          "w-full text-left truncate px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-grab active:cursor-grabbing",
                          statusColor[e.status],
                          drag.dragId === e.id && "opacity-40",
                        )}
                      >
                        {e.event_time?.slice(0, 5) ?? ""} {e.clients?.name ?? "Evento"}
                      </button>
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
  );
}

function WeekView({
  cursor,
  events,
  onSelect,
  onDropEvent,
}: {
  cursor: Date;
  events: any[];
  onSelect: (id: string) => void;
  onDropEvent: (id: string, date: string) => void;
}) {
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
  const drag = useDrag();
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = iso(d);
          const ev = byDay.get(key) ?? [];
          const isToday = iso(new Date()) === key;
          const isOver = over === key;
          return (
            <div
              key={key}
              onDragOver={(e) => { drag.allowDrop(e); setOver(key); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) onDropEvent(id, key);
                setOver(null);
              }}
              className={cn(
                "border-r border-border last:border-r-0 min-h-[400px] p-2 transition-colors",
                isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
              )}
            >
              <div
                className={cn(
                  "text-center py-2 border-b border-border mb-2",
                  isToday && "text-primary font-bold",
                )}
              >
                <div className="text-[10px] uppercase text-muted-foreground">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()]}
                </div>
                <div className="text-lg font-extrabold">{d.getDate()}</div>
              </div>
              <div className="space-y-1">
                {ev.map((e) => (
                  <button
                    key={e.id}
                    draggable
                    onDragStart={drag.onDragStart(e.id)}
                    onDragEnd={drag.onDragEnd}
                    onClick={() => onSelect(e.id)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold cursor-grab active:cursor-grabbing",
                      statusColor[e.status],
                      drag.dragId === e.id && "opacity-40",
                    )}
                  >
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

function DayView({
  cursor,
  events,
  onSelect,
  onDropEvent,
}: {
  cursor: Date;
  events: any[];
  onSelect: (id: string) => void;
  onDropEvent: (id: string, date: string, time: string) => void;
}) {
  const key = iso(cursor);
  const dayEvents = events
    .filter((e) => e.event_date === key)
    .sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6h — 23h
  const drag = useDrag();
  const [over, setOver] = useState<number | null>(null);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="divide-y divide-border">
        {hours.map((h) => {
          const slot = dayEvents.filter(
            (e) => Number((e.event_time ?? "00").slice(0, 2)) === h,
          );
          const isOver = over === h;
          return (
            <div
              key={h}
              onDragOver={(e) => { drag.allowDrop(e); setOver(h); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) onDropEvent(id, key, `${String(h).padStart(2, "0")}:00:00`);
                setOver(null);
              }}
              className={cn(
                "grid grid-cols-[80px_1fr] min-h-[64px] transition-colors",
                isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
              )}
            >
              <div className="p-3 text-xs font-mono text-muted-foreground border-r border-border">
                {String(h).padStart(2, "0")}:00
              </div>
              <div className="p-2 space-y-1">
                {slot.map((e) => (
                  <button
                    key={e.id}
                    draggable
                    onDragStart={drag.onDragStart(e.id)}
                    onDragEnd={drag.onDragEnd}
                    onClick={() => onSelect(e.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing",
                      statusColor[e.status],
                      drag.dragId === e.id && "opacity-40",
                    )}
                  >
                    <div className="text-xs font-bold">
                      {e.event_time?.slice(0, 5)} · {e.clients?.name}
                    </div>
                    <div className="text-[11px] opacity-80">
                      {e.guest_count ?? 0} pessoas · {brl(e.total_value)}
                    </div>
                  </button>
                ))}
                {slot.length === 0 && (
                  <div className="text-[10px] text-muted-foreground italic px-2">
                    solte um evento aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {dayEvents.length === 0 && (
        <div className="p-6 text-center text-xs text-muted-foreground border-t border-border">
          Nenhum evento nesta data. Arraste um evento de outra data para reagendar.
        </div>
      )}
    </div>
  );
}

function EventPanel({ event, onClose }: { event: any; onClose: () => void }) {
  const qc = useQueryClient();
  const changeStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("events").update({ status: status as any }).eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: (_d, status) => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["event-detail"] });
      toast.success(status === "realizado" ? "Evento arquivado" : "Status atualizado");
      if (status === "realizado") onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
  if (!event)
    return (
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-sm">Carregando…</div>
      </div>
    );
  const c = event.clients;
  const phone = c?.whatsapp || c?.phone;
  return (
    <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border overflow-y-auto p-6 shadow-2xl"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <div
              className={cn(
                "inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full mb-2",
                statusColor[event.status],
              )}
            >
              {event.status}
            </div>
            <h2 className="text-xl font-extrabold">{c?.name ?? "Evento"}</h2>
            <p className="text-xs text-muted-foreground">
              {formatDateFullBR(event.event_date)} · {event.event_time?.slice(0, 5) ?? "—"}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Status</label>
              <select
                value={event.status}
                onChange={(e) => changeStatus.mutate(e.target.value)}
                className="h-7 px-2 border border-border rounded-md bg-background text-xs font-bold"
              >
                <option value="agendado">Agendado</option>
                <option value="em_andamento">Em andamento</option>
                <option value="pago">Pago</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
                
              </select>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full hover:bg-accent flex items-center justify-center"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <Info label="Local" value={event.event_address || c?.address || "—"} />
          <Info label="Convidados" value={String(event.guest_count ?? 0)} />
          <Info label="Pacote" value={event.packages?.name ?? "—"} />
          <Info label="Valor total" value={brl(event.total_value)} />
          <Info label="Telefone" value={c?.phone || "—"} />
          <Info label="WhatsApp" value={c?.whatsapp || "—"} />
          {event.notes && <Info label="Observações" value={event.notes} />}

          <StaffSection event={event} />
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {phone && (
            <a
              href={waLink(
                phone,
                `Olá ${c?.name}! Sobre seu evento em ${formatDateFullBR(event.event_date)}...`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-10 rounded-lg bg-emerald-500 text-white text-xs font-bold"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
          <a
            href={`/contratos?event=${event.id}`}
            className="flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
          >
            <FileText className="size-4" /> Contrato
          </a>
        </div>
      </div>
    </div>
  );
}

function StaffSection({ event }: { event: any }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const [amount, setAmount] = useState("");

  const assignedIds = new Set((event.event_staff ?? []).map((s: any) => s.employee_id));

  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, role, daily_rate")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: busyIds } = useQuery({
    queryKey: ["staff-busy", event.event_date, event.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_staff")
        .select("employee_id, events!inner(event_date)")
        .eq("events.event_date", event.event_date)
        .neq("event_id", event.id);
      return new Set((data ?? []).map((r: any) => r.employee_id));
    },
    staleTime: 15_000,
  });

  const addStaff = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Selecione um profissional");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const { error } = await supabase.from("event_staff").insert({
        event_id: event.id,
        employee_id: employeeId,
        owner_id: u.user.id,
        role: role || undefined,
        amount: amount ? Number(amount) : undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-detail"] });
      qc.invalidateQueries({ queryKey: ["staff-busy"] });
      toast.success("Profissional escalado");
      setAdding(false);
      setEmployeeId("");
      setRole("");
      setAmount("");
    },
    onError: (e: any) => {
      if (e.message?.includes("conflito")) {
        toast.error("Este profissional já está escalado em outro evento nesta data");
      } else {
        toast.error(e.message);
      }
    },
  });

  const removeStaff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-detail"] });
      qc.invalidateQueries({ queryKey: ["staff-busy"] });
      toast.success("Profissional removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const available = (employees ?? []).filter(
    (e: any) => !assignedIds.has(e.id) && !busyIds?.has(e.id),
  );
  const busy = (employees ?? []).filter(
    (e: any) => !assignedIds.has(e.id) && busyIds?.has(e.id),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
          Equipe escalada ({event.event_staff?.length ?? 0})
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus className="size-3" /> Adicionar
          </Button>
        )}
      </div>

      {(event.event_staff ?? []).length === 0 && !adding && (
        <div className="text-xs text-muted-foreground">Sem escala definida.</div>
      )}

      <ul className="space-y-1">
        {(event.event_staff ?? []).map((s: any) => (
          <li
            key={s.id}
            className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1.5"
          >
            <div className="min-w-0">
              <div className="font-semibold truncate">{s.employees?.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {s.role || s.employees?.role || "—"} · {s.amount ? brl(s.amount) : "sem valor"}
              </div>
            </div>
            <button
              onClick={() => removeStaff.mutate(s.id)}
              className="p-1 text-muted-foreground hover:text-destructive rounded"
              title="Remover"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2">
          <select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              const emp = employees?.find((x: any) => x.id === e.target.value);
              if (emp) {
                if (!role) setRole(emp.role ?? "");
                if (!amount && emp.daily_rate) setAmount(String(emp.daily_rate));
              }
            }}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs"
          >
            <option value="">Selecione um profissional…</option>
            {available.length > 0 && (
              <optgroup label="Disponíveis">
                {available.map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.role ? `— ${e.role}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {busy.length > 0 && (
              <optgroup label="⚠ Conflito nesta data">
                {busy.map((e: any) => (
                  <option key={e.id} value={e.id} disabled>
                    {e.name} — já escalado
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Função no evento"
              className="bg-background border border-border rounded px-2 py-1.5 text-xs"
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Valor R$"
              type="number"
              step="0.01"
              className="bg-background border border-border rounded px-2 py-1.5 text-xs"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => addStaff.mutate()} disabled={addStaff.isPending}>
              <Plus className="size-3" /> Escalar
            </Button>
          </div>
          {busy.length > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              {busy.length} profissional(is) indisponível(is) nesta data.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Calendar as CalendarIcon, CalendarPlus, FileText, XCircle, CalendarDays, Link2 } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmitirNFModal, type NfEvent } from "@/components/nf/EmitirNFModal";
import { useSearchFilter } from "@/lib/search-store";

type PeriodFilter = "todos" | "hoje" | "semana" | "mes" | "ano";

type StatusFilter =
  | "todos"
  | "agendado"
  | "em_andamento"
  | "pago"
  | "concluido"
  | "cancelado"
  | "realizado";

const periodLabels: Record<PeriodFilter, string> = {
  todos: "Todos",
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
};

const statusFilterLabels: Record<StatusFilter, string> = {
  todos: "Todos",
  agendado: "Agendado",
  em_andamento: "Em andamento",
  pago: "Pago",
  concluido: "Concluído",
  cancelado: "Cancelado",
  realizado: "Realizado",
};

const statusFilterOrder: StatusFilter[] = [
  "todos",
  "agendado",
  "em_andamento",
  "pago",
  "concluido",
  "realizado",
  "cancelado",
];

function matchesPeriod(eventDate: string | null | undefined, period: PeriodFilter): boolean {
  if (period === "todos") return true;
  if (!eventDate) return false;
  const d = new Date(eventDate + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  if (period === "hoje") return d.toDateString() === now.toDateString();
  if (period === "semana") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (period === "mes") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (period === "ano") {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

function matchesStatus(eventStatus: string | null | undefined, status: StatusFilter): boolean {
  if (status === "todos") return true;
  return eventStatus === status;
}

// Gera link do Google Agenda pré-preenchido (sem necessidade de OAuth).
// Cada evento fechado/pago vira um aviso na agenda do dono do buffet.
function googleCalendarUrl(e: any): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toGCal = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const [y, m, day] = String(e.event_date).split("-").map(Number);
  const [hh, mm] = String(e.event_time ?? "18:00").split(":").map(Number);
  const start = new Date(Date.UTC(y, (m ?? 1) - 1, day ?? 1, (hh ?? 18) - 3, mm ?? 0)); // horário BR (UTC-3)
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4h de duração padrão
  const title = `Evento — ${e.clients?.name ?? "Cliente"}${e.packages?.name ? ` (${e.packages.name})` : ""}`;
  const details = [
    e.notes ? `Observações: ${e.notes}` : null,
    e.guest_count ? `Convidados: ${e.guest_count}` : null,
    e.total_value ? `Valor: ${brl(e.total_value)}` : null,
  ].filter(Boolean).join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGCal(start)}/${toGCal(end)}`,
    details,
    location: e.event_address ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const Route = createFileRoute("/_authenticated/eventos/")({
  head: () => ({ meta: [{ title: "Eventos — Central do Buffet" }] }),
  component: EventsPage,
});

const statusStyles: Record<string, string> = {
  agendado: "bg-info/10 text-info",
  em_andamento: "bg-primary/10 text-primary",
  pago: "bg-success/10 text-success",
  concluido: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive",
  realizado: "bg-slate-500/10 text-slate-600",
};

const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  em_andamento: "Em andamento",
  pago: "Pago",
  concluido: "Concluído",
  cancelado: "Cancelado",
  realizado: "Realizado",
};

function EventsPage() {
  const qc = useQueryClient();
  const [nfEvent, setNfEvent] = useState<NfEvent | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const { match } = useSearchFilter();
  const { data: allEvents, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, clients(name, cpf, email), packages(name)")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      todos: allEvents?.length ?? 0,
      agendado: 0,
      em_andamento: 0,
      pago: 0,
      concluido: 0,
      cancelado: 0,
      realizado: 0,
    };
    for (const e of allEvents ?? []) {
      const s = e.status as StatusFilter;
      if (s && s in counts && s !== "todos") counts[s]++;
    }
    return counts;
  }, [allEvents]);

  const data = (allEvents ?? []).filter((e: any) =>
    matchesPeriod(e.event_date, period) &&
    matchesStatus(e.status, statusFilter) &&
    match(
      e.clients?.name,
      e.clients?.cpf,
      e.clients?.email,
      e.packages?.name,
      e.event_address,
      e.notes,
      e.status,
      e.event_date,
      e.total_value,
    ),
  );

  const cancelEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").update({ status: "cancelado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento cancelado. Estoque devolvido automaticamente.");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar evento"),
  });

  return (
    <div className="space-y-6">
      {/* HEADER COM BOTÃO NOVO EVENTO */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Eventos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.length ?? 0} evento(s) registrado(s)
          </p>
        </div>
        <Link to="/eventos/create">
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-2">
            <span className="text-lg leading-none">+</span>
            Novo Evento
          </button>
        </Link>
      </div>

      {/* FILTRO DE PERÍODO */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período:</span>
        {(Object.keys(periodLabels) as PeriodFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
              period === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground",
            )}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* FILTRO DE STATUS EM CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {statusFilterOrder.map((s) => {
          const active = statusFilter === s;
          const count = statusCounts[s];
          const style = statusStyles[s] ?? "bg-muted text-muted-foreground";
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-all",
                active
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                  : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  active ? style : "bg-muted text-muted-foreground",
                )}
              >
                {statusFilterLabels[s]}
              </span>
              <span className="text-xl font-extrabold">{count}</span>
              <span className="text-[10px] text-muted-foreground">evento(s)</span>
            </button>
          );
        })}
      </div>

      {/* TABELA DE EVENTOS */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-16 text-center">
            <CalendarIcon className="size-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm font-semibold">Nenhum evento ainda</div>
            <div className="text-xs text-muted-foreground mt-1">
              Ao aprovar um orçamento, ele vira um evento automaticamente.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-5 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Data</th>
                  <th className="px-4 py-3 font-bold hidden md:table-cell">Pacote</th>
                  <th className="px-4 py-3 font-bold text-right">Valor</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data!.map((e: any) => {
                  const canSchedule = e.status !== "cancelado";
                  const canCancel = e.status !== "cancelado" && e.status !== "concluido" && e.status !== "realizado";
                  return (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 text-sm font-semibold">
                      {e.clients?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-xs font-mono">{formatDateBR(e.event_date)}</td>
                    <td className="px-4 py-4 text-xs hidden md:table-cell">
                      {e.packages?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm font-mono text-right">
                      {brl(e.total_value)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "px-2 py-1 text-[10px] rounded-full font-bold uppercase tracking-wider whitespace-nowrap",
                          statusStyles[e.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {statusLabels[e.status] ?? e.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {canSchedule && (
                          <a
                            href={googleCalendarUrl(e)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Adicionar aviso deste evento no Google Agenda"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            <CalendarPlus className="size-3.5" /> Agenda
                          </a>
                        )}
                        {e.rsvp_token && e.status !== "cancelado" && (
                          <button
                            onClick={async () => {
                              const url = `${window.location.origin}/convite/${e.rsvp_token}`;
                              const ok = await copyToClipboard(url);
                              toast[ok ? "success" : "error"](
                                ok ? "Link de convite copiado! Envie para o cliente." : url,
                              );
                            }}
                            title="Copiar link de confirmação de presença para o cliente enviar aos convidados"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors"
                          >
                            <Link2 className="size-3.5" /> Convite
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => {
                              if (confirm(`Cancelar o evento de ${e.clients?.name ?? "cliente"}? O estoque reservado voltará automaticamente.`)) {
                                cancelEvent.mutate(e.id);
                              }
                            }}
                            disabled={cancelEvent.isPending}
                            title="Cancelar evento"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="size-3.5" /> Cancelar
                          </button>
                        )}
                        {(e.status === "pago" || e.status === "concluido") && (
                          <button
                            onClick={() => setNfEvent(e as NfEvent)}
                            title="Emitir nota fiscal deste evento"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-success/10 text-success hover:bg-success/20 transition-colors"
                          >
                            <FileText className="size-3.5" /> Emitir NF
                          </button>
                        )}
                        {!canSchedule && !canCancel && (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nfEvent && <EmitirNFModal event={nfEvent} onClose={() => setNfEvent(null)} />}
    </div>
  );
}

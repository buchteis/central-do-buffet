import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  head: () => ({ meta: [{ title: "Eventos — Meu Churras" }] }),
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
  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, clients(name), packages(name)")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
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
                  <th className="px-4 py-3 font-bold text-right">Agenda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data!.map((e: any) => {
                  const canSchedule = e.status !== "cancelado";
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
                      {canSchedule ? (
                        <a
                          href={googleCalendarUrl(e)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Adicionar aviso deste evento no Google Agenda"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                          <CalendarPlus className="size-3.5" /> Google Agenda
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, brlCompact, formatDateBR, formatDateFullBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowRight, Calendar, DollarSign, FileText, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Meu Churras" }] }),
  component: Dashboard,
});

const statusStyles: Record<string, string> = {
  agendado: "bg-info/10 text-info",
  pagamento_parcial: "bg-warning/20 text-warning-foreground",
  pago: "bg-success/10 text-success",
  em_andamento: "bg-primary/10 text-primary",
  concluido: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive",
};
const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  pagamento_parcial: "Parcial",
  pago: "Pago",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);

      const [eventsMonth, quotesPending, clientsCount, revenue, upcoming] = await Promise.all([
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .gte("event_date", monthStart)
          .lt("event_date", nextMonth),
        supabase
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .in("status", ["novo", "em_analise", "enviado"]),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase
          .from("events")
          .select("total_value")
          .gte("event_date", monthStart)
          .lt("event_date", nextMonth),
        supabase
          .from("events")
          .select("id, event_date, event_time, status, total_value, clients(name), packages(name)")
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .limit(5),
      ]);

      const monthRevenue = (revenue.data ?? []).reduce(
        (acc, r) => acc + Number(r.total_value ?? 0),
        0,
      );

      return {
        eventsMonth: eventsMonth.count ?? 0,
        quotesPending: quotesPending.count ?? 0,
        clientsCount: clientsCount.count ?? 0,
        monthRevenue,
        upcoming: upcoming.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateFullBR(new Date())} · Visão geral do buffet
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-reveal">
        <Kpi
          label="Eventos no mês"
          value={String(stats?.eventsMonth ?? "—")}
          hint="Agendados + realizados"
          icon={Calendar}
        />
        <Kpi
          label="Receita do mês"
          value={brlCompact(stats?.monthRevenue ?? 0)}
          hint="Somatório de eventos"
          icon={DollarSign}
          accent
        />
        <Kpi
          label="Orçamentos pendentes"
          value={String(stats?.quotesPending ?? "—")}
          hint="Aguardando decisão"
          icon={FileText}
        />
        <Kpi
          label="Clientes cadastrados"
          value={String(stats?.clientsCount ?? "—")}
          hint="Base total"
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm">
          <div className="p-5 md:p-6 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">Próximos eventos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Os 5 eventos mais próximos na sua agenda
              </p>
            </div>
            <Link
              to="/eventos"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="size-3" />
            </Link>
          </div>
          {stats?.upcoming && stats.upcoming.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                    <th className="px-5 md:px-6 py-3 font-bold">Cliente</th>
                    <th className="px-4 py-3 font-bold">Data</th>
                    <th className="px-4 py-3 font-bold hidden md:table-cell">Pacote</th>
                    <th className="px-4 py-3 font-bold text-right">Valor</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.upcoming.map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 md:px-6 py-4 text-sm font-semibold">
                        {e.clients?.name ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono">{formatDateBR(e.event_date)}</td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="px-2 py-1 bg-muted text-[10px] rounded font-bold uppercase">
                          {e.packages?.name ?? "—"}
                        </span>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nenhum evento próximo"
              hint="Assim que um orçamento for aprovado, ele aparece aqui."
              cta={{ to: "/orcamentos/novo", label: "Criar orçamento" }}
            />
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm">
          <div className="p-5 md:p-6 border-b border-border">
            <h2 className="font-extrabold text-lg tracking-tight">Ações rápidas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">O que você faz mais</p>
          </div>
          <div className="p-4 md:p-5 space-y-2">
            <QuickAction to="/orcamentos/novo" label="Novo orçamento" hint="Em menos de 2 min" />
            <QuickAction to="/clientes/novo" label="Cadastrar cliente" hint="Nome, CPF, contato" />
            <QuickAction to="/agenda" label="Ver agenda do mês" hint="Calendário completo" />
            <QuickAction to="/pacotes" label="Gerenciar pacotes" hint="Preços e inclusos" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  accent?: boolean;
}) {
  return (
    <div className="bg-card p-4 md:p-5 rounded-2xl border border-border shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </span>
        <Icon
          className={cn("size-4", accent ? "text-primary" : "text-muted-foreground/70")}
        />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            "text-2xl md:text-3xl font-extrabold tracking-tighter",
            accent && "text-primary",
          )}
        >
          {value}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function QuickAction({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{hint}</div>
      </div>
      <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}

function EmptyState({
  title,
  hint,
  cta,
}: {
  title: string;
  hint: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="p-10 text-center">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      {cta && (
        <Link
          to={cta.to}
          className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-primary hover:underline"
        >
          {cta.label} <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

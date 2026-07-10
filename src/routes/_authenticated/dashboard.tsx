import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, brlCompact, formatDateBR, formatDateFullBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  FileText,
  Hourglass,
  ShoppingCart,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Meu Churras" }] }),
  component: Dashboard,
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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function Dashboard() {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
    };
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats-v2"],
    queryFn: async () => {
      const now = new Date();
      const today = isoDate(now);
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const nextMonth = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
      const monthAgo = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
      const tomorrow = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

      const [
        evToday,
        evWeek,
        evMonth,
        qPend,
        qApr,
        revPredicted,
        revReceived,
        txPending,
        txOverdue,
        clientsCount,
        newClients,
        staffToday,
        employeesActive,
        contractsPending,
        upcoming,
        alertsPay,
        alertsEvTomorrow,
        eventosConfirmados,
        quotesNegociacao,
      
      ] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }).eq("event_date", today),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", isoDate(weekStart)).lt("event_date", isoDate(weekEnd)),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", monthStart).lt("event_date", nextMonth),
        supabase.from("quotes").select("id", { count: "exact", head: true }).in("status", ["novo", "primeiro_contato", "visitado", "enviado", "negociacao", "aguardando"]),
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "aprovado"),
        supabase.from("events").select("total_value").gte("event_date", monthStart).lt("event_date", nextMonth),
        supabase.from("transactions").select("amount").eq("type", "entrada").eq("status", "pago").gte("paid_date", monthStart).lt("paid_date", nextMonth),
        supabase.from("transactions").select("amount").eq("status", "pendente"),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pendente").lt("due_date", today),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", monthAgo),
        (async () => {
          const { data: ids } = await supabase.from("events").select("id").eq("event_date", today);
          const eventIds = (ids ?? []).map((r: any) => r.id);
          if (eventIds.length === 0) return { data: [] as any[] };
          const { data } = await supabase.from("event_staff").select("id").in("event_id", eventIds);
          return { data: data ?? [] };
        })(),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("contracts").select("id", { count: "exact", head: true }).in("status", ["rascunho", "enviado"]),
        supabase.from("events").select("id, event_date, event_time, status, total_value, clients(name), packages(name)").gte("event_date", today).order("event_date").limit(6),
        supabase.from("transactions").select("id, description, amount, due_date").eq("status", "pendente").lt("due_date", today).limit(5),
        supabase.from("events").select("id, event_time, clients(name)").eq("event_date", tomorrow).limit(5),
        supabase.from("quotes").select("total_value").eq("status", "fechado").eq("paid", true),
        supabase.from("quotes").select("total_value").in("status", ["em_analise", "negociacao", "aguardando", "primeiro_contato", "visitado", "enviado", "em_andamento"]),
      ]);

      const revenuePredicted = (revPredicted.data ?? []).reduce((s, r) => s + Number(r.total_value ?? 0), 0);
      const revenueReceived = (revReceived.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const toReceive = (txPending.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const faturamentoConcluido = (eventosConfirmados.data ?? []).reduce((s, r: any) => s + Number(r.total_value ?? 0), 0);
      const negociacaoVal = (quotesNegociacao.data ?? []).reduce((s, r: any) => s + Number(r.total_value ?? 0), 0);
      const ganhosPrevisiveis = faturamentoConcluido + negociacaoVal;

      return {
        evToday: evToday.count ?? 0,
        evWeek: evWeek.count ?? 0,
        evMonth: evMonth.count ?? 0,
        qPend: qPend.count ?? 0,
        qApr: qApr.count ?? 0,
        revenuePredicted,
        revenueReceived,
        toReceive,
        ganhosPrevisiveis,
        faturamentoConcluido,
        clientsCount: clientsCount.count ?? 0,
        newClients: newClients.count ?? 0,
        staffToday: staffToday.data?.length ?? 0,
        employeesActive: employeesActive.count ?? 0,
        contractsPending: contractsPending.count ?? 0,
        txOverdue: txOverdue.count ?? 0,
        upcoming: upcoming.data ?? [],
        alertsPay: alertsPay.data ?? [],
        alertsEvTomorrow: alertsEvTomorrow.data ?? [],
      };
    },
  });

  const alerts: { icon: any; label: string; tone: string }[] = [];
  if (stats) {
    if (stats.txOverdue > 0) alerts.push({ icon: AlertTriangle, label: `${stats.txOverdue} pagamento(s) atrasado(s)`, tone: "destructive" });
    if (stats.contractsPending > 0) alerts.push({ icon: FileText, label: `${stats.contractsPending} contrato(s) pendente(s)`, tone: "warning" });
    if (stats.alertsEvTomorrow.length > 0) alerts.push({ icon: CalendarCheck, label: `${stats.alertsEvTomorrow.length} evento(s) amanhã`, tone: "info" });
    if (stats.qPend > 0) alerts.push({ icon: Hourglass, label: `${stats.qPend} orçamento(s) aguardando resposta`, tone: "muted" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatDateFullBR(new Date())} · Central operacional</p>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {alerts.map((a, i) => (
            <div key={i} className={cn(
              "flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold",
              a.tone === "destructive" && "border-destructive/30 bg-destructive/5 text-destructive",
              a.tone === "warning" && "border-warning/30 bg-warning/10 text-warning-foreground",
              a.tone === "info" && "border-info/30 bg-info/10 text-info",
              a.tone === "muted" && "border-border bg-muted/30",
            )}>
              <a.icon className="size-4 shrink-0" />
              <span>{a.label}</span>
            </div>
          ))}
        </div>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background border border-emerald-500/20 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Faturamento concluído</span>
            <DollarSign className="size-5 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tighter text-emerald-700 font-mono">
            {brl(stats?.faturamentoConcluido ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Soma dos orçamentos com status <strong>Fechado</strong> e marcados como <strong>Pago</strong>.
          </p>
        </div>
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Ganhos previsíveis</span>
            <DollarSign className="size-5 text-primary" />
          </div>
          <div className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tighter text-primary font-mono">
            {brl(stats?.ganhosPrevisiveis ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Concluído + orçamentos em andamento/negociação.
          </p>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Kpi label="Eventos hoje" value={String(stats?.evToday ?? "—")} icon={Calendar} />
        <Kpi label="Eventos na semana" value={String(stats?.evWeek ?? "—")} icon={CalendarDays} />
        <Kpi label="Eventos no mês" value={String(stats?.evMonth ?? "—")} icon={CalendarCheck} />
        <Kpi label="Receita prevista" value={brlCompact(stats?.revenuePredicted ?? 0)} icon={DollarSign} accent />
        <Kpi label="Receita recebida" value={brlCompact(stats?.revenueReceived ?? 0)} icon={Wallet} />
        <Kpi label="A receber" value={brlCompact(stats?.toReceive ?? 0)} icon={Hourglass} tone={stats && stats.txOverdue > 0 ? "warn" : undefined} />
        <Kpi label="Orçamentos pendentes" value={String(stats?.qPend ?? "—")} icon={FileText} />
        <Kpi label="Orçamentos aprovados" value={String(stats?.qApr ?? "—")} icon={FileText} />
        <Kpi label="Clientes ativos" value={String(stats?.clientsCount ?? "—")} icon={Users} />
        <Kpi label="Novos clientes (30d)" value={String(stats?.newClients ?? "—")} icon={Users} />
        <Kpi label="Escala hoje" value={String(stats?.staffToday ?? "—")} icon={UserCheck} />
        <Kpi label="Funcionários ativos" value={String(stats?.employeesActive ?? "—")} icon={ShoppingCart} />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm">
          <div className="p-5 md:p-6 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">Próximos eventos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Os 6 eventos mais próximos</p>
            </div>
            <Link to="/agenda" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              Ver agenda <ArrowRight className="size-3" />
            </Link>
          </div>
          {stats?.upcoming && stats.upcoming.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                    <th className="px-5 py-3 font-bold">Cliente</th>
                    <th className="px-4 py-3 font-bold">Data</th>
                    <th className="px-4 py-3 font-bold hidden md:table-cell">Pacote</th>
                    <th className="px-4 py-3 font-bold text-right">Valor</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.upcoming.map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 text-sm font-semibold">{e.clients?.name ?? "—"}</td>
                      <td className="px-4 py-4 text-xs font-mono">{formatDateBR(e.event_date)}</td>
                      <td className="px-4 py-4 hidden md:table-cell text-xs">{e.packages?.name ?? "—"}</td>
                      <td className="px-4 py-4 text-sm font-mono text-right">{brl(e.total_value)}</td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          "px-2 py-1 text-[10px] rounded-full font-bold uppercase tracking-wider whitespace-nowrap",
                          statusStyles[e.status] ?? "bg-muted text-muted-foreground",
                        )}>
                          {statusLabels[e.status] ?? e.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum evento próximo.</div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm">
          <div className="p-5 md:p-6 border-b border-border">
            <h2 className="font-extrabold text-lg tracking-tight">Pendências</h2>
            <p className="text-xs text-muted-foreground mt-0.5">O que precisa da sua atenção</p>
          </div>
          <div className="divide-y divide-border">
            {(stats?.alertsPay ?? []).map((t: any) => (
              <div key={t.id} className="p-4 flex items-start gap-3">
                <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{t.description}</div>
                  <div className="text-[11px] text-muted-foreground">Venceu em {formatDateBR(t.due_date)}</div>
                </div>
                <span className="text-xs font-mono font-bold text-destructive">{brl(t.amount)}</span>
              </div>
            ))}
            {(stats?.alertsEvTomorrow ?? []).map((e: any) => (
              <div key={e.id} className="p-4 flex items-start gap-3">
                <CalendarCheck className="size-4 text-info shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">Evento amanhã — {e.clients?.name}</div>
                  <div className="text-[11px] text-muted-foreground">{e.event_time?.slice(0, 5) ?? ""}</div>
                </div>
              </div>
            ))}
            {(!stats?.alertsPay?.length && !stats?.alertsEvTomorrow?.length) && (
              <div className="p-10 text-center text-xs text-muted-foreground">Nenhuma pendência. 🎉</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent, tone }: { label: string; value: string; icon: any; accent?: boolean; tone?: "warn" }) {
  return (
    <div className={cn(
      "bg-card p-4 rounded-2xl border shadow-sm",
      tone === "warn" ? "border-warning/40" : "border-border",
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon className={cn("size-4", accent ? "text-primary" : "text-muted-foreground/70")} />
      </div>
      <div className={cn("mt-2 text-2xl font-extrabold tracking-tighter", accent && "text-primary")}>{value}</div>
    </div>
  );
}

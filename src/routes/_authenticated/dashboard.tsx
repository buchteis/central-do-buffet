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
  CreditCard,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Chatbot } from "@/components/Chatbot";

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

const EXCLUDED_STATUSES = ["cancelado"];

function useDashboardQuery<T>(key: string, fn: () => Promise<T>) {
  return useQuery({
    queryKey: ["dashboard", key],
    queryFn: fn,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

function Dashboard() {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    };

    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_staff" }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const now = new Date();
  const today = isoDate(now);
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekStartISO = isoDate(weekStart);
  const weekEndISO = isoDate(weekEnd);
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const nextMonth = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const monthAgo = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
  const tomorrow = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const eventsData = useDashboardQuery("events-data", async () => {
    const { data } = await supabase
      .from("events")
      .select("id, event_date, status")
      .not("status", "in", `("${EXCLUDED_STATUSES.join('","')}")`);
    const counts = { today: 0, week: 0, month: 0 };
    data?.forEach((event) => {
      if (event.event_date === today) counts.today++;
      if (event.event_date >= weekStartISO && event.event_date < weekEndISO) counts.week++;
      if (event.event_date >= monthStart && event.event_date < nextMonth) counts.month++;
    });
    return counts;
  });

  const quotesData = useDashboardQuery("quotes-data", async () => {
    const { data } = await supabase.from("quotes").select("id, status, total_value, paid");
    const pendentes = data?.filter((q) => q.status === "novo" || q.status === "em_andamento").length || 0;
    const aprovados = data?.filter((q) => q.status === "fechado").length || 0;
    const concluidos =
      data
        ?.filter((q) => q.status === "fechado" && q.paid === true)
        .reduce((sum, q) => sum + Number(q.total_value || 0), 0) || 0;
    const previsiveis =
      data
        ?.filter((q) => (q.status === "fechado" && q.paid === true) || q.status === "em_andamento")
        .reduce((sum, q) => sum + Number(q.total_value || 0), 0) || 0;
    return { pendentes, aprovados, concluidos, previsiveis };
  });

  const transactionsData = useDashboardQuery("transactions-data", async () => {
    const { data } = await supabase.from("transactions").select("id, amount, type, status, paid_date, due_date");
    const recebido =
      data
        ?.filter(
          (t) =>
            t.type === "entrada" &&
            t.status === "pago" &&
            t.paid_date &&
            t.paid_date >= monthStart &&
            t.paid_date < nextMonth,
        )
        .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;
    const aReceber =
      data?.filter((t) => t.status === "pendente").reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;
    const vencidos = data?.filter((t) => t.status === "pendente" && t.due_date && t.due_date < today).length || 0;
    return { recebido, aReceber, vencidos };
  });

  const clientsCount = useDashboardQuery("clients-count", async () => {
    const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
    return count ?? 0;
  });

  const newClients = useDashboardQuery("new-clients", async () => {
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthAgo);
    return count ?? 0;
  });

  const employeesActive = useDashboardQuery("employees-active", async () => {
    const { count } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("active", true);
    return count ?? 0;
  });

  const contractsPending = useDashboardQuery("contracts-pending", async () => {
    const { count } = await supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .in("status", ["rascunho", "enviado"]);
    return count ?? 0;
  });

  const staffToday = useDashboardQuery("staff-today", async () => {
    const { data: events } = await supabase
      .from("events")
      .select("id")
      .eq("event_date", today)
      .not("status", "in", `("${EXCLUDED_STATUSES.join('","')}")`);
    if (!events || events.length === 0) return 0;
    const eventIds = events.map((e) => e.id);
    const { count } = await supabase
      .from("event_staff")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds);
    return count ?? 0;
  });

  const upcoming = useDashboardQuery("upcoming", async () => {
    const { data } = await supabase
      .from("events")
      .select("id, event_date, event_time, status, total_value, clients(name), packages(name)")
      .gte("event_date", today)
      .not("status", "in", `("${EXCLUDED_STATUSES.join('","')}")`)
      .order("event_date")
      .limit(6);
    return data ?? [];
  });

  const alertsPay = useDashboardQuery("alerts-pay", async () => {
    const { data } = await supabase
      .from("transactions")
      .select("id, description, amount, due_date")
      .eq("status", "pendente")
      .lt("due_date", today)
      .limit(5);
    return data ?? [];
  });

  const alertsEvTomorrow = useDashboardQuery("alerts-ev-tomorrow", async () => {
    const { data } = await supabase
      .from("events")
      .select("id, event_time, clients(name)")
      .eq("event_date", tomorrow)
      .not("status", "in", `("${EXCLUDED_STATUSES.join('","')}")`)
      .limit(5);
    return data ?? [];
  });

  const stats = {
    evToday: eventsData.data?.today ?? 0,
    evWeek: eventsData.data?.week ?? 0,
    evMonth: eventsData.data?.month ?? 0,
    qPend: quotesData.data?.pendentes ?? 0,
    qApr: quotesData.data?.aprovados ?? 0,
    revenueReceived: transactionsData.data?.recebido ?? 0,
    toReceive: transactionsData.data?.aReceber ?? 0,
    txOverdue: transactionsData.data?.vencidos ?? 0,
    faturamentoConcluido: quotesData.data?.concluidos ?? 0,
    ganhosPrevisiveis: quotesData.data?.previsiveis ?? 0,
    clientsCount: clientsCount.data ?? 0,
    newClients: newClients.data ?? 0,
    staffToday: staffToday.data ?? 0,
    employeesActive: employeesActive.data ?? 0,
    contractsPending: contractsPending.data ?? 0,
    upcoming: upcoming.data ?? [],
    alertsPay: alertsPay.data ?? [],
    alertsEvTomorrow: alertsEvTomorrow.data ?? [],
  };

  const alerts: { icon: any; label: string; tone: string }[] = [];
  if (stats.txOverdue > 0)
    alerts.push({ icon: AlertTriangle, label: `${stats.txOverdue} pagamento(s) atrasado(s)`, tone: "destructive" });
  if (stats.contractsPending > 0)
    alerts.push({ icon: FileText, label: `${stats.contractsPending} contrato(s) pendente(s)`, tone: "warning" });
  if (stats.alertsEvTomorrow.length > 0)
    alerts.push({ icon: CalendarCheck, label: `${stats.alertsEvTomorrow.length} evento(s) amanhã`, tone: "info" });
  if (stats.qPend > 0)
    alerts.push({ icon: Hourglass, label: `${stats.qPend} orçamento(s) aguardando resposta`, tone: "muted" });

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
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold",
                a.tone === "destructive" && "border-destructive/30 bg-destructive/5 text-destructive",
                a.tone === "warning" && "border-warning/30 bg-warning/10 text-warning-foreground",
                a.tone === "info" && "border-info/30 bg-info/10 text-info",
                a.tone === "muted" && "border-border bg-muted/30",
              )}
            >
              <a.icon className="size-4 shrink-0" />
              <span>{a.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* CARDS FATURAMENTO CONCLUÍDO E GANHOS PREVISÍVEIS REMOVIDOS */}
      {/* 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background border border-emerald-500/20 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Faturamento concluído</span>
            <DollarSign className="size-5 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tighter text-emerald-700 font-mono">
            {brl(stats.faturamentoConcluido)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Soma dos orçamentos com status <strong>Fechado</strong> e marcados como <strong>Pago</strong>.</p>
        </div>
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Ganhos previsíveis</span>
            <DollarSign className="size-5 text-primary" />
          </div>
          <div className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tighter text-primary font-mono">
            {brl(stats.ganhosPrevisiveis)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Concluído + orçamentos em andamento/negociação.</p>
        </div>
      </div>
      */}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Kpi label="Eventos hoje" value={String(stats.evToday)} icon={Calendar} accent />
        <Kpi label="Eventos na semana" value={String(stats.evWeek)} icon={CalendarDays} />
        <Kpi label="Eventos no mês" value={String(stats.evMonth)} icon={CalendarCheck} />
        {/* KPI RECEITA RECEBIDA REMOVIDO */}
        {/* <Kpi label="Receita recebida" value={brlCompact(stats.revenueReceived)} icon={Wallet} accent /> */}
        <Kpi
          label="A receber"
          value={brlCompact(stats.toReceive)}
          icon={CreditCard}
          tone={stats.txOverdue > 0 ? "warn" : undefined}
        />
        <Kpi label="Orçamentos pendentes" value={String(stats.qPend)} icon={Clock} />
        <Kpi label="Orçamentos aprovados" value={String(stats.qApr)} icon={CheckCircle} />
        <Kpi label="Clientes ativos" value={String(stats.clientsCount)} icon={Users} />
        <Kpi label="Novos clientes (30d)" value={String(stats.newClients)} icon={Users} />
        <Kpi label="Escala hoje" value={String(stats.staffToday)} icon={UserCheck} />
        <Kpi label="Funcionários ativos" value={String(stats.employeesActive)} icon={ShoppingCart} />
        <Kpi
          label="Contratos pendentes"
          value={String(stats.contractsPending)}
          icon={FileText}
          tone={stats.contractsPending > 0 ? "warn" : undefined}
        />
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

          {stats.upcoming.length > 0 ? (
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
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum evento próximo.</div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm">
          <div className="p-5 md:p-6 border-b border-border">
            <h2 className="font-extrabold text-lg tracking-tight">Pendências</h2>
            <p className="text-xs text-muted-foreground mt-0.5">O que precisa da sua atenção</p>
          </div>
          <div className="divide-y divide-border">
            {stats.alertsPay.map((t: any) => (
              <div key={t.id} className="p-4 flex items-start gap-3">
                <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{t.description}</div>
                  <div className="text-[11px] text-muted-foreground">Venceu em {formatDateBR(t.due_date)}</div>
                </div>
                <span className="text-xs font-mono font-bold text-destructive">{brl(t.amount)}</span>
              </div>
            ))}
            {stats.alertsEvTomorrow.map((e: any) => (
              <div key={e.id} className="p-4 flex items-start gap-3">
                <CalendarCheck className="size-4 text-info shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">Evento amanhã — {e.clients?.name}</div>
                  <div className="text-[11px] text-muted-foreground">{e.event_time?.slice(0, 5) ?? ""}</div>
                </div>
              </div>
            ))}
            {stats.alertsPay.length === 0 && stats.alertsEvTomorrow.length === 0 && (
              <div className="p-10 text-center text-xs text-muted-foreground">Nenhuma pendência. 🎉</div>
            )}
          </div>
        </div>
      </div>
      <Chatbot />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
  tone,
}: {
  label: string;
  value: string;
  icon: any;
  accent?: boolean;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "bg-card p-4 rounded-2xl border shadow-sm transition-all",
        tone === "warn" && "border-warning/40 bg-warning/5",
        !tone && "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon
          className={cn(
            "size-4",
            accent ? "text-primary" : "text-muted-foreground/70",
            tone === "warn" && "text-warning",
          )}
        />
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-extrabold tracking-tighter",
          accent && "text-primary",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </div>
    </div>
  );
}

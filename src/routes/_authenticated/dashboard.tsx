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
  Package,
  Boxes,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Building2,
} from "lucide-react";
import { Chatbot } from "@/components/Chatbot";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Meu Churras" }] }),
  component: Dashboard,
});

const statusStyles: Record<string, string> = {
  agendado: "bg-blue-100 text-blue-800",
  em_andamento: "bg-amber-100 text-amber-800",
  pago: "bg-green-100 text-green-800",
  concluido: "bg-gray-100 text-gray-800",
  cancelado: "bg-red-100 text-red-800",
  realizado: "bg-purple-100 text-purple-800",
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

  // ===== QUERIES =====
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
        ?.filter((t) => t.type === "entrada" && t.status === "pago")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;
    const aReceber =
      data
        ?.filter((t) => t.type === "entrada" && t.status === "pendente")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;
    const vencidos =
      data?.filter((t) => t.type === "entrada" && t.status === "pendente" && t.due_date && t.due_date < today).length ||
      0;
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

  // 🆕 QUERY PARA PACOTES
  const packagesCount = useDashboardQuery("packages-count", async () => {
    const { count } = await supabase.from("packages").select("id", { count: "exact", head: true });
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
      .eq("type", "entrada")
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

  // ===== CONSOLIDAÇÃO DOS DADOS =====
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
    packagesCount: packagesCount.data ?? 0, // 🆕 PACOTES
    upcoming: upcoming.data ?? [],
    alertsPay: alertsPay.data ?? [],
    alertsEvTomorrow: alertsEvTomorrow.data ?? [],
  };

  // ===== ALERTAS =====
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
    <div className="space-y-8 p-4 md:p-6 bg-slate-50/50 min-h-screen">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-800">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="size-4" />
            {formatDateFullBR(new Date())} · Central operacional
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            Ao vivo
          </span>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-sm font-medium shadow-sm",
                a.tone === "destructive" && "border-red-200 bg-red-50 text-red-700",
                a.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
                a.tone === "info" && "border-blue-200 bg-blue-50 text-blue-700",
                a.tone === "muted" && "border-gray-200 bg-gray-50 text-gray-700",
              )}
            >
              <a.icon className="size-5 shrink-0" />
              <span>{a.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ===== LINHA 1: EVENTOS ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <Calendar className="size-5 text-blue-600" />
            Eventos
          </h2>
          <Link to="/agenda" className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1">
            Ver agenda <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Hoje" value={stats.evToday} icon={Calendar} color="blue" subtitle="eventos" />
          <MetricCard label="Semana" value={stats.evWeek} icon={CalendarDays} color="indigo" subtitle="eventos" />
          <MetricCard label="Mês" value={stats.evMonth} icon={CalendarCheck} color="purple" subtitle="eventos" />
          <MetricCard
            label="A receber"
            value={brlCompact(stats.toReceive)}
            icon={CreditCard}
            color="emerald"
            subtitle={stats.txOverdue > 0 ? `${stats.txOverdue} atrasados` : "em dia"}
          />
        </div>
      </section>

      {/* ===== LINHA 2: FINANCEIRO ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <DollarSign className="size-5 text-emerald-600" />
            Financeiro
          </h2>
          <Link
            to="/financeiro"
            className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1"
          >
            Ver extrato <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FinanceCard label="Receita recebida" value={brl(stats.revenueReceived)} icon={TrendingUp} color="emerald" />
          <FinanceCard label="A receber" value={brl(stats.toReceive)} icon={Clock} color="amber" />
          <FinanceCard
            label="Saldo atual"
            value={brl(stats.revenueReceived - stats.toReceive)}
            icon={Wallet}
            color="sky"
          />
        </div>
      </section>

      {/* ===== LINHA 3: ORÇAMENTOS E CLIENTES ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <FileText className="size-5 text-amber-600" />
            Orçamentos e Clientes
          </h2>
          <Link to="/orcamentos" className="text-xs font-medium text-amber-600 hover:underline flex items-center gap-1">
            Ver orçamentos <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Pendentes" value={stats.qPend} icon={Clock} color="orange" subtitle="orçamentos" />
          <MetricCard label="Aprovados" value={stats.qApr} icon={CheckCircle} color="green" subtitle="orçamentos" />
          <MetricCard
            label="Clientes ativos"
            value={stats.clientsCount}
            icon={Users}
            color="cyan"
            subtitle="cadastrados"
          />
          <MetricCard label="Novos (30d)" value={stats.newClients} icon={UserCheck} color="teal" subtitle="clientes" />
        </div>
      </section>

      {/* ===== LINHA 4: STAFF E CONTRATOS ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <Building2 className="size-5 text-violet-600" />
            Operacional
          </h2>
          <Link
            to="/profissionais"
            className="text-xs font-medium text-violet-600 hover:underline flex items-center gap-1"
          >
            Ver equipe <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Escala hoje"
            value={stats.staffToday}
            icon={Users}
            color="violet"
            subtitle="profissionais"
          />
          <MetricCard
            label="Funcionários ativos"
            value={stats.employeesActive}
            icon={UserCheck}
            color="fuchsia"
            subtitle="colaboradores"
          />
          <MetricCard
            label="Contratos pendentes"
            value={stats.contractsPending}
            icon={FileText}
            color="rose"
            subtitle="para assinar"
          />
          {/* 🆕 PACOTES CORRIGIDO */}
          <MetricCard label="Pacotes" value={stats.packagesCount} icon={Package} color="gray" subtitle="cadastrados" />
        </div>
      </section>

      {/* ===== PRÓXIMOS EVENTOS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="font-extrabold text-lg tracking-tight text-slate-800 flex items-center gap-2">
                <Calendar className="size-5 text-blue-600" />
                Próximos eventos
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Os 6 eventos mais próximos</p>
            </div>
            <Link to="/agenda" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
              Ver agenda <ArrowRight className="size-3" />
            </Link>
          </div>

          {stats.upcoming.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3 font-bold">Cliente</th>
                    <th className="px-4 py-3 font-bold">Data</th>
                    <th className="px-4 py-3 font-bold hidden md:table-cell">Pacote</th>
                    <th className="px-4 py-3 font-bold text-right">Valor</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.upcoming.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 text-sm font-semibold text-slate-700">{e.clients?.name ?? "—"}</td>
                      <td className="px-4 py-4 text-xs font-mono text-slate-600">{formatDateBR(e.event_date)}</td>
                      <td className="px-4 py-4 hidden md:table-cell text-xs text-slate-600">
                        {e.packages?.name ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-sm font-mono text-right text-slate-700">{brl(e.total_value)}</td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "px-2 py-1 text-[10px] rounded-full font-bold uppercase tracking-wider whitespace-nowrap",
                            statusStyles[e.status] ?? "bg-gray-100 text-gray-800",
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

        {/* ===== PENDÊNCIAS ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100">
            <h2 className="font-extrabold text-lg tracking-tight text-slate-800 flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              Pendências
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">O que precisa da sua atenção</p>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.alertsPay.map((t: any) => (
              <div key={t.id} className="p-4 flex items-start gap-3">
                <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{t.description}</div>
                  <div className="text-[11px] text-muted-foreground">Venceu em {formatDateBR(t.due_date)}</div>
                </div>
                <span className="text-xs font-mono font-bold text-red-600">{brl(t.amount)}</span>
              </div>
            ))}
            {stats.alertsEvTomorrow.map((e: any) => (
              <div key={e.id} className="p-4 flex items-start gap-3">
                <CalendarCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">Evento amanhã — {e.clients?.name}</div>
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

// ===== COMPONENTES AUXILIARES =====

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: any;
  color:
    | "blue"
    | "indigo"
    | "purple"
    | "emerald"
    | "orange"
    | "green"
    | "cyan"
    | "teal"
    | "violet"
    | "fuchsia"
    | "rose"
    | "gray"
    | "sky"
    | "amber";
  subtitle?: string;
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    green: "bg-green-50 text-green-700 border-green-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    fuchsia: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const iconColor = {
    blue: "text-blue-600",
    indigo: "text-indigo-600",
    purple: "text-purple-600",
    emerald: "text-emerald-600",
    orange: "text-orange-600",
    green: "text-green-600",
    cyan: "text-cyan-600",
    teal: "text-teal-600",
    violet: "text-violet-600",
    fuchsia: "text-fuchsia-600",
    rose: "text-rose-600",
    gray: "text-gray-600",
    sky: "text-sky-600",
    amber: "text-amber-600",
  };

  return (
    <div className={cn("rounded-xl border p-4 shadow-sm transition-all hover:shadow-md", colorClasses[color])}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className={cn("size-5", iconColor[color])} />
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tighter">{value}</div>
      {subtitle && <div className="text-[10px] font-medium opacity-70 mt-1">{subtitle}</div>}
    </div>
  );
}

function FinanceCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: any;
  color: "emerald" | "amber" | "sky";
}) {
  const colors = {
    emerald: "bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200 text-emerald-800",
    amber: "bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200 text-amber-800",
    sky: "bg-gradient-to-br from-sky-50 to-sky-100/60 border-sky-200 text-sky-800",
  };

  const iconColors = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
  };

  return (
    <div className={cn("rounded-xl border p-5 shadow-sm transition-all hover:shadow-md", colors[color])}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className={cn("size-5", iconColors[color])} />
      </div>
      <div className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tighter">{value}</div>
    </div>
  );
}

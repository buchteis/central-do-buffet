import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, brlCompact, formatDateBR, formatDateFullBR } from "@/lib/format";
import { FINANCE_EVENT_STATUSES, computeFinanceTotals } from "@/lib/finance-logic";
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
  TrendingUp,
  TrendingDown,
  Building2,
} from "lucide-react";
import { Chatbot } from "@/components/Chatbot";
import { FeedbackPieCard } from "@/components/feedback/FeedbackPieCard";
import { UnifiedReviewsCard } from "@/components/reviews/UnifiedReviewsCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Central do Buffet" }] }),
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

// Cards de "Eventos" mostram apenas eventos ativos — realizados/concluídos/cancelados
// permanecem visíveis nas telas de Eventos, Orçamentos e Agenda, mas saem dos contadores.
const EXCLUDED_STATUSES = ["cancelado", "realizado", "concluido"];

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

  // Financeiro — usa exatamente a mesma regra do Financeiro (src/lib/finance-logic.ts)
  const transactionsData = useDashboardQuery("transactions-data", async () => {
    const { data: evts } = await supabase
      .from("events")
      .select("total_value, status")
      .in("status", FINANCE_EVENT_STATUSES as any);

    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, type, status, due_date");

    const totals = computeFinanceTotals(evts ?? [], txs ?? []);

    const vencidos =
      txs?.filter(
        (t) => t.type === "entrada" && t.status === "pendente" && t.due_date && t.due_date < today,
      ).length || 0;

    return {
      recebido: totals.recebido,
      despesasPagas: totals.saidasPagas,
      aReceber: totals.receber,
      saldo: totals.saldo,
      vencidos,
    };
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
    despesasPagas: transactionsData.data?.despesasPagas ?? 0,
    toReceive: transactionsData.data?.aReceber ?? 0,
    txOverdue: transactionsData.data?.vencidos ?? 0,
    faturamentoConcluido: quotesData.data?.concluidos ?? 0,
    ganhosPrevisiveis: quotesData.data?.previsiveis ?? 0,
    clientsCount: clientsCount.data ?? 0,
    newClients: newClients.data ?? 0,
    staffToday: staffToday.data ?? 0,
    employeesActive: employeesActive.data ?? 0,
    contractsPending: contractsPending.data ?? 0,
    packagesCount: packagesCount.data ?? 0,
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <FinanceCard label="Receita recebida" value={brl(stats.revenueReceived)} icon={TrendingUp} color="emerald" />
          <FinanceCard label="A receber" value={brl(stats.toReceive)} icon={Clock} color="amber" />
          <FinanceCard label="Despesas pagas" value={brl(stats.despesasPagas)} icon={TrendingDown} color="rose" />
          <FinanceCard
            label="Saldo atual"
            value={brl(stats.revenueReceived + stats.toReceive - stats.despesasPagas)}
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

      {/* ===== LINHA 4: OPERACIONAL ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <Building2 className="size-5 text-violet-600" />
            Operacional
          </h2>
          <Link
            to="/funcionarios"
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

        {/* ===== PENDÊNCIAS / ALERTAS ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 md:p-6 border-b border-slate-100">
              <h2 className="font-extrabold text-lg tracking-tight text-slate-800 flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-600" />
                Atenção / Pendências
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ações prioritárias para o seu dia</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Pagamentos em atraso:</span>
                <span className="font-bold text-red-600">{stats.txOverdue}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Contratos p/ assinar:</span>
                <span className="font-bold text-amber-600">{stats.contractsPending}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Orçamentos pendentes:</span>
                <span className="font-bold text-blue-600">{stats.qPend}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <Link
              to="/financeiro"
              className="w-full py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              Ir para gestão financeira <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ===== AVALIAÇÕES / NPS ===== */}
      <FeedbackPieCard />

      <UnifiedReviewsCard />

      <Chatbot />
    </div>
  );
}

// Componente Auxiliar para Cards Métricos
function MetricCard({ label, value, icon: Icon, color, subtitle }: any) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className={cn("p-2 rounded-xl text-white", `bg-${color}-500`)}>
          <Icon className="size-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-black tracking-tight text-slate-800">{value}</div>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// Componente Auxiliar para Cards Financeiros
function FinanceCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div className="space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className="text-2xl font-black tracking-tight text-slate-800">{value}</div>
      </div>
      <div className={cn("p-3 rounded-2xl text-white", `bg-${color}-500`)}>
        <Icon className="size-6" />
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  DollarSign,
  Users,
  FileText,
  UserCog,
  Package,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  ShieldCheck,
  Database,
} from "lucide-react";
import { useState } from "react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  head: () => ({ meta: [{ title: "Diagnóstico — Meu Churras" }] }),
  component: DiagnosticoPage,
});

function DiagnosticoPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);

  const { refetch, isLoading } = useQuery({
    queryKey: ["diagnostico"],
    queryFn: async () => {
      const results: any = {};

      // ==========================================
      // 1. EVENTOS
      // ==========================================
      const { data: events } = await supabase.from("events").select("status, event_date, total_value");

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const statusCount: Record<string, number> = {};
      let hoje = 0;
      let passado = 0;
      let futuro = 0;
      let faturamentoMes = 0;
      let faturamentoTotal = 0;

      const statusExcluidos = ["cancelado", "arquivado"];

      events?.forEach((e: any) => {
        statusCount[e.status] = (statusCount[e.status] || 0) + 1;
        const valor = Number(e.total_value) || 0;

        if (e.status !== "cancelado") {
          faturamentoTotal += valor;
          if (e.event_date >= monthStart) {
            faturamentoMes += valor;
          }
        }

        if (!statusExcluidos.includes(e.status)) {
          if (e.event_date === today) hoje++;
          else if (e.event_date < today) passado++;
          else futuro++;
        }
      });

      results.eventos = {
        total: events?.length || 0,
        porStatus: statusCount,
        hoje,
        passado,
        futuro,
        faturamentoMes,
        faturamentoTotal,
      };

      // ==========================================
      // 2. FINANCEIRO
      // ==========================================
      const { data: transactions } = await supabase
        .from("transactions")
        .select("type, status, amount, paid_date, due_date");

      let entradaPaga = 0;
      let entradaPendente = 0;
      let saidaPaga = 0;
      let saidaPendente = 0;
      let entradaPagaMes = 0;
      let entradaPendenteVencidas = 0;

      transactions?.forEach((t: any) => {
        const val = Number(t.amount) || 0;
        if (t.type === "entrada" && t.status === "pago") {
          entradaPaga += val;
          if (t.paid_date && t.paid_date >= monthStart) entradaPagaMes += val;
        }
        if (t.type === "entrada" && t.status === "pendente") {
          entradaPendente += val;
          if (t.due_date && t.due_date < today) entradaPendenteVencidas += val;
        }
        if (t.type === "saida" && t.status === "pago") saidaPaga += val;
        if (t.type === "saida" && t.status === "pendente") saidaPendente += val;
      });

      results.financeiro = {
        entradaPaga,
        entradaPendente,
        saidaPaga,
        saidaPendente,
        saldo: entradaPaga - saidaPaga,
        entradaPagaMes,
        entradaPendenteVencidas,
      };

      // ==========================================
      // 3. CLIENTES
      // ==========================================
      const { count: totalClientes } = await supabase.from("clients").select("id", { count: "exact", head: true });

      const { data: clientesNovos } = await supabase
        .from("clients")
        .select("id")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      results.clientes = {
        total: totalClientes || 0,
        novos30d: clientesNovos?.length || 0,
      };

      // ==========================================
      // 4. ORÇAMENTOS
      // ==========================================
      const { data: quotes } = await supabase.from("quotes").select("status, paid, total_value");

      let qPendentes = 0;
      let qAprovados = 0;
      let qPagos = 0;
      let valorOrcamentosPendentes = 0;

      quotes?.forEach((q: any) => {
        if (q.status === "novo" || q.status === "em_andamento") {
          qPendentes++;
          valorOrcamentosPendentes += Number(q.total_value) || 0;
        }
        if (q.status === "fechado") qAprovados++;
        if (q.paid === true) qPagos++;
      });

      results.orcamentos = {
        total: quotes?.length || 0,
        pendentes: qPendentes,
        aprovados: qAprovados,
        pagos: qPagos,
        valorOrcamentosPendentes,
        taxaConversao: quotes?.length > 0 ? Math.round((qAprovados / quotes.length) * 100) : 0,
      };

      // ==========================================
      // 5. PACOTES E FUNCIONÁRIOS
      // ==========================================
      const { count: totalPacotes } = await supabase.from("packages").select("id", { count: "exact", head: true });

      const { count: totalFuncionarios } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true });

      const { count: funcionariosAtivos } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("active", true);

      results.cadastros = {
        pacotes: totalPacotes || 0,
        funcionarios: totalFuncionarios || 0,
        funcionariosAtivos: funcionariosAtivos || 0,
      };

      // ==========================================
      // 6. INTEGRIDADE
      // ==========================================
      const { data: eventsWithClients } = await supabase.from("events").select("id, clients(id)");

      let eventosSemCliente = 0;
      eventsWithClients?.forEach((e: any) => {
        if (!e.clients) eventosSemCliente++;
      });

      const { data: eventsWithPackages } = await supabase.from("events").select("id, packages(id)");

      let eventosSemPacote = 0;
      eventsWithPackages?.forEach((e: any) => {
        if (!e.packages) eventosSemPacote++;
      });

      results.integridade = {
        eventosSemCliente,
        eventosSemPacote,
        totalEventos: eventsWithClients?.length || 0,
        integridadePercentual:
          eventsWithClients?.length > 0
            ? Math.round(
                ((eventsWithClients.length - eventosSemCliente - eventosSemPacote) / eventsWithClients.length) * 100,
              )
            : 100,
      };

      setData(results);
      return results;
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin size-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Carregando diagnóstico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-3">
              <ShieldCheck className="size-8 text-blue-600" />
              Diagnóstico do Sistema
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Verificação completa da saúde e desempenho do sistema</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Última atualização: {new Date().toLocaleTimeString()}</span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 text-sm font-medium"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              {refreshing ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <AdminCard title="Eventos" value={data?.eventos?.total || 0} icon={Calendar} color="blue" />
          <AdminCard title="Clientes" value={data?.clientes?.total || 0} icon={Users} color="green" />
          <AdminCard title="Orçamentos" value={data?.orcamentos?.total || 0} icon={FileText} color="amber" />
          <AdminCard title="Saldo" value={brl(data?.financeiro?.saldo || 0)} icon={DollarSign} color="emerald" />
          <AdminCard title="Pacotes" value={data?.cadastros?.pacotes || 0} icon={Package} color="purple" />
          <AdminCard title="Funcionários" value={data?.cadastros?.funcionarios || 0} icon={UserCog} color="violet" />
        </div>

        {/* LINHA 1: EVENTOS + FINANCEIRO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Calendar className="size-5 text-blue-600" />
              Eventos
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Hoje" value={data?.eventos?.hoje || 0} icon={Clock} color="blue" />
              <Stat label="Futuros" value={data?.eventos?.futuro || 0} icon={TrendingUp} color="green" />
              <Stat label="Passados" value={data?.eventos?.passado || 0} icon={TrendingDown} color="amber" />
              <Stat
                label="Faturamento (mês)"
                value={brl(data?.eventos?.faturamentoMes || 0)}
                icon={DollarSign}
                color="emerald"
              />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Distribuição por status
              </h4>
              <div className="flex flex-wrap gap-2">
                {data?.eventos?.porStatus &&
                  Object.entries(data.eventos.porStatus).map(([status, count]) => (
                    <span key={status} className="px-3 py-1 bg-slate-100 rounded-full text-xs font-medium">
                      {status}: {count}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <DollarSign className="size-5 text-emerald-600" />
              Financeiro
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Receita recebida"
                value={brl(data?.financeiro?.entradaPaga || 0)}
                icon={TrendingUp}
                color="emerald"
              />
              <Stat label="A receber" value={brl(data?.financeiro?.entradaPendente || 0)} icon={Clock} color="amber" />
              <Stat
                label="Despesas pagas"
                value={brl(data?.financeiro?.saidaPaga || 0)}
                icon={TrendingDown}
                color="rose"
              />
              <Stat label="Saldo" value={brl(data?.financeiro?.saldo || 0)} icon={DollarSign} color="blue" />
            </div>
            {data?.financeiro?.entradaPendenteVencidas > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="size-5" />
                <span>{brl(data.financeiro.entradaPendenteVencidas)} em pagamentos vencidos</span>
              </div>
            )}
          </div>
        </div>

        {/* LINHA 2: ORÇAMENTOS + CLIENTES + INTEGRIDADE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <FileText className="size-5 text-amber-600" />
              Orçamentos
            </h3>
            <div className="space-y-3">
              <Stat label="Pendentes" value={data?.orcamentos?.pendentes || 0} icon={Clock} color="amber" />
              <Stat label="Aprovados" value={data?.orcamentos?.aprovados || 0} icon={CheckCircle} color="green" />
              <Stat
                label="Convertidos"
                value={`${data?.orcamentos?.taxaConversao || 0}%`}
                icon={TrendingUp}
                color="blue"
              />
              <Stat
                label="Valor pendente"
                value={brl(data?.orcamentos?.valorOrcamentosPendentes || 0)}
                icon={DollarSign}
                color="amber"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Users className="size-5 text-green-600" />
              Clientes
            </h3>
            <div className="space-y-3">
              <Stat label="Total" value={data?.clientes?.total || 0} icon={Users} color="blue" />
              <Stat label="Novos (30d)" value={data?.clientes?.novos30d || 0} icon={TrendingUp} color="green" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Database className="size-5 text-purple-600" />
              Integridade
            </h3>
            <div className="space-y-3">
              <Stat
                label="Integridade geral"
                value={`${data?.integridade?.integridadePercentual || 0}%`}
                icon={ShieldCheck}
                color={data?.integridade?.integridadePercentual >= 90 ? "green" : "red"}
              />
              <Stat
                label="Eventos sem cliente"
                value={data?.integridade?.eventosSemCliente || 0}
                icon={AlertTriangle}
                color={data?.integridade?.eventosSemCliente > 0 ? "red" : "green"}
              />
              <Stat
                label="Eventos sem pacote"
                value={data?.integridade?.eventosSemPacote || 0}
                icon={AlertTriangle}
                color={data?.integridade?.eventosSemPacote > 0 ? "red" : "green"}
              />
            </div>
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="text-center text-xs text-muted-foreground border-t border-slate-200 pt-6">
          <p>Diagnóstico · Meu Churras · {new Date().toLocaleDateString()}</p>
          <p className="mt-1">
            {data?.integridade?.integridadePercentual >= 90 ? (
              <span className="text-emerald-600">✅ Sistema saudável</span>
            ) : data?.integridade?.integridadePercentual >= 70 ? (
              <span className="text-amber-600">⚠️ Algumas correções são recomendadas</span>
            ) : (
              <span className="text-red-600">🔴 Ações corretivas necessárias</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================

function AdminCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <div
      className={cn(
        "rounded-xl p-4 border text-center",
        colors[color as keyof typeof colors] || "bg-slate-50 text-slate-700",
      )}
    >
      <Icon className="size-5 mx-auto mb-1 opacity-80" />
      <div className="text-2xl font-extrabold tracking-tighter">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">{title}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}) {
  const colors = {
    blue: "text-blue-700 bg-blue-50",
    green: "text-green-700 bg-green-50",
    amber: "text-amber-700 bg-amber-50",
    emerald: "text-emerald-700 bg-emerald-50",
    rose: "text-rose-700 bg-rose-50",
    red: "text-red-700 bg-red-50",
    purple: "text-purple-700 bg-purple-50",
    violet: "text-violet-700 bg-violet-50",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border",
        colors[color as keyof typeof colors] || "bg-slate-50 text-slate-700",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium opacity-80">{label}</div>
        <div className="text-xl font-extrabold tracking-tighter">{value}</div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

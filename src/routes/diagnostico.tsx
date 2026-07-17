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

// Função utilitária para concatenação de classes CSS
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ==========================================
// INTERFACES CONSOLIDADAS (Sem duplicações)
// ==========================================

interface DBEvent {
  id: string;
  status: string;
  event_date: string;
  total_value: number | string | null;
  clients?: { id: string } | null;
  packages?: { id: string } | null;
}

interface DBTransaction {
  type: string;
  status: string;
  amount: number | string | null;
  paid_date: string | null;
  due_date: string | null;
}

interface DBQuote {
  status: string;
  paid: boolean;
  total_value: number | string | null;
}

interface DiagnosticoResults {
  eventos: {
    total: number;
    porStatus: Record<string, number>;
    hoje: number;
    passado: number;
    futuro: number;
    faturamentoMes: number;
    faturamentoTotal: number;
  };
  financeiro: {
    entradaPaga: number;
    entradaPendente: number;
    saidaPaga: number;
    saidaPendente: number;
    saldo: number;
    entradaPagaMes: number;
    entradaPendenteVencidas: number;
  };
  clientes: {
    total: number;
    novos30d: number;
  };
  orcamentos: {
    total: number;
    pendentes: number;
    aprovados: number;
    pagos: number;
    valorOrcamentosPendentes: number;
    taxaConversao: number;
  };
  cadastros: {
    pacotes: number;
    funcionarios: number;
    funcionariosAtivos: number;
  };
  integridade: {
    eventosSemCliente: number;
    eventosSemPacote: number;
    totalEventos: number;
    integridadePercentual: number;
  };
}

// ==========================================
// ROTA E COMPONENTE PRINCIPAL
// ==========================================

export const Route = createFileRoute("/diagnostico")({
  head: () => ({ meta: [{ title: "Diagnóstico — Meu Churras" }] }),
  component: DiagnosticoPage,
});

function DiagnosticoPage() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery<DiagnosticoResults>({
    queryKey: ["diagnostico"],
    queryFn: async () => {
      const results: DiagnosticoResults = {
        eventos: { total: 0, porStatus: {}, hoje: 0, passado: 0, futuro: 0, faturamentoMes: 0, faturamentoTotal: 0 },
        financeiro: { entradaPaga: 0, entradaPendente: 0, saidaPaga: 0, saidaPendente: 0, saldo: 0, entradaPagaMes: 0, entradaPendenteVencidas: 0 },
        clientes: { total: 0, novos30d: 0 },
        orcamentos: { total: 0, pendentes: 0, aprovados: 0, pagos: 0, valorOrcamentosPendentes: 0, taxaConversao: 0 },
        cadastros: { pacotes: 0, funcionarios: 0, funcionariosAtivos: 0 },
        integridade: { eventosSemCliente: 0, eventosSemPacote: 0, totalEventos: 0, integridadePercentual: 100 },
      };

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      // 1. EVENTOS
      const { data: events } = await supabase
        .from("events")
        .select("status, event_date, total_value");

      if (events) {
        const statusExcluidos = ["cancelado", "arquivado"];
        events.forEach((e: any) => {
          const event = e as DBEvent;
          results.eventos.porStatus[event.status] = (results.eventos.porStatus[event.status] || 0) + 1;
          const valor = Number(event.total_value) || 0;

          if (event.status !== "cancelado") {
            results.eventos.faturamentoTotal += valor;
            if (event.event_date >= monthStart) {
              results.eventos.faturamentoMes += valor;
            }
          }

          if (!statusExcluidos.includes(event.status)) {
            if (event.event_date === today) results.eventos.hoje++;
            else if (event.event_date < today) results.eventos.passado++;
            else results.eventos.futuro++;
          }
        });
        results.eventos.total = events.length;
      }

      // 2. FINANCEIRO
      const { data: transactions } = await supabase
        .from("transactions")
        .select("type, status, amount, paid_date, due_date");

      if (transactions) {
        transactions.forEach((t: any) => {
          const trans = t as DBTransaction;
          const val = Number(trans.amount) || 0;
          if (trans.type === "entrada" && trans.status === "pago") {
            results.financeiro.entradaPaga += val;
            if (trans.paid_date && trans.paid_date >= monthStart) results.financeiro.entradaPagaMes += val;
          }
          if (trans.type === "entrada" && trans.status === "pendente") {
            results.financeiro.entradaPendente += val;
            if (trans.due_date && trans.due_date < today) results.financeiro.entradaPendenteVencidas += val;
          }
          if (trans.type === "saida" && trans.status === "pago") results.financeiro.saidaPaga += val;
          if (trans.type === "saida" && trans.status === "pendente") results.financeiro.saidaPendente += val;
        });
        results.financeiro.saldo = results.financeiro.entradaPaga - results.financeiro.saidaPaga;
      }

      // 3. CLIENTES
      const { count: totalClientes } = await supabase.from("clients").select("id", { count: "exact", head: true });
      const { data: clientesNovos } = await supabase.from("clients").select("id").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      results.clientes.total = totalClientes || 0;
      results.clientes.novos30d = clientesNovos?.length || 0;

      // 4. ORÇAMENTOS
      const { data: quotes } = await supabase.from("quotes").select("status, paid, total_value");

      if (quotes) {
        quotes.forEach((q: any) => {
          const quote = q as DBQuote;
          if (quote.status === "novo" || quote.status === "em_andamento") {
            results.orcamentos.pendentes++;
            results.orcamentos.valorOrcamentosPendentes += Number(quote.total_value) || 0;
          }
          if (quote.status === "fechado") results.orcamentos.aprovados++;
          if (quote.paid === true) results.orcamentos.pagos++;
        });
        results.orcamentos.total = quotes.length;
        results.orcamentos.taxaConversao = quotes.length > 0 ? Math.round((results.orcamentos.aprovados / quotes.length) * 100) : 0;
      }

      // 5. PACOTES E FUNCIONÁRIOS
      const { count: totalPacotes } = await supabase.from("packages").select("id", { count: "exact", head: true });
      const { count: totalFuncionarios } = await supabase.from("employees").select("id", { count: "exact", head: true });
      const { count: funcionariosAtivos } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("active", true);

      results.cadastros.pacotes = totalPacotes || 0;
      results.cadastros.funcionarios = totalFuncionarios || 0;
      results.cadastros.funcionariosAtivos = funcionariosAtivos || 0;

      // 6. INTEGRIDADE
      const { data: eventsWithClients } = await supabase.from("events").select("id, clients(id)");
      const { data: eventsWithPackages } = await supabase.from("events").select("id, packages(id)");

      if (eventsWithClients) {
        const idsComProblema = new Set<string>();
        eventsWithClients.forEach((e: any) => {
          if (!e.clients) {
            results.integridade.eventosSemCliente++;
            idsComProblema.add(e.id);
          }
        });
        eventsWithPackages?.forEach((e: any) => {
          if (!e.packages) {
            results.integridade.eventosSemPacote++;
            idsComProblema.add(e.id);
          }
        });
        results.integridade.totalEventos = eventsWithClients.length;
        results.integridade.integridadePercentual = eventsWithClients.length > 0
          ? Math.round(((eventsWithClients.length - idsComProblema.size) / eventsWithClients.length) * 100)
          : 100;
      }

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
            <p className="text-sm text-muted-foreground mt-1">
              Verificação completa da saúde e desempenho do sistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Última atualização: {new Date().toLocaleTimeString()}
            </span>
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
          <AdminCard title="Eventos" value={data?.eventos.total ?? 0} icon={Calendar} color="blue" />
          <AdminCard title="Clientes" value={data?.clientes.total ?? 0} icon={Users} color="green" />
          <AdminCard title="Orçamentos" value={data?.orcamentos.total ?? 0} icon={FileText} color="amber" />
          <AdminCard title="Saldo" value={brl(data?.financeiro.saldo ?? 0)} icon={DollarSign} color="emerald" />
          <AdminCard title="Pacotes" value={data?.cadastros.pacotes ?? 0} icon={Package} color="purple" />
          <AdminCard title="Funcionários" value={data?.cadastros.funcionarios ?? 0} icon={UserCog} color="violet" />
        </div>

        {/* LINHA 1: EVENTOS + FINANCEIRO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Calendar className="size-5 text-blue-600" />
              Eventos
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Hoje" value={data?.eventos.hoje ?? 0} icon={Clock} color="blue" />
              <Stat label="Futuros" value={data?.eventos.futuro ?? 0} icon={TrendingUp} color="green" />
              <Stat label="Passados" value={data?.eventos.passado ?? 0} icon={TrendingDown} color="amber" />
              <Stat label="Faturamento (mês)" value={brl(data?.eventos.faturamentoMes ?? 0)} icon={DollarSign} color="emerald" />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Distribuição por status</h4>
              <div className="flex flex-wrap gap-2">
                {data?.eventos.porStatus && Object.entries(data.eventos.porStatus).map(([status, count]) => (
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
              <Stat label="Receita recebida" value={brl(data?.financeiro.entradaPaga ?? 0)} icon={TrendingUp} color="emerald" />
              <Stat label="A receber" value={brl(data?.financeiro.entradaPendente ?? 0)} icon={Clock} color="amber" />
              <Stat label="Despesas pagas" value={brl(data?.financeiro.saidaPaga ?? 0)} icon={TrendingDown} color="rose" />
              <Stat label="Saldo" value={brl(data?.financeiro.saldo ?? 0)} icon={DollarSign} color="blue" />
            </div>
            {(data?.financeiro.entradaPendenteVencidas ?? 0) > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="size-5" />
                <span>{brl(data!.financeiro.entradaPendenteVencidas)} em pagamentos vencidos</span>
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
              <Stat label="Pendentes" value={data?.orcamentos.pendentes ?? 0} icon={Clock} color="amber" />
              <Stat label="Aprovados" value={data?.orcamentos.aprovados ?? 0} icon={CheckCircle} color="green" />
              <Stat label="Convertidos" value={`${data?.orcamentos.taxaConversao ?? 0}%`} icon={TrendingUp} color="blue" />
              <Stat label="Valor pendente" value={brl(data?.orcamentos.valorOrcamentosPendentes ?? 0)} icon={DollarSign} color="amber" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Users className="size-5 text-green-600" />
              Clientes
            </h3>
            <div className="space-y-3">
              <Stat label="Total" value={data?.clientes.total ?? 0} icon={Users} color="blue" />
              <Stat label="Novos (30d)" value={data?.clientes.novos30d ?? 0} icon={TrendingUp} color="green" />
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
                value={`${data?.integridade.integridadePercentual ?? 0}%`}
                icon={ShieldCheck}
                color={(data?.integridade.integridadePercentual ?? 0) >= 90 ? "green" : "red"}
              />
              <Stat
                label="Eventos sem cliente"
                value={data?.integridade.eventosSemCliente ?? 0}
                icon={AlertTriangle}
                color={(data?.integridade.eventosSemCliente ?? 0) > 0 ? "red" : "green"}
              />
              <Stat
                label="Eventos sem pacote"
                value={data?.integridade.eventosSemPacote ?? 0}
                icon={AlertTriangle}
                color={(data?.integridade.eventosSemPacote ?? 0) > 0 ? "red" : "green"}
              />
            </div>
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="text-center text-xs text-muted-foreground border-t border-slate-200 pt-6">
          <p>Diagnóstico · Meu Churras · {new Date().toLocaleDateString()}</p>
          <p className="mt-1">
            {(data?.integridade.integridadePercentual ?? 0) >= 90 ? (
              <span className="text-emerald-600">✅ Sistema saudável</span>
            ) : (data?.integridade.integridadePercentual ?? 0) >= 70 ? (
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

function AdminCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <div className={cn("rounded-xl p-4 border text-center", colors[color] || "bg-slate-50 text-slate-700")}>
      <Icon className="size-5 mx-auto mb-1 opacity-80" />
      <div className="text-2xl font-extrabold tracking-tighter">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">{title}</div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  const colors: Record<string, string> = {
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
    <div className={cn("flex items-center gap-3 p-3 rounded-xl border", colors[color] || "bg-slate-50 text-slate-700")}>
      <Icon className="size-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium opacity-80">{label}</div>
        <div className="text-xl font-extrabold tracking-tighter">{value}</div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  head: () => ({ meta: [{ title: "Diagnóstico — Meu Churras" }] }),
  component: DiagnosticoPage,
});

function DiagnosticoPage() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["diagnostico"],
    queryFn: async () => {
      const results: any = {};

      // ==========================================
      // 1. CONTAGEM DE EVENTOS POR STATUS
      // ==========================================
      const { data: events } = await supabase
        .from("events")
        .select("status, event_date")
        .not("status", "in", '("cancelado")');

      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      const statusCount: Record<string, number> = {};
      let hoje = 0;
      let passado = 0;

      events?.forEach((e: any) => {
        statusCount[e.status] = (statusCount[e.status] || 0) + 1;
        if (e.event_date === today && e.status !== "realizado" && e.status !== "concluido") {
          hoje++;
        }
        if (e.event_date < today && e.status !== "realizado" && e.status !== "concluido") {
          passado++;
        }
      });

      results.eventos = {
        total: events?.length || 0,
        porStatus: statusCount,
        hoje,
        passado,
      };

      // ==========================================
      // 2. FINANCEIRO
      // ==========================================
      const { data: transactions } = await supabase
        .from("transactions")
        .select("type, status, amount");

      let entradaPaga = 0;
      let entradaPendente = 0;
      let saidaPaga = 0;
      let saidaPendente = 0;

      transactions?.forEach((t: any) => {
        const val = Number(t.amount) || 0;
        if (t.type === "entrada" && t.status === "pago") entradaPaga += val;
        if (t.type === "entrada" && t.status === "pendente") entradaPendente += val;
        if (t.type === "saida" && t.status === "pago") saidaPaga += val;
        if (t.type === "saida" && t.status === "pendente") saidaPendente += val;
      });

      results.financeiro = {
        entradaPaga,
        entradaPendente,
        saidaPaga,
        saidaPendente,
        saldo: entradaPaga - saidaPaga,
        totalEntradas: transactions?.filter((t: any) => t.type === "entrada").length || 0,
        totalSaidas: transactions?.filter((t: any) => t.type === "saida").length || 0,
      };

      // ==========================================
      // 3. CLIENTES
      // ==========================================
      const { count: totalClientes } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true });

      const { count: clientesComEventos } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .in("id", (await supabase.from("events").select("client_id")).data?.map((e: any) => e.client_id) || []);

      results.clientes = {
        total: totalClientes || 0,
        comEventos: clientesComEventos || 0,
        semEventos: (totalClientes || 0) - (clientesComEventos || 0),
      };

      // ==========================================
      // 4. ORÇAMENTOS
      // ==========================================
      const { data: quotes } = await supabase
        .from("quotes")
        .select("status, paid");

      let qPendentes = 0;
      let qAprovados = 0;
      let qPagos = 0;
      let totalOrcamentos = quotes?.length || 0;

      quotes?.forEach((q: any) => {
        if (q.status === "novo" || q.status === "em_andamento") qPendentes++;
        if (q.status === "fechado") qAprovados++;
        if (q.paid === true) qPagos++;
      });

      results.orcamentos = {
        total: totalOrcamentos,
        pendentes: qPendentes,
        aprovados: qAprovados,
        pagos: qPagos,
        taxaConversao: totalOrcamentos > 0 ? Math.round((qAprovados / totalOrcamentos) * 100) : 0,
      };

      // ==========================================
      // 5. FUNCIONÁRIOS
      // ==========================================
      const { count: totalFuncionarios } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true });

      const { count: funcionariosAtivos } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("active", true);

      results.funcionarios = {
        total: totalFuncionarios || 0,
        ativos: funcionariosAtivos || 0,
        inativos: (totalFuncionarios || 0) - (funcionariosAtivos || 0),
      };

      // ==========================================
      // 6. INTEGRIDADE DOS DADOS
      // ==========================================
      // Verifica eventos com clientes inexistentes
      const { data: eventsWithClients } = await supabase
        .from("events")
        .select("id, clients(id)");

      let eventosSemCliente = 0;
      eventsWithClients?.forEach((e: any) => {
        if (!e.clients) eventosSemCliente++;
      });

      // Verifica eventos com pacotes inexistentes
      const { data: eventsWithPackages } = await supabase
        .from("events")
        .select("id, packages(id)");

      let eventosSemPacote = 0;
      eventsWithPackages?.forEach((e: any) => {
        if (!e.packages) eventosSemPacote++;
      });

      results.integridade = {
        eventosSemCliente,
        eventosSemPacote,
        totalEventos: eventsWithClients?.length || 0,
        integridadePercentual: eventsWithClients?.length > 0 
          ? Math.round(((eventsWithClients.length - eventosSemCliente - eventosSemPacote) / eventsWithClients.length) * 100)
          : 100,
      };

      return results;
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const results = data;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">🧪 Diagnóstico do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verificação completa de integridade e consistência dos dados
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          {refreshing ? "Verificando..." : "Atualizar"}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin size-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Carregando diagnóstico...</p>
        </div>
      ) : results ? (
        <>
          {/* ========================================== */}
          {/* SEÇÃO 1: EVENTOS */}
          {/* ========================================== */}
          <Section title="📅 Eventos">
            <Metric label="Total de eventos" value={results.eventos.total} />
            <Metric label="Eventos de hoje" value={results.eventos.hoje} status={results.eventos.hoje > 0 ? "warning" : "success"} />
            <Metric label="Eventos passados (não concluídos)" value={results.eventos.passado} status={results.eventos.passado > 0 ? "warning" : "success"} />
            <div className="col-span-full">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Distribuição por status</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(results.eventos.porStatus).map(([status, count]) => (
                  <span key={status} className="px-3 py-1 bg-slate-100 rounded-full text-xs font-medium">
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          {/* ========================================== */}
          {/* SEÇÃO 2: FINANCEIRO */}
          {/* ========================================== */}
          <Section title="💰 Financeiro">
            <Metric label="Entradas pagas" value={brl(results.financeiro.entradaPaga)} status="success" />
            <Metric label="Entradas a receber" value={brl(results.financeiro.entradaPendente)} status={results.financeiro.entradaPendente > 0 ? "warning" : "success"} />
            <Metric label="Saídas pagas" value={brl(results.financeiro.saidaPaga)} status="info" />
            <Metric label="Saídas pendentes" value={brl(results.financeiro.saidaPendente)} status={results.financeiro.saidaPendente > 0 ? "warning" : "success"} />
            <Metric label="Saldo atual" value={brl(results.financeiro.saldo)} status={results.financeiro.saldo >= 0 ? "success" : "danger"} />
            <Metric label="Total de entradas" value={results.financeiro.totalEntradas} />
            <Metric label="Total de saídas" value={results.financeiro.totalSaidas} />
          </Section>

          {/* ========================================== */}
          {/* SEÇÃO 3: CLIENTES */}
          {/* ========================================== */}
          <Section title="👥 Clientes">
            <Metric label="Total de clientes" value={results.clientes.total} />
            <Metric label="Clientes com eventos" value={results.clientes.comEventos} status={results.clientes.comEventos > 0 ? "success" : "warning"} />
            <Metric label="Clientes sem eventos" value={results.clientes.semEventos} status={results.clientes.semEventos > 0 ? "warning" : "success"} />
          </Section>

          {/* ========================================== */}
          {/* SEÇÃO 4: ORÇAMENTOS */}
          {/* ========================================== */}
          <Section title="📄 Orçamentos">
            <Metric label="Total de orçamentos" value={results.orcamentos.total} />
            <Metric label="Pendentes" value={results.orcamentos.pendentes} status={results.orcamentos.pendentes > 0 ? "warning" : "success"} />
            <Metric label="Aprovados" value={results.orcamentos.aprovados} status="success" />
            <Metric label="Pagos" value={results.orcamentos.pagos} status="success" />
            <Metric label="Taxa de conversão" value={`${results.orcamentos.taxaConversao}%`} status={results.orcamentos.taxaConversao > 50 ? "success" : "warning"} />
          </Section>

          {/* ========================================== */}
          {/* SEÇÃO 5: FUNCIONÁRIOS */}
          {/* ========================================== */}
          <Section title="👨‍🍳 Funcionários">
            <Metric label="Total de funcionários" value={results.funcionarios.total} />
            <Metric label="Ativos" value={results.funcionarios.ativos} status="success" />
            <Metric label="Inativos" value={results.funcionarios.inativos} status={results.funcionarios.inativos > 0 ? "warning" : "success"} />
          </Section>

          {/* ========================================== */}
          {/* SEÇÃO 6: INTEGRIDADE */}
          {/* ========================================== */}
          <Section title="🔗 Integridade dos Dados">
            <Metric label="Eventos sem cliente" value={results.integridade.eventosSemCliente} status={results.integridade.eventosSemCliente > 0 ? "danger" : "success"} />
            <Metric label="Eventos sem pacote" value={results.integridade.eventosSemPacote} status={results.integridade.eventosSemPacote > 0 ? "danger" : "success"} />
            <Metric label="Integridade geral" value={`${results.integridade.integridadePercentual}%`} status={results.integridade.integridadePercentual >= 90 ? "success" : "danger"} />
          </Section>

          {/* Resumo Geral */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <CheckCircle className="size-5 text-green-600" />
              Resumo do Diagnóstico
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div className="bg-white rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {results.integridade.integridadePercentual}%
                </div>
                <div className="text-xs text-muted-foreground">Integridade geral</div>
              </div>
              <div className="bg-white rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {results.eventos.total}
                </div>
                <div className="text-xs text-muted-foreground">Total de eventos</div>
              </div>
              <div className="bg-white rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {brl(results.financeiro.saldo)}
                </div>
                <div className="text-xs text-muted-foreground">Saldo atual</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum dado encontrado. Execute a verificação.
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}

function Metric({ 
  label, 
  value, 
  status = "info" 
}: { 
  label: string; 
  value: string | number; 
  status?: "success" | "warning" | "danger" | "info";
}) {
  const colors = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  };

  const icons = {
    success: <CheckCircle className="size-4 text-emerald-500" />,
    warning: <AlertTriangle className="size-4 text-amber-500" />,
    danger: <XCircle className="size-4 text-red-500" />,
    info: <CheckCircle className="size-4 text-blue-500" />,
  };

  return (
    <div className={cn("rounded-xl border p-4", colors[status])}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        {icons[status]}
      </div>
      <div className="mt-1 text-xl font-extrabold tracking-tighter">{value}</div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

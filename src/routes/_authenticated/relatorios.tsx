import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { brl } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CalendarCheck,
  BarChart3,
  PieChart as PieChartIcon,
  ShoppingCart,
  FileSpreadsheet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function RelatoriosPage() {
  const { tenantId, isSuperAdmin } = useTenantAccess();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [generatingPO, setGeneratingPO] = useState(false);

  // Busca de Eventos Reais do Supabase
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["relatorios-events-route", tenantId, selectedYear],
    enabled: !!tenantId || isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("events")
        .select("id, event_date, total_value, status")
        .neq("status", "cancelado");

      if (tenantId && !isSuperAdmin) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Busca de itens em falta no Estoque para a Ordem de Compra
  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["relatorios-low-stock", tenantId],
    enabled: !!tenantId || isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("stock_items")
        .select("*");

      if (tenantId && !isSuperAdmin) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      
      // Filtra itens em falta ou abaixo da quantidade mínima
      return (data ?? []).filter(
        (item: any) => Number(item.quantity ?? 0) <= Number(item.min_quantity ?? 0)
      );
    },
  });

  // Função para Gerar a Ordem de Compra dos itens em falta
  const handleGerarOrdemCompra = async () => {
    try {
      setGeneratingPO(true);
      if (lowStockItems.length === 0) {
        toast.info("Nenhum item em falta ou com estoque crítico no momento!");
        return;
      }

      // Gera arquivo TXT/CSV para download rápido da Ordem de Compra
      const headers = "Item;Quantidade Atual;Quantidade Mínima;Sugestão de Compra\n";
      const rows = lowStockItems
        .map((item: any) => {
          const qty = Number(item.quantity ?? 0);
          const minQty = Number(item.min_quantity ?? 0);
          const sugestao = Math.max(minQty * 2 - qty, 10);
          return `"${item.name ?? "Item"}";${qty};${minQty};${sugestao}`;
        })
        .join("\n");

      const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Ordem_de_Compra_Estoque_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Ordem de compra gerada com ${lowStockItems.length} item(ns) em falta!`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar ordem de compra");
    } finally {
      setGeneratingPO(false);
    }
  };

  // Agrupamento dos Gráficos e Comparativos
  const analytics = useMemo(() => {
    const monthlyData = MONTH_NAMES.map((name, index) => ({
      name,
      monthNum: index + 1,
      totalValue: 0,
      eventCount: 0,
    }));

    const statusMap: Record<string, number> = {
      confirmado: 0,
      agendado: 0,
      realizado: 0,
      outros: 0,
    };

    if (Array.isArray(events)) {
      events.forEach((ev: any) => {
        const st = (ev.status ?? "outros").toLowerCase();
        if (statusMap[st] !== undefined) {
          statusMap[st] += 1;
        } else {
          statusMap.outros += 1;
        }

        if (!ev?.event_date) return;
        const dateParts = String(ev.event_date).split("-");
        if (dateParts.length < 3) return;

        const year = Number(dateParts[0]);
        const monthIdx = Number(dateParts[1]) - 1;

        if (year === selectedYear && monthIdx >= 0 && monthIdx < 12) {
          monthlyData[monthIdx].totalValue += Number(ev.total_value ?? 0);
          monthlyData[monthIdx].eventCount += 1;
        }
      });
    }

    const currentMonthIdx = new Date().getMonth();
    const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;

    const currentMonth = monthlyData[currentMonthIdx] ?? { totalValue: 0, eventCount: 0 };
    const prevMonth = monthlyData[prevMonthIdx] ?? { totalValue: 0, eventCount: 0 };

    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const pieData = [
      { name: "Confirmados", value: statusMap.confirmado, color: "#10b981" },
      { name: "Agendados", value: statusMap.agendado, color: "#3b82f6" },
      { name: "Realizados", value: statusMap.realizado, color: "#8b5cf6" },
      { name: "Outros", value: statusMap.outros, color: "#f59e0b" },
    ].filter((item) => item.value > 0);

    return {
      monthlyData,
      currentMonth,
      prevMonth,
      valueGrowth: calcGrowth(currentMonth.totalValue, prevMonth.totalValue),
      countGrowth: calcGrowth(currentMonth.eventCount, prevMonth.eventCount),
      currentMonthName: MONTH_NAMES[currentMonthIdx] ?? "",
      prevMonthName: MONTH_NAMES[prevMonthIdx] ?? "",
      pieData,
    };
  }, [events, selectedYear]);

  if (loadingEvents) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        Carregando relatórios e gráficos...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Topo: Título + Botão Ordem de Compra + Seletor de Ano */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" /> Relatórios & Métricas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Análise em tempo real do faturamento e fluxo de eventos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* BOTÃO GERAR ORDEM DE COMPRA BASEADO EM ITENS EM FALTA */}
          <button
            onClick={handleGerarOrdemCompra}
            disabled={generatingPO}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold shadow-sm transition-all hover:bg-orange-700 disabled:opacity-50"
            title="Gerar ordem de compra dos itens com estoque crítico ou zerado"
          >
            <ShoppingCart className="size-4" />
            {generatingPO ? "Gerando..." : `Ordem de Compra (${lowStockItems.length} em falta)`}
          </button>

          {/* Seletor de Ano */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-9 px-3 rounded-xl border border-border bg-card text-xs font-bold shadow-sm focus:outline-none"
          >
            <option value={2025}>Ano 2025</option>
            <option value={2026}>Ano 2026</option>
            <option value={2027}>Ano 2027</option>
          </select>
        </div>
      </div>

      {/* Cards de Comparativo Mês Atual vs Anterior */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Receita */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="size-4 text-emerald-600" /> Receita ({analytics.currentMonthName} vs {analytics.prevMonthName})
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                analytics.valueGrowth >= 0
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-rose-500/10 text-rose-700"
              }`}
            >
              {analytics.valueGrowth >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {analytics.valueGrowth > 0 ? `+${analytics.valueGrowth}%` : `${analytics.valueGrowth}%`}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <div>
              <p className="text-2xl font-black text-foreground">{brl(analytics.currentMonth.totalValue)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Mês Atual ({analytics.currentMonthName})</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-muted-foreground">{brl(analytics.prevMonth.totalValue)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Mês Anterior ({analytics.prevMonthName})</p>
            </div>
          </div>
        </div>

        {/* Quantidade de Eventos */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <CalendarCheck className="size-4 text-primary" /> Eventos ({analytics.currentMonthName} vs {analytics.prevMonthName})
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                analytics.countGrowth >= 0
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-rose-500/10 text-rose-700"
              }`}
            >
              {analytics.countGrowth >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {analytics.countGrowth > 0 ? `+${analytics.countGrowth}%` : `${analytics.countGrowth}%`}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <div>
              <p className="text-2xl font-black text-foreground">{analytics.currentMonth.eventCount} eventos</p>
              <p className="text-[11px] text-muted-foreground font-medium">Mês Atual ({analytics.currentMonthName})</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-muted-foreground">{analytics.prevMonth.eventCount} eventos</p>
              <p className="text-[11px] text-muted-foreground font-medium">Mês Anterior ({analytics.prevMonthName})</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico 1: Faturamento Mensal (Barras) */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Faturamento por Mês em {selectedYear}
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `R$${value / 1000}k`}
              />
              <Tooltip
                formatter={(value: any) => [brl(Number(value)), "Faturamento"]}
                contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }}
              />
              <Bar dataKey="totalValue" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid Inferior de Gráficos (Linha e Pizza) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de Linha: Evolução dos Eventos */}
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Volume de Eventos por Mês
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => [`${value} evento(s)`, "Total"]}
                  contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }}
                />
                <Line type="monotone" dataKey="eventCount" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Pizza: Distribuição por Status */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <PieChartIcon className="size-4 text-primary" /> Distribuição de Eventos
          </h3>
          <div className="h-60 w-full flex items-center justify-center">
            {analytics.pieData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados suficientes</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {analytics.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} eventos`, "Quantidade"]}
                    contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

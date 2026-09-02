import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { TrendingUp, TrendingDown, Calendar, DollarSign, CalendarCheck } from "lucide-react";
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
} from "recharts";

type Props = { tenantId: string | null; isSuperAdmin: boolean };

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function RelatoriosEvents({ tenantId, isSuperAdmin }: Props) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Busca os eventos reais do banco de dados
  const { data: events = [] } = useQuery({
    queryKey: ["relatorios-events", tenantId, selectedYear],
    enabled: !!tenantId || isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("events")
        .select("id, event_date, total_value, status, created_at")
        .neq("status", "cancelado");

      if (tenantId && !isSuperAdmin) q = q.eq("tenant_id", tenantId);
      return (await q).data ?? [];
    },
  });

  // Agrupa os dados mensais para os gráficos e comparativos
  const analytics = useMemo(() => {
    const monthlyData = MONTH_NAMES.map((name, index) => ({
      name,
      monthNum: index + 1,
      totalValue: 0,
      eventCount: 0,
    }));

    events.forEach((ev: any) => {
      if (!ev.event_date) return;
      const date = new Date(ev.event_date + "T00:00:00");
      if (date.getFullYear() === selectedYear) {
        const m = date.getMonth();
        monthlyData[m].totalValue += Number(ev.total_value ?? 0);
        monthlyData[m].eventCount += 1;
      }
    });

    // Identifica o mês atual e o mês anterior
    const currentMonthIdx = new Date().getMonth();
    const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;

    const currentMonth = monthlyData[currentMonthIdx];
    const prevMonth = monthlyData[prevMonthIdx];

    // Cálculo de percentual de variação
    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const valueGrowth = calcGrowth(currentMonth.totalValue, prevMonth.totalValue);
    const countGrowth = calcGrowth(currentMonth.eventCount, prevMonth.eventCount);

    return {
      monthlyData,
      currentMonth,
      prevMonth,
      valueGrowth,
      countGrowth,
      currentMonthName: MONTH_NAMES[currentMonthIdx],
      prevMonthName: MONTH_NAMES[prevMonthIdx],
    };
  }, [events, selectedYear]);

  return (
    <div className="space-y-6">
      {/* Topo do Relatório */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight">Relatório de Desempenho</h2>
          <p className="text-xs text-muted-foreground">Comparativo de eventos e faturamento do período.</p>
        </div>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="h-8 px-3 rounded-lg border border-border bg-background text-xs font-bold"
        >
          <option value={2025}>Ano 2025</option>
          <option value={2026}>Ano 2026</option>
          <option value={2027}>Ano 2027</option>
        </select>
      </div>

      {/* Cards de Comparativo: Mês Atual vs Mês Anterior */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Faturamento */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="size-4 text-emerald-600" /> Receita ({analytics.currentMonthName} vs {analytics.prevMonthName})
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                analytics.valueGrowth >= 0
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-rose-500/10 text-rose-700"
              }`}
            >
              {analytics.valueGrowth >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {analytics.valueGrowth > 0 ? `+${analytics.valueGrowth}%` : `${analytics.valueGrowth}%`}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <p className="text-2xl font-black text-foreground">{brl(analytics.currentMonth.totalValue)}</p>
              <p className="text-[11px] text-muted-foreground">Mês Atual ({analytics.currentMonthName})</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-muted-foreground">{brl(analytics.prevMonth.totalValue)}</p>
              <p className="text-[11px] text-muted-foreground">Mês Anterior ({analytics.prevMonthName})</p>
            </div>
          </div>
        </div>

        {/* Card Quantidade de Eventos */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <CalendarCheck className="size-4 text-primary" /> Eventos ({analytics.currentMonthName} vs {analytics.prevMonthName})
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                analytics.countGrowth >= 0
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-rose-500/10 text-rose-700"
              }`}
            >
              {analytics.countGrowth >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {analytics.countGrowth > 0 ? `+${analytics.countGrowth}%` : `${analytics.countGrowth}%`}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <p className="text-2xl font-black text-foreground">{analytics.currentMonth.eventCount} eventos</p>
              <p className="text-[11px] text-muted-foreground">Mês Atual ({analytics.currentMonthName})</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-muted-foreground">{analytics.prevMonth.eventCount} eventos</p>
              <p className="text-[11px] text-muted-foreground">Mês Anterior ({analytics.prevMonthName})</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico 1: Faturamento Mês a Mês */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Faturamento por Mês ({selectedYear})
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
              <Bar dataKey="totalValue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Quantidade de Eventos Mês a Mês */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Evolução do Número de Eventos ({selectedYear})
        </h3>
        <div className="h-56 w-full">
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
    </div>
  );
}

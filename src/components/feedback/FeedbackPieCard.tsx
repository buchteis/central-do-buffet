import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["#16a34a", "#f59e0b", "#dc2626"];

export function FeedbackPieCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "feedbacks-nps"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("feedbacks")
        .select("nps_score")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { nps_score: number }[];
    },
    staleTime: 30_000,
  });

  const rows = data ?? [];
  const promotores = rows.filter((f) => f.nps_score >= 9).length;
  const neutros = rows.filter((f) => f.nps_score >= 7 && f.nps_score <= 8).length;
  const detratores = rows.filter((f) => f.nps_score <= 6).length;
  const total = rows.length;
  const nps = total ? Math.round(((promotores - detratores) / total) * 100) : 0;
  const media = total ? (rows.reduce((s, f) => s + Number(f.nps_score), 0) / total).toFixed(1) : "0";

  const chart = [
    { name: "Promotores (9-10)", value: promotores },
    { name: "Neutros (7-8)", value: neutros },
    { name: "Detratores (0-6)", value: detratores },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h2 className="font-extrabold text-lg tracking-tight text-slate-800 flex items-center gap-2">
            <Star className="size-5 text-amber-500" />
            Avaliações dos clientes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} resposta(s) · média {media}/10 · NPS {nps}
          </p>
        </div>
        <Link to="/feedbacks" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
          Ver todas <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="p-4 h-[260px]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
        ) : total === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            Nenhuma avaliação recebida ainda. Compartilhe seu link público de avaliação com os clientes.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chart} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={3}>
                {chart.map((entry, i) => (
                  <Cell key={entry.name} fill={COLORS[["Promotores (9-10)", "Neutros (7-8)", "Detratores (0-6)"].indexOf(entry.name)] ?? COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v} resposta(s)`, n]} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

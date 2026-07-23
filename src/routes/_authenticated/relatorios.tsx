import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  Users,
  Hourglass,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Meu Churras" }] }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const qc = useQueryClient();
  const [generated, setGenerated] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["relatorios-kpis"],
    enabled: generated,
    queryFn: async () => {
      const [
        agendamentos,
        clientesNovos,
        pendencias,
        saidas,
        entradas,
        receitaRecebida,
        receitaAgendada,
      ] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("status", "novo_cliente"),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente"),
        supabase
          .from("transactions")
          .select("id, amount", { count: "exact" })
          .eq("type", "saida"),
        supabase
          .from("transactions")
          .select("id, amount", { count: "exact" })
          .eq("type", "entrada"),
        supabase
          .from("transactions")
          .select("amount")
          .eq("type", "entrada")
          .eq("status", "pago"),
        supabase
          .from("events")
          .select("total_value")
          .in("status", ["agendado", "em_andamento", "pago", "concluido"]),
      ]);

      const somaSaidas = (saidas.data ?? []).reduce(
        (s, r: any) => s + Number(r.amount ?? 0),
        0,
      );
      const somaEntradas = (entradas.data ?? []).reduce(
        (s, r: any) => s + Number(r.amount ?? 0),
        0,
      );
      const totalRecebido = (receitaRecebida.data ?? []).reduce(
        (s, r: any) => s + Number(r.amount ?? 0),
        0,
      );
      const totalAgendado = (receitaAgendada.data ?? []).reduce(
        (s, r: any) => s + Number(r.total_value ?? 0),
        0,
      );

      return {
        agendamentos: agendamentos.count ?? 0,
        clientesNovos: clientesNovos.count ?? 0,
        pendencias: pendencias.count ?? 0,
        saidasCount: saidas.count ?? 0,
        entradasCount: entradas.count ?? 0,
        somaSaidas,
        somaEntradas,
        totalRecebido,
        totalAgendado,
      };
    },
  });

  function handleGenerate() {
    if (!generated) setGenerated(true);
    else qc.invalidateQueries({ queryKey: ["relatorios-kpis"] });
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            KPIs em tempo real do seu buffet.
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          className="rounded-full text-xs font-bold shadow-lg shadow-primary/20"
          size="sm"
          disabled={isFetching}
        >
          <RefreshCw className={cn("size-4 mr-1", isFetching && "animate-spin")} />
          {generated ? "Atualizar relatório" : "Gerar relatório"}
        </Button>
      </div>

      {!generated ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <BarChart3 className="size-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm font-semibold">Nenhum relatório gerado</div>
          <div className="text-xs text-muted-foreground mt-1">
            Clique em <strong>Gerar relatório</strong> para visualizar seus KPIs.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Kpi
              label="Total de agendamentos"
              value={String(data?.agendamentos ?? "—")}
              icon={CalendarCheck}
            />
            <Kpi
              label="Novos clientes"
              value={String(data?.clientesNovos ?? "—")}
              icon={Users}
            />
            <Kpi
              label="Pendências"
              value={String(data?.pendencias ?? "—")}
              icon={Hourglass}
              tone={data && data.pendencias > 0 ? "warn" : undefined}
            />
            <Kpi
              label="Nº de entradas"
              value={String(data?.entradasCount ?? "—")}
              icon={ArrowDownCircle}
            />
            <Kpi
              label="Nº de saídas"
              value={String(data?.saidasCount ?? "—")}
              icon={ArrowUpCircle}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi label="Total recebido" value={brl(data?.totalRecebido ?? 0)} icon={DollarSign} accent />
            <Kpi label="Entradas (soma)" value={brl(data?.somaEntradas ?? 0)} icon={ArrowDownCircle} />
            <Kpi label="Saídas (soma)" value={brl(data?.somaSaidas ?? 0)} icon={ArrowUpCircle} />
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Receita agendada (não concluída)
            </div>
            <div className="mt-2 text-3xl font-extrabold text-primary font-mono">
              {brl(data?.totalAgendado ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Soma dos eventos agendados, com pagamento parcial e em andamento.
            </p>
          </div>
        </>
      )}
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
        "bg-card p-4 rounded-2xl border shadow-sm",
        tone === "warn" ? "border-warning/40" : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </span>
        <Icon className={cn("size-4", accent ? "text-primary" : "text-muted-foreground/70")} />
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-extrabold tracking-tighter",
          accent && "text-primary",
        )}
      >
        {value}
      </div>
    </div>
  );
}

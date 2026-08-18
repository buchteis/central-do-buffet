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
  ClipboardList,
  FileDown,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openPurchaseOrderPdf, type PurchaseOrderLine } from "@/lib/purchase-order-pdf";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios e ordem de compra — Central do Buffet" },
      {
        name: "description",
        content:
          "KPIs do buffet e ordem de compra automática dos insumos abaixo do estoque mínimo.",
      },
      { property: "og:title", content: "Relatórios e ordem de compra — Central do Buffet" },
      {
        property: "og:description",
        content: "Acompanhe KPIs e gere a ordem de compra para repor o estoque ao nível operacional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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

      <PurchaseOrderSection />
    </div>
  );
}

function PurchaseOrderSection() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["purchase-order-stock"],
    queryFn: async () => {
      const [{ data: products }, { data: moves }, { data: settings }] = await Promise.all([
        supabase
          .from("stock_products")
          .select("id, name, unit, physical_qty, reserved_qty, min_qty, active, stock_categories(name)")
          .eq("active", true)
          .order("name"),
        supabase
          .from("stock_movements")
          .select("product_id, unit_price, created_at")
          .eq("kind", "purchase")
          .not("unit_price", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("buffet_settings")
          .select("business_name, phone, whatsapp, address, logo_url")
          .maybeSingle(),
      ]);

      const lastPrice = new Map<string, number>();
      for (const m of moves ?? []) {
        const pid = (m as any).product_id as string;
        if (!lastPrice.has(pid)) lastPrice.set(pid, Number((m as any).unit_price ?? 0) || 0);
      }

      const lines: PurchaseOrderLine[] = (products ?? [])
        .map((p: any) => {
          const physical = Number(p.physical_qty ?? 0);
          const reserved = Number(p.reserved_qty ?? 0);
          const min = Number(p.min_qty ?? 0);
          const available = physical - reserved;
          const target = min * 2;
          const suggested = Math.max(Math.ceil((target - available) * 100) / 100, 0);
          const unitPrice = lastPrice.has(p.id) ? lastPrice.get(p.id)! : null;
          return {
            name: p.name as string,
            unit: (p.unit as string) ?? "un",
            category: p.stock_categories?.name ?? null,
            physical_qty: physical,
            reserved_qty: reserved,
            available,
            min_qty: min,
            target_qty: target,
            suggested_qty: suggested,
            unit_price: unitPrice,
            estimated_total: unitPrice != null ? unitPrice * suggested : 0,
            critical: min > 0 && available <= min,
          } satisfies PurchaseOrderLine;
        })
        .filter((l) => l.min_qty > 0 && l.suggested_qty > 0)
        .sort((a, b) => Number(b.critical) - Number(a.critical) || a.name.localeCompare(b.name));

      return { lines, settings: (settings as any) ?? null };
    },
  });

  const lines = data?.lines ?? [];
  const totalEstimado = lines.reduce((s, l) => s + l.estimated_total, 0);

  async function handlePdf() {
    if (!lines.length) {
      toast.info("Nenhum insumo abaixo do nível operacional.");
      return;
    }
    try {
      await openPurchaseOrderPdf({
        orderNumber: `OC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
        lines,
        buffet: data?.settings ?? null,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui gerar o PDF.");
    }
  }

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            Ordem de compra do estoque
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Insumos abaixo do nível operacional (2× o estoque mínimo). Quantidade sugerida para
            recompor o estoque.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-bold"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("size-4 mr-1", isFetching && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            size="sm"
            className="rounded-full text-xs font-bold shadow-lg shadow-primary/20"
            onClick={handlePdf}
            disabled={isFetching || lines.length === 0}
          >
            <FileDown className="size-4 mr-1" />
            Gerar ordem de compra (PDF)
          </Button>
        </div>
      </div>

      {isFetching && lines.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Calculando reposição…</div>
      ) : lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <PackageCheck className="size-7 mx-auto text-success mb-2" />
          <div className="text-sm font-semibold">Estoque em nível operacional</div>
          <div className="text-xs text-muted-foreground mt-1">
            Nenhum insumo precisa de reposição no momento.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Kpi label="Itens a repor" value={String(lines.length)} icon={ClipboardList} />
            <Kpi
              label="Itens críticos"
              value={String(lines.filter((l) => l.critical).length)}
              icon={Hourglass}
              tone={lines.some((l) => l.critical) ? "warn" : undefined}
            />
            <Kpi label="Custo estimado" value={brl(totalEstimado)} icon={DollarSign} accent />
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="text-left py-2 font-bold">Insumo</th>
                  <th className="text-right py-2 font-bold">Disponível</th>
                  <th className="text-right py-2 font-bold">Mínimo</th>
                  <th className="text-right py-2 font-bold">Comprar</th>
                  <th className="text-right py-2 font-bold">Estimado</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.name} className="border-t border-border/60">
                    <td className="py-2 pr-2">
                      <div className="font-semibold">{l.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {l.category ?? "Sem categoria"}
                        {l.critical ? " • crítico" : ""}
                      </div>
                    </td>
                    <td
                      className={cn(
                        "text-right py-2 font-mono tabular-nums",
                        l.critical ? "text-destructive font-bold" : "",
                      )}
                    >
                      {l.available} {l.unit}
                    </td>
                    <td className="text-right py-2 font-mono tabular-nums text-muted-foreground">
                      {l.min_qty}
                    </td>
                    <td className="text-right py-2 font-mono tabular-nums font-bold">
                      {l.suggested_qty} {l.unit}
                    </td>
                    <td className="text-right py-2 font-mono tabular-nums">
                      {l.unit_price != null ? brl(l.estimated_total) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
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

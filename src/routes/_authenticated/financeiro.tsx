import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Wallet, Calendar, Hourglass, CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useSearchFilter } from "@/lib/search-store";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Central do Buffet" }] }),
  component: FinanceiroPage,
});

type PeriodFilter = "todos" | "hoje" | "semana" | "mes" | "ano";
type TypeFilter = "todos" | "recebido" | "receber" | "saida";
type SourceFilter = "todos" | "evento" | "transacao";

const RECEIVED_EVENT_STATUSES: string[] = ["pago", "concluido"];
const ACTIVE_EVENT_STATUSES = [...RECEIVED_EVENT_STATUSES] as any;

const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  pagamento_parcial: "Pag. Parcial",
  em_andamento: "Em andamento",
  pago: "Pago",
  concluido: "Concluído",
  realizado: "Realizado",
  pendente: "Pendente",
  atrasado: "Atrasado",
  novo: "Novo",
  em_analise: "Em análise",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
  primeiro_contato: "1º Contato",
  visitado: "Visitado",
  negociacao: "Negociação",
  aguardando: "Aguardando",
  fechado: "Fechado",
};

const statusStyles: Record<string, string> = {
  agendado: "bg-blue-500/20 text-blue-800 border-blue-300",
  pagamento_parcial: "bg-cyan-500/20 text-cyan-800 border-cyan-300",
  em_andamento: "bg-amber-500/20 text-amber-800 border-amber-300",
  pago: "bg-emerald-500/20 text-emerald-800 border-emerald-300",
  concluido: "bg-gray-500/20 text-gray-800 border-gray-300",
  realizado: "bg-purple-500/20 text-purple-800 border-purple-300",
  pendente: "bg-amber-500/20 text-amber-800 border-amber-300",
  atrasado: "bg-rose-500/20 text-rose-800 border-rose-300",
  novo: "bg-blue-500/20 text-blue-800 border-blue-300",
  em_analise: "bg-indigo-500/20 text-indigo-800 border-indigo-300",
  enviado: "bg-cyan-500/20 text-cyan-800 border-cyan-300",
  aprovado: "bg-emerald-500/20 text-emerald-800 border-emerald-300",
  recusado: "bg-rose-500/20 text-rose-800 border-rose-300",
  cancelado: "bg-gray-500/20 text-gray-800 border-gray-300",
  primeiro_contato: "bg-blue-500/20 text-blue-800 border-blue-300",
  visitado: "bg-cyan-500/20 text-cyan-800 border-cyan-300",
  negociacao: "bg-amber-500/20 text-amber-800 border-amber-300",
  aguardando: "bg-orange-500/20 text-orange-800 border-orange-300",
  fechado: "bg-emerald-500/20 text-emerald-800 border-emerald-300",
};

function FinanceiroPage() {
  const qc = useQueryClient();
  const { data: access } = useTenantAccess();
  const { match } = useSearchFilter();
  const tenantId = access?.tenant?.id ?? null;
  const isSuperAdmin = access?.isSuperAdmin ?? false;

  const [period, setPeriod] = useState<PeriodFilter>("todos");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("todos");

  // Realtime: reflete o Dashboard
  useEffect(() => {
    const channel = supabase
      .channel("financeiro-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        qc.invalidateQueries({ queryKey: ["financeiro-events"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        qc.invalidateQueries({ queryKey: ["financeiro-transactions"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Eventos — filtra por tenant_id (super_admin vê tudo)
  const { data: events } = useQuery({
    queryKey: ["financeiro-events", tenantId],
    enabled: !!tenantId || isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("events")
        .select("id, event_date, status, total_value, clients(name), packages(name)")
        .in("status", ACTIVE_EVENT_STATUSES as any)
        .order("event_date", { ascending: false });
      if (tenantId && !isSuperAdmin) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Transações — filtra por tenant_id (super_admin vê tudo)
  const { data: transactions } = useQuery({
    queryKey: ["financeiro-transactions", tenantId],
    enabled: !!tenantId || isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("id, description, due_date, paid_date, status, amount, type, method, category, events(status, clients(name))")
        .order("due_date", { ascending: false });
      if (tenantId && !isSuperAdmin) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return (data ?? []).filter(
        (t: any) => t.events?.status !== "cancelado" && String(t.status).toLowerCase() !== "cancelado",
      );
    },
  });

  // Unifica eventos + transações em um formato comum
  type Row = {
    id: string;
    source: "evento" | "transacao";
    title: string;
    client?: string | null;
    date: string | null;
    status: string;
    amount: number;
    kind: "recebido" | "receber" | "saida";
    method?: string | null;
  };

  const eventRows: Row[] = (events ?? []).map((e: any) => {
    const st = String(e.status ?? "").toLowerCase();
    const isReceived = RECEIVED_EVENT_STATUSES.includes(st);
    return {
      id: `ev-${e.id}`,
      source: "evento",
      title: e.packages?.name ?? e.clients?.name ?? "Evento",
      client: e.clients?.name ?? null,
      date: e.event_date ?? null,
      status: st,
      amount: Number(e.total_value ?? 0),
      kind: isReceived ? "recebido" : "receber",
    };
  });

  const txRows: Row[] = (transactions ?? []).map((t: any) => {
    const st = String(t.status ?? "pendente").toLowerCase();
    const isEntrada = t.type === "entrada";
    const isPago = st === "pago";
    return {
      id: `tx-${t.id}`,
      source: "transacao",
      title: t.description ?? "Transação",
      client: t.events?.clients?.name ?? t.category ?? null,
      date: t.due_date ?? t.paid_date ?? null,
      status: st,
      amount: Number(t.amount ?? 0),
      kind: isEntrada ? (isPago ? "recebido" : "receber") : "saida",
      method: t.method,
    };
  });

  const allRows: Row[] = [...eventRows, ...txRows].sort((a, b) => {
    const da = a.date ? new Date(a.date + "T00:00:00").getTime() : 0;
    const db = b.date ? new Date(b.date + "T00:00:00").getTime() : 0;
    return db - da;
  });

  const filterByPeriod = (r: Row) => {
    if (period === "todos") return true;
    if (!r.date) return false;
    const d = new Date(r.date + "T00:00:00");
    const now = new Date();
    if (period === "hoje") return d.toDateString() === now.toDateString();
    if (period === "semana") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    }
    if (period === "mes") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "ano") return d.getFullYear() === now.getFullYear();
    return true;
  };

  const periodFiltered = allRows.filter(filterByPeriod);

  const totals = periodFiltered.reduce(
    (acc, r) => {
      if (r.kind === "recebido") acc.recebido += r.amount;
      else if (r.kind === "receber") acc.receber += r.amount;
      else if (r.kind === "saida") acc.saidas += r.amount;
      return acc;
    },
    { recebido: 0, receber: 0, saidas: 0 },
  );

  // Aplica filtro de origem
  const sourceFiltered = periodFiltered.filter((r) => {
    if (sourceFilter === "todos") return true;
    return r.source === sourceFilter;
  });

  // Aplica filtro de tipo (recebido/receber)
  const rows = sourceFiltered
    .filter((r) => {
      if (typeFilter === "recebido") return r.kind === "recebido";
      if (typeFilter === "receber") return r.kind === "receber";
      return true;
    })
    .filter((r) => match(r.title, r.client, r.status, r.method, r.date, r.amount));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Eventos pagos e transações financeiras
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card icon={TrendingUp} label="Receita Recebida" value={brl(totals.recebido)} tone="emerald" />
        <Card icon={Hourglass} label="A Receber" value={brl(totals.receber)} tone="amber" />
        <Card icon={TrendingDown} label="Saídas (pagas)" value={brl(totals.saidas)} tone="rose" />
        <Card
          icon={Wallet}
          label="Saldo Atual"
          value={brl(totals.recebido + totals.receber - totals.saidas)}
          tone="primary"
        />
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
        {/* Filtro por origem */}
        <div className="flex gap-2 flex-wrap">
          {([
            { id: "todos", label: "Todos" },
            { id: "evento", label: "Eventos" },
            { id: "transacao", label: "Transações" },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setSourceFilter(f.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-full border transition-colors",
                sourceFilter === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtro por tipo */}
        <div className="flex gap-2">
          {(["todos", "recebido", "receber"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-full border transition-colors",
                typeFilter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              {f === "todos" ? "Todos" : f === "recebido" ? "Recebidos" : "A Receber"}
            </button>
          ))}
        </div>

        {/* Filtro por período */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border">
          <Calendar className="size-3.5 ml-2 text-muted-foreground" />
          {(["todos", "hoje", "semana", "mes", "ano"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full capitalize transition-colors",
                period === p
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p === "todos" ? "Tudo" : p === "mes" ? "Mês" : p}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
              <th className="px-5 py-3 font-bold">Descrição</th>
              <th className="px-4 py-3 font-bold">Origem</th>
              <th className="px-4 py-3 font-bold">Data</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Tipo</th>
              <th className="px-4 py-3 font-bold text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const isReceived = r.kind === "recebido";
              const isSaida = r.kind === "saida";
              const color = isSaida ? "text-rose-600" : isReceived ? "text-emerald-600" : "text-amber-600";
              return (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="text-sm font-semibold">{r.title}</div>
                    {r.client && <div className="text-[11px] text-muted-foreground">{r.client}</div>}
                  </td>
                  <td className="px-4 py-4 text-[10px] uppercase font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {r.source === "evento" ? (
                        <><CheckCircle2 className="size-3" /> Evento</>
                      ) : (
                        <><Wallet className="size-3" /> Transação</>
                      )}
                    </span>
                    {r.method && <span className="ml-1 normal-case text-muted-foreground/70">· {r.method}</span>}
                  </td>
                  <td className="px-4 py-4 text-xs font-mono">{formatDateBR(r.date)}</td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "px-2 py-1 text-[10px] rounded-full font-bold uppercase border",
                        statusStyles[r.status] || "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {statusLabels[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <span className={cn("inline-flex items-center gap-1 font-semibold", color)}>
                      {isSaida ? (
                        <>
                          <TrendingDown className="size-3" /> Saída
                        </>
                      ) : isReceived ? (
                        <>
                          <TrendingUp className="size-3" /> Recebido
                        </>
                      ) : (
                        <>
                          <Hourglass className="size-3" /> A Receber
                        </>
                      )}
                    </span>
                  </td>
                  <td className={cn("px-4 py-4 text-sm font-mono text-right font-bold", color)}>
                    {isSaida ? "- " : ""}
                    {brl(r.amount)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">
                  Nenhum registro neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    primary: "text-primary",
    amber: "text-amber-600",
  };
  return (
    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon className={cn("size-4", tones[tone])} />
      </div>
      <div className={cn("mt-2 text-2xl font-extrabold tracking-tighter", tones[tone])}>{value}</div>
    </div>
  );
}

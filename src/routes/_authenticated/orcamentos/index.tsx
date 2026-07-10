import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, LayoutGrid, List, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  head: () => ({ meta: [{ title: "Orçamentos — Meu Churras" }] }),
  component: QuotesPage,
});

function whatsappMessage(q: any) {
  const name = q.clients?.name?.split(" ")[0] ?? "tudo bem";
  const date = formatDateBR(q.event_date) ?? "a data definida";
  const pkg = q.packages?.name ?? "pacote escolhido";
  const value = brl(q.total_value);
  return `Olá, ${name}! Tudo bem? Aqui é do Meu Churras. Estou entrando em contato sobre o orçamento do seu evento em ${date} (${pkg}). O investimento estimado é ${value}. Posso te passar mais detalhes?`;
}

// Simplified pipeline: only Novo / Em andamento surface as columns.
// Legacy statuses map to "em_andamento" for display purposes.
const pipeline: { id: string; label: string; tone: string }[] = [
  { id: "novo", label: "Novo", tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { id: "em_andamento", label: "Em andamento", tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
];
function stageOf(status: string): "novo" | "em_andamento" {
  return status === "novo" ? "novo" : "em_andamento";
}

type Period = "all" | "week" | "month" | "year";

function periodRange(p: Period): { start: Date; end: Date } | null {
  if (p === "all") return null;
  const now = new Date();
  if (p === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }
  if (p === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  return { start, end };
}

function QuotesPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [period, setPeriod] = useState<Period>("all");
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(name, phone, whatsapp), packages(name)")
        .neq("status", "cancelado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quotes").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Etapa atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const range = periodRange(period);
  const filtered = (data ?? []).filter((q: any) => {
    if (!range) return true;
    const ref = q.created_at ? new Date(q.created_at) : null;
    return ref ? ref >= range.start && ref < range.end : false;
  });

  const byStage = new Map<string, any[]>();
  pipeline.forEach((s) => byStage.set(s.id, []));
  filtered.forEach((q: any) => {
    byStage.get(stageOf(q.status))!.push(q);
  });


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Pipeline · {filtered.length} orçamento(s) {period === "all" ? "ativos" : "no período"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-muted rounded-full p-1">
            {([
              { id: "all", label: "Tudo" },
              { id: "week", label: "Semana" },
              { id: "month", label: "Mês" },
              { id: "year", label: "Ano" },
            ] as { id: Period; label: string }[]).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn("px-3 py-1 text-xs font-bold rounded-full", period === p.id && "bg-background shadow")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex bg-muted rounded-full p-1">
            <button onClick={() => setView("kanban")} className={cn("px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1", view === "kanban" && "bg-background shadow")}>
              <LayoutGrid className="size-3" /> Pipeline
            </button>
            <button onClick={() => setView("list")} className={cn("px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1", view === "list" && "bg-background shadow")}>
              <List className="size-3" /> Lista
            </button>
          </div>
          <Link to="/orcamentos/novo" className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20">
            <Plus className="size-4" /> Novo
          </Link>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {pipeline.map((stage) => {
              const items = byStage.get(stage.id) ?? [];
              const total = items.reduce((s, q) => s + Number(q.total_value ?? 0), 0);
              return (
                <div key={stage.id} className="w-72 shrink-0 bg-muted/30 rounded-2xl border border-border flex flex-col max-h-[75vh]">
                  <div className="p-3 border-b border-border">
                    <div className={cn("inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border", stage.tone)}>
                      {stage.label}
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{items.length} orçamento(s)</span>
                      <span className="font-mono">{brl(total)}</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {items.map((q: any) => (
                      <div key={q.id} className="bg-card border border-border rounded-xl p-3 shadow-sm hover:border-primary/40 transition-colors">
                        <div className="font-semibold text-sm truncate">{q.clients?.name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{q.packages?.name ?? "Sem pacote"} · {formatDateBR(q.event_date)}</div>
                        <div className="font-mono font-bold text-sm mt-1">{brl(q.total_value)}</div>
                        <select
                          value={stageOf(q.status)}
                          onChange={(e) => move.mutate({ id: q.id, status: e.target.value })}
                          className="mt-2 w-full text-[11px] border border-border rounded-md bg-background px-2 py-1"
                        >
                          {pipeline.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>

                        {(q.clients?.whatsapp || q.clients?.phone) && (
                          <a
                            href={waLink(
                              q.clients?.whatsapp ?? q.clients?.phone,
                              whatsappMessage(q),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 w-full text-[11px] font-bold border border-border rounded-md py-1.5 hover:bg-accent inline-flex items-center justify-center gap-1"
                          >
                            <MessageCircle className="size-3" /> WhatsApp
                          </a>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-[11px] text-muted-foreground text-center py-4">Vazio</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-5 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Data</th>
                <th className="px-4 py-3 font-bold">Pacote</th>
                <th className="px-4 py-3 font-bold text-right">Total</th>
                <th className="px-4 py-3 font-bold">Etapa</th>
                <th className="px-4 py-3 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((q: any) => {
                const stage = pipeline.find((s) => s.id === q.status);
                return (
                  <tr key={q.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4 text-sm font-semibold">{q.clients?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-xs font-mono">{formatDateBR(q.event_date)}</td>
                    <td className="px-4 py-4 text-xs">{q.packages?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-sm font-mono text-right">{brl(q.total_value)}</td>
                    <td className="px-4 py-4">
                      <span className={cn("px-2 py-1 text-[10px] rounded-full font-bold uppercase border", stage?.tone)}>{stage?.label ?? q.status}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(q.clients?.whatsapp || q.clients?.phone) && (
                        <a
                          href={waLink(
                            q.clients?.whatsapp ?? q.clients?.phone,
                            whatsappMessage(q),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Conversar no WhatsApp"
                          className="inline-flex items-center justify-center p-2 text-emerald-600 hover:bg-emerald-500/10 rounded-md"
                        >
                          <MessageCircle className="size-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

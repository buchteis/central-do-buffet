import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  head: () => ({ meta: [{ title: "Orçamentos — Meu Churras" }] }),
  component: QuotesPage,
});

const statusStyles: Record<string, string> = {
  novo: "bg-muted text-muted-foreground",
  em_analise: "bg-info/10 text-info",
  enviado: "bg-warning/20 text-warning-foreground",
  aprovado: "bg-success/10 text-success",
  recusado: "bg-destructive/10 text-destructive",
  cancelado: "bg-destructive/10 text-destructive",
};
const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

function QuotesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(name), packages(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.length ?? 0} orçamento(s) registrado(s)
          </p>
        </div>
        <Link
          to="/orcamentos/novo"
          className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20"
        >
          <Plus className="size-4" /> Novo orçamento
        </Link>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-16 text-center">
            <FileText className="size-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm font-semibold">Nenhum orçamento ainda</div>
            <div className="text-xs text-muted-foreground mt-1">
              Crie o primeiro orçamento em menos de 2 minutos.
            </div>
            <Link
              to="/orcamentos/novo"
              className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-primary hover:underline"
            >
              <Plus className="size-3" /> Novo orçamento
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-5 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Data evento</th>
                  <th className="px-4 py-3 font-bold hidden md:table-cell">Pacote</th>
                  <th className="px-4 py-3 font-bold text-right">Total</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data!.map((q: any) => (
                  <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 text-sm font-semibold">
                      {q.clients?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-xs font-mono">
                      {formatDateBR(q.event_date)}
                    </td>
                    <td className="px-4 py-4 text-xs hidden md:table-cell">
                      {q.packages?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm font-mono text-right">
                      {brl(q.total_value)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "px-2 py-1 text-[10px] rounded-full font-bold uppercase tracking-wider whitespace-nowrap",
                          statusStyles[q.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {statusLabels[q.status] ?? q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

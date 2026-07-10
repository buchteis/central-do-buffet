import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileText, MessageCircle, Trash2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { waLink } from "@/lib/whatsapp";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { copyToClipboard } from "@/lib/clipboard";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — Meu Churras" }] }),
  component: LeadsPage,
});

// Simplified pipeline: only two states surface in UI.
// Legacy values (contatado/convertido/descartado) are treated as "em_andamento".
const statusStyles: Record<string, string> = {
  novo: "bg-primary/10 text-primary",
  em_andamento: "bg-info/10 text-info",
};
const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
};
function normalizeStatus(s: string): "novo" | "em_andamento" {
  return s === "novo" ? "novo" : "em_andamento";
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

function LeadsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: access } = useTenantAccess();
  const [period, setPeriod] = useState<Period>("all");

  const { data: leadsRaw } = useQuery({
    queryKey: ["leads", access?.tenant?.id],
    enabled: !!access?.tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("tenant_id", access!.tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const range = periodRange(period);
  const leads = (leadsRaw ?? []).filter((l: any) => {
    if (!range) return true;
    const ref = l.created_at ? new Date(l.created_at) : null;
    return ref ? ref >= range.start && ref < range.end : false;
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Lead excluído");
    },
  });

  const slug = access?.tenant?.slug;
  const publicUrl = slug ? `${window.location.origin}/orcamento/${slug}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {leads.length} solicitação(ões) {period === "all" ? "recebidas" : "no período"}
          </p>
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
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full",
                  period === p.id && "bg-background shadow",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {publicUrl && (
            <>
              <div className="bg-muted/50 border border-border rounded-full px-3 py-1.5 text-xs font-mono truncate max-w-[320px]">
                {publicUrl}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const ok = await copyToClipboard(publicUrl);
                  if (ok) toast.success("Link copiado!");
                  else toast.error("Não foi possível copiar. Copie manualmente.");
                }}
              >
                Copiar link
              </Button>
            </>
          )}
        </div>
      </div>


      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {leads && leads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-5 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Contato</th>
                  <th className="px-4 py-3 font-bold">Evento</th>
                  <th className="px-4 py-3 font-bold">Data</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((l: any) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold">{l.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {l.city ?? "—"} · {formatDateBR(l.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <div>{l.whatsapp ?? l.phone ?? "—"}</div>
                      <div className="text-muted-foreground truncate max-w-[180px]">
                        {l.email ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <div>{l.event_type ?? "—"}</div>
                      <div className="text-muted-foreground">
                        {l.guest_count ?? 0} convidados · {l.package_desired ?? "sem pacote"}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs font-mono">
                      {l.event_date ? formatDateBR(l.event_date) : "—"}
                      {l.event_time ? ` ${String(l.event_time).slice(0, 5)}` : ""}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={normalizeStatus(l.status)}
                        onChange={(e) =>
                          updateStatus.mutate({ id: l.id, status: e.target.value })
                        }
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border-0 cursor-pointer",
                          statusStyles[normalizeStatus(l.status)],
                        )}
                      >
                        {Object.entries(statusLabels).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {(l.whatsapp || l.phone) && (
                          <a
                            href={waLink(
                              l.whatsapp ?? l.phone,
                              `Olá, ${l.name}. Recebemos sua solicitação de orçamento e teremos prazer em atendê-lo.`,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            title="Conversar no WhatsApp"
                            className="p-2 text-success hover:bg-success/10 rounded-md"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                        <button
                          onClick={() =>
                            navigate({
                              to: "/orcamentos/novo",
                              search: { leadId: l.id } as any,
                            })
                          }
                          title="Criar/Completar Orçamento"
                          className="p-2 text-primary hover:bg-primary/10 rounded-md disabled:opacity-40 inline-flex items-center gap-1 text-xs font-semibold"
                        >
                          <FileText className="size-4" />
                          <span className="hidden sm:inline">
                            {l.status === "convertido" ? "Ver orçamento" : "Criar/Completar Orçamento"}
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Excluir este lead?")) remove.mutate(l.id);
                          }}
                          title="Excluir"
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Inbox className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold">Nenhum lead ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Compartilhe seu link exclusivo no Instagram para receber solicitações.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

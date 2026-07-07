import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowRight, MessageCircle, Trash2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { waLink } from "@/lib/whatsapp";
import { useTenantAccess } from "@/hooks/useTenantAccess";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — Meu Churras" }] }),
  component: LeadsPage,
});

const statusStyles: Record<string, string> = {
  novo: "bg-primary/10 text-primary",
  contatado: "bg-info/10 text-info",
  convertido: "bg-success/10 text-success",
  descartado: "bg-muted text-muted-foreground",
};
const statusLabels: Record<string, string> = {
  novo: "Novo",
  contatado: "Contatado",
  convertido: "Convertido",
  descartado: "Descartado",
};

function LeadsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: access } = useTenantAccess();

  const { data: leads } = useQuery({
    queryKey: ["leads", access?.tenant?.id],
    enabled: !!access?.tenant?.id,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
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


  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead excluído");
    },
  });

  const convert = useMutation({
    mutationFn: async (lead: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");

      // 1. Create/find client
      let clientId: string | null = null;
      if (lead.name) {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("name", lead.name)
          .maybeSingle();
        if (existing?.id) clientId = existing.id;
        else {
          const { data: newClient, error } = await supabase
            .from("clients")
            .insert({
              owner_id: u.user.id,
              name: lead.name,
              phone: lead.phone,
              whatsapp: lead.whatsapp,
              email: lead.email,
              city: lead.city,
              address: lead.event_address,
            })
            .select("id")
            .single();
          if (error) throw error;
          clientId = newClient.id;
        }
      }

      // 2. Create quote
      const { data: quote, error: qerr } = await supabase
        .from("quotes")
        .insert({
          owner_id: u.user.id,
          client_id: clientId,
          package_id: lead.package_id,
          event_date: lead.event_date ?? new Date().toISOString().slice(0, 10),
          event_time: lead.event_time,
          event_address: lead.event_address,
          event_type: lead.event_type,
          adults: lead.guest_count ?? 0,
          children_7_10: 0,
          children_0_6: 0,
          extras: {},
          notes: lead.notes,
          status: "novo",
        })
        .select("id")
        .single();
      if (qerr) throw qerr;

      // 3. Mark lead as converted
      await supabase
        .from("leads")
        .update({ status: "convertido", converted_quote_id: quote.id } as any)
        .eq("id", lead.id);
      return quote.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Lead convertido em orçamento!");
      navigate({ to: "/orcamentos" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const slug = access?.tenant?.slug;
  const publicUrl = slug ? `${window.location.origin}/orcamento/${slug}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {leads?.length ?? 0} solicitação(ões) recebida(s) pelo formulário público
          </p>
        </div>
        {publicUrl && (
          <div className="flex items-center gap-2">
            <div className="bg-muted/50 border border-border rounded-full px-3 py-1.5 text-xs font-mono truncate max-w-[320px]">
              {publicUrl}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado!");
              }}
            >
              Copiar link
            </Button>
          </div>
        )}
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
                        value={l.status}
                        onChange={(e) =>
                          updateStatus.mutate({ id: l.id, status: e.target.value })
                        }
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border-0 cursor-pointer",
                          statusStyles[l.status] ?? "bg-muted text-muted-foreground",
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
                          onClick={() => convert.mutate(l)}
                          disabled={convert.isPending || l.status === "convertido"}
                          title="Transformar em orçamento"
                          className="p-2 text-primary hover:bg-primary/10 rounded-md disabled:opacity-40"
                        >
                          <ArrowRight className="size-4" />
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

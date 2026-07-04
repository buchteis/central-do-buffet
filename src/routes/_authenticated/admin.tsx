import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Pause, Play, Shield, ShieldOff, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Super Admin — Meu Churras" }] }),
  component: AdminPage,
});

const statusStyles: Record<string, string> = {
  pendente: "bg-warning/20 text-warning-foreground",
  ativo: "bg-success/10 text-success",
  rejeitado: "bg-destructive/10 text-destructive",
  suspenso: "bg-muted text-muted-foreground",
};

function AdminPage() {
  const { data: access, isLoading } = useTenantAccess();
  const qc = useQueryClient();

  const { data: tenants } = useQuery({
    queryKey: ["admin-tenants"],
    enabled: !!access?.isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "ativo") patch.approved_at = new Date().toISOString();
      const { error } = await supabase.from("tenants").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-10 text-center text-sm">Carregando…</div>;
  if (!access?.isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto text-center p-10 space-y-3">
        <Shield className="size-10 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Este painel é exclusivo para administradores da plataforma.
        </p>
      </div>
    );
  }

  const pending = tenants?.filter((t: any) => t.status === "pendente") ?? [];
  const active = tenants?.filter((t: any) => t.status === "ativo") ?? [];
  const total = tenants?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Super Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão da plataforma · {total} buffet(s) cadastrado(s)
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Buffets ativos" value={active.length} />
        <Kpi label="Aguardando aprovação" value={pending.length} tone={pending.length > 0 ? "warn" : undefined} />
        <Kpi label="Suspensos" value={tenants?.filter((t: any) => t.status === "suspenso").length ?? 0} />
        <Kpi label="Rejeitados" value={tenants?.filter((t: any) => t.status === "rejeitado").length ?? 0} />
      </div>

      {pending.length > 0 && (
        <section className="bg-card border border-warning/40 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border">
            <h2 className="font-extrabold text-lg tracking-tight">Solicitações pendentes</h2>
            <p className="text-xs text-muted-foreground">Aprovar ou rejeitar novos buffets</p>
          </div>
          <TenantTable tenants={pending} onSetStatus={setStatus.mutate} />
        </section>
      )}

      <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border">
          <h2 className="font-extrabold text-lg tracking-tight">Todos os buffets</h2>
        </div>
        <TenantTable tenants={tenants ?? []} onSetStatus={setStatus.mutate} />
      </section>
    </div>
  );
}

function TenantTable({
  tenants,
  onSetStatus,
}: {
  tenants: any[];
  onSetStatus: (input: { id: string; status: string }) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
            <th className="px-5 py-3 font-bold">Buffet</th>
            <th className="px-4 py-3 font-bold">Cidade</th>
            <th className="px-4 py-3 font-bold">Plano</th>
            <th className="px-4 py-3 font-bold">Cadastro</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tenants.map((t) => (
            <tr key={t.id} className="hover:bg-muted/30">
              <td className="px-5 py-4">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-[11px] text-muted-foreground font-mono">/{t.slug}</div>
              </td>
              <td className="px-4 py-4 text-xs">{t.city ?? "—"}</td>
              <td className="px-4 py-4 text-xs uppercase font-bold">{t.plan}</td>
              <td className="px-4 py-4 text-xs font-mono">{formatDateBR(t.created_at)}</td>
              <td className="px-4 py-4">
                <span
                  className={cn(
                    "px-2 py-1 text-[10px] rounded-full font-bold uppercase tracking-wider",
                    statusStyles[t.status] ?? "bg-muted",
                  )}
                >
                  {t.status}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center justify-end gap-1">
                  {t.status === "pendente" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSetStatus({ id: t.id, status: "ativo" })}
                      >
                        <Check className="size-3" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSetStatus({ id: t.id, status: "rejeitado" })}
                      >
                        <X className="size-3" /> Rejeitar
                      </Button>
                    </>
                  )}
                  {t.status === "ativo" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetStatus({ id: t.id, status: "suspenso" })}
                    >
                      <Pause className="size-3" /> Suspender
                    </Button>
                  )}
                  {(t.status === "suspenso" || t.status === "rejeitado") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetStatus({ id: t.id, status: "ativo" })}
                    >
                      <Play className="size-3" /> Reativar
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {tenants.length === 0 && (
            <tr>
              <td colSpan={6} className="p-10 text-center text-xs text-muted-foreground">
                Nenhum registro
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div
      className={cn(
        "bg-card p-4 rounded-2xl border shadow-sm",
        tone === "warn" ? "border-warning/40" : "border-border",
      )}
    >
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tighter">{value}</div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Pause, Play, Shield, ShieldCheck, ShieldOff, UserCog, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Super Admin — Central do Buffet" }] }),
  component: AdminPage,
});

const statusStyles: Record<string, string> = {
  pendente: "bg-warning/20 text-warning-foreground",
  ativo: "bg-success/10 text-success",
  rejeitado: "bg-destructive/10 text-destructive",
  suspenso: "bg-muted text-muted-foreground",
};

type Tab = "buffets" | "usuarios";

function AdminPage() {
  const { data: access, isLoading } = useTenantAccess();
  const [tab, setTab] = useState<Tab>("buffets");
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

      <div className="flex gap-1 bg-muted p-1 rounded-full w-fit">
        <TabButton active={tab === "buffets"} onClick={() => setTab("buffets")} icon={Shield}>
          Buffets
        </TabButton>
        <TabButton active={tab === "usuarios"} onClick={() => setTab("usuarios")} icon={UserCog}>
          Usuários & Permissões
        </TabButton>
      </div>

      {tab === "buffets" && (
        <>
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
        </>
      )}

      {tab === "usuarios" && <UsersTab currentUserId={access.userId} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Shield;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition",
        active ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function UsersTab({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: tenants }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, business_name, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("tenants").select("owner_id, name, status, slug"),
      ]);
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const tenantByUser = new Map<string, any>();
      (tenants ?? []).forEach((t: any) => tenantByUser.set(t.owner_id, t));
      return (profiles ?? []).map((p: any) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
        tenant: tenantByUser.get(p.id),
      }));
    },
  });

  const toggleRole = useMutation({
    mutationFn: async ({ userId, role, grant }: { userId: string; role: "super_admin" | "buffet"; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(v.grant ? "Permissão concedida" : "Permissão removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-10 text-center text-sm">Carregando usuários…</div>;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-border">
        <h2 className="font-extrabold text-lg tracking-tight">Usuários & Permissões</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Conceda ou remova permissões de administrador para qualquer usuário cadastrado.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
              <th className="px-5 py-3 font-bold">Usuário</th>
              <th className="px-4 py-3 font-bold">Buffet</th>
              <th className="px-4 py-3 font-bold">Papéis</th>
              <th className="px-4 py-3 font-bold">Cadastro</th>
              <th className="px-4 py-3 font-bold text-right">Permissões</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(users ?? []).map((u: any) => {
              const isSuper = u.roles.includes("super_admin");
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="text-sm font-semibold">{u.full_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{u.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-4">
                    {u.tenant ? (
                      <div>
                        <div className="text-xs font-semibold">{u.tenant.name}</div>
                        <span
                          className={cn(
                            "inline-block mt-1 px-2 py-0.5 text-[9px] rounded-full font-bold uppercase tracking-wider",
                            statusStyles[u.tenant.status] ?? "bg-muted",
                          )}
                        >
                          {u.tenant.status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-[10px] text-muted-foreground">sem papéis</span>}
                      {u.roles.map((r: string) => (
                        <span
                          key={r}
                          className={cn(
                            "px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider",
                            r === "super_admin" ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
                          )}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs font-mono">{formatDateBR(u.created_at)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {isSuper ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSelf || toggleRole.isPending}
                          title={isSelf ? "Você não pode remover suas próprias permissões" : ""}
                          onClick={() => toggleRole.mutate({ userId: u.id, role: "super_admin", grant: false })}
                        >
                          <ShieldOff className="size-3" /> Remover Admin
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleRole.isPending}
                          onClick={() => toggleRole.mutate({ userId: u.id, role: "super_admin", grant: true })}
                        >
                          <ShieldCheck className="size-3" /> Tornar Admin
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-xs text-muted-foreground">
                  Nenhum usuário cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
        <strong>Super Admin</strong> pode aprovar buffets, suspender contas e gerenciar permissões da plataforma.
      </div>
    </section>
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

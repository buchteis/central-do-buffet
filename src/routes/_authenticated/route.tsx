import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { Flame, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: access, isLoading } = useTenantAccess();
  const navigate = useNavigate();

  if (isLoading || !access) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Flame className="size-6 text-primary animate-pulse" />
      </div>
    );
  }

  // Super admin has full access regardless of tenant status
  if (!access.isSuperAdmin) {
    const status = access.tenant?.status;
    if (!access.tenant || status === "pendente") return <PendingScreen reason="pendente" />;
    if (status === "rejeitado") return <PendingScreen reason="rejeitado" />;
    if (status === "suspenso") return <PendingScreen reason="suspenso" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Você saiu.");
    navigate({ to: "/auth", replace: true });
  }

  function PendingScreen({ reason }: { reason: string }) {
    const messages: Record<string, { title: string; body: string }> = {
      pendente: {
        title: "Cadastro em análise",
        body: "Sua conta está aguardando aprovação do administrador. Você receberá um e-mail assim que for liberada.",
      },
      rejeitado: {
        title: "Cadastro não aprovado",
        body: "Infelizmente seu cadastro não foi aprovado. Entre em contato com o suporte para mais informações.",
      },
      suspenso: {
        title: "Conta suspensa",
        body: "Sua conta está temporariamente suspensa. Entre em contato com o suporte para regularizar.",
      },
    };
    const m = messages[reason];
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-lg text-center space-y-4">
          <div className="mx-auto size-14 rounded-full bg-warning/10 text-warning-foreground flex items-center justify-center">
            <ShieldAlert className="size-7 text-warning" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">{m.title}</h1>
          <p className="text-sm text-muted-foreground">{m.body}</p>
          <Button onClick={signOut} variant="outline" className="w-full">
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }
}

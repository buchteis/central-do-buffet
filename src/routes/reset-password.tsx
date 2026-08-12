import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Central do Buffet — Redefinir senha" },
      { name: "description", content: "Defina uma nova senha para acessar sua conta no Central do Buffet." },
      { property: "og:title", content: "Central do Buffet — Redefinir senha" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function check() {
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          setReady(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!active) return;
      toast.error("Link de recuperação inválido ou expirado. Solicite um novo.");
      navigate({ to: "/auth", replace: true });
    }
    check();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Senha atualizada! Bem-vindo de volta.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-lg space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="size-7 text-primary" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground">
            Escolha uma nova senha para entrar na plataforma.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nova senha</Label>
            <Input name="password" type="password" autoComplete="new-password" />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input name="confirm" type="password" autoComplete="new-password" />
          </div>
          <Button className="w-full" disabled={loading || !ready}>
            {loading ? "Salvando..." : ready ? "Salvar nova senha" : "Validando link..."}
          </Button>
        </form>
      </div>
    </div>
  );
}

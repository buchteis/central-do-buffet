import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Central do Buffet — Login" },
      { name: "description", content: "Acesse sua conta da Central do Buffet." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});
const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Informe seu nome").max(100),
  businessName: z.string().trim().min(2, "Informe o nome do buffet").max(100),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        toast.error("E-mail ainda não confirmado.", {
          action: {
            label: "Reenviar e-mail",
            onClick: async () => {
              const { error: rErr } = await supabase.auth.resend({
                type: "signup",
                email: parsed.data.email,
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
              });
              if (rErr) toast.error(rErr.message);
              else toast.success("Novo link enviado. Verifique seu e-mail.");
            },
          },
          duration: 10000,
        });
        return;
      }
      return toast.error(error.message);
    }
    toast.success("Bem-vindo à Central do Buffet!");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: parsed.data.fullName,
          business_name: parsed.data.businessName,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (signUpData.session) {
      toast.success("Conta criada! Você já está conectado!");
      navigate({ to: "/dashboard", replace: true });
    } else {
      toast.success("Conta criada! Confira seu e-mail para confirmar o cadastro antes de entrar.", {
        duration: 10000,
      });
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Não foi possível entrar com Google.");
      return;
    }
    if (!result.redirected) {
      setLoading(false);
      navigate({ to: "/dashboard", replace: true });
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* LADO ESQUERDO - IDENTIDADE VISUAL */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-blue-600 via-teal-500 to-emerald-400 text-white border-r border-border">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg shadow-black/20">
            <Building2 className="size-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight">Central do Buffet</span>
            <span className="text-[10px] font-mono uppercase opacity-80">
              Gestão de buffet
            </span>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Sua operação de churrasco, <span className="text-white/90">no controle</span>.
          </h1>
          <p className="mt-4 text-white/80">
            Clientes, orçamentos, agenda, eventos e pacotes — tudo em um só lugar. Feito para
            substituir planilhas e grupos de WhatsApp.
          </p>
        </div>
        <p className="text-xs text-white/60">© 2026 Central do Buffet</p>
      </div>

      {/* LADO DIREITO - FORMULÁRIO */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="size-9 bg-gradient-to-br from-blue-600 to-teal-500 rounded-xl flex items-center justify-center">
              <Building2 className="size-5 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight">Central do Buffet</span>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">E-mail</Label>
                  <Input id="si-email" name="email" type="email" required autoComplete="email" className="focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-password">Senha</Label>
                  <Input
                    id="si-password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="focus:ring-blue-500"
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600" disabled={loading}>
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </form>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-background px-2 text-muted-foreground tracking-widest">
                    ou continue com
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                disabled={loading}
              >
                <GoogleIcon />
                Google
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Seu nome</Label>
                  <Input id="su-name" name="fullName" required className="focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-business">Nome do buffet</Label>
                  <Input
                    id="su-business"
                    name="businessName"
                    placeholder="Ex.: Buffet Brasa Real"
                    required
                    className="focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">E-mail</Label>
                  <Input id="su-email" name="email" type="email" required autoComplete="email" className="focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Senha</Label>
                  <Input
                    id="su-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="focus:ring-blue-500"
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600" disabled={loading}>
                  {loading ? "Criando…" : "Criar conta"}
                </Button>
              </form>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                disabled={loading}
              >
                <GoogleIcon />
                Continuar com Google
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 mr-2" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

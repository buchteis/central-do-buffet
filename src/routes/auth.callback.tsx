import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Confirmando acesso — Meu Churras" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Check for explicit error in URL (expired link, access denied, etc.)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const search = new URLSearchParams(window.location.search);
      const urlError = hash.get("error_description") || search.get("error_description")
        || hash.get("error") || search.get("error");
      if (urlError) {
        setError(decodeURIComponent(urlError.replace(/\+/g, " ")));
        return;
      }

      // Supabase client auto-detects the session from the URL hash on init.
      // Poll briefly to give it time, then navigate.
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          toast.success("E-mail confirmado! Bem-vindo.");
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      // No session established — likely link already used or expired.
      setError("Não foi possível confirmar seu e-mail. O link pode ter expirado ou já ter sido usado.");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto size-12 rounded-xl bg-primary flex items-center justify-center">
          <Flame className="size-6 text-primary-foreground animate-pulse" />
        </div>
        {error ? (
          <>
            <h1 className="text-xl font-bold">Confirmação não concluída</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => navigate({ to: "/auth", replace: true })} className="w-full">
              Voltar ao login
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Confirmando seu acesso…</h1>
            <p className="text-sm text-muted-foreground">Aguarde um instante.</p>
          </>
        )}
      </div>
    </div>
  );
}

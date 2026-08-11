import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Central do Buffet — Confirmando acesso" },
      { name: "description", content: "Finalizando a confirmação da sua conta no Central do Buffet." },
      { property: "og:title", content: "Central do Buffet — Confirmando acesso" },
      { property: "og:description", content: "Finalizando a confirmação da sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Confirmando seu acesso...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (cancelled) return;
      setMsg("Não foi possível confirmar automaticamente. Faça login para continuar.");
      navigate({ to: "/auth", replace: true });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <Flame className="size-6 text-primary animate-pulse" />
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NpsCard } from "@/components/feedback/NpsCard";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { copyToClipboard } from "@/lib/clipboard";
import { Copy, Star } from "lucide-react";
import { toast } from "sonner";
import { useSearchFilter } from "@/lib/search-store";

export const Route = createFileRoute("/_authenticated/feedbacks/")({
  head: () => ({
    meta: [
      { title: "Qualidade & Feedbacks — Central do Buffet" },
      { name: "description", content: "Acompanhe o NPS e as avaliações dos clientes do seu buffet." },
    ],
  }),
  component: FeedbacksDashboard,
});

type Period = "dia" | "mes" | "ano" | "todos";

const PERIODS: { key: Period; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "todos", label: "Tudo" },
];

function startOf(period: Period) {
  const now = new Date();
  if (period === "dia") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "ano") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function FeedbacksDashboard() {
  const { data: access } = useTenantAccess();
  const { match } = useSearchFilter();
  const [period, setPeriod] = useState<Period>("mes");
  const slug = access?.tenant?.slug ?? "";
  const link = slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/avaliar/${slug}` : "";

  const { data: allFeedbacks = [], isLoading } = useQuery({
    queryKey: ["feedbacks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const from = startOf(period);
  const feedbacks = from
    ? allFeedbacks.filter((f: any) => new Date(f.created_at) >= from)
    : allFeedbacks;

  const avgNps = feedbacks.length
    ? (feedbacks.reduce((acc: number, f: any) => acc + Number(f.nps_score), 0) / feedbacks.length).toFixed(1)
    : "0";


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Qualidade & Feedbacks</h1>
        <p className="text-sm text-muted-foreground">Acompanhe a satisfação dos seus clientes em tempo real.</p>
      </div>

      {link && (
        <div className="p-4 bg-card border border-border rounded-2xl flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Link público de avaliação
            </span>
            <p className="text-sm font-mono truncate">{link}</p>
          </div>
          <button
            onClick={async () => {
              await copyToClipboard(link);
              toast.success("Link copiado!");
            }}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2"
          >
            <Copy className="size-3.5" /> Copiar link
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-card border border-border rounded-2xl">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">NPS médio</span>
          <div className="text-3xl font-black mt-1">
            {avgNps} <span className="text-sm font-normal text-muted-foreground">/ 10</span>
          </div>
        </div>
        <div className="p-5 bg-card border border-border rounded-2xl">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total de respostas
          </span>
          <div className="text-3xl font-black mt-1">{feedbacks.length}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Star className="size-4 text-amber-500" /> Mural de opiniões
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : feedbacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum feedback recebido ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feedbacks
              .filter((f: any) => match(f.client_name, f.comments, f.improvements, f.nps_score))
              .map((f: any) => (
              <NpsCard
                key={f.id}
                clientName={f.client_name}
                npsScore={f.nps_score}
                comments={f.comments}
                improvements={f.improvements}
                createdAt={f.created_at}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Loader2, Star, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  connectGooglePlace,
  disconnectGooglePlace,
  getGoogleReviews,
} from "@/lib/google-reviews.functions";

type UnifiedReview = {
  key: string;
  source: "google" | "link";
  author: string;
  rating: number; // 0-5
  text: string;
  createdAt: string;
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex text-amber-500">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={`size-3.5 ${i < Math.round(value) ? "fill-amber-500" : "fill-muted stroke-muted-foreground/40"}`} />
      ))}
    </div>
  );
}

export function UnifiedReviewsCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const fetchGoogle = useServerFn(getGoogleReviews);
  const connect = useServerFn(connectGooglePlace);
  const disconnect = useServerFn(disconnectGooglePlace);

  const google = useQuery({
    queryKey: ["google-reviews"],
    queryFn: () => fetchGoogle(),
  });

  const feedbacks = useQuery({
    queryKey: ["feedbacks", "dashboard-unified"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("feedbacks")
        .select("id, client_name, nps_score, comments, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const connectMut = useMutation({
    mutationFn: (input: string) => connect({ data: { input } }),
    onSuccess: (res: any) => {
      if (!res?.ok) return toast.error(res?.error ?? "Não foi possível conectar.");
      toast.success("Google Meu Negócio conectado!");
      setOpen(false);
      setValue("");
      qc.invalidateQueries({ queryKey: ["google-reviews"] });
    },
    onError: () => toast.error("Falha ao conectar com o Google."),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Conexão removida.");
      qc.invalidateQueries({ queryKey: ["google-reviews"] });
    },
  });

  const g = google.data;
  const googleReviews: UnifiedReview[] = (g?.reviews ?? []).map((r, i) => ({
    key: `g-${i}`,
    source: "google",
    author: r.author,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt,
  }));

  const linkReviews: UnifiedReview[] = (feedbacks.data ?? []).map((f: any) => ({
    key: `f-${f.id}`,
    source: "link",
    author: f.client_name,
    rating: Number(f.nps_score) / 2, // NPS 0-10 → escala 5
    text: f.comments ?? "",
    createdAt: f.created_at,
  }));

  const all = [...googleReviews, ...linkReviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const avg = all.length ? all.reduce((acc, r) => acc + r.rating, 0) / all.length : 0;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="font-extrabold text-lg tracking-tight flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          Avaliações unificadas
        </h2>

        {google.isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : g?.configured ? (
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
              Google conectado
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnectMut.mutate()}
              disabled={disconnectMut.isPending}
            >
              <Unlink className="size-3.5" /> Desconectar
            </Button>
          </div>
        ) : (
          <Button size="sm" className="rounded-full font-bold" onClick={() => setOpen(true)}>
            <Link2 className="size-4" /> Conectar Google Meu Negócio
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Nota geral" value={all.length ? `${avg.toFixed(1)} ★` : "—"} />
        <Stat label="Total avaliações" value={String(all.length)} />
        <Stat label="Google" value={g?.total != null && g.configured ? String(g.total) : "—"} />
        <Stat label="Link público" value={String(linkReviews.length)} />
      </div>

      {g?.configured && g.hasApiKey === false && (
        <p className="text-xs text-amber-600">
          Falta configurar a chave da API do Google para carregar as avaliações.
        </p>
      )}
      {g?.error && <p className="text-xs text-destructive">{g.error}</p>}

      {all.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl border-border">
          <Building2 className="size-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">Nenhuma avaliação ainda</p>
          <p className="text-sm">Conecte o Google Meu Negócio e compartilhe seu link público de avaliação.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {all.slice(0, 8).map((r) => (
            <div key={r.key} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{r.author}</p>
                  <Stars value={r.rating} />
                </div>
                <span
                  className={
                    "shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full " +
                    (r.source === "google"
                      ? "bg-red-100 text-red-700"
                      : "bg-primary/10 text-primary")
                  }
                >
                  {r.source === "google" ? "Google" : "Link"}
                </span>
              </div>
              {r.text && <p className="text-sm text-muted-foreground line-clamp-3">{r.text}</p>}
              {r.createdAt && (
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar Google Meu Negócio</DialogTitle>
            <DialogDescription>
              Cole o link do seu perfil no Google Maps, o nome do negócio ou o Place ID.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://maps.google.com/... ou Nome do Buffet, Cidade"
          />
          <DialogFooter>
            <Button
              onClick={() => connectMut.mutate(value)}
              disabled={value.trim().length < 3 || connectMut.isPending}
            >
              {connectMut.isPending && <Loader2 className="size-4 animate-spin" />} Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-muted/20">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-black tracking-tight">{value}</p>
    </div>
  );
}

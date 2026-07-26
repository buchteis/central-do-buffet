import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicTenantLogo } from "@/lib/public-logo.functions";

export const Route = createFileRoute("/avaliar/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Avalie sua experiência — ${params.slug}` },
      {
        name: "description",
        content: "Conte como foi seu evento: avalie comida, bebidas, equipe e pontualidade do buffet.",
      },
      { property: "og:title", content: "Avalie sua experiência" },
      { property: "og:description", content: "Sua opinião ajuda o buffet a melhorar cada evento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicFeedbackForm,
});

function PublicFeedbackForm() {
  const { slug } = Route.useParams();
  const [clientName, setClientName] = useState("");
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [ratingFood, setRatingFood] = useState(5);
  const [ratingDrinks, setRatingDrinks] = useState(5);
  const [ratingStaff, setRatingStaff] = useState(5);
  const [ratingPunctuality, setRatingPunctuality] = useState(5);
  const [comments, setComments] = useState("");
  const [improvements, setImprovements] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: logo } = useQuery({
    queryKey: ["public-logo", slug],
    queryFn: () => getPublicTenantLogo({ data: { slug } }),
    staleTime: 10 * 60_000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (npsScore === null) {
      toast.error("Selecione uma nota de 0 a 10.");
      return;
    }

    setLoading(true);
    const { error } = await (supabase as any).rpc("submit_public_feedback", {
      p_slug: slug,
      p_client_name: clientName,
      p_nps_score: npsScore,
      p_rating_food: ratingFood,
      p_rating_drinks: ratingDrinks,
      p_rating_staff: ratingStaff,
      p_rating_punctuality: ratingPunctuality,
      p_comments: comments,
      p_improvements: improvements,
    });
    setLoading(false);

    if (error) {
      toast.error("Erro ao enviar avaliação: " + error.message);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <div className="bg-card p-8 rounded-2xl shadow-xl max-w-md text-center space-y-4 border border-border">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-bold text-foreground">Obrigado pelo seu feedback!</h1>
          <p className="text-muted-foreground text-sm">
            Sua opinião é fundamental para evoluirmos nossos eventos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4 flex justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-card p-6 rounded-2xl shadow-md max-w-lg w-full space-y-6 border border-border"
      >
        <div className="text-center space-y-2">
          {logo?.url ? (
            <img src={logo.url} alt="Logomarca do buffet" className="h-16 mx-auto object-contain" />
          ) : (
            <div className="size-12 mx-auto bg-primary rounded-xl flex items-center justify-center">
              <Flame className="size-6 text-primary-foreground" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground">Como foi sua experiência?</h1>
          <p className="text-sm text-muted-foreground">Sua avaliação nos ajuda a melhorar!</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Seu nome *</label>
          <input
            type="text"
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full p-2.5 border border-input rounded-lg bg-background"
            placeholder="Ex: João Silva"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            De 0 a 10, o quanto você indicaria nosso buffet? *
          </label>
          <div className="grid grid-cols-11 gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setNpsScore(num)}
                className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                  npsScore === num
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-semibold">Avalie os quesitos (1 a 5 estrelas):</h2>
          {[
            { label: "🥩 Comida e cardápio", val: ratingFood, set: setRatingFood },
            { label: "🍻 Bebidas", val: ratingDrinks, set: setRatingDrinks },
            { label: "👨‍🍳 Atendimento da equipe", val: ratingStaff, set: setRatingStaff },
            { label: "⏱️ Pontualidade e organização", val: ratingPunctuality, set: setRatingPunctuality },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <select
                value={item.val}
                onChange={(e) => item.set(Number(e.target.value))}
                className="p-1 border border-input rounded-md bg-background font-medium"
              >
                {[5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={s}>
                    {s} ★
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Elogios / o que mais gostou?</label>
          <textarea
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="w-full p-2.5 border border-input rounded-lg text-sm bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">O que podemos melhorar?</label>
          <textarea
            rows={2}
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            className="w-full p-2.5 border border-input rounded-lg text-sm bg-background"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar avaliação"}
        </button>
      </form>
    </div>
  );
}

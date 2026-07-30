import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type GoogleReview = {
  author: string;
  rating: number;
  text: string;
  createdAt: string;
  profilePhoto?: string;
};

export type GoogleReviewsResult = {
  configured: boolean;
  hasApiKey: boolean;
  placeId: string | null;
  name?: string;
  rating?: number;
  total?: number;
  reviews: GoogleReview[];
  error?: string;
};

function extractPlaceId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  // ID direto (ChIJ..., GhIJ..., places/xxx)
  const direct = value.match(/^(?:places\/)?((?:ChIJ|GhIJ|EhIJ|Ei|E)[A-Za-z0-9_-]{8,})$/);
  if (direct) return direct[1];
  // URL com place_id na query
  const fromQuery = value.match(/[?&](?:place_id|placeid)=([A-Za-z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  // URL com 0x...:0x... (cid) — não é place id; devolve null para buscar por texto
  return null;
}

async function resolvePlaceId(input: string, apiKey: string): Promise<string | null> {
  const direct = extractPlaceId(input);
  if (direct) return direct;

  // Busca por texto (nome do negócio ou link do Maps com nome)
  let query = input.trim();
  const fromMapsUrl = query.match(/\/maps\/place\/([^/@?]+)/);
  if (fromMapsUrl) query = decodeURIComponent(fromMapsUrl[1].replace(/\+/g, " "));

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "pt-BR" }),
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  return json?.places?.[0]?.id ?? null;
}

/** Salva/atualiza o local do Google Meu Negócio do buffet logado. */
export const connectGooglePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ input: z.string().min(2).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "A chave da API do Google ainda não foi configurada." };
    }

    const placeId = await resolvePlaceId(data.input, apiKey);
    if (!placeId) {
      return { ok: false as const, error: "Não encontramos esse negócio no Google. Tente o link do Google Maps ou o Place ID." };
    }

    const { error } = await (context.supabase as any)
      .from("buffet_settings")
      .upsert({ owner_id: context.userId, google_place_id: placeId }, { onConflict: "owner_id" });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, placeId };
  });

/** Remove a conexão com o Google Meu Negócio. */
export const disconnectGooglePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (context.supabase as any)
      .from("buffet_settings")
      .update({ google_place_id: null })
      .eq("owner_id", context.userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Busca as avaliações do Google do buffet logado. */
export const getGoogleReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleReviewsResult> => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    const { data: settings } = await (context.supabase as any)
      .from("buffet_settings")
      .select("google_place_id")
      .eq("owner_id", context.userId)
      .maybeSingle();

    const placeId: string | null = settings?.google_place_id ?? null;

    if (!placeId) return { configured: false, hasApiKey: !!apiKey, placeId: null, reviews: [] };
    if (!apiKey) return { configured: true, hasApiKey: false, placeId, reviews: [] };

    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,reviews",
      },
    });

    if (!res.ok) {
      return {
        configured: true,
        hasApiKey: true,
        placeId,
        reviews: [],
        error: "Não foi possível carregar as avaliações do Google agora.",
      };
    }

    const json: any = await res.json();
    const reviews: GoogleReview[] = (json?.reviews ?? []).map((r: any) => ({
      author: r?.authorAttribution?.displayName ?? "Anônimo",
      rating: Number(r?.rating ?? 0),
      text: r?.originalText?.text ?? r?.text?.text ?? "",
      createdAt: r?.publishTime ?? "",
      profilePhoto: r?.authorAttribution?.photoUri ?? undefined,
    }));

    return {
      configured: true,
      hasApiKey: true,
      placeId,
      name: json?.displayName?.text ?? undefined,
      rating: Number(json?.rating ?? 0),
      total: Number(json?.userRatingCount ?? 0),
      reviews,
    };
  });

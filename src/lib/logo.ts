import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "buffet-logos";
const MARKER = `/${BUCKET}/`;

/**
 * Accepts either a raw storage path (`<owner>/logo-xxx.png`) or a legacy
 * absolute Supabase URL (public/signed). Returns the object path inside the
 * `buffet-logos` bucket, or "" when there is no logo.
 */
export function extractLogoPath(value?: string | null): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  const i = v.indexOf(MARKER);
  if (i >= 0) return v.substring(i + MARKER.length).split("?")[0];
  return v;
}

/**
 * Generates a fresh signed URL for the current session. Cached for 30 min and
 * regenerated automatically on remount / when the stored value changes, so the
 * logo never breaks due to signed-URL expiration.
 */
export function useLogoDisplayUrl(value?: string | null) {
  const path = extractLogoPath(value);
  return useQuery({
    queryKey: ["logo-signed-url", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** One-shot signed URL, for imperative flows (e.g. print). */
export async function getLogoDisplayUrl(value?: string | null): Promise<string> {
  const path = extractLogoPath(value);
  if (!path) return "";
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}

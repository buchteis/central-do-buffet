import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublicTenantLogo = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("owner_id, status")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!tenant || tenant.status !== "ativo") return { url: "" as string };

    const { data: settings } = await supabaseAdmin
      .from("buffet_settings")
      .select("logo_url")
      .eq("owner_id", tenant.owner_id)
      .maybeSingle();

    const path = (settings?.logo_url ?? "").trim();
    if (!path) return { url: "" };

    const { data: signed } = await supabaseAdmin.storage
      .from("buffet-logos")
      .createSignedUrl(path, 60 * 60);

    return { url: signed?.signedUrl ?? "" };
  });

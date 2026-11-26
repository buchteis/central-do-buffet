import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { activeTenantPackages } from "./public-package-selection";

export const getPublicQuoteCatalog = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) throw new Error("Catálogo indisponível. Tente novamente.");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const tenantResult = await client.from("tenants").select("id, name, slug, status")
      .eq("slug", data.slug).eq("status", "ativo").maybeSingle();
    if (tenantResult.error) throw new Error("Não foi possível carregar o buffet.");
    const tenant = tenantResult.data;
    if (!tenant) return null;
    const packagesResult = await client.from("packages")
      .select("id, name, price_per_person, pricing_type, tenant_id, active")
      .eq("tenant_id", tenant.id).eq("active", true).order("name");
    if (packagesResult.error) throw new Error("Não foi possível carregar os pacotes.");
    const packages = activeTenantPackages(packagesResult.data ?? [], tenant.id);
    const ids = packages.map((p) => p.id);
    const [tiersResult, itemsResult] = await Promise.all([
      ids.length ? client.from("package_price_tiers")
        .select("id, package_id, min_guests, max_guests, price_per_person, price_fixed, position, updated_at")
        .in("package_id", ids).order("position") : Promise.resolve({ data: [], error: null }),
      client.from("additional_items").select("id, name, unit, unit_price, default_qty, position")
        .eq("tenant_id", tenant.id).eq("active", true).order("position"),
    ]);
    if (tiersResult.error || itemsResult.error) throw new Error("Não foi possível carregar os preços do catálogo.");
    return { tenant, packages, tiers: tiersResult.data ?? [], items: itemsResult.data ?? [] };
  });
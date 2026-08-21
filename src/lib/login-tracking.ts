import { supabase } from "@/integrations/supabase/client";

export function detectDevice(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return "tablet";
  if (/android|iphone|ipod|mobile|windows phone|opera mini/.test(s)) return "celular";
  if (!s) return "desconhecido";
  return "computador";
}

/** Registra o acesso (data/hora + dispositivo) uma vez por sessão do navegador. */
export async function recordLogin(userId: string, tenantId?: string | null) {
  if (typeof window === "undefined") return;
  const key = `cdb_login_logged:${userId}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");

  const ua = navigator.userAgent;
  const device = detectDevice(ua);

  const { data: existing } = await supabase
    .from("tenant_logins")
    .select("login_count")
    .eq("user_id", userId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    tenant_id: tenantId ?? null,
    last_login_at: new Date().toISOString(),
    device,
    user_agent: ua.slice(0, 400),
    login_count: ((existing as any)?.login_count ?? 0) + 1,
  };

  if (existing) {
    await supabase.from("tenant_logins").update(payload).eq("user_id", userId);
  } else {
    await supabase.from("tenant_logins").insert(payload);
  }
}

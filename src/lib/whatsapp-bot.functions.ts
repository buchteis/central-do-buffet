import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function myTenant(supabase: any, userId: string) {
  const { data, error } = await supabase.from("tenants").select("id, status").eq("owner_id", userId).maybeSingle();
  if (error) throw new Error("Não foi possível verificar seu buffet.");
  if (!data) throw new Error("Nenhum buffet vinculado à sua conta.");
  return data as { id: string; status: string };
}

function friendly(e: unknown): string {
  const status = (e as any)?.status;
  if (status === 0) return "O servidor de WhatsApp ainda não foi configurado.";
  if (status === 401 || status === 403) return "O servidor de WhatsApp recusou a chave de acesso.";
  if (status === 404) return "Sessão de WhatsApp não encontrada no servidor. Clique em Conectar novamente.";
  if (e instanceof TypeError) return "Não foi possível falar com o servidor de WhatsApp. Verifique se ele está no ar.";
  return (e as Error)?.message || "Falha ao falar com o servidor de WhatsApp.";
}

export const getWhatsappOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { evolutionConfig } = await import("./evolution.server");
    const { data } = await (context.supabase as any)
      .from("whatsapp_instances")
      .select("id, status, phone_number, profile_name, bot_enabled, qr_code, qr_updated_at, last_event_at")
      .maybeSingle();
    return { serverConfigured: !!evolutionConfig(), instance: (data ?? null) as null | Record<string, any> };
  });

export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenant = await myTenant(context.supabase, context.userId);
    const evo = await import("./evolution.server");
    const { toQrDataUrl, mapConnectionState } = await import("./evolution-parse");
    if (!evo.evolutionConfig()) return { ok: false as const, error: "O servidor de WhatsApp ainda não foi configurado." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    let { data: inst, error } = await admin.from("whatsapp_instances").select("*").eq("tenant_id", tenant.id).maybeSingle();
    if (error) return { ok: false as const, error: "Erro ao ler a conexão." };
    if (!inst) {
      const ins = await admin
        .from("whatsapp_instances")
        .insert({
          tenant_id: tenant.id,
          owner_id: context.userId,
          instance_name: `cb_${tenant.id.replace(/-/g, "")}`,
        })
        .select("*")
        .single();
      if (ins.error) return { ok: false as const, error: "Erro ao criar a conexão." };
      inst = ins.data;
    }

    const hook = evo.webhookUrlFor(inst.webhook_secret);
    let qr: string | null = null;
    try {
      try {
        const created: any = await evo.createInstance(inst.instance_name, hook);
        qr = toQrDataUrl(created?.qrcode?.base64);
      } catch (e: any) {
        // Instance already exists on the server — reuse it.
        if (![400, 403, 409].includes(e?.status)) throw e;
      }
      await evo.setWebhook(inst.instance_name, hook).catch((e) => console.error("setWebhook", e));
      const state = mapConnectionState((await evo.connectionState(inst.instance_name))?.instance?.state);
      if (state === "connected") {
        const info = await evo.fetchInstanceInfo(inst.instance_name).catch(() => ({ phone: null, profileName: null }));
        await admin
          .from("whatsapp_instances")
          .update({ status: "connected", qr_code: null, phone_number: info.phone, profile_name: info.profileName })
          .eq("id", inst.id);
        return { ok: true as const, status: "connected" as const, qr: null };
      }
      if (!qr) qr = toQrDataUrl((await evo.connectInstance(inst.instance_name))?.base64);
    } catch (e) {
      return { ok: false as const, error: friendly(e) };
    }
    await admin
      .from("whatsapp_instances")
      .update({ status: "connecting", qr_code: qr, qr_updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    return { ok: true as const, status: "connecting" as const, qr };
  });

export const refreshWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ refreshQr: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const tenant = await myTenant(context.supabase, context.userId);
    const evo = await import("./evolution.server");
    const { toQrDataUrl, mapConnectionState } = await import("./evolution-parse");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("tenant_id", tenant.id).maybeSingle();
    if (!inst) return { status: "disconnected" as const, qr: null, phone: null, error: null as string | null };
    try {
      const status = mapConnectionState((await evo.connectionState(inst.instance_name))?.instance?.state);
      const patch: Record<string, unknown> = { status };
      let qr: string | null = inst.qr_code ?? null;
      if (status === "connected") {
        const info = await evo.fetchInstanceInfo(inst.instance_name).catch(() => ({ phone: null, profileName: null }));
        Object.assign(patch, {
          qr_code: null,
          phone_number: info.phone ?? inst.phone_number,
          profile_name: info.profileName ?? inst.profile_name,
        });
        qr = null;
      } else if (data.refreshQr) {
        const fresh = toQrDataUrl((await evo.connectInstance(inst.instance_name))?.base64);
        if (fresh) {
          qr = fresh;
          Object.assign(patch, { qr_code: fresh, qr_updated_at: new Date().toISOString(), status: "connecting" });
        }
      }
      await admin.from("whatsapp_instances").update(patch).eq("id", inst.id);
      return {
        status: (patch.status as string) as "connected" | "connecting" | "disconnected",
        qr,
        phone: (patch.phone_number as string) ?? inst.phone_number ?? null,
        error: null,
      };
    } catch (e) {
      return { status: inst.status, qr: inst.qr_code ?? null, phone: inst.phone_number ?? null, error: friendly(e) };
    }
  });

export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenant = await myTenant(context.supabase, context.userId);
    const evo = await import("./evolution.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("tenant_id", tenant.id).maybeSingle();
    if (!inst) return { ok: true };
    await evo.logoutInstance(inst.instance_name).catch(() => null);
    await evo.deleteInstance(inst.instance_name).catch(() => null);
    await admin
      .from("whatsapp_instances")
      .update({ status: "disconnected", qr_code: null, phone_number: null, profile_name: null, bot_enabled: false })
      .eq("id", inst.id);
    return { ok: true };
  });

export const sendOwnerWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: z.string().uuid(), text: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const tenant = await myTenant(context.supabase, context.userId);
    // RLS guarantees the conversation belongs to the caller's buffet.
    const { data: conv } = await (context.supabase as any)
      .from("whatsapp_conversations")
      .select("id, tenant_id, phone, remote_jid")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.tenant_id !== tenant.id) return { ok: false as const, error: "Conversa não encontrada." };

    const evo = await import("./evolution.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("tenant_id", tenant.id).maybeSingle();
    if (!inst || inst.status !== "connected") return { ok: false as const, error: "Seu WhatsApp não está conectado." };

    let sentId: string | null = null;
    try {
      sentId = (await evo.sendText(inst.instance_name, conv.phone ?? conv.remote_jid, data.text)).messageId;
    } catch (e) {
      return { ok: false as const, error: friendly(e) };
    }
    const now = new Date().toISOString();
    await admin.from("whatsapp_messages").insert({
      tenant_id: tenant.id,
      conversation_id: conv.id,
      direction: "out",
      sender: "owner",
      body: data.text,
      wa_message_id: sentId,
    });
    await admin
      .from("whatsapp_conversations")
      .update({ last_message_at: now, last_message_preview: data.text.slice(0, 120), unread_count: 0 })
      .eq("id", conv.id);
    return { ok: true as const };
  });

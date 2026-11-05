import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export type WhatsappInstanceOverview = {
  id: string;
  status: string;
  phone_number: string | null;
  profile_name: string | null;
  bot_enabled: boolean;
  qr_code: string | null;
  qr_updated_at: string | null;
  last_event_at: string | null;
};

async function myTenantId(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("current_tenant_id");
  if (error) throw new Error("Não foi possível verificar seu buffet.");
  if (!data) throw new Error("Nenhum buffet vinculado à sua conta.");
  return data;
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
    const { evolutionConfig, toQrDataUrl } = await import("./evolution.server");
    const { data: tenantId, error: tenantError } = await context.supabase.rpc("current_tenant_id");
    if (tenantError) throw new Error("Não foi possível verificar seu buffet.");
    if (!tenantId) throw new Error("Nenhum buffet vinculado à sua conta.");
    const { data, error } = await context.supabase
      .from("whatsapp_instances")
      .select("id, status, phone_number, profile_name, bot_enabled, qr_code, qr_updated_at, last_event_at")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a conexão do WhatsApp.");
    const qrCode = data?.qr_code ? await toQrDataUrl(data.qr_code) : null;
    return { serverConfigured: !!evolutionConfig(), instance: data ? { ...data, qr_code: qrCode } : null };
  });

const ConnectWhatsappInput = z.object({
  phoneNumber: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, "Informe um número de telefone válido.").optional(),
});

export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConnectWhatsappInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const tenantId = await myTenantId(context.supabase);
    const evo = await import("./evolution.server");
    const { formatPairingCode, mapConnectionState } = await import("./evolution-parse");
    const { toQrDataUrl } = evo;
    if (!evo.evolutionConfig()) return { ok: false as const, error: "O servidor de WhatsApp ainda não foi configurado." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    let { data: inst, error } = await admin.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (error) return { ok: false as const, error: "Erro ao ler a conexão." };
    if (!inst) {
      const ins = await admin
        .from("whatsapp_instances")
        .insert({
          tenant_id: tenantId,
          owner_id: context.userId,
          instance_name: `cb_${tenantId.replace(/-/g, "")}`,
        })
        .select("*")
        .single();
      if (ins.error) return { ok: false as const, error: "Erro ao criar a conexão." };
      inst = ins.data;
    }

    const hook = evo.webhookUrlFor(inst.webhook_secret);
    let qr: string | null = null;
    let pairingCode: string | null = null;
    try {
      try {
        const created: any = await evo.createInstance(inst.instance_name, hook);
        qr = await toQrDataUrl(created?.qrcode?.base64);
      } catch (e: any) {
        // Instance already exists on the server — reuse it.
        if (![400, 403, 409].includes(e?.status)) throw e;
      }
      await evo.setWebhook(inst.instance_name, hook);
      const state = mapConnectionState((await evo.connectionState(inst.instance_name))?.instance?.state);
      if (state === "connected") {
        const info = await evo.fetchInstanceInfo(inst.instance_name).catch(() => ({ phone: null, profileName: null }));
        await admin
          .from("whatsapp_instances")
          .update({ status: "connected", qr_code: null, phone_number: info.phone, profile_name: info.profileName })
          .eq("id", inst.id);
        return { ok: true as const, status: "connected" as const, qr: null, pairingCode: null };
      }
      if (data.phoneNumber) {
        const codeResponse = await evo.connectInstance(inst.instance_name, data.phoneNumber.replace(/\D/g, ""));
        pairingCode = formatPairingCode(codeResponse.pairingCode ?? codeResponse.code);
        qr = null;
        if (!pairingCode) throw new Error("A Evolution API não retornou um código de pareamento válido.");
      } else if (!qr) {
        const connectResponse = await evo.connectInstance(inst.instance_name);
        qr = await toQrDataUrl(connectResponse.base64);
      }
    } catch (e) {
      return { ok: false as const, error: friendly(e) };
    }
    await admin
      .from("whatsapp_instances")
      .update({ status: "connecting", qr_code: qr, qr_updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    return { ok: true as const, status: "connecting" as const, qr, pairingCode };
  });

export const refreshWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ refreshQr: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const tenantId = await myTenantId(context.supabase);
    const evo = await import("./evolution.server");
    const { mapConnectionState } = await import("./evolution-parse");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (!inst) return { status: "disconnected" as const, qr: null, phone: null, error: null as string | null };
    try {
      const status = mapConnectionState((await evo.connectionState(inst.instance_name))?.instance?.state);
      const patch: Record<string, unknown> = { status };
      let qr: string | null = await evo.toQrDataUrl(inst.qr_code);
      if (status === "connected") {
        const info = await evo.fetchInstanceInfo(inst.instance_name).catch(() => ({ phone: null, profileName: null }));
        Object.assign(patch, {
          qr_code: null,
          phone_number: info.phone ?? inst.phone_number,
          profile_name: info.profileName ?? inst.profile_name,
        });
        qr = null;
      } else if (data.refreshQr) {
        const fresh = await evo.toQrDataUrl((await evo.connectInstance(inst.instance_name))?.base64);
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
    const tenantId = await myTenantId(context.supabase);
    const evo = await import("./evolution.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
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
    const tenantId = await myTenantId(context.supabase);
    // RLS guarantees the conversation belongs to the caller's buffet.
    const { data: conv } = await (context.supabase as any)
      .from("whatsapp_conversations")
      .select("id, tenant_id, phone, remote_jid")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.tenant_id !== tenantId) return { ok: false as const, error: "Conversa não encontrada." };

    const evo = await import("./evolution.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (!inst || inst.status !== "connected") return { ok: false as const, error: "Seu WhatsApp não está conectado." };

    let sentId: string | null = null;
    try {
      sentId = (await evo.sendText(inst.instance_name, conv.phone ?? conv.remote_jid, data.text)).messageId;
    } catch (e) {
      return { ok: false as const, error: friendly(e) };
    }
    const now = new Date().toISOString();
    await admin.from("whatsapp_messages").insert({
      tenant_id: tenantId,
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

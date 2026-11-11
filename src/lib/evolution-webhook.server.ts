import { mapConnectionState, parseInboundMessage } from "./evolution-parse";
import { toQrDataUrl } from "./evolution.server";

type Admin = any;

const TokenSchema = /^[a-f0-9]{32,128}$/;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

async function findInstance(admin: Admin, token: string | null, payload: any) {
  if (token) {
    if (!TokenSchema.test(token)) return null;
    const { data, error } = await admin.from("whatsapp_instances").select("*").eq("webhook_secret", token).maybeSingle();
    if (error) throw error;
    if (data && payload?.instance && payload.instance !== data.instance_name) return null;
    return data;
  }

  const instanceName = payload?.instance;
  if (typeof instanceName !== "string" || !instanceName.trim()) return null;
  const { data, error } = await admin.from("whatsapp_instances").select("*").eq("instance_name", instanceName).maybeSingle();
  if (error) throw error;
  return data;
}

export async function handleEvolutionWebhook(request: Request, token: string | null = null) {
  if (token && !TokenSchema.test(token)) return new Response("Not found", { status: 404 });
  if (!token) {
    if (!(process.env.WEBHOOK_SECRET ?? "").trim()) return new Response("Webhook is not configured", { status: 503 });
    const suppliedSecret = request.headers.get("WEBHOOK_SECRET") ?? request.headers.get("x-webhook-secret");
    if (!suppliedSecret || suppliedSecret !== process.env.WEBHOOK_SECRET?.trim()) return unauthorized();
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return new Response("Too large", { status: 413 });

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return new Response("Too large", { status: 413 });

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  let instance: any;
  try {
    instance = await findInstance(admin, token, payload);
  } catch (error) {
    console.error("webhook instance lookup", error);
    return new Response("Database error", { status: 500 });
  }
  if (!instance) return unauthorized();

  const event = String(payload?.event ?? "").toLowerCase().replace(/_/g, ".");
  const now = new Date().toISOString();

  if (event === "connection.update") {
    const status = mapConnectionState(payload?.data?.state);
    const patch: Record<string, unknown> = { status, last_event_at: now };
    if (status === "connected") {
      patch.qr_code = null;
      const wuid: string | undefined = payload?.data?.wuid ?? payload?.sender;
      if (wuid) patch.phone_number = String(wuid).split("@")[0].split(":")[0];
      if (payload?.data?.profileName) patch.profile_name = payload.data.profileName;
    }
    const { error } = await admin.from("whatsapp_instances").update(patch).eq("id", instance.id);
    if (error) return new Response("Database error", { status: 500 });
    return new Response("ok");
  }

  if (event === "qrcode.updated") {
    const qr = await toQrDataUrl(payload?.data?.qrcode?.base64 ?? payload?.data?.base64);
    if (qr) {
      const { error } = await admin
        .from("whatsapp_instances")
        .update({ qr_code: qr, qr_updated_at: now, status: "connecting", last_event_at: now })
        .eq("id", instance.id);
      if (error) return new Response("Database error", { status: 500 });
    }
    return new Response("ok");
  }

  if (event !== "messages.upsert") return new Response("ignored");

  const items: any[] = Array.isArray(payload?.data) ? payload.data : [payload?.data];
  const { replyToInbound, recoverPendingReplies } = await import("@/lib/whatsapp-agent.server");
  let failed = false;
  let lastId: string | undefined;

  for (const item of items) {
    const parsed = parseInboundMessage(item);
    if (parsed.kind !== "message") continue;

    const { data: existingConv, error: convSelErr } = await admin
      .from("whatsapp_conversations")
      .select("id, unread_count, contact_name, phone")
      .eq("tenant_id", instance.tenant_id)
      .eq("remote_jid", parsed.remoteJid)
      .maybeSingle();
    if (convSelErr) return new Response("Database error", { status: 500 });

    let convId: string;
    if (existingConv) {
      convId = existingConv.id;
    } else {
      const { data: created, error: convInsErr } = await admin
        .from("whatsapp_conversations")
        .upsert(
          {
            tenant_id: instance.tenant_id,
            remote_jid: parsed.remoteJid,
            phone: parsed.replyTo,
            contact_name: parsed.pushName,
          },
          { onConflict: "tenant_id,remote_jid" },
        )
        .select("id")
        .single();
      if (convInsErr) return new Response("Database error", { status: 500 });
      convId = created.id;
    }

    const { data: inserted, error: insErr } = await admin
      .from("whatsapp_messages")
      .insert({
        tenant_id: instance.tenant_id,
        conversation_id: convId,
        direction: "in",
        sender: "client",
        body: parsed.text,
        wa_message_id: parsed.waMessageId,
        reply_status: "pending",
      })
      .select("id")
      .single();

    let messageId: string;
    if (insErr) {
      if (insErr.code !== "23505") return new Response("Database error", { status: 500 });
      const { data: dup, error: dupErr } = await admin
        .from("whatsapp_messages")
        .select("id")
        .eq("tenant_id", instance.tenant_id)
        .eq("wa_message_id", parsed.waMessageId)
        .single();
      if (dupErr) return new Response("Database error", { status: 500 });
      messageId = dup.id;
    } else {
      messageId = inserted.id;
      const { error: updErr } = await admin
        .from("whatsapp_conversations")
        .update({
          last_message_at: now,
          last_message_preview: clip(parsed.text),
          unread_count: (existingConv?.unread_count ?? 0) + 1,
          contact_name: existingConv?.contact_name ?? parsed.pushName,
          phone: existingConv?.phone ?? parsed.replyTo,
        })
        .eq("id", convId);
      if (updErr) return new Response("Database error", { status: 500 });
    }

    try {
      const outcome = await replyToInbound(admin, instance, messageId);
      if (outcome === "failed") failed = true;
    } catch (error) {
      console.error("replyToInbound", error);
      failed = true;
    }
    lastId = messageId;
  }

  await recoverPendingReplies(admin, instance, lastId);
  await admin.from("whatsapp_instances").update({ last_event_at: now }).eq("id", instance.id);
  return failed ? new Response("reply failed", { status: 500 }) : new Response("ok");
}

// WhatsApp virtual attendant: builds buffet context, asks the AI and processes inbound messages.
// Server only — uses the privileged database client after the webhook caller is verified.
import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";
import { sendText, publicAppOrigin } from "./evolution.server";

type Admin = any;

export type AgentResult = {
  reply: string;
  handoff: boolean;
  handoff_reason: string | null;
  lead: {
    name: string | null;
    event_type: string | null;
    event_date: string | null;
    guest_count: number | null;
  };
};

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "handoff", "handoff_reason", "lead"],
  properties: {
    reply: { type: "string", description: "Mensagem a enviar ao cliente no WhatsApp." },
    handoff: {
      type: "boolean",
      description: "true quando o cliente quer fechar/contratar, pede uma pessoa, reclama ou a dúvida foge do que você sabe.",
    },
    handoff_reason: { type: ["string", "null"], description: "Motivo curto do encaminhamento ao dono." },
    lead: {
      type: "object",
      additionalProperties: false,
      required: ["name", "event_type", "event_date", "guest_count"],
      properties: {
        name: { type: ["string", "null"] },
        event_type: { type: ["string", "null"] },
        event_date: { type: ["string", "null"], description: "Data desejada como o cliente informou." },
        guest_count: { type: ["integer", "null"] },
      },
    },
  },
} as const;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function buildBuffetKnowledge(admin: Admin, tenantId: string) {
  const [tenantRes, settingsRes, packagesRes, tiersRes, extrasRes] = await Promise.all([
    admin.from("tenants").select("name, slug, city, contact_phone, owner_id").eq("id", tenantId).maybeSingle(),
    admin
      .from("buffet_settings")
      .select("business_name, address, phone, whatsapp")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("packages")
      .select("id, name, description, included_items, pricing_type, price_per_person, min_people, max_people, active")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("name"),
    admin
      .from("package_price_tiers")
      .select("package_id, min_guests, max_guests, price_per_person, price_fixed, position")
      .eq("tenant_id", tenantId)
      .order("min_guests"),
    admin
      .from("additional_items")
      .select("name, unit, unit_price, active")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("position"),
  ]);

  const tenant = tenantRes.data;
  const settings = settingsRes.data;
  const tiers = (tiersRes.data ?? []) as any[];
  const packages = ((packagesRes.data ?? []) as any[]).map((p) => {
    const isFixed = String(p.pricing_type ?? "per_person") === "fixed";
    const faixas = tiers
      .filter((t) => t.package_id === p.id)
      .map((t) =>
        isFixed
          ? `de ${t.min_guests} a ${t.max_guests} convidados: ${brl(Number(t.price_fixed || 0))} (preço fechado)`
          : `de ${t.min_guests} a ${t.max_guests} convidados: ${brl(Number(t.price_per_person || 0))} por pessoa`,
      );
    return {
      nome: p.name,
      descricao: p.description ?? null,
      itens_inclusos: p.included_items ?? [],
      cobranca: isFixed ? "preço fechado" : "por pessoa",
      preco_base_por_pessoa: isFixed ? null : brl(Number(p.price_per_person || 0)),
      convidados_min: p.min_people ?? null,
      convidados_max: p.max_people ?? null,
      faixas_de_preco: faixas,
    };
  });

  return {
    tenant,
    settings,
    knowledge: {
      buffet: settings?.business_name || tenant?.name || "o buffet",
      cidade: tenant?.city ?? null,
      endereco: settings?.address ?? null,
      telefone: settings?.phone ?? tenant?.contact_phone ?? null,
      link_orcamento_online: tenant?.slug ? `${publicAppOrigin()}/orcamento/${tenant.slug}` : null,
      pacotes: packages,
      itens_adicionais: ((extrasRes.data ?? []) as any[]).map((i) => ({
        nome: i.name,
        preco: `${brl(Number(i.unit_price || 0))} por ${i.unit || "unidade"}`,
      })),
    },
  };
}

function systemPrompt(knowledge: unknown, conv: any) {
  return `Você é o atendente comercial virtual do buffet descrito abaixo, conversando pelo WhatsApp.
Tom: educado, acolhedor, ágil e profissional, como uma pessoa real da equipe. Português do Brasil. Mensagens curtas (até ~5 linhas), sem markdown pesado; pode usar 1 emoji quando fizer sentido. Nunca diga que é uma IA a menos que perguntem diretamente.

Roteiro:
a) Cumprimente com cordialidade e, de forma natural (no máximo 2 perguntas por mensagem), descubra: nome, tipo de evento (aniversário, casamento, corporativo etc.), data desejada e número estimado de convidados.
b) Com o número de convidados, apresente os pacotes e as faixas de preço EXATAMENTE como estão nos dados. Nunca invente preços, pacotes, itens ou disponibilidade de data. Se não houver pacote cadastrado, diga que um atendente enviará os valores.
c) Tire dúvidas gerais (duração, equipe inclusa, bebidas, itens adicionais) só com o que está nos dados; se não souber, diga que vai confirmar com a equipe.
d) Se o cliente quiser fechar/contratar/reservar a data, pedir para falar com uma pessoa, reclamar, negociar desconto ou a conversa sair do que você sabe: responda que um atendente vai continuar o atendimento em instantes e marque handoff=true com o motivo.
Se houver link de orçamento online, você pode oferecê-lo para o cliente simular e enviar o pedido.

Preencha "lead" com o que já souber da conversa inteira (null quando não souber).
Dados já conhecidos deste cliente: ${JSON.stringify({
    nome: conv.lead_name ?? conv.contact_name ?? null,
    tipo_evento: conv.event_type ?? null,
    data: conv.event_date ?? null,
    convidados: conv.guest_count ?? null,
  })}

DADOS DO BUFFET (fonte única de verdade):
${JSON.stringify(knowledge, null, 2)}`;
}

function outputText(res: any): string {
  if (typeof res?.output_text === "string" && res.output_text) return res.output_text;
  const parts: string[] = [];
  for (const item of res?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const c of item.content ?? []) if (c?.type === "output_text" && c.text) parts.push(c.text);
  }
  return parts.join("");
}

export async function runAgent(knowledge: unknown, conv: any, history: { sender: string; body: string }[]) {
  const input = history
    .filter((m) => m.body?.trim())
    .map((m) =>
      m.sender === "client"
        ? ({ role: "user" as const, content: m.body })
        : ({ role: "assistant" as const, content: [{ type: "output_text" as const, text: m.body, annotations: [] }] }),
    );
  if (!input.length || input[input.length - 1].role !== "user") {
    input.push({ role: "user", content: "(o cliente enviou uma mensagem sem texto)" });
  }

  const res = await generateResponse({
    model: "openai/gpt-6-astra",
    instructions: systemPrompt(knowledge, conv),
    input: input as any,
    reasoning: { effort: "low" },
    max_output_tokens: 1200,
    text: { format: { type: "json_schema", name: "atendimento", strict: true, schema: RESULT_SCHEMA as any } },
  });
  const raw = outputText(res);
  const parsed = JSON.parse(raw) as AgentResult;
  if (!parsed?.reply?.trim()) throw new Error("Resposta vazia da IA");
  return parsed;
}

const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Generate and send the bot reply for one stored inbound message.
 * Idempotent: only a message in pending/failed state is claimed; sent/skipped ones are left alone.
 */
export async function replyToInbound(admin: Admin, instance: any, messageId: string): Promise<"sent" | "skipped" | "failed" | "noop"> {
  const { data: msg, error: msgErr } = await admin
    .from("whatsapp_messages")
    .select("id, tenant_id, conversation_id, created_at, reply_status, reply_attempts")
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr) throw msgErr;
  if (!msg || !["pending", "failed"].includes(msg.reply_status)) return "noop";

  const { data: conv, error: convErr } = await admin
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", msg.conversation_id)
    .maybeSingle();
  if (convErr) throw convErr;

  const skip = async (reason: string) => {
    const { error } = await admin
      .from("whatsapp_messages")
      .update({ reply_status: "skipped", reply_error: reason })
      .eq("id", msg.id);
    if (error) throw error;
    return "skipped" as const;
  };

  if (!conv) return skip("conversa não encontrada");
  if (!instance.bot_enabled) return skip("robô desligado");
  if (conv.bot_paused) return skip("atendimento humano");

  // A newer customer message will be answered with the full history — avoid double replies.
  const { count: newer, error: newerErr } = await admin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conv.id)
    .eq("direction", "in")
    .gt("created_at", msg.created_at);
  if (newerErr) throw newerErr;
  if ((newer ?? 0) > 0) return skip("respondida junto com mensagem mais nova");

  // Claim
  const { data: claimed, error: claimErr } = await admin
    .from("whatsapp_messages")
    .update({ reply_status: "sending", reply_attempts: (msg.reply_attempts ?? 0) + 1, reply_error: null })
    .eq("id", msg.id)
    .in("reply_status", ["pending", "failed"])
    .select("id");
  if (claimErr) throw claimErr;
  if (!claimed?.length) return "noop";

  const fail = async (err: unknown) => {
    const text =
      err instanceof GatewayError
        ? `IA: ${err.code ?? err.name} ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("WhatsApp reply failed", msg.id, text);
    await admin.from("whatsapp_messages").update({ reply_status: "failed", reply_error: clip(text, 500) }).eq("id", msg.id);
    return "failed" as const;
  };

  let result: AgentResult;
  try {
    const { data: history, error: histErr } = await admin
      .from("whatsapp_messages")
      .select("sender, body, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (histErr) throw histErr;
    const { knowledge } = await buildBuffetKnowledge(admin, instance.tenant_id);
    result = await runAgent(knowledge, conv, [...(history ?? [])].reverse());
  } catch (e) {
    return fail(e);
  }

  let sentId: string | null = null;
  try {
    const sent = await sendText(instance.instance_name, conv.phone ?? conv.remote_jid, result.reply);
    sentId = sent.messageId;
  } catch (e) {
    return fail(e);
  }

  // From here the message is already delivered to WhatsApp — record it.
  const now = new Date().toISOString();
  await admin.from("whatsapp_messages").insert({
    tenant_id: conv.tenant_id,
    conversation_id: conv.id,
    direction: "out",
    sender: "bot",
    body: result.reply,
    wa_message_id: sentId,
  });
  await admin.from("whatsapp_messages").update({ reply_status: "sent" }).eq("id", msg.id);

  const lead = result.lead ?? ({} as AgentResult["lead"]);
  const convUpdate: Record<string, unknown> = {
    last_message_at: now,
    last_message_preview: clip(result.reply),
    lead_name: lead.name ?? conv.lead_name,
    event_type: lead.event_type ?? conv.event_type,
    event_date: lead.event_date ?? conv.event_date,
    guest_count: Number.isInteger(lead.guest_count) ? lead.guest_count : conv.guest_count,
  };
  if (result.handoff) {
    Object.assign(convUpdate, {
      bot_paused: true,
      needs_human: true,
      handoff_reason: result.handoff_reason ?? "Cliente precisa de atendimento humano",
      handoff_at: now,
    });
  }
  await admin.from("whatsapp_conversations").update(convUpdate).eq("id", conv.id);

  if (result.handoff) await notifyOwner(admin, instance, conv, result).catch((e) => console.error("notifyOwner", e));
  return "sent";
}

async function notifyOwner(admin: Admin, instance: any, conv: any, result: AgentResult) {
  const { data: settings } = await admin
    .from("buffet_settings")
    .select("whatsapp")
    .eq("tenant_id", instance.tenant_id)
    .maybeSingle();
  const digits = String(settings?.whatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 10) return;
  const to = digits.length <= 11 ? `55${digits}` : digits;
  const name = result.lead?.name ?? conv.lead_name ?? conv.contact_name ?? "Cliente";
  const text =
    `🔔 Central do Buffet — atendimento humano\n` +
    `${name} (${conv.phone ?? "WhatsApp"}): ${result.handoff_reason ?? "precisa falar com você"}.\n` +
    `O robô pausou essa conversa. Abra o painel em WhatsApp para continuar.`;
  await sendText(instance.instance_name, to, text);
}

/** Bounded recovery: retry a few pending/failed replies left by earlier deliveries. */
export async function recoverPendingReplies(admin: Admin, instance: any, excludeId?: string) {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await admin
    .from("whatsapp_messages")
    .select("id")
    .eq("tenant_id", instance.tenant_id)
    .eq("direction", "in")
    .in("reply_status", ["pending", "failed"])
    .lt("reply_attempts", 3)
    .lt("created_at", cutoff)
    .gt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .order("reply_attempts", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(3);
  if (error) {
    console.error("recoverPendingReplies", error);
    return;
  }
  for (const row of data ?? []) {
    if (row.id === excludeId) continue;
    try {
      await replyToInbound(admin, instance, row.id);
    } catch (e) {
      console.error("recover reply", row.id, e);
    }
  }
}

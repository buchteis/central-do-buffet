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
    budget: string | null;
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
      description:
        "true somente quando o cliente pede expressamente uma pessoa, pede desconto excepcional fora da tabela ou faz pergunta específica que você realmente não consegue responder.",
    },
    handoff_reason: { type: ["string", "null"], description: "Motivo curto do encaminhamento ao dono." },
    lead: {
      type: "object",
      additionalProperties: false,
      required: ["name", "event_type", "event_date", "guest_count", "budget"],
      properties: {
        name: { type: ["string", "null"] },
        event_type: { type: ["string", "null"] },
        event_date: { type: ["string", "null"], description: "Data desejada como o cliente informou." },
        guest_count: { type: ["integer", "null"] },
        budget: { type: ["string", "null"], description: "Orçamento máximo informado pelo cliente." },
      },
    },
  },
} as const;

const AGENT_TOOLS = [
  {
    type: "function",
    name: "listar_pacotes",
    description:
      "Lista todos os pacotes ativos e preços cadastrados para este buffet. Informe o número de convidados quando conhecido para receber a estimativa exata ou as faixas mais próximas.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        buffet_id: { type: "string", description: "ID do buffet informado pelo sistema." },
        convidados: {
          type: ["integer", "null"],
          description: "Número de convidados informado pelo cliente, ou null quando ainda não souber.",
        },
      },
      required: ["buffet_id", "convidados"],
    },
  },
  {
    type: "function",
    name: "consultar_agenda",
    description: "Verifica se existe evento ou pré-reserva ativa na data solicitada.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        buffet_id: { type: "string" },
        data: { type: "string", description: "Data no formato AAAA-MM-DD." },
      },
      required: ["buffet_id", "data"],
    },
  },
  {
    type: "function",
    name: "pre_reservar",
    description: "Cria uma pré-reserva pendente após verificar a agenda; nunca confirma o evento.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        buffet_id: { type: "string" },
        data: { type: "string", description: "Data no formato AAAA-MM-DD." },
        pacote_id: { type: "string" },
        telefone: { type: "string" },
        nome: { type: "string" },
      },
      required: ["buffet_id", "data", "pacote_id", "telefone", "nome"],
    },
  },
] as const;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PackageTier = {
  min_guests: number;
  max_guests: number;
  price_per_guest: number | null;
  price_fixed: number | null;
};

function positivePrice(value: unknown): number | null {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function relevantPackagePricing(
  pkg: { cobranca: string; preco_base: number | null; faixas_de_preco: PackageTier[] },
  guests: number | null,
) {
  const tiers = pkg.faixas_de_preco;
  if (guests === null || !Number.isInteger(guests) || guests <= 0) {
    return { convidados_considerados: null, faixas_relevantes: tiers, estimativa_total: null };
  }

  const matching = tiers.filter((tier) => guests >= tier.min_guests && guests <= tier.max_guests);
  const distanceToTier = (tier: PackageTier) =>
    Math.min(Math.abs(guests - tier.min_guests), Math.abs(guests - tier.max_guests));
  const closestDistance = tiers.length ? Math.min(...tiers.map(distanceToTier)) : null;
  const selected = matching.length
    ? matching
    : tiers.filter((tier) => distanceToTier(tier) === closestDistance);
  const isExactMatch = matching.length > 0;

  if (pkg.cobranca === "preço fechado") {
    return {
      convidados_considerados: guests,
      faixa_encontrada: isExactMatch,
      faixas_relevantes: selected,
      estimativa_total: isExactMatch ? (selected[0]?.price_fixed ?? null) : null,
    };
  }

  const hasBasePrice = tiers.length === 0 && pkg.preco_base !== null;
  const pricePerPerson = isExactMatch ? selected[0]?.price_per_guest ?? null : hasBasePrice ? pkg.preco_base : null;
  return {
    convidados_considerados: guests,
    faixa_encontrada: isExactMatch || hasBasePrice,
    faixas_relevantes: selected,
    preco_por_pessoa_aplicavel: pricePerPerson,
    estimativa_total: pricePerPerson === null ? null : pricePerPerson * guests,
  };
}

export async function buildBuffetKnowledge(admin: Admin, tenantId: string) {
  const [tenantRes, settingsRes, packagesRes, extrasRes] = await Promise.all([
    admin.from("tenants").select("name, slug, city, contact_phone").eq("id", tenantId).maybeSingle(),
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
      .from("additional_items")
      .select("name, unit, unit_price, active")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("position"),
  ]);

  for (const result of [tenantRes, settingsRes, packagesRes, extrasRes]) {
    if (result.error) throw result.error;
  }
  const tenant = tenantRes.data;
  if (!tenant) throw new Error("Buffet não encontrado para esta instância do WhatsApp.");
  const settings = settingsRes.data;
  const packageRows = (packagesRes.data ?? []) as any[];
  const packageIds = packageRows.map((pkg) => pkg.id);
  const tiersRes = packageIds.length
    ? await admin
        .from("package_price_tiers")
        .select("package_id, min_guests, max_guests, price_per_person, price_fixed, position")
        .in("package_id", packageIds)
        .order("min_guests")
    : { data: [], error: null };
  if (tiersRes.error) throw tiersRes.error;
  const tiers = (tiersRes.data ?? []) as any[];
  const packages = packageRows.map((p) => {
    const isFixed = String(p.pricing_type ?? "per_person") === "fixed";
    const packageTiers = tiers
      .filter((t) => t.package_id === p.id)
      .map((t) => ({
        min_guests: Number(t.min_guests),
        max_guests: Number(t.max_guests),
        price_per_guest: positivePrice(t.price_per_person),
        price_fixed: positivePrice(t.price_fixed),
      }));
    return {
      id: p.id,
      nome: p.name,
      descricao: p.description ?? null,
      itens_inclusos: p.included_items ?? [],
      cobranca: isFixed ? "preço fechado" : "por pessoa",
      preco_base: isFixed ? null : positivePrice(p.price_per_person),
      convidados_min: p.min_people ?? null,
      convidados_max: p.max_people ?? null,
      faixas_de_preco: packageTiers,
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
        preco: positivePrice(i.unit_price) ? `${brl(Number(i.unit_price))} por ${i.unit || "unidade"}` : null,
      })),
    },
  };
}

function systemPrompt(knowledge: unknown, conv: any) {
  return `Você é a assistente virtual inteligente da Central do Buffet. Você atende no WhatsApp de forma acolhedora, educada, ágil e focada em ajudar o cliente a escolher a melhor opção para a festa dele.

Regras Gerais de Conversação:

- Seja natural, cordial e clara. Use emojis com moderação.
- Nunca diga 'não tenho pacote cadastrado para esse grupo' nem trave o atendimento se houver qualquer pacote disponível.
- Se o pacote tiver preço por pessoa com faixas de convidados:
    * Calcule a estimativa multiplicando os convidados informados pelo valor da faixa correspondente e informe o total estimado de forma transparente.
    * Se o número de convidados não bater com uma faixa exata, mostre as faixas disponíveis educadamente (ex: 'Para até 50 pessoas o valor é R$ X por pessoa, e acima disso temos a faixa de R$ Y').
- Se o pacote for preço fixo (preço fechado), informe o valor total do pacote e quantos convidados ele cobre.
- Jamais mencione termos de banco de dados ou fale em 'R$ 0,00'.
- Conduza a conversa proativamente para entender: a data prevista do evento, o número estimado de pessoas e se gostaria de agendar uma pré-reserva.
- Só chame a equipe humana se o cliente pedir expressamente para falar com uma pessoa, se pedir descontos excepcionais fora da tabela, ou se fizer perguntas específicas que você realmente não tenha como responder.

Use listar_pacotes antes de recomendar pacotes ou preços. Quando souber o número de convidados, envie-o para a ferramenta; ela retorna a faixa aplicável e a estimativa ou, se o número ficar fora/entre faixas, as faixas mais próximas para você explicar sem interromper o atendimento. Use somente preços positivos disponíveis nos dados, não invente valores e não transforme valores ausentes em zero. Uma pré-reserva criada continua pendente até validação humana; isso não significa, por si só, que a equipe humana assumirá a conversa.

Para consultar a agenda ou criar uma pré-reserva, use as ferramentas disponíveis. Nunca confirme disponibilidade sem consultar a agenda e nunca diga que a data está confirmada. Só crie pré-reserva quando souber data, pacote, nome e telefone do cliente.

Preencha "lead" com o que já souber da conversa inteira (null quando não souber).
Dados já conhecidos deste cliente: ${JSON.stringify({
    nome: conv.lead_name ?? conv.contact_name ?? null,
    tipo_evento: conv.event_type ?? null,
    data: conv.event_date ?? null,
    convidados: conv.guest_count ?? null,
    orcamento: conv.budget ?? null,
  })}

DADOS DO BUFFET (fonte única de verdade):
Para as ferramentas, use buffet_id=${conv.tenant_id}.
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

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

async function checkAvailability(admin: Admin, tenantId: string, date: string) {
  if (!validDate(date)) return { available: false, error: "Data inválida; use o formato AAAA-MM-DD." };
  const [events, reservations] = await Promise.all([
    admin
      .from("events")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("event_date", date)
      .neq("status", "cancelado")
      .limit(1),
    admin
      .from("whatsapp_pre_reservations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("event_date", date)
      .in("status", ["pendente", "confirmada"])
      .limit(1),
  ]);
  if (events.error) throw events.error;
  if (reservations.error) throw reservations.error;
  return {
    available: !(events.data?.length || reservations.data?.length),
    has_event: Boolean(events.data?.length),
    has_pre_reservation: Boolean(reservations.data?.length),
    date,
  };
}

async function executeAgentTool(
  admin: Admin,
  name: string,
  args: Record<string, unknown>,
  tenantId: string,
  conv: any,
  knowledge: any,
): Promise<{ output: unknown; preReservationCreated: boolean }> {
  if (args.buffet_id !== tenantId) {
    return { output: { error: "Buffet inválido." }, preReservationCreated: false };
  }

  if (name === "listar_pacotes") {
    const guests = typeof args.convidados === "number" ? args.convidados : null;
    const packages = (knowledge?.pacotes ?? []).map((pkg: any) => ({
      ...pkg,
      precificacao_para_convidados: relevantPackagePricing(pkg, guests),
    }));
    return { output: packages, preReservationCreated: false };
  }
  if (name === "consultar_agenda") {
    return { output: await checkAvailability(admin, tenantId, args.data as string), preReservationCreated: false };
  }
  if (name !== "pre_reservar") return { output: { error: "Ferramenta desconhecida." }, preReservationCreated: false };

  const date = args.data;
  if (!validDate(date)) return { output: { error: "Data inválida; use o formato AAAA-MM-DD." }, preReservationCreated: false };
  const packageId = args.pacote_id;
  if (typeof packageId !== "string") return { output: { error: "Pacote inválido." }, preReservationCreated: false };

  const phone = normalizePhone(String(conv.phone ?? ""));
  if (!phone || phone !== normalizePhone(String(args.telefone ?? ""))) {
    return { output: { error: "Telefone do cliente não validado." }, preReservationCreated: false };
  }
  const clientName = String(args.nome ?? "").trim().slice(0, 120) || conv.lead_name || conv.contact_name;
  if (!clientName) return { output: { error: "Nome do cliente não informado." }, preReservationCreated: false };

  const { data: pkg, error: pkgError } = await admin
    .from("packages")
    .select("id, name")
    .eq("id", packageId)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .maybeSingle();
  if (pkgError) throw pkgError;
  if (!pkg) return { output: { error: "Pacote não encontrado para este buffet." }, preReservationCreated: false };

  const { data: existingReservation, error: existingError } = await admin
    .from("whatsapp_pre_reservations")
    .select("id, conversation_id, status")
    .eq("tenant_id", tenantId)
    .eq("event_date", date)
    .in("status", ["pendente", "confirmada"])
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingReservation) {
    const sameConversation = existingReservation.conversation_id === conv.id;
    return {
      output: sameConversation
        ? {
            ok: true,
            id: existingReservation.id,
            status: existingReservation.status,
            message: "A pré-reserva já existe e aguarda confirmação humana.",
          }
        : { ok: false, available: false, message: "A data já possui uma pré-reserva ativa." },
      preReservationCreated: sameConversation,
    };
  }

  const availability = await checkAvailability(admin, tenantId, date);
  if (!availability.available) {
    return { output: { ok: false, available: false, message: "A data não está disponível." }, preReservationCreated: false };
  }

  const { data: reservation, error: insertError } = await admin
    .from("whatsapp_pre_reservations")
    .insert({
      tenant_id: tenantId,
      conversation_id: conv.id,
      phone,
      name: clientName,
      event_date: date,
      package_id: packageId,
      status: "pendente",
    })
    .select("id, status")
    .single();
  if (insertError?.code === "23505") {
    return {
      output: { ok: false, available: false, message: "A data acabou de receber outra pré-reserva." },
      preReservationCreated: false,
    };
  }
  if (insertError) throw insertError;
  return {
    output: {
      ok: true,
      id: reservation.id,
      status: reservation.status,
      package: pkg.name,
      date,
      message: "Pré-reserva criada. Ela permanece pendente até confirmação humana.",
    },
    preReservationCreated: true,
  };
}

export async function runAgent(
  admin: Admin,
  tenantId: string,
  knowledge: unknown,
  conv: any,
  history: { sender: string; body: string }[],
) {
  const input: any[] = history
    .filter((m) => m.body?.trim())
    .map((m) =>
      m.sender === "client"
        ? ({ role: "user" as const, content: m.body })
        : ({ role: "assistant" as const, content: [{ type: "output_text" as const, text: m.body, annotations: [] }] }),
    );
  if (!input.length || input[input.length - 1].role !== "user") {
    input.push({ role: "user", content: "(o cliente enviou uma mensagem sem texto)" });
  }

  let preReservationCreated = false;
  for (let step = 0; step < 5; step++) {
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions: systemPrompt(knowledge, conv),
      input: input as any,
      tools: AGENT_TOOLS as any,
      tool_choice: "auto",
      reasoning: { effort: "low" },
      max_output_tokens: 1200,
      text: { format: { type: "json_schema", name: "atendimento", strict: true, schema: RESULT_SCHEMA as any } },
    });
    const calls = (res as any)?.output?.filter((item: any) => item?.type === "function_call") ?? [];
    if (!calls.length) {
      const raw = outputText(res);
      const parsed = JSON.parse(raw) as AgentResult;
      if (!parsed?.reply?.trim()) throw new Error("Resposta vazia da IA");
      return { result: parsed, preReservationCreated };
    }

    for (const call of calls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.arguments ?? "{}");
      } catch {
        args = {};
      }
      const { output, preReservationCreated: created } = await executeAgentTool(
        admin,
        call.name,
        args,
        tenantId,
        conv,
        knowledge,
      );
      preReservationCreated ||= created;
      input.push(call);
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
    }
  }
  throw new Error("A IA excedeu o limite de chamadas de ferramentas.");
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

  // A newer customer message will be answered with the recent history — avoid double replies.
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
      .limit(10);
    if (histErr) throw histErr;
    const { knowledge } = await buildBuffetKnowledge(admin, instance.tenant_id);
    const run = await runAgent(admin, instance.tenant_id, knowledge, conv, [...(history ?? [])].reverse());
    result = run.result;
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
    budget: lead.budget ?? conv.budget,
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

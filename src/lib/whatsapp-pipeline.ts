export const WHATSAPP_PIPELINE = [
  { id: "novos", label: "📥 Novos" },
  { id: "quente", label: "🔥 Leads Quentes" },
  { id: "proposta", label: "🍽️ Degustação / Proposta" },
  { id: "humano", label: "👤 Aguardando Humano" },
  { id: "fechado", label: "✅ Fechados" },
] as const;

export type WhatsappPipelineStage = (typeof WHATSAPP_PIPELINE)[number]["id"];
export const WHATSAPP_PIPELINE_ORDER: readonly WhatsappPipelineStage[] = WHATSAPP_PIPELINE.map(({ id }) => id);

export type WhatsappPipelineSignals = {
  hasEventDetails: boolean;
  requestedBooking?: boolean;
  eventConfirmed?: boolean;
  requestedFormalQuote: boolean;
  sentProposalWithValues: boolean;
  requestedTasting: boolean;
  tastingScheduled: boolean;
  humanHandoff: boolean;
  botPaused: boolean;
};

export function whatsappQuoteRequested(message: string): boolean {
  const text = message.toLocaleLowerCase("pt-BR");
  if (/\b(?:não|nao)\b.{0,30}\b(?:quero|preciso|solicito|peço)\b.{0,20}\b(?:orçamento|orcamento|cotação|cotacao|proposta)\b/i.test(text)) {
    return false;
  }
  return /\b(?:orçamento|orcamento|cotação|cotacao|proposta formal|enviar proposta|mande a proposta)\b/i.test(text);
}

function normalizedMessage(message: string) {
  return message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function positiveSchedulingAnswer(message: string) {
  return /^(?:sim|isso|isso mesmo|pode ser|pode marcar|pode agendar|confirmo|quero sim)[.!\s]*$/.test(message);
}

export function whatsappBookingRequested(message: string, previousReply = ""): boolean {
  const text = normalizedMessage(message);
  if (/\b(?:nao|talvez|ainda nao)\b/.test(text)) return false;
  const date = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\bdia\s+\d{1,2}\b|\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/;
  if (date.test(text)) return true;
  if (/\b(?:agendar|marcar|reservar|confirmar|fechar)\b/.test(text) &&
      /\b(?:evento|festa|data|pacote|aniversario|casamento|reserva)\b/.test(text)) return true;
  const previous = normalizedMessage(previousReply);
  return positiveSchedulingAnswer(text) && /[?]/.test(previousReply) &&
    /\b(?:agendar|marcar|reservar|confirmar|fechar|qual data|que dia)\b/.test(previous) &&
    /\b(?:evento|festa|data|pacote|aniversario|casamento|reserva)\b/.test(previous);
}

export function whatsappTastingRequested(message: string, previousReply = ""): boolean {
  const normalized = normalizedMessage(message);
  if (/\bnao\b/.test(normalized)) return false;
  if (positiveSchedulingAnswer(normalized) && previousReply.includes("?") &&
      /\bdegustacao\b/.test(normalizedMessage(previousReply))) return true;
  const text = message.toLocaleLowerCase("pt-BR");
  if (/\b(?:não|nao)\b.{0,30}\b(?:quero|preciso|gostaria|solicito|fazer|agendar|marcar)\b.{0,20}\b(?:degustação|degustacao|prova)\b/i.test(text)) {
    return false;
  }
  return /\b(?:degustação|degustacao|prova)\b/i.test(text) &&
    /\b(?:quero|gostaria|podemos|pode|poderia|agendar|marcar|reservar|solicitar|fazer|conhecer|visitar)\b/i.test(text);
}

export function whatsappClosingIntent(message: string): boolean {
  const text = message.toLocaleLowerCase("pt-BR");
  if (/\b(?:não|nao)\s+(?:quero|vou|vamos)\s+(?:fechar|contratar)\b/i.test(text)) return false;
  return /\b(?:quero|vou|vamos|podemos|pode|gostaria de|bora)\s+(?:fechar|contratar|reservar)\b/i.test(text) ||
    /\b(?:fechado|fechamos|negócio fechado|negocio fechado)\b/i.test(text) ||
    /\b(?:como|onde)\s+(?:faço|faco)\s+(?:para|pra)\s+(?:pagar|fechar|contratar)\b/i.test(text) ||
    /\b(?:manda|mande|envia|envie)\s+(?:o\s+)?(?:contrato|pix)\b/i.test(text);
}

export function whatsappHumanRequested(message: string): boolean {
  const text = message.toLocaleLowerCase("pt-BR");
  if (/\b(?:não|nao)\s+(?:quero|preciso|gostaria|prefiro)\s+(?:de\s+)?(?:falar|conversar)\s+(?:com\s+)?(?:uma?\s+)?(?:pessoa|humano|atendente|alguém|alguem|equipe)\b/i.test(text)) {
    return false;
  }
  if (/\b(?:não|nao)\s+(?:chame|chama|passe|transfira|transferir|encaminhe)\b.{0,30}\b(?:pessoa|humano|atendente|alguém|alguem|equipe)\b/i.test(text)) {
    return false;
  }
  return /\b(?:quero|preciso|gostaria|prefiro)\s+(?:de\s+)?(?:falar|conversar)\s+(?:com\s+)?(?:uma?\s+)?(?:pessoa|humano|atendente|alguém|alguem|equipe)\b/i.test(text) ||
    /\b(?:chame|chama|passe|transfira|transferir|encaminhe)\b.{0,30}\b(?:pessoa|humano|atendente|alguém|alguem|equipe)\b/i.test(text) ||
    /\b(?:atendente|pessoa|humano)\s+(?:real|de verdade)\b/i.test(text);
}

export function whatsappReplyIncludesProposalValue(reply: string): boolean {
  return /\bR\$\s*\d[\d.,]*/i.test(reply);
}

export type WhatsappPipelineConversation = {
  id: string;
  pipeline_stage?: string | null;
};

export function whatsappPipelineStage(stage: string | null | undefined): WhatsappPipelineStage {
  return WHATSAPP_PIPELINE.some((column) => column.id === stage)
    ? (stage as WhatsappPipelineStage)
    : "novos";
}

export function whatsappPipelineStageFromSignals(
  signals: WhatsappPipelineSignals,
): WhatsappPipelineStage | null {
  if (signals.eventConfirmed) return "fechado";
  if (signals.humanHandoff || signals.botPaused) return "humano";
  if (signals.sentProposalWithValues || signals.requestedTasting || signals.tastingScheduled) return "proposta";
  if (signals.hasEventDetails || signals.requestedFormalQuote || signals.requestedBooking) return "quente";
  return null;
}

export function whatsappInboundPipelineStage(message: string, previousReply = ""): WhatsappPipelineStage | null {
  return whatsappPipelineStageFromSignals({
    hasEventDetails: false,
    requestedBooking: whatsappBookingRequested(message, previousReply),
    requestedFormalQuote: whatsappQuoteRequested(message),
    sentProposalWithValues: false,
    requestedTasting: whatsappTastingRequested(message, previousReply),
    tastingScheduled: false,
    humanHandoff: whatsappHumanRequested(message),
    botPaused: false,
  });
}

export function whatsappPipelineEarlierStageFilter(stage: WhatsappPipelineStage): string {
  const targetIndex = WHATSAPP_PIPELINE_ORDER.indexOf(stage);
  const earlierStages = WHATSAPP_PIPELINE_ORDER.slice(0, targetIndex);
  return [
    "pipeline_stage.is.null",
    ...earlierStages.map((earlierStage) => `pipeline_stage.eq.${earlierStage}`),
  ].join(",");
}

export function groupWhatsappConversations<T extends WhatsappPipelineConversation>(conversations: T[]) {
  const grouped = Object.fromEntries(WHATSAPP_PIPELINE.map(({ id }) => [id, [] as T[]])) as Record<
    WhatsappPipelineStage,
    T[]
  >;

  for (const conversation of conversations) {
    grouped[whatsappPipelineStage(conversation.pipeline_stage)].push(conversation);
  }
  // Regra: em cada coluna, a conversa com a mensagem mais nova fica no topo.
  const time = (c: T) => Date.parse(String((c as { last_message_at?: string | null }).last_message_at ?? "")) || 0;
  for (const stage of Object.keys(grouped) as WhatsappPipelineStage[]) grouped[stage].sort((a, b) => time(b) - time(a));

  return grouped;
}

export function moveWhatsappConversationToStage<T extends WhatsappPipelineConversation>(
  conversations: T[],
  conversationId: string,
  stage: WhatsappPipelineStage,
) {
  return conversations.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, pipeline_stage: stage } : conversation,
  );
}

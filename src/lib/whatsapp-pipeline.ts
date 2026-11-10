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

export function whatsappTastingRequested(message: string): boolean {
  const text = message.toLocaleLowerCase("pt-BR");
  if (/\b(?:não|nao)\b.{0,30}\b(?:quero|preciso|gostaria|solicito|fazer|agendar|marcar)\b.{0,20}\b(?:degustação|degustacao|prova)\b/i.test(text)) {
    return false;
  }
  return /\b(?:degustação|degustacao|prova)\b/i.test(text) &&
    /\b(?:quero|gostaria|podemos|pode|poderia|agendar|marcar|reservar|solicitar|fazer|conhecer|visitar)\b/i.test(text);
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
  if (signals.humanHandoff || signals.botPaused) return "humano";
  if (signals.sentProposalWithValues || signals.requestedTasting || signals.tastingScheduled) return "proposta";
  if (signals.hasEventDetails || signals.requestedFormalQuote) return "quente";
  return null;
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

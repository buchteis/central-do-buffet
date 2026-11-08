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
  tastingScheduled: boolean;
  humanHandoff: boolean;
  botPaused: boolean;
};

export function whatsappQuoteRequested(message: string): boolean {
  return /\b(?:or[cç]amento|cota[cç][aã]o|proposta formal|enviar proposta)\b/i.test(message);
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
  if (signals.sentProposalWithValues || signals.tastingScheduled) return "proposta";
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

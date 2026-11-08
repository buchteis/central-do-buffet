export const WHATSAPP_PIPELINE = [
  { id: "novos", label: "📥 Novos" },
  { id: "quente", label: "🔥 Leads Quentes" },
  { id: "proposta", label: "🍽️ Degustação / Proposta" },
  { id: "humano", label: "👤 Aguardando Humano" },
  { id: "fechado", label: "✅ Fechados" },
] as const;

export type WhatsappPipelineStage = (typeof WHATSAPP_PIPELINE)[number]["id"];

export type WhatsappPipelineConversation = {
  id: string;
  pipeline_stage?: string | null;
};

export function whatsappPipelineStage(stage: string | null | undefined): WhatsappPipelineStage {
  return WHATSAPP_PIPELINE.some((column) => column.id === stage)
    ? (stage as WhatsappPipelineStage)
    : "novos";
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

import {
  whatsappPipelineEarlierStageFilter,
  type WhatsappPipelineStage,
} from "./whatsapp-pipeline";

type Admin = any;

export async function moveWhatsappConversationPipelineStage(
  supabase: Admin,
  conversationId: string,
  stage: WhatsappPipelineStage,
) {
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update({ pipeline_stage: stage })
    .eq("id", conversationId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message || "Não foi possível mover a conversa no pipeline.");
  if (!data) throw new Error("Conversa não encontrada.");
}

export async function advanceWhatsappConversationPipelineStage(
  admin: Admin,
  conversationId: string,
  tenantId: string,
  stage: WhatsappPipelineStage,
) {
  const { error } = await admin
    .from("whatsapp_conversations")
    .update({ pipeline_stage: stage })
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .or(whatsappPipelineEarlierStageFilter(stage));

  if (error) throw new Error("Não foi possível atualizar a etapa do pipeline do WhatsApp.");
}

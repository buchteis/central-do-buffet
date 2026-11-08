import { describe, expect, it, vi } from "vitest";
import { advanceWhatsappConversationPipelineStage } from "./whatsapp-pipeline.server";
import {
  groupWhatsappConversations,
  moveWhatsappConversationToStage,
  whatsappPipelineEarlierStageFilter,
  whatsappQuoteRequested,
  whatsappReplyIncludesProposalValue,
  whatsappPipelineStageFromSignals,
  whatsappPipelineStage,
  WHATSAPP_PIPELINE,
} from "./whatsapp-pipeline";

describe("WhatsApp pipeline", () => {
  it("defines the five requested stages in order", () => {
    expect(WHATSAPP_PIPELINE).toEqual([
      { id: "novos", label: "📥 Novos" },
      { id: "quente", label: "🔥 Leads Quentes" },
      { id: "proposta", label: "🍽️ Degustação / Proposta" },
      { id: "humano", label: "👤 Aguardando Humano" },
      { id: "fechado", label: "✅ Fechados" },
    ]);
  });

  it("defaults missing or unknown stages to novos", () => {
    expect(whatsappPipelineStage(null)).toBe("novos");
    expect(whatsappPipelineStage(undefined)).toBe("novos");
    expect(whatsappPipelineStage("legacy_stage")).toBe("novos");
  });

  it("chooses the highest automatic stage indicated by the agent signals", () => {
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: true,
      requestedFormalQuote: false,
      sentProposalWithValues: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBe("quente");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: true,
      sentProposalWithValues: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBe("quente");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: true,
      requestedFormalQuote: false,
      sentProposalWithValues: true,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBe("proposta");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: false,
      sentProposalWithValues: false,
      tastingScheduled: true,
      humanHandoff: false,
      botPaused: false,
    })).toBe("proposta");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: false,
      sentProposalWithValues: true,
      tastingScheduled: true,
      humanHandoff: true,
      botPaused: false,
    })).toBe("humano");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: false,
      sentProposalWithValues: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: true,
    })).toBe("humano");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: false,
      sentProposalWithValues: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBeNull();
  });

  it("recognizes formal quote requests and proposal replies with a price", () => {
    expect(whatsappQuoteRequested("Pode me enviar um orçamento?")).toBe(true);
    expect(whatsappQuoteRequested("Quero fazer uma festa")).toBe(false);
    expect(whatsappReplyIncludesProposalValue("O pacote custa R$ 1.250,00.")).toBe(true);
    expect(whatsappReplyIncludesProposalValue("Temos uma festa para 50 convidados.")).toBe(false);
  });

  it("builds atomic update filters that exclude current and later pipeline stages", () => {
    expect(whatsappPipelineEarlierStageFilter("quente"))
      .toBe("pipeline_stage.is.null,pipeline_stage.eq.novos");
    expect(whatsappPipelineEarlierStageFilter("proposta"))
      .toBe("pipeline_stage.is.null,pipeline_stage.eq.novos,pipeline_stage.eq.quente");
    expect(whatsappPipelineEarlierStageFilter("humano"))
      .toBe("pipeline_stage.is.null,pipeline_stage.eq.novos,pipeline_stage.eq.quente,pipeline_stage.eq.proposta");
  });

  it("writes an automatic stage atomically under conversation and tenant filters", async () => {
    const query: Record<string, any> = {};
    query.update = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.or = vi.fn().mockResolvedValue({ error: null });
    const admin = { from: vi.fn(() => query) };

    await advanceWhatsappConversationPipelineStage(admin, "conversation-id", "tenant-id", "proposta");

    expect(admin.from).toHaveBeenCalledWith("whatsapp_conversations");
    expect(query.update).toHaveBeenCalledWith({ pipeline_stage: "proposta" });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "conversation-id");
    expect(query.eq).toHaveBeenNthCalledWith(2, "tenant_id", "tenant-id");
    expect(query.or).toHaveBeenCalledWith(
      "pipeline_stage.is.null,pipeline_stage.eq.novos,pipeline_stage.eq.quente",
    );
  });

  it("groups conversations by stage without dropping unassigned conversations", () => {
    const conversations = [
      { id: "one", pipeline_stage: null },
      { id: "two", pipeline_stage: "quente" },
      { id: "three", pipeline_stage: "humano" },
    ];

    const grouped = groupWhatsappConversations(conversations);

    expect(grouped.novos.map(({ id }) => id)).toEqual(["one"]);
    expect(grouped.quente.map(({ id }) => id)).toEqual(["two"]);
    expect(grouped.humano.map(({ id }) => id)).toEqual(["three"]);
    expect(grouped.proposta).toEqual([]);
    expect(grouped.fechado).toEqual([]);
  });

  it("moves only the selected conversation to the destination column", () => {
    const conversations = [
      { id: "one", pipeline_stage: "novos" },
      { id: "two", pipeline_stage: "quente" },
    ];

    expect(moveWhatsappConversationToStage(conversations, "one", "fechado")).toEqual([
      { id: "one", pipeline_stage: "fechado" },
      { id: "two", pipeline_stage: "quente" },
    ]);
  });
});

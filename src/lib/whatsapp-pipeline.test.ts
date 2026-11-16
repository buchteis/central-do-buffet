import { describe, expect, it, vi } from "vitest";
import {
  advanceWhatsappConversationPipelineStage,
  moveWhatsappConversationPipelineStage,
} from "./whatsapp-pipeline.server";
import {
  groupWhatsappConversations,
  moveWhatsappConversationToStage,
  whatsappHumanRequested,
  whatsappInboundPipelineStage,
  whatsappPipelineEarlierStageFilter,
  whatsappQuoteRequested,
  whatsappReplyIncludesProposalValue,
  whatsappPipelineStageFromSignals,
  whatsappPipelineStage,
  whatsappTastingRequested,
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
      requestedTasting: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBe("quente");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: true,
      sentProposalWithValues: false,
      requestedTasting: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBe("quente");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: true,
      requestedFormalQuote: false,
      sentProposalWithValues: true,
      requestedTasting: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBe("proposta");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: false,
      sentProposalWithValues: false,
      requestedTasting: false,
      tastingScheduled: true,
      humanHandoff: false,
      botPaused: false,
    })).toBe("proposta");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: false,
      sentProposalWithValues: true,
      requestedTasting: false,
      tastingScheduled: true,
      humanHandoff: true,
      botPaused: false,
    })).toBe("humano");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: false,
      sentProposalWithValues: false,
      requestedTasting: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: true,
    })).toBe("humano");
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: false,
      requestedFormalQuote: false,
      sentProposalWithValues: false,
      requestedTasting: false,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBeNull();
  });

  it("recognizes formal quote requests and proposal replies with a price", () => {
    expect(whatsappQuoteRequested("Pode me enviar um orçamento?")).toBe(true);
    expect(whatsappQuoteRequested("Quero fazer uma festa")).toBe(false);
    expect(whatsappQuoteRequested("Não preciso de um orçamento agora")).toBe(false);
    expect(whatsappReplyIncludesProposalValue("O pacote custa R$ 1.250,00.")).toBe(true);
    expect(whatsappReplyIncludesProposalValue("Temos uma festa para 50 convidados.")).toBe(false);
    expect(whatsappTastingRequested("Gostaria de agendar uma degustação")).toBe(true);
    expect(whatsappTastingRequested("Não quero fazer degustação")).toBe(false);
    expect(whatsappHumanRequested("Quero falar com uma pessoa, por favor")).toBe(true);
    expect(whatsappHumanRequested("Não quero falar com uma pessoa")).toBe(false);
    expect(whatsappHumanRequested("Não chame um atendente")).toBe(false);
  });

  it("moves an automatic request for a tasting to proposta, above hot lead signals", () => {
    expect(whatsappPipelineStageFromSignals({
      hasEventDetails: true,
      requestedFormalQuote: true,
      sentProposalWithValues: false,
      requestedTasting: true,
      tastingScheduled: false,
      humanHandoff: false,
      botPaused: false,
    })).toBe("proposta");
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

  it("persists manual movement under both conversation and tenant filters with an RLS client", async () => {
    const query: Record<string, any> = {};
    query.update = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.select = vi.fn(() => query);
    query.maybeSingle = vi.fn().mockResolvedValue({ data: { id: "conversation-id" }, error: null });
    const supabase = { from: vi.fn(() => query) };

    await moveWhatsappConversationPipelineStage(supabase, "conversation-id", "fechado", "tenant-id");

    expect(supabase.from).toHaveBeenCalledWith("whatsapp_conversations");
    expect(query.update).toHaveBeenCalledWith({ pipeline_stage: "fechado" });
    expect(query.eq).toHaveBeenCalledTimes(2);
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "conversation-id");
    expect(query.eq).toHaveBeenNthCalledWith(2, "tenant_id", "tenant-id");
    expect(query.select).toHaveBeenCalledWith("id");
  });

  it("propagates the Supabase message when a manual stage update fails", async () => {
    const query: Record<string, any> = {};
    query.update = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.select = vi.fn(() => query);
    query.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const supabase = { from: vi.fn(() => query) };

    await expect(moveWhatsappConversationPipelineStage(supabase, "conversation-id", "proposta", "tenant-id"))
      .rejects.toThrow("permission denied");
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

  it("qualifies a customer choosing the event date as a hot lead", () => {
    expect(whatsappInboundPipelineStage("Quero marcar minha festa para 10/12/2026")).toBe("quente");
    expect(whatsappInboundPipelineStage("20/12/2026", "Qual data para sua festa?")).toBe("quente");
    expect(whatsappInboundPipelineStage("Quero reservar a data")).toBe("quente");
    expect(whatsappInboundPipelineStage("A festa será dia 20 de dezembro")).toBe("quente");
  });

  it("moves a customer's tasting request to the tasting/proposal column", () => {
    expect(whatsappInboundPipelineStage("Quero agendar uma degustação dia 20")).toBe("proposta");
  });

  it("uses the previous question to interpret a short affirmative tasting response", () => {
    expect(whatsappInboundPipelineStage("Sim!", "Gostaria de agendar uma degustação?")).toBe("proposta");
  });

  it("uses the previous question to interpret a short affirmative event response", () => {
    expect(whatsappInboundPipelineStage("Pode marcar", "Gostaria de marcar a data da festa?")).toBe("quente");
    expect(whatsappInboundPipelineStage("sim", "Você gostou da decoração?")).toBeNull();
  });

  it("does not move greetings or refusals into scheduling stages", () => {
    expect(whatsappInboundPipelineStage("Bom dia")).toBeNull();
    expect(whatsappInboundPipelineStage("Não quero agendar degustação")).toBeNull();
    expect(whatsappInboundPipelineStage("Não quero marcar a festa para 10/12/2026")).toBeNull();
    expect(whatsappInboundPipelineStage("Talvez", "Gostaria de agendar uma degustação?")).toBeNull();
  });

  it("requires a successful confirmed event tool result before automatically closing a conversation", () => {
    const signals = {
      hasEventDetails: true, requestedFormalQuote: false, sentProposalWithValues: false,
      requestedTasting: false, tastingScheduled: false, humanHandoff: false, botPaused: false,
    };
    expect(whatsappPipelineStageFromSignals({ ...signals, eventConfirmed: false })).toBe("quente");
    expect(whatsappPipelineStageFromSignals({ ...signals, eventConfirmed: true })).toBe("fechado");
  });

  it("never regresses a manually advanced stage for a new customer reply", async () => {
    const stored = { id: "conversation-id", tenant_id: "tenant-id", pipeline_stage: "proposta" };
    let proposedStage: string | null = null;
    const query: Record<string, any> = {};
    query.update = vi.fn((patch) => { proposedStage = patch.pipeline_stage; return query; });
    query.eq = vi.fn(() => query);
    query.or = vi.fn((filter: string) => {
      if (filter.includes(`pipeline_stage.eq.${stored.pipeline_stage}`) && proposedStage) {
        stored.pipeline_stage = proposedStage;
      }
      return Promise.resolve({ error: null });
    });
    await advanceWhatsappConversationPipelineStage({ from: () => query }, stored.id, stored.tenant_id, "quente");
    expect(stored.pipeline_stage).toBe("proposta");
  });
});

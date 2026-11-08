import { describe, expect, it } from "vitest";
import {
  groupWhatsappConversations,
  moveWhatsappConversationToStage,
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

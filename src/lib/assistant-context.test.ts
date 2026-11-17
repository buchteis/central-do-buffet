import { describe, expect, it } from "vitest";
import { assistantHistory, selectAssistantContext } from "./assistant-context";

describe("assistant request context", () => {
  it("keeps every package and excludes unrelated WhatsApp records for a package follow-up", () => {
    const pacotes = Array.from({ length: 30 }, (_, i) => ({ nome: `Pacote ${i}`, preco: i * 100 }));
    const selected = selectAssistantContext({ pacotes, whatsapp: { mensagens: ["unrelated"] }, buffet: { nome: "Real" } }, "Você possui pacotes cadastrados. liste todos para mim");
    expect(selected.pacotes).toEqual(pacotes);
    expect(selected).not.toHaveProperty("whatsapp");
    expect(selected.buffet).toEqual({ nome: "Real" });
  });

  it("preserves all successful turns and excludes provider failures from history", () => {
    const turns = Array.from({ length: 24 }, (_, i) => ({ role: "user" as const, content: `Pergunta ${i}` }));
    expect(assistantHistory([...turns, { role: "assistant", content: "Erro Groq 429: details" }, { role: "assistant", content: "failure", requestError: true }])).toEqual(turns);
  });

  it("keeps all domains when the question is not specific", () => {
    const context = { pacotes: [1], whatsapp: { total: 2 }, estoque: [3] };
    expect(selectAssistantContext(context, "Faça um resumo geral")).toEqual(context);
  });
});
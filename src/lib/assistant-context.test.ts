import { describe, expect, it } from "vitest";
import { assistantHistory, selectAssistantContext, serializeContextWithinBudget } from "./assistant-context";

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

  it("keeps only overview domains for general greetings or non-specific questions", () => {
    const context = {
      buffet: { nome: "Real" },
      hoje: "2026-11-26",
      metricas: { total_clientes: 10 },
      pacotes: [1],
      clientes: [{ nome: "João" }],
      whatsapp: { conexao: { status: "open" }, total_atendimentos_registrados: 5, atendimentos_recentes: [{ id: "1" }] },
      estoque: [3],
    };
    const selected = selectAssistantContext(context, "qual seu nome");
    expect(selected.buffet).toEqual({ nome: "Real" });
    expect(selected.metricas).toEqual({ total_clientes: 10 });
    expect(selected.whatsapp).toEqual({ conexao: { status: "open" }, total_atendimentos_registrados: 5 });
    expect(selected).not.toHaveProperty("clientes");
    expect(selected).not.toHaveProperty("pacotes");
    expect(selected).not.toHaveProperty("estoque");
  });

  it("trims oversized domain context to fit within the input budget", () => {
    const bigClients = Array.from({ length: 25 }, (_, i) => ({ nome: `Cliente ${i}`, observacoes: "x".repeat(500) }));
    const json = serializeContextWithinBudget({ buffet: { nome: "Real" }, clientes: bigClients }, 4000);
    expect(json.length).toBeLessThanOrEqual(4000);
    expect(JSON.parse(json).buffet).toEqual({ nome: "Real" });
  });
});
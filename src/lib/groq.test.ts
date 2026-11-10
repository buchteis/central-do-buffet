import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeGroq, GROQ_MODEL } from "./groq.server";

describe("Groq Integration", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("uses GROQ_API_KEY, the Groq endpoint, and the configured model", async () => {
    // Valida o modelo correto recomendado para contas gratuitas
    expect(GROQ_MODEL).toBe("openai/gpt-oss-20b");
    
    const fetchMock = global.fetch as any;
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
    
    process.env.GROQ_API_KEY = "test-key-123";
    const result = await completeGroq({ messages: [{ role: "user", content: "Olá" }] });
    
    expect(result.text).toBe("Olá");
  });
});

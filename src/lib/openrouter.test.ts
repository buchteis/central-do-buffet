import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeOpenRouter, OpenRouterError, responseText } from "./openrouter.server";
import { parseAgentResult, runAgent } from "./whatsapp-agent.server";

const finalResult = {
  reply: "Temos opções para sua festa.", handoff: false, handoff_reason: null,
  lead: { name: "Ana", event_type: null, event_date: null, guest_count: 60, budget: null },
};

describe("OpenRouter integration", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("uses the saved OPENAI_API_KEY only with OpenRouter and the requested free model", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "wrong-variable");
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
    const result = await completeOpenRouter({ messages: [{ role: "user", content: "Olá" }] });
    expect(result.text).toBe("Olá");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer test-only-key");
    expect(JSON.parse(options.body).model).toBe("meta-llama/llama-3.3-70b-instruct:free");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves reply and output_text compatibility as well as text parts", () => {
    expect(responseText({ reply: "resposta" })).toBe("resposta");
    expect(responseText({ output_text: "antiga" })).toBe("antiga");
    expect(responseText({ choices: [{ message: { content: [{ type: "text", text: "Olá" }] } }] })).toBe("Olá");
    expect(responseText({ output: [{ type: "message", content: [{ type: "output_text", text: "legado" }] }] })).toBe("legado");
  });

  it("does not replay failed or rate-limited requests and never leaks provider errors", async () => {
    fetchMock.mockResolvedValue(new Response('provider body with private values', { status: 429 }));
    await expect(completeOpenRouter({ messages: [] })).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new OpenRouterError(429).message).not.toContain("private values");
  });

  it("rejects empty successful responses and embedded provider errors", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "" } }] }));
    await expect(completeOpenRouter({ messages: [] })).rejects.toMatchObject({ status: 502 });
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: 503, message: "upstream details" } }));
    await expect(completeOpenRouter({ messages: [] })).rejects.toMatchObject({ status: 503 });
  });

  it("passes tool responses back with their call identifiers and preserves the attendant result", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ choices: [{ message: {
      role: "assistant", content: null,
      tool_calls: [{ id: "call-packages", type: "function", function: {
        name: "listar_pacotes", arguments: JSON.stringify({ buffet_id: "tenant-a", convidados: 60 }),
      } }],
    } }] })).mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify(finalResult) } }] }));
    const result = await runAgent({}, "tenant-a", { pacotes: [] }, { tenant_id: "tenant-a" }, [{ sender: "client", body: "Quais pacotes para 60 pessoas?" }]);
    expect(result.result).toEqual(finalResult);
    expect(result.preReservationCreated).toBe(false);
    const request = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(request.messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call-packages" });
    expect(request.max_tokens).toBe(1200);
    expect(request.messages.find((m: { tool_calls?: unknown[] }) => m.tool_calls)?.tool_calls[0].id).toBe("call-packages");
  });

  it("accepts fenced JSON but rejects unsafe handoff types before business updates", () => {
    expect(parseAgentResult('```json\n' + JSON.stringify(finalResult) + '\n```')).toEqual(finalResult);
    expect(() => parseAgentResult(JSON.stringify({ ...finalResult, handoff: "false" }))).toThrow();
    expect(() => parseAgentResult(JSON.stringify({ reply: "ok" }))).toThrow();
  });
});
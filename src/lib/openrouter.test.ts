import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeOpenRouter,
  OPENROUTER_FALLBACK_MODELS,
  OPENROUTER_MODEL,
  OpenRouterError,
  responseText,
} from "./openrouter.server";
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

  it("uses the saved OPENAI_API_KEY only with OpenRouter and the active free model", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "wrong-variable");
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
    const result = await completeOpenRouter({ messages: [{ role: "user", content: "Olá" }] });
    expect(result.text).toBe("Olá");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer test-only-key");
    expect(JSON.parse(options.body).model).toBe(OPENROUTER_MODEL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back after a 429 while keeping the request unchanged except for the model", async () => {
    const request = {
      messages: [{ role: "user" as const, content: "Olá" }],
      tools: [{ type: "function", function: { name: "test_tool" } }],
      tool_choice: "auto" as const,
      response_format: { type: "json_object" as const },
      max_tokens: 300,
    };
    fetchMock
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "Resposta alternativa" } }] }));

    const result = await completeOpenRouter(request);

    expect(result.text).toBe("Resposta alternativa");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const fallbackBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstBody.model).toBe(OPENROUTER_MODEL);
    expect(fallbackBody).toEqual({ ...firstBody, model: OPENROUTER_FALLBACK_MODELS[0] });
  });

  it("falls back when OpenRouter reports a rate limit in a successful HTTP response", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ error: { code: 429, message: "rate limited" } }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "Resposta alternativa" } }] }));

    await expect(completeOpenRouter({ messages: [{ role: "user", content: "Olá" }] }))
      .resolves.toMatchObject({ text: "Resposta alternativa" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe(OPENROUTER_FALLBACK_MODELS[0]);
  });

  it("preserves reply and output_text compatibility as well as text parts", () => {
    expect(responseText({ reply: "resposta" })).toBe("resposta");
    expect(responseText({ output_text: "antiga" })).toBe("antiga");
    expect(responseText({ choices: [{ message: { content: [{ type: "text", text: "Olá" }] } }] })).toBe("Olá");
    expect(responseText({ output: [{ type: "message", content: [{ type: "output_text", text: "legado" }] }] })).toBe("legado");
  });

  it("stops after the bounded fallback list and never leaks provider errors", async () => {
    fetchMock.mockResolvedValue(new Response('provider body with private values', { status: 429 }));
    await expect(completeOpenRouter({ messages: [] })).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1 + OPENROUTER_FALLBACK_MODELS.length);
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).model))
      .toEqual([OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS]);
    expect(new OpenRouterError(429).message).not.toContain("private values");
  });

  it.each([400, 401, 403])("does not fall back for non-recoverable HTTP %i errors", async (status) => {
    fetchMock.mockResolvedValue(new Response("provider body with private values", { status }));
    await expect(completeOpenRouter({ messages: [] })).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects empty successful responses and embedded provider errors", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "" } }] }));
    await expect(completeOpenRouter({ messages: [] })).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: 503, message: "upstream details" } }));
    await expect(completeOpenRouter({ messages: [] })).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

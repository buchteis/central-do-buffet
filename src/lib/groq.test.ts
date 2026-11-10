import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeGroq,
  GROQ_BASE_URL,
  GROQ_MODEL,
  GroqError,
  responseText,
} from "./groq.server";
import { parseAgentResult, runAgent } from "./whatsapp-agent.server";

const finalResult = {
  reply: "Temos opções para sua festa.", handoff: false, handoff_reason: null,
  lead: { name: "Ana", event_type: null, event_date: null, guest_count: 60, budget: null },
};

function authToken(options: { headers: { Authorization: string } }) {
  return options.headers.Authorization.split(" ").slice(1).join(" ");
}

describe("Groq integration", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "unit-test-openai-fallback");
    vi.stubEnv("GROQ_API_KEY", "unit-test-groq-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("uses GROQ_API_KEY, the Groq endpoint, and the configured model", async () => {
    expect(GROQ_MODEL).toBe("mixtral-8x7b-32768");
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
    const result = await completeGroq({ messages: [{ role: "user", content: "Olá" }] });
    expect(result.text).toBe("Olá");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GROQ_BASE_URL}/chat/completions`);
    expect(authToken(options)).toBe(process.env.GROQ_API_KEY);
    expect(JSON.parse(options.body).model).toBe(GROQ_MODEL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to OPENAI_API_KEY when GROQ_API_KEY is unset", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
    await completeGroq({ messages: [{ role: "user", content: "Olá" }] });
    expect(authToken(fetchMock.mock.calls[0][1])).toBe(process.env.OPENAI_API_KEY);
  });

  it("does not retry or select another provider model after a 429", async () => {
    const request = {
      messages: [{ role: "user" as const, content: "Olá" }],
      tools: [{ type: "function", function: { name: "test_tool" } }],
      tool_choice: "auto" as const,
      response_format: { type: "json_object" as const },
      max_tokens: 300,
    };
    fetchMock.mockResolvedValueOnce(new Response("provider body with private values", { status: 429 }));
    await expect(completeGroq(request)).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(GROQ_MODEL);
    expect(new GroqError(429).message).not.toContain("private values");
  });

  it("preserves provider error details while redacting credentials", async () => {
    fetchMock.mockResolvedValue(
      new Response("Invalid API key: unit-test-groq-key; Authorization: Bearer leaked-token", { status: 401 }),
    );
    await expect(completeGroq({ messages: [] })).rejects.toThrow(
      "Erro Groq 401: Invalid API key: [redacted]; Authorization: Bearer [redacted]",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves reply and output_text compatibility as well as text parts", () => {
    expect(responseText({ reply: "resposta" })).toBe("resposta");
    expect(responseText({ output_text: "antiga" })).toBe("antiga");
    expect(responseText({ choices: [{ message: { content: [{ type: "text", text: "Olá" }] } }] })).toBe("Olá");
    expect(responseText({ output: [{ type: "message", content: [{ type: "output_text", text: "legado" }] }] })).toBe("legado");
  });

  it.each([400, 401, 403])("does not retry for non-recoverable HTTP %i errors", async (status) => {
    fetchMock.mockResolvedValue(new Response("provider body with private values", { status }));
    await expect(completeGroq({ messages: [] })).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects empty successful responses and embedded provider errors without retrying", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "" } }] }));
    await expect(completeGroq({ messages: [] })).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: 429, message: "provider details" } }));
    await expect(completeGroq({ messages: [] })).rejects.toMatchObject({ status: 429 });
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

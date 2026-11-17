import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeGroq, GROQ_MODEL, GroqError } from "./groq.server";

describe("Groq Integration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("GROQ_API_KEY", "test-key-123");
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses GROQ_API_KEY, the Groq endpoint, and the configured model", async () => {
    expect(GROQ_MODEL).toBe("qwen/qwen3.8-27b");
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
    
    const result = await completeGroq({ messages: [{ role: "user", content: "Olá" }] });
    const [, init] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-key-123");
    expect(JSON.parse(String(init?.body)).model).toBe("qwen/qwen3.8-27b");
    expect(result.text).toBe("Olá");
  });

  it("keeps the complete supplied history, system JSON, tool calls and output budget", async () => {
    const messages = [
      { role: "system" as const, content: JSON.stringify({ data: "x".repeat(13000) }) },
      ...Array.from({ length: 10 }, (_, i) => ({ role: "user" as const, content: `Mensagem ${i}` })),
      { role: "assistant" as const, content: null, tool_calls: [{ id: "call-1", type: "function" as const, function: { name: "listar_pacotes", arguments: "{}" } }] },
      { role: "tool" as const, tool_call_id: "call-1", content: "{}" },
    ];
    vi.mocked(fetch).mockResolvedValue(Response.json({ choices: [{ message: { content: "Olá" } }] }));
    await completeGroq({ messages, max_tokens: 1200 });
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload.messages).toEqual(messages);
    expect(payload.max_tokens).toBe(1200);
  });

  it("waits for the screenshot's 3.514285714 second rejection before retrying", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("Rate limit reached. Please try again in 3.514285714s", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "Pacotes listados" } }] }));
    const result = completeGroq({ messages: [{ role: "user", content: "liste todos para mim" }] });
    await vi.advanceTimersByTimeAsync(3514);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    expect((await result).text).toBe("Pacotes listados");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("stops after three retries and keeps the provider's cooldown", async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response("Please try again in 2s", { status: 429 }));
    const outcome = completeGroq({ messages: [] }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(await outcome).toMatchObject({ status: 429, retryAfterMs: 2250 });
  });

  it("does not shorten a long cooldown or retry an unknown network outcome", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("Please try again in 1m30s", { status: 429 }));
    await expect(completeGroq({ messages: [] })).rejects.toMatchObject({ retryAfterMs: 90250 });
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("network failed"));
    await expect(completeGroq({ messages: [] })).rejects.toThrow("network failed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry provider authentication errors and redacts the key", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("invalid key test-key-123 Bearer unsafe", { status: 401 }));
    const error = await completeGroq({ messages: [] }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(GroqError);
    expect(String(error)).not.toContain("test-key-123");
    expect(String(error)).not.toContain("Bearer unsafe");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

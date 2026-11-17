// Server-only transport shared by the assistant and WhatsApp attendant.
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
// Provider account limits are configured at Groq, not through max_tokens.
export const GROQ_MODEL = "qwen/qwen3.8-27b";

export type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type GroqMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
};

function safeErrorDetail(value: string, apiKey: string): string {
  return (apiKey ? value.replaceAll(apiKey, "[redacted]") : value)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

export class GroqError extends Error {
  constructor(public readonly status: number, detail = "Resposta vazia do provedor.", apiKey = "", public readonly retryAfterMs: number | null = null) {
    const safeDetail = safeErrorDetail(detail, apiKey);
    super(`Erro Groq ${status}: ${safeDetail || "Resposta vazia do provedor."}`);
    this.name = "GroqError";
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function responseText(value: unknown): string {
  const response = record(value);
  if (!response) return "";
  const choices = response.choices;
  const first = Array.isArray(choices) ? record(choices[0]) : null;
  const message = record(first?.message);
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content.map((part) => {
      const item = record(part);
      return typeof item?.text === "string" ? item.text : "";
    }).join("");
    if (text.trim()) return text;
  }
  if (typeof response.output_text === "string") return response.output_text;
  if (typeof response.reply === "string") return response.reply;
  const output = Array.isArray(response.output) ? response.output : [];
  return output.flatMap((item) => {
    const entry = record(item);
    return entry?.type === "message" && Array.isArray(entry.content) ? entry.content : [];
  }).map((part) => {
    const item = record(part);
    return item?.type === "output_text" && typeof item.text === "string" ? item.text : "";
  }).join("");
}

type GroqRequest = {
  messages: GroqMessage[];
  tools?: unknown[];
  tool_choice?: "auto";
  max_tokens?: number;
  response_format?: { type: "json_object" };
};

type GroqResult = { text: string; message: GroqMessage; finishReason: string | null };

export function retryDelayMs(response: Response, text: string): number {
  const rawHeader = response.headers.get("retry-after");
  const seconds = Number(rawHeader);
  const headerMs = Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : rawHeader ? Math.max(0, Date.parse(rawHeader) - Date.now()) : 0;
  const match = text.match(/try again in\s+(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:([\d.]+)(ms|s))?/i);
  const bodyMs = match
    ? Number(match[1] || 0) * 3600000 + Number(match[2] || 0) * 60000 + Number(match[3] || 0) * (match[4]?.toLowerCase() === "ms" ? 1 : 1000)
    : 0;
  return Math.max(headerMs || 0, bodyMs, 300, (!headerMs && !bodyMs) ? 1500 : 0) + 250;
}

async function completeGroqRequest(
  request: GroqRequest,
  apiKey: string,
): Promise<GroqResult> {
  const safeRequest: GroqRequest = {
    ...request,
    messages: request.messages,
    max_tokens: Math.min(request.max_tokens ?? 1024, 1500),
  };

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...safeRequest, model: GROQ_MODEL }),
  });
  if (!response.ok) {
    const errorMessage = await response.text();
    throw new GroqError(response.status, errorMessage, apiKey,
      response.status === 429 ? retryDelayMs(response, errorMessage) : null);
  }
  const result: unknown = await response.json();
  const payload = record(result);
  if (payload?.error) {
    const error = record(payload.error);
    throw new GroqError(
      typeof error?.code === "number" ? error.code : 502,
      typeof error?.message === "string" ? error.message : "Erro retornado pelo provedor.",
      apiKey,
    );
  }
  const choices = payload?.choices;
  const choice = Array.isArray(choices) ? record(choices[0]) : null;
  const message = record(choice?.message);
  const rawCalls = message?.tool_calls;
  const calls: GroqToolCall[] = [];
  if (rawCalls !== undefined && !Array.isArray(rawCalls)) throw new GroqError(502);
  for (const raw of Array.isArray(rawCalls) ? rawCalls : []) {
    const call = record(raw);
    const fn = record(call?.function);
    if (call?.type !== "function" || typeof call.id !== "string" || !call.id ||
        typeof fn?.name !== "string" || typeof fn.arguments !== "string") {
      throw new GroqError(502);
    }
    calls.push({ id: call.id, type: "function", function: { name: fn.name, arguments: fn.arguments } });
  }
  const text = responseText(result);
  if (!text.trim() && calls.length === 0) throw new GroqError(502);
  return {
    text,
    message: { role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) },
    finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
  };
}

export async function completeGroq(request: GroqRequest): Promise<GroqResult> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("A chave da Groq não está configurada em GROQ_API_KEY nem OPENAI_API_KEY.");
  let waitedMs = 0;
  for (let attempt = 0; ; attempt++) {
    try {
      return await completeGroqRequest(request, apiKey);
    } catch (error) {
      // A rejected rate-limit request is safe to retry; unknown outcomes are not.
      if (!(error instanceof GroqError) || error.status !== 429 || attempt >= 3) throw error;
      const delay = error.retryAfterMs ?? 1750;
      if (delay > 15000 || waitedMs + delay > 45000) throw error;
      waitedMs += delay;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}

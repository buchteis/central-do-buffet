// Server-only transport shared by the assistant and WhatsApp attendant.
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_MODEL = "llama-3.3-70b-versatile";

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

export class GroqError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 401 || status === 403
        ? "A chave da Groq não foi aceita. Confira a configuração da chave no servidor."
        : status === 402
          ? "A Groq bloqueou a solicitação por saldo ou limite da conta."
          : status === 429
            ? "O limite de solicitações da Groq foi atingido. Tente mais tarde."
            : status === 404 || status === 503
              ? "O modelo da Groq está indisponível no momento."
              : "Não foi possível consultar a Groq. Tente novamente mais tarde.",
    );
    this.name = "GroqError";
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

// Accept Chat Completions and the legacy Responses shape without exposing provider payloads.
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

async function completeGroqRequest(
  request: GroqRequest,
  apiKey: string,
): Promise<GroqResult> {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, model: GROQ_MODEL }),
  });
  if (!response.ok) throw new GroqError(response.status);
  const result: unknown = await response.json();
  const payload = record(result);
  if (payload?.error) {
    const error = record(payload.error);
    throw new GroqError(typeof error?.code === "number" ? error.code : 502);
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
  return completeGroqRequest(request, apiKey);
}

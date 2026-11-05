// Pure helpers for Evolution API webhook payloads (no I/O) — shared by the webhook and tests.

export type ParsedInbound =
  | { kind: "ignore"; reason: "from_me" | "group" | "broadcast" | "no_key" | "no_text" }
  | {
      kind: "message";
      waMessageId: string;
      remoteJid: string;
      /** What to pass as `number` to /message/sendText. */
      replyTo: string;
      phone: string | null;
      pushName: string | null;
      text: string;
      timestamp: number | null;
    };

export function extractText(message: any): string {
  if (!message || typeof message !== "object") return "";
  for (const candidate of [message.conversation, message.extendedTextMessage?.text]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  if (message.ephemeralMessage?.message) return extractText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractText(message.viewOnceMessage.message);
  return "";
}

function jidDigits(jid: string | null | undefined): string | null {
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null;
  const d = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return d || null;
}

/** Parse one `messages.upsert` data item. Ignores own messages, groups, status and channels. */
export function parseInboundMessage(data: any): ParsedInbound {
  const key = data?.key;
  if (!key?.remoteJid || !key?.id) return { kind: "ignore", reason: "no_key" };
  if (key.fromMe === true) return { kind: "ignore", reason: "from_me" };
  const jid: string = String(key.remoteJid);
  if (jid.endsWith("@g.us")) return { kind: "ignore", reason: "group" };
  if (jid === "status@broadcast" || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) {
    return { kind: "ignore", reason: "broadcast" };
  }
  const alt: string | null = key.remoteJidAlt ?? key.senderPn ?? null;
  const phone = jidDigits(jid) ?? jidDigits(alt);
  const text = extractText(data?.message);
  if (!text) return { kind: "ignore", reason: "no_text" };
  const ts = Number(data?.messageTimestamp);
  return {
    kind: "message",
    waMessageId: String(key.id),
    remoteJid: jid,
    replyTo: phone ?? jid,
    phone,
    pushName: typeof data?.pushName === "string" && data.pushName.trim() ? data.pushName.trim() : null,
    text,
    timestamp: Number.isFinite(ts) && ts > 0 ? ts : null,
  };
}

/** Map Evolution connection states to the app's status. */
export function mapConnectionState(state: unknown): "connected" | "connecting" | "disconnected" {
  const s = String(state ?? "").toLowerCase();
  if (s === "open") return "connected";
  if (s === "connecting") return "connecting";
  return "disconnected";
}

export function formatPairingCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (code.length !== 8) return null;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

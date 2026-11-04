// Pure helpers for Evolution API webhook payloads (no I/O) — shared by the webhook and tests.

export type ParsedInbound =
  | { kind: "ignore"; reason: "from_me" | "group" | "broadcast" | "no_key" }
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

const MEDIA_LABELS: Record<string, string> = {
  audioMessage: "[o cliente enviou um áudio]",
  imageMessage: "[o cliente enviou uma imagem]",
  videoMessage: "[o cliente enviou um vídeo]",
  documentMessage: "[o cliente enviou um documento]",
  stickerMessage: "[o cliente enviou uma figurinha]",
  locationMessage: "[o cliente enviou uma localização]",
  contactMessage: "[o cliente enviou um contato]",
};

export function extractText(message: any): string {
  if (!message || typeof message !== "object") return "";
  const direct =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    message.buttonsResponseMessage?.selectedDisplayText ??
    message.listResponseMessage?.title ??
    message.templateButtonReplyMessage?.selectedDisplayText;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (message.ephemeralMessage?.message) return extractText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractText(message.viewOnceMessage.message);
  for (const key of Object.keys(MEDIA_LABELS)) {
    if (message[key]) return MEDIA_LABELS[key];
  }
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
  const ts = Number(data?.messageTimestamp);
  return {
    kind: "message",
    waMessageId: String(key.id),
    remoteJid: jid,
    replyTo: phone ?? jid,
    phone,
    pushName: typeof data?.pushName === "string" && data.pushName.trim() ? data.pushName.trim() : null,
    text: extractText(data?.message),
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

/** Normalize a QR string from Evolution into a data URL usable by <img>. */
export function toQrDataUrl(base64: unknown): string | null {
  if (typeof base64 !== "string" || !base64) return null;
  return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
}

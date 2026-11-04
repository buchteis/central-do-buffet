import { describe, expect, it } from "vitest";
import { mapConnectionState, parseInboundMessage } from "./evolution-parse";

describe("parseInboundMessage", () => {
  it("ignores messages sent by the bot/owner (fromMe)", () => {
    const r = parseInboundMessage({
      key: { remoteJid: "5531999990000@s.whatsapp.net", fromMe: true, id: "A1" },
      message: { conversation: "oi" },
    });
    expect(r).toEqual({ kind: "ignore", reason: "from_me" });
  });

  it("ignores group messages", () => {
    const r = parseInboundMessage({
      key: { remoteJid: "120363000000@g.us", fromMe: false, id: "A2" },
      message: { conversation: "oi grupo" },
    });
    expect(r).toEqual({ kind: "ignore", reason: "group" });
  });

  it("reads a customer text message and its phone", () => {
    const r = parseInboundMessage({
      key: { remoteJid: "5531999990000@s.whatsapp.net", fromMe: false, id: "A3" },
      pushName: "Maria",
      message: { extendedTextMessage: { text: "Quero um orçamento" } },
    });
    expect(r).toMatchObject({
      kind: "message",
      waMessageId: "A3",
      phone: "5531999990000",
      replyTo: "5531999990000",
      pushName: "Maria",
      text: "Quero um orçamento",
    });
  });
});

describe("mapConnectionState", () => {
  it("maps Evolution states", () => {
    expect(mapConnectionState("open")).toBe("connected");
    expect(mapConnectionState("connecting")).toBe("connecting");
    expect(mapConnectionState("close")).toBe("disconnected");
  });
});

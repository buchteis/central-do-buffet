import { beforeEach, describe, expect, it, vi } from "vitest";
import { replyToInbound } from "./whatsapp-agent.server";

const mocks = vi.hoisted(() => ({ complete: vi.fn(), send: vi.fn() }));
vi.mock("./groq.server", () => ({ completeGroq: mocks.complete }));
vi.mock("./evolution.server", () => ({ sendText: mocks.send, publicAppOrigin: () => "https://buffet.test" }));
vi.mock("./hindsight.server", () => ({
  hindsightRecallConversation: vi.fn().mockResolvedValue([]),
  hindsightRetainConversation: vi.fn().mockResolvedValue(undefined),
}));

function database(body: string, previousReply = "", initialStage = "novos") {
  const conversation = {
    id: "conversation-1", tenant_id: "tenant-1", remote_jid: "5511999990000@s.whatsapp.net",
    phone: "5511999990000", pipeline_stage: initialStage, bot_paused: false,
  };
  const message = {
    id: "inbound-1", tenant_id: "tenant-1", conversation_id: conversation.id,
    created_at: "2026-11-16T20:57:00Z", body, reply_status: "pending", reply_attempts: 0,
  };
  const scopedUpdates: { filters: [string, unknown][]; patch: Record<string, unknown> }[] = [];
  const admin = {
    from(table: string) {
      let patch: Record<string, unknown> | undefined;
      let select = "";
      const filters: [string, unknown][] = [];
      let earlier = "";
      const resolve = () => {
        if (table === "whatsapp_conversations") {
          if (patch) {
            scopedUpdates.push({ filters, patch });
            if (!earlier || earlier.includes(`pipeline_stage.eq.${conversation.pipeline_stage}`)) {
              Object.assign(conversation, patch);
            }
          }
          return { data: conversation, error: null };
        }
        if (table === "whatsapp_messages") {
          if (patch) {
            Object.assign(message, patch);
            return { data: [{ id: message.id }], error: null };
          }
          if (filters.some(([column, value]) => column === "direction" && value === "out")) {
            return { data: previousReply ? { body: previousReply } : null, error: null };
          }
          if (select === "sender, body, created_at") {
            return { data: [{ sender: "client", body, created_at: message.created_at }], error: null };
          }
          return { data: message, count: 0, error: null };
        }
        if (table === "tenants") return { data: { id: "tenant-1", owner_id: "owner-1", name: "Buffet" }, error: null };
        if (table === "buffet_settings") return { data: null, error: null };
        return { data: [], error: null };
      };
      const query = {
        select(value: string) { select = value; return query; },
        update(value: Record<string, unknown>) { patch = value; return query; },
        eq(column: string, value: unknown) { filters.push([column, value]); return query; },
        in() { return query; }, gt() { return query; }, lt() { return query; },
        order() { return query; }, limit() { return query; },
        or(value: string) { earlier = value; return query; },
        maybeSingle() { return Promise.resolve(resolve()); },
        then(onfulfilled: (value: ReturnType<typeof resolve>) => unknown) {
          return Promise.resolve(resolve()).then(onfulfilled);
        },
      };
      return query;
    },
  };
  return { admin, conversation, message, scopedUpdates };
}

const instance = { tenant_id: "tenant-1", instance_name: "instance-1", bot_enabled: true };

describe("Inbound WhatsApp pipeline qualification", () => {
  beforeEach(() => {
    mocks.complete.mockReset().mockRejectedValue(new Error("Provider unavailable"));
    mocks.send.mockReset();
  });

  it("persists a date request as a hot lead even if AI cannot answer", async () => {
    const db = database("Quero marcar a festa para 10/12/2026");
    expect(await replyToInbound(db.admin, instance, db.message.id)).toBe("failed");
    expect(db.conversation.pipeline_stage).toBe("quente");
    expect(db.message.reply_status).toBe("failed");
    expect(mocks.send).not.toHaveBeenCalled();
    expect(db.scopedUpdates[0].filters).toContainEqual(["tenant_id", "tenant-1"]);
  });

  it("moves a short tasting confirmation using the saved previous assistant question", async () => {
    const db = database("Sim!", "Gostaria de agendar uma degustação?");
    await replyToInbound(db.admin, instance, db.message.id);
    expect(db.conversation.pipeline_stage).toBe("proposta");
  });

  it("keeps a manually advanced conversation closed when another scheduling message arrives", async () => {
    const db = database("Quero agendar degustação dia 20", "", "fechado");
    await replyToInbound(db.admin, instance, db.message.id);
    expect(db.conversation.pipeline_stage).toBe("fechado");
  });
});
import { expect, test } from "vitest";
import { groupWhatsappConversations } from "./whatsapp-pipeline";
test("conversa com mensagem mais nova fica no topo da coluna", () => {
  const g = groupWhatsappConversations([
    { id: "a", pipeline_stage: "novos", last_message_at: "2026-11-10T10:00:00Z" },
    { id: "b", pipeline_stage: "novos", last_message_at: "2026-11-16T10:00:00Z" },
  ] as any);
  expect(g.novos.map((c: any) => c.id)).toEqual(["b", "a"]);
});

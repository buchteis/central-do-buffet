import { describe, expect, it } from "vitest";
import { summarizeWhatsappContext } from "./chatbot.functions";

describe("summarizeWhatsappContext", () => {
  it("includes the WhatsApp connection, customer history, bot status, and handoff", () => {
    const result = summarizeWhatsappContext(
      { status: "connected", phone_number: "+5511999999999", bot_enabled: true },
      [
        {
          id: "conversation-1",
          contact_name: "Ana",
          phone: "+5511888888888",
          remote_jid: "5511888888888@s.whatsapp.net",
          last_message_at: "2026-11-05T12:00:00Z",
          last_message_preview: "Quero saber o valor",
          unread_count: 2,
          bot_paused: false,
          needs_human: true,
          handoff_reason: "Cliente pediu atendimento humano",
          event_type: "aniversário",
          event_date: "2026-12-01",
          guest_count: 60,
          budget: "R$ 5.000",
        },
      ],
      [
        {
          conversation_id: "conversation-1",
          direction: "outbound",
          sender: "bot",
          body: "Vou verificar as opções.",
          reply_status: "sent",
          created_at: "2026-11-05T12:00:00Z",
        },
        {
          conversation_id: "conversation-1",
          direction: "inbound",
          sender: "client",
          body: "Quero saber o valor",
          reply_status: null,
          created_at: "2026-11-05T11:59:00Z",
        },
      ],
      7,
    );

    expect(result.conexao).toEqual({
      status: "connected",
      numero: "+5511999999999",
      robo_ativo: true,
    });
    expect(result.total_atendimentos_registrados).toBe(7);
    expect(result.atendimentos_recentes[0]).toMatchObject({
      contato: "Ana",
      mensagens_nao_lidas: 2,
      precisa_atendimento_humano: true,
      motivo_handoff: "Cliente pediu atendimento humano",
      interesse: { data: "2026-12-01", convidados: 60 },
      mensagens_recentes: [
        { direcao: "inbound", texto: "Quero saber o valor" },
        { direcao: "outbound", texto: "Vou verificar as opções.", status_resposta: "sent" },
      ],
    });
  });

  it("reports missing connections and redacts credentials from message logs", () => {
    const result = summarizeWhatsappContext(
      null,
      [
        {
          id: "conversation-1",
          remote_jid: "5511888888888@s.whatsapp.net",
          last_message_at: "2026-11-05T12:00:00Z",
        },
      ],
      [
        {
          conversation_id: "conversation-1",
          direction: "outbound",
          body: "Falha Authorization: Bearer abc123 api_key=secret",
          reply_error: "Bearer tokenValue",
        },
      ],
    );

    expect(result.conexao).toEqual({ status: "sem_instancia", numero: null, robo_ativo: false });
    expect(result.atendimentos_recentes[0].mensagens_recentes[0].texto).toBe(
      "Falha Authorization: Bearer [redigido] api_key=[redigido]",
    );
    expect(result.atendimentos_recentes[0].mensagens_recentes[0].erro_resposta).toBe("Bearer [redigido]");
  });
});

import React, { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { chatWithAssistant } from "@/lib/chatbot.functions";

type Msg = { role: "user" | "assistant"; content: string };

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o assistente virtual da Central do Buffet. Como posso ajudar você hoje?",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: access } = useTenantAccess();
  const chat = useServerFn(chatWithAssistant);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    if (!access?.tenant?.id) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "⚠️ Faça login em um buffet ativo para usar o assistente." },
      ]);
      return;
    }

    const history = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-10);
    setMessages((p) => [...p, { role: "user", content: text }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await chat({ data: { message: text, history } });
      setMessages((p) => [...p, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      console.error(e);
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "❌ Erro ao consultar o assistente. Tente novamente." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir assistente"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          background: "transparent",
          border: "none",
          borderRadius: "50%",
          width: 60,
          height: 60,
          padding: 0,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="/bot-icon.jpeg"
          alt="Central do Buffet"
          style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            right: 20,
            zIndex: 9999,
            width: 380,
            maxWidth: "90vw",
            height: 520,
            maxHeight: "75vh",
            background: "white",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            border: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              background: "#f3f4f6",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <img
                src="/bot-icon.jpeg"
                alt="Central do Buffet"
                style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
              />
              Assistente — Central do Buffet
            </span>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>

          <div
            ref={scrollRef}
            style={{ flex: 1, padding: "16px 20px", overflowY: "auto", background: "#f9fafb" }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{ marginBottom: 12, textAlign: msg.role === "user" ? "right" : "left" }}
              >
                <div
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 12,
                    maxWidth: "85%",
                    whiteSpace: "pre-wrap",
                    background: msg.role === "user" ? "#22c55e" : "white",
                    color: msg.role === "user" ? "white" : "#1f2937",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    border: msg.role === "assistant" ? "1px solid #e5e7eb" : "none",
                    textAlign: "left",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ textAlign: "left", marginBottom: 12 }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 12,
                    background: "white",
                    color: "#6b7280",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  Digitando…
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #e5e7eb",
              background: "white",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ex: quantos eventos pagos este mês?"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: 14,
              }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              style={{
                padding: "10px 18px",
                background: "#22c55e",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: "bold",
                opacity: isLoading || !input.trim() ? 0.5 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

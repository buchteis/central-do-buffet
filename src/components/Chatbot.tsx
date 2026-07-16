import React, { useState } from 'react';
import { useTenantAccess } from "@/hooks/useTenantAccess";

// 🔗 URL da sua IA no Streamlit
const AI_API_URL = 'https://minha-ia-d4nnoiycwgyxazwmmdfdha.streamlit.app/chat';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: '🤖 Olá! Sou o assistente do Meu Churras! Como posso ajudar?' }
  ]);

  // 🔥 PEGA O ID DO BUFFET LOGADO
  const { data: access } = useTenantAccess();
  const buffetId = access?.tenant?.id;

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (!buffetId) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Você precisa estar logado em um buffet para usar o assistente.'
      }]);
      return;
    }

    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pergunta: userMessage,
          buffet_id: buffetId
        })
      });

      const data = await response.json();
      const reply = data.resposta || data.response || data.answer || 'Desculpe, não entendi.';

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      console.error('Erro ao chamar IA:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erro ao conectar com a IA. Tente novamente.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          background: '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '30px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🤖
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            zIndex: 9999,
            width: '380px',
            maxWidth: '90vw',
            height: '500px',
            maxHeight: '70vh',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            border: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              background: '#f3f4f6',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>🤖 Assistente Meu Churras</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              flex: 1,
              padding: '16px 20px',
              overflowY: 'auto',
              background: '#f9fafb',
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '12px',
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    maxWidth: '80%',
                    background: msg.role === 'user' ? '#22c55e' : 'white',
                    color: msg.role === 'user' ? 'white' : '#1f2937',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ textAlign: 'left', marginBottom: '12px' }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: 'white',
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  Digitando...
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              background: 'white',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Digite sua mensagem..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                outline: 'none',
                fontSize: '14px',
              }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              style={{
                padding: '10px 18px',
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
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

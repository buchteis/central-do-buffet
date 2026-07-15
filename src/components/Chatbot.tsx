import React, { useState, useRef, useEffect } from 'react';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { text: "Olá! Sou o assistente do Meu Churras. Como posso te ajudar hoje?", isUser: false }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Adiciona mensagem do usuário
    const newMessages = [...messages, { text: message, isUser: true }];
    setMessages(newMessages);
    setMessage('');

    // Simula uma resposta automática (Depois você pode conectar com uma IA real)
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        text: "Recebi sua mensagem! Em breve poderei consultar seus eventos e orçamentos em tempo real.", 
        isUser: false 
      }]);
    }, 1000);
  };

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '30px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '350px',
          height: '500px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          {/* Cabeçalho */}
          <div style={{ padding: '15px 20px', background: '#22c55e', color: 'white' }}>
            <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '16px' }}>🤖 Central do Buffet</h3>
            <span style={{ fontSize: '10px', opacity: 0.9 }}>Online agora</span>
          </div>

          {/* Área de Mensagens */}
          <div 
            ref={scrollRef}
            style={{ 
              flex: 1, 
              padding: '20px', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px',
              background: '#f9fafb'
            }}
          >
            {messages.map((msg, i) => (
              <div 
                key={i} 
                style={{
                  alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
                  background: msg.isUser ? '#22c55e' : 'white',
                  color: msg.isUser ? 'white' : '#374151',
                  padding: '10px 14px',
                  borderRadius: msg.isUser ? '15px 15px 2px 15px' : '15px 15px 15px 2px',
                  fontSize: '13px',
                  maxWidth: '80%',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  border: msg.isUser ? 'none' : '1px solid #e5e7eb'
                }}
              >
                {msg.text}
              </div>
            ))}
          </div>

          {/* Campo de Entrada */}
          <form 
            onSubmit={handleSend}
            style={{ 
              padding: '15px', 
              borderTop: '1px solid #e5e7eb', 
              display: 'flex', 
              gap: '10px',
              background: 'white'
            }}
          >
            <input 
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua dúvida..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button 
              type="submit"
              style={{
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px'
              }}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
};

import React, { useState, useRef, useEffect } from 'react';

export const Chatbot = ({ stats }: { stats?: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Mudei a mensagem inicial para termos certeza que o código atualizou
  const [messages, setMessages] = useState([
    { text: "Olá! Eu sou o NOVO assistente do Meu Churras. Já carreguei seus dados e estou pronto!", isUser: false }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userText = message.toLowerCase();
    setMessages(prev => [...prev, { text: message, isUser: true }]);
    setMessage('');
    setIsLoading(true);

    // Lógica de resposta direta e obrigatória (Sem mensagens genéricas!)
    setTimeout(() => {
      let botResponse = "";

      if (userText.includes("evento") || userText.includes("hoje") || userText.includes("quantos")) {
        const hoje = stats?.evToday || 0;
        const mes = stats?.evMonth || 0;
        botResponse = `Você tem ${hoje} evento(s) hoje e ${mes} agendado(s) para este mês.`;
      } 
      else if (userText.includes("faturamento") || userText.includes("dinheiro") || userText.includes("valor")) {
        const fat = stats?.faturamentoConcluido || 0;
        botResponse = `Seu faturamento concluído atual é de R$ ${fat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
      }
      else if (userText.includes("cliente")) {
        botResponse = `Sua base tem ${stats?.clientsCount || 0} clientes ativos.`;
      }
      else if (userText.includes("atraso") || userText.includes("pagamento")) {
        botResponse = stats?.txOverdue > 0 
          ? `Atenção: existem ${stats.txOverdue} pagamentos atrasados.` 
          : "Não há pagamentos atrasados no momento.";
      }
      else {
        botResponse = "Entendi. Posso te ajudar com informações sobre seus eventos, faturamento, clientes ou pendências financeiras. O que deseja saber?";
      }

      setMessages(prev => [...prev, { text: botResponse, isUser: false }]);
      setIsLoading(false);
    }, 500);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', bottom: '20px', right: '20px', background: '#22c55e', color: 'white',
          border: 'none', borderRadius: '50%', width: '60px', height: '60px', fontSize: '30px',
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '20px', width: '350px', height: '500px',
          background: 'white', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', zIndex: 9999, border: '1px solid #e5e7eb', overflow: 'hidden'
        }}>
          <div style={{ padding: '15px 20px', background: '#22c55e', color: 'white' }}>
            <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '16px' }}>🤖 Central do Buffet</h3>
            <span style={{ fontSize: '10px', opacity: 0.9 }}>Dados Sincronizados</span>
          </div>

          <div ref={scrollRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f9fafb' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
                background: msg.isUser ? '#22c55e' : 'white',
                color: msg.isUser ? 'white' : '#374151',
                padding: '10px 14px', borderRadius: msg.isUser ? '15px 15px 2px 15px' : '15px 15px 15px 2px',
                fontSize: '13px', maxWidth: '80%', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: msg.isUser ? 'none' : '1px solid #e5e7eb'
              }}>
                {msg.text}
              </div>
            ))}
            {isLoading && <div style={{ fontSize: '10px', color: '#6b7280' }}>Verificando...</div>}
          </div>

          <form onSubmit={handleSend} style={{ padding: '15px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px', background: 'white' }}>
            <input 
              type="text" value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Pergunte sobre eventos ou faturamento..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: '20px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }}
            />
            <button type="submit" style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
};

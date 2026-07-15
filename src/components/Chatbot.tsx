import React, { useState, useRef, useEffect } from 'react';

export const Chatbot = ({ stats }: { stats?: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Olá! Sou o assistente do Meu Churras. Tenho acesso aos seus dados em tempo real. O que deseja saber?", isUser: false }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userText = message.toLowerCase();
    setMessages(prev => [...prev, { text: message, isUser: true }]);
    setMessage('');
    setIsLoading(true);

    // Simulação de Inteligência baseada nos dados REAIS do seu Dashboard
    setTimeout(() => {
      let botResponse = "";

      // Lógica de resposta inteligente
      if (userText.includes("evento") || userText.includes("agenda") || userText.includes("hoje")) {
        botResponse = `Você tem ${stats?.evToday || 0} evento(s) hoje. Na semana, são ${stats?.evWeek || 0} e no mês totalizam ${stats?.evMonth || 0}.`;
        if (stats?.alertsEvTomorrow?.length > 0) {
          botResponse += ` Além disso, fique atento: você tem ${stats.alertsEvTomorrow.length} evento(s) amanhã!`;
        }
      } 
      else if (userText.includes("faturamento") || userText.includes("ganho") || userText.includes("dinheiro") || userText.includes("receita")) {
        botResponse = `Seu faturamento concluído é de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.faturamentoConcluido || 0)}.`;
        botResponse += ` A receita já recebida este mês é de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.revenueReceived || 0)}.`;
      }
      else if (userText.includes("atraso") || userText.includes("pendente") || userText.includes("pagamento")) {
        if (stats?.txOverdue > 0) {
          botResponse = `Atenção! Você tem ${stats.txOverdue} pagamento(s) atrasado(s).`;
          if (stats?.alertsPay?.length > 0) {
            botResponse += ` O mais urgente é de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.alertsPay[0].amount)} referente a "${stats.alertsPay[0].description}".`;
          }
        } else {
          botResponse = "Ótimas notícias! Não identifiquei nenhum pagamento atrasado no momento.";
        }
      }
      else if (userText.includes("cliente")) {
        botResponse = `Você possui ${stats?.clientsCount || 0} clientes ativos. Nos últimos 30 dias, você conquistou ${stats?.newClients || 0} novos clientes!`;
      }
      else if (userText.includes("orçamento") || userText.includes("proposta")) {
        botResponse = `Atualmente você tem ${stats?.qPend || 0} orçamentos pendentes aguardando resposta e ${stats?.qApr || 0} já aprovados.`;
      }
      else {
        botResponse = "Entendi! Como assistente do Meu Churras, posso te informar sobre faturamento, eventos de hoje, clientes e pendências financeiras. O que prefere consultar?";
      }

      setMessages(prev => [...prev, { text: botResponse, isUser: false }]);
      setIsLoading(false);
    }, 800);
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
            <span style={{ fontSize: '10px', opacity: 0.9 }}>Conectado aos dados do Buffet</span>
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
            {isLoading && <div style={{ fontSize: '10px', color: '#6b7280' }}>Consultando dados...</div>}
          </div>

          <form onSubmit={handleSend} style={{ padding: '15px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px', background: 'white' }}>
            <input 
              type="text" value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Quantos eventos tenho hoje?"
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

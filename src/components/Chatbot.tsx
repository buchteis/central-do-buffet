import { useState, useEffect, useRef } from 'react';
import { X, Send, Search, Database, Globe, Loader2, Bot, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'db' | 'web' | 'general';
  timestamp: Date;
}

// 🔗 URL da sua IA (substitua pela real)
const AI_API_URL = 'https://sua-ia-hospedada.com/api/chat';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: `🤖 **Olá! Sou o Bot da Central do Buffet!** 🍖

Sou seu assistente virtual especializado em churrascos e eventos!

**Posso ajudar você com:**
📊 **Consultar dados** - Clientes, orçamentos, eventos e muito mais
🌐 **Pesquisar na web** - Receitas, dicas, tendências e informações
📅 **Agendamentos** - Verificar disponibilidade e agendar eventos
💰 **Financeiro** - Consultar pagamentos e faturamento
🎯 **Recomendações** - Sugestões personalizadas para seu evento

**Como posso tornar seu churrasco ainda melhor hoje?** 🥩`,
      type: 'general',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState<'auto' | 'db' | 'web'>('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rolar automaticamente para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ==========================================
  // 🔍 FUNÇÃO: Pesquisar no Banco de Dados
  // ==========================================
  const searchDatabase = async (query: string) => {
    const results = [];
    const searchTerms = query.toLowerCase().split(' ');

    try {
      // 1. Buscar CLIENTES
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, phone, email, cpf, created_at')
        .or(`name.ilike.%${query}%, phone.ilike.%${query}%, email.ilike.%${query}%, cpf.ilike.%${query}%`)
        .limit(5);

      if (clients && clients.length > 0) {
        results.push({
          type: 'clientes',
          title: '👤 Clientes encontrados',
          emoji: '👤',
          data: clients.map(c => ({
            nome: c.name,
            telefone: c.phone || 'Não informado',
            email: c.email || 'Não informado',
            documento: c.cpf || 'Não informado'
          }))
        });
      }

      // 2. Buscar ORÇAMENTOS
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, total_value, status, paid, created_at, clients(name)')
        .or(`clients.name.ilike.%${query}%`)
        .limit(5);

      if (quotes && quotes.length > 0) {
        results.push({
          type: 'orcamentos',
          title: '📄 Orçamentos encontrados',
          emoji: '📄',
          data: quotes.map(q => ({
            cliente: q.clients?.name || 'Não identificado',
            valor: `R$ ${Number(q.total_value).toFixed(2)}`,
            status: q.status,
            pago: q.paid ? '✅ Sim' : '❌ Não'
          }))
        });
      }

      // 3. Buscar EVENTOS
      const { data: events } = await supabase
        .from('events')
        .select('id, event_date, event_time, status, total_value, clients(name), packages(name)')
        .or(`clients.name.ilike.%${query}%, packages.name.ilike.%${query}%`)
        .limit(5);

      if (events && events.length > 0) {
        results.push({
          type: 'eventos',
          title: '📅 Eventos encontrados',
          emoji: '📅',
          data: events.map(e => ({
            cliente: e.clients?.name || 'Não identificado',
            data: e.event_date,
            horario: e.event_time?.slice(0, 5) || '--:--',
            pacote: e.packages?.name || 'Não definido',
            status: e.status,
            valor: `R$ ${Number(e.total_value).toFixed(2)}`
          }))
        });
      }

      // 4. Buscar TRANSAÇÕES pendentes
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, description, amount, status, due_date')
        .eq('status', 'pendente')
        .limit(5);

      if (transactions && transactions.length > 0) {
        results.push({
          type: 'transacoes',
          title: '💰 Pagamentos Pendentes',
          emoji: '💰',
          data: transactions.map(t => ({
            descricao: t.description || 'Sem descrição',
            valor: `R$ ${Number(t.amount).toFixed(2)}`,
            vencimento: t.due_date,
            status: 'Pendente ⏳'
          }))
        });
      }

      return results;

    } catch (error) {
      console.error('Erro na pesquisa do banco:', error);
      return null;
    }
  };

  // ==========================================
  // 🌐 FUNÇÃO: Pesquisar na Web
  // ==========================================
  const searchWeb = async (query: string) => {
    try {
      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Pesquise na web sobre: ${query}. Forneça informações relevantes e atualizadas sobre churrasco, buffet ou eventos.`,
          type: 'web_search'
        }),
      });

      if (!response.ok) throw new Error('Erro na API da IA');
      
      const data = await response.json();
      return data.response || data.answer || 'Não encontrei informações sobre isso.';

    } catch (error) {
      console.error('Erro na pesquisa web:', error);
      return `🔍 Não consegui pesquisar na web agora. 
      
💡 Dica: Tente perguntar sobre:
• "Receitas para churrasco"
• "Como calcular carne por pessoa"
• "Tendências de buffet"
• "Dicas para eventos"`;
    }
  };

  // ==========================================
  // 🤖 FUNÇÃO: Processar pergunta
  // ==========================================
  const processQuery = async (userMessage: string) => {
    const lowerQuery = userMessage.toLowerCase();
    let response = '';
    let type: 'db' | 'web' | 'general' = 'general';

    // 🔍 Detectar intenção
    const isDBQuery = /(cliente|clientes|orçamento|orcamento|evento|eventos|contrato|transação|pagamento|financeiro|faturamento|receita|agendamento|agenda)/i.test(lowerQuery);
    const isWebQuery = /(pesquisar|buscar|google|pesquisa|web|internet|notícia|noticia|informação|informacao|atual|hoje|agora|sobre|como fazer|receita|dica|tendência|tendencia|preço|preco|valor|mercado)/i.test(lowerQuery);
    const isNumericQuery = /(\d+)/.test(lowerQuery);
    const isListQuery = /(lista|listar|todos|todas|mostrar|quantos|quantas|total|resumo|geral)/i.test(lowerQuery);
    const isGreeting = /(oi|olá|ola|bom dia|boa tarde|boa noite|fala|e ai|eai|beleza|tudo bem|como vai|salve)/i.test(lowerQuery);

    // 🎯 Decidir onde pesquisar
    if (isGreeting) {
      response = `🤖 **Olá! Sou o Bot da Central do Buffet!** 🍖

Que bom falar com você! Estou aqui para ajudar com:
• 📊 Consultas rápidas no sistema
• 🌐 Pesquisas na web
• 💰 Informações financeiras
• 📅 Agendamentos

O que você precisa hoje? Estou pronto para ajudar! 🚀`;
      type = 'general';
      
    } else if (searchType === 'db' || (searchType === 'auto' && (isDBQuery || isListQuery || isNumericQuery))) {
      // PESQUISA NO BANCO
      type = 'db';
      const dbResults = await searchDatabase(userMessage);

      if (dbResults && dbResults.length > 0) {
        response = formatDBResults(dbResults);
      } else {
        response = `🔍 **Não encontrei resultados no banco de dados** para sua pesquisa.

📌 **Tente:**
• Usar outro termo de busca
• Verificar se o nome está correto
• Pesquisar na web (clique em "Web" no topo)

💡 **Exemplo:** "Listar clientes" ou "Eventos de hoje"`;
      }

    } else if (searchType === 'web' || (searchType === 'auto' && isWebQuery)) {
      // PESQUISA NA WEB
      type = 'web';
      const webResult = await searchWeb(userMessage);
      response = `🌐 **Pesquisa na Web**

${webResult}

💡 Posso ajudar com mais alguma coisa?`;
    } else {
      // RESPOSTA GERAL
      type = 'general';
      response = `🤖 **Sou o Bot da Central do Buffet!**

Ainda estou aprendendo sobre esse assunto específico.

**Posso ajudar com:**
• 📊 **Dados do sistema** (clientes, orçamentos, eventos)
• 🌐 **Pesquisas na web**
• 💰 **Consultas financeiras**
• 📅 **Agendamentos**

**Tente perguntar:**
• "Listar clientes"
• "Eventos de hoje"
• "Pesquisar sobre churrasco"
• "Qual o faturamento do mês?"`;
    }

    return { response, type };
  };

  // ==========================================
  // 📊 FUNÇÃO: Formatar resultados do banco
  // ==========================================
  const formatDBResults = (results: any[]) => {
    let output = '📊 **Resultados encontrados no sistema**\n\n';

    results.forEach((section, index) => {
      output += `### ${section.title}\n`;
      output += `${'-'.repeat(40)}\n`;

      section.data.forEach((item: any, i: number) => {
        const fields = Object.entries(item);
        const maxLength = Math.max(...fields.map(([key]) => key.length));
        
        fields.forEach(([key, value]) => {
          const padding = ' '.repeat(maxLength - key.length + 2);
          output += `**${key}:**${padding}${value}\n`;
        });
        
        if (i < section.data.length - 1) output += '\n';
      });

      if (index < results.length - 1) output += '\n---\n\n';
    });

    output += '\n📌 *Posso ajudar com mais alguma informação?*';
    return output;
  };

  // ==========================================
  // 💬 Enviar mensagem
  // ==========================================
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      timestamp: new Date()
    }]);
    setInput('');
    setIsLoading(true);

    try {
      const { response, type } = await processQuery(userMessage);

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response,
        type: type,
        timestamp: new Date()
      }]);

    } catch (error) {
      console.error('Erro:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '❌ **Ops! Algo deu errado.** \n\nTente novamente ou recarregue a página. Se o problema persistir, entre em contato com o suporte.',
        type: 'general',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 🎨 Sugestões rápidas
  // ==========================================
  const quickSuggestions = [
    { label: '📋 Clientes', query: 'Listar clientes' },
    { label: '💰 Orçamentos', query: 'Mostrar orçamentos aprovados' },
    { label: '📅 Eventos hoje', query: 'Eventos de hoje' },
    { label: '🌐 Pesquisar web', query: 'Pesquisar sobre churrasco' },
    { label: '📊 Resumo geral', query: 'Qual o faturamento do mês?' },
  ];

  // ==========================================
  // 🖥️ RENDER
  // ==========================================
  return (
    <>
      {/* Botão flutuante com robô */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 group"
      >
        <div className="relative">
          {/* Pulse animation */}
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          
          {/* Botão principal */}
          <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white p-4 rounded-full shadow-2xl hover:shadow-primary/30 transition-all duration-300 hover:scale-110">
            {isOpen ? (
              <X className="w-7 h-7" />
            ) : (
              <div className="relative">
                <Bot className="w-7 h-7" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
              </div>
            )}
          </div>
          
          {/* Tooltip */}
          {!isOpen && (
            <div className="absolute -top-12 right-0 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Bot da Central do Buffet
            </div>
          )}
        </div>
      </button>

      {/* Janela do chat */}
      {isOpen && (
        <div className={cn(
          "fixed bottom-24 right-4 z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300",
          isMinimized ? "w-80 h-14" : "w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[80vh]"
        )}>
          {/* Header com robô */}
          <div className={cn(
            "p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-t-2xl",
            isMinimized && "rounded-b-2xl"
          )}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    Central do Buffet
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </h3>
                  <p className="text-xs text-muted-foreground">🤖 Bot assistente • Online</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filtros - só mostra se não estiver minimizado */}
            {!isMinimized && (
              <div className="flex gap-1 mt-3">
                <button
                  onClick={() => setSearchType('auto')}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5",
                    searchType === 'auto' 
                      ? "bg-primary text-white shadow-md" 
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  <Sparkles className="w-3 h-3" /> Auto
                </button>
                <button
                  onClick={() => setSearchType('db')}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5",
                    searchType === 'db' 
                      ? "bg-blue-500 text-white shadow-md" 
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  <Database className="w-3 h-3" /> Sistema
                </button>
                <button
                  onClick={() => setSearchType('web')}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5",
                    searchType === 'web' 
                      ? "bg-emerald-500 text-white shadow-md" 
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  <Globe className="w-3 h-3" /> Web
                </button>
              </div>
            )}
          </div>

          {/* Messages - esconde se minimizado */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-800/30">
                {messages.map((msg, i) => (
                  <div key={i} className="flex flex-col">
                    <div
                      className={cn(
                        "max-w-[85%] p-3.5 rounded-2xl whitespace-pre-wrap leading-relaxed",
                        msg.role === 'user'
                          ? "ml-auto bg-primary text-white rounded-br-none shadow-md"
                          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none shadow-sm border border-gray-200 dark:border-gray-700"
                      )}
                    >
                      {msg.content}
                    </div>
                    {msg.type && msg.role === 'assistant' && (
                      <div className={cn(
                        "text-[10px] mt-1 font-medium",
                        msg.role === 'user' ? "text-right" : "text-left",
                        msg.type === 'db' && "text-blue-500",
                        msg.type === 'web' && "text-emerald-500",
                        msg.type === 'general' && "text-gray-400"
                      )}>
                        {msg.type === 'db' && '📊 Dados do sistema'}
                        {msg.type === 'web' && '🌐 Pesquisa na web'}
                        {msg.type === 'general' && '🤖 Assistente'}
                      </div>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex items-center gap-3 text-muted-foreground bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-bl-none max-w-[80%] shadow-sm border border-gray-200 dark:border-gray-700">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm">Processando...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Sugestões rápidas */}
              <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  {quickSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(sug.query);
                        setTimeout(() => sendMessage(), 100);
                      }}
                      className="text-xs px-3.5 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-all hover:shadow-md whitespace-nowrap text-gray-700 dark:text-gray-200 font-medium"
                    >
                      {sug.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-b-2xl flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Digite sua pergunta..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  className="bg-gradient-to-r from-primary to-primary/80 text-white p-2.5 rounded-xl hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

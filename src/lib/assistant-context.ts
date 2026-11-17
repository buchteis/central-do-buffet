type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  requestError?: boolean;
};

export function assistantHistory(messages: HistoryMessage[]) {
  return messages
    .filter((message) => !message.requestError && !/^Erro Groq \d{3}:/.test(message.content))
    .map(({ role, content }) => ({ role, content }));
}

// Select domains, not fragments of JSON: all package rows remain available.
export function selectAssistantContext(context: Record<string, unknown>, topic: string) {
  const normalized = topic.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const domains: [RegExp, string[]][] = [
    [/pacot|cardapio/, ["pacotes"]],
    [/estoque|insumo|produto|consum|compras/, ["estoque", "estoque_alerta_baixo", "ultimas_movimentacoes_estoque"]],
    [/cliente|cpf|telefone|contato/, ["clientes", "solicitantes_link_publico"]],
    [/evento|agenda|calendario/, ["proximos_eventos"]],
    [/orcamento|lead/, ["solicitantes_link_publico"]],
    [/whats|conversa|atendente|mensage|robo/, ["whatsapp"]],
    [/parcela|paga|cobr|finance|fatur|receita|saldo|vencid|debito/, ["parcelas", "parcelas_abertas"]],
    [/avaliac|nps|feedback/, ["avaliacoes_clientes"]],
  ];
  const keys = domains.filter(([pattern]) => pattern.test(normalized)).flatMap(([, selected]) => selected);
  if (!keys.length) return context;
  const selected: Record<string, unknown> = {};
  for (const key of ["buffet", "hoje", "metricas", "parcelas_vencendo_em_3_dias", "parcelas_vencidas", ...keys]) {
    if (key in context) selected[key] = context[key];
  }
  return selected;
}
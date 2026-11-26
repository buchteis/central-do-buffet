type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  requestError?: boolean;
};

export function assistantHistory(messages: HistoryMessage[]) {
  return messages
    .filter(
      (message) =>
        !message.requestError &&
        !/^Erro Groq \d{3}:/.test(message.content) &&
        !message.content.startsWith("Não consegui consultar a IA neste momento."),
    )
    .map(({ role, content }) => ({ role, content }));
}

const OVERVIEW_KEYS = [
  "buffet",
  "hoje",
  "metricas",
  "proximos_eventos",
  "estoque_alerta_baixo",
  "parcelas_vencendo_em_3_dias",
  "parcelas_vencidas",
];

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
    [/parcela|paga|cobr|finance|fatur|receita|saldo|vencid|debito/, ["parcelas_abertas", "parcelas"]],
    [/avaliac|nps|feedback/, ["avaliacoes_clientes"]],
  ];
  const keys = domains.filter(([pattern]) => pattern.test(normalized)).flatMap(([, selected]) => selected);
  const selected: Record<string, unknown> = {};
  const chosenKeys = keys.length
    ? ["buffet", "hoje", "metricas", "parcelas_vencendo_em_3_dias", "parcelas_vencidas", ...keys]
    : OVERVIEW_KEYS;
  for (const key of chosenKeys) {
    if (key in context) selected[key] = context[key];
  }
  if (!keys.length && context.whatsapp && typeof context.whatsapp === "object") {
    const wa = context.whatsapp as Record<string, unknown>;
    selected.whatsapp = {
      conexao: wa.conexao,
      total_atendimentos_registrados: wa.total_atendimentos_registrados,
    };
  }
  return selected;
}

// Keeps serialized buffet context safely inside the provider's 7,000-token input budget.
export function serializeContextWithinBudget(context: Record<string, unknown>, maxChars = 12000): string {
  let json = JSON.stringify(context);
  if (json.length <= maxChars) return json;

  const trimmed: Record<string, unknown> = { ...context };
  const shrinkOrder = [
    "ultimas_movimentacoes_estoque",
    "avaliacoes_clientes",
    "solicitantes_link_publico",
    "clientes",
    "parcelas",
    "parcelas_abertas",
    "estoque",
    "parcelas_vencidas",
    "proximos_eventos",
  ];

  for (const limit of [12, 6, 3]) {
    for (const key of shrinkOrder) {
      if (Array.isArray(trimmed[key]) && (trimmed[key] as unknown[]).length > limit) {
        trimmed[key] = (trimmed[key] as unknown[]).slice(0, limit);
      }
    }
    if (trimmed.whatsapp && typeof trimmed.whatsapp === "object") {
      const wa = trimmed.whatsapp as Record<string, unknown>;
      if (Array.isArray(wa.atendimentos_recentes)) {
        trimmed.whatsapp = {
          ...wa,
          atendimentos_recentes: wa.atendimentos_recentes.slice(0, Math.min(limit, 8)).map((conv) => {
            if (!conv || typeof conv !== "object") return conv;
            const entry = conv as Record<string, unknown>;
            return Array.isArray(entry.mensagens_recentes)
              ? { ...entry, mensagens_recentes: entry.mensagens_recentes.slice(-Math.min(limit, 3)) }
              : entry;
          }),
        };
      }
    }
    json = JSON.stringify(trimmed);
    if (json.length <= maxChars) return json;
  }

  for (const key of shrinkOrder) {
    if (key in trimmed) {
      delete trimmed[key];
      json = JSON.stringify(trimmed);
      if (json.length <= maxChars) return json;
    }
  }

  return json.slice(0, maxChars);
}
// Variáveis disponíveis nos modelos de contrato (preenchidas a partir do orçamento/evento).
export const CONTRACT_VARIABLES: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Buffet",
    items: [
      { key: "buffet", label: "Nome do buffet" },
      { key: "cnpj_buffet", label: "CNPJ do buffet" },
      { key: "endereco_buffet", label: "Endereço do buffet" },
      { key: "telefone_buffet", label: "Telefone do buffet" },
    ],
  },
  {
    group: "Cliente",
    items: [
      { key: "cliente", label: "Nome do cliente" },
      { key: "cpf_cliente", label: "CPF/CNPJ do cliente" },
      { key: "endereco_cliente", label: "Endereço do cliente" },
      { key: "telefone_cliente", label: "Telefone do cliente" },
    ],
  },
  {
    group: "Evento",
    items: [
      { key: "data_evento", label: "Data do evento" },
      { key: "hora_evento", label: "Hora do evento" },
      { key: "local_evento", label: "Local do evento" },
      { key: "convidados", label: "Nº de convidados" },
    ],
  },
  {
    group: "Itens",
    items: [
      { key: "pacotes", label: "Pacotes detalhados" },
      { key: "pacote", label: "Nome do pacote" },
      { key: "itens_unitarios", label: "Itens unitários" },
      { key: "itens_adicionais", label: "Itens adicionais" },
      { key: "acrescimos_adicionais", label: "Acréscimos / taxas" },
      { key: "descricao_pacote", label: "Descrição do pacote" },
      { key: "cardapio", label: "Cardápio" },
    ],
  },
  {
    group: "Pagamento",
    items: [
      { key: "valor", label: "Valor total" },
      { key: "entrada", label: "Entrada" },
      { key: "saldo", label: "Saldo restante" },
      { key: "forma_pagamento", label: "Forma de pagamento" },
      { key: "dados_pagamento", label: "Dados para pagamento" },
      { key: "pix", label: "Chave PIX" },
      { key: "pix_titular", label: "Titular do PIX" },
      { key: "dados_bancarios", label: "Dados bancários" },
    ],
  },
  {
    group: "Outros",
    items: [{ key: "data_hoje", label: "Data de hoje" }],
  },
];

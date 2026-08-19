// Modelo padrão de contrato — usa as mesmas variáveis preenchidas em Contratos.
export const DEFAULT_CONTRACT_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BUFFET

CONTRATADA: {buffet}
Endereço: {endereco_buffet}
Telefone: {telefone_buffet}

CONTRATANTE: {cliente}
CPF/CNPJ: {cpf_cliente}
Endereço: {endereco_cliente}
Telefone: {telefone_cliente}

1. OBJETO
A CONTRATADA prestará serviços de buffet para o evento realizado em {data_evento}, às {hora_evento}, no local {local_evento}, para aproximadamente {convidados} convidados.

2. PACOTES CONTRATADOS
{pacotes}

3. ITENS ADICIONAIS
{itens_adicionais}

4. ACRÉSCIMOS / TAXAS
{acrescimos_adicionais}

5. VALORES E PAGAMENTO
Valor total: {valor}
Entrada: {entrada}
Saldo restante: {saldo}
Forma de pagamento: {forma_pagamento}
Dados para pagamento: {dados_pagamento}

6. OBSERVAÇÕES
O cancelamento por parte do CONTRATANTE com menos de 30 (trinta) dias de antecedência não gera devolução do valor de entrada. Alterações de data ficam sujeitas à disponibilidade da agenda da CONTRATADA.

Local e data: {data_hoje}


____________________________________
{buffet} (CONTRATADA)


____________________________________
{cliente} (CONTRATANTE)
`;

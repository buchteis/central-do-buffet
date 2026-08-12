# Separar pacotes, itens adicionais e acréscimos

## Objetivo
Eliminar a duplicidade causada por itens unitários vinculados a pacotes e manter três grupos independentes em todo o fluxo:

1. **Pacotes** — cobrados por pessoa e exibidos um por linha.
2. **Itens adicionais** — catálogo próprio, cobrados por quantidade × preço unitário, com vínculo opcional ao estoque.
3. **Acréscimos adicionais** — lançamentos livres no orçamento, como deslocamento e aluguel de churrasqueira.

## Implementação

### Banco de dados
- Criar um catálogo independente de itens adicionais por buffet, com nome, unidade, preço unitário, produto de estoque opcional e estado ativo.
- Proteger o catálogo por usuário/buffet e permitir somente a leitura pública dos itens ativos pertencentes a buffets ativos.
- Atualizar o envio do link público para validar os itens adicionais pelo catálogo independente, calcular `quantidade × preço unitário` no servidor e salvar o snapshot em `extras.unit_items`.
- Preservar a leitura de orçamentos antigos e o fluxo atual de reserva de estoque.

### Cadastro e orçamento administrativo
- Na página de Pacotes, remover o editor de itens unitários de dentro de cada pacote.
- Adicionar um botão **Itens adicionais** com cadastro, edição, ativação e exclusão de itens como “Barril de Chope”.
- No Novo/Completar Orçamento, carregar itens adicionais independentemente dos pacotes escolhidos.
- Manter os acréscimos livres em `extras.custom`, com cálculo no total e persistência do rascunho.

### Link público
- Exibir duas áreas separadas: **Pacotes desejados** e **Itens adicionais (opcional)**.
- Permitir selecionar itens adicionais mesmo sem selecionar pacote.
- Mostrar subtotais separados e enviar os IDs/quantidades ao cálculo seguro do banco.

### Kanban, detalhes, PDF e contratos
- Trocar descrições combinadas com “+” por listas separadas, sem transformar dois pacotes em um nome composto.
- No detalhe do Kanban, exibir seções distintas para Pacotes, Itens adicionais e Acréscimos adicionais.
- No PDF, manter uma linha para cada pacote, item adicional e acréscimo, sem heurística de duplicidade entre categorias.
- Nos contratos, manter `{itens_unitarios}` por compatibilidade e adicionar/preencher `{itens_adicionais}` e `{acrescimos_adicionais}` com os valores efetivamente salvos no orçamento.

## Compatibilidade e validação
- Orçamentos antigos continuam legíveis pelos snapshots existentes.
- Eventos, estoque, financeiro e valores de entrada/saldo continuam usando o total final já consolidado.
- Validar o link público, edição/restauração de orçamento, detalhe do Kanban, geração de PDF e variáveis de contrato em desktop e smartphone.

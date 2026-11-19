# Canal de suporte
- [ ] Adicionar Mensagens abaixo de Configurações e caixa de entrada no Super Admin.
- [ ] Salvar mensagens e respostas separadas por buffet, com acesso exclusivo do dono e do administrador.
- [ ] Testar envio, resposta, persistência e bloqueio entre cadastros no computador e celular.

# Limite de tokens do assistente
- [x] Tratar o erro 429 respeitando o tempo de espera da Groq e sem mostrar o erro técnico como resposta.
- [x] Reduzir os dados irrelevantes enviados à IA, preservando a pergunta, o histórico e os dados necessários.
- [x] Validar 26 testes e as perguntas reais de quantidade e listagem de pacotes no assistente autenticado.
- [ ] Aumentar a cota de tokens por minuto: depende da alteração dos limites/plano da conta Groq pelo titular; não é configurável no código.

# Pipeline do atendente WhatsApp
- [x] Corrigir a persistência das etapas manuais sem retornar para Novos.
- [x] Identificar intenção de marcar data e degustação nas respostas do cliente e avançar automaticamente, sem regredir etapas, inclusive antes de possíveis falhas de IA.
- [x] Validar 45 testes, filtros/políticas por buffet e movimentação autenticada no computador/celular após atualização automática e recarregamento; conversa de teste restaurada à etapa original.
- [ ] Ativar a classificação nova no recebimento publicado: depende da publicação das correções e de uma nova mensagem de teste no WhatsApp.

# Atendente WhatsApp
- [x] Vincular e ativar o conector personalizado Evolution API Central do Buffet neste projeto.
- [x] Integrar a conexão vinculada a todas as chamadas Evolution do atendente, sem utilizar credenciais antigas de acesso direto.
- [x] Validar as credenciais do aplicativo pelo conector: servidor respondeu 200 e a sessão do buffet está conectada, com atendente ligado.
- [x] Corrigir as respostas bloqueadas pela combinação de ferramentas com modo JSON, o exemplo de saída inválido e a escrita da coluna inexistente budget.
- [x] Conferir o destino de recebimento e as mensagens persistidas do próprio buffet, preservando o escopo existente.
- [x] Executar 46 testes e conferir a página autenticada no computador e celular.
- [x] Validar uma resposta real da inteligência do atendente, sem enviar mensagens para clientes.
- [ ] Publicar as correções: o recebimento está apontado para o site publicado, que ainda usa a versão anterior.
- [ ] Confirmar uma resposta entregue a uma nova mensagem de teste após a publicação; o número já está conectado e não precisa de novo QR.

# Identificação do contrato
- [x] Mostrar logo e nome do buffet na página pública de assinatura, sem marca da plataforma.
- [x] Conferir a identidade exibida em um contrato real e em celular.

# Modelo do chatbot
- [x] Usar Groq com openai/gpt-oss-20b e GROQ_API_KEY (com fallback para OPENAI_API_KEY) no chatbot e atendente WhatsApp.
- [x] Validar a chave do servidor e uma resposta real do atendente WhatsApp; o provedor existente foi preservado nesta vinculação.

A leitura de notas fiscais em imagem/PDF permanece no provedor existente: o modelo Groq configurado aceita apenas texto e não pode substituir essa função sem perder leitura de arquivos.

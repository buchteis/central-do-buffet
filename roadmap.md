# Atendente WhatsApp
- [ ] Vincular o servidor Evolution por conexão segura.
- [ ] Corrigir conexão, estados e erros do atendente existente.
- [ ] Conferir isolamento por buffet e recebimento de mensagens.
- [ ] Executar testes e conferir a página no computador e celular.
- [ ] Validar QR e atendimento real (depende do servidor ativo e leitura do QR pelo usuário).

# Identificação do contrato
- [x] Mostrar logo e nome do buffet na página pública de assinatura, sem marca da plataforma.
- [x] Conferir a identidade exibida em um contrato real e em celular.

# Modelo do chatbot
- [ ] Usar OpenRouter com meta-llama/llama-3.3-70b-instruct:free e a chave salva em OPENAI_API_KEY no chatbot e atendente WhatsApp.
- [ ] Corrigir parsing, chamadas de ferramentas e referências restantes ao provedor anterior nos dois chats; conferir chamadas em Edge Functions existentes.
- [ ] Executar os testes relacionados e conferir uma pergunta real no chatbot.
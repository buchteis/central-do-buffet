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
- [x] Usar Groq com openai/gpt-oss-20b e GROQ_API_KEY (com fallback para OPENAI_API_KEY) no chatbot e atendente WhatsApp.
- [ ] Validar a chave do servidor e respostas reais do chatbot e atendente WhatsApp.

A leitura de notas fiscais em imagem/PDF permanece no provedor existente: o modelo Groq configurado aceita apenas texto e não pode substituir essa função sem perder leitura de arquivos.

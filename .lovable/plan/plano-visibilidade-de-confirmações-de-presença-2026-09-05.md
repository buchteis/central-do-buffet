# Plano: Visibilidade de confirmações de presença

## Contexto
Cada evento já tem um link público `/convite/<token>` que os convidados acessam para confirmar presença. As respostas são salvas em `public.event_rsvps`. Hoje o dono do buffet não vê, dentro da plataforma, quantas pessoas confirmaram — só consegue saber abrindo o próprio link de convite. Este plano corrige isso.

## O que será feito

1. **Contador na lista de eventos**
   - Trazer a contagem de confirmados na query de eventos (`events/index.tsx`).
   - Adicionar uma coluna "Confirmados" na tabela, com badge clicável.

2. **Modal de detalhe dos convidados**
   - Criar componente `RsvpListModal`.
   - Ao clicar no contador, abrir o modal listando nome, telefone, acompanhantes, status (vai/não vai), recado e data/hora da confirmação.
   - Modal em tema azul claro, com botões em auto-relevo, seguindo o padrão visual atual.

3. **Atualização em tempo real**
   - Inscrever a lista de eventos no canal `event_rsvps` do Supabase Realtime para que novas confirmações atualizem o contador sem recarregar a página.

4. **(Opcional, se simples) Notificação no WhatsApp**
   - Quando uma confirmação nova chegar, enviar mensagem automática para o WhatsApp cadastrado em `buffet_settings.whatsapp` com nome do convidado, evento e total atualizado.
   - Só implementar se não aumentar complexidade do escopo.

## Resultado esperado
O dono do buffet abre "Eventos", vê em cada linha quantos convidados confirmaram, clica no número e vê a lista completa com nomes e recados. Novas confirmações aparecem ao vivo.

## Arquivos envolvidos
- `src/routes/_authenticated/eventos/index.tsx` (query, coluna, realtime)
- `src/components/eventos/RsvpListModal.tsx` (novo)
- `src/lib/whatsapp.ts` (mensagem automática, opcional)

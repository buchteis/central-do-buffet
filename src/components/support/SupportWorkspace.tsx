import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Headset, Inbox, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupportMessages, sendSupportMessage } from "@/lib/support.functions";
import { supportInboxOptions } from "@/lib/support-query";
import { cn } from "@/lib/utils";
import supportIllustration from "@/assets/support-illustration.png.asset.json";

type Cursor = { createdAt: string; id: string } | null;

export function SupportWorkspace() {
  const { data: inbox } = useSuspenseQuery(supportInboxOptions());
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const selectedThread = inbox.threads.find((thread) => thread.tenant_id === selected) ?? inbox.threads[0];
  const threads = inbox.threads.filter((thread) => thread.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  return (
    <div className={cn("min-w-0", inbox.isAdmin && "grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]")}>
      {inbox.isAdmin && (
        <aside className="min-w-0 border-b border-border pb-4 md:border-b-0 md:border-r md:pr-5" aria-label="Cadastros de suporte">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Cadastros</h2>
            <span className="text-xs text-muted-foreground">{inbox.threads.length}</span>
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input aria-label="Buscar buffet" placeholder="Buscar buffet" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
          <div className="flex max-h-60 flex-col gap-2 overflow-y-auto md:max-h-[620px]">
            {threads.map((thread) => (
              <Button key={thread.tenant_id} variant="ghost" onClick={() => setSelected(thread.tenant_id)}
                aria-pressed={selectedThread?.tenant_id === thread.tenant_id}
                className={cn("h-auto min-h-24 flex-col items-start gap-1 border border-border p-3 text-left whitespace-normal", selectedThread?.tenant_id === thread.tenant_id && "bg-accent text-accent-foreground ring-1 ring-ring")}>
                <span className="w-full truncate font-bold">{thread.name}</span>
                <span className="line-clamp-2 w-full break-words text-xs font-normal text-muted-foreground">{thread.last_body || "Nenhuma mensagem"}</span>
                {thread.last_message_at && <span className="text-[11px] font-normal text-muted-foreground">{formatTime(thread.last_message_at)}</span>}
                {thread.last_sender === "buffet" && <span className="text-[11px] font-semibold text-info">Aguardando suporte</span>}
              </Button>
            ))}
            {threads.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cadastro encontrado.</p>}
          </div>
        </aside>
      )}
      {selectedThread ? (
        <SupportConversation key={selectedThread.tenant_id} tenantId={selectedThread.tenant_id} name={selectedThread.name} isAdmin={inbox.isAdmin} />
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Inbox className="size-9" /><p>Nenhum cadastro disponível.</p>
        </div>
      )}
    </div>
  );
}

function SupportConversation({ tenantId, name, isAdmin }: { tenantId: string; name: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const readMessages = useServerFn(getSupportMessages);
  const sendMessage = useServerFn(sendSupportMessage);
  const [body, setBody] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const previousLatest = useRef<string | null>(null);
  const messages = useInfiniteQuery({
    queryKey: ["support-messages", tenantId],
    initialPageParam: null as Cursor,
    queryFn: ({ pageParam }) => readMessages({ data: { tenantId, before: pageParam } }),
    getNextPageParam: (page): Cursor | undefined => {
      const last = page.at(-1);
      return page.length === 50 && last ? { createdAt: last.created_at, id: last.id } : undefined;
    },
    refetchInterval: 5_000,
  });
  const rows = (messages.data?.pages.flat() ?? []).slice().reverse();
  const latestId = rows.at(-1)?.id ?? null;
  useEffect(() => {
    const element = scroller.current;
    if (!element || latestId === previousLatest.current) return;
    if (!previousLatest.current || element.scrollHeight - element.scrollTop - element.clientHeight < 220) {
      element.scrollTop = element.scrollHeight;
    }
    previousLatest.current = latestId;
  }, [latestId]);

  const send = useMutation({
    mutationFn: (text: string) => sendMessage({ data: { tenantId, body: text } }),
    onSuccess: async () => {
      setBody("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["support-messages", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["support-inbox"] }),
      ]);
      const element = scroller.current;
      if (element) element.scrollTop = element.scrollHeight;
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card" aria-label={`Conversa de suporte — ${name}`}>
      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Headset className="size-5" /></div>
        <div className="min-w-0">
          <h2 className="break-words font-bold">{isAdmin ? name : "Suporte Central do Buffet"}</h2>
          <p className="text-xs text-muted-foreground">{isAdmin ? "Conversa do cadastro" : name}</p>
        </div>
      </header>
      <div ref={scroller} role="log" aria-label="Mensagens de suporte" aria-live="polite" className="relative h-[420px] min-h-64 space-y-4 overflow-y-auto bg-background p-4 md:h-[520px]">
        <img src={supportIllustration.url} alt="" aria-hidden="true" width={336} height={247}
          className="support-empty-float pointer-events-none sticky top-1/2 left-1/2 z-0 mx-auto aspect-[336/247] w-[336px] max-w-[80%] -translate-y-1/2 object-contain opacity-20 select-none dark:opacity-15" />
        {messages.isPending && <div className="relative z-10 flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando mensagens…</div>}
        {messages.isError && <div className="relative z-10 py-6 text-center"><p className="mb-3 text-sm text-destructive">Não foi possível carregar as mensagens.</p><Button variant="outline" onClick={() => messages.refetch()}>Tentar novamente</Button></div>}
        {messages.hasNextPage && <div className="relative z-10 text-center"><Button variant="ghost" size="sm" disabled={messages.isFetchingNextPage} onClick={() => messages.fetchNextPage()}>Mensagens anteriores</Button></div>}
        {rows.length === 0 && !messages.isPending && !messages.isError && (
          <div className="relative z-10 mt-6 space-y-2 text-center">
            <h3 className="text-xl font-medium text-foreground md:text-2xl">Nenhuma mensagem por aqui ainda!</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">Que tal iniciar uma conversa com o suporte?<br />Estamos prontos para te ajudar!</p>
          </div>
        )}
        {rows.map((message) => {
          const own = isAdmin ? message.sender_role === "suporte" : message.sender_role === "buffet";
          return <div key={message.id} className={cn("relative z-10 flex", own ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[90%] rounded-lg border px-4 py-3 md:max-w-[80%]", own ? "border-field-border bg-field text-foreground" : "border-border bg-card text-card-foreground")}>
              <div className="mb-1 text-xs font-bold">{message.sender_role === "suporte" ? "Suporte Central do Buffet" : name}</div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
              <time dateTime={message.created_at} className="mt-2 block text-right text-[11px] text-muted-foreground">{formatTime(message.created_at)}</time>
            </div>
          </div>;
        })}
      </div>
      <form className="space-y-3 border-t border-border p-4" onSubmit={(event) => { event.preventDefault(); if (body.trim() && !send.isPending) send.mutate(body); }}>
        <label htmlFor={`support-body-${tenantId}`} className="text-sm font-medium">{isAdmin ? "Responder ao buffet" : "Mensagem para o suporte"}</label>
        <Textarea id={`support-body-${tenantId}`} placeholder="Escreva sua mensagem…" value={body} onChange={(event) => setBody(event.target.value)} disabled={send.isPending} rows={3} className="min-h-24 resize-y bg-field" />
        <div className="flex justify-end"><Button type="submit" disabled={!body.trim() || send.isPending}>{send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{send.isPending ? "Enviando…" : "Enviar mensagem"}</Button></div>
      </form>
    </section>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
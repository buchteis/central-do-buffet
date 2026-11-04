import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  QrCode,
  Send,
  Smartphone,
  UserRound,
  Unplug,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  connectWhatsapp,
  disconnectWhatsapp,
  getWhatsappOverview,
  refreshWhatsappStatus,
  sendOwnerWhatsappMessage,
} from "@/lib/whatsapp-bot.functions";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "Atendente WhatsApp — Central do Buffet" },
      {
        name: "description",
        content: "Conecte o WhatsApp do seu buffet e deixe o atendente virtual responder os clientes.",
      },
    ],
  }),
  component: WhatsappPage,
});

type Conversation = {
  id: string;
  phone: string | null;
  contact_name: string | null;
  lead_name: string | null;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  bot_paused: boolean;
  needs_human: boolean;
  handoff_reason: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  connected: { label: "Conectado", className: "bg-success/15 text-success border-success/30" },
  connecting: { label: "Aguardando leitura do QR Code", className: "bg-warning/15 text-warning-foreground border-warning/30" },
  disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground border-border" },
};

function fmtPhone(p: string | null) {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return p;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function WhatsappPage() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getWhatsappOverview);
  const overview = useQuery({ queryKey: ["wa-overview"], queryFn: () => fetchOverview() });
  const inst = overview.data?.instance ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <MessageCircle className="size-6 text-primary" /> Atendente WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecte o WhatsApp do buffet e o atendente virtual responde os clientes com seus pacotes e preços.
        </p>
      </header>

      {overview.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : !overview.data?.serverConfigured ? (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <QrCode className="size-5 text-primary" /> Conexão por QR Code ainda não disponível
          </div>
          <p className="text-sm text-muted-foreground">
            O servidor de WhatsApp da Central do Buffet ainda não foi ligado. Assim que estiver pronto, você poderá
            conectar seu número aqui escaneando um QR Code.
          </p>
        </div>
      ) : (
        <>
          <ConnectionCard
            instance={inst}
            onChanged={() => qc.invalidateQueries({ queryKey: ["wa-overview"] })}
          />
          {inst && <BotToggle instance={inst} onChanged={() => qc.invalidateQueries({ queryKey: ["wa-overview"] })} />}
        </>
      )}

      <Conversations connected={inst?.status === "connected"} />
    </div>
  );
}

function ConnectionCard({ instance, onChanged }: { instance: Record<string, any> | null; onChanged: () => void }) {
  const connect = useServerFn(connectWhatsapp);
  const refresh = useServerFn(refreshWhatsappStatus);
  const disconnect = useServerFn(disconnectWhatsapp);
  const [qr, setQr] = useState<string | null>(instance?.qr_code ?? null);
  const [status, setStatus] = useState<string>(instance?.status ?? "disconnected");
  const [phone, setPhone] = useState<string | null>(instance?.phone_number ?? null);
  const [busy, setBusy] = useState(false);
  const ticks = useRef(0);

  useEffect(() => {
    setStatus(instance?.status ?? "disconnected");
    setPhone(instance?.phone_number ?? null);
    if (instance?.qr_code) setQr(instance.qr_code);
  }, [instance?.status, instance?.phone_number, instance?.qr_code]);

  // Poll while waiting for the QR scan; ask for a fresh QR every ~25s.
  useEffect(() => {
    if (status !== "connecting") return;
    ticks.current = 0;
    const id = window.setInterval(async () => {
      ticks.current += 1;
      try {
        const r = await refresh({ data: { refreshQr: ticks.current % 6 === 0 } });
        if (r.qr) setQr(r.qr);
        if (r.status !== status) {
          setStatus(r.status);
          setPhone(r.phone);
          if (r.status === "connected") {
            toast.success("WhatsApp conectado!");
            onChanged();
          }
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [status]);

  async function handleConnect() {
    setBusy(true);
    try {
      const r = await connect();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setStatus(r.status);
      setQr(r.qr);
      if (r.status === "connected") toast.success("WhatsApp já está conectado.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Desconectar o WhatsApp do buffet? O atendente virtual para de responder.")) return;
    setBusy(true);
    try {
      await disconnect();
      setStatus("disconnected");
      setQr(null);
      setPhone(null);
      toast.success("WhatsApp desconectado.");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const st = STATUS_LABEL[status] ?? STATUS_LABEL.disconnected;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-start gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Smartphone className="size-5 text-primary" />
            <span className="font-bold">Conexão do número</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold", st.className)}>{st.label}</span>
          </div>
          {status === "connected" ? (
            <>
              <p className="text-sm">
                Número conectado: <strong>{fmtPhone(phone) || "—"}</strong>
                {instance?.profile_name ? <span className="text-muted-foreground"> · {instance.profile_name}</span> : null}
              </p>
              <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
                <Unplug className="size-4" /> Desconectar
              </Button>
            </>
          ) : status === "connecting" ? (
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
              <li>Abra o WhatsApp no celular do buffet.</li>
              <li>Toque em <strong>Configurações → Aparelhos conectados → Conectar um aparelho</strong>.</li>
              <li>Aponte a câmera para o QR Code ao lado. A página atualiza sozinha.</li>
            </ol>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Gere um QR Code e escaneie com o WhatsApp do buffet. Você continua usando o WhatsApp normalmente no
                celular.
              </p>
              <Button onClick={handleConnect} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />} Conectar WhatsApp
              </Button>
            </>
          )}
        </div>
        {status === "connecting" && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-xl bg-background p-3 border border-border">
              {qr ? (
                <img src={qr} alt="QR Code para conectar o WhatsApp" className="size-56 [image-rendering:pixelated] bg-white rounded" />
              ) : (
                <div className="size-56 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleConnect} disabled={busy}>
              Gerar novo QR Code
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function BotToggle({ instance, onChanged }: { instance: Record<string, any>; onChanged: () => void }) {
  const [on, setOn] = useState<boolean>(!!instance.bot_enabled);
  useEffect(() => setOn(!!instance.bot_enabled), [instance.bot_enabled]);
  async function toggle(v: boolean) {
    setOn(v);
    const { error } = await (supabase as any).from("whatsapp_instances").update({ bot_enabled: v }).eq("id", instance.id);
    if (error) {
      setOn(!v);
      toast.error("Não foi possível alterar o atendente.");
      return;
    }
    toast.success(v ? "Atendente virtual ligado." : "Atendente virtual pausado.");
    onChanged();
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
      <div className={cn("size-10 rounded-xl flex items-center justify-center", on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
        <Bot className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold">Atendente virtual {on ? "ligado" : "desligado"}</div>
        <p className="text-xs text-muted-foreground">
          Quando ligado, responde os clientes, apresenta pacotes e avisa você quando alguém quiser fechar ou falar com
          uma pessoa.
        </p>
      </div>
      <Switch checked={on} onCheckedChange={toggle} aria-label="Ligar ou desligar o atendente virtual" />
    </section>
  );
}

function Conversations({ connected }: { connected: boolean }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const convs = useQuery({
    queryKey: ["wa-conversations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_conversations")
        .select("*")
        .order("needs_human", { ascending: false })
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Conversation[];
    },
    refetchInterval: 5000,
  });
  const list = convs.data ?? [];
  const current = useMemo(() => list.find((c) => c.id === selected) ?? null, [list, selected]);

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <span className="font-bold">Conversas</span>
        <span className="text-xs text-muted-foreground">{list.length} no total</span>
      </div>
      {list.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          Nenhuma conversa ainda. Quando um cliente mandar mensagem para o WhatsApp conectado, ela aparece aqui.
        </p>
      ) : (
        <div className="grid md:grid-cols-[320px_1fr] min-h-[480px]">
          <ul className={cn("border-r border-border divide-y divide-border overflow-y-auto max-h-[640px]", current && "hidden md:block")}>
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex gap-3 hover:bg-accent transition-colors",
                    selected === c.id && "bg-primary/10",
                  )}
                >
                  <div className="size-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <UserRound className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {c.lead_name || c.contact_name || fmtPhone(c.phone)}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.last_message_preview}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {c.needs_human && <Badge variant="destructive" className="text-[10px]">Precisa de você</Badge>}
                      {c.bot_paused && !c.needs_human && <Badge variant="secondary" className="text-[10px]">Robô pausado</Badge>}
                      {c.unread_count > 0 && <Badge className="text-[10px]">{c.unread_count} nova(s)</Badge>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className={cn(!current && "hidden md:flex", "flex flex-col min-w-0")}>
            {current ? (
              <Thread
                conv={current}
                connected={connected}
                onBack={() => setSelected(null)}
                onChanged={() => qc.invalidateQueries({ queryKey: ["wa-conversations"] })}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                Escolha uma conversa para ver as mensagens.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Thread({
  conv,
  connected,
  onBack,
  onChanged,
}: {
  conv: Conversation;
  connected: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const sendFn = useServerFn(sendOwnerWhatsappMessage);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const msgs = useQuery({
    queryKey: ["wa-messages", conv.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_messages")
        .select("id, direction, sender, body, created_at, reply_status")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (conv.unread_count > 0) {
      void (supabase as any).from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", conv.id).then(onChanged);
    }
  }, [conv.id, conv.unread_count]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs.data?.length]);

  async function patch(values: Partial<Conversation>, okMsg: string) {
    const { error } = await (supabase as any).from("whatsapp_conversations").update(values).eq("id", conv.id);
    if (error) return toast.error("Não foi possível atualizar a conversa.");
    toast.success(okMsg);
    onChanged();
  }

  const send = useMutation({
    mutationFn: async () => sendFn({ data: { conversationId: conv.id, text } }),
    onSuccess: (r) => {
      if (!r.ok) return toast.error(r.error);
      setText("");
      msgs.refetch();
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar."),
  });

  const leadBits = [
    conv.event_type && `🎉 ${conv.event_type}`,
    conv.event_date && `📅 ${conv.event_date}`,
    conv.guest_count && `👥 ${conv.guest_count} convidados`,
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <button className="md:hidden p-1 -ml-1 text-muted-foreground" onClick={onBack} aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{conv.lead_name || conv.contact_name || fmtPhone(conv.phone)}</div>
          <div className="text-xs text-muted-foreground">{fmtPhone(conv.phone)}</div>
        </div>
        {conv.bot_paused ? (
          <Button size="sm" variant="outline" onClick={() => patch({ bot_paused: false, needs_human: false }, "Robô reativado nesta conversa.")}>
            <PlayCircle className="size-4" /> Reativar robô
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => patch({ bot_paused: true }, "Robô pausado nesta conversa.")}>
            <PauseCircle className="size-4" /> Pausar robô
          </Button>
        )}
        {conv.needs_human && (
          <Button size="sm" variant="ghost" onClick={() => patch({ needs_human: false }, "Marcado como atendido.")}>
            <CheckCircle2 className="size-4" /> Atendido
          </Button>
        )}
      </div>
      {(conv.needs_human || leadBits.length > 0) && (
        <div className="px-4 py-2 border-b border-border bg-muted/40 text-xs flex flex-wrap gap-x-4 gap-y-1">
          {conv.needs_human && (
            <span className="text-destructive font-semibold">⚠️ {conv.handoff_reason || "Cliente precisa de atendimento humano"}</span>
          )}
          {leadBits.map((b) => (
            <span key={b}>{b}</span>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[480px] bg-background/50">
        {(msgs.data ?? []).map((m) => {
          const mine = m.direction === "out";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
                  mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm",
                )}
              >
                {m.body}
                <div className={cn("text-[10px] mt-1 opacity-70", mine ? "text-right" : "")}>
                  {m.sender === "bot" ? "Robô · " : m.sender === "owner" ? "Você · " : ""}
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {m.reply_status === "failed" ? " · resposta falhou" : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        className="p-3 border-t border-border flex gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={connected ? "Responder como você…" : "Conecte o WhatsApp para responder"}
          disabled={!connected || send.isPending}
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) send.mutate();
            }
          }}
        />
        <Button type="submit" disabled={!connected || !text.trim() || send.isPending} aria-label="Enviar">
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </>
  );
}

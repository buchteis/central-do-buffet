import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  QrCode,
  Send,
  Smartphone,
  UserRound,
  Unplug,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  groupWhatsappConversations,
  moveWhatsappConversationToStage,
  whatsappPipelineStage,
  WHATSAPP_PIPELINE,
  type WhatsappPipelineStage,
} from "@/lib/whatsapp-pipeline";
import {
  connectWhatsapp,
  disconnectWhatsapp,
  getWhatsappOverview,
  moveWhatsappConversationPipelineStage,
  refreshWhatsappStatus,
  setWhatsappConversationBotPaused,
  sendOwnerWhatsappMessage,
  type WhatsappInstanceOverview,
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
  remote_jid: string;
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
  tenant_id: string;
  pipeline_stage?: string | null;
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

function conversationContact(conversation: Conversation) {
  return fmtPhone(conversation.phone) || fmtPhone(conversation.remote_jid.split("@")[0]) || "Sem contato";
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

      {overview.isPending ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : overview.isError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-6 space-y-3">
          <p className="text-sm text-destructive">Não foi possível carregar a conexão do WhatsApp.</p>
          <Button variant="outline" onClick={() => void overview.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          {inst?.status !== "connected" && !overview.data?.serverConfigured && (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <QrCode className="size-5 text-primary" /> Conexão por QR Code ainda não disponível
              </div>
              <p className="text-sm text-muted-foreground">
                O servidor de WhatsApp da Central do Buffet ainda não foi ligado. Assim que estiver pronto, você poderá
                conectar seu número aqui escaneando um QR Code.
              </p>
            </div>
          )}
          <ConnectionCard
            instance={inst}
            onChanged={() => qc.invalidateQueries({ queryKey: ["wa-overview"] })}
          />
          {inst && <BotToggle instance={inst} onChanged={() => qc.invalidateQueries({ queryKey: ["wa-overview"] })} />}
        </>
      )}

      <Conversations connected={inst?.status === "connected"} botEnabled={!!inst?.bot_enabled} />
    </div>
  );
}

function ConnectionCard({ instance, onChanged }: { instance: WhatsappInstanceOverview | null; onChanged: () => void }) {
  const connect = useServerFn(connectWhatsapp);
  const refresh = useServerFn(refreshWhatsappStatus);
  const disconnect = useServerFn(disconnectWhatsapp);
  const [qr, setQr] = useState<string | null>(instance?.qr_code ?? null);
  const [status, setStatus] = useState<string>(instance?.status ?? "disconnected");
  const [phone, setPhone] = useState<string | null>(instance?.phone_number ?? null);
  const [phoneInput, setPhoneInput] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
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
        const r = await refresh({ data: { refreshQr: ticks.current % 6 === 0 && !pairingCode } });
        if (r.qr && !pairingCode) setQr(r.qr);
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
  }, [status, pairingCode]);

  async function handleConnect(phoneNumber?: string) {
    setBusy(true);
    try {
      const r = await connect({ data: phoneNumber ? { phoneNumber } : {} });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setStatus(r.status);
      setQr(r.qr);
      setPairingCode(r.pairingCode ?? null);
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
          ) : status === "connecting" && pairingCode ? (
            <p className="text-sm text-muted-foreground">
              No WhatsApp do número informado, abra <strong>Aparelhos conectados</strong>, escolha <strong>Conectar
              usando número de telefone</strong> e digite o código exibido.
            </p>
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
              <Button onClick={() => handleConnect()} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />} Conectar WhatsApp
              </Button>
              <div className="space-y-2 pt-2">
                <label htmlFor="whatsapp-pairing-number" className="text-sm font-medium">
                  Ou informe o número do WhatsApp para receber um código de 8 dígitos
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="whatsapp-pairing-number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="5511999999999"
                    value={phoneInput}
                    onChange={(event) => setPhoneInput(event.target.value)}
                    disabled={busy}
                  />
                  <Button
                    variant="outline"
                    onClick={() => handleConnect(phoneInput.trim())}
                    disabled={busy || phoneInput.replace(/\D/g, "").length < 8}
                  >
                    Receber código
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
        {status === "connecting" && (
          <div className="flex flex-col items-center gap-2">
            {qr && !pairingCode && (
              <>
                <div className="rounded-xl bg-background p-3 border border-border">
                  <img src={qr} alt="QR Code para conectar o WhatsApp" className="size-56 [image-rendering:pixelated] bg-white rounded" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleConnect()} disabled={busy}>
                  Gerar novo QR Code
                </Button>
              </>
            )}
            {pairingCode && (
              <div className="rounded-xl bg-muted p-4 text-center">
                <p className="text-xs text-muted-foreground">Código de pareamento do WhatsApp</p>
                <p className="font-mono text-2xl font-bold tracking-[0.3em]">{pairingCode}</p>
                <p className="mt-1 text-xs text-muted-foreground">Digite este código no WhatsApp do número informado.</p>
              </div>
            )}
            {!qr && !pairingCode && (
              <div className="size-56 flex items-center justify-center text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function BotToggle({ instance, onChanged }: { instance: WhatsappInstanceOverview; onChanged: () => void }) {
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

function Conversations({ connected, botEnabled }: { connected: boolean; botEnabled: boolean }) {
  const qc = useQueryClient();
  const updatePipelineStage = useServerFn(moveWhatsappConversationPipelineStage);
  const [view, setView] = useState<"chat" | "pipeline">("chat");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<WhatsappPipelineStage | null>(null);
  const convs = useQuery({
    queryKey: ["wa-conversations"],
    queryFn: async () => {
      const { data: tenantId, error: tenantError } = await supabase.rpc("current_tenant_id");
      if (tenantError) throw tenantError;
      if (!tenantId) throw new Error("Nenhum buffet vinculado à sua conta.");
      const { data, error } = await (supabase as any)
        .from("whatsapp_conversations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("needs_human", { ascending: false })
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as Conversation[]).map((conversation) => ({
        ...conversation,
        pipeline_stage: whatsappPipelineStage(conversation.pipeline_stage),
      }));
    },
    refetchInterval: 5000,
  });
  const list = convs.data ?? [];
  const current = useMemo(() => list.find((c) => c.id === selected) ?? null, [list, selected]);
  const grouped = useMemo(() => groupWhatsappConversations(list), [list]);

  const moveConversation = useMutation({
    mutationFn: async ({ conversation, stage }: { conversation: Conversation; stage: WhatsappPipelineStage }) => {
      await updatePipelineStage({ data: { conversationId: conversation.id, stage } });
    },
    onMutate: async ({ conversation, stage }) => {
      await qc.cancelQueries({ queryKey: ["wa-conversations"] });
      const previous = qc.getQueryData<Conversation[]>(["wa-conversations"]);
      qc.setQueryData<Conversation[]>(["wa-conversations"], (items) =>
        items ? moveWhatsappConversationToStage(items, conversation.id, stage) : items,
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      console.error("Erro Supabase ao mover pipeline:", error);
      if (context?.previous) qc.setQueryData(["wa-conversations"], context.previous);
      const message = error !== null && typeof error === "object" &&
        "message" in error && typeof error.message === "string"
        ? error.message
        : undefined;
      toast.error(message || "Não foi possível mover a conversa no pipeline.");
      void qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
    onSuccess: () => {
      toast.success("Conversa movida.");
      void qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
  });

  function dropOnStage(stage: WhatsappPipelineStage) {
    const conversation = list.find((item) => item.id === dragId);
    setDragId(null);
    setOverStage(null);
    if (conversation && whatsappPipelineStage(conversation.pipeline_stage) !== stage) {
      moveConversation.mutate({ conversation, stage });
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <span className="font-bold">Conversas</span>
          <span className="ml-2 text-xs text-muted-foreground">{list.length} no total</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-full bg-muted p-1" role="group" aria-label="Visualização das conversas">
            <button
              type="button"
              onClick={() => setView("chat")}
              aria-pressed={view === "chat"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
                view === "chat" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              <MessageCircle className="size-3.5" /> Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setView("pipeline");
              }}
              aria-pressed={view === "pipeline"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
                view === "pipeline" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="size-3.5" /> Pipeline
            </button>
          </div>
        </div>
      </div>
      {convs.isError ? (
        <div className="p-6 space-y-3">
          <p role="alert" className="text-sm text-destructive">Não foi possível carregar as conversas.</p>
          <Button variant="outline" size="sm" onClick={() => void convs.refetch()}>Tentar novamente</Button>
        </div>
      ) : convs.isPending ? (
        <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando conversas…
        </div>
      ) : list.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          Nenhuma conversa ainda. Quando um cliente mandar mensagem para o WhatsApp conectado, ela aparece aqui.
        </p>
      ) : view === "pipeline" ? (
        <>
          <WhatsappPipelineBoard
            grouped={grouped}
            botEnabled={botEnabled}
            dragId={dragId}
            overStage={overStage}
            onOpen={(conversation) => setSelected(conversation.id)}
            onDragStart={(id) => setDragId(id)}
            onDragEnd={() => {
              setDragId(null);
              setOverStage(null);
            }}
            onDragOver={setOverStage}
            onDrop={dropOnStage}
            onMove={(conversation, stage) => moveConversation.mutate({ conversation, stage })}
            moving={moveConversation.isPending}
          />
          <Sheet
            open={view === "pipeline" && !!current}
            onOpenChange={(open) => {
              if (!open) setSelected(null);
            }}
          >
            <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
              <SheetHeader className="sr-only">
                <SheetTitle>{current?.lead_name || current?.contact_name || "Conversa"}</SheetTitle>
                <SheetDescription>Histórico completo e resposta da conversa selecionada.</SheetDescription>
              </SheetHeader>
              {current && (
                <Thread
                  conv={current}
                  connected={connected}
                  onBack={() => setSelected(null)}
                  onChanged={() => void qc.invalidateQueries({ queryKey: ["wa-conversations"] })}
                />
              )}
            </SheetContent>
          </Sheet>
        </>
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

function WhatsappPipelineBoard({
  grouped,
  botEnabled,
  dragId,
  overStage,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMove,
  moving,
}: {
  grouped: Record<WhatsappPipelineStage, Conversation[]>;
  botEnabled: boolean;
  dragId: string | null;
  overStage: WhatsappPipelineStage | null;
  onOpen: (conversation: Conversation) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (stage: WhatsappPipelineStage | null) => void;
  onDrop: (stage: WhatsappPipelineStage) => void;
  onMove: (conversation: Conversation, stage: WhatsappPipelineStage) => void;
  moving: boolean;
}) {
  const [mobileStage, setMobileStage] = useState<WhatsappPipelineStage>("novos");
  const mobileCards = grouped[mobileStage];

  return (
    <div className="p-4 md:p-5">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
        {WHATSAPP_PIPELINE.map((column) => (
          <button
            key={column.id}
            type="button"
            onClick={() => setMobileStage(column.id)}
            aria-pressed={mobileStage === column.id}
            className={cn(
              "shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition",
              mobileStage === column.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40",
            )}
          >
            {column.label} <span className="ml-1 opacity-70">{grouped[column.id].length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2 md:hidden">
        {mobileCards.map((conversation) => (
          <div key={conversation.id} className="space-y-1">
            <WhatsappPipelineCard
              conversation={conversation}
              botEnabled={botEnabled}
              dragging={false}
              onOpen={() => onOpen(conversation)}
              onDragStart={() => onDragStart(conversation.id)}
              onDragEnd={onDragEnd}
            />
            <select
              aria-label={`Mover ${conversation.lead_name || conversation.contact_name || conversationContact(conversation)}`}
              value={whatsappPipelineStage(conversation.pipeline_stage)}
              disabled={moving}
              onChange={(event) => onMove(conversation, event.target.value as WhatsappPipelineStage)}
              className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs"
            >
              {WHATSAPP_PIPELINE.map((column) => (
                <option key={column.id} value={column.id}>Mover para: {column.label}</option>
              ))}
            </select>
          </div>
        ))}
        {mobileCards.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Nenhuma conversa nesta etapa.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto pb-2 md:block">
        <div className="flex min-w-max gap-3">
          {WHATSAPP_PIPELINE.map((column) => (
            <div
              key={column.id}
              onDragOver={(event) => {
                event.preventDefault();
                onDragOver(column.id);
              }}
              onDragLeave={(event) => {
                if (
                  event.relatedTarget instanceof Node &&
                  event.currentTarget.contains(event.relatedTarget)
                ) return;
                if (overStage === column.id) onDragOver(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDrop(column.id);
              }}
              className={cn(
                "flex max-h-[75vh] w-80 shrink-0 flex-col rounded-2xl border bg-muted/30 transition-colors",
                overStage === column.id ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div className="border-b border-border p-3">
                <div className="inline-flex rounded-full border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                  {column.label}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {grouped[column.id].length} conversa(s)
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {grouped[column.id].map((conversation) => (
                  <WhatsappPipelineCard
                    key={conversation.id}
                    conversation={conversation}
                    botEnabled={botEnabled}
                    dragging={dragId === conversation.id}
                    onOpen={() => onOpen(conversation)}
                    onDragStart={() => onDragStart(conversation.id)}
                    onDragEnd={onDragEnd}
                  />
                ))}
                {grouped[column.id].length === 0 && (
                  <div className="py-6 text-center text-[11px] text-muted-foreground">Arraste conversas para cá</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WhatsappPipelineCard({
  conversation,
  botEnabled,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  conversation: Conversation;
  botEnabled: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const robotStatus = conversation.needs_human
    ? "Aguardando humano"
    : conversation.bot_paused
      ? "Robô pausado"
      : botEnabled
        ? "Robô ativo"
        : "Robô desligado";

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", conversation.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "w-full select-none rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all duration-200",
        "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg active:cursor-grabbing",
        dragging && "rotate-1 opacity-40 shadow-xl",
      )}
    >
      <div className="truncate text-sm font-semibold">
        {conversation.lead_name || conversation.contact_name || conversationContact(conversation)}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{conversationContact(conversation)}</div>
      {conversation.event_type && (
        <div className="mt-2 truncate text-xs text-muted-foreground">🎉 {conversation.event_type}</div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {conversation.event_date && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" /> {formatConversationDate(conversation.event_date)}
          </span>
        )}
        {conversation.guest_count !== null && conversation.guest_count !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {conversation.guest_count} convidados
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge variant={conversation.needs_human ? "destructive" : "secondary"} className="text-[10px]">
          {robotStatus}
        </Badge>
        {conversation.unread_count > 0 && (
          <span className="text-[10px] font-semibold text-primary">{conversation.unread_count} nova(s)</span>
        )}
      </div>
    </button>
  );
}

function formatConversationDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
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
  const setBotPaused = useServerFn(setWhatsappConversationBotPaused);
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
    if (values.bot_paused === true) {
      try {
        await setBotPaused({ data: { conversationId: conv.id, botPaused: true } });
      } catch {
        return toast.error("Não foi possível pausar o robô.");
      }
      toast.success(okMsg);
      onChanged();
      return;
    }
    const { error } = await (supabase as any)
      .from("whatsapp_conversations")
      .update(values)
      .eq("id", conv.id)
      .eq("tenant_id", conv.tenant_id);
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

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, MessageCircle, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { brl, formatDateBR } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PublicQuote = {
  id: string;
  created_at: string;
  event_date: string | null;
  event_time: string | null;
  event_address: string | null;
  event_type: string | null;
  adults: number | null;
  children_7_10: number | null;
  children_0_6: number | null;
  total_value: number | null;
  extras: any;
  clients?: { name: string | null; whatsapp: string | null; phone: string | null; city: string | null } | null;
};

const seenKey = (userId: string) => `cdb_public_quotes_seen:${userId}`;

function guests(q: PublicQuote) {
  return (q.adults ?? 0) + (q.children_7_10 ?? 0) + (q.children_0_6 ?? 0);
}

function requesterName(q: PublicQuote) {
  return q.clients?.name ?? q.extras?.requester?.name ?? "Cliente";
}

function requesterPhone(q: PublicQuote) {
  return q.clients?.whatsapp ?? q.clients?.phone ?? q.extras?.requester?.whatsapp ?? null;
}

function packagesLabel(q: PublicQuote) {
  const list = Array.isArray(q.extras?.packages) ? q.extras.packages : [];
  const names = list.map((p: any) => p?.name).filter(Boolean);
  return names.length ? names.join(" + ") : "—";
}

/** Mensagem enviada ao celular do buffet (via WhatsApp) com os dados do novo orçamento. */
export function buildAlertMessage(q: PublicQuote) {
  const lines = [
    "🔔 *Novo orçamento pelo link público*",
    "",
    `👤 Cliente: ${requesterName(q)}`,
    requesterPhone(q) ? `📱 Contato: ${requesterPhone(q)}` : null,
    q.clients?.city ? `📍 Cidade: ${q.clients.city}` : null,
    q.event_date ? `📅 Evento: ${formatDateBR(q.event_date)}${q.event_time ? ` às ${String(q.event_time).slice(0, 5)}` : ""}` : null,
    q.event_type ? `🎉 Tipo: ${q.event_type}` : null,
    q.event_address ? `🏠 Local: ${q.event_address}` : null,
    `👥 Convidados: ${guests(q)}`,
    `📦 Pacotes: ${packagesLabel(q)}`,
    `💰 Valor estimado: ${brl(q.total_value ?? 0)}`,
    "",
    `Recebido em ${new Date(q.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function PublicQuoteNotifications() {
  const { data: access } = useTenantAccess();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const userId = access?.userId;
  const tenantId = access?.tenant?.id as string | undefined;

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    setSeenAt(localStorage.getItem(seenKey(userId)));
  }, [userId]);

  // Celular cadastrado em Configurações
  const { data: settings } = useQuery({
    queryKey: ["buffet-settings-phone", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("buffet_settings")
        .select("whatsapp, phone, business_name")
        .eq("owner_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const alertPhone = settings?.whatsapp || settings?.phone || null;

  const { data: quotes } = useQuery({
    queryKey: ["public-quote-alerts", tenantId],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(
          "id, created_at, event_date, event_time, event_address, event_type, adults, children_7_10, children_0_6, total_value, extras, clients(name, whatsapp, phone, city)",
        )
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as any[]).filter(
        (q) => q.extras?.source === "formulario_publico",
      ) as PublicQuote[];
    },
  });

  const list = quotes ?? [];
  const unread = useMemo(
    () => list.filter((q) => !seenAt || new Date(q.created_at) > new Date(seenAt)),
    [list, seenAt],
  );

  // Realtime: avisa na hora que um orçamento do link público entra
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`public-quotes-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quotes", filter: `tenant_id=eq.${tenantId}` },
        (payload: any) => {
          const row = payload.new;
          if (row?.extras?.source !== "formulario_publico") return;
          if (notifiedRef.current.has(row.id)) return;
          notifiedRef.current.add(row.id);
          qc.invalidateQueries({ queryKey: ["public-quote-alerts", tenantId] });
          toast.success("Novo orçamento pelo link público!", {
            description: `${row?.extras?.requester?.name ?? "Cliente"} · ${brl(row?.total_value ?? 0)}`,
            duration: 12_000,
            action: alertPhone
              ? {
                  label: "Avisar no WhatsApp",
                  onClick: () =>
                    window.open(waLink(alertPhone, buildAlertMessage({ ...row, clients: null })), "_blank"),
                }
              : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, alertPhone, qc]);

  function markAllRead() {
    if (!userId) return;
    const now = new Date().toISOString();
    localStorage.setItem(seenKey(userId), now);
    setSeenAt(now);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Notificações de orçamentos"
        title="Novos orçamentos do link público"
      >
        <Bell className="size-5" />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(92vw,26rem)] max-h-[70vh] overflow-y-auto z-30 bg-card border border-border rounded-2xl shadow-xl">
            <div className="p-4 border-b border-border flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-extrabold tracking-tight flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" /> Orçamentos do link público
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {alertPhone
                    ? `Avisos vão para ${alertPhone}`
                    : "Cadastre o WhatsApp em Configurações para receber o aviso no celular"}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-accent"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>

            <ul className="divide-y divide-border">
              {list.length === 0 && (
                <li className="p-8 text-center text-xs text-muted-foreground">
                  Nenhum orçamento recebido pelo link público ainda.
                </li>
              )}
              {list.map((q) => {
                const isNew = !seenAt || new Date(q.created_at) > new Date(seenAt);
                return (
                  <li key={q.id} className={cn("p-4 space-y-2", isNew && "bg-primary/5")}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold truncate">{requesterName(q)}</div>
                      {isNew && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold uppercase tracking-wider">
                          Novo
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <div>
                        {q.event_date ? formatDateBR(q.event_date) : "Data a definir"}
                        {q.event_time ? ` · ${String(q.event_time).slice(0, 5)}` : ""} · {guests(q)} convidado(s)
                      </div>
                      <div>Pacotes: {packagesLabel(q)}</div>
                      {requesterPhone(q) && <div>Contato: {requesterPhone(q)}</div>}
                      <div className="font-bold text-foreground">{brl(q.total_value ?? 0)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" asChild onClick={() => setOpen(false)}>
                        <Link to="/orcamentos/$id" params={{ id: q.id }}>
                          Abrir orçamento
                        </Link>
                      </Button>
                      {alertPhone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(waLink(alertPhone, buildAlertMessage(q)), "_blank")}
                        >
                          <MessageCircle className="size-3" /> Enviar ao meu celular
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {unread.length > 0 && (
              <div className="p-3 border-t border-border">
                <Button size="sm" variant="outline" className="w-full" onClick={markAllRead}>
                  Marcar todos como lidos
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

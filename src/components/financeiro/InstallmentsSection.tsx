import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Link2,
  Copy,
  CheckCircle2,
  Clock,
  Trash2,
  Plus,
  Eye,
  XCircle,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Archive,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { copyToClipboard } from "@/lib/clipboard";
import { waLink, fillTemplate } from "@/lib/whatsapp";
import {
  confirmInstallmentPayment,
  getInstallmentReceiptUrl,
  rejectInstallmentReceipt,
} from "@/lib/installments.functions";

type Props = { tenantId: string | null; ownerId: string | null; isSuperAdmin: boolean };

const statusMeta: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Em aberto", cls: "bg-rose-500/15 text-rose-700 border-rose-300" },
  aguardando: { label: "Aguardando confirmação", cls: "bg-amber-500/15 text-amber-700 border-amber-300" },
  pago: { label: "Paga", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
};

export default function InstallmentsSection({ tenantId, ownerId, isSuperAdmin }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState("");
  const [count, setCount] = useState(2);
  const [firstDue, setFirstDue] = useState(new Date().toISOString().slice(0, 10));
  const [totalOverride, setTotalOverride] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: settings } = useQuery({
    queryKey: ["buffet-settings"],
    queryFn: async () => (await supabase.from("buffet_settings").select("*").maybeSingle()).data,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["installments-events", tenantId],
    enabled: !!tenantId || isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("events")
        .select("id, event_date, total_value, status, client_id, quote_id, clients(name, whatsapp, phone)")
        .neq("status", "cancelado")
        .order("event_date", { ascending: false });
      if (tenantId && !isSuperAdmin) q = q.eq("tenant_id", tenantId);
      return (await q).data ?? [];
    },
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["installments", tenantId],
    enabled: !!tenantId || isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("payment_installments")
        .select("*, events(event_date, clients(name, whatsapp, phone))")
        .order("due_date", { ascending: true });
      if (tenantId && !isSuperAdmin) q = q.eq("tenant_id", tenantId);
      return (await q).data ?? [];
    },
  });

  const totals = useMemo(() => {
    return (installments as any[]).reduce(
      (acc, i) => {
        const v = Number(i.amount ?? 0);
        if (i.status === "pago") acc.pago += v;
        else if (i.status === "aguardando") acc.aguardando += v;
        else acc.aberto += v;
        return acc;
      },
      { pago: 0, aguardando: 0, aberto: 0 },
    );
  }, [installments]);

  /** Agrupa parcelas por evento para o kanban */
  const groups = useMemo(() => {
    const map = new Map<string, any>();
    for (const i of installments as any[]) {
      const key = i.event_id ?? `sem-evento-${i.id}`;
      const g =
        map.get(key) ??
        {
          key,
          eventId: i.event_id ?? null,
          client: i.events?.clients?.name ?? "Cliente",
          eventDate: i.events?.event_date ?? null,
          items: [] as any[],
        };
      g.items.push(i);
      map.set(key, g);
    }
    return Array.from(map.values()).map((g) => {
      const total = g.items.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
      const paid = g.items
        .filter((i: any) => i.status === "pago")
        .reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
      const paidCount = g.items.filter((i: any) => i.status === "pago").length;
      return { ...g, total, paid, paidCount, allPaid: paidCount === g.items.length };
    });
  }, [installments]);

  const pendingEvents = useMemo(() => {
    const withInstallments = new Set(groups.map((g) => g.eventId).filter(Boolean));
    return (events as any[]).filter((e) => !withInstallments.has(e.id) && e.status !== "cancelado");
  }, [events, groups]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["installments"] });
    qc.invalidateQueries({ queryKey: ["financeiro-events"] });
    qc.invalidateQueries({ queryKey: ["financeiro-transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const openCreate = (preselect?: string) => {
    setEventId(preselect ?? "");
    setTotalOverride("");
    setCount(Number((settings as any)?.installments_default_count ?? 2));
    setFirstDue(new Date().toISOString().slice(0, 10));
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const ev = (events as any[]).find((e) => e.id === eventId);
      if (!ev) throw new Error("Selecione um evento.");
      if (!ownerId) throw new Error("Sessão expirada.");
      const total = totalOverride
        ? Number(String(totalOverride).replace(/\./g, "").replace(",", "."))
        : Number(ev.total_value ?? 0);
      if (!total || total <= 0) throw new Error("Informe um valor total válido.");
      const n = Math.max(1, Math.min(24, Number(count) || 1));
      const base = Math.floor((total / n) * 100) / 100;
      const rows = Array.from({ length: n }, (_, i) => {
        const due = new Date(firstDue + "T00:00:00");
        due.setMonth(due.getMonth() + i);
        const amount = i === n - 1 ? Number((total - base * (n - 1)).toFixed(2)) : base;
        return {
          owner_id: ownerId,
          tenant_id: tenantId,
          event_id: ev.id,
          quote_id: ev.quote_id ?? null,
          client_id: ev.client_id ?? null,
          label: `Parcela ${i + 1} de ${n}`,
          number: i + 1,
          total_count: n,
          amount,
          due_date: due.toISOString().slice(0, 10),
          status: "pendente",
        };
      });
      const { error } = await supabase.from("payment_installments").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcelas e links de pagamento criados");
      setOpen(false);
      setEventId("");
      setTotalOverride("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar parcelas"),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => confirmInstallmentPayment({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(r?.eventPaid ? "Parcela paga — evento marcado como PAGO" : "Pagamento confirmado");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao confirmar"),
  });

  const reject = useMutation({
    mutationFn: (id: string) => rejectInstallmentReceipt({ data: { id } }),
    onSuccess: () => {
      toast.success("Comprovante recusado e excluído");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao recusar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_installments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela removida");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  const closeGroup = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("payment_installments").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cobrança encerrada — parcelas arquivadas e removidas da lista");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao encerrar"),
  });

  const linkFor = (token: string) =>
    typeof window === "undefined" ? `/pagamento/${token}` : `${window.location.origin}/pagamento/${token}`;

  const sendWhats = (item: any) => {
    const url = linkFor(item.token);
    const tpl =
      (settings as any)?.wa_installment_template?.trim() ||
      "Olá {cliente}! Segue o link para pagamento da {parcela} no valor de {valor}, com vencimento em {vencimento}: {link}";
    const msg = fillTemplate(tpl, {
      cliente: item.events?.clients?.name ?? "cliente",
      parcela: item.label ?? `Parcela ${item.number}/${item.total_count}`,
      valor: brl(Number(item.amount ?? 0)),
      vencimento: item.due_date ? formatDateBR(item.due_date) : "a combinar",
      data: item.events?.event_date ? formatDateBR(item.events.event_date) : "",
      link: url,
      pix: (settings as any)?.pix_key ?? "",
    });
    const phone = item.events?.clients?.whatsapp ?? item.events?.clients?.phone ?? "";
    window.open(waLink(phone, msg), "_blank");
  };

  const viewReceipt = async (id: string) => {
    try {
      const { url } = await getInstallmentReceiptUrl({ data: { id } });
      if (!url) return toast.error("Nenhum comprovante anexado.");
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao abrir comprovante");
    }
  };

  const inProgress = groups.filter((g) => !g.allPaid);
  const finished = groups.filter((g) => g.allPaid);

  const renderGroupCard = (g: any) => {
    const isOpen = !!expanded[g.key];
    const pct = g.total > 0 ? Math.round((g.paid / g.total) * 100) : 0;
    return (
      <div key={g.key} className="rounded-xl border border-border bg-background p-3 space-y-2 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{g.client}</div>
            <div className="text-[11px] text-muted-foreground">
              {g.eventDate ? `Evento ${formatDateBR(g.eventDate)} · ` : ""}
              {g.paidCount}/{g.items.length} parcelas pagas
            </div>
          </div>
          <button
            onClick={() => setExpanded((s) => ({ ...s, [g.key]: !isOpen }))}
            className="p-1.5 rounded-lg border border-border hover:bg-muted shrink-0"
            title={isOpen ? "Recolher" : "Ver parcelas"}
          >
            {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-emerald-700">{brl(g.paid)}</span>
          <span className="text-muted-foreground">de {brl(g.total)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        {isOpen && (
          <div className="space-y-2 pt-1">
            {g.items.map((i: any) => {
              const meta = statusMeta[i.status] ?? statusMeta["pendente"]!;
              return (
                <div key={i.id} className="rounded-lg border border-border p-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold">
                      {i.label ?? `Parcela ${i.number}/${i.total_count}`}
                    </div>
                    <div className="text-xs font-bold">{brl(Number(i.amount ?? 0))}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}
                    >
                      {i.status === "pago" ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      venc. {i.due_date ? formatDateBR(i.due_date) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      title="Copiar link"
                      onClick={async () => {
                        const ok = await copyToClipboard(linkFor(i.token));
                        toast[ok ? "success" : "error"](ok ? "Link copiado!" : "Copie manualmente.");
                      }}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted"
                    >
                      <Copy className="size-3" />
                    </button>
                    <button
                      title="Enviar pelo WhatsApp"
                      onClick={() => sendWhats(i)}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-emerald-700"
                    >
                      <MessageCircle className="size-3" />
                    </button>
                    {i.receipt_path ? (
                      <>
                        <button
                          title="Ver comprovante"
                          onClick={() => viewReceipt(i.id)}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted"
                        >
                          <Eye className="size-3" />
                        </button>
                        <button
                          title="Recusar comprovante"
                          onClick={() => reject.mutate(i.id)}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-rose-700"
                        >
                          <XCircle className="size-3" />
                        </button>
                      </>
                    ) : null}
                    {i.status !== "pago" ? (
                      <button
                        onClick={() => confirm.mutate(i.id)}
                        disabled={confirm.isPending}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold"
                      >
                        <CheckCircle2 className="size-3" /> Confirmar
                      </button>
                    ) : null}
                    <button
                      title="Excluir parcela"
                      onClick={() => remove.mutate(i.id)}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-rose-700 ml-auto"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {g.allPaid && (
          <button
            onClick={() => {
              if (!window.confirm("Encerrar esta cobrança? As parcelas pagas serão removidas da lista.")) return;
              closeGroup.mutate(g.items.map((i: any) => i.id));
            }}
            disabled={closeGroup.isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[11px] font-bold hover:bg-muted"
          >
            <Archive className="size-3.5" /> Encerrar e excluir
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold flex items-center gap-2">
            <Link2 className="size-4 text-primary" /> Parcelas & Links de pagamento
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cada evento fechado vira um card: gere as parcelas, envie o link pelo WhatsApp, confirme os comprovantes e
            encerre a cobrança quando tudo estiver pago.
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold"
        >
          <Plus className="size-4" /> Criar parcelas
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Mini label="Parcelas pagas" value={brl(totals.pago)} tone="emerald" />
        <Mini label="Aguardando confirmação" value={brl(totals.aguardando)} tone="amber" />
        <Mini label="Em aberto" value={brl(totals.aberto)} tone="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Column title="Eventos fechados" count={pendingEvents.length} tone="border-blue-300">
          {pendingEvents.length === 0 ? (
            <Empty text="Nenhum evento aguardando parcelas." />
          ) : (
            pendingEvents.map((e: any) => (
              <div key={e.id} className="rounded-xl border border-border bg-background p-3 space-y-2 shadow-sm">
                <div className="font-bold text-sm truncate">{e.clients?.name ?? "Cliente"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {e.event_date ? formatDateBR(e.event_date) : "—"} · {brl(Number(e.total_value ?? 0))}
                </div>
                <button
                  onClick={() => openCreate(e.id)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold"
                >
                  <Plus className="size-3.5" /> Criar parcelas
                </button>
              </div>
            ))
          )}
        </Column>

        <Column title="Em pagamento" count={inProgress.length} tone="border-amber-300">
          {inProgress.length === 0 ? <Empty text="Nenhuma cobrança em andamento." /> : inProgress.map(renderGroupCard)}
        </Column>

        <Column title="Quitados" count={finished.length} tone="border-emerald-300">
          {finished.length === 0 ? <Empty text="Nenhuma cobrança quitada." /> : finished.map(renderGroupCard)}
        </Column>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-extrabold">Criar parcelas do evento</h3>
            <label className="block text-xs font-bold uppercase text-muted-foreground">Evento</label>
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setFirstDue(new Date().toISOString().slice(0, 10));
                setCount(Number((settings as any)?.installments_default_count ?? 2));
              }}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">Selecione...</option>
              {(events as any[]).map((e) => (
                <option key={e.id} value={e.id}>
                  {(e.clients?.name ?? "Cliente") +
                    " — " +
                    (e.event_date ? formatDateBR(e.event_date) : "") +
                    " — " +
                    brl(Number(e.total_value ?? 0))}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Nº de parcelas</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">1º vencimento</label>
                <input
                  type="date"
                  value={firstDue}
                  onChange={(e) => setFirstDue(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                Valor total (opcional)
              </label>
              <input
                value={totalOverride}
                onChange={(e) => setTotalOverride(e.target.value)}
                placeholder="Deixe vazio para usar o valor do evento"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="h-10 px-4 rounded-lg border border-border text-xs font-bold">
                Cancelar
              </button>
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
              >
                Gerar parcelas e links
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border-t-4 ${tone} border border-border bg-muted/20 p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{title}</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background border border-border">
          {count}
        </span>
      </div>
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[11px] text-muted-foreground py-6 text-center">{text}</p>;
}

function Mini({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" }) {
  const tones = {
    emerald: "bg-emerald-500/10 border-emerald-300 text-emerald-800",
    amber: "bg-amber-500/10 border-amber-300 text-amber-800",
    rose: "bg-rose-500/10 border-rose-300 text-rose-800",
  } as const;
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[10px] uppercase font-bold tracking-widest">{label}</div>
      <div className="text-xl font-black mt-0.5">{value}</div>
    </div>
  );
}

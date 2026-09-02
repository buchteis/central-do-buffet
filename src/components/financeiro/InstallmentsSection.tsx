import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  CheckCircle2,
  Clock,
  Trash2,
  Eye,
  XCircle,
  MessageCircle,
  ChevronDown,
  ChevronUp,
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
      toast.success("Parcelas criadas com sucesso");
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
      toast.success("Comprovante recusado");
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

  // Filtramos apenas as cobranças que ainda possuem parcelas ativas
  const inProgress = groups.filter((g) => !g.allPaid);

  const renderGroupCard = (g: any) => {
    const isOpen = !!expanded[g.key];
    const pct = g.total > 0 ? Math.round((g.paid / g.total) * 100) : 0;
    return (
      <div key={g.key} className="rounded-xl border border-border/50 bg-card p-3 space-y-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-xs truncate">{g.client}</h4>
            <p className="text-[11px] text-muted-foreground">
              {g.eventDate ? `${formatDateBR(g.eventDate)} · ` : ""}
              {g.paidCount}/{g.items.length} pagas
            </p>
          </div>
          <button
            onClick={() => setExpanded((s) => ({ ...s, [g.key]: !isOpen }))}
            className="p-1 rounded text-muted-foreground hover:bg-muted"
          >
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-medium">{brl(g.paid)}</span>
            <span className="text-muted-foreground">de {brl(g.total)}</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {isOpen && (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            {g.items.map((i: any) => {
              const isPago = i.status === "pago";
              return (
                <div key={i.id} className="rounded-md bg-muted/30 p-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[11px]">{i.label ?? `Parcela ${i.number}/${i.total_count}`}</span>
                    <span className="font-semibold text-xs">{brl(Number(i.amount ?? 0))}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {isPago ? (
                        <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="size-3" /> Paga</span>
                      ) : (
                        <span className="text-amber-600 font-medium flex items-center gap-1"><Clock className="size-3" /> Em aberto</span>
                      )}
                    </span>
                    <span>Venc. {i.due_date ? formatDateBR(i.due_date) : "—"}</span>
                  </div>

                  <div className="flex items-center gap-1 justify-end pt-1">
                    <button
                      title="Copiar link"
                      onClick={async () => {
                        const ok = await copyToClipboard(linkFor(i.token));
                        toast[ok ? "success" : "error"](ok ? "Link copiado!" : "Erro ao copiar.");
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-3.5" />
                    </button>

                    <button
                      title="WhatsApp"
                      onClick={() => sendWhats(i)}
                      className="p-1 text-emerald-600 hover:opacity-80"
                    >
                      <MessageCircle className="size-3.5" />
                    </button>

                    {i.receipt_path && (
                      <>
                        <button title="Comprovante" onClick={() => viewReceipt(i.id)} className="p-1 text-muted-foreground">
                          <Eye className="size-3.5" />
                        </button>
                        <button title="Recusar" onClick={() => reject.mutate(i.id)} className="p-1 text-rose-600">
                          <XCircle className="size-3.5" />
                        </button>
                      </>
                    )}

                    {!isPago && (
                      <button
                        onClick={() => confirm.mutate(i.id)}
                        disabled={confirm.isPending}
                        className="ml-1 px-2 py-0.5 rounded bg-emerald-600 text-white font-medium text-[10px]"
                      >
                        Confirmar
                      </button>
                    )}

                    <button
                      title="Excluir"
                      onClick={() => remove.mutate(i.id)}
                      className="p-1 text-muted-foreground hover:text-rose-600 ml-auto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Topo Limpo */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Cobranças & Links de Pagamento</h3>
        </div>
        <button
          onClick={() => openCreate()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" /> Criar parcelas
        </button>
      </div>

      {/* Kanban Simplificado em 2 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Column title="Eventos a Parcelar" count={pendingEvents.length}>
          {pendingEvents.length === 0 ? (
            <Empty text="Nenhum evento aguardando parcelas" />
          ) : (
            pendingEvents.map((e: any) => (
              <div key={e.id} className="rounded-xl border border-border/50 bg-card p-3 flex items-center justify-between gap-2 shadow-sm">
                <div className="min-w-0">
                  <h4 className="font-semibold text-xs truncate">{e.clients?.name ?? "Cliente"}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    {e.event_date ? formatDateBR(e.event_date) : "—"} · <span className="font-medium text-foreground">{brl(Number(e.total_value ?? 0))}</span>
                  </p>
                </div>
                <button
                  onClick={() => openCreate(e.id)}
                  className="px-2.5 py-1 rounded-md border border-border text-xs font-medium hover:bg-muted shrink-0"
                >
                  Gerar
                </button>
              </div>
            ))
          )}
        </Column>

        <Column title="Em Pagamento" count={inProgress.length}>
          {inProgress.length === 0 ? <Empty text="Nenhuma cobrança ativa" /> : inProgress.map(renderGroupCard)}
        </Column>
      </div>

      {/* Modal Reorganizado */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 space-y-4 shadow-lg">
            <h3 className="font-bold text-sm">Criar Parcelas</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Evento</label>
                <select
                  value={eventId}
                  onChange={(e) => {
                    setEventId(e.target.value);
                    setFirstDue(new Date().toISOString().slice(0, 10));
                    setCount(Number((settings as any)?.installments_default_count ?? 2));
                  }}
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-xs"
                >
                  <option value="">Selecione um evento...</option>
                  {(events as any[]).map((e) => (
                    <option key={e.id} value={e.id}>
                      {(e.clients?.name ?? "Cliente") + " — " + brl(Number(e.total_value ?? 0))}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Nº de parcelas</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">1º Vencimento</label>
                  <input
                    type="date"
                    value={firstDue}
                    onChange={(e) => setFirstDue(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Valor Total (Opcional)</label>
                <input
                  value={totalOverride}
                  onChange={(e) => setTotalOverride(e.target.value)}
                  placeholder="Manter valor original"
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="h-8 px-3 rounded-md border border-border text-xs font-medium">
                Cancelar
              </button>
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
              >
                Gerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background border border-border/60 text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground/60 py-6 text-center">{text}</p>;
}

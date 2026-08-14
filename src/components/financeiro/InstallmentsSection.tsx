import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Copy, CheckCircle2, Clock, Trash2, Plus, Eye, XCircle, MessageCircle } from "lucide-react";
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["installments"] });
    qc.invalidateQueries({ queryKey: ["financeiro-events"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
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

  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold flex items-center gap-2">
            <Link2 className="size-4 text-primary" /> Parcelas & Links de pagamento
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gere o link exclusivo da parcela, envie pelo WhatsApp e confirme o comprovante enviado pelo cliente.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
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

      {(installments as any[]).length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma parcela criada. Escolha um evento fechado e gere as parcelas.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Cliente / Parcela</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3">Situação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {(installments as any[]).map((i) => {
                const meta = statusMeta[i.status] ?? statusMeta["pendente"]!;
                return (
                  <tr key={i.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-semibold">{i.events?.clients?.name ?? "Cliente"}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.label ?? `Parcela ${i.number}/${i.total_count}`}
                        {i.events?.event_date ? ` · evento ${formatDateBR(i.events.event_date)}` : ""}
                      </div>
                    </td>
                    <td className="p-3">{i.due_date ? formatDateBR(i.due_date) : "—"}</td>
                    <td className="p-3 text-right font-bold">{brl(Number(i.amount ?? 0))}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border ${meta.cls}`}>
                        {i.status === "pago" ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          title="Copiar link"
                          onClick={async () => {
                            const ok = await copyToClipboard(linkFor(i.token));
                            toast[ok ? "success" : "error"](ok ? "Link copiado!" : "Copie manualmente.");
                          }}
                          className="p-2 rounded-lg border border-border hover:bg-muted"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          title="Enviar pelo WhatsApp"
                          onClick={() => sendWhats(i)}
                          className="p-2 rounded-lg border border-border hover:bg-muted text-emerald-700"
                        >
                          <MessageCircle className="size-3.5" />
                        </button>
                        {i.receipt_path ? (
                          <>
                            <button
                              title="Ver comprovante"
                              onClick={() => viewReceipt(i.id)}
                              className="p-2 rounded-lg border border-border hover:bg-muted"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              title="Recusar comprovante"
                              onClick={() => reject.mutate(i.id)}
                              className="p-2 rounded-lg border border-border hover:bg-muted text-rose-700"
                            >
                              <XCircle className="size-3.5" />
                            </button>
                          </>
                        ) : null}
                        {i.status !== "pago" ? (
                          <button
                            onClick={() => confirm.mutate(i.id)}
                            disabled={confirm.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                          >
                            <CheckCircle2 className="size-3.5" /> Confirmar pagamento
                          </button>
                        ) : null}
                        <button
                          title="Excluir parcela"
                          onClick={() => remove.mutate(i.id)}
                          className="p-2 rounded-lg border border-border hover:bg-muted text-rose-700"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-extrabold">Criar parcelas do evento</h3>
            <label className="block text-xs font-bold uppercase text-muted-foreground">Evento</label>
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                const ev = (events as any[]).find((x) => x.id === e.target.value);
                if (ev?.event_date) setFirstDue(new Date().toISOString().slice(0, 10));
                setCount(Number((settings as any)?.installments_default_count ?? 2));
              }}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">Selecione...</option>
              {(events as any[]).map((e) => (
                <option key={e.id} value={e.id}>
                  {(e.clients?.name ?? "Cliente") + " — " + (e.event_date ? formatDateBR(e.event_date) : "") + " — " + brl(Number(e.total_value ?? 0))}
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

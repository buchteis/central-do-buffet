import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, formatDateFullBR } from "@/lib/format";
import {
  PIPELINE,
  quoteAlerts,
  quoteClientName,
  quoteOrigin,
  quotePackagesLabel,
  quoteCustomExtras,
  quotePhone,
  quoteUnitItems,
  requesterOf,
  stageOfStatus,
  type QuoteAny,
  type StageId,
} from "@/lib/quote-pipeline";
import { cn } from "@/lib/utils";
import { ExternalLink, Save } from "lucide-react";

type Props = {
  quote: QuoteAny | null;
  onClose: () => void;
  onFullEdit: (q: QuoteAny) => void;
};

const field =
  "w-full h-10 rounded-xl border border-primary/25 bg-primary/5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function QuoteDetailModal({ quote, onClose, onFullEdit }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!quote) return;
    setForm({
      event_date: quote.event_date ?? "",
      event_time: (quote.event_time ?? "").toString().slice(0, 5),
      event_type: quote.event_type ?? "",
      event_address: quote.event_address ?? "",
      adults: Number(quote.adults ?? 0),
      children_7_10: Number(quote.children_7_10 ?? 0),
      children_0_6: Number(quote.children_0_6 ?? 0),
      total_value: Number(quote.total_value ?? 0),
      notes: quote.notes ?? "",
      status: quote.status ?? "novo",
      paid: !!quote.paid,
    });
  }, [quote?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      const { error } = await supabase
        .from("quotes")
        .update({
          event_date: form.event_date || quote.event_date,
          event_time: form.event_time ? form.event_time : null,
          event_type: form.event_type || null,
          event_address: form.event_address || null,
          adults: Number(form.adults) || 0,
          children_7_10: Number(form.children_7_10) || 0,
          children_0_6: Number(form.children_0_6) || 0,
          total_value: Number(form.total_value) || 0,
          notes: form.notes || null,
          status: form.status as any,
          paid: !!form.paid,
        } as any)
        .eq("id", quote.id);
      if (error) throw error;
    },
    onSuccess: () => {
      ["quotes", "agenda", "dashboard-stats-v2", "leads"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
      toast.success("Orçamento atualizado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!quote) return null;
  const q = quote;
  const r = requesterOf(q);
  const alerts = quoteAlerts(q);
  const origin = quoteOrigin(q);
  const unitItems = quoteUnitItems(q);
  const customExtras = quoteCustomExtras(q);
  const pkgSnap: any[] = Array.isArray((q.extras as any)?.packages) ? (q.extras as any).packages : [];

  return (
    <Dialog open={!!quote} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
            <span className="truncate">{quoteClientName(q)}</span>
            <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", origin.tone)}>
              {origin.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {alerts.map((a, i) => (
              <span key={i} className={cn("text-[10px] font-bold px-2 py-1 rounded-full border", a.tone)}>
                {a.label}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs space-y-1">
          <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
            Dados do solicitante
          </div>
          <div>Nome: {q.clients?.name ?? r.name ?? "—"}</div>
          <div>WhatsApp/Telefone: {quotePhone(q) ?? "—"}</div>
          <div>E-mail: {q.clients?.email ?? r.email ?? "—"}</div>
          <div>CPF/CNPJ: {q.clients?.cpf ?? r.cpf ?? "—"}</div>
          <div>Cidade: {q.clients?.city ?? r.city ?? "—"}</div>
          <div>Recebido em: {formatDateFullBR(q.created_at)}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-bold space-y-1">
            <span>Data do evento</span>
            <input
              type="date"
              className={field}
              value={form.event_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold space-y-1">
            <span>Hora</span>
            <input
              type="time"
              className={field}
              value={form.event_time ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold space-y-1">
            <span>Tipo de evento</span>
            <input
              className={field}
              placeholder="Casamento, Aniversário…"
              value={form.event_type ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold space-y-1">
            <span>Etapa</span>
            <select
              className={field}
              value={stageOfStatus(form.status)}
              onChange={(e) => {
                const st = PIPELINE.find((c) => c.id === (e.target.value as StageId));
                setForm((f) => ({ ...f, status: st?.status ?? f.status }));
              }}
            >
              {PIPELINE.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold space-y-1 sm:col-span-2">
            <span>Endereço do evento</span>
            <input
              className={field}
              value={form.event_address ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, event_address: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold space-y-1">
            <span>Adultos</span>
            <input
              type="number"
              min={0}
              className={field}
              value={form.adults ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold space-y-1">
            <span>Crianças 7–10</span>
            <input
              type="number"
              min={0}
              className={field}
              value={form.children_7_10 ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, children_7_10: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold space-y-1">
            <span>Crianças 0–6</span>
            <input
              type="number"
              min={0}
              className={field}
              value={form.children_0_6 ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, children_0_6: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold space-y-1">
            <span>Valor total (R$)</span>
            <input
              type="number"
              step="0.01"
              min={0}
              className={field}
              value={form.total_value ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, total_value: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold space-y-1 sm:col-span-2">
            <span>Observações do cliente</span>
            <textarea
              rows={3}
              className={cn(field, "h-auto py-2")}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2">
            <input
              type="checkbox"
              checked={!!form.paid}
              onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
            />
            Sinal/pagamento recebido
          </label>
        </div>

        <div className="rounded-2xl border border-border p-3 text-xs space-y-3">
          <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
            Pacotes escolhidos
          </div>
          {pkgSnap.length > 0 ? pkgSnap.map((p: any, i: number) => (
            <div key={i} className="flex justify-between gap-3">
              <span>{p?.name}</span>
              <span className="font-mono text-muted-foreground">{brl(Number(p?.price_per_person ?? 0))}/pessoa</span>
            </div>
          )) : <div>{quotePackagesLabel(q)}</div>}
          {unitItems.length > 0 && <div className="border-t border-border pt-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Itens adicionais</div>}
          {unitItems.map((it, i) => (
            <div key={`u${i}`} className="flex justify-between text-muted-foreground">
              <span>
                {it.name} · {it.qty} {it.unit}
              </span>
              <span className="font-mono">{brl(it.qty * it.unit_price)}</span>
            </div>
          ))}
          {customExtras.length > 0 && <div className="border-t border-border pt-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Acréscimos adicionais</div>}
          {customExtras.map((item, i) => (
            <div key={`a${i}`} className="flex justify-between gap-3 text-muted-foreground">
              <span>{item.description}</span><span className="font-mono">{brl(item.value)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 font-bold">
            <span>Total</span>
            <span className="font-mono">{brl(Number(form.total_value ?? q.total_value))}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-1 h-10 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60"
          >
            <Save className="size-4" /> Salvar alterações
          </button>
          <button
            onClick={() => onFullEdit(q)}
            className="inline-flex items-center gap-1 h-10 px-4 rounded-full border border-border text-xs font-bold hover:bg-accent"
          >
            <ExternalLink className="size-4" /> Editar pacotes e valores
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { issueInvoice } from "@/lib/nfse.functions";
import { brl } from "@/lib/format";

export type NfEvent = {
  id: string;
  event_date: string | null;
  total_value: number | null;
  clients?: { name?: string | null; cpf?: string | null; email?: string | null } | null;
  packages?: { name?: string | null } | null;
};

export function EmitirNFModal({ event, onClose }: { event: NfEvent; onClose: () => void }) {
  const qc = useQueryClient();
  const emit = useServerFn(issueInvoice);

  const { data: fiscal, isLoading: loadingFiscal } = useQuery({
    queryKey: ["fiscal-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("fiscal_settings").select("*").maybeSingle();
      return data;
    },
  });

  const [description, setDescription] = useState(
    `Serviço de buffet para evento${event.packages?.name ? ` — ${event.packages.name}` : ""}`,
  );
  const [amount, setAmount] = useState(String(event.total_value ?? 0));
  const [serviceDate, setServiceDate] = useState(event.event_date ?? "");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [email, setEmail] = useState(event.clients?.email ?? "");
  const [sendEmail, setSendEmail] = useState(false);

  const ready = !!fiscal?.cnpj && !!fiscal?.razao_social;

  const mut = useMutation({
    mutationFn: async () =>
      emit({
        data: {
          eventId: event.id,
          description: description.trim(),
          amount: Number(amount) || 0,
          serviceDate: serviceDate || null,
          paymentMethod: paymentMethod.trim() || null,
          recipientEmail: email.trim() || null,
          sendEmail,
        },
      }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(r?.message ?? `Nota ${r?.number ?? ""} registrada.`);
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao emitir a nota."),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-extrabold">Emitir nota fiscal</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Tomador: {event.clients?.name ?? "—"} · {event.clients?.cpf ?? "sem CPF/CNPJ"}
          </p>
        </div>

        {loadingFiscal ? (
          <div className="text-sm text-muted-foreground">Carregando dados fiscais…</div>
        ) : !ready ? (
          <div className="text-sm rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-3">
            Complete a razão social e o CNPJ em <strong>Notas Fiscais → Dados fiscais</strong> antes de emitir.
          </div>
        ) : null}

        <label className="block">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Descrição do serviço
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full mt-1 p-2 text-sm border border-border rounded-lg bg-background"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Valor (R$)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1 h-10 px-3 text-sm border border-border rounded-lg bg-background"
            />
            <span className="text-[11px] text-muted-foreground">Evento: {brl(event.total_value ?? 0)}</span>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Data do serviço
            </span>
            <input
              type="date"
              value={serviceDate ?? ""}
              onChange={(e) => setServiceDate(e.target.value)}
              className="w-full mt-1 h-10 px-3 text-sm border border-border rounded-lg bg-background"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Forma de pagamento
            </span>
            <input
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              maxLength={80}
              placeholder="PIX, cartão…"
              className="w-full mt-1 h-10 px-3 text-sm border border-border rounded-lg bg-background"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              E-mail do cliente
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              className="w-full mt-1 h-10 px-3 text-sm border border-border rounded-lg bg-background"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          Emitir e enviar por e-mail ao cliente
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border text-sm font-bold">
            Cancelar
          </button>
          <button
            disabled={!ready || mut.isPending || description.trim().length < 3}
            onClick={() => mut.mutate()}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            {mut.isPending ? "Emitindo…" : "Emitir NF"}
          </button>
        </div>
      </div>
    </div>
  );
}

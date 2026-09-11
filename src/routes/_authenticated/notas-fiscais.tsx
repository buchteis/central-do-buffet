import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { emitInvoice } from "@/lib/nfse.functions";
import { brl } from "@/lib/format";

export interface NfEvent {
  id: string;
  total_value?: number;
  event_date?: string;
  notes?: string;
  clients?: {
    id?: string;
    name?: string;
    cpf?: string;
    email?: string;
  };
}

interface EmitirNFModalProps {
  event: NfEvent;
  onClose: () => void;
}

export function EmitirNFModal({ event, onClose }: EmitirNFModalProps) {
  const qc = useQueryClient();
  const emitFn = useServerFn(emitInvoice);

  const clientName = event.clients?.name ?? "Cliente não informado";
  const clientCpf = event.clients?.cpf ?? "";
  const clientEmail = event.clients?.email ?? "";

  const [description, setDescription] = useState(
    event.notes?.trim() || "Serviço de buffet para evento"
  );
  const [valor, setValor] = useState(String(event.total_value ?? 0));
  const [dataServico, setDataServico] = useState(
    event.event_date ?? new Date().toISOString().slice(0, 10)
  );
  const [formaPagamento, setFormaPagamento] = useState("cartao");
  const [emailCliente, setEmailCliente] = useState(clientEmail);
  const [sendEmail, setSendEmail] = useState(false);

  const emitMut = useMutation({
    mutationFn: async () => {
      if (!event.id) throw new Error("ID do evento inválido.");

      return await emitFn({
        data: {
          eventId: event.id,
          description: description.trim(),
          amount: Number(valor) || 0,
          serviceDate: dataServico,
          paymentMethod: formaPagamento,
          recipientName: clientName,
          recipientDoc: clientCpf,
          recipientEmail: emailCliente.trim(),
          sendEmail,
        },
      });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(res?.message ?? "Nota fiscal emitida com sucesso!");
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao emitir nota fiscal.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor || Number(valor) <= 0) {
      toast.error("Informe um valor válido para a nota.");
      return;
    }
    emitMut.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl"
      >
        <div>
          <h3 className="text-lg font-extrabold">Emitir nota fiscal</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tomador: <strong>{clientName}</strong> {clientCpf ? `· ${clientCpf}` : ""}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">
              Descrição do Serviço
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-border rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Evento: {brl(event.total_value ?? 0)}
              </p>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">
                Data do Serviço
              </label>
              <input
                type="date"
                value={dataServico}
                onChange={(e) => setDataServico(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">
                Forma de Pagamento
              </label>
              <input
                type="text"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                placeholder="Ex: cartão, pix, dinheiro"
                className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">
                E-mail do Cliente
              </label>
              <input
                type="email"
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="sendEmail"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
            />
            <label htmlFor="sendEmail" className="text-xs text-muted-foreground cursor-pointer select-none">
              Emitir e enviar por e-mail ao cliente
            </label>
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={emitMut.isPending}
              className="flex-1 h-10 rounded-lg border border-border text-sm font-bold hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={emitMut.isPending}
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {emitMut.isPending ? "Emitindo…" : "Emitir NF"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

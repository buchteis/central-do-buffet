import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, FileText, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateFullBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fillTemplate } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Meu Churras" }] }),
  component: ContractsPage,
});

const DEFAULT_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BUFFET

CONTRATANTE: {cliente}
Endereço: {endereco_cliente}

CONTRATADO: {buffet}

Pelo presente instrumento, as partes acima acordam a prestação de serviços de buffet para o evento a ser realizado em {data_evento}, no local {local_evento}, para aproximadamente {convidados} convidados.

VALOR TOTAL: {valor}
FORMA DE PAGAMENTO: PIX — chave: {pix}

O contratante concorda com os termos e condições descritos neste documento.

Data: {data_hoje}

_________________________          _________________________
       Contratante                        Contratado`;

const statusStyles: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-info/10 text-info",
  assinado: "bg-emerald-500/10 text-emerald-600",
  cancelado: "bg-destructive/10 text-destructive",
};

function ContractsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: contracts } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("*, events(event_date, event_address, guest_count, total_value, clients(name, address))").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const upd = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await supabase.from("contracts").update({ content: c.content, status: c.status, title: c.title }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast.success("Contrato salvo"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">Modelos editáveis · Exportar PDF via impressão</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20">
          <Plus className="size-4" /> Novo contrato
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {contracts?.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="size-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm font-semibold">Nenhum contrato ainda</div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-5 py-3 font-bold">Título</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Data do evento</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(contracts ?? []).map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4 text-sm font-semibold">{c.title}</td>
                  <td className="px-4 py-4 text-sm">{c.events?.clients?.name ?? "—"}</td>
                  <td className="px-4 py-4 text-xs font-mono">{c.events?.event_date ? formatDateFullBR(c.events.event_date) : "—"}</td>
                  <td className="px-4 py-4"><span className={cn("px-2 py-1 text-[10px] rounded-full font-bold uppercase", statusStyles[c.status])}>{c.status}</span></td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => setEditing(c)} className="text-xs font-bold text-primary hover:underline">Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && <NewContractDialog onClose={() => setOpen(false)} />}
      {editing && <ContractEditor contract={editing} onClose={() => setEditing(null)} onSave={(c) => upd.mutate(c)} />}
    </div>
  );
}

function NewContractDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [title, setTitle] = useState("Contrato de prestação de serviços");
  const { data: events } = useQuery({
    queryKey: ["events-for-contract"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, event_date, event_address, guest_count, total_value, client_id, clients(name, address)").order("event_date", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  const { data: settings } = useQuery({
    queryKey: ["buffet-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("buffet_settings").select("*").maybeSingle();
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const ev = (events ?? []).find((e: any) => e.id === eventId);
      const tpl = settings?.contract_template || DEFAULT_TEMPLATE;
      const content = fillTemplate(tpl, {
        cliente: ev?.clients?.name ?? "",
        endereco_cliente: ev?.clients?.address ?? "",
        buffet: settings?.business_name ?? "Buffet",
        data_evento: ev?.event_date ? formatDateFullBR(ev.event_date) : "",
        local_evento: ev?.event_address ?? "",
        convidados: String(ev?.guest_count ?? ""),
        valor: brl(ev?.total_value),
        pix: settings?.pix_key ?? "",
        data_hoje: formatDateFullBR(new Date()),
      });
      const { error } = await supabase.from("contracts").insert({
        owner_id: u.user.id, event_id: eventId || null, client_id: ev?.client_id ?? null, title, content, status: "rascunho" as any,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast.success("Contrato criado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-3">
        <h3 className="text-lg font-extrabold">Novo contrato</h3>
        <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm">
          <option value="">Selecione o evento</option>
          {(events ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.event_date} — {e.clients?.name}</option>)}
        </select>
        <p className="text-[11px] text-muted-foreground">O contrato será preenchido com dados do evento e das configurações do buffet.</p>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-border text-sm font-bold">Cancelar</button>
          <button disabled={!eventId || mut.isPending} onClick={() => mut.mutate()} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">Criar</button>
        </div>
      </div>
    </div>
  );
}

function ContractEditor({ contract, onClose, onSave }: { contract: any; onClose: () => void; onSave: (c: any) => void }) {
  const [c, setC] = useState(contract);

  function printPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${c.title}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6;white-space:pre-wrap;}</style></head><body>${c.content.replace(/</g, "&lt;")}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-3xl space-y-3 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center">
          <input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} className="text-lg font-extrabold bg-transparent border-b border-transparent focus:border-border outline-none flex-1" />
          <select value={c.status} onChange={(e) => setC({ ...c, status: e.target.value })} className="h-8 px-2 border border-border rounded-md bg-background text-xs font-bold uppercase">
            <option value="rascunho">Rascunho</option><option value="enviado">Enviado</option><option value="assinado">Assinado</option><option value="cancelado">Cancelado</option>
          </select>
        </div>
        <textarea value={c.content} onChange={(e) => setC({ ...c, content: e.target.value })} className="flex-1 min-h-[400px] p-4 border border-border rounded-lg bg-background text-sm font-mono resize-none" />
        <div className="flex gap-2">
          <button onClick={printPdf} className="inline-flex items-center gap-1 h-10 px-4 rounded-lg border border-border text-sm font-bold"><Printer className="size-4" /> Imprimir / Salvar PDF</button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border text-sm font-bold">Fechar</button>
          <button onClick={() => onSave(c)} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Salvar</button>
        </div>
      </div>
    </div>
  );
}

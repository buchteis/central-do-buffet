import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, FileText, Printer, Eye, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateFullBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fillTemplate } from "@/lib/whatsapp";
import { useLogoDisplayUrl, getLogoDisplayUrl } from "@/lib/logo";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Meu Churras" }] }),
  component: ContractsPage,
});

const DEFAULT_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BUFFET

CONTRATANTE: {cliente}
CPF: {cpf_cliente}
Endereço: {endereco_cliente}
Telefone: {telefone_cliente}

CONTRATADO: {buffet}
Telefone: {telefone_buffet}
Endereço: {endereco_buffet}

CLÁUSULA 1 — OBJETO
O CONTRATADO se obriga a prestar serviços de buffet para o evento a ser realizado em {data_evento} às {hora_evento}, no local {local_evento}, para aproximadamente {convidados} convidados.
Cardápio contratado: {cardapio}.
Descrição do cardápio: {descricao_cardapio}.

CLÁUSULA 2 — VALOR E PAGAMENTO
Valor total dos serviços: {valor}.
Sinal/Entrada: {entrada}.
Saldo remanescente: {saldo}, a ser pago até a data do evento.
Forma de pagamento: {{forma_pagamento}}.
{{dados_pagamento}}

CLÁUSULA 3 — OBRIGAÇÕES DO CONTRATADO
Fornecer os alimentos, bebidas e serviços conforme o cardápio contratado, com equipe treinada e higiene adequada.

CLÁUSULA 4 — OBRIGAÇÕES DO CONTRATANTE
Fornecer local adequado, ponto de energia e água, além de efetuar os pagamentos nas datas acordadas.

CLÁUSULA 5 — CANCELAMENTO
Em caso de cancelamento pelo CONTRATANTE com menos de 15 dias de antecedência, o sinal não será devolvido.

CLÁUSULA 6 — DISPOSIÇÕES GERAIS
As partes elegem o foro da comarca do CONTRATADO para dirimir quaisquer dúvidas oriundas deste contrato.

Local e data: ______________________, {data_hoje}


_________________________          _________________________
       Contratante                        Contratado`;

const statusStyles: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-info/10 text-info",
  assinado: "bg-emerald-500/10 text-emerald-600",
  cancelado: "bg-destructive/10 text-destructive",
};

type Source = "quote" | "event" | "blank";

function ContractsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState<any | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["buffet-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("buffet_settings").select("*").maybeSingle();
      return data;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select(
          "*, events(event_date, event_address, guest_count, total_value, clients(name, address)), clients(name, address)",
        )
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const upd = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await supabase
        .from("contracts")
        .update({ content: c.content, status: c.status, title: c.title })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato salvo");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie a partir de um orçamento fechado, evento agendado ou em branco
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20"
        >
          <Plus className="size-4" /> Novo contrato
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {contracts?.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="size-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm font-semibold">Nenhum contrato ainda</div>
            <div className="text-xs text-muted-foreground mt-1">Clique em "Novo contrato" para começar</div>
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
              {(contracts ?? []).map((c: any) => {
                const clientName = c.events?.clients?.name ?? c.clients?.name ?? "—";
                const eventDate = c.events?.event_date ? formatDateFullBR(c.events.event_date) : "—";
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4 text-sm font-semibold">{c.title}</td>
                    <td className="px-4 py-4 text-sm">{clientName}</td>
                    <td className="px-4 py-4 text-xs font-mono">{eventDate}</td>
                    <td className="px-4 py-4">
                      <span
                        className={cn("px-2 py-1 text-[10px] rounded-full font-bold uppercase", statusStyles[c.status])}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setPreviewing(c)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground mr-3"
                      >
                        <Eye className="size-3.5" /> Visualizar
                      </button>
                      <button
                        onClick={() => setEditing(c)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline mr-3"
                      >
                        <Pencil className="size-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Excluir contrato?")) del.mutate(c.id);
                        }}
                        className="text-xs font-bold text-destructive hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && <NewContractDialog onClose={() => setOpen(false)} />}
      {editing && (
        <ContractEditor
          contract={editing}
          onClose={() => setEditing(null)}
          onSave={(c) => upd.mutate(c)}
          onPreview={(c) => setPreviewing(c)}
        />
      )}
      {previewing && (
        <ContractPreview
          contract={previewing}
          logoValue={(settings as any)?.logo_url ?? ""}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}

function NewContractDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [source, setSource] = useState<Source>("quote");
  const [refId, setRefId] = useState("");
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("Contrato de prestação de serviços");
  const [formaPagamento, setFormaPagamento] = useState<"PIX" | "Dados Bancários" | "Dinheiro">("PIX");

  const { data: quotes } = useQuery({
    queryKey: ["quotes-closed-for-contract"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select(
          "id, event_date, event_time, event_address, adults, children_7_10, children_0_6, total_value, entry_value, balance_value, client_id, payment_method, clients(name, address, phone, cpf), packages(name, description)",
        )
        .eq("status", "fechado")
        .order("event_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["events-for-contract"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(
          "id, event_date, event_time, event_address, guest_count, total_value, client_id, clients(name, address, phone, cpf), packages(name, description)",
        )
        .order("event_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-for-contract"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, address, phone, cpf").order("name").limit(500);
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

  // Se a origem for orçamento, herda automaticamente a forma de pagamento salva
  useEffect(() => {
    if (source !== "quote" || !refId) return;
    const q: any = (quotes ?? []).find((x: any) => x.id === refId);
    const pm = q?.payment_method;
    if (pm === "PIX" || pm === "Dados Bancários" || pm === "Dinheiro") {
      setFormaPagamento(pm);
    }
  }, [source, refId, quotes]);

  function buildPaymentVars(method: "PIX" | "Dados Bancários" | "Dinheiro", s: any) {
    const pix = s?.pix_key?.trim() ?? "";
    const pixHolder = s?.pix_holder?.trim() ?? "";
    const bankName = s?.bank_name?.trim() ?? "";
    const bankAgency = s?.bank_agency?.trim() ?? "";
    const bankAccount = s?.bank_account?.trim() ?? "";
    const bankHolder = s?.bank_holder?.trim() ?? "";

    if (method === "PIX") {
      if (!pix) throw new Error("Cadastre a chave PIX em Configurações antes de gerar o contrato.");
      const chave = pixHolder ? `${pix} (titular: ${pixHolder})` : pix;
      return {
        forma_pagamento: "PIX",
        chave_pix: chave,
        dados_bancarios: "",
        dados_pagamento: `PIX — chave: ${chave}.`,
      };
    }
    if (method === "Dados Bancários") {
      if (!bankName || !bankAgency || !bankAccount || !bankHolder) {
        throw new Error(
          "Cadastre os Dados Bancários (Banco, Agência, Conta e Titular) em Configurações antes de gerar o contrato.",
        );
      }
      const dados = `Banco: ${bankName} | Agência: ${bankAgency} | Conta: ${bankAccount} | Titular: ${bankHolder}`;
      return {
        forma_pagamento: "Dados Bancários",
        chave_pix: "",
        dados_bancarios: dados,
        dados_pagamento: `Dados Bancários — ${dados}.`,
      };
    }
    // Dinheiro
    return {
      forma_pagamento: "Dinheiro",
      chave_pix: "",
      dados_bancarios: "",
      dados_pagamento: "Pagamento em Dinheiro.",
    };
  }

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const tpl = settings?.contract_template || DEFAULT_TEMPLATE;

      const payVars = buildPaymentVars(formaPagamento, settings);

      let vars: Record<string, string> = {
        buffet: settings?.business_name ?? "Buffet",
        telefone_buffet: settings?.phone ?? settings?.whatsapp ?? "",
        endereco_buffet: (settings?.address ?? "").trim() || "(endereço não cadastrado em Configurações)",
        pix: settings?.pix_key ?? "",
        pix_titular: settings?.pix_holder ?? "",
        data_hoje: formatDateFullBR(new Date()),
        cliente: "",
        cpf_cliente: "",
        endereco_cliente: "",
        telefone_cliente: "",
        data_evento: "",
        hora_evento: "",
        local_evento: "",
        convidados: "",
        valor: brl(0),
        entrada: brl(0),
        saldo: brl(0),
        pacote: "",
        descricao_pacote: "",
        cardapio: "",
        descricao_cardapio: "",
        ...payVars,
      };

      let ev_id: string | null = null;
      let cli_id: string | null = null;

      if (source === "quote") {
        const q = (quotes ?? []).find((x: any) => x.id === refId);
        if (!q) throw new Error("Selecione um orçamento");
        cli_id = q.client_id;
        const guests = (q.adults ?? 0) + (q.children_7_10 ?? 0) + (q.children_0_6 ?? 0);
        vars = {
          ...vars,
          cliente: q.clients?.name ?? "",
          cpf_cliente: q.clients?.cpf ?? "",
          endereco_cliente: q.clients?.address ?? "",
          telefone_cliente: q.clients?.phone ?? "",
          data_evento: formatDateFullBR(q.event_date),
          hora_evento: q.event_time ?? "",
          local_evento: q.event_address ?? "",
          convidados: String(guests),
          valor: brl(q.total_value),
          entrada: brl(q.entry_value),
          saldo: brl(q.balance_value),
          pacote: q.packages?.name ?? "",
          descricao_pacote: q.packages?.description ?? "",
          cardapio: q.packages?.name ?? "",
          descricao_cardapio: q.packages?.description ?? "",
        };
      } else if (source === "event") {
        const ev = (events ?? []).find((x: any) => x.id === refId);
        if (!ev) throw new Error("Selecione um evento");
        ev_id = ev.id;
        cli_id = ev.client_id;
        vars = {
          ...vars,
          cliente: ev.clients?.name ?? "",
          cpf_cliente: ev.clients?.cpf ?? "",
          endereco_cliente: ev.clients?.address ?? "",
          telefone_cliente: ev.clients?.phone ?? "",
          data_evento: formatDateFullBR(ev.event_date),
          hora_evento: ev.event_time ?? "",
          local_evento: ev.event_address ?? "",
          convidados: String(ev.guest_count ?? ""),
          valor: brl(ev.total_value),
          pacote: ev.packages?.name ?? "",
          descricao_pacote: ev.packages?.description ?? "",
          cardapio: ev.packages?.name ?? "",
          descricao_cardapio: ev.packages?.description ?? "",
        };
      } else {
        if (clientId) {
          const cli = (clients ?? []).find((c: any) => c.id === clientId);
          if (cli) {
            cli_id = cli.id;
            vars = {
              ...vars,
              cliente: cli.name ?? "",
              cpf_cliente: cli.cpf ?? "",
              endereco_cliente: cli.address ?? "",
              telefone_cliente: cli.phone ?? "",
            };
          }
        }
      }

      const content = fillTemplate(tpl, vars);
      const { error } = await supabase.from("contracts").insert({
        owner_id: u.user.id,
        event_id: ev_id,
        client_id: cli_id,
        title,
        content,
        status: "rascunho" as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato criado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const canCreate = source === "blank" ? true : !!refId;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4"
      >
        <h3 className="text-lg font-extrabold">Novo contrato</h3>

        <div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">Origem</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(["quote", "event", "blank"] as Source[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSource(s);
                  setRefId("");
                }}
                className={cn(
                  "h-9 rounded-lg text-xs font-bold border",
                  source === s ? "bg-primary text-primary-foreground border-primary" : "border-border",
                )}
              >
                {s === "quote" ? "Orçamento" : s === "event" ? "Evento" : "Em branco"}
              </button>
            ))}
          </div>
        </div>

        <input
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm"
        />

        {source === "quote" && (
          <select
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm"
          >
            <option value="">Selecione um orçamento fechado</option>
            {(quotes ?? []).map((q: any) => (
              <option key={q.id} value={q.id}>
                {formatDateFullBR(q.event_date)} — {q.clients?.name} — {brl(q.total_value)}
              </option>
            ))}
          </select>
        )}

        {source === "event" && (
          <select
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm"
          >
            <option value="">Selecione um evento</option>
            {(events ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>
                {formatDateFullBR(e.event_date)} — {e.clients?.name}
              </option>
            ))}
          </select>
        )}

        {source === "blank" && (
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm"
          >
            <option value="">Cliente (opcional)</option>
            {(clients ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <div>
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Forma de pagamento
          </label>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value as "PIX" | "Dados Bancários" | "Dinheiro")}
            className="mt-1 w-full h-10 px-3 border border-border rounded-lg bg-background text-sm"
          >
            <option value="PIX">PIX</option>
            <option value="Dados Bancários">Dados Bancários</option>
            <option value="Dinheiro">Dinheiro</option>
          </select>
          {source === "quote" && refId && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Herdada do orçamento selecionado (você pode alterar se necessário).
            </p>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {source === "blank"
            ? "O contrato será criado com o modelo padrão. Você poderá editar todo o texto em seguida."
            : "Os dados serão preenchidos automaticamente e permanecerão totalmente editáveis."}
        </p>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-border text-sm font-bold">
            Cancelar
          </button>
          <button
            disabled={!canCreate || mut.isPending}
            onClick={() => mut.mutate()}
            className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractEditor({
  contract,
  onClose,
  onSave,
  onPreview,
}: {
  contract: any;
  onClose: () => void;
  onSave: (c: any) => void;
  onPreview: (c: any) => void;
}) {
  const [c, setC] = useState(contract);

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-3xl space-y-3 max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-center gap-3">
          <input
            value={c.title}
            onChange={(e) => setC({ ...c, title: e.target.value })}
            className="text-lg font-extrabold bg-transparent border-b border-transparent focus:border-border outline-none flex-1"
          />
          <select
            value={c.status}
            onChange={(e) => setC({ ...c, status: e.target.value })}
            className="h-8 px-2 border border-border rounded-md bg-background text-xs font-bold uppercase"
          >
            <option value="rascunho">Rascunho</option>
            <option value="enviado">Enviado</option>
            <option value="assinado">Assinado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Edite livremente o texto do contrato. Todas as cláusulas podem ser alteradas.
        </p>
        <textarea
          value={c.content}
          onChange={(e) => setC({ ...c, content: e.target.value })}
          className="flex-1 min-h-[400px] p-4 border border-border rounded-lg bg-background text-sm font-mono resize-none"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onPreview(c)}
            className="inline-flex items-center gap-1 h-10 px-4 rounded-lg border border-border text-sm font-bold"
          >
            <Eye className="size-4" /> Visualizar
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border text-sm font-bold">
            Fechar
          </button>
          <button
            onClick={() => onSave(c)}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractPreview({ contract, logoValue, onClose }: { contract: any; logoValue?: string; onClose: () => void }) {
  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { data: logo = "" } = useLogoDisplayUrl(logoValue);

  async function printPdf() {
    const freshLogo = await getLogoDisplayUrl(logoValue);
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Permita pop-ups para gerar o PDF");
      return;
    }
    const logoHtml = freshLogo
      ? `<div class="logo"><img id="__logo" src="${escapeHtml(freshLogo)}" alt="Logomarca"/></div>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(contract.title)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.65; font-size: 12pt; margin: 0; }
  .logo { text-align: center; margin: 0 0 16px; }
  .logo img { max-height: 90px; max-width: 60%; object-fit: contain; }
  h1 { font-size: 16pt; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 20px; }
  .content { white-space: pre-wrap; text-align: justify; }
  .footer { margin-top: 28px; font-size: 10pt; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { .no-print { display: none; } }
</style></head><body>
${logoHtml}
<h1>${escapeHtml(contract.title)}</h1>
<div class="content">${escapeHtml(contract.content)}</div>
<div class="footer">Documento gerado em ${escapeHtml(formatDateFullBR(new Date()))}</div>
<script>
  (function(){
    var img = document.getElementById('__logo');
    var done = false;
    function go(){ if(done) return; done = true; setTimeout(function(){ window.focus(); window.print(); }, 200); }
    if (!img) { go(); return; }
    if (img.complete && img.naturalWidth > 0) { go(); return; }
    img.addEventListener('load', go);
    img.addEventListener('error', function(){ img.style.display='none'; go(); });
    setTimeout(go, 5000);
  })();
</script>
</body></html>`;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="text-sm font-extrabold">Visualização do contrato</div>
          <div className="flex gap-2">
            <button
              onClick={printPdf}
              className="inline-flex items-center gap-1 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
            >
              <Printer className="size-4" /> Gerar PDF
            </button>
            <button onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-xs font-bold">
              Fechar
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-muted/40 p-6">
          <div
            className="mx-auto max-w-[720px] bg-white text-neutral-900 shadow-lg rounded-md p-12"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.65 }}
          >
            {logo && (
              <div className="text-center mb-4">
                <img
                  src={logo}
                  alt="Logomarca"
                  className="mx-auto max-h-24 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            <h1 className="text-center text-xl font-bold uppercase tracking-wide mb-6">{contract.title}</h1>
            <div className="whitespace-pre-wrap text-justify text-[14px]">{contract.content}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

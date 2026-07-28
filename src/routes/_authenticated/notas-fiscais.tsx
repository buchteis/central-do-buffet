import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { maskCpfCnpj } from "@/lib/doc";
import { downloadInvoiceXml, openInvoicePdf } from "@/lib/nf-doc";
import { cancelInvoice, resendInvoiceEmail, saveFiscalApiKey } from "@/lib/nfse.functions";

export const Route = createFileRoute("/_authenticated/notas-fiscais")({
  head: () => ({
    meta: [
      { title: "Notas Fiscais — Central do Buffet" },
      { name: "description", content: "Emita e gerencie as NFS-e dos eventos do seu buffet." },
      { property: "og:title", content: "Notas Fiscais — Central do Buffet" },
      { property: "og:description", content: "Emita e gerencie as NFS-e dos eventos do seu buffet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicesPage,
});

const statusStyles: Record<string, string> = {
  emitida: "bg-success/10 text-success",
  pendente: "bg-primary/10 text-primary",
  cancelada: "bg-destructive/10 text-destructive",
  erro: "bg-destructive/10 text-destructive",
};

function InvoicesPage() {
  const [tab, setTab] = useState<"historico" | "dados">("historico");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Notas Fiscais</h1>
        <p className="text-sm text-muted-foreground mt-1">Emissão de NFS-e dos eventos e dados fiscais do buffet</p>
      </div>

      <div className="flex gap-2">
        {(["historico", "dados"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "h-9 px-4 rounded-full text-xs font-bold transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {t === "historico" ? "Notas emitidas" : "Dados fiscais"}
          </button>
        ))}
      </div>

      {tab === "historico" ? <HistoryTab /> : <FiscalSettingsTab />}
    </div>
  );
}

/* ------------------------------- HISTÓRICO ------------------------------- */

function HistoryTab() {
  const qc = useQueryClient();
  const { query: gq, match } = useSearchFilter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: fiscal } = useQuery({
    queryKey: ["fiscal-settings"],
    queryFn: async () => (await supabase.from("fiscal_settings").select("*").maybeSingle()).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(name), events(event_date, packages(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cancelFn = useServerFn(cancelInvoice);
  const resendFn = useServerFn(resendInvoiceEmail);

  const cancelMut = useMutation({
    mutationFn: async (v: { invoiceId: string; reason: string }) => cancelFn({ data: v }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(r?.message ?? "Nota cancelada.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar."),
  });

  const resendMut = useMutation({
    mutationFn: async (v: { invoiceId: string; email: string }) => resendFn({ data: v }),
    onSuccess: (r: any) => toast.success(r?.message ?? "E-mail enviado."),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao reenviar."),
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const gmatch = match;
    return (data ?? []).filter((i: any) => {
      if (status !== "todos" && i.status !== status) return false;
      const d = i.service_date ?? i.created_at?.slice(0, 10);
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      if (
        !gmatch(
          i.number,
          i.recipient_name,
          i.recipient_doc,
          i.recipient_email,
          i.clients?.name,
          i.description,
          i.status,
          i.amount,
        )
      )
        return false;
      if (!term) return true;
      return [i.number, i.recipient_name, i.recipient_doc, i.clients?.name, i.description]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(term));
    });
  }, [data, q, status, from, to, gq]);

  const issuer = {
    razao_social: fiscal?.razao_social,
    cnpj: fiscal?.cnpj,
    inscricao_municipal: fiscal?.inscricao_municipal,
    codigo_servico: fiscal?.codigo_servico,
    aliquota_iss: fiscal?.aliquota_iss,
    address: [fiscal?.address_street, fiscal?.address_number, fiscal?.address_district, fiscal?.address_city, fiscal?.address_state]
      .filter(Boolean)
      .join(", "),
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 grid gap-3 md:grid-cols-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nº da NF, cliente ou CNPJ…"
          className="h-10 px-3 text-sm border border-border rounded-lg bg-background md:col-span-2"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 px-3 text-sm border border-border rounded-lg bg-background"
        >
          <option value="todos">Todos os status</option>
          <option value="emitida">Emitida</option>
          <option value="pendente">Pendente</option>
          <option value="cancelada">Cancelada</option>
          <option value="erro">Erro</option>
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 px-2 text-xs border border-border rounded-lg bg-background w-full"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 px-2 text-xs border border-border rounded-lg bg-background w-full"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-14 text-center">
            <div className="text-sm font-semibold">Nenhuma nota encontrada</div>
            <div className="text-xs text-muted-foreground mt-1">
              Emita a primeira nota pelo botão “Emitir NF” na tela de Eventos.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-5 py-3 font-bold">Nº</th>
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold hidden md:table-cell">Serviço</th>
                  <th className="px-4 py-3 font-bold">Data</th>
                  <th className="px-4 py-3 font-bold text-right">Valor</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((i: any) => (
                  <tr key={i.id} className="hover:bg-muted/30 transition-colors align-top">
                    <td className="px-5 py-4 text-xs font-mono">{i.number ?? "—"}</td>
                    <td className="px-4 py-4 text-sm font-semibold">
                      {i.recipient_name ?? i.clients?.name ?? "—"}
                      {i.recipient_doc && (
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {maskCpfCnpj(i.recipient_doc)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs hidden md:table-cell max-w-[260px]">{i.description}</td>
                    <td className="px-4 py-4 text-xs font-mono">
                      {formatDateBR(i.service_date ?? i.created_at?.slice(0, 10))}
                    </td>
                    <td className="px-4 py-4 text-sm font-mono text-right">{brl(i.amount)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "px-2 py-1 text-[10px] rounded-full font-bold uppercase tracking-wider",
                          statusStyles[i.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {i.status}
                      </span>
                      {i.environment !== "producao" && (
                        <div className="text-[10px] text-muted-foreground mt-1">homologação</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex flex-wrap gap-1.5 justify-end">
                        <button
                          onClick={() =>
                            i.pdf_url
                              ? window.open(i.pdf_url, "_blank", "noopener")
                              : openInvoicePdf({ ...i, issuer })
                          }
                          className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-muted hover:bg-accent"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() =>
                            i.xml_url
                              ? window.open(i.xml_url, "_blank", "noopener")
                              : downloadInvoiceXml({ ...i, issuer })
                          }
                          className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-muted hover:bg-accent"
                        >
                          XML
                        </button>
                        <button
                          onClick={() => {
                            const email = prompt("Enviar a nota para qual e-mail?", i.recipient_email ?? "");
                            if (email) resendMut.mutate({ invoiceId: i.id, email });
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-muted hover:bg-accent"
                        >
                          Reenviar
                        </button>
                        {i.status !== "cancelada" && (
                          <button
                            onClick={() => {
                              const reason = prompt("Motivo do cancelamento:");
                              if (reason && reason.trim().length >= 3)
                                cancelMut.mutate({ invoiceId: i.id, reason: reason.trim() });
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- DADOS FISCAIS ----------------------------- */

function FiscalSettingsTab() {
  const qc = useQueryClient();
  const saveKey = useServerFn(saveFiscalApiKey);

  const { data } = useQuery({
    queryKey: ["fiscal-settings"],
    queryFn: async () => (await supabase.from("fiscal_settings").select("*").maybeSingle()).data,
  });

  const [f, setF] = useState({
    razao_social: "",
    cnpj: "",
    inscricao_municipal: "",
    regime_tributario: "simples_nacional",
    codigo_servico: "",
    aliquota_iss: "0",
    address_street: "",
    address_number: "",
    address_complement: "",
    address_district: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    fiscal_phone: "",
    fiscal_email: "",
    invoice_logo_url: "",
    provider: "generic",
    environment: "homologacao",
  });
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!data) return;
    setF({
      razao_social: data.razao_social ?? "",
      cnpj: data.cnpj ?? "",
      inscricao_municipal: data.inscricao_municipal ?? "",
      regime_tributario: data.regime_tributario ?? "simples_nacional",
      codigo_servico: data.codigo_servico ?? "",
      aliquota_iss: String(data.aliquota_iss ?? 0),
      address_street: data.address_street ?? "",
      address_number: data.address_number ?? "",
      address_complement: data.address_complement ?? "",
      address_district: data.address_district ?? "",
      address_city: data.address_city ?? "",
      address_state: data.address_state ?? "",
      address_zip: data.address_zip ?? "",
      fiscal_phone: data.fiscal_phone ?? "",
      fiscal_email: data.fiscal_email ?? "",
      invoice_logo_url: data.invoice_logo_url ?? "",
      provider: data.provider ?? "generic",
      environment: data.environment ?? "homologacao",
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const payload = { ...f, aliquota_iss: Number(f.aliquota_iss) || 0, owner_id: u.user.id };
      const { error } = await supabase.from("fiscal_settings").upsert(payload, { onConflict: "owner_id" });
      if (error) throw error;
      if (apiKey.trim()) {
        await saveKey({ data: { apiKey: apiKey.trim() } });
        setApiKey("");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-settings"] });
      toast.success("Dados fiscais salvos");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-5 max-w-3xl">
      <Card title="Identificação fiscal">
        <Field label="Razão social">
          <input value={f.razao_social} onChange={(e) => setF({ ...f, razao_social: e.target.value })} className="inp" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="CNPJ">
            <input
              value={f.cnpj}
              onChange={(e) => setF({ ...f, cnpj: maskCpfCnpj(e.target.value) })}
              className="inp"
            />
          </Field>
          <Field label="Inscrição municipal">
            <input
              value={f.inscricao_municipal}
              onChange={(e) => setF({ ...f, inscricao_municipal: e.target.value })}
              className="inp"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Regime tributário">
            <select
              value={f.regime_tributario}
              onChange={(e) => setF({ ...f, regime_tributario: e.target.value })}
              className="inp"
            >
              <option value="simples_nacional">Simples Nacional</option>
              <option value="mei">MEI</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </Field>
          <Field label="Código de serviço (ISS)">
            <input
              value={f.codigo_servico}
              onChange={(e) => setF({ ...f, codigo_servico: e.target.value })}
              className="inp"
            />
          </Field>
          <Field label="Alíquota ISS (%)">
            <input
              type="number"
              step="0.01"
              value={f.aliquota_iss}
              onChange={(e) => setF({ ...f, aliquota_iss: e.target.value })}
              className="inp"
            />
          </Field>
        </div>
      </Card>

      <Card title="Endereço do estabelecimento">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Logradouro">
              <input
                value={f.address_street}
                onChange={(e) => setF({ ...f, address_street: e.target.value })}
                className="inp"
              />
            </Field>
          </div>
          <Field label="Número">
            <input
              value={f.address_number}
              onChange={(e) => setF({ ...f, address_number: e.target.value })}
              className="inp"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Complemento">
            <input
              value={f.address_complement}
              onChange={(e) => setF({ ...f, address_complement: e.target.value })}
              className="inp"
            />
          </Field>
          <Field label="Bairro">
            <input
              value={f.address_district}
              onChange={(e) => setF({ ...f, address_district: e.target.value })}
              className="inp"
            />
          </Field>
          <Field label="CEP">
            <input value={f.address_zip} onChange={(e) => setF({ ...f, address_zip: e.target.value })} className="inp" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Cidade">
              <input
                value={f.address_city}
                onChange={(e) => setF({ ...f, address_city: e.target.value })}
                className="inp"
              />
            </Field>
          </div>
          <Field label="UF">
            <input
              value={f.address_state}
              maxLength={2}
              onChange={(e) => setF({ ...f, address_state: e.target.value.toUpperCase() })}
              className="inp"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Telefone fiscal">
            <input
              value={f.fiscal_phone}
              onChange={(e) => setF({ ...f, fiscal_phone: e.target.value })}
              className="inp"
            />
          </Field>
          <Field label="E-mail fiscal">
            <input
              type="email"
              value={f.fiscal_email}
              onChange={(e) => setF({ ...f, fiscal_email: e.target.value })}
              className="inp"
            />
          </Field>
        </div>
      </Card>

      <Card title="Logo da nota fiscal">
        <div className="flex items-center gap-3">
          <label className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold cursor-pointer inline-flex items-center">
            {uploading ? "Enviando…" : "Selecionar logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setUploading(true);
                  const { data: u } = await supabase.auth.getUser();
                  if (!u.user) throw new Error("Sem sessão");
                  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
                  const path = `${u.user.id}/nf-logo-${Date.now()}.${ext}`;
                  const { error } = await supabase.storage
                    .from("buffet-logos")
                    .upload(path, file, { upsert: true, contentType: file.type });
                  if (error) throw error;
                  setF((prev) => ({ ...prev, invoice_logo_url: path }));
                  toast.success("Logo carregada. Clique em salvar.");
                } catch (err: any) {
                  toast.error(err?.message ?? "Falha no upload");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          {f.invoice_logo_url && (
            <button
              onClick={() => setF({ ...f, invoice_logo_url: "" })}
              className="h-10 px-3 rounded-lg border border-border text-xs font-bold"
            >
              Remover
            </button>
          )}
          <span className="text-[11px] text-muted-foreground truncate">{f.invoice_logo_url || "Nenhuma logo"}</span>
        </div>
      </Card>

      <Card title="Integração fiscal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Provedor">
            <select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} className="inp">
              <option value="generic">Nenhum (modo simulado)</option>
              <option value="focus_nfe">Focus NFe</option>
              <option value="nfe_io">NFe.io</option>
            </select>
          </Field>
          <Field label="Ambiente">
            <select value={f.environment} onChange={(e) => setF({ ...f, environment: e.target.value })} className="inp">
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção</option>
            </select>
          </Field>
        </div>
        <Field label="Chave de API">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={data?.has_api_key ? "•••••••• (chave salva) — digite para substituir" : "Cole a chave da API"}
            className="inp"
          />
        </Field>
        <p className="text-[11px] text-muted-foreground">
          A chave fica guardada com segurança no servidor e nunca é exibida novamente. Com o provedor “Nenhum”, as notas
          são registradas em modo simulado para você testar o fluxo.
        </p>
      </Card>

      <div className="flex justify-end">
        <button
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
        >
          Salvar dados fiscais
        </button>
      </div>

      <style>{`.inp{width:100%;height:40px;padding:0 12px;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--background));font-size:14px}`}</style>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <h2 className="font-extrabold">{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">{label}</div>
      {children}
    </div>
  );
}

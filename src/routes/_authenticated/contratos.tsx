import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Plus, FileText, Printer, Eye, Pencil, Trash2, CheckSquare, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateFullBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fillTemplate } from "@/lib/whatsapp";
import { useLogoDisplayUrl, getLogoDisplayUrl } from "@/lib/logo";
import { useSearchFilter } from "@/lib/search-store";
import { dedupePackages } from "@/lib/quote-calc";
import { DEFAULT_CONTRACT_TEMPLATE } from "@/lib/contract-template";
import VariableInserter from "@/components/VariableInserter";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Meu Churras" }] }),
  component: ContractsPage,
});

const statusStyles: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-info/10 text-info",
  assinado: "bg-emerald-500/10 text-emerald-600",
  cancelado: "bg-destructive/10 text-destructive",
};

type Source = "quote" | "event" | "blank";

const CONTRACT_PERIODS: { key: "dia" | "semana" | "mes" | "ano" | "todos"; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "todos", label: "Tudo" },
];

function contractStartOf(period: "dia" | "semana" | "mes" | "ano" | "todos") {
  const now = new Date();
  if (period === "dia") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "semana") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  if (period === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "ano") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function ContractsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState<any | null>(null);
  const [period, setPeriod] = useState<"dia" | "semana" | "mes" | "ano" | "todos">("todos");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { match } = useSearchFilter();

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

  const filteredContracts = (contracts ?? [])
    .filter((c: any) => {
      const from = contractStartOf(period);
      if (!from) return true;
      const ref = c.events?.event_date ? new Date(`${c.events.event_date}T00:00:00`) : new Date(c.created_at);
      return ref >= from;
    })
    .filter((c: any) =>
      match(
        c.title,
        c.status,
        c.content,
        c.events?.clients?.name,
        c.events?.clients?.cpf,
        c.clients?.name,
        c.clients?.cpf,
      ),
    );

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

  // Exclusão individual ou em massa
  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("contracts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      toast.success(ids.length === 1 ? "Contrato excluído" : `${ids.length} contratos excluídos`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredContracts.map((c: any) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    filteredContracts.length > 0 &&
    filteredContracts.every((c: any) => selectedIds.includes(c.id));

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-full w-fit">
          {CONTRACT_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
                period === p.key
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* BARRA DE AÇÃO EM MASSA */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-full">
            <span className="text-xs font-bold text-destructive">
              {selectedIds.length} selecionado(s)
            </span>
            <button
              onClick={() => {
                if (confirm(`Deseja excluir os ${selectedIds.length} contratos selecionados?`)) {
                  del.mutate(selectedIds);
                }
              }}
              disabled={del.isPending}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" /> Excluir selecionados
            </button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {filteredContracts.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="size-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm font-semibold">Nenhum contrato encontrado</div>
            <div className="text-xs text-muted-foreground mt-1">Clique em "Novo contrato" para começar</div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-4 py-3 font-bold w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 font-bold">Título</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Data do evento</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContracts.map((c: any) => {
                const clientName = c.events?.clients?.name ?? c.clients?.name ?? "—";
                const eventDate = c.events?.event_date ? formatDateFullBR(c.events.event_date) : "—";
                const isSelected = selectedIds.includes(c.id);

                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(c.id)}
                        className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold">{c.title}</td>
                    <td className="px-4 py-4 text-sm">{clientName}</td>
                    <td className="px-4 py-4 text-xs font-mono">{eventDate}</td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "px-2 py-1 text-[10px] rounded-full font-bold uppercase",
                          statusStyles[c.status],
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewing(c)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                          title="Visualizar"
                        >
                          <Eye className="size-3.5" /> Visualizar
                        </button>
                        <button
                          onClick={() => setEditing(c)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline p-1 rounded hover:bg-primary/10"
                          title="Editar"
                        >
                          <Pencil className="size-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Deseja realmente excluir o contrato "${c.title}"?`)) {
                              del.mutate([c.id]);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors"
                          title="Excluir contrato"
                        >
                          <Trash2 className="size-3.5" /> Excluir
                        </button>
                      </div>
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

function formatUnitItems(items: any[]): { text: string; total: number } {
  const list = (items ?? []).filter(
    (i) => Number(i?.qty ?? i?.quantity ?? 0) > 0 || Number(i?.unit_price ?? i?.price ?? 0) > 0,
  );
  if (!list.length) return { text: "Nenhum item adicional contratado", total: 0 };

  let total = 0;
  const text = list
    .map((item) => {
      const qtd = Number(item?.qty ?? item?.quantity ?? 1) || 1;
      const preco = Number(item?.unit_price ?? item?.price ?? 0) || 0;
      const sub = preco * qtd;
      total += sub;
      const un = item?.unit ? ` ${item.unit}` : "";
      return `${item?.name ?? "Item"} — ${qtd}${un} × ${brl(preco)} = ${brl(sub)}`;
    })
    .join("\n");

  return { text, total };
}

function getAdditionsText(
  extras: any,
  totalValue: number,
  pkgTotal: number,
  unitTotal: number,
  quoteObj?: any,
): string {
  const list: string[] = [];

  if (extras && typeof extras === "object") {
    if (Array.isArray(extras.custom)) {
      for (const item of extras.custom) {
        const val = Number(item?.value ?? 0) || 0;
        if (val <= 0) continue;
        const name = String(item?.description ?? "Acréscimo").trim() || "Acréscimo";
        list.push(`${name} — ${brl(val)}`);
      }
    }

    const arrayKeys = Object.keys(extras).filter((k) => Array.isArray(extras[k]));
    for (const k of arrayKeys) {
      if (["packages", "unit_items", "custom"].includes(k)) continue;
      const arr = extras[k];
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const val = Number(item?.value ?? item?.price ?? item?.amount ?? item?.total ?? 0) || 0;
        if (val > 0) {
          const name =
            item?.name ??
            item?.title ??
            item?.description ??
            item?.label ??
            item?.reason ??
            item?.motivo ??
            "Acréscimo";
          list.push(`${name} — ${brl(val)}`);
        }
      }
    }

    if (list.length === 0) {
      const singlePairs = [
        {
          val: extras.additional_value,
          desc: extras.additional_description || extras.additional_name || extras.additional_reason || extras.reason,
        },
        {
          val: extras.surcharge_value || extras.surcharge,
          desc:
            extras.surcharge_description || extras.surcharge_name || extras.surcharge_reason || extras.surcharge_notes,
        },
        {
          val: extras.freight || extras.frete || extras.taxa_deslocamento || extras.deslocamento,
          desc:
            extras.freight_description ||
            extras.frete_description ||
            extras.deslocamento_descricao ||
            "Taxa de Deslocamento / Frete",
        },
        {
          val: extras.acrescimo_total || extras.acrescimo,
          desc: extras.acrescimo_descricao || extras.acrescimo_nome || extras.descricao_acrescimo || extras.motivo,
        },
      ];

      for (const pair of singlePairs) {
        if (!list.length && Number(pair.val) > 0) {
          const val = Number(pair.val);
          const label = pair.desc?.trim() || "Acréscimo / Taxa adicional";
          list.push(`${label} — ${brl(val)}`);
        }
      }
    }
  }

  const diff = Math.round((totalValue - (pkgTotal + unitTotal)) * 100) / 100;
  if (list.length === 0 && diff > 0.05) {
    let foundText = "";

    if (extras && typeof extras === "object") {
      for (const [k, v] of Object.entries(extras)) {
        if (
          typeof v === "string" &&
          v.trim().length > 0 &&
          !["packages", "unit_items"].includes(k) &&
          isNaN(Number(v))
        ) {
          foundText = v.trim();
          break;
        }
      }
    }

    if (!foundText && quoteObj && typeof quoteObj === "object") {
      const candidateFields = [
        quoteObj.notes,
        quoteObj.observation,
        quoteObj.obs,
        quoteObj.description,
        quoteObj.surcharge_notes,
        quoteObj.addition_notes,
        quoteObj.reason,
      ];
      for (const f of candidateFields) {
        if (typeof f === "string" && f.trim().length > 0) {
          foundText = f.trim();
          break;
        }
      }
    }

    const label = foundText || "Acréscimo / Taxa adicional";
    list.push(`${label} — ${brl(diff)}`);
  }

  if (list.length === 0) {
    return "Nenhum acréscimo adicional";
  }

  return list.join("\n");
}

function NewContractDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [source, setSource] = useState<Source>("quote");
  const [refId, setRefId] = useState("");
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("Contrato de prestação de serviços");
  const [formaPagamento, setFormaPagamento] = useState<"PIX" | "Dados Bancários" | "Dinheiro">("PIX");
  const [savingTpl, setSavingTpl] = useState(false);
  const [tplDraft, setTplDraft] = useState("");
  const [tplLoaded, setTplLoaded] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const tplRef = useRef<HTMLTextAreaElement>(null);

  const { data: quotes } = useQuery({
    queryKey: ["quotes-closed-for-contract"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("*, clients(name, address, phone, cpf), packages(name, description)")
        .eq("status", "fechado")
        .order("event_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["events-for-contract"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, event_date, event_time, event_address, guest_count, total_value, client_id, quote_id, clients(name, address, phone, cpf), package_id",
        )
        .neq("status", "cancelado")
        .order("event_date", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Erro ao buscar eventos:", error);
        return [];
      }

      const packageIds = (data ?? []).map((e: any) => e.package_id).filter(Boolean);
      let packagesMap: Record<string, any> = {};

      if (packageIds.length > 0) {
        const { data: pkgs } = await supabase.from("packages").select("id, name, description").in("id", packageIds);

        (pkgs ?? []).forEach((p: any) => {
          packagesMap[p.id] = p;
        });
      }

      return (data ?? []).map((ev: any) => ({
        ...ev,
        packages: ev.package_id ? (packagesMap[ev.package_id] ?? null) : null,
      }));
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

  useEffect(() => {
    if (tplLoaded || settings === undefined) return;
    setTplDraft((settings?.contract_template ?? "").trim());
    setTplLoaded(true);
  }, [settings, tplLoaded]);

  const saveTemplate = async (text: string) => {
    try {
      setSavingTpl(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase
        .from("buffet_settings")
        .upsert({ owner_id: u.user.id, contract_template: text }, { onConflict: "owner_id" });
      if (error) throw error;
      setTplDraft(text);
      await qc.invalidateQueries({ queryKey: ["buffet-settings"] });
      toast.success("Modelo salvo como padrão para todos os contratos.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível salvar o modelo");
    } finally {
      setSavingTpl(false);
    }
  };

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
      const tpl = tplDraft.trim() || (settings?.contract_template ?? "").trim() || DEFAULT_CONTRACT_TEMPLATE;

      const payVars = buildPaymentVars(formaPagamento, settings);

      let vars: Record<string, string> = {
        buffet: settings?.business_name ?? "Buffet",
        telefone_buffet: settings?.phone ?? settings?.whatsapp ?? "",
        cnpj_buffet: ((settings as any)?.cnpj ?? "").trim(),
        cnpj: ((settings as any)?.cnpj ?? "").trim(),

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
        pacotes: "",
        itens_unitarios: "",
        itens_adicionais: "",
        acrescimos: "Nenhum acréscimo adicional",
        acrescimos_adicionais: "Nenhum acréscimo adicional",
        acrescimo: "Nenhum acréscimo adicional",
        taxas: "Nenhum acréscimo adicional",
        descricao_pacote: "",
        cardapio: "",
        descricao_cardapio: "",
        ...payVars,
      };

      let ev_id: string | null = null;
      let cli_id: string | null = null;

      if (source === "quote") {
        const q: any = (quotes ?? []).find((x: any) => x.id === refId);
        if (!q) throw new Error("Selecione um orçamento");
        cli_id = q.client_id;
        const guests = (q.adults ?? 0) + (q.children_7_10 ?? 0) + (q.children_0_6 ?? 0);
        const qExtras: any = q.extras ?? {};
        const adults = Number(q.adults ?? 0) || 0;
        const pkgSnap: any[] = Array.isArray(qExtras.packages) ? qExtras.packages : [];
        const unitSnap: any[] = Array.isArray(qExtras.unit_items) ? qExtras.unit_items : [];
        const pkgNames = pkgSnap.map((p) => p?.name).filter(Boolean);
        const pacoteLabel = pkgNames.length ? pkgNames.join(", ") : (q.packages?.name ?? "");
        const pkgSnapClean = dedupePackages(pkgSnap, unitSnap);

        let pkgTotal = 0;
        const pacotesDetalhados = pkgSnapClean.length
          ? pkgSnapClean
              .map((p) => {
                const ppp = Number(p?.price_per_person ?? 0) || 0;
                const sub = ppp * adults;
                pkgTotal += sub;
                return `${p?.name ?? "Pacote"} — ${brl(ppp)}/pessoa × ${adults} = ${brl(sub)}`;
              })
              .join("\n")
          : pacoteLabel;

        const { text: itensUnitariosDetalhados, total: unitTotal } = formatUnitItems(unitSnap);
        const totalVal = Number(q.total_value ?? 0);
        const acrescimosText = getAdditionsText(qExtras, totalVal, pkgTotal, unitTotal, q);

        const entryVal = q.entry_value != null ? Number(q.entry_value) : totalVal * 0.5;
        const balanceVal = q.balance_value != null ? Number(q.balance_value) : totalVal - entryVal;

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
          valor: brl(totalVal),
          entrada: brl(entryVal),
          saldo: brl(balanceVal),
          pacote: pacoteLabel,
          pacotes: pacotesDetalhados,
          itens_unitarios: itensUnitariosDetalhados,
          itens_adicionais: itensUnitariosDetalhados,
          acrescimos: acrescimosText,
          acrescimos_adicionais: acrescimosText,
          acrescimo: acrescimosText,
          taxas: acrescimosText,
          descricao_pacote: q.packages?.description ?? "",
          cardapio: pacoteLabel,
          descricao_cardapio: q.packages?.description ?? "",
        };
      } else if (source === "event") {
        const ev: any = (events ?? []).find((x: any) => x.id === refId);
        if (!ev) throw new Error("Selecione um evento");
        ev_id = ev.id;
        cli_id = ev.client_id;

        let totalVal = Number(ev.total_value ?? 0);
        let entryVal = totalVal * 0.5;
        let balanceVal = totalVal - entryVal;

        let evPacotes = ev.packages?.name ?? "—";
        let evItens = "Nenhum item adicional contratado";
        let evAcrescimos = "Nenhum acréscimo adicional";

        if (ev.quote_id) {
          const { data: qLink } = await supabase
            .from("quotes")
            .select("*, packages(name)")
            .eq("id", ev.quote_id)
            .maybeSingle();
          const ql: any = qLink ?? {};
          if (ql.total_value != null) totalVal = Number(ql.total_value);
          entryVal = ql.entry_value != null ? Number(ql.entry_value) : totalVal * 0.5;
          balanceVal = ql.balance_value != null ? Number(ql.balance_value) : totalVal - entryVal;
          const ext: any = ql.extras ?? {};
          const pkgSnap: any[] = Array.isArray(ext.packages) ? ext.packages : [];
          const unitSnap: any[] = Array.isArray(ext.unit_items) ? ext.unit_items : [];
          const adults = Number(ql.adults ?? ev.guest_count ?? 0) || 0;
          const pkgClean = dedupePackages(pkgSnap, unitSnap);

          let pkgTotal = 0;
          if (pkgClean.length) {
            evPacotes = pkgClean
              .map((p: any) => {
                const ppp = Number(p?.price_per_person ?? 0) || 0;
                const sub = ppp * adults;
                pkgTotal += sub;
                return `${p?.name ?? "Pacote"} — ${brl(ppp)}/pessoa × ${adults} = ${brl(sub)}`;
              })
              .join("\n");
          }

          const { text: uText, total: uTotal } = formatUnitItems(unitSnap);
          evItens = uText;
          evAcrescimos = getAdditionsText(ext, totalVal, pkgTotal, uTotal, ql);
        }

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
          valor: brl(totalVal),
          entrada: brl(entryVal),
          saldo: brl(balanceVal),
          pacote: ev.packages?.name ?? "—",
          pacotes: evPacotes,
          itens_unitarios: evItens,
          itens_adicionais: evItens,
          acrescimos: evAcrescimos,
          acrescimos_adicionais: evAcrescimos,
          acrescimo: evAcrescimos,
          taxas: evAcrescimos,
          descricao_pacote: ev.packages?.description ?? "",
          cardapio: ev.packages?.name ?? "—",
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
                {formatDateFullBR(q.event_date)} — {q.clients?.name ?? "Cliente sem nome"} — {brl(q.total_value ?? 0)}
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
                {formatDateFullBR(e.event_date)} — {e.clients?.name ?? "Cliente sem nome"} — {brl(e.total_value ?? 0)}
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

        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold">
              {tplDraft.trim() ? "Seu modelo (padrão para todos os contratos)" : "Nenhum modelo próprio — usando modelo padrão"}
            </p>
            <button
              type="button"
              onClick={() => setShowTpl((v) => !v)}
              className="h-8 px-3 rounded-lg border border-border text-[11px] font-bold whitespace-nowrap"
            >
              {showTpl ? "Fechar" : tplDraft.trim() ? "Editar modelo" : "Colar meu modelo"}
            </button>
          </div>

          {showTpl && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Cole seu contrato e use as variáveis onde quiser — elas são preenchidas com os dados reais do orçamento:{" "}
                {"{cliente}"}, {"{cpf_cliente}"}, {"{endereco_cliente}"}, {"{telefone_cliente}"}, {"{buffet}"},{" "}
                {"{endereco_buffet}"}, {"{telefone_buffet}"}, {"{data_evento}"}, {"{hora_evento}"}, {"{local_evento}"},{" "}
                {"{convidados}"}, {"{pacotes}"}, {"{itens_adicionais}"}, {"{acrescimos_adicionais}"}, {"{valor}"},{" "}
                {"{entrada}"}, {"{saldo}"}, {"{forma_pagamento}"}, {"{dados_pagamento}"}, {"{pix}"}, {"{data_hoje}"}.
              </p>
              <VariableInserter textareaRef={tplRef} value={tplDraft} onChange={setTplDraft} />
              <textarea
                ref={tplRef}
                rows={10}
                value={tplDraft}
                onChange={(e) => setTplDraft(e.target.value)}
                placeholder="Cole aqui o texto do seu contrato com as variáveis..."
                className="w-full min-h-[200px] p-3 border border-border rounded-lg bg-background font-mono text-[11px]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingTpl || !tplDraft.trim()}
                  onClick={() => saveTemplate(tplDraft.trim())}
                  className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                >
                  {savingTpl ? "Salvando..." : "Salvar como meu modelo padrão"}
                </button>
                <button
                  type="button"
                  disabled={savingTpl}
                  onClick={() => setTplDraft(DEFAULT_CONTRACT_TEMPLATE)}
                  className="h-9 px-3 rounded-lg border border-border text-xs font-bold disabled:opacity-50"
                >
                  Carregar modelo padrão como base
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {source === "blank"
            ? "O contrato usará o modelo salvo em Configurações (ou o padrão). Você poderá editar todo o texto em seguida."
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

    const watermarkHtml = freshLogo
      ? `<div class="watermark"><img src="${escapeHtml(freshLogo)}" alt="Marca d'água"/></div>`
      : "";
    const logoHtml = freshLogo
      ? `<div class="logo"><img id="__logo" src="${escapeHtml(freshLogo)}" alt="Logomarca"/></div>`
      : "";

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(contract.title)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.65; font-size: 12pt; margin: 0; position: relative; }
  .watermark { position: fixed; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-20deg); opacity: 0.07; width: 70%; text-align: center; pointer-events: none; z-index: 0; }
  .watermark img { max-width: 100%; max-height: 450px; object-fit: contain; }
  .logo { text-align: center; margin: 0 0 16px; position: relative; z-index: 1; }
  .logo img { max-height: 90px; max-width: 60%; object-fit: contain; }
  h1 { font-size: 16pt; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 20px; position: relative; z-index: 1; }
  .content { white-space: pre-wrap; text-align: justify; position: relative; z-index: 1; }
  .footer { margin-top: 28px; font-size: 10pt; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; position: relative; z-index: 1; }
  @media print { .no-print { display: none; } }
</style></head><body>
${watermarkHtml}
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
      className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-border">
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
        <div className="flex-1 overflow-auto bg-muted/40 p-2 sm:p-6">
          <div
            className="relative mx-auto max-w-[720px] bg-white text-neutral-900 shadow-lg rounded-md p-5 sm:p-12 overflow-hidden"
            style={{
              fontFamily: "'Cambria', 'Palatino Linotype', Georgia, serif",
              fontSize: "15px",
              lineHeight: 1.9,
              color: "#222",
            }}
          >
            {logo && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] pointer-events-none select-none -rotate-12 w-3/4 flex justify-center items-center z-0">
                <img src={logo} alt="Marca d'água" className="max-h-[400px] object-contain" />
              </div>
            )}

            {logo && (
              <div className="text-center mb-4 relative z-10">
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
            <h1 className="text-center text-xl font-bold uppercase tracking-wide mb-6 relative z-10">
              {contract.title}
            </h1>
            <div className="whitespace-pre-wrap text-justify relative z-10">{contract.content}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

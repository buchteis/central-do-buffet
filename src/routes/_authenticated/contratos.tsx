import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  FileText,
  Printer,
  Eye,
  Pencil,
  Trash2,
  Send,
  Search,
  FileCheck2,
  Clock3,
  CircleDollarSign,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateFullBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fillTemplate } from "@/lib/whatsapp";
import { useLogoDisplayUrl, getLogoDisplayUrl } from "@/lib/logo";
import { normalizeSearch, useSearchFilter } from "@/lib/search-store";
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

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Pendente",
  assinado: "Confirmado",
  cancelado: "Cancelado",
};

type ContractStatusFilter = "todos" | "ativos" | "pendentes" | "cancelados";

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
  const [statusFilter, setStatusFilter] = useState<ContractStatusFilter>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { match } = useSearchFilter();

  const { data: settings } = useQuery({
    queryKey: ["buffet-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("buffet_settings").select("*").maybeSingle();
      return data;
    },
  });

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select(
          "*, events(event_date, event_address, guest_count, total_value, clients(name, address, phone, whatsapp)), clients(name, address, phone, whatsapp)",
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
    )
    .filter((c: any) => {
      if (statusFilter === "ativos") return c.status === "assinado";
      if (statusFilter === "pendentes") return c.status === "rascunho" || c.status === "enviado";
      if (statusFilter === "cancelados") return c.status === "cancelado";
      return true;
    })
    .filter((c: any) => {
      const term = normalizeSearch(searchTerm);
      if (!term) return true;
      return [
        c.title,
        c.id,
        c.events?.clients?.name,
        c.clients?.name,
      ].some((value) => normalizeSearch(String(value ?? "")).includes(term));
    });

  const allContracts = contracts ?? [];
  const pendingCount = allContracts.filter(
    (c: any) => c.status === "rascunho" || c.status === "enviado",
  ).length;
  const signedCount = allContracts.filter((c: any) => c.status === "assinado").length;
  const totalValue = allContracts.reduce(
    (total: number, c: any) => total + Number(c.events?.total_value ?? 0),
    0,
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

  const sendContractByWhatsApp = async (contract: {
    id: string;
    signing_token?: string | null;
    status: string;
    events?: {
      clients?: { name?: string | null; phone?: string | null; whatsapp?: string | null } | null;
    } | null;
    clients?: { name?: string | null; phone?: string | null; whatsapp?: string | null } | null;
  }) => {
    const client = contract.events?.clients ?? contract.clients;
    const rawPhone = String(client?.whatsapp ?? "").trim() || String(client?.phone ?? "").trim();
    const digits = rawPhone.replace(/\D/g, "");
    const isInternational = rawPhone.startsWith("+");
    const phone = isInternational
      ? digits
      : digits.length === 10 || digits.length === 11
        ? `55${digits}`
        : digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
          ? digits
          : "";
    const validPhone = isInternational
      ? phone.length >= 11 && phone.length <= 15
      : phone.length === 12 || phone.length === 13;

    if (!validPhone) {
      toast.error("Cadastre um WhatsApp válido para este cliente.");
      return;
    }
    if (contract.status === "cancelado") {
      toast.error("Este contrato foi cancelado e não pode ser compartilhado.");
      return;
    }

    let link: string;
    try {
      let signingToken =
        typeof contract.signing_token === "string" && contract.signing_token.trim().length >= 32
          ? contract.signing_token.trim()
          : null;

      if (!signingToken) {
        const { data, error } = await supabase
          .from("contracts")
          .select("signing_token")
          .eq("id", contract.id)
          .single();
        if (error) throw error;
        signingToken = data.signing_token;
        if (!signingToken) throw new Error("O contrato não possui link de assinatura.");
      }

      // O link do cliente precisa ser o site publicado (o preview exige login).
      const origin = /id-preview--|lovableproject\.com|localhost/.test(window.location.host)
        ? "https://centraldobuffet.lovable.app"
        : window.location.origin;
      link = `${origin}/contrato-assinatura/${encodeURIComponent(signingToken)}`;
      const message =
        contract.status === "assinado"
          ? `Olá ${client?.name ?? ""}! Segue o link para consultar o seu contrato assinado: ${link}.`
          : `Olá ${client?.name ?? ""}! Segue o link para assinatura do seu contrato do evento: ${link}. Qualquer dúvida, estou à disposição!`;
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      // Abrir direto (sem about:blank) e sem opener: o WhatsApp bloqueia janelas ligadas ao app.
      const win = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        const a = document.createElement("a");
        a.href = whatsappUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }
    } catch (error) {
      const errorObject =
        error && typeof error === "object" ? (error as Record<string, unknown>) : null;
      const details =
        error instanceof Error
          ? error.message
          : typeof errorObject?.message === "string"
            ? errorObject.message
            : "";
      const errorCode = typeof errorObject?.code === "string" ? errorObject.code : "";
      const errorDetails =
        typeof errorObject?.details === "string" ? errorObject.details : "";
      const errorHint = typeof errorObject?.hint === "string" ? errorObject.hint : "";
      const missingTokenColumn =
        errorCode === "PGRST204" ||
        errorCode === "42703" ||
        (details.includes("signing_token") &&
          (details.toLowerCase().includes("column") ||
            details.toLowerCase().includes("schema cache")));
      console.error("Falha ao gerar link de assinatura:", {
        code: errorCode || null,
        message: details || null,
        details: errorDetails || null,
        hint: errorHint || null,
      });
      const diagnostic = [errorCode, details, errorDetails, errorHint]
        .filter(Boolean)
        .join(" — ");
      toast.error(
        missingTokenColumn
          ? "O Supabase API não reconhece signing_token. Confirme se o app está ligado ao mesmo projeto mostrado no SQL Editor; depois recarregue o esquema da API."
          : "Não foi possível gerar o link de assinatura.",
        diagnostic ? { description: diagnostic, duration: 15000 } : undefined,
      );
      return;
    }

    toast.success("Link de assinatura gerado. Confirme o envio no WhatsApp.", {
      description: link,
      duration: 15000,
    });

    if (contract.status === "rascunho") {
      const { error } = await supabase
        .from("contracts")
        .update({ status: "enviado" })
        .eq("id", contract.id);
      if (error) {
        toast.error("O WhatsApp foi aberto, mas não foi possível atualizar o status do contrato.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["contracts"] });
    }
  };

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
  const statusFilters: { key: ContractStatusFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "ativos", label: "Ativos" },
    { key: "pendentes", label: "Pendentes" },
    { key: "cancelados", label: "Cancelados" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Documentos e assinaturas
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Gestão de Contratos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe contratos, estados de assinatura e valores dos eventos.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 sm:self-auto"
        >
          <Plus className="size-4" /> Novo Contrato
        </button>
      </header>

      <section
        aria-label="Resumo de contratos"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: "Total de contratos",
            value: allContracts.length,
            icon: FileText,
            tone: "text-primary bg-primary/10",
          },
          {
            label: "Contratos ativos",
            value: signedCount,
            icon: FileCheck2,
            tone: "text-emerald-600 bg-emerald-500/10",
          },
          {
            label: "Pendentes de assinatura",
            value: pendingCount,
            icon: Clock3,
            tone: "text-amber-600 bg-amber-500/10",
          },
          {
            label: "Valor total",
            value: brl(totalValue),
            icon: CircleDollarSign,
            tone: "text-sky-600 bg-sky-500/10",
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  metric.tone,
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-0.5 truncate text-xl font-bold tracking-tight">{metric.value}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section
        className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
        aria-label="Filtros de contratos"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar por cliente ou número do contrato"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              aria-label="Pesquisar por cliente ou número do contrato"
            />
          </label>
          <div
            className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1"
            role="group"
            aria-label="Filtrar por estado"
          >
            {statusFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                aria-pressed={statusFilter === filter.key}
                className={cn(
                  "rounded-md px-3 py-2 text-xs font-semibold transition-colors",
                  statusFilter === filter.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Período:</span>
            <div className="flex flex-wrap gap-1">
              {CONTRACT_PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    period === p.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
              <span className="text-xs font-semibold text-destructive">
                {selectedIds.length} selecionado(s)
              </span>
              <button
                onClick={() => {
                  if (confirm(`Deseja excluir os ${selectedIds.length} contratos selecionados?`)) {
                    del.mutate(selectedIds);
                  }
                }}
                disabled={del.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" /> Excluir selecionados
              </button>
            </div>
          )}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        aria-label="Lista de contratos"
      >
        {isLoading ? (
          <div className="space-y-3 p-4 sm:p-5" aria-label="A carregar contratos">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex animate-pulse items-center gap-4 py-3">
                <div className="size-4 rounded bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="hidden h-4 w-32 rounded bg-muted sm:block" />
                <div className="h-6 w-20 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-7" />
            </div>
            <h2 className="text-base font-semibold">
              {allContracts.length === 0 ? "Ainda não há contratos" : "Nenhum contrato encontrado"}
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {allContracts.length === 0
                ? "Crie o seu primeiro contrato a partir de um orçamento, evento ou documento em branco."
                : "Experimente alterar a pesquisa, o estado ou o período selecionado."}
            </p>
            {allContracts.length === 0 && (
              <button
                onClick={() => setOpen(true)}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Plus className="size-4" /> Criar primeiro contrato
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(event) => handleSelectAll(event.target.checked)}
                      aria-label="Selecionar todos os contratos"
                      className="size-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </th>
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Data do evento</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
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
                        "transition-colors hover:bg-muted/30",
                        isSelected && "bg-primary/5 hover:bg-primary/10",
                      )}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(c.id)}
                          aria-label={`Selecionar contrato ${c.title}`}
                          className="size-4 cursor-pointer rounded border-border accent-primary"
                        />
                      </td>
                      <td className="max-w-[260px] px-4 py-4">
                        <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          #{String(c.id).slice(0, 8).toUpperCase()}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm">{clientName}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{eventDate}</td>
                      <td className="px-4 py-4 text-sm font-medium">
                        {c.events?.total_value != null ? brl(Number(c.events.total_value)) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            statusStyles[c.status] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {statusLabels[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewing(c)}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title="Visualizar contrato"
                            aria-label="Visualizar contrato"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            onClick={() => setPreviewing(c)}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                            title="Visualizar e gerar PDF"
                            aria-label="Visualizar e gerar PDF"
                          >
                            <Download className="size-4" />
                          </button>
                          <button
                            onClick={() => setEditing(c)}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                            title="Editar contrato"
                            aria-label="Editar contrato"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => void sendContractByWhatsApp(c)}
                            disabled={c.status === "cancelado"}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-emerald-700 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              c.status === "assinado"
                                ? "Compartilhar contrato assinado pelo WhatsApp"
                                : "Enviar link de assinatura pelo WhatsApp"
                            }
                            aria-label="Enviar contrato pelo WhatsApp"
                          >
                            <Send className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Deseja realmente excluir o contrato "${c.title}"?`)) {
                                del.mutate([c.id]);
                              }
                            }}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-destructive transition hover:bg-destructive/10"
                            title="Excluir contrato"
                            aria-label="Excluir contrato"
                          >
                            <Trash2 className="size-4" />
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
      </section>

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

function formatPackageItems(items: any[], guests: number): { text: string; total: number } {
  const list = (items ?? []).filter((item) => String(item?.name ?? "").trim());
  if (!list.length) return { text: "Nenhum pacote contratado", total: 0 };

  let total = 0;
  const text = list
    .map((item) => {
      const isFixed = String(item?.pricing_type ?? "per_person") === "fixed";
      const pricePerPerson = Number(item?.price_per_person ?? 0) || 0;
      const fixedPrice = Number(item?.price_fixed ?? 0) || 0;
      const packageTotal = isFixed ? fixedPrice : pricePerPerson * guests;
      total += packageTotal;

      if (isFixed) {
        return `${item.name} — preço fechado = ${brl(packageTotal)}`;
      }

      return `${item.name} — ${brl(pricePerPerson)}/pessoa × ${guests} = ${brl(packageTotal)}`;
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
        const qExtras: any = q.extras ?? {};
        const guests = Number(q.adults ?? 0) + Number(q.children_7_10 ?? 0) + Number(q.children_0_6 ?? 0);
        const pkgSnap: any[] = Array.isArray(qExtras.packages) ? qExtras.packages : [];
        const unitSnap: any[] = Array.isArray(qExtras.unit_items) ? qExtras.unit_items : [];
        const pkgNames = pkgSnap.map((p) => p?.name).filter(Boolean);
        const pacoteLabel = pkgNames.length ? pkgNames.join(", ") : (q.packages?.name ?? "");
        const { text: pacotesDetalhados, total: pkgTotal } = formatPackageItems(pkgSnap, guests);

        const { text: itensUnitariosDetalhados, total: unitTotal } = formatUnitItems(unitSnap);
        const totalVal = Number(q.total_value ?? 0);
        const acrescimosText = getAdditionsText(qExtras, totalVal, pkgTotal, unitTotal, q);

        const entryVal = Number(q.entry_value) > 0 ? Math.min(Number(q.entry_value), totalVal) : totalVal * 0.5;
        const balanceVal = Math.max(totalVal - entryVal, 0);

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
          pacotes: pkgSnap.length ? pacotesDetalhados : pacoteLabel,
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
          entryVal = Number(ql.entry_value) > 0 ? Math.min(Number(ql.entry_value), totalVal) : totalVal * 0.5;
          balanceVal = Math.max(totalVal - entryVal, 0);
          const ext: any = ql.extras ?? {};
          const pkgSnap: any[] = Array.isArray(ext.packages) ? ext.packages : [];
          const unitSnap: any[] = Array.isArray(ext.unit_items) ? ext.unit_items : [];
          const adults = Number(ql.adults ?? ev.guest_count ?? 0) || 0;
          const { text: packageText, total: pkgTotal } = formatPackageItems(pkgSnap, adults);
          if (pkgSnap.length) evPacotes = packageText;

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

  const isSigned = contract.status === "assinado";
  const signedAtBr = contract.signed_at
    ? new Date(contract.signed_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })
    : null;
  const signatureInfo = isSigned
    ? {
        nome: contract.signer_name ?? "—",
        cpf: contract.signer_cpf ?? "—",
        ip: contract.signer_ip ?? "—",
        navegador: contract.signer_user_agent ?? "—",
        dataHora: signedAtBr ?? "—",
      }
    : null;

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
${signatureInfo ? `<div class="signature">
  <h2>Registro de assinatura eletrônica</h2>
  <p><strong>Signatário:</strong> ${escapeHtml(signatureInfo.nome)}</p>
  <p><strong>CPF:</strong> ${escapeHtml(signatureInfo.cpf)}</p>
  <p><strong>Data e hora:</strong> ${escapeHtml(signatureInfo.dataHora)}</p>
  <p><strong>Endereço IP:</strong> ${escapeHtml(signatureInfo.ip)}</p>
  <p><strong>Navegador:</strong> ${escapeHtml(signatureInfo.navegador)}</p>
</div>` : ""}
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

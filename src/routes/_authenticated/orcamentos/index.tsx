import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  MessageCircle,
  Trash2,
  FileText,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Link2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { waLink, fillTemplate } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useGlobalSearch, normalizeSearch } from "@/lib/search-store";
import { openQuotePdf } from "@/lib/quote-pdf";
import { calcQuote } from "@/lib/quote-calc";
import { copyToClipboard } from "@/lib/clipboard";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useEffect } from "react";
import { PIPELINE, stageOfStatus, type StageId } from "@/lib/quote-pipeline";
import { QuoteKanban } from "@/components/orcamentos/QuoteKanban";
import { QuoteDetailModal } from "@/components/orcamentos/QuoteDetailModal";

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  head: () => ({ meta: [{ title: "Orçamentos — Central do Buffet" }] }),
  component: QuotesPage,
});

function whatsappMessage(q: any, settings?: { wa_quote_template?: string | null; pix_key?: string | null } | null) {
  const name = q.clients?.name?.split(" ")[0] ?? "tudo bem";
  const date = formatDateBR(q.event_date) ?? "a data definida";
  const pkg = quotePackagesLabel(q);
  const value = brl(q.total_value);
  const hora = (q.event_time ?? "").toString().slice(0, 5);
  const tpl = settings?.wa_quote_template?.trim();
  if (tpl) {
    return fillTemplate(tpl, {
      cliente: q.clients?.name ?? name,
      valor: value,
      data: date,
      hora,
      pix: settings?.pix_key ?? "",
      pacote: pkg,
    });
  }
  return `Olá, ${name}! Tudo bem? Aqui é do Central do Buffet. Estou entrando em contato sobre o orçamento do seu evento em ${date} (${pkg}). O investimento estimado é ${value}. Posso te passar mais detalhes?`;
}


// Retorna o label dos pacotes do orçamento: prioriza extras.packages (lista,
// pode ter 2, 3, 4...) e cai para a relação packages(name) (pacote único).
function quotePackagesLabel(q: any): string {
  const snap = (q?.extras as any)?.packages;
  if (Array.isArray(snap) && snap.length > 0) {
    return (
      snap
        .map((p: any) => p?.name)
        .filter(Boolean)
        .join(" + ") || "pacote escolhido"
    );
  }
  return q?.packages?.name ?? "pacote escolhido";
}

const pipeline = PIPELINE;
const stageOf = stageOfStatus;


type Period = "all" | "day" | "week" | "month" | "year";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function periodRange(p: Period, offset: number): { start: Date; end: Date; label: string } | null {
  if (p === "all") return null;
  const now = new Date();
  if (p === "day") {
    const start = startOfDay(now);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const label =
      offset === 0
        ? `Hoje · ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
        : start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    return { start, end, label };
  }
  if (p === "week") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - start.getDay() + offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const endLabel = new Date(end);
    endLabel.setDate(end.getDate() - 1);
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    return { start, end, label: `${fmt(start)} a ${fmt(endLabel)}` };
  }
  if (p === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
    const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { start, end, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }
  const start = new Date(now.getFullYear() + offset, 0, 1);
  const end = new Date(now.getFullYear() + offset + 1, 0, 1);
  return { start, end, label: String(start.getFullYear()) };
}

function parseEventDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00");
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function QuotesPage() {
  const [view, setView] = useState<"kanban" | "list">(() => {
    if (typeof window === "undefined") return "kanban";
    return (localStorage.getItem("orcamentos:view") as "kanban" | "list") ?? "kanban";
  });
  const [detail, setDetail] = useState<any | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orcamentos:view", view);
  }, [view]);
  const [period, setPeriod] = useState<Period>("all");
  const [offset, setOffset] = useState(0);
  const [archived, setArchived] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useGlobalSearch();
  const nq = normalizeSearch(search);
  const { data: access } = useTenantAccess();
  const slug = access?.tenant?.slug;
  const publicUrl = slug && typeof window !== "undefined" ? `${window.location.origin}/orcamento/${slug}` : "";

  const { data: settings } = useQuery({
    queryKey: ["buffet-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("buffet_settings").select("wa_quote_template, pix_key").maybeSingle();
      return data;
    },
  });

  const { data } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(name, phone, whatsapp, cpf, email, address, city), packages(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("quotes")
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
      toast.success("Etapa atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase
        .from("quotes")
        .update({ paid } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
      toast.success(vars.paid ? "Marcado como pago" : "Pagamento removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
      toast.success("Orçamento excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    const ch = supabase
      .channel("quotes-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => {
        qc.invalidateQueries({ queryKey: ["quotes"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const range = useMemo(() => periodRange(period, offset), [period, offset]);

  const effectiveView: "kanban" | "list" = archived ? "list" : view;

  const filtered = (data ?? []).filter((q: any) => {
    const stage = stageOf(q.status);
    if (effectiveView === "kanban") {
      // Kanban mostra todas as etapas (inclusive Fechado e Perdido).
    } else if (archived ? stage !== "fechado" : stage === "fechado" || stage === "perdido") {
      return false;
    }
    if (range) {
      const ref = parseEventDate(q.event_date);
      if (!ref || ref < range.start || ref >= range.end) return false;
    }
    if (nq) {
      const snapNames = Array.isArray((q.extras as any)?.packages)
        ? ((q.extras as any).packages as any[]).map((p) => p?.name)
        : [];
      const hay = normalizeSearch(
        [q.clients?.name, q.packages?.name, ...snapNames, q.event_type, q.event_address, q.notes]
          .filter(Boolean)
          .join(" "),
      );
      if (!hay.includes(nq)) return false;
    }
    return true;
  });

  const totalFilteredValue = filtered.reduce((s: number, q: any) => s + Number(q.total_value ?? 0), 0);


  async function handlePdf(q: any) {
    try {
      const { data: settings } = await supabase.from("buffet_settings").select("*").maybeSingle();
      const extras = (q.extras ?? {}) as any;
      const childPrice = Number(extras.child_price ?? 0);
      const priceOverride = extras.price_per_person_override != null ? Number(extras.price_per_person_override) : null;
      const pkgSnapshot = Array.isArray(extras.packages) ? extras.packages : [];
      const snapshotSum = pkgSnapshot.reduce((s: number, p: any) => s + Number(p?.price_per_person ?? 0), 0);
      const pricePerPerson = priceOverride ?? snapshotSum;
      const customExtras = Array.isArray(extras.custom) ? extras.custom : [];
      const unitItems = (Array.isArray(extras.unit_items) ? extras.unit_items : []).map((i: any) => ({
        name: i?.name ?? "Item unitário",
        unit: i?.unit ?? "un",
        unit_price: Number(i?.unit_price ?? 0) || 0,
        qty: Number(i?.qty ?? 0) || 0,
      }));
      const adults = Number(q.adults ?? 0);
      const childrenCount = Number(q.children_7_10 ?? 0) + Number(q.children_0_6 ?? 0);
      const breakdown = calcQuote({
        pricePerPerson,
        adults,
        childrenCount,
        childPrice,
        customExtras,
        unitItems,
      });
      if (extras.entry_override != null) {
        breakdown.entry = Number(extras.entry_override);
        breakdown.balance = Math.round((breakdown.total - breakdown.entry) * 100) / 100;
      }
      if (extras.balance_override != null) {
        breakdown.balance = Number(extras.balance_override);
      }
      await openQuotePdf({
        issuedAt: q.created_at ? new Date(q.created_at) : new Date(),
        validUntil: q.valid_until ?? null,
        client: q.clients
          ? {
              name: q.clients.name,
              cpf: q.clients.cpf,
              address: q.clients.address,
              phone: q.clients.whatsapp ?? q.clients.phone,
              email: q.clients.email,
            }
          : null,
        event: {
          date: q.event_date,
          time: q.event_time,
          address: q.event_address,
          type: q.event_type,
          adults,
          childrenCount,
        },
        package:
          pkgSnapshot.length || q.packages ? { name: quotePackagesLabel(q), pricePerPerson } : null,
        packages: pkgSnapshot.map((p: any) => ({
          name: p?.name,
          price_per_person: Number(p?.price_per_person ?? 0) || 0,
        })),
        unitItems,
        childPrice,
        extras: customExtras,
        breakdown,
        paymentMethod: q.payment_method,
        notes: q.notes,
        hasGrill: !!q.has_grill,
        hasFreezer: !!q.has_freezer,
        buffet: (settings as any) ?? null,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao gerar PDF");
    }
  }

  function confirmDelete(id: string) {
    if (confirm("Tem certeza que deseja excluir este orçamento?")) {
      remove.mutate(id);
    }
  }

  function openEdit(q: any) {
    const leadId = (q as any).lead_id;
    if (leadId) {
      navigate({ to: "/orcamentos/novo", search: { leadId } as any });
    } else {
      navigate({ to: "/orcamentos/novo", search: { quoteId: q.id } as any });
    }
  }

  const periods: { id: Period; label: string }[] = [
    { id: "all", label: "Tudo" },
    { id: "day", label: "Dia" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mês" },
    { id: "year", label: "Ano" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} orçamento(s) · {brl(totalFilteredValue)}
            {nq && <span className="ml-2 text-primary">· filtrando por "{search}"</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-muted rounded-full p-1">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPeriod(p.id);
                  setOffset(0);
                  setArchived(false);
                }}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full",
                  !archived && period === p.id && "bg-background shadow",
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setArchived(true)}
              className={cn("px-3 py-1 text-xs font-bold rounded-full", archived && "bg-background shadow")}
              title="Ver histórico de orçamentos fechados"
            >
              Fechados
            </button>
          </div>
          {!archived && (
            <div className="flex bg-muted rounded-full p-1">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1",
                  view === "kanban" && "bg-background shadow",
                )}
              >
                <LayoutGrid className="size-3" /> Pipeline
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1",
                  view === "list" && "bg-background shadow",
                )}
              >
                <List className="size-3" /> Lista
              </button>
            </div>
          )}
          {publicUrl && (
            <button
              onClick={async () => {
                const ok = await copyToClipboard(publicUrl);
                if (ok) toast.success("Link do formulário copiado!");
                else toast.error("Não foi possível copiar. Copie manualmente.");
              }}
              title={publicUrl}
              className="inline-flex items-center gap-1 h-9 px-4 rounded-full border border-border bg-background text-xs font-bold hover:bg-accent"
            >
              <Link2 className="size-4" /> Copiar link do formulário
            </button>
          )}
          <Link
            to="/orcamentos/novo"
            search={{ leadId: undefined, quoteId: undefined }}
            className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20"
          >
            <Plus className="size-4" /> Novo
          </Link>
        </div>
      </div>

      {period !== "all" && (
        <div className="flex items-center justify-center gap-2 sm:gap-3 bg-muted/30 border border-border rounded-full px-3 sm:px-4 py-2 max-w-full w-fit mx-auto">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="p-1 rounded-full hover:bg-background transition"
            title="Anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="text-sm font-bold min-w-0 sm:min-w-[180px] text-center truncate">{range?.label ?? "—"}</div>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="p-1 rounded-full hover:bg-background transition"
            title="Próximo"
          >
            <ChevronRight className="size-4" />
          </button>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="text-[10px] font-bold uppercase text-primary ml-2">
              Hoje
            </button>
          )}
        </div>
      )}

      {effectiveView === "kanban" ? (
        <QuoteKanban
          quotes={filtered}
          onOpen={(q) => setDetail(q)}
          onMove={(q, stage) => {
            const target = pipeline.find((c) => c.id === stage);
            if (target) move.mutate({ id: q.id, status: target.status });
          }}
        />

      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-5 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Data</th>
                <th className="px-4 py-3 font-bold">Pacote</th>
                <th className="px-4 py-3 font-bold text-right">Total</th>
                <th className="px-4 py-3 font-bold">Etapa</th>
                <th className="px-4 py-3 font-bold text-center">Pago</th>
                <th className="px-4 py-3 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((q: any) => {
                const stage = pipeline.find((s) => s.id === stageOf(q.status));
                const requester = (q.extras as any)?.requester ?? {};
                const displayName = q.clients?.name ?? requester.name ?? "—";
                const phone = q.clients?.whatsapp ?? q.clients?.phone ?? requester.whatsapp;
                return (
                  <tr key={q.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4 text-sm font-semibold">{displayName}</td>
                    <td className="px-4 py-4 text-xs font-mono">{formatDateBR(q.event_date)}</td>
                    <td className="px-4 py-4 text-xs">{quotePackagesLabel(q)}</td>
                    <td className="px-4 py-4 text-sm font-mono text-right">{brl(q.total_value)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={cn("px-2 py-1 text-[10px] rounded-full font-bold uppercase border", stage?.tone)}
                      >
                        {stage?.label ?? q.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {stageOf(q.status) === "fechado" ? (
                        <button
                          onClick={() => togglePaid.mutate({ id: q.id, paid: !q.paid })}
                          title={q.paid ? "Marcar como não pago" : "Marcar como pago"}
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border transition",
                            q.paid
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-background text-muted-foreground border-border hover:border-emerald-500 hover:text-emerald-600",
                          )}
                        >
                          {q.paid ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
                          {q.paid ? "Pago" : "Marcar"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {phone && (
                          <a
                            href={waLink(phone, whatsappMessage(q, settings))}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            className="p-2 text-emerald-600 hover:bg-emerald-500/10 rounded-md"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handlePdf(q)}
                          title="Gerar PDF"
                          className="p-2 text-primary hover:bg-primary/10 rounded-md"
                        >
                          <FileText className="size-4" />
                        </button>
                        <button
                          onClick={() => openEdit(q)}
                          title="Abrir/Completar orçamento"
                          className="p-2 text-foreground hover:bg-accent rounded-md"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete(q.id)}
                          title="Excluir orçamento"
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum orçamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

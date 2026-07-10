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
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useGlobalSearch, normalizeSearch } from "@/lib/search-store";
import { openQuotePdf } from "@/lib/quote-pdf";
import { calcQuote } from "@/lib/quote-calc";
import { copyToClipboard } from "@/lib/clipboard";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  head: () => ({ meta: [{ title: "Orçamentos — Meu Churras" }] }),
  component: QuotesPage,
});

function whatsappMessage(q: any) {
  const name = q.clients?.name?.split(" ")[0] ?? "tudo bem";
  const date = formatDateBR(q.event_date) ?? "a data definida";
  const pkg = q.packages?.name ?? "pacote escolhido";
  const value = brl(q.total_value);
  return `Olá, ${name}! Tudo bem? Aqui é do Meu Churras. Estou entrando em contato sobre o orçamento do seu evento em ${date} (${pkg}). O investimento estimado é ${value}. Posso te passar mais detalhes?`;
}

type Stage = "novo" | "em_andamento" | "fechado";
const pipeline: { id: Stage; label: string; tone: string }[] = [
  { id: "novo", label: "Novo", tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { id: "em_andamento", label: "Em andamento", tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "fechado", label: "Fechado", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
];
function stageOf(status: string): Stage {
  if (status === "fechado" || status === "aprovado") return "fechado";
  if (status === "novo") return "novo";
  return "em_andamento";
}


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
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [period, setPeriod] = useState<Period>("all");
  const [offset, setOffset] = useState(0);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useGlobalSearch();
  const nq = normalizeSearch(search);
  const { data: access } = useTenantAccess();
  const slug = access?.tenant?.slug;
  const publicUrl =
    slug && typeof window !== "undefined" ? `${window.location.origin}/orcamento/${slug}` : "";

  const { data } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(name, phone, whatsapp, cpf, email, address), packages(name, price_per_person)")
        .neq("status", "cancelado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quotes").update({ status: status as any }).eq("id", id);
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
      const { error } = await supabase.from("quotes").update({ paid } as any).eq("id", id);
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

  const filtered = (data ?? []).filter((q: any) => {
    if (range) {
      const ref = parseEventDate(q.event_date);
      if (!ref || ref < range.start || ref >= range.end) return false;
    }
    if (nq) {
      const hay = normalizeSearch(
        [q.clients?.name, q.packages?.name, q.event_type, q.event_address, q.notes]
          .filter(Boolean)
          .join(" "),
      );
      if (!hay.includes(nq)) return false;
    }
    return true;
  });

  const byStage = new Map<string, any[]>();
  pipeline.forEach((s) => byStage.set(s.id, []));
  filtered.forEach((q: any) => byStage.get(stageOf(q.status))!.push(q));

  const totalFilteredValue = filtered.reduce((s, q: any) => s + Number(q.total_value ?? 0), 0);

  async function handlePdf(q: any) {
    try {
      const { data: settings } = await supabase.from("buffet_settings").select("*").maybeSingle();
      const extras = (q.extras ?? {}) as any;
      const childPrice = Number(extras.child_price ?? 0);
      const priceOverride =
        extras.price_per_person_override != null ? Number(extras.price_per_person_override) : null;
      const pricePerPerson = priceOverride ?? Number(q.packages?.price_per_person ?? 0);
      const customExtras = Array.isArray(extras.custom) ? extras.custom : [];
      const adults = Number(q.adults ?? 0);
      const childrenCount = Number(q.children_7_10 ?? 0) + Number(q.children_0_6 ?? 0);
      const breakdown = calcQuote({
        pricePerPerson,
        adults,
        childrenCount,
        childPrice,
        customExtras,
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
        package: q.packages ? { name: q.packages.name, pricePerPerson } : null,
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
      navigate({ to: "/orcamentos/novo" });
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
                }}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full",
                  period === p.id && "bg-background shadow",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
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
            className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20"
          >
            <Plus className="size-4" /> Novo
          </Link>
        </div>
      </div>

      {period !== "all" && (
        <div className="flex items-center justify-center gap-3 bg-muted/30 border border-border rounded-full px-4 py-2 w-fit mx-auto">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="p-1 rounded-full hover:bg-background transition"
            title="Anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="text-sm font-bold min-w-[180px] text-center">
            {range?.label ?? "—"}
          </div>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="p-1 rounded-full hover:bg-background transition"
            title="Próximo"
          >
            <ChevronRight className="size-4" />
          </button>
          {offset !== 0 && (
            <button
              onClick={() => setOffset(0)}
              className="text-[10px] font-bold uppercase text-primary ml-2"
            >
              Hoje
            </button>
          )}
        </div>
      )}

      {view === "kanban" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {pipeline.map((stage) => {
              const items = byStage.get(stage.id) ?? [];
              const total = items.reduce((s, q) => s + Number(q.total_value ?? 0), 0);
              return (
                <div
                  key={stage.id}
                  className="w-80 shrink-0 bg-muted/30 rounded-2xl border border-border flex flex-col max-h-[75vh]"
                >
                  <div className="p-3 border-b border-border">
                    <div
                      className={cn(
                        "inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border",
                        stage.tone,
                      )}
                    >
                      {stage.label}
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{items.length} orçamento(s)</span>
                      <span className="font-mono">{brl(total)}</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {items.map((q: any) => {
                      const phone = q.clients?.whatsapp ?? q.clients?.phone;
                      return (
                        <div
                          key={q.id}
                          className="bg-card border border-border rounded-xl p-3 shadow-sm hover:border-primary/40 transition-colors"
                        >
                          <div className="font-semibold text-sm truncate">
                            {q.clients?.name ?? "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {q.packages?.name ?? "Sem pacote"} · {formatDateBR(q.event_date)}
                          </div>
                          <div className="font-mono font-bold text-sm mt-1">
                            {brl(q.total_value)}
                          </div>
                          <select
                            value={stageOf(q.status)}
                            onChange={(e) => move.mutate({ id: q.id, status: e.target.value })}
                            className="mt-2 w-full text-[11px] border border-border rounded-md bg-background px-2 py-1"
                          >
                            {pipeline.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>

                          <div className="mt-2 flex items-center gap-1">
                            {phone && (
                              <a
                                href={waLink(phone, whatsappMessage(q))}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-bold border border-border rounded-md py-1.5 text-emerald-600 hover:bg-emerald-500/10"
                              >
                                <MessageCircle className="size-3" /> WhatsApp
                              </a>
                            )}
                            <button
                              onClick={() => handlePdf(q)}
                              title="Gerar PDF"
                              className="p-1.5 border border-border rounded-md text-primary hover:bg-primary/10"
                            >
                              <FileText className="size-3.5" />
                            </button>
                            <button
                              onClick={() => openEdit(q)}
                              title="Abrir/Completar orçamento"
                              className="p-1.5 border border-border rounded-md text-foreground hover:bg-accent"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => confirmDelete(q.id)}
                              title="Excluir orçamento"
                              className="p-1.5 border border-border rounded-md text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="text-[11px] text-muted-foreground text-center py-4">
                        Vazio
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
                <th className="px-4 py-3 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((q: any) => {
                const stage = pipeline.find((s) => s.id === stageOf(q.status));
                const phone = q.clients?.whatsapp ?? q.clients?.phone;
                return (
                  <tr key={q.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4 text-sm font-semibold">
                      {q.clients?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-xs font-mono">
                      {formatDateBR(q.event_date)}
                    </td>
                    <td className="px-4 py-4 text-xs">{q.packages?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-sm font-mono text-right">
                      {brl(q.total_value)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "px-2 py-1 text-[10px] rounded-full font-bold uppercase border",
                          stage?.tone,
                        )}
                      >
                        {stage?.label ?? q.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {phone && (
                          <a
                            href={waLink(phone, whatsappMessage(q))}
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
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
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

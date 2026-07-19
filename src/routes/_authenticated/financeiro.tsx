import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Construction,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Meu Churras" }] }),
  component: FinanceiroPage,
});

export function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{hint}</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-16 text-center">
        <Construction className="size-8 mx-auto text-muted-foreground mb-3" />
        <div className="text-sm font-semibold">Em construção</div>
        <div className="text-xs text-muted-foreground mt-1">Este módulo está previsto para a próxima fase.</div>
      </div>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  pendente: "bg-amber-500/20 text-amber-800 border-amber-300",
  pago: "bg-emerald-500/20 text-emerald-800 border-emerald-300",
  atrasado: "bg-rose-500/20 text-rose-800 border-rose-300",
  cancelado: "bg-muted text-muted-foreground border-border",
};

type PeriodFilter = "todos" | "dia" | "semana" | "mes" | "ano";

function FinanceiroPage() {
  const qc = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [filter, setFilter] = useState<"todos" | "entrada" | "saida">("todos");
  const [period, setPeriod] = useState<PeriodFilter>("todos");

  const { data: txs } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, events(status, clients(name))")
        .order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  // Atualização rápida de status direto pela tabela
  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status, due_date }: { id: string; status: string; due_date: string }) => {
      const cleanStatus = status.toLowerCase();
      const { error } = await supabase
        .from("transactions")
        .update({
          status: cleanStatus as any,
          paid_date: cleanStatus === "pago" ? due_date : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(`Erro ao atualizar status: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transação excluída com sucesso");
    },
    onError: (e: any) => toast.error(`Erro ao excluir: ${e.message}`),
  });

  const handleDelete = (id: string, description: string) => {
    if (confirm(`Tem certeza que deseja excluir "${description}"?`)) {
      deleteMut.mutate(id);
    }
  };

  const handleEdit = (tx: any) => {
    setEditingTx(tx);
    setOpenDialog(true);
  };

  const handleNew = () => {
    setEditingTx(null);
    setOpenDialog(true);
  };

  const active = (txs ?? []).filter(
    (t: any) => t.events?.status !== "cancelado" && String(t.status).toLowerCase() !== "cancelado",
  );

  // Filtro Temporal por Data
  const filterByPeriod = (t: any) => {
    if (period === "todos") return true;
    if (!t.due_date) return false;

    const txDate = new Date(t.due_date + "T00:00:00");
    const now = new Date();

    if (period === "dia") {
      return (
        txDate.getDate() === now.getDate() &&
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      );
    }

    if (period === "semana") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return txDate >= startOfWeek && txDate <= endOfWeek;
    }

    if (period === "mes") {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }

    if (period === "ano") {
      return txDate.getFullYear() === now.getFullYear();
    }

    return true;
  };

  const periodFiltered = active.filter(filterByPeriod);
  const filtered = periodFiltered.filter((t) => (filter === "todos" ? true : t.type === filter));

  // Totais Recalculados
  const totals = periodFiltered.reduce(
    (acc, t) => {
      const v = Number(t.amount ?? 0);
      const st = String(t.status ?? "").toLowerCase();
      if (t.type === "entrada" && st === "pago") acc.entradas += v;
      if (t.type === "saida" && st === "pago") acc.saidas += v;
      if (st === "pendente") {
        acc.pendentes += t.type === "entrada" ? v : -v;
      }
      return acc;
    },
    { entradas: 0, saidas: 0, pendentes: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Fluxo de caixa, contas a pagar e a receber</p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90"
        >
          <Plus className="size-4" /> Nova transação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card icon={TrendingUp} label="Entradas (pagas)" value={brl(totals.entradas)} tone="emerald" />
        <Card icon={TrendingDown} label="Saídas (pagas)" value={brl(totals.saidas)} tone="rose" />
        <Card icon={Wallet} label="Saldo" value={brl(totals.entradas - totals.saidas)} tone="primary" />
        <Card icon={Wallet} label="Pendente Líquido" value={brl(totals.pendentes)} tone="amber" />
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
        <div className="flex gap-2">
          {(["todos", "entrada", "saida"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-full border transition-colors",
                filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
              )}
            >
              {f === "todos" ? "Todos" : f === "entrada" ? "Entradas" : "Saídas"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border">
          <Calendar className="size-3.5 ml-2 text-muted-foreground" />
          {(["todos", "dia", "semana", "mes", "ano"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full capitalize transition-colors",
                period === p
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p === "todos" ? "Tudo" : p === "mes" ? "Mês" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
              <th className="px-5 py-3 font-bold">Descrição</th>
              <th className="px-4 py-3 font-bold">Vencimento</th>
              <th className="px-4 py-3 font-bold">Método</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold text-right">Valor</th>
              <th className="px-4 py-3 font-bold text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t: any) => {
              const currentStatus = String(t.status ?? "pendente").toLowerCase();
              return (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="text-sm font-semibold">{t.description}</div>
                    {t.events?.clients?.name && (
                      <div className="text-[11px] text-muted-foreground">{t.events.clients.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs font-mono">{formatDateBR(t.due_date)}</td>
                  <td className="px-4 py-4 text-xs uppercase">{t.method}</td>

                  {/* Alteração rápida de Status com seletor robusto */}
                  <td className="px-4 py-4">
                    <select
                      value={currentStatus}
                      onChange={(e) =>
                        updateStatusMut.mutate({ id: t.id, status: e.target.value, due_date: t.due_date })
                      }
                      className={cn(
                        "px-2 py-1 text-[10px] rounded-full font-bold uppercase border cursor-pointer outline-none transition-all",
                        statusStyles[currentStatus] || statusStyles.pendente,
                      )}
                    >
                      <option value="pendente" className="bg-background text-foreground">
                        PENDENTE
                      </option>
                      <option value="pago" className="bg-background text-foreground">
                        PAGO
                      </option>
                      <option value="atrasado" className="bg-background text-foreground">
                        ATRASADO
                      </option>
                      <option value="cancelado" className="bg-background text-foreground">
                        CANCELADO
                      </option>
                    </select>
                  </td>

                  <td
                    className={cn(
                      "px-4 py-4 text-sm font-mono text-right font-bold",
                      t.type === "entrada" ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {t.type === "entrada" ? "+" : "-"} {brl(t.amount)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(t)}
                        title="Editar"
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.description)}
                        title="Excluir"
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600"
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
                <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">
                  Nenhuma transação registrada neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openDialog && <TxDialog initialData={editingTx} onClose={() => setOpenDialog(false)} />}
    </div>
  );
}

function Card({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    primary: "text-primary",
    amber: "text-amber-600",
  };
  return (
    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon className={cn("size-4", tones[tone])} />
      </div>
      <div className={cn("mt-2 text-2xl font-extrabold tracking-tighter", tones[tone])}>{value}</div>
    </div>
  );
}

function TxDialog({ initialData, onClose }: { initialData?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const todayLocal = new Date().toLocaleDateString("sv-SE");

  const [form, setForm] = useState({
    type: "entrada" as "entrada" | "saida",
    description: "",
    amount: "",
    method: "pix",
    status: "pendente",
    due_date: todayLocal,
    category: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        type: initialData.type ?? "entrada",
        description: initialData.description ?? "",
        amount: initialData.amount ? String(initialData.amount) : "",
        method: String(initialData.method ?? "pix").toLowerCase(),
        status: String(initialData.status ?? "pendente").toLowerCase(),
        due_date: initialData.due_date ?? todayLocal,
        category: initialData.category ?? "",
      });
    } else {
      setForm({
        type: "entrada",
        description: "",
        amount: "",
        method: "pix",
        status: "pendente",
        due_date: todayLocal,
        category: "",
      });
    }
  }, [initialData]);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão ativa");

      const cleanStatus = form.status.toLowerCase();

      const payload = {
        owner_id: u.user.id,
        type: form.type as any,
        description: form.description,
        amount: Number(form.amount || 0),
        method: form.method.toLowerCase() as any,
        status: cleanStatus as any,
        due_date: form.due_date,
        category: form.category || null,
        paid_date: cleanStatus === "pago" ? form.due_date : null,
      };

      if (initialData?.id) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(initialData?.id ? "Transação atualizada" : "Transação registrada");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <h3 className="text-lg font-extrabold">{initialData?.id ? "Editar transação" : "Nova transação"}</h3>

        {/* Seleção do Tipo */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: "entrada" }))}
            className={cn(
              "h-10 rounded-lg text-sm font-bold border transition-colors",
              form.type === "entrada" ? "bg-emerald-500 text-white border-emerald-500" : "border-border",
            )}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: "saida" }))}
            className={cn(
              "h-10 rounded-lg text-sm font-bold border transition-colors",
              form.type === "saida" ? "bg-rose-500 text-white border-rose-500" : "border-border",
            )}
          >
            Saída
          </button>
        </div>

        <input
          placeholder="Descrição"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm outline-none focus:border-primary"
        />
        <input
          placeholder="Categoria (ex: Carnes, Bebidas)"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm outline-none focus:border-primary"
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Valor"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="h-10 px-3 border border-border rounded-lg bg-background text-sm outline-none focus:border-primary"
          />
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="h-10 px-3 border border-border rounded-lg bg-background text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Método de Pagamento */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Forma de Pagamento</label>
          <select
            value={form.method}
            onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value.toLowerCase() }))}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm cursor-pointer outline-none focus:border-primary"
          >
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao">Cartão</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        {/* Seleção de Status Interativa (Pendente x Pago) */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1.5 block">
            Status da Transação
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, status: "pendente" }))}
              className={cn(
                "h-10 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all",
                form.status === "pendente"
                  ? "bg-amber-500 text-white border-amber-500 shadow-md"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <Clock className="size-4" /> Pendente
            </button>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, status: "pago" }))}
              className={cn(
                "h-10 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all",
                form.status === "pago"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <CheckCircle2 className="size-4" /> Pago
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-border text-sm font-bold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!form.description || !form.amount || mut.isPending}
            onClick={() => mut.mutate()}
            className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

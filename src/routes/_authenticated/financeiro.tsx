import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, Wallet, Construction } from "lucide-react";
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
  pendente: "bg-amber-500/10 text-amber-700",
  pago: "bg-emerald-500/10 text-emerald-700",
  atrasado: "bg-rose-500/10 text-rose-700",
  cancelado: "bg-muted text-muted-foreground",
};

function FinanceiroPage() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"todos" | "entrada" | "saida">("todos");

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

  // Exclui transações vinculadas a eventos cancelados (não entram em contagem nem lista)
  const active = (txs ?? []).filter((t: any) => t.events?.status !== "cancelado" && t.status !== "cancelado");

  const filtered = active.filter((t) => filter === "todos" ? true : t.type === filter);

  const totals = active.reduce(
    (acc, t) => {
      const v = Number(t.amount ?? 0);
      if (t.type === "entrada" && t.status === "pago") acc.entradas += v;
      if (t.type === "saida" && t.status === "pago") acc.saidas += v;
      if (t.status === "pendente") acc.pendentes += v;
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
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20">
          <Plus className="size-4" /> Nova transação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card icon={TrendingUp} label="Entradas (pagas)" value={brl(totals.entradas)} tone="emerald" />
        <Card icon={TrendingDown} label="Saídas (pagas)" value={brl(totals.saidas)} tone="rose" />
        <Card icon={Wallet} label="Saldo" value={brl(totals.entradas - totals.saidas)} tone="primary" />
        <Card icon={Wallet} label="Pendente" value={brl(totals.pendentes)} tone="amber" />
      </div>

      <div className="flex gap-2">
        {(["todos","entrada","saida"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 text-xs font-bold rounded-full border", filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
            {f === "todos" ? "Todos" : f === "entrada" ? "Entradas" : "Saídas"}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
              <th className="px-5 py-3 font-bold">Descrição</th>
              <th className="px-4 py-3 font-bold">Vencimento</th>
              <th className="px-4 py-3 font-bold">Método</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t: any) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="px-5 py-4">
                  <div className="text-sm font-semibold">{t.description}</div>
                  {t.events?.clients?.name && <div className="text-[11px] text-muted-foreground">{t.events.clients.name}</div>}
                </td>
                <td className="px-4 py-4 text-xs font-mono">{formatDateBR(t.due_date)}</td>
                <td className="px-4 py-4 text-xs uppercase">{t.method}</td>
                <td className="px-4 py-4">
                  <span className={cn("px-2 py-1 text-[10px] rounded-full font-bold uppercase", statusStyles[t.status])}>{t.status}</span>
                </td>
                <td className={cn("px-4 py-4 text-sm font-mono text-right font-bold", t.type === "entrada" ? "text-emerald-600" : "text-rose-600")}>
                  {t.type === "entrada" ? "+" : "-"} {brl(t.amount)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center text-sm text-muted-foreground">Nenhuma transação registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <NewTxDialog onClose={() => setOpen(false)} />}
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

function NewTxDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: "entrada" as "entrada" | "saida",
    description: "",
    amount: "",
    method: "pix",
    status: "pendente",
    due_date: new Date().toISOString().slice(0, 10),
    category: "",
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.from("transactions").insert({
        owner_id: u.user.id,
        type: form.type as any,
        description: form.description,
        amount: Number(form.amount || 0),
        method: form.method as any,
        status: form.status as any,
        due_date: form.due_date,
        category: form.category || null,
        paid_date: form.status === "pago" ? form.due_date : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transação registrada");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-3">
        <h3 className="text-lg font-extrabold">Nova transação</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setForm({ ...form, type: "entrada" })} className={cn("h-10 rounded-lg text-sm font-bold border", form.type === "entrada" ? "bg-emerald-500 text-white border-emerald-500" : "border-border")}>Entrada</button>
          <button onClick={() => setForm({ ...form, type: "saida" })} className={cn("h-10 rounded-lg text-sm font-bold border", form.type === "saida" ? "bg-rose-500 text-white border-rose-500" : "border-border")}>Saída</button>
        </div>
        <input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        <input placeholder="Categoria (ex: Carnes, Bebidas)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" placeholder="Valor" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-10 px-3 border border-border rounded-lg bg-background text-sm" />
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="h-10 px-3 border border-border rounded-lg bg-background text-sm">
            <option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="outro">Outro</option>
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 px-3 border border-border rounded-lg bg-background text-sm">
            <option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option><option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-border text-sm font-bold">Cancelar</button>
          <button disabled={!form.description || !form.amount || mut.isPending} onClick={() => mut.mutate()} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

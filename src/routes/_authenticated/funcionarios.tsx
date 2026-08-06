import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, UserCog, Trash2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSearchFilter } from "@/lib/search-store";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — Central do Buffet" }] }),
  component: FuncionariosPage,
});

const roles = ["churrasqueiro","garçom","auxiliar","copeira","motorista","gerente","outro"];

function FuncionariosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const { match } = useSearchFilter();

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("*, event_staff(id, events(event_date))").order("name");
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Funcionário removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Funcionários</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees?.length ?? 0} funcionário(s) · Escala com detecção de conflito</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAssignOpen(true)} className="inline-flex items-center gap-1 h-9 px-4 rounded-full border border-border text-xs font-bold">
            Escalar em evento
          </button>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20">
            <Plus className="size-4" /> Novo funcionário
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {employees?.length === 0 ? (
          <div className="p-16 text-center">
            <UserCog className="size-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm font-semibold">Nenhum funcionário cadastrado</div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-5 py-3 font-bold">Nome</th>
                <th className="px-4 py-3 font-bold">Cargo</th>
                <th className="px-4 py-3 font-bold">Telefone</th>
                <th className="px-4 py-3 font-bold">Chave PIX</th>
                <th className="px-4 py-3 font-bold text-right">Diária</th>
                <th className="px-4 py-3 font-bold text-right">Eventos</th>
                <th className="px-4 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(employees ?? [])
                .filter((e: any) => match(e.name, e.role, e.phone, e.pix, e.notes))
                .map((e: any) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4 text-sm font-semibold">{e.name}</td>
                  <td className="px-4 py-4 text-xs uppercase">{e.role}</td>
                  <td className="px-4 py-4 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span>{e.phone ?? "—"}</span>
                      {e.phone && (
                        <a
                          href={`https://wa.me/${String(e.phone).replace(/\D/g, "").replace(/^(?!55)/, "55")}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Enviar WhatsApp"
                          className="inline-flex items-center justify-center size-7 rounded-full bg-success/10 text-success hover:bg-success/20"
                        >
                          <MessageCircle className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs font-mono">{e.pix || "—"}</td>
                  <td className="px-4 py-4 text-sm font-mono text-right">{brl(e.daily_rate)}</td>
                  <td className="px-4 py-4 text-xs text-right">{e.event_staff?.length ?? 0}</td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => { if (confirm(`Remover ${e.name}?`)) del.mutate(e.id); }} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && <NewEmployeeDialog onClose={() => setOpen(false)} />}
      {assignOpen && <AssignDialog onClose={() => setAssignOpen(false)} employees={employees ?? []} />}
    </div>
  );
}

function NewEmployeeDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", role: "churrasqueiro", phone: "", pix: "", daily_rate: "" });
  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.from("employees").insert({ ...f, owner_id: u.user.id, daily_rate: Number(f.daily_rate || 0) });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Funcionário adicionado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-3">
        <h3 className="text-lg font-extrabold">Novo funcionário</h3>
        <input placeholder="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm capitalize">
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input placeholder="Telefone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        <input placeholder="Chave PIX" value={f.pix} onChange={(e) => setF({ ...f, pix: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        <input type="number" placeholder="Valor da diária" value={f.daily_rate} onChange={(e) => setF({ ...f, daily_rate: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-border text-sm font-bold">Cancelar</button>
          <button disabled={!f.name || mut.isPending} onClick={() => mut.mutate()} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function AssignDialog({ onClose, employees }: { onClose: () => void; employees: any[] }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ event_id: "", employee_id: "", role: "churrasqueiro", amount: "" });
  const { data: events } = useQuery({
    queryKey: ["events-for-assign"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("events").select("id, event_date, clients(name)").gte("event_date", today).order("event_date").limit(50);
      return data ?? [];
    },
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const emp = employees.find((e) => e.id === f.employee_id);
      const { error } = await supabase.from("event_staff").insert({
        owner_id: u.user.id, event_id: f.event_id, employee_id: f.employee_id,
        role: f.role, amount: Number(f.amount || emp?.daily_rate || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Funcionário escalado"); onClose(); },
    onError: (e: any) => toast.error(e.message.includes("conflito") || e.message.includes("já escalado") ? "⚠️ Este funcionário já está escalado em outro evento na mesma data." : e.message),
  });
  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-3">
        <h3 className="text-lg font-extrabold">Escalar em evento</h3>
        <p className="text-xs text-muted-foreground">O sistema bloqueia escalar o mesmo funcionário em dois eventos na mesma data.</p>
        <select value={f.event_id} onChange={(e) => setF({ ...f, event_id: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm">
          <option value="">Selecione o evento</option>
          {(events ?? []).map((ev: any) => <option key={ev.id} value={ev.id}>{ev.event_date} — {ev.clients?.name ?? "Evento"}</option>)}
        </select>
        <select value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm">
          <option value="">Selecione o funcionário</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
        </select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className="h-10 px-3 border border-border rounded-lg bg-background text-sm capitalize">
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="number" placeholder="Valor" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="h-10 px-3 border border-border rounded-lg bg-background text-sm" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-border text-sm font-bold">Cancelar</button>
          <button disabled={!f.event_id || !f.employee_id || mut.isPending} onClick={() => mut.mutate()} className={cn("flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50")}>Escalar</button>
        </div>
      </div>
    </div>
  );
}

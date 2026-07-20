import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { ChecklistPreDefinido } from "@/components/ChecklistPreDefinido";

type EventStatus =
  | "agendado"
  | "em_andamento"
  | "pago"
  | "pagamento_parcial"
  | "realizado"
  | "concluido"
  | "cancelado";

export const Route = createFileRoute("/_authenticated/eventos/create")({
  head: () => ({ meta: [{ title: "Novo Evento — Meu Churras" }] }),
  component: CreateEventPage,
});

function CreateEventPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    package_id: "",
    event_date: "",
    event_time: "18:00",
    guest_count: "",
    event_address: "",
    total_value: "",
    status: "agendado" as EventStatus,
    notes: "",
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-for-select"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["packages-for-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("packages")
        .select("id, name, price_per_person")
        .order("name");
      return data ?? [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");

      const { error } = await supabase.from("events").insert({
        owner_id: userRes.user.id,
        client_id: formData.client_id || null,
        package_id: formData.package_id || null,
        event_date: formData.event_date,
        event_time: formData.event_time || null,
        event_address: formData.event_address || null,
        guest_count: Number(formData.guest_count) || 0,
        total_value: Number(formData.total_value) || 0,
        status: formData.status,
        notes: formData.notes || null,
      });
      if (error) throw error;

      toast.success("Evento criado com sucesso!");
      navigate({ to: "/eventos" });
    } catch (err: any) {
      console.error("Erro ao criar evento:", err);
      toast.error(err.message || "Erro ao criar evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate({ to: "/eventos" })}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Novo Evento</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados para criar um novo evento</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Cliente <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.client_id}
            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          >
            <option value="">Selecione um cliente</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pacote</label>
          <select
            value={formData.package_id}
            onChange={(e) => setFormData({ ...formData, package_id: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          >
            <option value="">Selecione um pacote</option>
            {packages?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {brl(p.price_per_person)}/pessoa
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.event_date}
              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Horário <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              required
              value={formData.event_time}
              onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Convidados</label>
            <input
              type="number"
              min="0"
              value={formData.guest_count}
              onChange={(e) => setFormData({ ...formData, guest_count: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total</label>
            <input
              type="number"
              step="0.01"
              value={formData.total_value}
              onChange={(e) => setFormData({ ...formData, total_value: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="0,00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
          <input
            type="text"
            value={formData.event_address}
            onChange={(e) => setFormData({ ...formData, event_address: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            placeholder="Rua, número, bairro"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          >
            <option value="agendado">Agendado</option>
            <option value="em_andamento">Em andamento</option>
            <option value="pago">Pago</option>
            <option value="realizado">Realizado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
            rows={3}
            placeholder="Observações sobre o evento..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate({ to: "/eventos" })}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all",
              loading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg",
            )}
          >
            {loading ? "Salvando..." : "Criar Evento"}
          </button>
        </div>
      </form>
    </div>
  );
}

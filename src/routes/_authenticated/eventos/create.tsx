import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Calendar, User, Package, DollarSign, ArrowLeft } from "lucide-react";

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
    total_value: "",
    status: "agendado",
    description: "",
  });

  // Buscar clientes para o select
  const { data: clients } = useQuery({
    queryKey: ["clients-for-select"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data ?? [];
    },
  });

  // Buscar pacotes para o select
  const { data: packages } = useQuery({
    queryKey: ["packages-for-select"],
    queryFn: async () => {
      const { data } = await supabase.from("packages").select("id, name, price").order("name");
      return data ?? [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Cria o evento no banco
      const { data: event, error } = await supabase
        .from("events")
        .insert({
          client_id: formData.client_id || null,
          package_id: formData.package_id || null,
          event_date: formData.event_date,
          event_time: formData.event_time,
          total_value: Number(formData.total_value) || 0,
          status: formData.status,
          description: formData.description,
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Sincroniza com Google Agenda
      try {
        const { data: user } = await supabase.auth.getUser();
        
        if (user?.user) {
          // Busca o e-mail do Google do usuário
          const { data: profile } = await supabase
            .from("profiles")
            .select("google_calendar_email")
            .eq("id", user.user.id)
            .single();

          if (profile?.google_calendar_email) {
            // Busca nome do cliente e pacote para o título
            const clientName = clients?.find(c => c.id === formData.client_id)?.name || "Cliente";
            const packageName = packages?.find(p => p.id === formData.package_id)?.name || "Pacote";

            const { error: syncError } = await supabase.functions.invoke("google-calendar", {
              body: {
                eventId: event.id,
                userId: user.user.id,
                summary: `${clientName} - ${packageName}`,
                description: formData.description || "",
                startDateTime: `${formData.event_date}T${formData.event_time}:00`,
                endDateTime: `${formData.event_date}T${calculateEndTime(formData.event_time)}:00`,
              },
            });

            if (syncError) {
              console.error("Erro ao sincronizar com Google:", syncError);
            } else {
              toast.success("✅ Evento sincronizado com Google Agenda!");
            }
          }
        }
      } catch (syncError) {
        console.error("Erro na sincronização:", syncError);
        // Não bloqueia a criação do evento
      }

      toast.success("Evento criado com sucesso!");
      navigate({ to: "/eventos" });

    } catch (error: any) {
      console.error("Erro ao criar evento:", error);
      toast.error(error.message || "Erro ao criar evento");
    } finally {
      setLoading(false);
    }
  };

  // Função auxiliar
  function calculateEndTime(startTime: string) {
    const [hours, minutes] = startTime.split(":").map(Number);
    const endHours = hours + 1;
    return `${String(endHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

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

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        {/* Cliente */}
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
            {clients?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Pacote */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Pacote
          </label>
          <select
            value={formData.package_id}
            onChange={(e) => setFormData({ ...formData, package_id: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          >
            <option value="">Selecione um pacote</option>
            {packages?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} - {brl(p.price)}</option>
            ))}
          </select>
        </div>

        {/* Data e Hora */}
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

        {/* Valor */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Valor Total
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.total_value}
            onChange={(e) => setFormData({ ...formData, total_value: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            placeholder="0,00"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          >
            <option value="agendado">Agendado</option>
            <option value="em_andamento">Em andamento</option>
            <option value="realizado">Realizado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Observações
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
            rows={3}
            placeholder="Observações sobre o evento..."
          />
        </div>

        {/* Botões */}
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
              loading
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
            )}
          >
            {loading ? (
              <>
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" />
                Salvando...
              </>
            ) : (
              "Criar Evento"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

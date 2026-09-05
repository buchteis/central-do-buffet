import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin, PartyPopper, Users, Check } from "lucide-react";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Confirmar presença — Convite" },
      { name: "description", content: "Confirme sua presença no evento: data, horário e local." },
      { property: "og:title", content: "Confirmar presença — Convite" },
      { property: "og:description", content: "Confirme sua presença no evento: data, horário e local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

type Invite = {
  event_id: string;
  event_date: string | null;
  event_time: string | null;
  event_address: string | null;
  event_type: string | null;
  client_name: string | null;
  confirmed_count: number | null;
};

function InvitePage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    guest_name: "",
    phone: "",
    companions: "0",
    attending: true,
    message: "",
  });

  const { data: invite, isLoading } = useQuery({
    queryKey: ["event-invite", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_event_invite", { _token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as Invite | null;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("submit_event_rsvp", {
        _token: token,
        _guest_name: form.guest_name,
        _phone: form.phone || null,
        _companions: Number(form.companions) || 0,
        _attending: form.attending,
        _message: form.message || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["event-invite", token] });
      toast.success("Presença registrada. Obrigado!");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível registrar"),
  });

  if (isLoading) {
    return (
      <main className="min-h-screen grid place-items-center p-6 text-sm text-slate-500">
        Carregando convite…
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-extrabold">Convite não encontrado</h1>
          <p className="text-sm text-slate-500 mt-2">Este link pode ter expirado ou o evento foi cancelado.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <section className="rounded-3xl bg-white border border-sky-100 shadow-sm p-7 text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-sky-100 text-sky-600 mb-3">
            <PartyPopper className="size-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
            Você está convidado{invite.client_name ? `!` : "!"}
          </h1>
          {invite.client_name && (
            <p className="text-sm text-slate-500 mt-1">Convite de {invite.client_name}</p>
          )}

          <div className="mt-6 space-y-3 text-left">
            <InfoRow icon={<PartyPopper className="size-4" />} label="Tipo de evento" value={invite.event_type ?? "—"} />
            <InfoRow icon={<CalendarDays className="size-4" />} label="Data" value={invite.event_date ? formatDateBR(invite.event_date) : "—"} />
            <InfoRow icon={<Clock className="size-4" />} label="Horário" value={invite.event_time ? String(invite.event_time).slice(0, 5) : "—"} />
            <InfoRow icon={<MapPin className="size-4" />} label="Local" value={invite.event_address ?? "—"} />
            <InfoRow icon={<Users className="size-4" />} label="Confirmados" value={`${invite.confirmed_count ?? 0} pessoa(s)`} />
          </div>
        </section>

        {done ? (
          <section className="rounded-3xl bg-white border border-emerald-100 shadow-sm p-8 text-center">
            <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-emerald-100 text-emerald-600 mb-3">
              <Check className="size-6" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-800">Resposta registrada!</h2>
            <p className="text-sm text-slate-500 mt-1">
              {form.attending ? "Nos vemos no evento." : "Obrigado por avisar."}
            </p>
          </section>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
            className="rounded-3xl bg-white border border-sky-100 shadow-sm p-7 space-y-5"
          >
            <h2 className="text-lg font-extrabold text-slate-800">Confirmar presença</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Seu nome <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.guest_name}
                onChange={(ev) => setForm({ ...form, guest_name: ev.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none"
                placeholder="Nome completo"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                <input
                  value={form.phone}
                  onChange={(ev) => setForm({ ...form, phone: ev.target.value })}
                  inputMode="tel"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Acompanhantes</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={form.companions}
                  onChange={(ev) => setForm({ ...form, companions: ev.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setForm({ ...form, attending: v })}
                  className={cn(
                    "py-3 rounded-xl text-sm font-bold border transition-all",
                    form.attending === v
                      ? v
                        ? "bg-emerald-500 border-emerald-500 text-white shadow"
                        : "bg-slate-500 border-slate-500 text-white shadow"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {v ? "Vou comparecer" : "Não vou poder ir"}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem (opcional)</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={(ev) => setForm({ ...form, message: ev.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none resize-none"
                placeholder="Restrição alimentar, recado…"
              />
            </div>

            <button
              type="submit"
              disabled={submit.isPending}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
            >
              {submit.isPending ? "Enviando…" : "Enviar confirmação"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-sky-50/70 border border-sky-100 px-4 py-3">
      <span className="mt-0.5 text-sky-500">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-500">{label}</div>
        <div className="text-sm font-semibold text-slate-700 break-words">{value}</div>
      </div>
    </div>
  );
}

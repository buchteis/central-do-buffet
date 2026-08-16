import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Escala automática de funcionários                                          */
/* Regra: a demanda é calculada pelo nº de convidados do evento e o dono do    */
/* buffet escolhe uma das estratégias sugeridas. Ao escolher, os funcionários  */
/* são escalados automaticamente em event_staff.                              */
/* -------------------------------------------------------------------------- */

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

type RoleRule = {
  role: string;
  keywords: string[];
  perGuests: number; // 1 profissional a cada N convidados
  min: number;
  fromGuests?: number; // só entra a partir de X convidados
};

const ROLE_RULES: RoleRule[] = [
  { role: "Garçom", keywords: ["garcom", "garcon", "garca", "salao"], perGuests: 25, min: 1 },
  { role: "Churrasqueiro", keywords: ["churrasqueiro", "assador", "chef", "cozinheiro"], perGuests: 50, min: 1 },
  { role: "Auxiliar de cozinha", keywords: ["auxiliar", "cozinha", "ajudante"], perGuests: 40, min: 1 },
  { role: "Copeiro", keywords: ["copeiro", "copa", "bar", "barman", "bartender"], perGuests: 60, min: 0, fromGuests: 40 },
  { role: "Coordenador", keywords: ["coordenador", "supervisor", "maitre", "gerente"], perGuests: 200, min: 0, fromGuests: 80 },
];

const STRATEGIES = [
  { id: "enxuta", nome: "Enxuta", fator: 0.75, descricao: "Menor custo — equipe mínima para o evento." },
  { id: "equilibrada", nome: "Equilibrada", fator: 1, descricao: "Recomendada — proporção padrão por convidado." },
  { id: "reforcada", nome: "Reforçada", fator: 1.3, descricao: "Atendimento premium — mais equipe em salão e cozinha." },
] as const;

function demandFor(guests: number, fator: number) {
  const g = Math.max(Number(guests) || 0, 0);
  return ROLE_RULES.map((r) => {
    if (r.fromGuests && g < r.fromGuests) return { role: r.role, keywords: r.keywords, qty: 0 };
    const raw = g / r.perGuests;
    let qty = Math.ceil(raw * fator);
    if (qty < r.min && g > 0) qty = r.min;
    if (r.role === "Coordenador" && g >= (r.fromGuests ?? 0)) qty = Math.max(qty, 1);
    return { role: r.role, keywords: r.keywords, qty: Math.max(qty, 0) };
  }).filter((r) => r.qty > 0);
}

const SuggestInput = z.object({ eventId: z.string().uuid().optional() });

export const suggestEventStaffing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SuggestInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!tenant) return { error: "Nenhum buffet vinculado a esta conta." };
    const tid = tenant.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    let query = supabase
      .from("events")
      .select("id, event_date, event_time, guest_count, status, event_address, clients(name), packages(name)")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
      .neq("status", "cancelado")
      .gte("event_date", todayStr)
      .order("event_date", { ascending: true })
      .limit(20);
    if (data.eventId) query = supabase
      .from("events")
      .select("id, event_date, event_time, guest_count, status, event_address, clients(name), packages(name)")
      .eq("id", data.eventId)
      .limit(1);

    const { data: events } = await query;
    const list = (events ?? []) as any[];
    if (!list.length) return { error: "Não encontrei eventos futuros para escalar." };

    const target = list[0];

    // Funcionários ativos do buffet
    const { data: employeesData } = await supabase
      .from("employees")
      .select("id, name, role, phone, pix, daily_rate, active")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
      .eq("active", true)
      .order("name");
    const employees = (employeesData ?? []) as any[];

    // Já escalados nesta data (em qualquer evento) — evita conflito
    const { data: sameDateEvents } = await supabase
      .from("events")
      .select("id")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
      .eq("event_date", target.event_date);
    const sameDateIds = (sameDateEvents ?? []).map((e: any) => e.id);

    const { data: busyData } = sameDateIds.length
      ? await supabase.from("event_staff").select("employee_id, event_id").in("event_id", sameDateIds)
      : { data: [] as any[] };
    const busy = (busyData ?? []) as any[];
    const busyIds = new Set(busy.map((b) => b.employee_id));
    const alreadyInEvent = busy.filter((b) => b.event_id === target.id).length;

    const disponiveis = employees.filter((e) => !busyIds.has(e.id));

    const strategies = STRATEGIES.map((s) => {
      const demand = demandFor(target.guest_count ?? 0, s.fator);
      const slots = demand.flatMap((d) => {
        const pool = disponiveis.filter((e) => {
          const r = norm(e.role);
          return d.keywords.some((k) => r.includes(k));
        });
        const generic = disponiveis.filter((e) => !ROLE_RULES.some((rr) => rr.keywords.some((k) => norm(e.role).includes(k))));
        const candidates = [...pool, ...generic];
        return Array.from({ length: d.qty }, (_, i) => ({
          role: d.role,
          employee_id: candidates[i]?.id ?? null,
          employee_name: candidates[i]?.name ?? null,
          amount: Number(candidates[i]?.daily_rate ?? 0),
        }));
      });
      // Evita repetir o mesmo funcionário em dois slots
      const used = new Set<string>();
      const unique = slots.map((s2) => {
        if (s2.employee_id && used.has(s2.employee_id)) {
          return { ...s2, employee_id: null, employee_name: null, amount: 0 };
        }
        if (s2.employee_id) used.add(s2.employee_id);
        return s2;
      });
      return {
        id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        total_profissionais: unique.length,
        custo_estimado: unique.reduce((sum, x) => sum + Number(x.amount || 0), 0),
        vagas_sem_funcionario: unique.filter((x) => !x.employee_id).length,
        slots: unique,
      };
    });

    return {
      event: {
        id: target.id,
        data: target.event_date,
        hora: target.event_time,
        cliente: target.clients?.name ?? null,
        pacote: target.packages?.name ?? null,
        convidados: Number(target.guest_count ?? 0),
        status: target.status,
        local: target.event_address ?? null,
        ja_escalados: alreadyInEvent,
      },
      employees: disponiveis.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        daily_rate: Number(e.daily_rate ?? 0),
      })),
      strategies,
      proximos_eventos: list.slice(0, 8).map((e) => ({
        id: e.id,
        data: e.event_date,
        cliente: e.clients?.name ?? null,
        convidados: Number(e.guest_count ?? 0),
        status: e.status,
      })),
    };
  });

const AssignInput = z.object({
  eventId: z.string().uuid(),
  assignments: z
    .array(
      z.object({
        employee_id: z.string().uuid(),
        role: z.string().min(1).max(80),
        amount: z.number().min(0).max(100000).optional().default(0),
      }),
    )
    .min(1)
    .max(60),
});

export const assignEventStaffing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AssignInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ev } = await supabase
      .from("events")
      .select("id, tenant_id, owner_id, event_date")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev) return { error: "Evento não encontrado." };

    const { data: existing } = await supabase
      .from("event_staff")
      .select("employee_id")
      .eq("event_id", data.eventId);
    const already = new Set((existing ?? []).map((e: any) => e.employee_id));

    const rows = data.assignments
      .filter((a) => !already.has(a.employee_id))
      .map((a) => ({
        owner_id: ev.owner_id ?? userId,
        tenant_id: ev.tenant_id,
        event_id: data.eventId,
        employee_id: a.employee_id,
        role: a.role,
        amount: Number(a.amount || 0),
        paid: false,
      }));

    if (!rows.length) return { error: "Estes funcionários já estão escalados neste evento." };

    const inserted: { name: string; role: string; amount: number }[] = [];
    const failed: { name: string; reason: string }[] = [];

    for (const row of rows) {
      const { error } = await supabase.from("event_staff").insert(row);
      const { data: emp } = await supabase
        .from("employees")
        .select("name")
        .eq("id", row.employee_id)
        .maybeSingle();
      const name = emp?.name ?? "Funcionário";
      if (error) {
        failed.push({ name, reason: error.message.includes("já escalado") ? "já escalado em outro evento nesta data" : error.message });
      } else {
        inserted.push({ name, role: row.role, amount: row.amount });
      }
    }

    return { inserted, failed, event_date: ev.event_date };
  });

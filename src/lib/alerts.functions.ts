import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BuffetAlert = {
  id: string;
  kind: "estoque" | "evento" | "parcela";
  message: string;
};


export const getBuffetAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ alerts: BuffetAlert[] }> => {
    const { supabase, userId } = context;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!tenant) return { alerts: [] };

    const tid = (tenant as any).id as string;
    const alerts: BuffetAlert[] = [];

    const [{ data: stock }, { data: events }, { data: installments }] = await Promise.all([
      supabase
        .from("stock_products")
        .select("id, name, unit, physical_qty, reserved_qty, min_qty, active")
        .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`),
      supabase
        .from("events")
        .select("id, event_date, event_time, status, guest_count, clients(name)")
        .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
        .neq("status", "cancelado")
        .order("event_date", { ascending: true })
        .limit(50),
      supabase
        .from("payment_installments")
        .select("id, label, number, total_count, amount, due_date, status, clients(name)")
        .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
        .neq("status", "pago")
        .order("due_date", { ascending: true })
        .limit(100),
    ]);


    for (const p of (stock ?? []) as any[]) {
      if (p.active === false) continue;
      const avail = Number(p.physical_qty ?? 0) - Number(p.reserved_qty ?? 0);
      const min = Number(p.min_qty ?? 0);
      const critico = avail <= 0 || (min > 0 && avail <= min * 0.5);
      const baixo = min > 0 && avail <= min;
      if (!critico && !baixo) continue;
      alerts.push({
        id: `estoque:${p.id}:${critico ? "critico" : "baixo"}`,
        kind: "estoque",
        message: `${critico ? "🔴 Estoque crítico" : "🟠 Estoque baixo"}: ${p.name} — disponível ${avail.toLocaleString("pt-BR")} ${p.unit ?? ""} (mínimo ${min.toLocaleString("pt-BR")}). Recomendo repor antes dos próximos eventos.`,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 7);

    for (const e of (events ?? []) as any[]) {
      if (!e.event_date) continue;
      const d = new Date(`${e.event_date}T00:00:00`);
      if (d < today || d > limit) continue;
      const dias = Math.round((d.getTime() - today.getTime()) / 86400000);
      const quando = dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
      alerts.push({
        id: `evento:${e.id}:${e.event_date}`,
        kind: "evento",
        message: `📅 Evento chegando: ${e.clients?.name ?? "Cliente"} — ${d.toLocaleDateString("pt-BR")}${e.event_time ? ` às ${String(e.event_time).slice(0, 5)}` : ""} (${quando}), ${e.guest_count ?? "?"} convidados. Status: ${e.status}.`,
      });
    }

    const brl = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    for (const p of (installments ?? []) as any[]) {
      if (!p.due_date) continue;
      const d = new Date(`${p.due_date}T00:00:00`);
      const dias = Math.round((d.getTime() - today.getTime()) / 86400000);
      if (dias > 3) continue;
      const nome = p.clients?.name ?? "Cliente";
      const rotulo = p.label ?? `Parcela ${p.number}/${p.total_count}`;
      const quando =
        dias < 0
          ? `🔴 VENCIDA há ${Math.abs(dias)} dia(s)`
          : dias === 0
            ? "🔴 vence HOJE"
            : dias === 1
              ? "🟠 vence AMANHÃ"
              : `🟠 vence em ${dias} dias`;
      alerts.push({
        id: `parcela:${p.id}:${p.due_date}`,
        kind: "parcela",
        message: `💰 Cobrança: ${nome} — ${rotulo} de ${brl(Number(p.amount ?? 0))} ${quando} (${d.toLocaleDateString("pt-BR")}). Status: ${p.status}.`,
      });
    }



    return { alerts: alerts.slice(0, 12) };
  });

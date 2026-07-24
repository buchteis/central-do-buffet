import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

async function buildContext(supabase: any, userId: string) {
  // Tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, status")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!tenant) return { tenant: null, summary: "Nenhum buffet vinculado a este usuário." };

  const tid = tenant.id;

  const [clientsRes, eventsRes, quotesRes, stockRes, packagesRes, pkgProductsRes, tiersRes, movementsRes] = await Promise.all([
    // Busca clientes por tenant_id OU owner_id (para capturar clientes antigos sem tenant_id)
    supabase
      .from("clients")
      .select("id, name, phone, email, city, created_at")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`),
    supabase
      .from("events")
      .select("id, event_date, status, total_value, guest_count, clients(name), packages(name)")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
      .order("event_date", { ascending: false })
      .limit(50),
    supabase
      .from("quotes")
      .select("id, status, paid, total_value, event_date, created_at")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`),
    supabase
      .from("stock_products")
      .select("id, name, unit, physical_qty, reserved_qty, min_qty, stock_categories(name)")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
      .order("name"),
    supabase
      .from("packages")
      .select("id, name, active")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`),
    supabase.from("package_products").select("package_id, product_id, qty_per_person, qty_fixed"),
    (supabase as any)
      .from("package_price_tiers")
      .select("package_id, min_guests, max_guests, price_per_person")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`),
    supabase
      .from("stock_movements")
      .select("kind, quantity, product_id, created_at")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const clients = clientsRes.data ?? [];
  const events = eventsRes.data ?? [];
  const quotes = quotesRes.data ?? [];
  const stock = stockRes.data ?? [];
  const packages = packagesRes.data ?? [];
  const pkgProducts = pkgProductsRes.data ?? [];
  const priceTiers = (tiersRes as any)?.data ?? [];
  const movements = movementsRes.data ?? [];

  // Metrics
  const eventsByStatus: Record<string, number> = {};
  for (const e of events) eventsByStatus[e.status] = (eventsByStatus[e.status] || 0) + 1;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidClosed = quotes.filter((q: any) => q.status === "fechado" && q.paid);
  const faturamentoTotal = paidClosed.reduce((s: number, q: any) => s + Number(q.total_value || 0), 0);
  const faturamentoMes = paidClosed
    .filter((q: any) => q.event_date && new Date(q.event_date) >= monthStart)
    .reduce((s: number, q: any) => s + Number(q.total_value || 0), 0);

  const proximosEventos = events
    .filter((e: any) => e.event_date && new Date(e.event_date) >= new Date(now.toDateString()))
    .filter((e: any) => e.status !== "cancelado")
    .slice(0, 10);

  const estoqueDetalhado = stock.map((p: any) => ({
    nome: p.name,
    unidade: p.unit,
    categoria: p.stock_categories?.name ?? null,
    fisico: Number(p.physical_qty),
    reservado: Number(p.reserved_qty),
    disponivel: Number(p.physical_qty) - Number(p.reserved_qty),
    minimo: Number(p.min_qty),
    abaixo_do_minimo: Number(p.physical_qty) - Number(p.reserved_qty) < Number(p.min_qty),
  }));

  const pacotesDetalhados = packages.map((p: any) => {
    const prods = pkgProducts
      .filter((pp: any) => pp.package_id === p.id)
      .map((pp: any) => {
        const sp = stock.find((s: any) => s.id === pp.product_id);
        return {
          produto: sp?.name ?? pp.product_id,
          unidade: sp?.unit ?? "",
          qty_por_pessoa: Number(pp.qty_per_person),
          qty_fixa: Number(pp.qty_fixed),
        };
      });
    return {
      nome: p.name,
      preco_por_pessoa: Number(p.price_per_person),
      min_convidados: p.min_people,
      max_convidados: p.max_people,
      ativo: p.active,
      produtos_consumidos: prods,
    };
  });

  const context = {
    buffet: { nome: tenant.name, status: tenant.status },
    metricas: {
      total_clientes: clients.length,
      total_eventos: events.length,
      eventos_por_status: eventsByStatus,
      total_orcamentos: quotes.length,
      orcamentos_novos: quotes.filter((q: any) => q.status === "novo").length,
      orcamentos_em_andamento: quotes.filter((q: any) => q.status === "em_andamento").length,
      orcamentos_fechados: quotes.filter((q: any) => q.status === "fechado").length,
      faturamento_total_pago: faturamentoTotal,
      faturamento_mes_atual: faturamentoMes,
    },
    proximos_eventos: proximosEventos.map((e: any) => ({
      data: e.event_date,
      cliente: e.clients?.name,
      pacote: e.packages?.name,
      convidados: e.guest_count,
      valor: Number(e.total_value || 0),
      status: e.status,
    })),
    estoque: estoqueDetalhado,
    estoque_alerta_baixo: estoqueDetalhado.filter((p: any) => p.abaixo_do_minimo),
    pacotes: pacotesDetalhados,
    ultimas_movimentacoes_estoque: movements,
  };

  return { tenant, summary: JSON.stringify(context, null, 2) };
}

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const { tenant, summary } = await buildContext(context.supabase, context.userId);
    if (!tenant) {
      return {
        reply: "Não encontrei um buffet vinculado à sua conta. Verifique se seu cadastro foi aprovado.",
      };
    }

    const systemPrompt = `Você é o assistente virtual da Central do Buffet.
Responda SEMPRE em português brasileiro, de forma direta e amigável, usando os DADOS ATUAIS abaixo — nunca invente números.
Se a pergunta for sobre quantidade de eventos, estoque, clientes ou faturamento, use exatamente os valores do JSON.
Formate valores monetários em R$ (ex: R$ 1.500,00). Se algo não estiver nos dados, diga que não há registro.
Ao se apresentar, diga apenas que é o assistente virtual da Central do Buffet, sem mencionar o nome específico do buffet.

DADOS ATUAIS DO BUFFET (JSON):
${summary}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.message },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        return { reply: "Muitas requisições agora. Tente novamente em instantes." };
      }
      if (res.status === 402) {
        return { reply: "Créditos de IA esgotados. Recarregue em Configurações → Planos." };
      }
      console.error("AI Gateway error", res.status, text);
      throw new Error("Falha ao consultar a IA.");
    }

    const json = (await res.json()) as any;
    const reply: string = json?.choices?.[0]?.message?.content ?? "Não consegui gerar uma resposta.";
    return { reply };
  });

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
      .select("id, name, cpf, phone, whatsapp, email, city, address, notes, origem, status, created_at")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, event_date, status, total_value, guest_count, clients(name), packages(name)")
      .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
      .order("event_date", { ascending: false })
      .limit(50),
    supabase
      .from("quotes")
      .select("id, status, paid, total_value, event_date, event_address, event_type, adults, children_7_10, children_0_6, created_at, extras, clients(name, phone, whatsapp, email, cpf, city, address, origem)")
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

  const { data: feedbacksData } = await (supabase as any)
    .from("feedbacks")
    .select("client_name, nps_score, rating_food, rating_drinks, rating_staff, rating_punctuality, comments, improvements, created_at")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: installmentsData } = await (supabase as any)
    .from("payment_installments")
    .select("id, label, number, total_count, amount, due_date, status, paid_at, receipt_uploaded_at, event_id, clients(name, whatsapp, phone), events(event_date)")
    .or(`tenant_id.eq.${tid},owner_id.eq.${userId}`)
    .order("due_date", { ascending: true })
    .limit(300);

  const clients = clientsRes.data ?? [];
  const events = eventsRes.data ?? [];
  const quotes = quotesRes.data ?? [];
  const stock = stockRes.data ?? [];
  const packages = packagesRes.data ?? [];
  const pkgProducts = pkgProductsRes.data ?? [];
  const priceTiers = (tiersRes as any)?.data ?? [];
  const movements = movementsRes.data ?? [];
  const feedbacks = (feedbacksData ?? []) as any[];
  const installments = (installmentsData ?? []) as any[];



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
    const faixas = priceTiers
      .filter((t: any) => t.package_id === p.id)
      .map((t: any) => ({
        de_convidados: Number(t.min_guests),
        ate_convidados: Number(t.max_guests),
        preco_por_pessoa: Number(t.price_per_person),
      }));
    return {
      nome: p.name,
      ativo: p.active,
      faixas_de_preco: faixas,
      produtos_consumidos: prods,
    };
  });

  const clientesDetalhados = clients.map((c: any) => ({
    nome: c.name,
    documento: c.cpf ?? null,
    telefone: c.phone ?? null,
    whatsapp: c.whatsapp ?? null,
    email: c.email ?? null,
    cidade: c.city ?? null,
    endereco: c.address ?? null,
    observacoes: c.notes ?? null,
    origem: c.origem === "link_orcamento" ? "link público" : (c.origem ?? "manual"),
    status: c.status,
    cadastrado_em: c.created_at,
  }));

  const solicitantesLinkPublico = quotes
    .filter((q: any) => q?.extras?.requester)
    .map((q: any) => ({
      orcamento_id: q.id,
      status_orcamento: q.status,
      nome: q.extras.requester.name ?? null,
      whatsapp: q.extras.requester.whatsapp ?? null,
      email: q.extras.requester.email ?? null,
      documento: q.extras.requester.cpf ?? null,
      cidade: q.extras.requester.city ?? null,
      data_evento: q.event_date,
      local_evento: q.event_address ?? null,
      tipo_evento: q.event_type ?? null,
      convidados:
        Number(q.adults || 0) + Number(q.children_7_10 || 0) + Number(q.children_0_6 || 0),
      valor: Number(q.total_value || 0),
      criado_em: q.created_at,
    }));

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diasAte = (due: string | null) =>
    due ? Math.round((new Date(`${due}T00:00:00`).getTime() - hoje.getTime()) / 86400000) : null;

  const parcelasDetalhadas = installments.map((p: any) => {
    const dias = diasAte(p.due_date);
    return {
      cliente: p.clients?.name ?? null,
      whatsapp: p.clients?.whatsapp ?? p.clients?.phone ?? null,
      parcela: p.label ?? `Parcela ${p.number}/${p.total_count}`,
      numero: p.number,
      total_parcelas: p.total_count,
      valor: Number(p.amount || 0),
      vencimento: p.due_date,
      dias_para_vencer: dias,
      status: p.status,
      comprovante_enviado: !!p.receipt_uploaded_at,
      pago_em: p.paid_at,
      data_evento: p.events?.event_date ?? null,
    };
  });

  const parcelasAbertas = parcelasDetalhadas.filter((p) => p.status !== "pago");
  const parcelasVencendo3Dias = parcelasAbertas.filter(
    (p) => p.dias_para_vencer !== null && p.dias_para_vencer >= 0 && p.dias_para_vencer <= 3,
  );
  const parcelasVencidas = parcelasAbertas.filter(
    (p) => p.dias_para_vencer !== null && p.dias_para_vencer < 0,
  );

  const context = {

    buffet: { nome: tenant.name, status: tenant.status },
    hoje: hoje.toISOString().slice(0, 10),
    parcelas: parcelasDetalhadas,
    parcelas_abertas: parcelasAbertas,
    parcelas_vencendo_em_3_dias: parcelasVencendo3Dias,
    parcelas_vencidas: parcelasVencidas,

    metricas: {
      total_clientes: clients.length,
      clientes_via_link_publico: clients.filter((c: any) => c.origem === "link_orcamento").length,
      clientes_manuais: clients.filter((c: any) => c.origem !== "link_orcamento").length,
      total_eventos: events.length,
      eventos_por_status: eventsByStatus,
      total_orcamentos: quotes.length,
      orcamentos_novos: quotes.filter((q: any) => q.status === "novo").length,
      orcamentos_em_andamento: quotes.filter((q: any) => q.status === "em_andamento").length,
      orcamentos_fechados: quotes.filter((q: any) => q.status === "fechado").length,
      faturamento_total_pago: faturamentoTotal,
      faturamento_mes_atual: faturamentoMes,
      total_avaliacoes: feedbacks.length,
      nps_medio: feedbacks.length
        ? Number((feedbacks.reduce((s, f) => s + Number(f.nps_score || 0), 0) / feedbacks.length).toFixed(1))
        : null,
      promotores: feedbacks.filter((f) => Number(f.nps_score) >= 9).length,
      neutros: feedbacks.filter((f) => Number(f.nps_score) >= 7 && Number(f.nps_score) <= 8).length,
      detratores: feedbacks.filter((f) => Number(f.nps_score) <= 6).length,
    },
    clientes: clientesDetalhados,
    solicitantes_link_publico: solicitantesLinkPublico,

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
    avaliacoes_clientes: feedbacks.map((f) => ({
      cliente: f.client_name,
      nota_nps: f.nps_score,
      comida: f.rating_food,
      bebidas: f.rating_drinks,
      equipe: f.rating_staff,
      pontualidade: f.rating_punctuality,
      elogios: f.comments,
      melhorias: f.improvements,
      data: f.created_at,
    })),

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
Para perguntas sobre clientes, use "clientes" (cadastro manual e vindos do link público, veja o campo origem) e "solicitantes_link_publico" (pedidos recebidos pelo link que ainda podem não ter cadastro).
Para cobranças e pagamentos, use "parcelas", "parcelas_abertas", "parcelas_vencendo_em_3_dias" e "parcelas_vencidas" (campo dias_para_vencer é relativo ao campo "hoje"). Sempre que houver itens em "parcelas_vencendo_em_3_dias" ou "parcelas_vencidas", avise o dono do buffet citando cliente, parcela, valor e data de vencimento, e sugira cobrar pelo WhatsApp.


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

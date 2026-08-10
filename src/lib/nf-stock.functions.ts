import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Leitura de nota fiscal (imagem / PDF / XML) e lançamento de entrada no estoque.
 * O arquivo enviado é usado APENAS em memória para a extração — nada é gravado
 * em storage nem no banco. Somente os dados estruturados são persistidos.
 */

const ParseInput = z.object({
  filename: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(200),
  // data URL ou base64 puro
  base64: z.string().min(10).max(14_000_000),
});

export type NfItem = {
  descricao: string;
  quantidade: number;
  unidade: string | null;
  valor_unitario: number;
  valor_total: number;
};

export type NfHeader = {
  fornecedor: string | null;
  cnpj: string | null;
  numero: string | null;
  serie: string | null;
  data_emissao: string | null;
  chave_acesso: string | null;
  valor_total: number;
};

export type NfMatch = {
  item: NfItem;
  product_id: string | null;
  product_name: string | null;
  product_unit: string | null;
  product_qty: number | null;
  confidence: number;
};

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = na.split(" ").filter(Boolean);
  const tb = nb.split(" ").filter(Boolean);
  const setB = new Set(tb);
  let hits = 0;
  for (const t of ta) {
    if (setB.has(t)) hits += 1;
    else if (t.length > 3 && tb.some((x) => x.includes(t) || t.includes(x))) hits += 0.6;
  }
  const score = hits / Math.max(ta.length, tb.length);
  if (na.includes(nb) || nb.includes(na)) return Math.max(score, 0.85);
  return score;
}

function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "") || null;
}

async function extractFromAI(args: { filename: string; mimeType: string; base64: string }) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const raw = args.base64.includes(",") && args.base64.startsWith("data:")
    ? args.base64.split(",")[1]!
    : args.base64;
  const mime = args.mimeType || "application/octet-stream";
  const isXml = /xml/i.test(mime) || /\.xml$/i.test(args.filename);
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf" || /\.pdf$/i.test(args.filename);

  const instruction = `Extraia os dados desta nota fiscal brasileira (NF-e/DANFE) e responda SOMENTE com JSON válido, sem markdown, no formato:
{"fornecedor":string|null,"cnpj":string|null,"numero":string|null,"serie":string|null,"data_emissao":"YYYY-MM-DD"|null,"chave_acesso":string|null,"valor_total":number,"itens":[{"descricao":string,"quantidade":number,"unidade":string|null,"valor_unitario":number,"valor_total":number}]}
Use ponto como separador decimal. Se não encontrar um campo, use null. Não invente valores.`;

  let content: any;
  if (isXml) {
    let xml = "";
    try {
      xml = Buffer.from(raw, "base64").toString("utf8");
    } catch {
      xml = "";
    }
    content = `${instruction}\n\nXML DA NF-e:\n${xml.slice(0, 180_000)}`;
  } else if (isImage) {
    content = [
      { type: "text", text: instruction },
      { type: "image_url", image_url: { url: `data:${mime};base64,${raw}` } },
    ];
  } else if (isPdf) {
    content = [
      { type: "text", text: instruction },
      { type: "file", file: { filename: args.filename, file_data: `data:application/pdf;base64,${raw}` } },
    ];
  } else {
    throw new Error("Formato não suportado. Envie foto (JPG/PNG), PDF da DANFE ou XML da NF-e.");
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você extrai dados de notas fiscais e responde apenas JSON." },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Muitas requisições agora. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    console.error("AI Gateway NF error", res.status, text);
    throw new Error("Não consegui ler a nota fiscal. Tente uma foto mais nítida ou o XML.");
  }

  const json = (await res.json()) as any;
  const txt: string = json?.choices?.[0]?.message?.content ?? "";
  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Não consegui interpretar os dados da nota fiscal.");
  return JSON.parse(txt.slice(start, end + 1));
}

export const parseInvoiceFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ParseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!tenant) return { error: "Nenhum buffet vinculado a esta conta." } as const;

    const parsed = await extractFromAI(data);

    const header: NfHeader = {
      fornecedor: parsed?.fornecedor ?? null,
      cnpj: onlyDigits(parsed?.cnpj),
      numero: parsed?.numero ? String(parsed.numero) : null,
      serie: parsed?.serie ? String(parsed.serie) : null,
      data_emissao: parsed?.data_emissao ?? null,
      chave_acesso: onlyDigits(parsed?.chave_acesso),
      valor_total: Number(parsed?.valor_total ?? 0) || 0,
    };

    const itens: NfItem[] = (Array.isArray(parsed?.itens) ? parsed.itens : [])
      .map((i: any) => ({
        descricao: String(i?.descricao ?? "").trim(),
        quantidade: Number(i?.quantidade ?? 0) || 0,
        unidade: i?.unidade ? String(i.unidade) : null,
        valor_unitario: Number(i?.valor_unitario ?? 0) || 0,
        valor_total:
          Number(i?.valor_total ?? 0) ||
          (Number(i?.quantidade ?? 0) || 0) * (Number(i?.valor_unitario ?? 0) || 0),
      }))
      .filter((i: NfItem) => i.descricao && i.quantidade > 0);

    if (!itens.length) return { error: "Não encontrei produtos legíveis nesta nota fiscal." } as const;

    // Duplicidade — sempre dentro do tenant autenticado
    let duplicate: { id: string; created_at: string } | null = null;
    if (header.chave_acesso) {
      const { data: d } = await supabase
        .from("purchase_invoices")
        .select("id, created_at")
        .eq("tenant_id", tenant.id)
        .eq("access_key", header.chave_acesso)
        .maybeSingle();
      duplicate = (d as any) ?? null;
    }
    if (!duplicate && header.numero) {
      const { data: d } = await supabase
        .from("purchase_invoices")
        .select("id, created_at")
        .eq("tenant_id", tenant.id)
        .eq("nf_number", header.numero)
        .eq("supplier_cnpj", header.cnpj ?? "")
        .maybeSingle();
      duplicate = (d as any) ?? null;
    }

    const { data: products } = await supabase
      .from("stock_products")
      .select("id, name, unit, physical_qty, reserved_qty, active")
      .eq("tenant_id", tenant.id)
      .order("name");

    const matches: NfMatch[] = itens.map((item) => {
      let best: any = null;
      let bestScore = 0;
      for (const p of products ?? []) {
        const s = similarity(item.descricao, (p as any).name);
        if (s > bestScore) {
          bestScore = s;
          best = p;
        }
      }
      const ok = bestScore >= 0.55;
      return {
        item,
        product_id: ok ? best.id : null,
        product_name: ok ? best.name : null,
        product_unit: ok ? best.unit : null,
        product_qty: ok ? Number(best.physical_qty) : null,
        confidence: Math.round(bestScore * 100),
      };
    });

    return {
      header,
      matches,
      duplicate: duplicate ? { id: duplicate.id, created_at: duplicate.created_at } : null,
      products: (products ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        physical_qty: Number(p.physical_qty),
      })),
    } as const;
  });

const CommitInput = z.object({
  header: z.object({
    fornecedor: z.string().nullable().optional(),
    cnpj: z.string().nullable().optional(),
    numero: z.string().nullable().optional(),
    serie: z.string().nullable().optional(),
    data_emissao: z.string().nullable().optional(),
    chave_acesso: z.string().nullable().optional(),
    valor_total: z.number().optional().default(0),
  }),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        descricao: z.string().min(1),
        quantidade: z.number().positive(),
        unidade: z.string().nullable().optional(),
        valor_unitario: z.number().min(0).default(0),
        valor_total: z.number().min(0).default(0),
      }),
    )
    .min(1),
});

export const commitInvoiceStockEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommitInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!tenant) return { error: "Nenhum buffet vinculado a esta conta." } as const;

    const cnpj = onlyDigits(data.header.cnpj ?? null);
    const chave = onlyDigits(data.header.chave_acesso ?? null);
    const numero = data.header.numero ?? null;

    // Duplicidade
    if (chave) {
      const { data: d } = await supabase
        .from("purchase_invoices")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("access_key", chave)
        .maybeSingle();
      if (d) return { error: "Esta nota fiscal já foi lançada no estoque." } as const;
    }
    if (numero) {
      const { data: d } = await supabase
        .from("purchase_invoices")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("nf_number", numero)
        .eq("supplier_cnpj", cnpj ?? "")
        .maybeSingle();
      if (d) return { error: "Esta nota fiscal já foi lançada no estoque." } as const;
    }

    // Só produtos do próprio buffet
    const ids = Array.from(new Set(data.items.map((i) => i.product_id)));
    const { data: owned } = await supabase
      .from("stock_products")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .in("id", ids);
    const ownedIds = new Set((owned ?? []).map((p: any) => p.id));
    if (ownedIds.size !== ids.length) {
      return { error: "Um dos produtos não pertence ao seu estoque." } as const;
    }

    const { data: invoice, error: invErr } = await supabase
      .from("purchase_invoices")
      .insert({
        tenant_id: tenant.id,
        owner_id: userId,
        created_by: userId,
        supplier_name: data.header.fornecedor ?? null,
        supplier_cnpj: cnpj ?? "",
        nf_number: numero,
        nf_series: data.header.serie ?? null,
        access_key: chave,
        issue_date: data.header.data_emissao || null,
        total_value: Number(data.header.valor_total ?? 0) || 0,
        items: data.items as any,
      } as any)
      .select("id")
      .single();

    if (invErr || !invoice) {
      if ((invErr as any)?.code === "23505" || /duplicate key/i.test(invErr?.message ?? "")) {
        return { error: "Esta nota fiscal já foi lançada no estoque." } as const;
      }
      console.error("purchase_invoices insert", invErr);
      return { error: "Não consegui registrar a nota fiscal." } as const;
    }

    const rows = data.items.map((i) => ({
      tenant_id: tenant.id,
      product_id: i.product_id,
      kind: "purchase",
      quantity: i.quantidade,
      unit_price: i.valor_unitario,
      total_price: i.valor_total || i.quantidade * i.valor_unitario,
      source: "nota_fiscal",
      invoice_id: (invoice as any).id,
      created_by: userId,
      notes: `Entrada por NF ${numero ?? "s/nº"}${data.header.fornecedor ? ` — ${data.header.fornecedor}` : ""} (${i.descricao})`,
    }));

    const { error: movErr } = await supabase.from("stock_movements").insert(rows as any);
    if (movErr) {
      await supabase.from("purchase_invoices").delete().eq("id", (invoice as any).id);
      console.error("stock_movements insert", movErr);
      return { error: "Não consegui lançar as entradas no estoque. Nada foi alterado." } as const;
    }

    const { data: after } = await supabase
      .from("stock_products")
      .select("id, name, unit, physical_qty")
      .eq("tenant_id", tenant.id)
      .in("id", ids);

    return {
      ok: true as const,
      invoice_id: (invoice as any).id,
      updated: (after ?? []).map((p: any) => ({
        name: p.name,
        unit: p.unit,
        physical_qty: Number(p.physical_qty),
      })),
    };
  });

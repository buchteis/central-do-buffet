import { ChecklistPreDefinido } from "@/components/ChecklistPreDefinido";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcQuote, resolveTierPrice } from "@/lib/quote-calc";
import { brl } from "@/lib/format";
import { openQuotePdf } from "@/lib/quote-pdf";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { maskCpfCnpj } from "@/lib/doc";

export const Route = createFileRoute("/_authenticated/orcamentos/novo")({
  head: () => ({ meta: [{ title: "Novo orçamento — Meu Churras" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    leadId: typeof s.leadId === "string" ? s.leadId : undefined,
    quoteId: typeof s.quoteId === "string" ? s.quoteId : undefined,
  }),
  component: NewQuotePage,
});

const schema = z
  .object({
    client_id: z.string().uuid().optional().or(z.literal("")),
    package_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um pacote"),
    event_date: z.string().min(1, "Data obrigatória"),
    adults: z.number().int().min(0).max(9999),
    children_count: z.number().int().min(0).max(9999),
    child_price: z.number().min(0).max(999999),
  })
  .passthrough();

function NewQuotePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { leadId, quoteId } = Route.useSearch();
  const { data: access } = useTenantAccess();

  const { data: lead } = useQuery({
    queryKey: ["lead-prefill", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingQuote } = useQuery({
    queryKey: ["quote-prefill", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(id, name, cpf, phone, whatsapp, email, address, city)")
        .eq("id", quoteId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-select-full"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, cpf, address, phone, email").order("name");
      return data ?? [];
    },
  });
  const { data: packages } = useQuery({
    queryKey: ["packages-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("packages")
        .select("id, name, price_per_person")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });
  const { data: tiers } = useQuery({
    queryKey: ["packages-tiers-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("package_price_tiers")
        .select("id, package_id, min_guests, max_guests, price_per_person, position, updated_at")
        .order("position", { ascending: true })
        .order("min_guests", { ascending: true });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        package_id: string;
        min_guests: number;
        max_guests: number;
        price_per_person: number;
        position: number;
        updated_at: string | null;
      }[];
    },
  });
  const { data: unitItemsCatalog } = useQuery({
    queryKey: ["packages-unit-items-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("package_unit_items")
        .select("id, package_id, product_id, name, unit, unit_price, default_qty, position")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        package_id: string;
        product_id: string | null;
        name: string;
        unit: string;
        unit_price: number;
        default_qty: number;
        position: number;
      }[];
    },
  });
  const { data: settings } = useQuery({
    queryKey: ["buffet-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("buffet_settings").select("*").maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    client_id: "",
    event_date: "",
    event_time: "",
    event_address: "",
    event_type: "",
    adults: 0,
    children_count: 0,
    child_price: 0,
    notes: "",
    has_grill: false,
    has_freezer: false,
    payment_method: "PIX" as "PIX" | "Dados Bancários" | "Dinheiro",
  });
  // Multiple packages support: list of selected package ids (empty string = "pick one" row).
  const [packageLines, setPackageLines] = useState<string[]>([""]);
  const [customExtras, setCustomExtras] = useState<{ description: string; value: number }[]>([]);
  const [unitQty, setUnitQty] = useState<Record<string, number>>({});
  const [unitPriceSnapshot, setUnitPriceSnapshot] = useState<Record<string, number>>({});

  // Manual overrides — administrator has total freedom to edit price per person (sum),
  // entry (50%) and balance directly. `null` means "use auto value".
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const [entryOverride, setEntryOverride] = useState<number | null>(null);
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null);

  // Rascunho persistente: mantém o que já foi preenchido/carregado ao sair da aba e voltar.
  const draftKey = `cdb:quote-draft:${quoteId ?? leadId ?? "new"}`;
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(draftKey) : null;
      if (raw) {
        const d = JSON.parse(raw);
        // Só restaura rascunhos completos (salvos depois do pré-preenchimento),
        // evitando sobrescrever pacotes/itens do orçamento com um estado parcial.
        if (d?.ready === true && d?.version === 2) {
          if (d?.form) setForm((f) => ({ ...f, ...d.form }));
          if (Array.isArray(d?.packageLines)) setPackageLines(d.packageLines);
          if (Array.isArray(d?.customExtras)) setCustomExtras(d.customExtras);
          if (d?.unitQty && typeof d.unitQty === "object") setUnitQty(d.unitQty);
          if (d?.unitPriceSnapshot && typeof d.unitPriceSnapshot === "object") {
            setUnitPriceSnapshot(d.unitPriceSnapshot);
          }
          setPriceOverride(d?.priceOverride ?? null);
          setEntryOverride(d?.entryOverride ?? null);
          setBalanceOverride(d?.balanceOverride ?? null);
          setHasDraft(true);
        } else {
          sessionStorage.removeItem(draftKey);
        }
      }
    } catch {
      /* ignore */
    }
    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Marcado como pronto assim que o pré-preenchimento (orçamento/lead) terminou.
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (!draftLoaded || !draftReady || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          ready: true,
          version: 2,
          form,
          packageLines,
          customExtras,
          unitQty,
          unitPriceSnapshot,
          priceOverride,
          entryOverride,
          balanceOverride,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [
    draftReady,

    draftLoaded,
    draftKey,
    form,
    packageLines,
    customExtras,
    unitQty,
    unitPriceSnapshot,
    priceOverride,
    entryOverride,
    balanceOverride,
  ]);

  const totalGuests = (Number(form.adults) || 0) + (Number(form.children_count) || 0);

  const priceForPackage = (packageId: string, guests: number): number => {
    const pkgTiers = (tiers ?? []).filter((t) => t.package_id === packageId);
    const pkg = (packages ?? []).find((p) => p.id === packageId) as any;
    return resolveTierPrice(pkgTiers, guests, Number(pkg?.price_per_person ?? 0) || 0);
  };

  const selectedPackages = useMemo(
    () =>
      packageLines
        .map((id) => (packages ?? []).find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({
          id: p!.id,
          name: p!.name,
          price_per_person: priceForPackage(p!.id, totalGuests),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [packageLines, packages, tiers, totalGuests],
  );
  const primaryPackage = selectedPackages[0];
  const packagesSumPerPerson = selectedPackages.reduce((s, p) => s + Number(p.price_per_person ?? 0), 0);
  const effectivePrice = priceOverride ?? packagesSumPerPerson;

  // Itens unitários disponíveis nos pacotes selecionados (cobrados por unidade).
  const availableUnitItems = useMemo(() => {
    const ids = new Set(selectedPackages.map((p) => p.id));
    return (unitItemsCatalog ?? []).filter((i) => ids.has(i.package_id));
  }, [unitItemsCatalog, selectedPackages]);

  // Qtd escolhida por item unitário (default = default_qty do pacote).
  // Ao editar um orçamento existente (ex.: vindo do link público), respeita exatamente
  // o que foi escolhido: itens não escolhidos ficam em 0.
  useEffect(() => {
    if (!draftLoaded) return;
    if (!availableUnitItems.length) return;
    setUnitQty((old) => {
      const next = { ...old };
      let changed = false;
      for (const it of availableUnitItems) {
        if (next[it.id] === undefined) {
          next[it.id] = quoteId || hasDraft ? 0 : Number(it.default_qty) || 0;
          changed = true;
        }
      }
      return changed ? next : old;
    });
  }, [availableUnitItems, quoteId, draftLoaded, hasDraft]);

  const selectedUnitItems = useMemo(
    () =>
      availableUnitItems
        .map((i) => ({
          item_id: i.id,
          product_id: i.product_id,
          name: i.name,
          unit: i.unit,
          unit_price: Number(unitPriceSnapshot[i.id] ?? i.unit_price) || 0,
          qty: Number(unitQty[i.id] ?? 0) || 0,
        }))
        .filter((i) => i.qty > 0),
    [availableUnitItems, unitQty, unitPriceSnapshot],
  );

  const autoBreakdown = useMemo(
    () =>
      calcQuote({
        pricePerPerson: effectivePrice,
        adults: Number(form.adults) || 0,
        childrenCount: Number(form.children_count) || 0,
        childPrice: Number(form.child_price) || 0,
        customExtras,
        unitItems: selectedUnitItems,
      }),
    [effectivePrice, form.adults, form.children_count, form.child_price, customExtras, selectedUnitItems],
  );

  const breakdown = useMemo(() => {
    const entry = entryOverride ?? autoBreakdown.entry;
    const balance = balanceOverride ?? Math.round((autoBreakdown.total - entry) * 100) / 100;
    return { ...autoBreakdown, entry, balance };
  }, [autoBreakdown, entryOverride, balanceOverride]);

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ ...form, package_ids: packageLines.filter(Boolean) });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");

      if (!form.client_id && !lead && !existingQuote?.client_id) {
        throw new Error("Selecione um cliente");
      }
      const clientId: string | null = form.client_id || (existingQuote?.client_id as string) || null;

      const valid = new Date();
      valid.setDate(valid.getDate() + 7);

      const pkgIds = packageLines.filter((id) => !!id);
      const pkgList = pkgIds
        .map((id) => (packages ?? []).find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({
          package_id: p!.id,
          name: p!.name,
          price_per_person: priceForPackage(p!.id, totalGuests),
        }));

      const prevExtras = ((existingQuote as any)?.extras ?? {}) as any;
      const payload: any = {
        client_id: clientId,
        package_id: pkgList[0]?.package_id ?? null,
        event_date: form.event_date,
        event_time: form.event_time || null,
        event_address: form.event_address || null,
        event_type: form.event_type || null,
        adults: form.adults,
        children_7_10: form.children_count,
        children_0_6: 0,
        has_grill: form.has_grill,
        has_freezer: form.has_freezer,
        extras: {
          ...prevExtras,
          child_price: form.child_price,
          price_per_person_override: priceOverride,
          entry_override: entryOverride,
          balance_override: balanceOverride,
          packages: pkgList,
          custom: customExtras.filter((e) => e.description.trim() !== "" || Number(e.value) > 0),
          unit_items: selectedUnitItems,
        },
        notes: form.notes || null,
        total_value: breakdown.total,
        entry_value: breakdown.entry,
        balance_value: breakdown.balance,
        valid_until: valid.toISOString().slice(0, 10),
        payment_method: form.payment_method,
      };

      let data: any;
      if (quoteId) {
        // Completing / editing an existing quote (e.g. pre-orçamento from public form).
        // Move it out of "novo" so it enters the pipeline as active.
        const nextStatus = existingQuote?.status === "novo" ? "em_andamento" : existingQuote?.status;
        const { data: upd, error } = await supabase
          .from("quotes")
          .update({ ...payload, status: nextStatus as any })
          .eq("id", quoteId)
          .select()
          .single();
        if (error) throw error;
        data = upd;
      } else {
        const { data: ins, error } = await supabase
          .from("quotes")
          .insert({
            ...payload,
            owner_id: userRes.user.id,
            status: "novo" as const,
          } as any)
          .select()
          .single();
        if (error) throw error;
        data = ins;
      }

      // When creating from a lead: convert the lead and auto-create the linked event.
      if (leadId && data?.id) {
        try {
          await supabase
            .from("leads")
            .update({ status: "convertido" as any, converted_quote_id: data.id } as any)
            .eq("id", leadId);

          const guestCount = (Number(form.adults) || 0) + (Number(form.children_count) || 0);

          const { data: existingEvent } = await supabase
            .from("events")
            .select("id")
            .eq("quote_id", data.id)
            .maybeSingle();

          if (!existingEvent) {
            await supabase.from("events").insert({
              owner_id: userRes.user.id,
              tenant_id: access?.tenant?.id ?? null,
              client_id: clientId,
              quote_id: data.id,
              package_id: pkgList[0]?.package_id ?? null,
              event_date: form.event_date,
              event_time: form.event_time || null,
              event_address: form.event_address || null,
              guest_count: guestCount,
              total_value: breakdown.total,
              status: "agendado" as any,
              notes: form.notes || null,
            } as any);
          }
        } catch (e) {
          console.warn("[quote-from-lead] post-save link failed", e);
        }
      }

      return data;
    },
    onSuccess: () => {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-select-full"] });
      toast.success(
        quoteId ? "Orçamento atualizado!" : leadId ? "Orçamento criado e evento agendado!" : "Orçamento criado!",
      );
      navigate({ to: leadId ? "/agenda" : "/orcamentos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Prefill from lead when data arrives (only once). Never creates a client here.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!draftLoaded) return;
    if (hasDraft) {
      setPrefilled(true);
      return;
    }
    if (!leadId || prefilled || !lead) return;
    // Wait for reference lists so Select components can match ids to items.
    if (!packages || !clients) return;
    if ((lead as any).converted_quote_id) {
      toast.info("Este lead já possui um orçamento vinculado.");
      navigate({ to: "/orcamentos" });
      return;
    }
    // Resolve package: prefer package_id from lead; otherwise match by name (package_desired)
    let pkgId: string = (lead as any).package_id ?? "";
    if (!pkgId && (lead as any).package_desired && packages?.length) {
      const target = String((lead as any).package_desired)
        .trim()
        .toLowerCase();
      const match = packages.find((p) => p.name.trim().toLowerCase() === target);
      if (match) pkgId = match.id;
    }
    if (pkgId) setPackageLines([pkgId]);
    setForm((f) => ({
      ...f,
      client_id: "",
      event_date: (lead as any).event_date ?? f.event_date,
      event_time: (lead as any).event_time ?? f.event_time,
      event_address: (lead as any).event_address ?? f.event_address,
      event_type: (lead as any).event_type ?? f.event_type,
      adults: (lead as any).guest_count ?? f.adults,
      notes: (lead as any).notes ?? f.notes,
    }));
    setPrefilled(true);
  }, [lead, packages, clients, leadId, prefilled, navigate, draftLoaded, hasDraft]);

  // Prefill from an existing quote (e.g. pré-orçamento vindo do link público).
  const [prefilledQuote, setPrefilledQuote] = useState(false);
  useEffect(() => {
    if (!draftLoaded) return;
    if (hasDraft) {
      setPrefilledQuote(true);
      return;
    }
    if (!quoteId || prefilledQuote || !existingQuote) return;
    // Only prefill once reference lists are available so <Select> values map to items.
    if (!packages || !clients) return;

    const q: any = existingQuote;
    const extras: any = q.extras ?? {};
    const requester: any = extras.requester ?? {};
    // Packages: preserve every public selection. Older records may have lost a
    // zero-price package in extras.packages, so recover it from each selected
    // unit item's catalog relationship as well.
    let lines: string[] = [];
    if (Array.isArray(extras.packages) && extras.packages.length) {
      lines = extras.packages.map((p: any) => p.package_id).filter(Boolean);
    } else if (q.package_id) {
      lines = [q.package_id];
    }
    if (Array.isArray(extras.unit_items) && unitItemsCatalog) {
      const packageIdsFromItems = extras.unit_items
        .map((item: any) => unitItemsCatalog.find((catalogItem) => catalogItem.id === item?.item_id)?.package_id)
        .filter(Boolean) as string[];
      lines = Array.from(new Set([...lines, ...packageIdsFromItems]));
    }
    if (lines.length === 0) lines = [""];
    setPackageLines(lines);

    setForm((f) => ({
      ...f,
      client_id: q.client_id ?? "",
      event_date: q.event_date ?? f.event_date,
      event_time: q.event_time ?? f.event_time,
      event_address: q.event_address ?? f.event_address,
      event_type: q.event_type ?? f.event_type,
      adults: q.adults ?? f.adults,
      children_count: (q.children_7_10 ?? 0) + (q.children_0_6 ?? 0),
      child_price: Number(extras.child_price ?? 0),
      notes: q.notes ?? requester.notes ?? f.notes,
      has_grill: !!q.has_grill,
      has_freezer: !!q.has_freezer,
      payment_method: (q.payment_method ?? f.payment_method) as typeof f.payment_method,
    }));

    if (Array.isArray(extras.custom)) setCustomExtras(extras.custom);
    if (Array.isArray(extras.unit_items)) {
      const map: Record<string, number> = {};
      const prices: Record<string, number> = {};
      for (const it of extras.unit_items) {
        if (it?.item_id) {
          map[it.item_id] = Number(it.qty) || 0;
          prices[it.item_id] = Number(it.unit_price) || 0;
        }
      }
      setUnitQty((old) => ({ ...old, ...map }));
      setUnitPriceSnapshot((old) => ({ ...old, ...prices }));
    }
    if (extras.price_per_person_override != null) {
      setPriceOverride(Number(extras.price_per_person_override));
    } else if (Array.isArray(extras.packages) && extras.packages.length) {
      // Mantém exatamente o valor por pessoa que o cliente viu no link público,
      // evitando divergência entre o card do orçamento e a tela de edição.
      const snapSum = extras.packages.reduce((s: number, p: any) => s + (Number(p?.price_per_person) || 0), 0);
      if (snapSum > 0) setPriceOverride(snapSum);
    }

    if (extras.entry_override != null) setEntryOverride(Number(extras.entry_override));
    if (extras.balance_override != null) setBalanceOverride(Number(extras.balance_override));

    setPrefilledQuote(true);
  }, [quoteId, existingQuote, prefilledQuote, packages, clients, unitItemsCatalog, draftLoaded, hasDraft]);

  // Só começa a gravar rascunho quando o formulário já está completo,
  // para que voltar de outra aba não apague pacotes/itens carregados.
  useEffect(() => {
    if (!draftLoaded || draftReady) return;
    if (quoteId) {
      if (prefilledQuote && (unitItemsCatalog ?? null) !== null) setDraftReady(true);
      return;
    }
    if (leadId) {
      if (prefilled) setDraftReady(true);
      return;
    }
    setDraftReady(true);
  }, [draftLoaded, draftReady, quoteId, leadId, prefilled, prefilledQuote, unitItemsCatalog]);



  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/orcamentos"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          {quoteId ? "Completar orçamento" : "Novo orçamento"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {quoteId
            ? "Dados do solicitante preenchidos. Ajuste pacotes, preços e salve."
            : "Cálculo automático de valor total, entrada e saldo."}
        </p>
      </div>

      {quoteId &&
        existingQuote &&
        (() => {
          const q: any = existingQuote;
          const cli: any = q.clients ?? {};
          const req: any = (q.extras as any)?.requester ?? {};
          const rows: Array<[string, string]> = [
            ["Nome", cli.name ?? req.name ?? "—"],
            ["CPF/CNPJ", maskCpfCnpj(cli.cpf ?? req.cpf ?? "") || "—"],
            ["Telefone", cli.phone ?? req.phone ?? "—"],
            ["WhatsApp", cli.whatsapp ?? req.whatsapp ?? "—"],
            ["E-mail", cli.email ?? req.email ?? "—"],
            ["Endereço", cli.address ?? req.address ?? "—"],
            ["Cidade", cli.city ?? req.city ?? "—"],
          ];
          return (
            <div className="bg-muted/40 border border-border rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">
                Dados do solicitante (link público)
              </div>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-muted-foreground min-w-24">{k}:</dt>
                    <dd className="font-medium break-all">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Cliente / Solicitante *</Label>
              {lead && !form.client_id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input readOnly value={(lead as any).name ?? ""} placeholder="Nome do solicitante" />
                  <Input readOnly value={maskCpfCnpj((lead as any).cpf ?? "")} placeholder="CPF/CNPJ" />
                  <Input readOnly value={(lead as any).phone ?? ""} placeholder="Telefone" />
                  <Input readOnly value={(lead as any).email ?? ""} placeholder="E-mail" />
                </div>
              ) : (
                <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    {(clients ?? []).length === 0 && (
                      <div className="p-4 text-xs text-muted-foreground">Cadastre um cliente antes.</div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Pacotes *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPackageLines((l) => [...l, ""])}
                  disabled={(packages ?? []).length === 0}
                >
                  <Plus className="size-3.5" /> Adicionar pacote
                </Button>
              </div>
              <div className="space-y-2">
                {packageLines.map((pid, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Select
                        value={pid}
                        onValueChange={(v) => setPackageLines((arr) => arr.map((x, idx) => (idx === i ? v : x)))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um pacote…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const all = packages ?? [];
                            if (all.length === 0) {
                              return <div className="p-4 text-xs text-muted-foreground">Cadastre um pacote antes.</div>;
                            }
                            return all.map((p: any) => {
                              const applied = priceForPackage(p.id, totalGuests);
                              return (
                                <SelectItem
                                  key={p.id}
                                  value={p.id}
                                  disabled={packageLines.includes(p.id) && p.id !== pid}
                                >
                                  {p.name}
                                  {applied > 0 && totalGuests > 0 && (
                                    <span className="text-muted-foreground">
                                      {" · "}
                                      {brl(applied)}/pessoa
                                    </span>
                                  )}
                                </SelectItem>
                              );
                            });
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    {packageLines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setPackageLines((arr) => arr.filter((_, idx) => idx !== i))}
                        aria-label="Remover pacote"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {selectedPackages.length > 1 && (
                <p className="text-[11px] text-muted-foreground">
                  Total por pessoa: <b>{brl(packagesSumPerPerson)}</b> (soma de {selectedPackages.length} pacotes)
                </p>
              )}
            </div>
          </div>

          {availableUnitItems.length > 0 && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
              <div>
                <Label className="font-semibold">Itens unitários</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Cobrados por unidade (qtd × preço unitário), independente do nº de convidados. A quantidade é baixada
                  do estoque quando o orçamento é fechado.
                </p>
              </div>
              <div className="space-y-2">
                {availableUnitItems.map((it) => {
                  const qty = Number(unitQty[it.id] ?? 0) || 0;
                  return (
                    <div key={it.id} className="flex flex-wrap items-center gap-3 bg-background p-3 rounded-lg border">
                      <span className="flex-1 min-w-0 text-sm">
                        {it.name}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({brl(Number(it.unit_price) || 0)}/{it.unit})
                        </span>
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-24"
                        value={unitQty[it.id] ?? 0}
                        onChange={(e) => setUnitQty((old) => ({ ...old, [it.id]: Number(e.target.value) || 0 }))}
                      />
                      <span className="w-24 text-right text-sm font-mono font-semibold">
                        {brl(qty * (Number(it.unit_price) || 0))}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Subtotal itens unitários: <b>{brl(breakdown.unitItemsSubtotal)}</b>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data do evento *</Label>
              <Input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input
                type="time"
                value={form.event_time}
                onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input
                placeholder="Aniversário, casamento…"
                value={form.event_type}
                onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Endereço do evento</Label>
            <Input
              value={form.event_address}
              onChange={(e) => setForm((f) => ({ ...f, event_address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <NumField label="Adultos" value={form.adults} onChange={(v) => setForm((f) => ({ ...f, adults: v }))} />
            <div className="space-y-2">
              <Label>Preço por pessoa (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={effectivePrice}
                onChange={(e) => setPriceOverride(Number(e.target.value) || 0)}
              />
              <p className="text-[10px] text-muted-foreground">Edite livremente o valor por adulto.</p>
            </div>
            <NumField
              label="Nº de crianças"
              value={form.children_count}
              onChange={(v) => setForm((f) => ({ ...f, children_count: v }))}
            />
            <NumField
              label="Valor por criança (R$)"
              value={form.child_price}
              onChange={(v) => setForm((f) => ({ ...f, child_price: v }))}
              step="0.01"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <ToggleRow
              label="Possui churrasqueira"
              checked={form.has_grill}
              onChange={(v) => setForm((f) => ({ ...f, has_grill: v }))}
            />
            <ToggleRow
              label="Possui freezer"
              checked={form.has_freezer}
              onChange={(v) => setForm((f) => ({ ...f, has_freezer: v }))}
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label>Acréscimos manuais</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCustomExtras((arr) => [...arr, { description: "", value: 0 }])}
              >
                <Plus className="size-3.5" /> Adicionar
              </Button>
            </div>
            {customExtras.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum acréscimo. Clique em "Adicionar" para incluir itens extras (ex.: taxa de deslocamento,
                decoração).
              </p>
            )}
            {customExtras.map((ex, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={ex.description}
                    placeholder="Ex.: Taxa de deslocamento"
                    onChange={(e) =>
                      setCustomExtras((arr) =>
                        arr.map((it, idx) => (idx === i ? { ...it, description: e.target.value } : it)),
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={ex.value}
                    onChange={(e) =>
                      setCustomExtras((arr) =>
                        arr.map((it, idx) => (idx === i ? { ...it, value: Number(e.target.value) || 0 } : it)),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCustomExtras((arr) => arr.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento *</Label>
            <Select
              value={form.payment_method}
              onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v as typeof f.payment_method }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Dados Bancários">Dados Bancários</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Esta opção será usada automaticamente na geração do contrato.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/orcamentos" })}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  if (selectedPackages.length === 0) {
                    toast.error("Selecione ao menos um pacote para gerar o PDF");
                    return;
                  }
                  const cli = (clients ?? []).find((c: any) => c.id === form.client_id) as any;
                  const clientForPdf = cli
                    ? { name: cli.name, cpf: cli.cpf, address: cli.address, phone: cli.phone, email: cli.email }
                    : lead
                      ? {
                          name: (lead as any).name,
                          cpf: null,
                          address: (lead as any).event_address ?? (lead as any).city ?? null,
                          phone: (lead as any).phone ?? (lead as any).whatsapp ?? null,
                          email: (lead as any).email ?? null,
                        }
                      : null;
                  if (!clientForPdf) {
                    toast.error("Selecione um cliente para gerar o PDF");
                    return;
                  }
                  await openQuotePdf({
                    issuedAt: new Date(),
                    validUntil: (() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      return d;
                    })(),
                    client: clientForPdf,

                    event: {
                      date: form.event_date || null,
                      time: form.event_time || null,
                      address: form.event_address || null,
                      type: form.event_type || null,
                      adults: form.adults,
                      childrenCount: form.children_count,
                    },
                    package: {
                      name: selectedPackages.map((p) => p.name).join(" + "),
                      pricePerPerson: effectivePrice,
                    },
                    packages:
                      priceOverride == null
                        ? selectedPackages.map((p) => ({ name: p.name, price_per_person: p.price_per_person }))
                        : undefined,

                    childPrice: form.child_price,
                    extras: customExtras.filter((e) => e.description.trim() !== "" || Number(e.value) > 0),
                    unitItems: selectedUnitItems,
                    breakdown,
                    paymentMethod: form.payment_method,
                    notes: form.notes,
                    hasGrill: form.has_grill,
                    hasFreezer: form.has_freezer,
                    buffet: (settings as any) ?? null,
                  });
                } catch (err: any) {
                  toast.error(err?.message ?? "Falha ao gerar PDF");
                }
              }}
            >
              Gerar PDF
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Salvando…" : "Salvar orçamento"}
            </Button>
          </div>
        </form>

        <div className="lg:col-span-2">
          <ChecklistPreDefinido
            guests={(Number(form.adults) || 0) + (Number(form.children_count) || 0)}
            eventName={form.event_type || null}
            clientName={(clients ?? []).find((c: any) => c.id === form.client_id)?.name ?? (lead as any)?.name ?? null}
            eventDate={form.event_date || null}
            eventTime={form.event_time || null}
            eventAddress={form.event_address || null}
            phone={
              (clients ?? []).find((c: any) => c.id === form.client_id)?.phone ??
              (lead as any)?.phone ??
              (lead as any)?.whatsapp ??
              null
            }
          />
        </div>

        <aside className="bg-card border border-border rounded-2xl p-6 space-y-4 h-fit sticky top-20">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Resumo</div>
            <div className="text-xs text-muted-foreground mt-1">Cálculo automático em tempo real</div>
          </div>

          <SummaryRow label="Adultos" value={brl(breakdown.adultsSubtotal)} />
          <SummaryRow
            label={`Crianças (${form.children_count} × ${brl(form.child_price)})`}
            value={brl(breakdown.childrenSubtotal)}
          />
          <SummaryRow label="Preço por pessoa" value={brl(effectivePrice)} />
          {breakdown.unitItemsSubtotal > 0 && (
            <SummaryRow label="Itens unitários" value={brl(breakdown.unitItemsSubtotal)} />
          )}
          <SummaryRow label="Subtotal" value={brl(breakdown.subtotal)} />
          {breakdown.extras > 0 && <SummaryRow label="Acréscimos" value={brl(breakdown.extras)} />}

          <div className="h-px bg-border" />

          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</span>
            <span className="text-2xl font-extrabold text-primary font-mono">{brl(breakdown.total)}</span>
          </div>

          <div className="pt-2 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Entrada</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={breakdown.entry}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  setEntryOverride(v);
                }}
                className="h-8 w-32 text-right font-mono"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Saldo</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={breakdown.balance}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  setBalanceOverride(v);
                }}
                className="h-8 w-32 text-right font-mono"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/40">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

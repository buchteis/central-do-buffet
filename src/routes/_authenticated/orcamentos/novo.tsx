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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcQuote } from "@/lib/quote-calc";
import { brl } from "@/lib/format";
import { openQuotePdf } from "@/lib/quote-pdf";
import { useTenantAccess } from "@/hooks/useTenantAccess";

export const Route = createFileRoute("/_authenticated/orcamentos/novo")({
  head: () => ({ meta: [{ title: "Novo orçamento — Meu Churras" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    leadId: typeof s.leadId === "string" ? s.leadId : undefined,
  }),
  component: NewQuotePage,
});


const schema = z.object({
  client_id: z.string().uuid().optional().or(z.literal("")),
  package_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um pacote"),
  event_date: z.string().min(1, "Data obrigatória"),
  adults: z.number().int().min(0).max(9999),
  children_count: z.number().int().min(0).max(9999),
  child_price: z.number().min(0).max(999999),
}).passthrough();


function NewQuotePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { leadId } = Route.useSearch();
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


  const { data: clients } = useQuery({
    queryKey: ["clients-select-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, cpf, address, phone, email")
        .order("name");
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
  const [customExtras, setCustomExtras] = useState<
    { description: string; value: number }[]
  >([]);

  // Manual overrides — administrator has total freedom to edit price per person (sum),
  // entry (50%) and balance directly. `null` means "use auto value".
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const [entryOverride, setEntryOverride] = useState<number | null>(null);
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null);

  const selectedPackages = useMemo(
    () =>
      packageLines
        .map((id) => (packages ?? []).find((p) => p.id === id))
        .filter(Boolean) as { id: string; name: string; price_per_person: number }[],
    [packageLines, packages],
  );
  const primaryPackage = selectedPackages[0];
  const packagesSumPerPerson = selectedPackages.reduce(
    (s, p) => s + Number(p.price_per_person ?? 0),
    0,
  );
  const effectivePrice = priceOverride ?? packagesSumPerPerson;

  const autoBreakdown = useMemo(
    () =>
      calcQuote({
        pricePerPerson: effectivePrice,
        adults: Number(form.adults) || 0,
        childrenCount: Number(form.children_count) || 0,
        childPrice: Number(form.child_price) || 0,
        customExtras,
      }),
    [effectivePrice, form.adults, form.children_count, form.child_price, customExtras],
  );

  const breakdown = useMemo(() => {
    const entry = entryOverride ?? autoBreakdown.entry;
    const balance =
      balanceOverride ?? Math.round((autoBreakdown.total - entry) * 100) / 100;
    return { ...autoBreakdown, entry, balance };
  }, [autoBreakdown, entryOverride, balanceOverride]);


  const mut = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ ...form, package_ids: packageLines.filter(Boolean) });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");

      // Use selected client if any. Never auto-create a client from a lead here —
      // client cadastro só acontece por ação explícita de conversão.
      if (!form.client_id && !lead) {
        throw new Error("Selecione um cliente");
      }
      const clientId: string | null = form.client_id || null;

      const valid = new Date();
      valid.setDate(valid.getDate() + 7);

      const pkgIds = packageLines.filter((id) => !!id);
      const pkgList = pkgIds
        .map((id) => (packages ?? []).find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({
          package_id: p!.id,
          name: p!.name,
          price_per_person: Number(p!.price_per_person ?? 0),
        }));

      const { data, error } = await supabase
        .from("quotes")
        .insert({
          owner_id: userRes.user.id,
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
            child_price: form.child_price,
            price_per_person_override: priceOverride,
            entry_override: entryOverride,
            balance_override: balanceOverride,
            packages: pkgList,
            custom: customExtras.filter(
              (e) => e.description.trim() !== "" || Number(e.value) > 0,
            ),
          },

          notes: form.notes || null,
          total_value: breakdown.total,
          entry_value: breakdown.entry,
          balance_value: breakdown.balance,
          valid_until: valid.toISOString().slice(0, 10),
          status: "novo" as const,
          payment_method: form.payment_method,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // When creating from a lead: convert the lead and auto-create the linked event.
      if (leadId && data?.id) {
        try {
          await supabase
            .from("leads")
            .update({ status: "convertido" as any, converted_quote_id: data.id } as any)
            .eq("id", leadId);

          const guestCount =
            (Number(form.adults) || 0) + (Number(form.children_count) || 0);

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
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-select-full"] });
      toast.success(leadId ? "Orçamento criado e evento agendado!" : "Orçamento criado!");
      navigate({ to: leadId ? "/agenda" : "/orcamentos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  // Prefill from lead when data arrives (only once). Never creates a client here.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!leadId || prefilled || !lead) return;
    if ((lead as any).converted_quote_id) {
      toast.info("Este lead já possui um orçamento vinculado.");
      navigate({ to: "/orcamentos" });
      return;
    }
    // Resolve package: prefer package_id from lead; otherwise match by name (package_desired)
    let pkgId: string = (lead as any).package_id ?? "";
    if (!pkgId && (lead as any).package_desired && packages?.length) {
      const target = String((lead as any).package_desired).trim().toLowerCase();
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
  }, [lead, packages, leadId, prefilled, navigate]);





  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/orcamentos"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Novo orçamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cálculo automático de valor total, entrada e saldo.
        </p>
      </div>

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
                  <Input readOnly value={(lead as any).cpf ?? ""} placeholder="CPF" />
                  <Input readOnly value={(lead as any).phone ?? ""} placeholder="Telefone" />
                  <Input readOnly value={(lead as any).email ?? ""} placeholder="E-mail" />
                </div>
              ) : (
                <Select
                  value={form.client_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
                >
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
                      <div className="p-4 text-xs text-muted-foreground">
                        Cadastre um cliente antes.
                      </div>
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
                        onValueChange={(v) =>
                          setPackageLines((arr) =>
                            arr.map((x, idx) => (idx === i ? v : x)),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um pacote…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(packages ?? []).map((p) => (
                            <SelectItem
                              key={p.id}
                              value={p.id}
                              disabled={packageLines.includes(p.id) && p.id !== pid}
                            >
                              {p.name} · {brl(p.price_per_person)}/pessoa
                            </SelectItem>
                          ))}
                          {(packages ?? []).length === 0 && (
                            <div className="p-4 text-xs text-muted-foreground">
                              Cadastre um pacote antes.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {packageLines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setPackageLines((arr) => arr.filter((_, idx) => idx !== i))
                        }
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
            <NumField
              label="Adultos"
              value={form.adults}
              onChange={(v) => setForm((f) => ({ ...f, adults: v }))}
            />
            <div className="space-y-2">
              <Label>Preço por pessoa (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={effectivePrice}
                onChange={(e) => setPriceOverride(Number(e.target.value) || 0)}
              />
              <p className="text-[10px] text-muted-foreground">
                Edite livremente o valor por adulto.
              </p>
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


          <div className="grid grid-cols-2 gap-3 pt-2">
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
                onClick={() =>
                  setCustomExtras((arr) => [...arr, { description: "", value: 0 }])
                }
              >
                <Plus className="size-3.5" /> Adicionar
              </Button>
            </div>
            {customExtras.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum acréscimo. Clique em "Adicionar" para incluir itens extras (ex.: taxa de deslocamento, decoração).
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
                        arr.map((it, idx) =>
                          idx === i ? { ...it, description: e.target.value } : it,
                        ),
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
                        arr.map((it, idx) =>
                          idx === i
                            ? { ...it, value: Number(e.target.value) || 0 }
                            : it,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setCustomExtras((arr) => arr.filter((_, idx) => idx !== i))
                  }
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
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/orcamentos" })}
            >
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
                    validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })(),
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

                    childPrice: form.child_price,
                    extras: customExtras.filter(
                      (e) => e.description.trim() !== "" || Number(e.value) > 0,
                    ),
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

        <aside className="bg-card border border-border rounded-2xl p-6 space-y-4 h-fit sticky top-20">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Resumo
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Cálculo automático em tempo real
            </div>
          </div>

          <SummaryRow label="Adultos" value={brl(breakdown.adultsSubtotal)} />
          <SummaryRow
            label={`Crianças (${form.children_count} × ${brl(form.child_price)})`}
            value={brl(breakdown.childrenSubtotal)}
          />
          <SummaryRow label="Preço por pessoa" value={brl(effectivePrice)} />
          <SummaryRow label="Subtotal" value={brl(breakdown.subtotal)} />
          {breakdown.extras > 0 && <SummaryRow label="Acréscimos" value={brl(breakdown.extras)} />}

          <div className="h-px bg-border" />

          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Total
            </span>
            <span className="text-2xl font-extrabold text-primary font-mono">
              {brl(breakdown.total)}
            </span>
          </div>

          <div className="pt-2 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Entrada</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={breakdown.entry}
                onChange={(e) => setEntryOverride(Number(e.target.value) || 0)}
                className="h-8 max-w-[140px] text-right font-mono"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Saldo</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={breakdown.balance}
                onChange={(e) => setBalanceOverride(Number(e.target.value) || 0)}
                className="h-8 max-w-[140px] text-right font-mono"
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
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}

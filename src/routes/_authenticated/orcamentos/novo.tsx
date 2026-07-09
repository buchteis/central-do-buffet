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
  client_id: z.string().uuid("Selecione um cliente"),
  package_id: z.string().uuid("Selecione um pacote"),
  event_date: z.string().min(1, "Data obrigatória"),
  adults: z.number().int().min(0).max(9999),
  children_count: z.number().int().min(0).max(9999),
  child_price: z.number().min(0).max(999999),
}).passthrough();

function NewQuotePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

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
    package_id: "",
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
  const [customExtras, setCustomExtras] = useState<
    { description: string; value: number }[]
  >([]);

  const selectedPackage = packages?.find((p) => p.id === form.package_id);
  const breakdown = useMemo(
    () =>
      calcQuote({
        pricePerPerson: Number(selectedPackage?.price_per_person ?? 0),
        adults: Number(form.adults) || 0,
        childrenCount: Number(form.children_count) || 0,
        childPrice: Number(form.child_price) || 0,
        customExtras,
      }),
    [form, selectedPackage, customExtras],
  );

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");

      const valid = new Date();
      valid.setDate(valid.getDate() + 7);

      const { data, error } = await supabase
        .from("quotes")
        .insert({
          owner_id: userRes.user.id,
          client_id: form.client_id,
          package_id: form.package_id,
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
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Orçamento criado!");
      navigate({ to: "/orcamentos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
            <div className="space-y-2">
              <Label>Cliente *</Label>
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
            </div>
            <div className="space-y-2">
              <Label>Pacote *</Label>
              <Select
                value={form.package_id}
                onValueChange={(v) => setForm((f) => ({ ...f, package_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {(packages ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NumField
              label="Adultos"
              value={form.adults}
              onChange={(v) => setForm((f) => ({ ...f, adults: v }))}
            />
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
                  if (!form.client_id) {
                    toast.error("Selecione um cliente para gerar o PDF");
                    return;
                  }
                  if (!selectedPackage) {
                    toast.error("Selecione um pacote para gerar o PDF");
                    return;
                  }
                  const cli = (clients ?? []).find((c: any) => c.id === form.client_id) as any;
                  await openQuotePdf({
                    issuedAt: new Date(),
                    validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })(),
                    client: cli
                      ? { name: cli.name, cpf: cli.cpf, address: cli.address, phone: cli.phone, email: cli.email }
                      : null,
                    event: {
                      date: form.event_date || null,
                      time: form.event_time || null,
                      address: form.event_address || null,
                      type: form.event_type || null,
                      adults: form.adults,
                      childrenCount: form.children_count,
                    },
                    package: {
                      name: selectedPackage.name,
                      pricePerPerson: Number(selectedPackage.price_per_person ?? 0),
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
          <SummaryRow
            label="Preço por pessoa"
            value={brl(selectedPackage?.price_per_person ?? 0)}
          />
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entrada (50%)</span>
              <span className="font-mono font-bold">{brl(breakdown.entry)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo</span>
              <span className="font-mono font-bold">{brl(breakdown.balance)}</span>
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

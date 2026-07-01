import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/orcamentos/novo")({
  head: () => ({ meta: [{ title: "Novo orçamento — Meu Churras" }] }),
  component: NewQuotePage,
});

const schema = z.object({
  client_id: z.string().uuid("Selecione um cliente"),
  package_id: z.string().uuid("Selecione um pacote"),
  event_date: z.string().min(1, "Data obrigatória"),
  event_time: z.string().optional(),
  event_address: z.string().max(200).optional(),
  event_type: z.string().max(80).optional(),
  adults: z.number().int().min(0).max(9999),
  children_7_10: z.number().int().min(0).max(9999),
  children_0_6: z.number().int().min(0).max(9999),
  notes: z.string().max(1000).optional(),
});

function NewQuotePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
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

  const [form, setForm] = useState({
    client_id: "",
    package_id: "",
    event_date: "",
    event_time: "",
    event_address: "",
    event_type: "",
    adults: 0,
    children_7_10: 0,
    children_0_6: 0,
    notes: "",
    has_grill: false,
    has_freezer: false,
    extras_feijao: false,
    extras_farofa: false,
  });

  const selectedPackage = packages?.find((p) => p.id === form.package_id);
  const breakdown = useMemo(
    () =>
      calcQuote({
        pricePerPerson: Number(selectedPackage?.price_per_person ?? 0),
        adults: Number(form.adults) || 0,
        children7to10: Number(form.children_7_10) || 0,
        children0to6: Number(form.children_0_6) || 0,
        extras: {
          feijaoTropeiro: form.extras_feijao,
          farofaRica: form.extras_farofa,
        },
      }),
    [form, selectedPackage],
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
          children_7_10: form.children_7_10,
          children_0_6: form.children_0_6,
          has_grill: form.has_grill,
          has_freezer: form.has_freezer,
          extras: {
            feijao_tropeiro: form.extras_feijao,
            farofa_rica: form.extras_farofa,
          },
          notes: form.notes || null,
          total_value: breakdown.total,
          entry_value: breakdown.entry,
          balance_value: breakdown.balance,
          valid_until: valid.toISOString().slice(0, 10),
          status: "novo" as const,
        })
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

          <div className="grid grid-cols-3 gap-4">
            <NumField
              label="Adultos"
              value={form.adults}
              onChange={(v) => setForm((f) => ({ ...f, adults: v }))}
            />
            <NumField
              label="Crianças 7-10"
              value={form.children_7_10}
              onChange={(v) => setForm((f) => ({ ...f, children_7_10: v }))}
            />
            <NumField
              label="Crianças 0-6"
              value={form.children_0_6}
              onChange={(v) => setForm((f) => ({ ...f, children_0_6: v }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <ToggleRow
              label="Feijão Tropeiro"
              checked={form.extras_feijao}
              onChange={(v) => setForm((f) => ({ ...f, extras_feijao: v }))}
            />
            <ToggleRow
              label="Farofa Rica"
              checked={form.extras_farofa}
              onChange={(v) => setForm((f) => ({ ...f, extras_farofa: v }))}
            />
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

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/orcamentos" })}
            >
              Cancelar
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

          <SummaryRow
            label="Pessoas cobradas"
            value={`${breakdown.chargeableEquivalent.toFixed(1)}`}
          />
          <SummaryRow
            label="Preço por pessoa"
            value={brl(selectedPackage?.price_per_person ?? 0)}
          />
          <SummaryRow label="Subtotal" value={brl(breakdown.subtotal)} />
          {breakdown.extras > 0 && <SummaryRow label="Adicionais" value={brl(breakdown.extras)} />}

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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
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

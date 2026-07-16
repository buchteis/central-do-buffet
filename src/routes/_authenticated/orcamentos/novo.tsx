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
import { maskCpfCnpj } from "@/lib/doc";
import { BreakdownPreco } from "@/components/breakdown/BreakdownPreco";

export const Route = createFileRoute("/_authenticated/orcamentos/novo")({
  head: () => ({ meta: [{ title: "Novo orçamento — Meu Churras" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    leadId: typeof s.leadId === "string" ? s.leadId : undefined,
    quoteId: typeof s.quoteId === "string" ? s.quoteId : undefined,
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
        .select("id, name, price_per_person, min_people, max_people")
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
      const parsed

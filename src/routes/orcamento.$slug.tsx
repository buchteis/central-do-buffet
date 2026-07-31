import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Flame, Send, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicTenantLogo } from "@/lib/public-logo.functions";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { maskCpfCnpj, isValidCpfCnpj, onlyDigits, docKind } from "@/lib/doc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/orcamento/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Solicitar orçamento — ${params.slug}` },
      {
        name: "description",
        content: "Preencha o formulário para receber um orçamento personalizado do buffet.",
      },
    ],
  }),
  component: PublicQuoteForm,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  whatsapp: z.string().trim().min(8, "WhatsApp inválido").max(20),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  cpf: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine((v) => !v || isValidCpfCnpj(v), { message: "CPF/CNPJ inválido" }),
  city: z.string().trim().max(80).optional(),
  event_address: z.string().trim().max(200).optional(),
  event_date: z.string().min(1, "Data obrigatória"),
  event_time: z.string().optional(),
  guest_count: z.coerce.number().int().min(1).max(9999),
  event_type: z.string().trim().max(80).optional(),
  package_ids: z.array(z.string().uuid()).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function PublicQuoteForm() {
  const { slug } = Route.useParams();
  const [sent, setSent] = useState(false);
  const [cpf, setCpf] = useState("");
  const cpfKind = docKind(cpf);
  const [guestCount, setGuestCount] = useState<number>(0);

  const [selectedPackages, setSelectedPackages] = useState<{ id: string; package_id: string }[]>([]);

  function addPackage() {
    setSelectedPackages((old) => [
      ...old,
      {
        id: crypto.randomUUID(),
        package_id: "",
      },
    ]);
  }

  function removePackage(id: string) {
    setSelectedPackages((old) => old.filter((p) => p.id !== id));
  }

  function updatePackage(id: string, value: string) {
    setSelectedPackages((old) =>
      old.map((p) =>
        p.id === id ? { ...p, package_id: value } : p
      )
    );
  }

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, status")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  // QUERY - MOSTRA TODOS OS PACOTES
  const { data: packages } = useQuery({
    queryKey: ["public-packages", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("packages")
        .select("id, name, price_per_person")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .order("name");

      return data ?? [];
    },
  });

  // Tiers de preço por faixa de convidados (público/anon tem SELECT liberado).
  const { data: tiers } = useQuery({
    queryKey: ["public-packages-tiers", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_price_tiers")
        .select("package_id, min_guests, max_guests, price_per_person, position")
        .order("position", { ascending: true });
      if (error) return [];
      return (data ?? []) as {
        package_id: string;
        min_guests: number;
        max_guests: number;
        price_per_person: number;
        position: number;
      }[];
    },
  });

  // Preço por pessoa de um pacote conforme o nº de convidados (tiers).
  const priceForPackage = (packageId: string, guests: number): number => {
    const pkgTiers = (tiers ?? []).filter((t) => t.package_id === packageId);
    if (pkgTiers.length === 0) {
      const pkg = (packages ?? []).find((p) => p.id === packageId);
      return Number(pkg?.price_per_person ?? 0) || 0;
    }
    const inRange = pkgTiers.find((t) => guests >= t.min_guests && guests <= t.max_guests);
    if (inRange) return Number(inRange.price_per_person) || 0;
    const sorted = [...pkgTiers].sort((a, b) => a.min_guests - b.min_guests);
    if (guests < sorted[0].min_guests) return Number(sorted[0].price_per_person) || 0;
    return Number(sorted[sorted.length - 1].price_per_person) || 0;
  };

  // Pacotes efetivamente escolhidos (com preço por pessoa calculado).
  const chosenPackages = useMemo(
    () =>
      selectedPackages
        .map((s) => {
          const pkg = (packages ?? []).find((p) => p.id === s.package_id);
          if (!pkg) return null;
          return { id: pkg.id, name: pkg.name, price_per_person: priceForPackage(pkg.id, guestCount) };
        })
        .filter(Boolean) as { id: string; name: string; price_per_person: number }[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPackages, packages, tiers, guestCount],
  );

  const previewTotal = useMemo(
    () =>
      chosenPackages.reduce((s, p) => s + p.price_per_person, 0) * (guestCount || 0),
    [chosenPackages, guestCount],
  );


  const fetchLogo = useServerFn(getPublicTenantLogo);
  const { data: logo } = useQuery({

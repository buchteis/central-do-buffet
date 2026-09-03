import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Flame, Send, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicTenantLogo } from "@/lib/public-logo.functions";
import { brl } from "@/lib/format";
import { resolvePackagePricing, type PriceTier } from "@/lib/quote-calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { maskCpfCnpj, isValidCpfCnpj, docKind } from "@/lib/doc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/orcamento/$slug")({
  validateSearch: z.object({
    quote_id: z.string().uuid().optional(),
  }),
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
  guest_count: z.coerce.number().int().min(1, "Mínimo de 1 convidado").max(9999),
  event_type: z.string().trim().max(80).optional(),
  package_ids: z.array(z.string().uuid()).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

function PublicQuoteForm() {
  const { slug } = Route.useParams();
  const { quote_id } = Route.useSearch(); // Lê o ID do orçamento da URL se for uma edição/continuação
  const [sent, setSent] = useState(false);
  const [cpf, setCpf] = useState("");
  const cpfKind = docKind(cpf);
  const [guestCount, setGuestCount] = useState<number>(0);

  // Campos de formulário com estados controlados para suportar autopreenchimento
  const [formDataState, setFormDataState] = useState({
    name: "",
    whatsapp: "",
    email: "",
    city: "",
    event_address: "",
    event_date: "",
    event_time: "",
    event_type: "",
    notes: "",
  });

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
    setSelectedPackages((old) => old.map((p) => (p.id === id ? { ...p, package_id: value } : p)));
  }

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name, slug, status").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  // BUSCA DADOS DO ORÇAMENTO EXISTENTE SE "quote_id" ESTIVER NA URL
  const { data: existingQuote } = useQuery({
    queryKey: ["public-quote-existing", quote_id],
    enabled: !!quote_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("*, clients(name, whatsapp, email, city, cpf)")
        .eq("id", quote_id!)
        .maybeSingle();
      return data as any;
    },
  });

  // EFEITO DE PREENCHIMENTO AUTOMÁTICO DO FORMULÁRIO
  useEffect(() => {
    if (existingQuote) {
      const client = existingQuote.clients ?? {};
      setFormDataState({
        name: client.name ?? "",
        whatsapp: client.whatsapp ?? "",
        email: client.email ?? "",
        city: client.city ?? "",
        event_address: existingQuote.event_address ?? "",
        event_date: existingQuote.event_date ?? "",
        event_time: existingQuote.event_time ?? "",
        event_type: existingQuote.event_type ?? "",
        notes: existingQuote.notes ?? "",
      });

      const totalGuests =
        Number(existingQuote.adults ?? 0) +
        Number(existingQuote.children_7_10 ?? 0) +
        Number(existingQuote.children_0_6 ?? 0);
      setGuestCount(totalGuests);
      if (client.cpf) setCpf(maskCpfCnpj(client.cpf));

      const extras = existingQuote.extras ?? {};
      const pkgSnap = Array.isArray(extras.packages) ? extras.packages : [];
      if (pkgSnap.length > 0) {
        setSelectedPackages(
          pkgSnap.map((p: any) => ({
            id: crypto.randomUUID(),
            package_id: p?.id ?? "",
          })),
        );
      } else if (existingQuote.package_id) {
        setSelectedPackages([{ id: crypto.randomUUID(), package_id: existingQuote.package_id }]);
      }
    }
  }, [existingQuote]);

  // QUERY - MOSTRA TODOS OS PACOTES
  const { data: packages } = useQuery({
    queryKey: ["public-packages", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("packages")
        .select("id, name, price_per_person, pricing_type")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .order("name");

      return data ?? [];
    },
  });

  const packageIds = useMemo(() => (packages ?? []).map((p) => p.id), [packages]);

  // Tiers de preço por faixa de convidados (apenas dos pacotes deste buffet)
  const { data: tiers } = useQuery({
    queryKey: ["public-packages-tiers", tenant?.id, packageIds],
    enabled: packageIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_price_tiers")
        .select("id, package_id, min_guests, max_guests, price_per_person, price_fixed, position, updated_at")
        .in("package_id", packageIds)
        .order("position", { ascending: true });
      if (error) return [];
      return (data ?? []) as PriceTier[];
    },
  });

  // Itens adicionais independentes dos pacotes
  const { data: unitItemsCatalog } = useQuery({
    queryKey: ["public-additional-items", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additional_items")
        .select("id, name, unit, unit_price, default_qty, position")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .order("position", { ascending: true });
      if (error) return [];
      return (data ?? []) as {
        id: string;
        name: string;
        unit: string;
        unit_price: number;
        default_qty: number;
        position: number;
      }[];
    },
  });

  const [unitQty, setUnitQty] = useState<Record<string, number>>({});

  // Preço de um pacote conforme o nº de convidados (por pessoa OU preço fechado)
  const pricingForPackage = (packageId: string, guests: number) => {
    const pkg = (packages ?? []).find((p) => p.id === packageId);
    const pkgTiers = (tiers ?? []).filter((t) => t.package_id === packageId);
    return resolvePackagePricing(pkg ?? null, pkgTiers, guests);
  };

  // Pacotes efetivamente escolhidos
  const chosenPackages = useMemo(
    () =>
      selectedPackages
        .map((s) => {
          const pkg = (packages ?? []).find((p) => p.id === s.package_id);
          if (!pkg) return null;
          const info = pricingForPackage(pkg.id, guestCount);
          return {
            id: pkg.id,
            name: pkg.name,
            isFixed: info.isFixed,
            price_per_person: info.isFixed ? 0 : info.unitPrice,
            price_fixed: info.priceFixed,
            total: info.totalPrice,
          };
        })
        .filter(Boolean) as {
        id: string;
        name: string;
        isFixed: boolean;
        price_per_person: number;
        price_fixed: number;
        total: number;
      }[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPackages, packages, tiers, guestCount],
  );

  const availableUnitItems = unitItemsCatalog ?? [];

  const selectedUnitItems = useMemo(
    () =>
      availableUnitItems
        .map((i) => ({ item_id: i.id, name: i.name, unit: i.unit, unit_price: Number(i.unit_price) || 0, qty: Number(unitQty[i.id] ?? 0) || 0 }))
        .filter((i) => i.qty > 0),
    [availableUnitItems, unitQty],
  );

  const unitItemsSubtotal = useMemo(
    () => selectedUnitItems.reduce((s, i) => s + i.qty * i.unit_price, 0),
    [selectedUnitItems],
  );

  const previewTotal = useMemo(
    () => chosenPackages.reduce((s, p) => s + p.total, 0) + unitItemsSubtotal,
    [chosenPackages, unitItemsSubtotal],
  );

  const fetchLogo = useServerFn(getPublicTenantLogo);
  const { data: logo } = useQuery({
    queryKey: ["public-logo", slug],
    queryFn: () => fetchLogo({ data: { slug } }),
  });
  const logoUrl = logo?.url ?? "";

  // MUTATION PARA DADOS (CRIA OU ATUALIZA REGISTRO EXISTENTE)
  const submitMutation = useMutation({
    mutationFn: async (payload: FormValues) => {
      const validPackageIds = (payload.package_ids ?? []).filter(Boolean);

      // CASO EDICIONAL: Atualiza o registro do orçamento existente (evita gerar o 2º card)
      if (quote_id) {
        const { data, error } = await supabase
          .from("quotes")
          .update({
            name: payload.name,
            whatsapp: payload.whatsapp,
            email: payload.email || null,
            cpf: payload.cpf || null,
            city: payload.city || null,
            event_address: payload.event_address || null,
            event_date: payload.event_date,
            event_time: payload.event_time || null,
            guest_count: payload.guest_count,
            event_type: payload.event_type || null,
            package_ids: validPackageIds,
            package_id: validPackageIds[0] ?? null,
            notes: payload.notes || null,
            total_value: previewTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", quote_id);

        if (error) throw error;
        return data;
      }

      // CASO NOVO: Chama a procedure RPC V2 para criar um orçamento novo
      const { data, error } = await (supabase as any).rpc("submit_public_quote_v2", {
        p_slug: slug,
        p_name: payload.name,
        p_whatsapp: payload.whatsapp,
        p_email: payload.email || null,
        p_cpf: payload.cpf || null,
        p_city: payload.city || null,
        p_event_address: payload.event_address || null,
        p_event_date: payload.event_date,
        p_event_time: payload.event_time || null,
        p_guest_count: payload.guest_count,
        p_event_type: payload.event_type || null,
        p_package_id: validPackageIds[0] ?? null,
        p_notes: payload.notes || null,
        p_package_ids: validPackageIds.length > 0 ? validPackageIds : null,
        p_unit_items: selectedUnitItems.length > 0 ? selectedUnitItems : null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setSent(true);
      toast.success(quote_id ? "Orçamento atualizado com sucesso!" : "Solicitação enviada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao salvar solicitação.");
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const packageIds = selectedPackages.map((p) => p.package_id).filter((id) => id.trim() !== "");

    const rawData = {
      name: formDataState.name,
      whatsapp: formDataState.whatsapp,
      email: formDataState.email,
      cpf: cpf,
      city: formDataState.city,
      event_address: formDataState.event_address,
      event_date: formDataState.event_date,
      event_time: formDataState.event_time,
      guest_count: guestCount,
      event_type: formDataState.event_type,
      notes: formDataState.notes,
      package_ids: packageIds,
    };

    const result = schema.safeParse(rawData);

    if (!result.success) {
      const firstError = result.error.errors[0]?.message || "Verifique os dados preenchidos.";
      toast.error(firstError);
      return;
    }

    submitMutation.mutate(result.data);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando formulário...</p>
      </div>
    );
  }

  if (!tenant || tenant.status !== "ativo") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
        <Flame className="h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Buffet não encontrado ou inativo</h1>
        <p className="text-sm text-muted-foreground">Verifique o link digitado e tente novamente.</p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-lg">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h2 className="text-2xl font-bold">{quote_id ? "Orçamento Atualizado!" : "Solicitação Enviada!"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Obrigado por seu interesse no <strong>{tenant.name}</strong>. Entraremos em contato em breve via WhatsApp ou E-mail.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="mb-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={tenant.name} className="mx-auto mb-4 max-h-16 object-contain" />
          ) : (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Flame className="h-6 w-6 text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quote_id ? "Atualização de Orçamento" : "Solicitação de Orçamento"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Seus Dados</h3>

            <div>
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                name="name"
                required
                value={formDataState.name}
                onChange={(e) => setFormDataState({ ...formDataState, name: e.target.value })}
                placeholder="Seu nome"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  required
                  value={formDataState.whatsapp}
                  onChange={(e) => setFormDataState({ ...formDataState, whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formDataState.email}
                  onChange={(e) => setFormDataState({ ...formDataState, email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="cpf">{(cpfKind ?? "CPF/CNPJ").toUpperCase()}</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  name="city"
                  value={formDataState.city}
                  onChange={(e) => setFormDataState({ ...formDataState, city: e.target.value })}
                  placeholder="Sua cidade"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dados do Evento</h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="event_date">Data do Evento *</Label>
                <Input
                  id="event_date"
                  name="event_date"
                  type="date"
                  required
                  value={formDataState.event_date}
                  onChange={(e) => setFormDataState({ ...formDataState, event_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="event_time">Horário Previsto</Label>
                <Input
                  id="event_time"
                  name="event_time"
                  type="time"
                  value={formDataState.event_time}
                  onChange={(e) => setFormDataState({ ...formDataState, event_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="guest_count">Nº de Convidados *</Label>
                <Input
                  id="guest_count"
                  type="number"
                  min="1"
                  required
                  value={guestCount || ""}
                  onChange={(e) => setGuestCount(Number(e.target.value) || 0)}
                  placeholder="Ex: 100"
                />
              </div>
              <div>
                <Label htmlFor="event_type">Tipo de Evento</Label>
                <Input
                  id="event_type"
                  name="event_type"
                  value={formDataState.event_type}
                  onChange={(e) => setFormDataState({ ...formDataState, event_type: e.target.value })}
                  placeholder="Ex: Casamento, Aniversário"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="event_address">Local do Evento / Endereço</Label>
              <Input
                id="event_address"
                name="event_address"
                value={formDataState.event_address}
                onChange={(e) => setFormDataState({ ...formDataState, event_address: e.target.value })}
                placeholder="Endereço completo ou nome do local"
              />
            </div>

            {/* SELEÇÃO DE PACOTES MÚLTIPLOS */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label>Pacotes Desejados</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPackage}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar Pacote
                </Button>
              </div>

              {selectedPackages.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum pacote selecionado. Clique em "+ Adicionar Pacote" para escolher opções do buffet.
                </p>
              )}

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {selectedPackages.map((item, index) => {
                  const info = item.package_id
                    ? pricingForPackage(item.package_id, guestCount)
                    : { isFixed: false, unitPrice: 0, totalPrice: 0, priceFixed: 0, tierFound: false };
                  return (
                    <div key={item.id} className="flex items-center gap-2 rounded-xl border p-2">
                      <div className="min-w-0 flex-1">
                        <Select value={item.package_id} onValueChange={(val) => updatePackage(item.id, val)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={`Opção de Pacote ${index + 1}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(packages ?? []).map((pkg) => (
                              <SelectItem key={pkg.id} value={pkg.id}>
                                {pkg.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {info.totalPrice > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {info.isFixed
                              ? `${brl(info.totalPrice)} (preço fechado)`
                              : `${brl(info.unitPrice)} / pessoa`}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePackage(item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {availableUnitItems.length > 0 && (
                <div className="space-y-3 rounded-xl border p-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Itens adicionais (opcional)
                  </Label>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {availableUnitItems.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{it.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {brl(Number(it.unit_price) || 0)} / {it.unit || "un"}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          className="w-20"
                          value={unitQty[it.id] ?? ""}
                          onChange={(e) =>
                            setUnitQty((old) => ({ ...old, [it.id]: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          placeholder="Qtd"
                        />
                      </div>
                    ))}
                  </div>
                  {unitItemsSubtotal > 0 && (
                    <p className="text-right text-xs text-muted-foreground">
                      Subtotal itens adicionais: <strong>{brl(unitItemsSubtotal)}</strong>
                    </p>
                  )}
                </div>
              )}

              {previewTotal > 0 && (
                <div className="mt-2 rounded-lg bg-slate-100 p-3 text-right">
                  <span className="text-xs text-muted-foreground">Valor Total: </span>
                  <span className="text-base font-bold text-primary">{brl(previewTotal)}</span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Observações adicionais</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formDataState.notes}
                onChange={(e) => setFormDataState({ ...formDataState, notes: e.target.value })}
                placeholder="Detalhes adicionais, preferências ou dúvidas..."
                rows={3}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? (
              "Enviando..."
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> {quote_id ? "Salvar Alterações" : "Enviar Solicitação"}
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

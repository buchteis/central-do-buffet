import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Flame, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicTenantLogo } from "@/lib/public-logo.functions";
import { getPublicQuoteCatalog } from "@/lib/public-quote-catalog.functions";
import { brl } from "@/lib/format";
import { resolvePackagePricing, type PriceTier } from "@/lib/quote-calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { maskCpfCnpj, isValidCpfCnpj, docKind } from "@/lib/doc";

const EVENT_TYPES = ["Casamento", "Debutante", "Aniversário", "Corporativo", "Reunião familiar"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-active={active}
      aria-pressed={active}
      onClick={onClick}
      className="public-quote-pill rounded-full px-4 py-2 text-sm leading-none"
    >
      {children}
    </button>
  );
}

export const Route = createFileRoute("/orcamento/$slug")({
  validateSearch: z.object({
    quote_id: z.string().uuid().optional(),
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Solicitar orçamento — ${params.slug}` },
      { property: "og:title", content: `Solicitar orçamento — ${params.slug}` },
      { property: "og:description", content: "Preencha o formulário para receber um orçamento personalizado do buffet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

  function togglePackage(packageId: string) {
    setSelectedPackages((old) =>
      old.some((p) => p.package_id === packageId)
        ? old.filter((p) => p.package_id !== packageId)
        : [...old, { id: crypto.randomUUID(), package_id: packageId }],
    );
  }

  const fetchCatalog = useServerFn(getPublicQuoteCatalog);
  const { data: catalog, isLoading, isError: catalogError, refetch: reloadCatalog } = useQuery({
    queryKey: ["public-quote-catalog", slug],
    queryFn: () => fetchCatalog({ data: { slug } }),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const tenant = catalog?.tenant;
  const packages = catalog?.packages;
  const tiers = catalog?.tiers as PriceTier[] | undefined;
  const unitItemsCatalog = catalog?.items;

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

  const [unitQty, setUnitQty] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!existingQuote || !unitItemsCatalog) return;
    const savedItems = Array.isArray(existingQuote.extras?.unit_items)
      ? existingQuote.extras.unit_items
      : [];
    const quantities = Object.fromEntries(
      savedItems
        .map((saved: any): [string, number] => [String(saved.item_id ?? ""), Number(saved.qty) || 0])
        .filter(([itemId, qty]: [string, number]) => Boolean(itemId) && qty > 0),
    );
    setUnitQty(quantities);
  }, [existingQuote, unitItemsCatalog]);

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
        const pkgSnapshot = chosenPackages.map((pkg) => ({
          package_id: pkg.id,
          name: pkg.name,
          pricing_type: pkg.isFixed ? "fixed" : "per_person",
          price_per_person: pkg.price_per_person,
          price_fixed: pkg.price_fixed,
        }));

        const quoteUpdate: any = {
          event_address: payload.event_address || null,
          event_date: payload.event_date,
          event_time: payload.event_time || null,
          event_type: payload.event_type || null,
          notes: payload.notes || null,
          adults: payload.guest_count,
          children_7_10: 0,
          children_0_6: 0,
          package_id: validPackageIds[0] ?? null,
          total_value: previewTotal,
          updated_at: new Date().toISOString(),
          extras: {
            ...(existingQuote?.extras ?? {}),
            packages: pkgSnapshot,
            unit_items: selectedUnitItems,
          },
        };

        const { error: quoteError } = await supabase.from("quotes").update(quoteUpdate).eq("id", quote_id);
        if (quoteError) throw quoteError;

        const clientId = existingQuote?.client_id;
        if (clientId) {
          const { error: clientError } = await supabase
            .from("clients")
            .update({
              name: payload.name,
              whatsapp: payload.whatsapp,
              email: payload.email || null,
              city: payload.city || null,
              cpf: payload.cpf || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", clientId);
          if (clientError) throw clientError;
        }
        return existingQuote;
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
      event_type: formDataState.event_type.trim(),
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
      <div className="public-quote-page flex min-h-screen items-center justify-center">
        <p className="public-quote-muted">Carregando formulário...</p>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="public-quote-page flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        <p>Não foi possível carregar os pacotes deste buffet.</p>
        <Button onClick={() => void reloadCatalog()}>Tentar novamente</Button>
      </div>
    );
  }

  if (!tenant || tenant.status !== "ativo") {
    return (
      <div className="public-quote-page flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
        <Flame className="h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Buffet não encontrado ou inativo</h1>
        <p className="public-quote-muted text-sm">Verifique o link digitado e tente novamente.</p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="public-quote-page flex min-h-screen flex-col items-center justify-center p-4">
        <div className="public-quote-card w-full max-w-md rounded-2xl p-6 text-center shadow-lg">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h2 className="text-2xl font-bold">{quote_id ? "Orçamento Atualizado!" : "Solicitação Enviada!"}</h2>
          <p className="public-quote-muted mt-2 text-sm">
            Obrigado por seu interesse no <strong>{tenant.name}</strong>. Entraremos em contato em breve via WhatsApp ou E-mail.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-quote-page min-h-screen px-4 py-8 md:py-12">
      <div className="public-quote-card mx-auto max-w-xl rounded-3xl p-6 shadow-xl md:p-8">
        <div className="mb-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={tenant.name} className="mx-auto mb-4 max-h-16 object-contain" />
          ) : (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Flame className="h-6 w-6 text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="public-quote-muted mt-1 text-sm">
            {quote_id ? "Atualização de Orçamento" : "Solicitação de Orçamento"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* QUERO — PACOTES DO BUFFET EM PÍLULAS */}
          <div className="space-y-3">
            <Label className="public-quote-label block">Quero</Label>
            {(packages ?? []).length === 0 ? (
              <p className="public-quote-muted text-xs">Este buffet não possui pacotes ativos no momento.</p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {(packages ?? []).map((pkg) => (
                  <Chip
                    key={pkg.id}
                    active={selectedPackages.some((s) => s.package_id === pkg.id)}
                    onClick={() => togglePackage(pkg.id)}
                  >
                    {pkg.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {/* TIPO DE EVENTO EM PÍLULAS */}
          <div className="space-y-3">
            <Label className="public-quote-label block">Tipo de evento</Label>
            <div className="flex flex-wrap gap-2.5">
              {EVENT_TYPES.map((t) => (
                <Chip
                  key={t}
                  active={formDataState.event_type === t}
                  onClick={() =>
                    setFormDataState({ ...formDataState, event_type: formDataState.event_type === t ? "" : t })
                  }
                >
                  {t}
                </Chip>
              ))}
              <Chip
                active={!!formDataState.event_type && !EVENT_TYPES.includes(formDataState.event_type)}
                onClick={() => setFormDataState({ ...formDataState, event_type: " " })}
              >
                Outro
              </Chip>
            </div>
            {!!formDataState.event_type && !EVENT_TYPES.includes(formDataState.event_type) && (
              <Input
                id="event_type"
                className="public-quote-input mt-2 rounded-xl"
                value={formDataState.event_type.trimStart()}
                onChange={(e) => setFormDataState({ ...formDataState, event_type: e.target.value || " " })}
                placeholder="Qual o tipo de evento?"
              />
            )}
          </div>

          {/* CONVIDADOS E DATA */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="guest_count" className="public-quote-label block">Convidados *</Label>
              <Input
                id="guest_count"
                type="number"
                min="1"
                required
                className="public-quote-input rounded-xl"
                value={guestCount || ""}
                onChange={(e) => setGuestCount(Number(e.target.value) || 0)}
                placeholder="Ex.: 80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_date" className="public-quote-label block">Data *</Label>
              <Input
                id="event_date"
                name="event_date"
                type="date"
                required
                className="public-quote-input rounded-xl"
                value={formDataState.event_date}
                onChange={(e) => setFormDataState({ ...formDataState, event_date: e.target.value })}
              />
            </div>
          </div>

          {/* RESUMO DOS PACOTES ESCOLHIDOS E ITENS ADICIONAIS */}
          {chosenPackages.length > 0 && guestCount > 0 && (
            <ul className="public-quote-input space-y-1.5 rounded-xl border p-3 text-xs">
              {chosenPackages.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="public-quote-muted shrink-0">
                    {p.isFixed ? `${brl(p.total)} (preço fechado)` : `${brl(p.price_per_person)} / pessoa`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* DADOS DO CLIENTE */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="public-quote-label block">Seu nome *</Label>
              <Input
                id="name"
                name="name"
                required
                className="public-quote-input rounded-xl"
                value={formDataState.name}
                onChange={(e) => setFormDataState({ ...formDataState, name: e.target.value })}
                placeholder="Como podemos te chamar?"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="public-quote-label block">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  required
                  className="public-quote-input rounded-xl"
                  value={formDataState.whatsapp}
                  onChange={(e) => setFormDataState({ ...formDataState, whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="public-quote-label block">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className="public-quote-input rounded-xl"
                  value={formDataState.email}
                  onChange={(e) => setFormDataState({ ...formDataState, email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="public-quote-label block">{(cpfKind ?? "CPF/CNPJ").toUpperCase()}</Label>
                <Input
                  id="cpf"
                  className="public-quote-input rounded-xl"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="public-quote-label block">Cidade</Label>
                <Input
                  id="city"
                  name="city"
                  className="public-quote-input rounded-xl"
                  value={formDataState.city}
                  onChange={(e) => setFormDataState({ ...formDataState, city: e.target.value })}
                  placeholder="Sua cidade"
                />
              </div>
            </div>
          </div>

          {/* DETALHES DO EVENTO */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event_time" className="public-quote-label block">Horário previsto</Label>
                <Input
                  id="event_time"
                  name="event_time"
                  type="time"
                  className="public-quote-input rounded-xl"
                  value={formDataState.event_time}
                  onChange={(e) => setFormDataState({ ...formDataState, event_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_address" className="public-quote-label block">Local / endereço</Label>
                <Input
                  id="event_address"
                  name="event_address"
                  className="public-quote-input rounded-xl"
                  value={formDataState.event_address}
                  onChange={(e) => setFormDataState({ ...formDataState, event_address: e.target.value })}
                  placeholder="Endereço ou nome do local"
                />
              </div>
            </div>

            {availableUnitItems.length > 0 && (
              <div className="public-quote-input space-y-3 rounded-xl border p-3.5">
                <Label className="public-quote-label block">Itens adicionais (opcional)</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {availableUnitItems.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{it.name}</p>
                        <p className="public-quote-muted text-xs">
                          {brl(Number(it.unit_price) || 0)} / {it.unit || "un"}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        className="public-quote-input w-20 rounded-lg"
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
                  <p className="public-quote-muted text-right text-xs">
                    Subtotal itens adicionais: <strong>{brl(unitItemsSubtotal)}</strong>
                  </p>
                )}
              </div>
            )}

            {previewTotal > 0 && (
              <div className="public-quote-input rounded-xl border p-3.5 text-right">
                <span className="public-quote-muted text-xs">Valor estimado: </span>
                <span className="text-base font-bold text-primary">{brl(previewTotal)}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes" className="public-quote-label block">Observações adicionais</Label>
              <Textarea
                id="notes"
                name="notes"
                className="public-quote-input rounded-xl"
                value={formDataState.notes}
                onChange={(e) => setFormDataState({ ...formDataState, notes: e.target.value })}
                placeholder="Detalhes adicionais, preferências ou dúvidas..."
                rows={3}
              />
            </div>
          </div>

          <Button type="submit" className="public-quote-cta h-12 w-full rounded-full text-base" disabled={submitMutation.isPending}>
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

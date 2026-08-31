import { ChecklistPreDefinido } from "@/components/ChecklistPreDefinido";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { BreakdownPreco } from "./BreakdownPreco";

export const Route = createFileRoute("/_authenticated/orcamentos/novo")({
  head: () => ({ meta: [{ title: "Novo orçamento — Central do Buffet" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    leadId: typeof s.leadId === "string" ? s.leadId : undefined,
    quoteId: typeof s.quoteId === "string" ? s.quoteId : undefined,
  }),
  component: NewQuotePage,
});

type PackageItem = {
  id: string;
  name: string;
  pricing_type: "per_person" | "fixed";
  price_per_person: number;
};

type PriceTier = {
  id: string;
  package_id: string;
  min_guests: number;
  max_guests: number;
  price_per_person: number;
  price_fixed: number;
};

function NewQuotePage() {
  const { leadId, quoteId } = Route.useSearch();

  return <QuoteEditor key={quoteId ?? leadId ?? "new"} leadId={leadId} quoteId={quoteId} />;
}

function QuoteEditor({ leadId, quoteId }: { leadId?: string; quoteId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ESTADOS DO FORMULÁRIO
  const [clientId, setClientId] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>("");
  const [eventTime, setEventTime] = useState<string>("");
  const [eventType, setEventType] = useState<string>("Casa");
  const [eventAddress, setEventAddress] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [adults, setAdults] = useState<number>(70);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [childrenPrice, setChildrenPrice] = useState<number>(0);

  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);

  // PREFILL DE LEAD
  const { data: lead } = useQuery({
    queryKey: ["lead-prefill", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (lead) {
      if (lead.event_date) setEventDate(lead.event_date);
      if (lead.guest_count) setAdults(Number(lead.guest_count) || 70);
      if (lead.event_address) setEventAddress(lead.event_address);
      if (lead.notes) setNotes(lead.notes);
    }
  }, [lead]);

  // QUERY - CLIENTES
  const { data: clients } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // QUERY - PACOTES
  const { data: packages } = useQuery({
    queryKey: ["packages-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("id, name, pricing_type, price_per_person")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PackageItem[];
    },
  });

  // QUERY - FAIXAS DE PREÇO
  const { data: tiers } = useQuery({
    queryKey: ["package-tiers-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_price_tiers")
        .select("id, package_id, min_guests, max_guests, price_per_person, price_fixed");
      if (error) throw error;
      return (data ?? []) as PriceTier[];
    },
  });

  const totalGuests = adults + childrenCount;

  // CÁLCULO SEGURO DO PACOTE
  const resolvePackageDetails = (pkg: PackageItem) => {
    if (!pkg || !pkg.id) {
      return { id: "", name: "", pricing_type: "per_person" as const, price_per_person: 0, price_fixed: 0, tierFound: false };
    }

    const pkgTiers = (tiers ?? [])
      .filter((t) => t.package_id === pkg.id)
      .sort((a, b) => a.min_guests - b.min_guests);

    if (pkgTiers.length === 0) {
      return {
        id: pkg.id,
        name: pkg.name || "",
        pricing_type: pkg.pricing_type || "per_person",
        price_per_person: Number(pkg.price_per_person) || 0,
        price_fixed: 0,
        tierFound: false,
      };
    }

    let tier = pkgTiers.find((t) => totalGuests >= t.min_guests && totalGuests <= t.max_guests);

    if (!tier && totalGuests > pkgTiers[pkgTiers.length - 1].max_guests) {
      tier = pkgTiers[pkgTiers.length - 1];
    }

    if (!tier) {
      tier = pkgTiers[0];
    }

    const isFixed = pkg.pricing_type === "fixed";

    if (isFixed) {
      const price_fixed = Number(tier?.price_fixed) || 0;
      const price_per_person = totalGuests > 0 ? price_fixed / totalGuests : 0;
      return {
        id: pkg.id,
        name: pkg.name || "",
        pricing_type: pkg.pricing_type,
        price_per_person,
        price_fixed,
        tierFound: true,
      };
    } else {
      const price_per_person = Number(tier?.price_per_person) || Number(pkg.price_per_person) || 0;
      return {
        id: pkg.id,
        name: pkg.name || "",
        pricing_type: pkg.pricing_type,
        price_per_person,
        price_fixed: 0,
        tierFound: true,
      };
    }
  };

  const selectedPackagesDetailed = useMemo(() => {
    return selectedPackageIds
      .map((id) => packages?.find((p) => p.id === id))
      .filter((p): p is PackageItem => !!p)
      .map((pkg) => resolvePackageDetails(pkg));
  }, [selectedPackageIds, packages, tiers, totalGuests]);

  function addPackageSelect() {
    setSelectedPackageIds((old) => [...old, ""]);
  }

  function updatePackageSelect(index: number, packageId: string) {
    setSelectedPackageIds((old) => {
      const next = [...old];
      next[index] = packageId;
      return next;
    });
  }

  function removePackageSelect(index: number) {
    setSelectedPackageIds((old) => old.filter((_, i) => i !== index));
  }

  const packagesSubtotal = useMemo(() => {
    return selectedPackagesDetailed.reduce((sum, pkg) => {
      if (pkg.pricing_type === "fixed") {
        return sum + pkg.price_fixed;
      }
      return sum + adults * pkg.price_per_person;
    }, 0);
  }, [selectedPackagesDetailed, adults]);

  const childrenSubtotal = childrenCount * childrenPrice;
  const grandTotal = packagesSubtotal + childrenSubtotal;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validPackageIds = selectedPackageIds.filter((id) => id && id.trim() !== "");
      if (validPackageIds.length === 0) {
        throw new Error("Selecione ao menos um pacote");
      }

      const payload = {
        client_id: clientId || null,
        package_id: validPackageIds[0],
        event_date: eventDate,
        event_time: eventTime || null,
        event_type: eventType || null,
        event_address: eventAddress || null,
        adults: adults,
        children_count: childrenCount,
        total_value: grandTotal,
        notes: notes || null,
        extras: {
          package_ids: validPackageIds,
          child_price: childrenPrice,
        },
      };

      const { data, error } = await supabase.from("quotes").insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento criado com sucesso!");
      navigate({ to: "/orcamentos" });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar orçamento"),
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link to="/orcamentos">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Novo Orçamento</h1>
            <p className="text-xs text-muted-foreground">Preencha os dados abaixo para gerar a proposta</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2 bg-card border rounded-2xl p-5 shadow-sm">
            <Label className="font-bold">Cliente</Label>
            <Select value={clientId || undefined} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente cadastrado (opcional)..." />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 bg-card border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold text-base">Pacotes *</Label>
                <p className="text-xs text-muted-foreground">Adicione um ou mais pacotes para o evento</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPackageSelect}>
                <Plus className="size-4 mr-1" /> Adicionar pacote
              </Button>
            </div>

            {selectedPackageIds.length === 0 && (
              <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-lg border text-center">
                Nenhum pacote adicionado. Clique acima para escolher os pacotes do orçamento.
              </p>
            )}

            <div className="space-y-3">
              {selectedPackageIds.map((selectedId, idx) => {
                const pkg = packages?.find((p) => p.id === selectedId);
                const info = pkg ? resolvePackageDetails(pkg) : null;

                return (
                  <div key={idx} className="flex gap-2 items-center bg-muted/20 p-3 rounded-xl border">
                    <div className="flex-1 space-y-1">
                      <Select
                        value={selectedId || undefined}
                        onValueChange={(val) => updatePackageSelect(idx, val)}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder={`Selecione o pacote ${idx + 1}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {packages?.map((p) => {
                            const details = resolvePackageDetails(p);
                            const label =
                              p.pricing_type === "fixed"
                                ? `${p.name} · ${brl(details.price_fixed)} (Preço Fechado)`
                                : `${p.name} · ${brl(details.price_per_person)}/pessoa`;

                            return (
                              <SelectItem key={p.id} value={p.id}>
                                {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      {info && (
                        <p className="text-xs text-muted-foreground pl-1">
                          {info.pricing_type === "fixed" ? (
                            <span className="font-medium text-primary">
                              Preço Fechado: {brl(info.price_fixed)} para {totalGuests} convidados
                            </span>
                          ) : (
                            <span>Valor unitário: {brl(info.price_per_person)} por pessoa</span>
                          )}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removePackageSelect(idx)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 bg-card border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
              Detalhes do Evento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data do Evento *</Label>
                <Input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Local</Label>
                <Input
                  placeholder="Ex.: Casa, Chácara"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço do evento</Label>
              <Input
                placeholder="Rua, número, bairro e cidade"
                value={eventAddress}
                onChange={(e) => setEventAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 bg-card border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
              Convidados e Valores
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nº de Adultos</Label>
                <Input
                  type="number"
                  min="0"
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Nº de Crianças</Label>
                <Input
                  type="number"
                  min="0"
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(Number(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Valor por Criança (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={childrenPrice}
                  onChange={(e) => setChildrenPrice(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-card border rounded-2xl p-5 shadow-sm">
            <ChecklistPreDefinido guestCount={totalGuests} />

            <div className="space-y-2 pt-2">
              <Label>Observações adicionais</Label>
              <Textarea
                rows={3}
                placeholder="Anotações sobre preferências, adicionais ou negociação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-5 space-y-4 sticky top-6 shadow-sm">
            <BreakdownPreco
              packages={selectedPackagesDetailed}
              adults={adults}
              childrenCount={childrenCount}
              childrenPrice={childrenPrice}
            />

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="font-extrabold uppercase text-xs tracking-wider">TOTAL ESTIMADO</span>
                <span className="text-2xl font-extrabold font-mono text-primary">
                  {brl(grandTotal)}
                </span>
              </div>

              <Button
                type="button"
                className="w-full font-bold"
                size="lg"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Salvar orçamento..." : "Salvar orçamento"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Calendar, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Package = {
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

export function EditorOrcamentoForm() {
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>("");
  const [eventTime, setEventTime] = useState<string>("");
  const [eventType, setEventType] = useState<string>("");
  const [eventAddress, setEventAddress] = useState<string>("");

  const [adultsCount, setAdultsCount] = useState<number>(70);
  const [kidsCount, setKidsCount] = useState<number>(0);
  const [pricePerAdult, setPricePerAdult] = useState<number>(0);
  const [pricePerKid, setPricePerKid] = useState<number>(0);

  const totalGuests = Number(adultsCount || 0) + Number(kidsCount || 0);

  // 1. QUERY PACOTES (INCLUINDO pricing_type)
  const { data: packages } = useQuery({
    queryKey: ["packages-admin-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("id, name, pricing_type, price_per_person")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Package[];
    },
  });

  // 2. QUERY FAIXAS DE PREÇO (INCLUINDO price_fixed)
  const { data: tiers } = useQuery({
    queryKey: ["packages-admin-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_price_tiers")
        .select("id, package_id, min_guests, max_guests, price_per_person, price_fixed");
      if (error) throw error;
      return (data ?? []) as PriceTier[];
    },
  });

  // 3. FUNÇÃO AUXILIAR PARA CALCULAR O PREÇO UNITÁRIO / TOTAL DE QUALQUER PACOTE
  const resolvePackagePricing = (pkg: Package | undefined, guests: number) => {
    if (!pkg) return { unitPrice: 0, totalPrice: 0, isFixed: false, tierFound: false };

    const pkgTiers = (tiers ?? []).filter((t) => t.package_id === pkg.id);
    const tier = pkgTiers.find((t) => guests >= t.min_guests && guests <= t.max_guests);

    if (!tier) {
      return { unitPrice: 0, totalPrice: 0, isFixed: pkg.pricing_type === "fixed", tierFound: false };
    }

    if (pkg.pricing_type === "fixed") {
      const totalPrice = Number(tier.price_fixed) || 0;
      const unitPrice = guests > 0 ? totalPrice / guests : 0;
      return { unitPrice, totalPrice, isFixed: true, tierFound: true };
    } else {
      const unitPrice = Number(tier.price_per_person) || Number(pkg.price_per_person) || 0;
      const totalPrice = unitPrice * guests;
      return { unitPrice, totalPrice, isFixed: false, tierFound: true };
    }
  };

  // 4. ATUALIZA O "PREÇO POR PESSOA" AUTOMATICAMENTE QUANDO O PACOTE OU N° DE CONVIDADOS MUDAR
  useEffect(() => {
    if (!selectedPackageId) return;

    const pkg = packages?.find((p) => p.id === selectedPackageId);
    const pricing = resolvePackagePricing(pkg, totalGuests);

    setPricePerAdult(pricing.unitPrice);
  }, [selectedPackageId, adultsCount, kidsCount, packages, tiers]);

  // CALCULO DOS TOTAIS
  const adultsSubtotal = useMemo(() => adultsCount * pricePerAdult, [adultsCount, pricePerAdult]);
  const kidsSubtotal = useMemo(() => kidsCount * pricePerKid, [kidsCount, pricePerKid]);
  const grandTotal = useMemo(() => adultsSubtotal + kidsSubtotal, [adultsSubtotal, kidsSubtotal]);

  const selectedPack = packages?.find((p) => p.id === selectedPackageId);
  const currentPricing = resolvePackagePricing(selectedPack, totalGuests);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-6xl mx-auto">
      {/* PAINEL PRINCIPAL / FORMULÁRIO */}
      <div className="lg:col-span-2 space-y-6">
        {/* SELEÇÃO DO PACOTE */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="font-bold text-sm">Pacotes *</Label>
            <Button variant="outline" size="sm" type="button">
              <Plus className="size-3.5 mr-1" /> Adicionar pacote
            </Button>
          </div>

          <select
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm font-medium"
            value={selectedPackageId}
            onChange={(e) => setSelectedPackageId(e.target.value)}
          >
            <option value="">Selecione um pacote...</option>
            {packages?.map((pkg) => {
              const info = resolvePackagePricing(pkg, totalGuests);
              let labelPrice = "";

              if (pkg.pricing_type === "fixed") {
                labelPrice = info.tierFound
                  ? `${brl(info.totalPrice)} (Preço Fechado)`
                  : "(Sem faixa para este nº de convidados)";
              } else {
                labelPrice = `${brl(info.unitPrice)}/pessoa`;
              }

              return (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} · {labelPrice}
                </option>
              );
            })}
          </select>
        </div>

        {/* DADOS DO EVENTO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Data do evento *</Label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Horário</Label>
            <Input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Tipo</Label>
            <Input
              placeholder="Casa"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold">Endereço do evento</Label>
          <Input
            placeholder="Rua, número, bairro"
            value={eventAddress}
            onChange={(e) => setEventAddress(e.target.value)}
          />
        </div>

        {/* VALORES E QUANTIDADE DE CONVIDADOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Adultos</Label>
            <Input
              type="number"
              min="0"
              value={adultsCount}
              onChange={(e) => setAdultsCount(Number(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Preço por pessoa (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={pricePerAdult}
              onChange={(e) => setPricePerAdult(Number(e.target.value) || 0)}
            />
            <p className="text-[10px] text-muted-foreground">
              Edite livremente o valor por adulto.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Nº de crianças</Label>
            <Input
              type="number"
              min="0"
              value={kidsCount}
              onChange={(e) => setKidsCount(Number(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Valor por criança (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={pricePerKid}
              onChange={(e) => setPricePerKid(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* ALERTA DE PREÇO FECHADO */}
        {selectedPack?.pricing_type === "fixed" && (
          <div className="p-3 bg-muted/60 border border-border rounded-lg text-xs space-y-1">
            <span className="font-bold text-primary uppercase">Pacote de Preço Fechado</span>
            <p className="text-muted-foreground">
              Valor fixo da faixa: <b>{brl(currentPricing.totalPrice)}</b> (Divisão calculada: {brl(pricePerAdult)}/pessoa para {totalGuests} convidados).
            </p>
          </div>
        )}
      </div>

      {/* PAINEL LATERAL / RESUMO */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 h-fit shadow-sm">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumo</h3>
          <p className="text-[11px] text-muted-foreground">Cálculo automático em tempo real</p>
        </div>

        <div className="space-y-2 text-sm border-t border-border pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Adultos ({adultsCount}):</span>
            <span className="font-mono font-medium">{brl(adultsSubtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Crianças ({kidsCount} × {brl(pricePerKid)}):
            </span>
            <span className="font-mono font-medium">{brl(kidsSubtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Preço por pessoa médio:</span>
            <span className="font-mono font-medium">
              {totalGuests > 0 ? brl(grandTotal / totalGuests) : brl(0)}
            </span>
          </div>

          <div className="flex justify-between border-t border-border/60 pt-2 font-medium">
            <span>Subtotal</span>
            <span className="font-mono">{brl(grandTotal)}</span>
          </div>
        </div>

        <div className="border-t border-border pt-3 flex justify-between items-baseline">
          <span className="font-extrabold uppercase text-xs tracking-wider">TOTAL</span>
          <span className="text-2xl font-extrabold font-mono text-primary">
            {brl(grandTotal)}
          </span>
        </div>

        <div className="pt-2 space-y-2">
          <Button className="w-full font-bold">Salvar orçamento</Button>
        </div>
      </div>
    </div>
  );
}

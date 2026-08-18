import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, FileDown, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openPurchaseOrderPdf, type PurchaseOrderLine } from "@/lib/purchase-order-pdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Row = {
  id: string;
  product_id: string;
  name: string;
  unit: string;
  qty_per_person: number;
  qty_fixed: number;
  available: number;
  unit_price: number | null;
};

const n2 = (v: number) => Math.round((Number(v) || 0) * 1000) / 1000;
const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(v) || 0);

export function ConsumptionCalculator() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [packageId, setPackageId] = useState<string>("");
  const [guests, setGuests] = useState<number>(50);
  const [edits, setEdits] = useState<Record<string, { per: number; fixed: number }>>({});

  const { data: packages } = useQuery({
    queryKey: ["calc-packages"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const activePackageId = packageId || packages?.[0]?.id || "";

  const { data: rows, isFetching } = useQuery({
    queryKey: ["calc-rows", activePackageId],
    enabled: open && !!activePackageId,
    queryFn: async () => {
      const [{ data: items, error }, { data: moves }] = await Promise.all([
        (supabase as any)
          .from("package_products")
          .select(
            "id, product_id, qty_per_person, qty_fixed, stock_products(name, unit, physical_qty, reserved_qty)",
          )
          .eq("package_id", activePackageId),
        (supabase as any)
          .from("stock_movements")
          .select("product_id, unit_price, created_at")
          .not("unit_price", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (error) throw error;

      const lastPrice = new Map<string, number>();
      for (const m of (moves ?? []) as any[]) {
        if (!lastPrice.has(m.product_id)) lastPrice.set(m.product_id, Number(m.unit_price) || 0);
      }

      return ((items ?? []) as any[])
        .map((i) => ({
          id: i.id,
          product_id: i.product_id,
          name: i.stock_products?.name ?? "Produto",
          unit: i.stock_products?.unit ?? "un",
          qty_per_person: Number(i.qty_per_person) || 0,
          qty_fixed: Number(i.qty_fixed) || 0,
          available:
            (Number(i.stock_products?.physical_qty) || 0) -
            (Number(i.stock_products?.reserved_qty) || 0),
          unit_price: lastPrice.has(i.product_id) ? lastPrice.get(i.product_id)! : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) as Row[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["calc-settings"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("buffet_settings")
        .select("business_name, phone, whatsapp, address, logo_url")
        .maybeSingle();
      return data ?? null;
    },
  });

  const computed = useMemo(() => {
    const g = Math.max(0, Number(guests) || 0);
    return (rows ?? []).map((r) => {
      const e = edits[r.id];
      const per = e ? e.per : r.qty_per_person;
      const fixed = e ? e.fixed : r.qty_fixed;
      const needed = n2(per * g + fixed);
      const missing = Math.max(0, n2(needed - r.available));
      return {
        ...r,
        per,
        fixed,
        needed,
        missing,
        cost: r.unit_price != null ? r.unit_price * missing : 0,
        dirty: !!e && (per !== r.qty_per_person || fixed !== r.qty_fixed),
      };
    });
  }, [rows, edits, guests]);

  const totalCost = computed.reduce((s, r) => s + r.cost, 0);
  const dirtyRows = computed.filter((r) => r.dirty);

  const save = useMutation({
    mutationFn: async () => {
      for (const r of dirtyRows) {
        const { error } = await (supabase as any)
          .from("package_products")
          .update({ qty_per_person: r.per, qty_fixed: r.fixed })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setEdits({});
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["calc-rows", activePackageId] });
      qc.invalidateQueries({ queryKey: ["pkg-products", activePackageId] });
      toast.success("Consumo atualizado no pacote");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function gerarRelatorio() {
    const toBuy = computed.filter((r) => r.missing > 0);
    if (toBuy.length === 0) return toast.info("Estoque suficiente para esse número de convidados");
    const pkgName = (packages ?? []).find((p) => p.id === activePackageId)?.name ?? "Pacote";
    const lines: PurchaseOrderLine[] = toBuy.map((r) => ({
      name: r.name,
      unit: r.unit,
      category: `${pkgName} · ${guests} conv.`,
      physical_qty: r.available,
      reserved_qty: 0,
      available: r.available,
      min_qty: r.needed,
      target_qty: r.needed,
      suggested_qty: r.missing,
      unit_price: r.unit_price,
      estimated_total: r.cost,
      critical: r.available <= 0,
    }));
    try {
      await openPurchaseOrderPdf({ lines, buffet: settings as any });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full text-xs font-bold">
          <Calculator className="size-4 mr-1" /> Calculadora de consumo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Calculadora de produtos consumidos</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Pacote</Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={activePackageId}
              onChange={(e) => {
                setPackageId(e.target.value);
                setEdits({});
              }}
            >
              {(packages ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Convidados</Label>
            <Input
              type="number"
              min={0}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="max-h-[45vh] overflow-y-auto -mx-1 px-1">
          {isFetching ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin inline mr-2" /> Calculando…
            </div>
          ) : computed.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Esse pacote não tem produtos consumidos cadastrados. Edite o pacote e adicione os
              insumos.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Insumo</th>
                  <th className="text-right">p/pessoa</th>
                  <th className="text-right">fixo</th>
                  <th className="text-right">Necessário</th>
                  <th className="text-right">Disponível</th>
                  <th className="text-right">Comprar</th>
                  <th className="text-right">Custo est.</th>
                </tr>
              </thead>
              <tbody>
                {computed.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-2">
                      <div className="font-semibold truncate">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.unit}</div>
                    </td>
                    <td className="text-right">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        className="h-8 w-20 text-right"
                        value={r.per}
                        onChange={(e) =>
                          setEdits((s) => ({
                            ...s,
                            [r.id]: { per: Number(e.target.value) || 0, fixed: r.fixed },
                          }))
                        }
                      />
                    </td>
                    <td className="text-right">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        className="h-8 w-20 text-right"
                        value={r.fixed}
                        onChange={(e) =>
                          setEdits((s) => ({
                            ...s,
                            [r.id]: { per: r.per, fixed: Number(e.target.value) || 0 },
                          }))
                        }
                      />
                    </td>
                    <td className="text-right font-mono font-bold">
                      {fmt(r.needed)} {r.unit}
                    </td>
                    <td
                      className={`text-right font-mono ${
                        r.available < r.needed ? "text-destructive" : "text-success"
                      }`}
                    >
                      {fmt(r.available)}
                    </td>
                    <td className="text-right font-mono font-bold">
                      {r.missing > 0 ? `${fmt(r.missing)} ${r.unit}` : "—"}
                    </td>
                    <td className="text-right font-mono">
                      {r.unit_price != null ? brl(r.cost) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Custo estimado da compra: </span>
            <span className="font-mono font-extrabold text-primary">{brl(totalCost)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dirtyRows.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={save.isPending}
              >
                <Save className="size-3.5 mr-1" /> Confirmar e salvar no pacote ({dirtyRows.length})
              </Button>
            )}
            <Button size="sm" onClick={gerarRelatorio} disabled={computed.length === 0}>
              <FileDown className="size-3.5 mr-1" /> Gerar relatório (PDF)
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Necessário = (por pessoa × convidados) + fixo. "Comprar" desconta o estoque disponível
          (físico − reservado). Custo estimado usa o último preço de compra registrado.
        </p>
      </DialogContent>
    </Dialog>
  );
}

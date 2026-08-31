import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";

interface PackageItem {
  id: string;
  name: string;
  price_per_person: number;
  pricing_type?: "per_person" | "fixed";
  price_fixed?: number;
}

interface BreakdownPrecoProps {
  packages: PackageItem[];
  adults: number;
  childrenCount: number;
  childrenPrice: number;
}

export function BreakdownPreco({
  packages,
  adults,
  childrenCount,
  childrenPrice,
}: BreakdownPrecoProps) {
  // Subtotal de adultos/pacotes (considera Preço Fechado vs Por Pessoa)
  const totalAdults = packages.reduce((sum, pkg) => {
    if (pkg.pricing_type === "fixed") {
      return sum + Number(pkg.price_fixed || 0);
    }
    return sum + adults * Number(pkg.price_per_person || 0);
  }, 0);

  const totalChildren = childrenCount * childrenPrice;

  return (
    <div className="space-y-2 md:col-span-1">
      <Label>Composição do preço</Label>
      <div className="space-y-1 p-3 bg-muted/20 rounded-lg border text-sm">
        {packages.length > 0 ? (
          <>
            {packages.map((pkg) => {
              const isFixed = pkg.pricing_type === "fixed";
              const itemValue = isFixed
                ? Number(pkg.price_fixed || 0)
                : Number(pkg.price_per_person || 0);

              return (
                <div key={pkg.id} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground truncate max-w-[130px]">
                    {pkg.name?.slice(0, 18)}
                    {pkg.name?.length > 18 ? "…" : ""}
                  </span>
                  <span className="font-mono">
                    {brl(itemValue)} {isFixed ? "(Fixo)" : "/p"}
                  </span>
                </div>
              );
            })}

            <div className="flex justify-between bg-primary/5 p-2 rounded-lg mt-2 text-xs">
              <span className="text-muted-foreground font-medium">
                Subtotal Pacotes ({adults || 0} conv.)
              </span>
              <span className="font-bold font-mono text-primary">
                {brl(totalAdults)}
              </span>
            </div>

            {childrenCount > 0 && childrenPrice > 0 && (
              <div className="flex justify-between bg-primary/5 p-2 rounded-lg mt-1 text-xs">
                <span className="text-muted-foreground">
                  👶 {childrenCount} × {brl(childrenPrice)}
                </span>
                <span className="font-bold font-mono text-primary">
                  {brl(totalChildren)}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">Nenhum pacote selecionado</p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        💡 Valor calculado com base nos pacotes selecionados
      </p>
    </div>
  );
}

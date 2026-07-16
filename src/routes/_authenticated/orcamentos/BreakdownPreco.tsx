import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";

interface BreakdownPrecoProps {
  packages: { id: string; name: string; price_per_person: number }[];
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
  const totalPorPessoa = packages.reduce(
    (sum, pkg) => sum + Number(pkg.price_per_person || 0),
    0
  );

  const totalAdults = adults * totalPorPessoa;
  const totalChildren = childrenCount * childrenPrice;
  const totalEvent = totalAdults + totalChildren;

  return (
    <div className="space-y-2 md:col-span-1">
      <Label>Composição do preço</Label>
      <div className="space-y-1 p-3 bg-muted/20 rounded-lg border text-sm">
        {packages.length > 0 ? (
          <>
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs truncate max-w-[100px]">
                  {pkg.name?.slice(0, 18)}
                  {pkg.name?.length > 18 ? "…" : ""}
                </span>
                <span className="font-mono text-xs">
                  {brl(Number(pkg.price_per_person || 0))}
                </span>
              </div>
            ))}

            <div className="flex justify-between font-semibold pt-2 border-t text-sm">
              <span>Total / pessoa</span>
              <span className="text-primary font-mono">{brl(totalPorPessoa)}</span>
            </div>

            <div className="flex justify-between bg-primary/5 p-2 rounded-lg mt-1 text-xs">
              <span className="text-muted-foreground">
                👥 {adults || 0} × {brl(totalPorPessoa)}
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

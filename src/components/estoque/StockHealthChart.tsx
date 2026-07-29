import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type P = {
  id: string;
  name: string;
  unit: string;
  physical_qty: number;
  reserved_qty: number;
  min_qty: number;
};

const COLORS = {
  otimo: "#16a34a",
  baixo: "#f59e0b",
  critico: "#dc2626",
} as const;

export type StockLevel = keyof typeof COLORS;

export function stockLevel(p: { physical_qty: number; reserved_qty: number; min_qty: number }): StockLevel {
  const avail = Number(p.physical_qty) - Number(p.reserved_qty);
  const min = Number(p.min_qty) || 0;
  if (avail <= 0 || (min > 0 && avail <= min * 0.5)) return "critico";
  if (min > 0 ? avail <= min : avail <= 0) return "baixo";
  return "otimo";
}

const LABELS: Record<StockLevel, string> = {
  otimo: "Ótimo",
  baixo: "Estoque baixo",
  critico: "Crítico",
};

export function StockHealthChart({ products }: { products: P[] }) {
  if (!products.length) return null;

  const counts: Record<StockLevel, number> = { otimo: 0, baixo: 0, critico: 0 };
  products.forEach((p) => {
    counts[stockLevel(p)]++;
  });

  const data = (Object.keys(counts) as StockLevel[])
    .map((k) => ({ key: k, name: LABELS[k], value: counts[k] }))
    .filter((d) => d.value > 0);

  const attention = products
    .map((p) => ({
      ...p,
      level: stockLevel(p),
      avail: Number(p.physical_qty) - Number(p.reserved_qty),
    }))
    .filter((p) => p.level !== "otimo")
    .sort((a, b) => a.avail - b.avail)
    .slice(0, 6);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Consumo / saúde do estoque
        </h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={68} paddingAngle={2}>
                {data.map((d) => (
                  <Cell key={d.key} fill={COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v} produto(s)`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-1">
          {(Object.keys(counts) as StockLevel[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="size-2.5 rounded-full" style={{ background: COLORS[k] }} />
              {LABELS[k]} ({counts[k]})
            </span>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Produtos que precisam de atenção
        </h3>
        {attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os produtos estão em nível ótimo. 🎉</p>
        ) : (
          <div className="space-y-3">
            {attention.map((p) => {
              const min = Number(p.min_qty) || 0;
              const base = Math.max(min * 2, p.avail, 1);
              const pct = Math.max(0, Math.min(100, (p.avail / base) * 100));
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold truncate">{p.name}</span>
                    <span className="font-mono" style={{ color: COLORS[p.level] }}>
                      {p.avail.toLocaleString("pt-BR")} {p.unit} · mín {min.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: COLORS[p.level] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

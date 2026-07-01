import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Meu Churras" }] }),
  component: () => <Placeholder title="Financeiro" hint="Registrar pagamentos, entradas, saldos e fluxo de caixa." />,
});

export function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{hint}</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-16 text-center">
        <Construction className="size-8 mx-auto text-muted-foreground mb-3" />
        <div className="text-sm font-semibold">Em construção</div>
        <div className="text-xs text-muted-foreground mt-1">
          Este módulo está previsto para a próxima fase.
        </div>
      </div>
    </div>
  );
}

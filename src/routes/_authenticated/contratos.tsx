import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./financeiro";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Meu Churras" }] }),
  component: () => (
    <Placeholder title="Contratos" hint="Gerar contratos a partir dos orçamentos aprovados." />
  ),
});

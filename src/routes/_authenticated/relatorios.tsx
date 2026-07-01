import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./financeiro";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Meu Churras" }] }),
  component: () => (
    <Placeholder title="Relatórios" hint="Receita, eventos, clientes e mais — em breve." />
  ),
});

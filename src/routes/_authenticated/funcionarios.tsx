import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./financeiro";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — Meu Churras" }] }),
  component: () => (
    <Placeholder title="Funcionários" hint="Cadastro, cargos, permissões e escala." />
  ),
});

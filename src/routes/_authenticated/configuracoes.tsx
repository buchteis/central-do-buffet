import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./financeiro";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Meu Churras" }] }),
  component: () => (
    <Placeholder
      title="Configurações"
      hint="Dados da empresa, regras do buffet e modelos de mensagens."
    />
  ),
});

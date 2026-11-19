import { pageHead } from "@/lib/page-head";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => pageHead("Central do Buffet — Gestão de eventos", "Gestão de clientes, orçamentos, calendário e financeiro do seu buffet."),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

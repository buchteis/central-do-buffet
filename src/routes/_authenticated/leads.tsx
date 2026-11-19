import { pageHead } from "@/lib/page-head";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => pageHead("Leads — Central do Buffet", "Consulte solicitações de orçamento recebidas pelo seu buffet."),
  beforeLoad: () => {
    throw redirect({ to: "/orcamentos" });
  },
});

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Headset } from "lucide-react";
import { SupportWorkspace } from "@/components/support/SupportWorkspace";
import { Button } from "@/components/ui/button";
import { supportInboxOptions } from "@/lib/support-query";

export const Route = createFileRoute("/_authenticated/mensagens")({
  head: () => ({ meta: [
    { title: "Mensagens de suporte — Central do Buffet" },
    { name: "description", content: "Conversa privada entre seu buffet e o suporte Central do Buffet." },
    { property: "og:title", content: "Mensagens de suporte — Central do Buffet" },
    { property: "og:description", content: "Contato com o suporte e histórico de mensagens do seu cadastro." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(supportInboxOptions()); },
  component: MessagesPage,
  pendingComponent: () => <p className="py-10 text-center text-muted-foreground">Carregando suporte…</p>,
  errorComponent: SupportError,
  notFoundComponent: () => <p>Conversa não encontrada.</p>,
});

function MessagesPage() {
  return <div className="space-y-6">
    <h1 className="flex items-center gap-3 text-2xl font-extrabold md:text-3xl"><Headset className="size-7 text-primary" />Mensagens</h1>
    <SupportWorkspace />
  </div>;
}

function SupportError() {
  const router = useRouter();
  const boundary = useQueryErrorResetBoundary();
  return <div className="space-y-4 py-10 text-center">
    <p>Não foi possível carregar o suporte.</p>
    <Button variant="outline" onClick={() => { boundary.reset(); router.invalidate(); }}>Tentar novamente</Button>
  </div>;
}
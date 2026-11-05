import { createFileRoute } from "@tanstack/react-router";
import { handleEvolutionWebhook } from "@/lib/evolution-webhook.server";

export const Route = createFileRoute("/webhook/whatsapp")({
  server: {
    handlers: {
      POST: ({ request }) => handleEvolutionWebhook(request),
    },
  },
});

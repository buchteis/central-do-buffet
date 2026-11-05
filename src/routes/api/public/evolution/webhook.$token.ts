import { createFileRoute } from "@tanstack/react-router";
import { handleEvolutionWebhook } from "@/lib/evolution-webhook.server";

export const Route = createFileRoute("/api/public/evolution/webhook/$token")({
  server: {
    handlers: {
      POST: ({ request, params }) => handleEvolutionWebhook(request, params.token),
    },
  },
});

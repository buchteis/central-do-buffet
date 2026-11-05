import { afterEach, describe, expect, it } from "vitest";
import { handleEvolutionWebhook } from "./evolution-webhook.server";

const originalSecret = process.env.WEBHOOK_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.WEBHOOK_SECRET;
  else process.env.WEBHOOK_SECRET = originalSecret;
});

describe("handleEvolutionWebhook", () => {
  it("rejects requests without the configured secret before parsing the body", async () => {
    process.env.WEBHOOK_SECRET = "test-secret";
    const response = await handleEvolutionWebhook(
      new Request("https://example.test/webhook/whatsapp", {
        method: "POST",
        body: "not-json",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("reports missing webhook configuration", async () => {
    delete process.env.WEBHOOK_SECRET;
    const response = await handleEvolutionWebhook(
      new Request("https://example.test/webhook/whatsapp", {
        method: "POST",
        headers: { WEBHOOK_SECRET: "test-secret" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(503);
  });
});

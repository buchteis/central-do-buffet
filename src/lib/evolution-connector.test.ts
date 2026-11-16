import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectionState,
  connectInstance,
  createInstance,
  deleteInstance,
  evolutionConfig,
  fetchInstanceInfo,
  logoutInstance,
  sendText,
  setWebhook,
} from "./evolution.server";

const gatewayUrl = "https://connector-gateway.lovable.dev/udc_evolution_api_central_do_buffet";

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-gateway-key");
  vi.stubEnv("UDC_EVOLUTION_API_CENTRAL_DO_BUFFET_API_KEY", "test-connection-key");
  vi.stubEnv("EVOLUTION_API_URL", "https://stale-server.example.test");
  vi.stubEnv("EVOLUTION_API_KEY", "test-legacy-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("linked Evolution connector", () => {
  it("uses the linked connector instead of the legacy direct server", () => {
    expect(evolutionConfig()).toEqual({
      url: gatewayUrl,
      key: "test-connection-key",
      gatewayKey: "test-gateway-key",
    });
  });

  it.each(["LOVABLE_API_KEY", "UDC_EVOLUTION_API_CENTRAL_DO_BUFFET_API_KEY"])(
    "refuses calls when %s is missing, even if legacy credentials exist",
    async (name) => {
      vi.stubEnv(name, "");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      expect(evolutionConfig()).toBeNull();
      await expect(connectionState("buffet-a")).rejects.toMatchObject({ status: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  const operations: [string, string, () => Promise<unknown>][] = [
    ["POST", "/instance/create", () => createInstance("buffet-a", "https://example.test/hook")],
    ["POST", "/webhook/set/buffet-a", () => setWebhook("buffet-a", "https://example.test/hook")],
    ["GET", "/instance/connect/buffet-a", () => connectInstance("buffet-a")],
    ["GET", "/instance/connectionState/buffet-a", () => connectionState("buffet-a")],
    ["GET", "/instance/fetchInstances?instanceName=buffet-a", () => fetchInstanceInfo("buffet-a")],
    ["DELETE", "/instance/logout/buffet-a", () => logoutInstance("buffet-a")],
    ["DELETE", "/instance/delete/buffet-a", () => deleteInstance("buffet-a")],
    ["POST", "/message/sendText/buffet-a", () => sendText("buffet-a", "5511999999999", "Olá")],
  ];

  it.each(operations)("routes %s %s through the connector", async (method, path, operation) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: { id: "sent-1" } })));
    vi.stubGlobal("fetch", fetchMock);
    await operation();
    expect(fetchMock).toHaveBeenCalledWith(`${gatewayUrl}${path}`, expect.objectContaining({
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-gateway-key",
        "X-Connection-Api-Key": "test-connection-key",
      },
    }));
  });

  it("retains the accepted message id for the existing conversation record", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: { id: "accepted-id" } }))));
    await expect(sendText("buffet-a", "5511999999999", "Olá")).resolves.toEqual({ messageId: "accepted-id" });
  });

  it("preserves the provider status and error without a direct-server retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"Instance offline"}', { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(connectionState("buffet-a")).rejects.toMatchObject({
      status: 503,
      body: '{"message":"Instance offline"}',
      message: 'Evolution respondeu 503: {"message":"Instance offline"}',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
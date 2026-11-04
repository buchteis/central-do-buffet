// Evolution API (self-hosted WhatsApp) client — server only.
// Needs EVOLUTION_API_URL (e.g. https://evo.seudominio.com) and EVOLUTION_API_KEY (global apikey).

export const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"];

export function evolutionConfig(): { url: string; key: string } | null {
  const url = (process.env["EVOLUTION_API_URL"] ?? "").trim().replace(/\/+$/, "");
  const key = (process.env["EVOLUTION_API_KEY"] ?? "").trim();
  if (!/^https?:\/\//.test(url) || !key) return null;
  return { url, key };
}

export function publicAppOrigin(): string {
  const raw = (process.env["PUBLIC_APP_URL"] ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(raw) ? raw : "https://centraldobuffet.lovable.app";
}

export function webhookUrlFor(secret: string) {
  return `${publicAppOrigin()}/api/public/evolution/webhook/${secret}`;
}

export class EvolutionError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message);
  }
}

async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const cfg = evolutionConfig();
  if (!cfg) throw new EvolutionError("Servidor de WhatsApp não configurado.", 0, "");
  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: cfg.key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Evolution ${method} ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new EvolutionError(`Evolution respondeu ${res.status}`, res.status, text);
  }
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return {} as T;
  }
}

const enc = encodeURIComponent;

export function createInstance(instanceName: string, webhookUrl: string) {
  return call("POST", "/instance/create", {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    groupsIgnore: true,
    rejectCall: false,
    alwaysOnline: false,
    readMessages: false,
    webhook: { url: webhookUrl, byEvents: false, base64: false, events: WEBHOOK_EVENTS },
  });
}

export function setWebhook(instanceName: string, webhookUrl: string) {
  return call("POST", `/webhook/set/${enc(instanceName)}`, {
    webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: WEBHOOK_EVENTS },
  });
}

export function connectInstance(instanceName: string) {
  return call<{ base64?: string; code?: string; pairingCode?: string; instance?: { state?: string } }>(
    "GET",
    `/instance/connect/${enc(instanceName)}`,
  );
}

export function connectionState(instanceName: string) {
  return call<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${enc(instanceName)}`);
}

export async function fetchInstanceInfo(instanceName: string) {
  const r = await call<any>("GET", `/instance/fetchInstances?instanceName=${enc(instanceName)}`);
  const row = Array.isArray(r) ? r[0] : r;
  const inst = row?.instance ?? row ?? {};
  const owner: string | undefined = inst.ownerJid ?? inst.owner ?? row?.ownerJid;
  return {
    phone: owner ? owner.split("@")[0].split(":")[0] : null,
    profileName: (inst.profileName ?? row?.profileName ?? null) as string | null,
  };
}

export function logoutInstance(instanceName: string) {
  return call("DELETE", `/instance/logout/${enc(instanceName)}`);
}

export function deleteInstance(instanceName: string) {
  return call("DELETE", `/instance/delete/${enc(instanceName)}`);
}

export async function sendText(instanceName: string, number: string, text: string) {
  const r = await call<{ key?: { id?: string } }>("POST", `/message/sendText/${enc(instanceName)}`, {
    number,
    text,
  });
  return { messageId: r?.key?.id ?? null };
}

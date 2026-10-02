// Hindsight (Vectorize) memory client — one memory bank per buffet (tenant).
function cfg() {
  const raw = process.env.HINDSIGHT_API_URL?.trim() ?? "";
  const url = (/^https?:\/\//.test(raw) ? raw : "https://api.hindsight.vectorize.io").replace(/\/+$/, "");
  const key = process.env.HINDSIGHT_API_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function headers(key: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

export async function hindsightRecall(bankId: string, query: string): Promise<string[]> {
  const c = cfg();
  if (!c) return [];
  try {
    const res = await fetch(`${c.url}/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`, {
      method: "POST",
      headers: headers(c.key),
      body: JSON.stringify({ query, max_tokens: 2048 }),
    });
    if (!res.ok) {
      console.error("Hindsight recall error", res.status, await res.text());
      return [];
    }
    const json = (await res.json()) as any;
    const list: any[] = json?.results ?? json?.memories ?? [];
    return list.map((r) => String(r?.text ?? r?.content ?? "")).filter(Boolean).slice(0, 15);
  } catch (e) {
    console.error("Hindsight recall failed", e);
    return [];
  }
}

export async function hindsightRetain(bankId: string, content: string, context = "chat do assistente") {
  const c = cfg();
  if (!c) return;
  try {
    const res = await fetch(`${c.url}/v1/default/banks/${encodeURIComponent(bankId)}/memories`, {
      method: "POST",
      headers: headers(c.key),
      body: JSON.stringify({
        items: [{ content, context, timestamp: new Date().toISOString() }],
        async: true,
      }),
    });
    if (!res.ok) console.error("Hindsight retain error", res.status, await res.text());
  } catch (e) {
    console.error("Hindsight retain failed", e);
  }
}

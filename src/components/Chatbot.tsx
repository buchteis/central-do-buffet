import React, { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { chatWithAssistant } from "@/lib/chatbot.functions";
import { getBuffetAlerts, type BuffetAlert } from "@/lib/alerts.functions";
import { parseInvoiceFile, commitInvoiceStockEntry } from "@/lib/nf-stock.functions";
import { suggestEventStaffing, assignEventStaffing } from "@/lib/staffing.functions";
import { Flame, Paperclip } from "lucide-react";

type NfReview = {
  header: any;
  matches: any[];
  products: { id: string; name: string; unit: string; physical_qty: number }[];
  duplicate: { id: string; created_at: string } | null;
};

type StaffSlot = { role: string; employee_id: string | null; employee_name: string | null; amount: number };

type StaffingReview = {
  event: any;
  employees: { id: string; name: string; role: string; daily_rate: number }[];
  strategies: {
    id: string;
    nome: string;
    descricao: string;
    total_profissionais: number;
    custo_estimado: number;
    vagas_sem_funcionario: number;
    slots: StaffSlot[];
  }[];
  selected: string | null;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  alertId?: string;
  review?: NfReview;
  staffing?: StaffingReview;
};


const ACK_KEY = "cdb_alertas_confirmados";


function readAck(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ACK_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeAck(ids: string[]) {
  try {
    localStorage.setItem(ACK_KEY, JSON.stringify(ids.slice(-300)));
  } catch {
    /* ignore */
  }
}

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o assistente virtual da Central do Buffet. Como posso ajudar você hoje?",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: access } = useTenantAccess();
  const chat = useServerFn(chatWithAssistant);
  const fetchAlerts = useServerFn(getBuffetAlerts);
  const parseNf = useServerFn(parseInvoiceFile);
  const commitNf = useServerFn(commitInvoiceStockEntry);
  const suggestStaff = useServerFn(suggestEventStaffing);
  const assignStaff = useServerFn(assignEventStaffing);
  const queryClient = useQueryClient();


  const [acked, setAcked] = useState<string[]>([]);
  useEffect(() => {
    setAcked(readAck());
  }, []);

  const { data: alertData } = useQuery({
    queryKey: ["buffet-alerts", access?.tenant?.id ?? null],
    queryFn: async () => (await fetchAlerts({})) as { alerts: BuffetAlert[] },
    enabled: !!access?.tenant?.id,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const pending: BuffetAlert[] = (alertData?.alerts ?? []).filter((a) => !acked.includes(a.id));

  // Injeta os alertas pendentes na conversa (uma vez cada)
  useEffect(() => {
    if (!pending.length) return;
    setMessages((prev) => {
      const existing = new Set(prev.map((m) => m.alertId).filter(Boolean) as string[]);
      const novos = pending
        .filter((a) => !existing.has(a.id))
        .map((a) => ({ role: "assistant" as const, content: a.message, alertId: a.id }));
      return novos.length ? [...prev, ...novos] : prev;
    });
  }, [alertData, acked]);

  const ackAlert = (id: string) => {
    const next = Array.from(new Set([...readAck(), id]));
    writeAck(next);
    setAcked(next);
    setMessages((p) => [...p, { role: "assistant", content: "✅ Alerta confirmado. Não vou avisar novamente sobre este item." }]);
  };

  const ackAll = () => {
    const next = Array.from(new Set([...readAck(), ...pending.map((a) => a.id)]));
    writeAck(next);
    setAcked(next);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const push = (m: Msg) => setMessages((p) => [...p, m]);

  const handleFile = async (file: File) => {
    if (!access?.tenant?.id) {
      push({ role: "assistant", content: "⚠️ Faça login em um buffet ativo para usar o assistente." });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      push({ role: "assistant", content: "⚠️ Arquivo muito grande (máx. 8 MB)." });
      return;
    }
    push({ role: "user", content: `📄 ${file.name} — leia esta nota e prepare a entrada no estoque.` });
    setIsLoading(true);
    try {
      // O arquivo é lido apenas em memória e usado somente para extração.
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
      });
      const res: any = await parseNf({
        data: {
          filename: file.name,
          mimeType: file.type || (file.name.endsWith(".xml") ? "application/xml" : "application/octet-stream"),
          base64,
        },
      });
      if (res?.error) {
        push({ role: "assistant", content: `⚠️ ${res.error}` });
        return;
      }
      if (res.duplicate) {
        push({
          role: "assistant",
          content: `🚫 Esta nota fiscal já foi lançada neste buffet (registrada em ${new Date(res.duplicate.created_at).toLocaleDateString("pt-BR")}). Lançamento bloqueado para evitar duplicidade.`,
        });
        return;
      }
      const h = res.header;
      push({
        role: "assistant",
        content: `📑 Nota lida — ${h.fornecedor ?? "fornecedor não identificado"}${h.cnpj ? ` (CNPJ ${h.cnpj})` : ""}\nNF ${h.numero ?? "s/nº"}${h.serie ? ` série ${h.serie}` : ""}${h.data_emissao ? ` • emissão ${h.data_emissao}` : ""}\nValor total: ${brl(h.valor_total)}\n\nConfira os itens abaixo antes de confirmar a entrada:`,
        review: {
          header: h,
          matches: res.matches,
          products: res.products,
          duplicate: null,
        },
      });
    } catch (e: any) {
      console.error(e);
      push({ role: "assistant", content: `❌ ${e?.message ?? "Não consegui ler a nota fiscal."}` });
    } finally {
      setIsLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmEntry = async (review: NfReview, msgIndex: number) => {
    const items = review.matches
      .filter((m) => m.product_id)
      .map((m) => ({
        product_id: m.product_id as string,
        descricao: m.item.descricao,
        quantidade: Number(m.item.quantidade),
        unidade: m.item.unidade ?? null,
        valor_unitario: Number(m.item.valor_unitario || 0),
        valor_total: Number(m.item.valor_total || 0),
      }));
    if (!items.length) {
      push({ role: "assistant", content: "⚠️ Relacione ao menos um item a um produto do estoque." });
      return;
    }
    setIsLoading(true);
    try {
      const res: any = await commitNf({ data: { header: review.header, items } });
      if (res?.error) {
        push({ role: "assistant", content: `⚠️ ${res.error}` });
        return;
      }
      setMessages((p) => p.map((m, i) => (i === msgIndex ? { ...m, review: undefined } : m)));
      const linhas = (res.updated ?? [])
        .map((u: any) => `• ${u.name}: ${u.physical_qty} ${u.unit}`)
        .join("\n");
      push({
        role: "assistant",
        content: `✅ Entrada lançada no estoque a partir da nota fiscal.\n\nEstoque atualizado:\n${linhas}`,
      });
      queryClient.invalidateQueries();
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-products"] });
    } catch (e: any) {
      console.error(e);
      push({
        role: "assistant",
        content: `❌ Erro ao lançar a entrada no estoque${e?.message ? `: ${e.message}` : "."}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateMatch = (msgIndex: number, itemIndex: number, productId: string) => {
    setMessages((p) =>
      p.map((m, i) => {
        if (i !== msgIndex || !m.review) return m;
        const prod = m.review.products.find((x) => x.id === productId);
        const matches = m.review.matches.map((mt, j) =>
          j === itemIndex
            ? {
                ...mt,
                product_id: prod?.id ?? null,
                product_name: prod?.name ?? null,
                product_unit: prod?.unit ?? null,
                product_qty: prod?.physical_qty ?? null,
                confidence: prod ? 100 : 0,
              }
            : mt,
        );
        return { ...m, review: { ...m.review, matches } };
      }),
    );
  };

  /* ---------------- Escala automática de funcionários ---------------- */

  const requestStaffing = async (eventId?: string) => {
    setIsLoading(true);
    try {
      const res: any = await suggestStaff({ data: eventId ? { eventId } : {} });
      if (res?.error) {
        push({ role: "assistant", content: `⚠️ ${res.error}` });
        return;
      }
      const ev = res.event;
      const data = new Date(`${ev.data}T00:00:00`).toLocaleDateString("pt-BR");
      push({
        role: "assistant",
        content:
          `👥 Vamos montar a escala do evento de ${data}${ev.cliente ? ` — ${ev.cliente}` : ""}.\n` +
          `Convidados: ${ev.convidados} • Status: ${ev.status}${ev.ja_escalados ? ` • já escalados: ${ev.ja_escalados}` : ""}\n\n` +
          `Calculei a demanda pelo nº de convidados. Escolha a estratégia — ao escolher, escalo a equipe automaticamente:`,
        staffing: {
          event: ev,
          employees: res.employees,
          strategies: res.strategies,
          selected: res.strategies?.find((s: any) => s.id === "equilibrada")?.id ?? res.strategies?.[0]?.id ?? null,
        },
      });
    } catch (e: any) {
      console.error(e);
      push({ role: "assistant", content: `❌ Não consegui montar a escala${e?.message ? `: ${e.message}` : "."}` });
    } finally {
      setIsLoading(false);
    }
  };

  const selectStrategy = (msgIndex: number, strategyId: string) => {
    setMessages((p) =>
      p.map((m, i) => (i === msgIndex && m.staffing ? { ...m, staffing: { ...m.staffing, selected: strategyId } } : m)),
    );
  };

  const updateSlot = (msgIndex: number, strategyId: string, slotIndex: number, employeeId: string) => {
    setMessages((p) =>
      p.map((m, i) => {
        if (i !== msgIndex || !m.staffing) return m;
        const emp = m.staffing.employees.find((e) => e.id === employeeId);
        const strategies = m.staffing.strategies.map((s) =>
          s.id !== strategyId
            ? s
            : {
                ...s,
                slots: s.slots.map((sl, j) =>
                  j === slotIndex
                    ? {
                        ...sl,
                        employee_id: emp?.id ?? null,
                        employee_name: emp?.name ?? null,
                        amount: Number(emp?.daily_rate ?? 0),
                      }
                    : sl,
                ),
              },
        );
        return { ...m, staffing: { ...m.staffing, strategies } };
      }),
    );
  };

  const confirmStaffing = async (staffing: StaffingReview, msgIndex: number) => {
    const strategy = staffing.strategies.find((s) => s.id === staffing.selected);
    if (!strategy) return;
    const assignments = strategy.slots
      .filter((s) => s.employee_id)
      .map((s) => ({ employee_id: s.employee_id as string, role: s.role, amount: Number(s.amount || 0) }));
    if (!assignments.length) {
      push({ role: "assistant", content: "⚠️ Selecione ao menos um funcionário para escalar." });
      return;
    }
    setIsLoading(true);
    try {
      const res: any = await assignStaff({ data: { eventId: staffing.event.id, assignments } });
      if (res?.error) {
        push({ role: "assistant", content: `⚠️ ${res.error}` });
        return;
      }
      setMessages((p) => p.map((m, i) => (i === msgIndex ? { ...m, staffing: undefined } : m)));
      const ok = (res.inserted ?? [])
        .map((x: any) => `• ${x.name} — ${x.role} (${brl(x.amount)})`)
        .join("\n");
      const fail = (res.failed ?? []).map((x: any) => `• ${x.name}: ${x.reason}`).join("\n");
      push({
        role: "assistant",
        content:
          `✅ Equipe escalada automaticamente no evento.\n\n${ok || "—"}` +
          (fail ? `\n\n⚠️ Não escalados:\n${fail}` : ""),
      });
      queryClient.invalidateQueries();
    } catch (e: any) {
      console.error(e);
      push({ role: "assistant", content: `❌ Erro ao escalar a equipe${e?.message ? `: ${e.message}` : "."}` });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    if (!access?.tenant?.id) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "⚠️ Faça login em um buffet ativo para usar o assistente." },
      ]);
      return;
    }

    if (
      /(escal|equipe|funcion[áa]rio|garç|garc|staff)/i.test(text) &&
      /(escal|monta|sugir|sugest|prec|quantos|quantas|automat|organiz|defin)/i.test(text)
    ) {
      setInput("");
      push({ role: "user", content: text });
      await requestStaffing();
      return;
    }

    if (/(nota|nf|danfe)/i.test(text) && /(leia|ler|analis|entrada|adicion|lan[çc])/i.test(text)) {

      setInput("");
      push({ role: "user", content: text });
      push({
        role: "assistant",
        content: "Claro! Anexe a foto da nota, o PDF da DANFE ou o XML da NF-e no clipe 📎 abaixo. Eu leio, comparo com o seu estoque e mostro a conferência antes de lançar.",
      });
      return;
    }

    if (!access?.tenant?.id) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "⚠️ Faça login em um buffet ativo para usar o assistente." },
      ]);
      return;
    }

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((p) => [...p, { role: "user", content: text }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await chat({ data: { message: text, history } });
      setMessages((p) => [...p, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      console.error(e);
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "❌ Erro ao consultar o assistente. Tente novamente." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir assistente"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          background: "#FF7A00",
          border: "none",
          borderRadius: 16,
          width: 60,
          height: 60,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Flame className="size-7 text-white" />
        {pending.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 22,
              height: 22,
              padding: "0 6px",
              borderRadius: 11,
              background: "#dc2626",
              color: "white",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {pending.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            right: 20,
            zIndex: 9999,
            width: 380,
            maxWidth: "90vw",
            height: 520,
            maxHeight: "75vh",
            background: "white",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            border: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              background: "#f3f4f6",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28,
                height: 28,
                background: "#FF7A00",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <Flame className="size-4 text-white" />
              </div>
              Assistente — Central do Buffet
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {pending.length > 1 && (
                <button
                  onClick={ackAll}
                  style={{
                    background: "#e5e7eb",
                    border: "none",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Ciente de todos
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            style={{ flex: 1, padding: "16px 20px", overflowY: "auto", background: "#f9fafb" }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{ marginBottom: 12, textAlign: msg.role === "user" ? "right" : "left" }}
              >
                <div
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 12,
                    maxWidth: "85%",
                    whiteSpace: "pre-wrap",
                    background: msg.role === "user" ? "#22c55e" : "white",
                    color: msg.role === "user" ? "white" : "#1f2937",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    border: msg.role === "assistant" ? "1px solid #e5e7eb" : "none",
                    textAlign: "left",
                  }}
                >
                  {msg.content}
                  {msg.alertId && !acked.includes(msg.alertId) && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => ackAlert(msg.alertId!)}
                        style={{
                          background: "#FF7A00",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Ok, estou ciente
                      </button>
                    </div>
                  )}
                  {msg.review && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {msg.review.matches.map((m: any, j: number) => {
                        const ok = !!m.product_id && m.confidence >= 55;
                        return (
                          <div
                            key={j}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 10,
                              padding: 10,
                              background: ok ? "#f0fdf4" : "#fff7ed",
                              fontSize: 12,
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{m.item.descricao}</div>
                            <div style={{ color: "#4b5563" }}>
                              {m.item.quantidade} {m.item.unidade ?? "un"} • {brl(m.item.valor_unitario)} un •
                              total {brl(m.item.valor_total)}
                            </div>
                            {ok ? (
                              <div style={{ marginTop: 4 }}>
                                Correspondência: <b>{m.product_name}</b> (estoque atual {m.product_qty}{" "}
                                {m.product_unit}) — Confiança: <b>{m.confidence}%</b>
                              </div>
                            ) : (
                              <div style={{ marginTop: 4, color: "#9a3412" }}>
                                Produto não identificado. Deseja relacionar este item a um produto existente ou
                                cadastrar um novo produto no Estoque?
                              </div>
                            )}
                            <select
                              value={m.product_id ?? ""}
                              onChange={(e) => updateMatch(i, j, e.target.value)}
                              style={{
                                marginTop: 6,
                                width: "100%",
                                padding: "6px 8px",
                                borderRadius: 8,
                                border: "1px solid #d1d5db",
                                fontSize: 12,
                              }}
                            >
                              <option value="">— Não lançar este item —</option>
                              {msg.review!.products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.unit})
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => confirmEntry(msg.review!, i)}
                        disabled={isLoading}
                        style={{
                          background: "#22c55e",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Confirmar entrada no estoque
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ textAlign: "left", marginBottom: 12 }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 12,
                    background: "white",
                    color: "#6b7280",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  Digitando…
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #e5e7eb",
              background: "white",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.xml,text/xml,application/xml"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isLoading}
              title="Enviar nota fiscal (foto, PDF ou XML)"
              aria-label="Enviar nota fiscal"
              style={{
                padding: "10px 12px",
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Paperclip className="size-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ex: quantos eventos pagos este mês?"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: 14,
              }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              style={{
                padding: "10px 18px",
                background: "#22c55e",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: "bold",
                opacity: isLoading || !input.trim() ? 0.5 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

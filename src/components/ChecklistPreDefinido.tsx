import { useMemo, useState } from "react";
import { ClipboardCheck, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { waLink } from "@/lib/whatsapp";
import { copyToClipboard } from "@/lib/clipboard";
import { formatDateFullBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ChecklistTemplateKey =
  | "casamento"
  | "aniversario"
  | "empresarial"
  | "churrasco"
  | "coffee_break"
  | "infantil"
  | "formatura";

type ItemRule =
  | { label: string; fixed: number; unit?: string }
  | { label: string; perGuest: number; unit?: string; roundTo?: number };

type Template = {
  key: ChecklistTemplateKey;
  name: string;
  emoji: string;
  items: ItemRule[];
};

const TEMPLATES: Template[] = [
  {
    key: "casamento",
    name: "Casamento",
    emoji: "💍",
    items: [
      { label: "Garçons", perGuest: 1 / 15, unit: "un", roundTo: 1 },
      { label: "Copeiros", perGuest: 1 / 40, unit: "un", roundTo: 1 },
      { label: "Mesas redondas (8 lugares)", perGuest: 1 / 8, unit: "un", roundTo: 1 },
      { label: "Cadeiras", perGuest: 1, unit: "un" },
      { label: "Toalhas de mesa", perGuest: 1 / 8, unit: "un", roundTo: 1 },
      { label: "Taças de brinde", perGuest: 1, unit: "un" },
      { label: "Guardanapos", perGuest: 2, unit: "un" },
      { label: "Bandejas de serviço", fixed: 8, unit: "un" },
      { label: "Rechauds", fixed: 6, unit: "un" },
    ],
  },
  {
    key: "aniversario",
    name: "Aniversário",
    emoji: "🎂",
    items: [
      { label: "Garçons", perGuest: 1 / 20, unit: "un", roundTo: 1 },
      { label: "Mesas", perGuest: 1 / 8, unit: "un", roundTo: 1 },
      { label: "Cadeiras", perGuest: 1, unit: "un" },
      { label: "Pratos", perGuest: 2, unit: "un" },
      { label: "Talheres (conjuntos)", perGuest: 2, unit: "un" },
      { label: "Copos", perGuest: 3, unit: "un" },
      { label: "Guardanapos", perGuest: 2, unit: "un" },
      { label: "Bolo (kg)", perGuest: 0.1, unit: "kg" },
      { label: "Refrigerante (L)", perGuest: 0.5, unit: "L" },
    ],
  },
  {
    key: "empresarial",
    name: "Empresarial",
    emoji: "💼",
    items: [
      { label: "Garçons", perGuest: 1 / 25, unit: "un", roundTo: 1 },
      { label: "Mesas de apoio", perGuest: 1 / 20, unit: "un", roundTo: 1 },
      { label: "Cadeiras", perGuest: 1, unit: "un" },
      { label: "Copos de água", perGuest: 2, unit: "un" },
      { label: "Xícaras de café", perGuest: 2, unit: "un" },
      { label: "Pratos", perGuest: 1, unit: "un" },
      { label: "Guardanapos", perGuest: 2, unit: "un" },
      { label: "Squeezes de água (500ml)", perGuest: 1, unit: "un" },
    ],
  },
  {
    key: "churrasco",
    name: "Churrasco",
    emoji: "🍖",
    items: [
      { label: "Churrasqueiros", perGuest: 1 / 30, unit: "un", roundTo: 1 },
      { label: "Auxiliares", perGuest: 1 / 25, unit: "un", roundTo: 1 },
      { label: "Carne bovina (kg)", perGuest: 0.4, unit: "kg" },
      { label: "Frango (kg)", perGuest: 0.2, unit: "kg" },
      { label: "Linguiça (kg)", perGuest: 0.15, unit: "kg" },
      { label: "Pão de alho", perGuest: 1, unit: "un" },
      { label: "Carvão (kg)", perGuest: 0.5, unit: "kg" },
      { label: "Sal grosso (kg)", perGuest: 0.05, unit: "kg" },
      { label: "Cerveja (L)", perGuest: 1, unit: "L" },
      { label: "Refrigerante (L)", perGuest: 0.5, unit: "L" },
      { label: "Guardanapos", perGuest: 3, unit: "un" },
    ],
  },
  {
    key: "coffee_break",
    name: "Coffee Break",
    emoji: "☕",
    items: [
      { label: "Atendentes", perGuest: 1 / 30, unit: "un", roundTo: 1 },
      { label: "Xícaras", perGuest: 2, unit: "un" },
      { label: "Copos", perGuest: 2, unit: "un" },
      { label: "Pratos de sobremesa", perGuest: 2, unit: "un" },
      { label: "Salgados", perGuest: 6, unit: "un" },
      { label: "Doces", perGuest: 3, unit: "un" },
      { label: "Café (L)", perGuest: 0.2, unit: "L" },
      { label: "Suco (L)", perGuest: 0.3, unit: "L" },
      { label: "Guardanapos", perGuest: 3, unit: "un" },
    ],
  },
  {
    key: "infantil",
    name: "Infantil",
    emoji: "🎈",
    items: [
      { label: "Monitores/Recreadores", perGuest: 1 / 15, unit: "un", roundTo: 1 },
      { label: "Garçons", perGuest: 1 / 25, unit: "un", roundTo: 1 },
      { label: "Mesas infantis", perGuest: 1 / 6, unit: "un", roundTo: 1 },
      { label: "Cadeiras infantis", perGuest: 1, unit: "un" },
      { label: "Salgadinhos", perGuest: 8, unit: "un" },
      { label: "Docinhos", perGuest: 5, unit: "un" },
      { label: "Bolo (kg)", perGuest: 0.1, unit: "kg" },
      { label: "Refrigerante (L)", perGuest: 0.6, unit: "L" },
      { label: "Lembrancinhas", perGuest: 1, unit: "un" },
    ],
  },
  {
    key: "formatura",
    name: "Formatura",
    emoji: "🎓",
    items: [
      { label: "Garçons", perGuest: 1 / 15, unit: "un", roundTo: 1 },
      { label: "Copeiros", perGuest: 1 / 40, unit: "un", roundTo: 1 },
      { label: "Mesas redondas (8 lugares)", perGuest: 1 / 8, unit: "un", roundTo: 1 },
      { label: "Cadeiras", perGuest: 1, unit: "un" },
      { label: "Taças de brinde", perGuest: 1, unit: "un" },
      { label: "Copos", perGuest: 3, unit: "un" },
      { label: "Pratos", perGuest: 2, unit: "un" },
      { label: "Guardanapos", perGuest: 3, unit: "un" },
      { label: "Rechauds", fixed: 6, unit: "un" },
    ],
  },
];

function computeQuantity(rule: ItemRule, guests: number): number {
  if ("fixed" in rule) return rule.fixed;
  const raw = rule.perGuest * Math.max(0, guests);
  if (rule.roundTo && rule.roundTo >= 1) return Math.max(1, Math.ceil(raw));
  // 1 decimal for kg/L, integer for un
  if (rule.unit === "kg" || rule.unit === "L") return Math.round(raw * 10) / 10;
  return Math.ceil(raw);
}

function formatQty(n: number, unit?: string) {
  const num = Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return unit ? `${num} ${unit}` : num;
}

export type ChecklistPreDefinidoProps = {
  guests: number;
  defaultTemplate?: ChecklistTemplateKey;
  eventName?: string | null;
  clientName?: string | null;
  eventDate?: string | Date | null;
  eventTime?: string | null;
  eventAddress?: string | null;
  phone?: string | null;
};

export function ChecklistPreDefinido({
  guests,
  defaultTemplate,
  eventName,
  clientName,
  eventDate,
  eventTime,
  eventAddress,
  phone,
}: ChecklistPreDefinidoProps) {
  const [templateKey, setTemplateKey] = useState<ChecklistTemplateKey>(
    defaultTemplate ?? "aniversario",
  );
  const [customPhone, setCustomPhone] = useState("");

  const template = useMemo(
    () => TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[0],
    [templateKey],
  );

  const items = useMemo(
    () =>
      template.items.map((rule) => ({
        label: rule.label,
        unit: rule.unit,
        qty: computeQuantity(rule, guests),
      })),
    [template, guests],
  );

  const message = useMemo(() => {
    const lines: string[] = [];
    lines.push(`*Escala e Checklist — ${template.emoji} ${template.name}*`);
    if (eventName) lines.push(`Evento: ${eventName}`);
    if (clientName) lines.push(`Cliente: ${clientName}`);
    if (eventDate) lines.push(`Data: ${formatDateFullBR(eventDate)}`);
    if (eventTime) lines.push(`Horário: ${eventTime}`);
    if (eventAddress) lines.push(`Local: ${eventAddress}`);
    lines.push(`Convidados: ${guests}`);
    lines.push("");
    lines.push("*Checklist operacional:*");
    items.forEach((i) => lines.push(`• ${i.label}: ${formatQty(i.qty, i.unit)}`));
    return lines.join("\n");
  }, [template, items, eventName, clientName, eventDate, eventTime, eventAddress, guests]);

  const targetPhone = (customPhone || phone || "").trim();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-5 text-primary" />
        <div>
          <div className="text-sm font-bold">Checklist pré-definido</div>
          <div className="text-xs text-muted-foreground">
            Itens recalculados automaticamente para {guests || 0} convidados
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTemplateKey(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              t.key === templateKey
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background hover:bg-muted border-border",
            )}
          >
            <span className="mr-1">{t.emoji}</span>
            {t.name}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between border-b border-dashed border-border/60 py-1">
            <span className="text-slate-700">{i.label}</span>
            <span className="font-mono font-semibold">{formatQty(i.qty, i.unit)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-2 pt-2 border-t border-border">
        <label className="text-xs font-medium text-muted-foreground">
          WhatsApp da equipe (opcional — usa o do cliente se vazio)
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="tel"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            placeholder={phone ? `Padrão: ${phone}` : "(11) 99999-9999"}
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(message);
              if (ok) toast.success("Checklist copiado");
              else toast.error("Falha ao copiar");
            }}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Copy className="size-4" /> Copiar
          </button>
          <a
            href={waLink(targetPhone, message)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!targetPhone) {
                e.preventDefault();
                toast.error("Informe um WhatsApp para envio");
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            <Send className="size-4" /> Enviar no WhatsApp
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground">
          A mensagem contém apenas dados operacionais (nome, local, data, hora e checklist). Nenhum valor financeiro é enviado.
        </p>
      </div>
    </div>
  );
}

import { brl, formatDateFullBR } from "@/lib/format";
import { getLogoDisplayUrl } from "@/lib/logo";

export type PurchaseOrderLine = {
  name: string;
  unit: string;
  category?: string | null;
  physical_qty: number;
  reserved_qty: number;
  available: number;
  min_qty: number;
  target_qty: number;
  suggested_qty: number;
  unit_price: number | null;
  estimated_total: number;
  critical: boolean;
};

export type PurchaseOrderInput = {
  orderNumber?: string | null;
  issuedAt?: Date;
  lines: PurchaseOrderLine[];
  buffet: {
    business_name?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    address?: string | null;
    logo_url?: string | null;
  } | null;
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const num = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(n ?? 0));

export async function openPurchaseOrderPdf(input: PurchaseOrderInput) {
  const logo = await getLogoDisplayUrl(input.buffet?.logo_url ?? "");
  const w = window.open("", "_blank");
  if (!w) throw new Error("Permita pop-ups para gerar o PDF");

  const issued = input.issuedAt ?? new Date();
  const b = input.buffet ?? {};
  const contact = [b.phone, b.whatsapp].filter(Boolean).join(" · ");
  const total = input.lines.reduce((s, l) => s + (Number(l.estimated_total) || 0), 0);
  const withPrice = input.lines.some((l) => l.unit_price != null);

  const rows = input.lines
    .map(
      (l) => `
    <tr>
      <td>
        ${esc(l.name)}
        ${l.category ? `<div class="muted">${esc(l.category)}</div>` : ""}
      </td>
      <td class="num">${esc(num(l.available))} ${esc(l.unit)}</td>
      <td class="num">${esc(num(l.min_qty))}</td>
      <td class="num strong">${esc(num(l.suggested_qty))} ${esc(l.unit)}</td>
      ${withPrice ? `<td class="num">${esc(l.unit_price != null ? brl(l.unit_price) : "—")}</td>` : ""}
      ${withPrice ? `<td class="num">${esc(l.unit_price != null ? brl(l.estimated_total) : "—")}</td>` : ""}
      <td class="num">${l.critical ? `<span class="pill crit">Crítico</span>` : `<span class="pill">Repor</span>`}</td>
    </tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Ordem de compra ${esc(input.orderNumber ?? "")}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 10px; }
  header img { max-height: 54px; max-width: 160px; object-fit: contain; }
  h1 { font-size: 15pt; margin: 0; letter-spacing: -0.3px; }
  .muted { color: #666; font-size: 8.5pt; }
  .meta { text-align: right; font-size: 9pt; color: #444; }
  h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; color: #444; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.6px; color: #555; border-bottom: 1px solid #999; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .strong { font-weight: 700; }
  .pill { display: inline-block; padding: 1px 7px; border: 1px solid #999; border-radius: 999px; font-size: 8pt; }
  .pill.crit { border-color: #b00020; color: #b00020; font-weight: 700; }
  .totals { margin-top: 14px; display: flex; justify-content: flex-end; }
  .totals .box { min-width: 240px; border-top: 2px solid #111; padding-top: 8px; }
  .totals .row { display: flex; justify-content: space-between; font-size: 11pt; font-weight: 700; }
  .notes { margin-top: 18px; font-size: 9pt; color: #444; }
  .sign { margin-top: 34px; display: flex; gap: 40px; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; font-size: 8.5pt; color: #555; text-align: center; }
  .footer { margin-top: 26px; border-top: 1px solid #ddd; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8pt; color: #777; }
</style></head>
<body>
  <header>
    <div>
      ${logo ? `<img id="__logo" src="${esc(logo)}" alt=""/>` : ""}
      <h1>${esc(b.business_name ?? "Buffet")}</h1>
      <div class="muted">${esc(contact)}</div>
      ${b.address ? `<div class="muted">${esc(b.address)}</div>` : ""}
    </div>
    <div class="meta">
      <div class="strong">ORDEM DE COMPRA</div>
      <div>${esc(input.orderNumber ?? "")}</div>
      <div>${esc(formatDateFullBR(issued))}</div>
    </div>
  </header>

  <h2>Insumos a repor para nível operacional</h2>
  <table>
    <thead>
      <tr>
        <th>Insumo</th>
        <th class="num">Disponível</th>
        <th class="num">Mínimo</th>
        <th class="num">Comprar</th>
        ${withPrice ? `<th class="num">Últ. custo</th><th class="num">Estimado</th>` : ""}
        <th class="num">Situação</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="7">Nenhum insumo abaixo do nível operacional.</td></tr>`}
    </tbody>
  </table>

  ${
    withPrice
      ? `<div class="totals"><div class="box"><div class="row"><span>Total estimado</span><span>${esc(brl(total))}</span></div><div class="muted">Baseado no último custo de compra registrado.</div></div></div>`
      : ""
  }

  <div class="notes">
    Quantidade sugerida = nível operacional (2× o estoque mínimo) − disponível (físico − reservado).
    Itens marcados como <strong>Crítico</strong> estão com disponível igual ou abaixo do mínimo.
  </div>

  <div class="sign">
    <div>Solicitante</div>
    <div>Aprovação</div>
  </div>

  <div class="footer">
    <div>${esc(b.business_name ?? "")}</div>
    <div>Documento gerado em ${esc(formatDateFullBR(issued))}</div>
  </div>

<script>
  (function(){
    var img = document.getElementById('__logo');
    var done = false;
    function go(){ if(done) return; done = true; setTimeout(function(){ window.focus(); window.print(); }, 200); }
    if (!img) { go(); return; }
    if (img.complete && img.naturalWidth > 0) { go(); return; }
    img.addEventListener('load', go);
    img.addEventListener('error', function(){ img.style.display='none'; go(); });
    setTimeout(go, 5000);
  })();
</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}

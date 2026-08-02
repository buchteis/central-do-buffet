import { brl, formatDateFullBR } from "@/lib/format";
import { getLogoDisplayUrl } from "@/lib/logo";
import type { QuoteBreakdown, QuoteExtraItem } from "@/lib/quote-calc";

export type QuotePdfInput = {
  quoteNumber?: string | null;
  issuedAt?: Date;
  validUntil?: string | Date | null;
  client: {
    name?: string | null;
    cpf?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  event: {
    date?: string | null;
    time?: string | null;
    address?: string | null;
    type?: string | null;
    adults?: number | null;
    childrenCount?: number | null;
  };
  package: {
    name?: string | null;
    pricePerPerson?: number | null;
  } | null;
  /** Lista de pacotes escolhidos (nome + valor por pessoa da faixa aplicada). */
  packages?: { name?: string | null; price_per_person?: number | null }[];
  childPrice?: number | null;
  extras?: QuoteExtraItem[];
  unitItems?: { name: string; unit?: string | null; unit_price: number; qty: number }[];
  breakdown: QuoteBreakdown;
  paymentMethod?: string | null;
  notes?: string | null;
  hasGrill?: boolean;
  hasFreezer?: boolean;
  buffet: {
    business_name?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    cnpj?: string | null;
    logo_url?: string | null;
    pix_key?: string | null;
    pix_holder?: string | null;
    bank_name?: string | null;
    bank_agency?: string | null;
    bank_account?: string | null;
    bank_holder?: string | null;
  } | null;
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function dash(v: unknown): string {
  const s = String(v ?? "").trim();
  return s === "" ? "—" : s;
}

function paymentDetails(method: string, b: QuotePdfInput["buffet"]): string {
  if (!b) return "";
  if (method === "PIX") {
    const key = (b.pix_key ?? "").trim();
    if (!key) return "";
    const holder = (b.pix_holder ?? "").trim();
    return holder ? `Chave PIX: ${key} (titular: ${holder})` : `Chave PIX: ${key}`;
  }
  if (method === "Dados Bancários") {
    const parts = [
      b.bank_name && `Banco: ${b.bank_name}`,
      b.bank_agency && `Agência: ${b.bank_agency}`,
      b.bank_account && `Conta: ${b.bank_account}`,
      b.bank_holder && `Titular: ${b.bank_holder}`,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  return "";
}

export async function openQuotePdf(input: QuotePdfInput) {
  const logo = await getLogoDisplayUrl(input.buffet?.logo_url ?? "");
  const w = window.open("", "_blank");
  if (!w) throw new Error("Permita pop-ups para gerar o PDF");

  const issued = input.issuedAt ?? new Date();
  const b = input.buffet ?? {};
  const c = input.client ?? {};
  const ev = input.event;
  const pkg = input.package;
  const bk = input.breakdown;

  const guests = (ev.adults ?? 0) + (ev.childrenCount ?? 0);
  const buffetContact = [b.phone, b.whatsapp, b.email].filter(Boolean).join(" · ");

  const packageRowUnit = pkg?.pricePerPerson != null ? `${brl(pkg.pricePerPerson)}/pessoa` : "—";
  const packageRowQty = ev.adults ? `${ev.adults} adulto(s)` : "—";
  const adults = Number(ev.adults ?? 0) || 0;

  const rows: string[] = [];
  const pkgList = (input.packages ?? []).filter((p) => (p?.name ?? "").toString().trim() !== "");
  if (pkgList.length > 0) {
    // Uma linha por pacote escolhido, com o valor por pessoa da faixa aplicada.
    for (const p of pkgList) {
      const ppp = Number(p.price_per_person ?? 0) || 0;
      rows.push(`
    <tr>
      <td>${esc(p.name ?? "Pacote")}<div class="muted">Serviço de buffet</div></td>
      <td class="num">${esc(packageRowQty)}</td>
      <td class="num">${esc(ppp ? `${brl(ppp)}/pessoa` : "—")}</td>
      <td class="num">${esc(brl(ppp * adults))}</td>
    </tr>`);
    }
  } else {
    rows.push(`
    <tr>
      <td>${esc(pkg?.name ?? "Pacote")}<div class="muted">Serviço de buffet</div></td>
      <td class="num">${esc(packageRowQty)}</td>
      <td class="num">${esc(packageRowUnit)}</td>
      <td class="num">${esc(brl(bk.adultsSubtotal))}</td>
    </tr>`);
  }

  if ((ev.childrenCount ?? 0) > 0) {
    rows.push(`
      <tr>
        <td>Crianças<div class="muted">Valor por criança</div></td>
        <td class="num">${esc(ev.childrenCount)} criança(s)</td>
        <td class="num">${esc(brl(input.childPrice ?? 0))}</td>
        <td class="num">${esc(brl(bk.childrenSubtotal))}</td>
      </tr>`);
  }

  for (const u of input.unitItems ?? []) {
    const qty = Number(u?.qty) || 0;
    if (qty <= 0) continue;
    const price = Number(u.unit_price) || 0;
    rows.push(`
      <tr>
        <td>${esc(u.name || "Item unitário")}<div class="muted">Item unitário</div></td>
        <td class="num">${esc(qty)} ${esc(u.unit ?? "un")}</td>
        <td class="num">${esc(brl(price))}</td>
        <td class="num">${esc(brl(qty * price))}</td>
      </tr>`);
  }

  for (const x of input.extras ?? []) {
    if (!x || ((Number(x.value) || 0) === 0 && !(x.description ?? "").trim())) continue;
    rows.push(`
      <tr>
        <td>${esc(x.description || "Acréscimo")}</td>
        <td class="num">—</td>
        <td class="num">—</td>
        <td class="num">${esc(brl(Number(x.value) || 0))}</td>
      </tr>`);
  }

  const extrasTotal = bk.extras;
  const method = (input.paymentMethod ?? "").trim();
  const payDetail = method ? paymentDetails(method, b) : "";

  const inclusions: string[] = [];
  if (input.hasGrill) inclusions.push("Churrasqueira incluída");
  if (input.hasFreezer) inclusions.push("Freezer incluído");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Orçamento ${esc(input.quoteNumber ?? "")}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding: 4px 4px 18px; border-bottom: 2px solid #111; margin-bottom: 8px; }
  .brand { display: flex; align-items: center; gap: 14px; padding-left: 2px; }
  .brand img { max-height: 68px; max-width: 200px; object-fit: contain; }
  .brand .name { font-size: 15pt; font-weight: 800; letter-spacing: .2px; }
  .brand .contact { font-size: 8.5pt; color: #555; margin-top: 2px; white-space: pre-line; }
  .doc-meta { text-align: right; font-size: 9pt; padding-right: 2px; }
  .doc-meta .title { font-size: 12pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #111; }
  .doc-meta .num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-top: 4px; font-size: 10pt; }
  .doc-meta .muted { color: #666; margin-top: 2px; }
  section { margin-top: 20px; margin-bottom: 18px; padding: 0 2px; }
  h2 { display: block; font-size: 9pt; text-transform: uppercase; letter-spacing: 1.4px; color: #444; margin: 0 0 12px; font-weight: 700; background: #f2f2f2; padding: 10px 14px; border-radius: 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; padding: 4px 12px 0; }
  .grid .row { display: flex; gap: 8px; font-size: 10pt; padding: 2px 0; }
  .grid .row .k { color: #666; min-width: 100px; }
  .grid .row .v { color: #111; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 0; }
  th, td { padding: 10px 14px; border-bottom: 1px solid #e5e5e5; text-align: left; vertical-align: top; font-size: 10pt; }
  th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px; color: #666; background: #fafafa; border-bottom: 1px solid #ddd; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td .muted { color: #777; font-size: 9pt; margin-top: 2px; }
  .totals { margin: 14px 12px 0 auto; width: 55%; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 10pt; }
  .totals .row.total { border-top: 2px solid #111; margin-top: 8px; padding-top: 10px; font-weight: 800; font-size: 12pt; }
  .totals .row.sub { color: #444; }
  .pill { display: inline-block; padding: 4px 10px; border: 1px solid #111; border-radius: 999px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; margin-left: 12px; }
  .pay-detail { margin-top: 10px; padding: 0 12px; font-size: 10pt; }
  .notes { white-space: pre-wrap; background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 12px 16px; font-size: 10pt; margin: 0 4px; }
  .footer { margin-top: 26px; padding: 12px 4px 0; border-top: 1px solid #ddd; color: #666; font-size: 8.5pt; display: flex; justify-content: space-between; }
  .tags { margin-top: 10px; padding: 0 12px; display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { font-size: 8.5pt; padding: 3px 10px; background: #f2f2f2; border-radius: 999px; color: #333; }

</style></head><body>
  <div class="header">
    <div class="brand">
      ${logo ? `<img id="__logo" src="${esc(logo)}" alt="Logomarca"/>` : ""}
      <div>
        <div class="name">${esc(b.business_name ?? "Buffet")}</div>
        <div class="contact">${esc(
          [b.address, buffetContact, b.cnpj ? `CNPJ: ${b.cnpj}` : ""].filter(Boolean).join("\n"),
        )}</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="title">Orçamento</div>
      ${input.quoteNumber ? `<div class="num">Nº ${esc(input.quoteNumber)}</div>` : ""}
      <div class="muted">Emitido em ${esc(formatDateFullBR(issued))}</div>
      ${input.validUntil ? `<div class="muted">Válido até ${esc(formatDateFullBR(input.validUntil))}</div>` : ""}
    </div>
  </div>

  <section>
    <h2>Cliente</h2>
    <div class="grid">
      <div class="row"><span class="k">Nome</span><span class="v">${esc(dash(c.name))}</span></div>
      <div class="row"><span class="k">CPF</span><span class="v">${esc(dash(c.cpf))}</span></div>
      <div class="row"><span class="k">Telefone</span><span class="v">${esc(dash(c.phone))}</span></div>
      <div class="row"><span class="k">E-mail</span><span class="v">${esc(dash(c.email))}</span></div>
      <div class="row" style="grid-column: 1 / -1"><span class="k">Endereço</span><span class="v">${esc(dash(c.address))}</span></div>
    </div>
  </section>

  <section>
    <h2>Evento</h2>
    <div class="grid">
      <div class="row"><span class="k">Data</span><span class="v">${esc(ev.date ? formatDateFullBR(ev.date) : "—")}</span></div>
      <div class="row"><span class="k">Horário</span><span class="v">${esc(dash(ev.time))}</span></div>
      <div class="row"><span class="k">Tipo</span><span class="v">${esc(dash(ev.type))}</span></div>
      <div class="row"><span class="k">Convidados</span><span class="v">${esc(guests || "—")}</span></div>
      <div class="row" style="grid-column: 1 / -1"><span class="k">Local</span><span class="v">${esc(dash(ev.address))}</span></div>
    </div>
    ${
      inclusions.length
        ? `<div class="tags">${inclusions.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`
        : ""
    }
  </section>

  <section>
    <h2>Itens do orçamento</h2>
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="num">Quantidade</th>
          <th class="num">Valor unitário</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="row sub"><span>Subtotal</span><span>${esc(brl(bk.subtotal))}</span></div>
      ${bk.unitItemsSubtotal > 0 ? `<div class="row sub"><span>Itens unitários</span><span>${esc(brl(bk.unitItemsSubtotal))}</span></div>` : ""}
      ${extrasTotal > 0 ? `<div class="row sub"><span>Acréscimos</span><span>${esc(brl(extrasTotal))}</span></div>` : ""}
      <div class="row total"><span>Total</span><span>${esc(brl(bk.total))}</span></div>
      <div class="row sub"><span>Entrada (50%)</span><span>${esc(brl(bk.entry))}</span></div>
      <div class="row sub"><span>Saldo</span><span>${esc(brl(bk.balance))}</span></div>
    </div>
  </section>

  ${
    method
      ? `<section>
    <h2>Pagamento</h2>
    <div style="padding: 0 12px;"><span class="pill">${esc(method)}</span></div>
    ${payDetail ? `<div class="pay-detail">${esc(payDetail)}</div>` : ""}

  </section>`
      : ""
  }

  ${
    (input.notes ?? "").trim()
      ? `<section><h2>Observações</h2><div class="notes">${esc(input.notes)}</div></section>`
      : ""
  }

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

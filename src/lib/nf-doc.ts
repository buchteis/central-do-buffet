// Geração local de documentos da NF (usada quando o provedor fiscal não devolve PDF/XML).
import { brl, formatDateBR } from "@/lib/format";

export type InvoiceDoc = {
  number?: string | null;
  series?: string | null;
  description: string;
  amount: number;
  service_date?: string | null;
  payment_method?: string | null;
  recipient_name?: string | null;
  recipient_doc?: string | null;
  recipient_email?: string | null;
  status: string;
  environment?: string | null;
  issued_at?: string | null;
  issuer?: {
    razao_social?: string | null;
    cnpj?: string | null;
    inscricao_municipal?: string | null;
    codigo_servico?: string | null;
    aliquota_iss?: number | null;
    address?: string | null;
  } | null;
};

export function openInvoicePdf(inv: InvoiceDoc) {
  const iss = inv.issuer ?? {};
  const rows = (label: string, value: string) =>
    `<tr><td class="l">${label}</td><td class="v">${escapeHtml(value || "—")}</td></tr>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>NFS-e ${escapeHtml(inv.number ?? "")}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: ui-sans-serif, system-ui, Arial, sans-serif; color:#111; }
  h1 { font-size: 18px; margin:0 0 2px; }
  .sub { font-size: 11px; color:#666; margin-bottom:18px; }
  .box { border:1px solid #ddd; border-radius:10px; padding:14px; margin-bottom:14px; }
  .box h2 { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#666; margin:0 0 8px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  td { padding:4px 0; vertical-align:top; }
  td.l { width:38%; color:#666; }
  td.v { font-weight:600; }
  .total { font-size:22px; font-weight:800; }
  .tag { display:inline-block; font-size:10px; text-transform:uppercase; letter-spacing:.08em;
         border:1px solid #999; border-radius:999px; padding:2px 8px; }
</style></head><body>
<h1>Nota Fiscal de Serviço Eletrônica</h1>
<div class="sub">Nº ${escapeHtml(inv.number ?? "—")}${inv.series ? ` / série ${escapeHtml(inv.series)}` : ""} ·
  <span class="tag">${escapeHtml(inv.status)}</span>
  ${inv.environment && inv.environment !== "producao" ? ' <span class="tag">homologação</span>' : ""}
</div>
<div class="box"><h2>Prestador</h2><table>
${rows("Razão social", iss.razao_social ?? "")}
${rows("CNPJ", iss.cnpj ?? "")}
${rows("Inscrição municipal", iss.inscricao_municipal ?? "")}
${rows("Endereço", iss.address ?? "")}
${rows("Código de serviço", iss.codigo_servico ?? "")}
${rows("Alíquota ISS", iss.aliquota_iss != null ? `${iss.aliquota_iss}%` : "")}
</table></div>
<div class="box"><h2>Tomador</h2><table>
${rows("Nome", inv.recipient_name ?? "")}
${rows("CPF/CNPJ", inv.recipient_doc ?? "")}
${rows("E-mail", inv.recipient_email ?? "")}
</table></div>
<div class="box"><h2>Serviço</h2><table>
${rows("Descrição", inv.description)}
${rows("Data do serviço", inv.service_date ? formatDateBR(inv.service_date) : "")}
${rows("Forma de pagamento", inv.payment_method ?? "")}
</table>
<div style="margin-top:14px" class="total">${brl(inv.amount)}</div>
</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return true;
}

export function downloadInvoiceXml(inv: InvoiceDoc) {
  const iss = inv.issuer ?? {};
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe>
  <Numero>${escapeXml(inv.number ?? "")}</Numero>
  <Serie>${escapeXml(inv.series ?? "")}</Serie>
  <Status>${escapeXml(inv.status)}</Status>
  <Ambiente>${escapeXml(inv.environment ?? "homologacao")}</Ambiente>
  <DataEmissao>${escapeXml(inv.issued_at ?? "")}</DataEmissao>
  <Prestador>
    <RazaoSocial>${escapeXml(iss.razao_social ?? "")}</RazaoSocial>
    <Cnpj>${escapeXml(iss.cnpj ?? "")}</Cnpj>
    <InscricaoMunicipal>${escapeXml(iss.inscricao_municipal ?? "")}</InscricaoMunicipal>
    <CodigoServico>${escapeXml(iss.codigo_servico ?? "")}</CodigoServico>
    <AliquotaIss>${escapeXml(String(iss.aliquota_iss ?? 0))}</AliquotaIss>
  </Prestador>
  <Tomador>
    <Nome>${escapeXml(inv.recipient_name ?? "")}</Nome>
    <Documento>${escapeXml(inv.recipient_doc ?? "")}</Documento>
    <Email>${escapeXml(inv.recipient_email ?? "")}</Email>
  </Tomador>
  <Servico>
    <Discriminacao>${escapeXml(inv.description)}</Discriminacao>
    <DataServico>${escapeXml(inv.service_date ?? "")}</DataServico>
    <FormaPagamento>${escapeXml(inv.payment_method ?? "")}</FormaPagamento>
    <ValorServicos>${inv.amount.toFixed(2)}</ValorServicos>
  </Servico>
</NFSe>`;
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nfse-${inv.number ?? "documento"}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(v: string) {
  return v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
function escapeXml(v: string) {
  return escapeHtml(v).replace(/'/g, "&apos;");
}

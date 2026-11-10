import { documentCodes } from "./documentCodes";
import type { Fatura, ConfigSistema } from "../types";
export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(
    Number(n) || 0,
  );
const esc = (v: any) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function render(
  f: Fatura,
  c: ConfigSistema,
  format: string,
  notice: string,
) {
  const x = f as any;
  const draft = f.estado === "rascunho" || f.tipoDocumento === "pro-forma",
    training = x.ambiente === "homologacao";
  const displayAmount = (n: number) =>
    formatCurrency(f.tipoDocumento === "nota-credito" ? Math.abs(n) : n);
  const printedDate = (date: string) => String(date || "").replace(/\//g, "-");
  const width = format === "a4" ? "210mm" : format === "58mm" ? "58mm" : "80mm";
  const code: Record<string, string> = {
    factura: "FACTURA",
    "factura-recibo": "FACTURA-RECIBO",
    "factura-global": "FACTURA GLOBAL",
    "nota-credito": "NOTA DE CRÉDITO",
    recibo: "RECIBO",
    "pro-forma": "PRÓ-FORMA",
  };
  const identifiers = documentCodes(f);
  const states: Record<string, string> = {
    nao_preparado: "Por preparar para homologação",
    preparado: "Preparado; não enviado",
    a_enviar: "Envio em curso; sem confirmação",
    envio_incerto: "Envio sem confirmação",
    recebido: "Recebido pela AGT; validação pendente",
    processando: "Em processamento pela AGT",
    validado: "Validado no ambiente de homologação",
    parcial: "Resposta parcial; consultar o pedido",
    rejeitado: "Rejeitado em homologação",
    substituida: "Substituída em homologação",
    cancelado: "Pedido cancelado",
    formacao_local: "Ensaio local; sem submissão fiscal",
  };
  const agtLabel =
    states[x.agtStatus] ||
    (x.agtMode === "homologacao_oficial"
      ? "Estado AGT não consultado nesta impressão"
      : "Ensaio local; sem submissão fiscal");
  const shortHash =
    typeof x.fiscalSaft?.hash === "string" && x.fiscalSaft.hash.length === 172
      ? [0, 10, 20, 30].map((i) => x.fiscalSaft.hash[i]).join("")
      : "";
  const exemptionLines = f.linhas
    .filter((l) => l.ivaIsento)
    .map((l) => x.agtProfile?.taxRules?.[l.codigo || ""]?.exemptionReason)
    .filter(Boolean);

  const receipt = f.tipoDocumento === "recibo";
  const itemsTable = receipt
    ? `<table><thead><tr><th>Documento regularizado</th><th>Montante recebido</th></tr></thead><tbody><tr><td>${esc(f.documentoOrigem || "Origem não indicada no arquivo")}</td><td>${esc(displayAmount(f.total))}</td></tr></tbody></table>`
    : ` <table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Preço</th><th>IVA</th><th>Base</th></tr></thead><tbody>
 ${f.linhas.map((l) => `<tr><td>${esc(l.codigo)} ${esc(l.descricao)}${l.lote ? "<br>Lote: " + esc(l.lote) : ""}</td><td>${esc(f.tipoDocumento === "nota-credito" ? Math.abs(l.quantidade) : l.quantidade)} ${esc(l.unidade)}</td><td>${esc(displayAmount(l.precoUnitario))}</td><td>${l.ivaIsento ? "Isento" : esc(f.ivaTaxa) + "%"}</td><td>${esc(displayAmount(l.baseLiquida ?? l.quantidade * l.precoUnitario * (1 - (f.desconto || 0) / 100)))}</td></tr>`).join("")}
 </tbody></table>`;
  const receiptAmounts = x.fiscalReceipt;
  const totalsMarkup =
    '<div class="totals">' +
    (!receipt
      ? "Desconto: " +
        esc(f.desconto || 0) +
        "%" +
        (f.descontoValor ? " + " + esc(displayAmount(f.descontoValor)) : "") +
        "<br>"
      : "") +
    (receipt && !receiptAmounts
      ? "Repartição fiscal não indicada no arquivo.<br>"
      : "Base: " +
        esc(
          displayAmount(receipt ? receiptAmounts.netTotal : f.subtotalSemIva),
        ) +
        "<br>IVA: " +
        esc(displayAmount(receipt ? receiptAmounts.taxPayable : f.totalIva)) +
        "<br>") +
    "<strong>" +
    (receipt ? "Valor recebido: " : "Total: ") +
    esc(displayAmount(f.total)) +
    "</strong></div>";

  const body = (
    copy: string,
  ) => `<section class="document"><header><h1>${esc(c.nomeClinica)}</h1><p>NIF: ${esc(c.nif || (training ? "Não configurado — documento de formação" : "Não indicado no arquivo"))}<br>${esc(c.endereco)}<br>${esc([c.telefone, c.email].filter(Boolean).join(" · "))}</p></header>
 <strong class="copy">${esc(draft ? (x.proformaFinalizada ? "PRÓ-FORMA — NÃO É FACTURA" : "RASCUNHO / PRÓ-FORMA — NÃO É FACTURA") : copy)}</strong>
 ${training || draft ? '<div class="training">' + (training ? "ENSAIO / HOMOLOGAÇÃO — SEM VALIDADE FISCAL" : "DOCUMENTO NÃO FISCAL") + "</div>" : ""}
 ${!x.managed ? "<p>Documento do arquivo anterior. Dados conservados conforme o registo original.</p>" : ""}
 <h2>${esc(code[f.tipoDocumento])} ${esc(f.numero)}</h2>
 ${f.agtReplacementNo ? "<p><b>Substituída por: " + esc(f.agtReplacementNo) + "</b></p>" : ""}
 ${f.agtCorrection ? "<p><b>Corrige a factura rejeitada: " + esc(f.agtCorrection.documentNo) + "</b></p>" : ""}
 <p>Emissão: ${esc(printedDate(f.data))} ${esc(f.horaOperacao)} · Operador: ${esc(f.emitidoPor)}<br>Vencimento: ${esc(printedDate(f.dataVencimento))} · Moeda: AOA</p>
 <p><b>Adquirente:</b> ${esc(f.clienteNome)}<br>NIF: ${esc(f.clienteNif || (training ? "Consumidor final" : "Não indicado"))}<br>${esc(f.clienteEndereco)}</p>
 ${itemsTable}${totalsMarkup}
 ${!receipt && (f.linhas.some((l) => l.ivaIsento) || f.ivaTaxa === 0) ? "<p>Não liquidação do IVA: " + esc(Array.from(new Set(exemptionLines)).join("; ") || x.motivoIsencao || (training ? "Ensaio — enquadramento fiscal por validar" : "Motivo não registado no arquivo anterior")) + "</p>" : ""}
 ${f.documentoOrigem ? "<p>Documento de origem: " + esc(f.documentoOrigem) + "</p>" : ""}
 ${f.motivoAnulacaoOuCredito ? "<p>Rectificação / anulação: " + esc(f.motivoAnulacaoOuCredito) + "</p>" : ""}
 <p>Estado: ${esc(f.estado)} · Pagamento: ${esc(f.formaPagamento || "Não recebido")}${(f.formasPagamentoDetalhe || []).map((p) => "<br>" + esc(p.forma) + ": " + esc(displayAmount(p.valor)) + (p.referencia ? " · Ref. " + esc(p.referencia) : "")).join("")}</p>
 <p>Data/hora da operação: ${esc(x.dataOperacao || "Não registada")} · Local: ${esc(x.localOperacao || "Não registado")}</p>
 <p class="observations">${esc(f.observacoes)}</p>${identifiers}<footer>${esc(c.mensagemRodape || "")}<br>NVUALASOFT · ${esc(c.configuracaoFiscal?.softwareVersao || "")}<br>
 ${training ? esc(agtLabel) + ". Sem validade fiscal; não comprova certificação do programa." + (x.agtRequestId ? " · Pedido AGT: " + esc(x.agtRequestId) : "") : "Identificação fiscal conforme o arquivo do documento."}
 ${shortHash ? "<br>Assinatura SAF-T de ensaio: " + esc(shortHash) + " · Chave v" + esc(x.fiscalSaft.keyVersion) + " · " + esc(x.softwareHml?.productId || "NVUALASOFT") + " " + esc(x.softwareHml?.productVersion || "") : ""}
 ${x.managed && f.codigoHash ? "<br>Integridade interna SHA-256 (não é assinatura fiscal AGT): " + esc(f.codigoHash) : ""}
 <br>Conserve este documento com os respectivos suportes.</footer></section>`;
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${esc(f.numero)}</title><style>
 @page{size:${format === "a4" ? "A4" : width + " auto"};margin:${format === "a4" ? "12mm" : "2mm"}}*{box-sizing:border-box}body{font: ${format === "a4" ? "12px" : "10px"} Arial,sans-serif;color:#111;margin:0}section{max-width:${format === "a4" ? "186mm" : format === "58mm" ? "54mm" : "76mm"};margin:auto;padding:4mm 0;overflow-wrap:anywhere;break-after:page}section:last-child{break-after:auto}h1{font-size:18px;margin:0}h2{font-size:14px}p{line-height:1.5}header{border-bottom:2px solid #111}table{width:100%;border-collapse:collapse;font-size:inherit}th,td{border-bottom:1px solid #ddd;padding:5px 2px;text-align:right}th:first-child,td:first-child{text-align:left;width:40%}tr{break-inside:avoid}thead{display:table-header-group}.totals{text-align:right;padding:12px 0;line-height:1.7}.copy{display:block;text-align:center;margin:10px 0}.training{border:2px solid #111;padding:8px;text-align:center;font-weight:bold}.observations{white-space:pre-wrap}.document-identifiers{display:flex;align-items:center;justify-content:center;gap:4mm;margin:3mm 0;break-inside:avoid;page-break-inside:avoid}.document-qr{display:block;width:25mm;height:25mm}.document-barcode{display:block;width:45mm;height:13mm;max-width:100%}.document-reference{text-align:center;font-family:monospace;font-size:10px;margin-top:2px}.document-identifiers small{font-size:8px;line-height:1.2;display:block;text-align:center}footer{margin-top:12px;border-top:1px solid #777;font-size:9px;line-height:1.6}${format === "a4" ? "" : ".document-identifiers{gap:2mm;flex-wrap:wrap}.document-qr{width:22mm;height:22mm}.document-barcode{width:42mm;height:12mm}"}</style></head><body>
 ${body(notice)}${!draft && notice === "ORIGINAL" ? body("CÓPIA — ARQUIVO DO FORNECEDOR") + body("CÓPIA — CIRCULAÇÃO, QUANDO APLICÁVEL") : ""}
 </body></html>`;
}

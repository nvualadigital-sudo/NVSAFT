import { Fatura, Config, formatCurrency } from "../store/storage";

// ── Número por extenso (Angola Portuguese) ─────────────────────────────────
const unidades = [
  "",
  "Um",
  "Dois",
  "Três",
  "Quatro",
  "Cinco",
  "Seis",
  "Sete",
  "Oito",
  "Nove",
  "Dez",
  "Onze",
  "Doze",
  "Treze",
  "Catorze",
  "Quinze",
  "Dezasseis",
  "Dezassete",
  "Dezoito",
  "Dezanove",
];
const dezenas = [
  "",
  "",
  "Vinte",
  "Trinta",
  "Quarenta",
  "Cinquenta",
  "Sessenta",
  "Setenta",
  "Oitenta",
  "Noventa",
];
const centenas = [
  "",
  "Cem",
  "Duzentos",
  "Trezentos",
  "Quatrocentos",
  "Quinhentos",
  "Seiscentos",
  "Setecentos",
  "Oitocentos",
  "Novecentos",
];

function menorQueMil(n: number): string {
  if (n === 0) return "";
  if (n < 20) return unidades[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return dezenas[d] + (u ? " e " + unidades[u] : "");
  }
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (n === 100) return "Cem";
  return centenas[c] + (resto ? " e " + menorQueMil(resto) : "");
}

function valorPorExtenso(valor: number): string {
  if (valor === 0) return "Zero Kwanzas";
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  let resultado = "";
  const milh = Math.floor(inteiro / 1_000_000);
  const mil = Math.floor((inteiro % 1_000_000) / 1000);
  const cent = inteiro % 1000;
  if (milh)
    resultado +=
      menorQueMil(milh) + (milh === 1 ? " Milhão" : " Milhões") + " ";
  if (mil) resultado += menorQueMil(mil) + " Mil ";
  if (cent) resultado += menorQueMil(cent) + " ";
  resultado = resultado.trim() + (inteiro === 1 ? " Kwanza" : " Kwanzas");
  if (centavos)
    resultado +=
      " e " +
      menorQueMil(centavos) +
      (centavos === 1 ? " Cêntimo" : " Cêntimos");
  return resultado.trim();
}

// ── SHA-256 via Web Crypto API ───────────────────────────────────────────────
async function sha256hex(text: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  } catch {
    // Fallback sincrónico simples se crypto.subtle não estiver disponível
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(64, "0");
  }
}

// Gera hash SHA-256 dos campos chave da fatura (sincronamente usa fallback, assíncrono usa real)
export function gerarHashFatura(fatura: Fatura, nifEmitente: string): string {
  const seed = [
    fatura.numero,
    fatura.data,
    fatura.horaOperacao || "00:00:00",
    fatura.total.toFixed(2),
    fatura.clienteNif || "CF",
    nifEmitente,
    fatura.serie,
  ].join("|");
  // Fallback síncrono (hash djb2 estilo, 64 chars hex)
  let h1 = 5381,
    h2 = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x9e3779b9) >>> 0;
    h2 = (Math.imul(h2 ^ c, 0x01000193) ^ (c << 13)) >>> 0;
  }
  const part1 = h1.toString(16).toUpperCase().padStart(8, "0");
  const part2 = h2.toString(16).toUpperCase().padStart(8, "0");
  const part3 = (h1 ^ h2).toString(16).toUpperCase().padStart(8, "0");
  const part4 = (Math.imul(h1, 0x1b873593) >>> 0)
    .toString(16)
    .toUpperCase()
    .padStart(8, "0");
  return `${part1}-${part2}-${part3}-${part4}-${fatura.serie}`;
}

// Versão assíncrona real com SHA-256 para armazenar na BD
export async function gerarHashFaturaAsync(
  fatura: Fatura,
  nifEmitente: string,
): Promise<string> {
  const seed = [
    fatura.numero,
    fatura.data,
    fatura.horaOperacao || "00:00:00",
    fatura.total.toFixed(2),
    fatura.clienteNif || "CF",
    nifEmitente,
    fatura.serie,
  ].join("|");
  const full = await sha256hex(seed);
  return `${full.slice(0, 8)}-${full.slice(8, 16)}-${full.slice(16, 24)}-${full.slice(24, 32)}-${fatura.serie}`;
}

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTipoDocumento(fatura: Fatura): string {
  const tipo = fatura.tipoDocumento;
  if (tipo === "nota-credito") return "NOTA DE CRÉDITO";
  if (tipo === "pro-forma") return "PRÓ-FORMA";
  if (tipo === "factura-global") return "FACTURA GLOBAL";
  if (tipo === "recibo") return "RECIBO";
  if (fatura.estado === "anulada") return "NOTA DE ANULAÇÃO";
  return "FACTURA";
}

export function generateFaturaHTML(
  fatura: Fatura,
  config: Config,
  opcoes?: { segundaVia?: boolean },
): string {
  config = fatura.emitenteSnapshot || config;
  const moeda = config.moeda || "AOA";
  const codigoHash =
    fatura.codigoHash || gerarHashFatura(fatura, config.nif || "");
  const tipoDoc = getTipoDocumento(fatura);
  const clienteNif = fatura.clienteNif?.trim() || "CONSUMIDOR FINAL";
  const emissaoContagem = fatura.emissaoContagem ?? 1;
  const isSegundaVia = opcoes?.segundaVia === true || emissaoContagem > 1;
  const mencaoVia = isSegundaVia ? "2.ª VIA" : "ORIGINAL";

  const logoHTML = config.logoData
    ? `<img src="${esc(config.logoData)}" style="max-height:65px;max-width:140px;object-fit:contain;" />`
    : "";

  const agora = new Date();
  const horaOperacao =
    fatura.horaOperacao ||
    `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}:${String(agora.getSeconds()).padStart(2, "0")}`;

  // Lines
  const linhasHTML = fatura.linhas
    .map((l, i) => {
      const subtotal = l.quantidade * l.precoUnitario;
      const ivaTaxa = l.ivaIsento ? 0 : fatura.ivaTaxa;
      const ivaValor = subtotal * (ivaTaxa / 100);
      const bg = i % 2 === 0 ? "#fff" : "#f7f7f7";
      return `
    <tr style="background:${bg};">
      <td style="padding:5px 8px;font-size:10.5px;border-bottom:0.5px solid #ddd;">${esc(l.descricao)}</td>
      <td style="padding:5px 8px;font-size:10.5px;text-align:center;border-bottom:0.5px solid #ddd;">${l.quantidade}</td>
      <td style="padding:5px 8px;font-size:10.5px;text-align:right;border-bottom:0.5px solid #ddd;white-space:nowrap;">${formatCurrency(l.precoUnitario, moeda)}</td>
      <td style="padding:5px 8px;font-size:10.5px;text-align:right;border-bottom:0.5px solid #ddd;white-space:nowrap;">${formatCurrency(subtotal, moeda)}</td>
      <td style="padding:5px 8px;font-size:10.5px;text-align:center;border-bottom:0.5px solid #ddd;">${l.ivaIsento ? "Isento" : ivaTaxa + "%"}</td>
      <td style="padding:5px 8px;font-size:10.5px;text-align:right;border-bottom:0.5px solid #ddd;font-weight:bold;white-space:nowrap;">${formatCurrency(subtotal + ivaValor, moeda)}</td>
    </tr>`;
    })
    .join("");

  // IVA breakdown
  const ivaGroups: Record<string, { base: number; iva: number }> = {};
  for (const l of fatura.linhas) {
    const taxa = l.ivaIsento ? 0 : fatura.ivaTaxa;
    const key = taxa === 0 ? "Isento" : `${taxa}%`;
    const sub = l.quantidade * l.precoUnitario;
    if (!ivaGroups[key]) ivaGroups[key] = { base: 0, iva: 0 };
    ivaGroups[key].base += sub;
    ivaGroups[key].iva += sub * (taxa / 100);
  }

  const ivaDetalheHTML = Object.entries(ivaGroups)
    .map(
      ([taxa, vals]) => `
    <tr>
      <td style="padding:3px 8px;font-size:9.5px;color:#555;">Base trib. IVA ${taxa}:</td>
      <td style="padding:3px 8px;font-size:9.5px;text-align:right;">${formatCurrency(vals.base, moeda)}</td>
    </tr>
    <tr>
      <td style="padding:3px 8px;font-size:9.5px;color:#555;">IVA ${taxa}:</td>
      <td style="padding:3px 8px;font-size:9.5px;text-align:right;">${formatCurrency(vals.iva, moeda)}</td>
    </tr>`,
    )
    .join("");

  const notaCreditoMotivoHTML = fatura.notaCreditoMotivo
    ? `<div style="background:#fff8ed;border:1px solid #f59e0b;border-radius:4px;padding:6px 10px;margin-bottom:10px;font-size:9.5px;">
        <strong>Motivo da Nota de Crédito:</strong> ${esc(fatura.notaCreditoMotivo)}
       </div>`
    : "";

  const facturaPremiadeHTML = fatura.facturaPremiada
    ? `<div style="background:#fef3c7;border:1px solid #d97706;border-radius:4px;padding:5px 10px;margin-bottom:10px;font-size:9px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;">🏆</span>
        <div><strong>FACTURA PREMIADA</strong> — Adesão a programas fiscais depende de validação externa.<br/>
        <span style="color:#92400e;">Não constitui confirmação de elegibilidade fiscal.</span></div>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${tipoDoc} ${fatura.numero}</title>
  <style>
    @page { size: A4; margin: 1.4cm 1.6cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div style="width:100%;">

  <!-- ═══ VIA E TIPO ═══════════════════════════════════════════════════════ -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
    <div style="font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;
      border:1.5px solid ${isSegundaVia ? "#aaa" : "#111"};padding:2px 8px;
      color:${isSegundaVia ? "#666" : "#111"};">${mencaoVia}</div>
  </div>

  <!-- ═══ CABEÇALHO ═══════════════════════════════════════════════════════ -->
  <table style="width:100%;margin-bottom:12px;border-bottom:2px solid #111;padding-bottom:10px;">
    <tr>
      <td style="vertical-align:middle;width:55%;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logoHTML}
          <div>
            <div style="font-size:16px;font-weight:bold;">${esc(config.nomeClinica)}</div>
            <div style="font-size:9px;color:#555;margin-top:2px;">
              NIF: <strong>${esc(config.nif || "—")}</strong>
              ${config.endereco ? `&nbsp;|&nbsp; ${esc(config.endereco)}` : ""}
            </div>
            <div style="font-size:9px;color:#555;">
              ${config.telefone ? "Tel: " + esc(config.telefone) : ""}
              ${config.email ? `&nbsp;|&nbsp; ${esc(config.email)}` : ""}
            </div>
          </div>
        </div>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <div style="font-size:28px;font-weight:900;letter-spacing:2px;line-height:1;">${esc(tipoDoc)}</div>
        <div style="font-size:15px;font-weight:bold;margin-top:4px;letter-spacing:1px;">${esc(fatura.numero)}</div>
        <div style="margin-top:6px;font-size:9px;color:#555;line-height:1.7;">
          Emissão: <strong>${esc(fatura.data)}</strong> às <strong>${esc(horaOperacao)}</strong><br/>
          Vencimento: <strong>${esc(fatura.dataVencimento)}</strong><br/>
          Série: <strong>${esc(fatura.serie)}</strong>
        </div>
      </td>
    </tr>
  </table>

  ${facturaPremiadeHTML}
  ${notaCreditoMotivoHTML}

  <!-- ═══ PARTES ══════════════════════════════════════════════════════════ -->
  <table style="width:100%;margin-bottom:14px;border-collapse:collapse;">
    <tr>
      <td style="width:49%;vertical-align:top;padding-right:8px;">
        <div style="border:1px solid #ccc;padding:9px 12px;">
          <div style="font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#555;border-bottom:0.5px solid #ddd;padding-bottom:3px;margin-bottom:5px;">FORNECEDOR / EMITENTE</div>
          <div style="font-size:11px;font-weight:bold;">${esc(config.nomeClinica)}</div>
          <div style="font-size:9.5px;color:#444;margin-top:2px;">NIF: <strong>${esc(config.nif || "—")}</strong></div>
          <div style="font-size:9.5px;color:#444;">${esc(config.endereco)}</div>
          <div style="font-size:9.5px;color:#444;">${esc(config.telefone)}${config.email ? " | " + esc(config.email) : ""}</div>
        </div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:49%;vertical-align:top;padding-left:8px;">
        <div style="border:1.5px solid #111;padding:9px 12px;">
          <div style="font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#555;border-bottom:0.5px solid #ddd;padding-bottom:3px;margin-bottom:5px;">ADQUIRENTE / CLIENTE</div>
          <div style="font-size:11px;font-weight:bold;">${esc(fatura.clienteNome || "—")}</div>
          <div style="font-size:9.5px;color:#444;margin-top:2px;">NIF: <strong>${esc(clienteNif)}</strong></div>
          ${fatura.clienteEndereco ? `<div style="font-size:9.5px;color:#444;">${esc(fatura.clienteEndereco)}</div>` : ""}
          ${fatura.facturaPremiada ? `<div style="font-size:8.5px;color:#b45309;margin-top:3px;font-weight:bold;">🏆 NIF registado para Factura Premiada</div>` : ""}
        </div>
      </td>
    </tr>
  </table>

  <!-- ═══ TABELA DE SERVIÇOS ══════════════════════════════════════════════ -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <thead>
      <tr style="border-top:1.5px solid #111;border-bottom:1px solid #111;background:#f0f0f0;">
        <th style="padding:6px 8px;text-align:left;font-size:9.5px;">Descrição do Serviço / Bem</th>
        <th style="padding:6px 8px;text-align:center;font-size:9.5px;width:45px;">Qtd.</th>
        <th style="padding:6px 8px;text-align:right;font-size:9.5px;width:100px;">Preço Unit.</th>
        <th style="padding:6px 8px;text-align:right;font-size:9.5px;width:100px;">Valor s/IVA</th>
        <th style="padding:6px 8px;text-align:center;font-size:9.5px;width:60px;">Taxa IVA</th>
        <th style="padding:6px 8px;text-align:right;font-size:9.5px;width:105px;">Valor c/IVA</th>
      </tr>
    </thead>
    <tbody>
      ${linhasHTML}
    </tbody>
  </table>

  <!-- ═══ TOTAIS + DETALHE IVA ════════════════════════════════════════════ -->
  <table style="width:100%;margin-bottom:14px;">
    <tr>
      <td style="width:52%;vertical-align:top;padding-right:14px;">
        ${
          fatura.observacoes
            ? `
        <div style="border:1px solid #ccc;padding:7px 10px;margin-bottom:8px;">
          <div style="font-size:8px;font-weight:bold;text-transform:uppercase;color:#555;margin-bottom:3px;">Observações</div>
          <div style="font-size:9.5px;">${esc(fatura.observacoes)}</div>
        </div>`
            : ""
        }
        <div style="border:1px solid #ccc;">
          <div style="background:#f0f0f0;padding:5px 8px;font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#333;border-bottom:0.5px solid #ccc;">Detalhe de IVA (cálculo do documento)</div>
          <table style="width:100%;">
            ${ivaDetalheHTML}
          </table>
        </div>
      </td>
      <td style="width:48%;vertical-align:top;">
        <table style="width:100%;border-collapse:collapse;border:1px solid #ccc;">
          <tr>
            <td style="padding:6px 10px;font-size:10px;color:#555;border-bottom:0.5px solid #ddd;">Subtotal sem IVA:</td>
            <td style="padding:6px 10px;font-size:10px;text-align:right;border-bottom:0.5px solid #ddd;">${formatCurrency(fatura.subtotalSemIva, moeda)}</td>
          </tr>
          <tr>
            <td style="padding:6px 10px;font-size:10px;color:#555;border-bottom:1px solid #333;">IVA (${fatura.ivaTaxa}%):</td>
            <td style="padding:6px 10px;font-size:10px;text-align:right;border-bottom:1px solid #333;">${formatCurrency(fatura.totalIva, moeda)}</td>
          </tr>
          <tr>
            <td style="padding:9px 10px;font-size:13px;font-weight:bold;">TOTAL A PAGAR:</td>
            <td style="padding:9px 10px;font-size:13px;font-weight:bold;text-align:right;">${formatCurrency(fatura.total, moeda)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:5px 10px;font-size:8.5px;font-style:italic;color:#555;border-top:0.5px solid #ddd;">
              Por extenso: <strong>${valorPorExtenso(fatura.total)}</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ═══ HASH SHA-256 AGT ═════════════════════════════════════════════════ -->
  <div style="border:1px solid #999;padding:8px 14px;margin-bottom:12px;display:flex;align-items:center;gap:20px;">
    <div style="flex:1;">
      <div style="font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:3px;">Código Hash de Integridade (SHA-256 interno)</div>
      <div style="font-family:monospace;font-size:10px;font-weight:bold;letter-spacing:1px;word-break:break-all;">${esc(codigoHash)}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:8.5px;color:#555;">Hora da operação:</div>
      <div style="font-size:11px;font-weight:bold;font-family:monospace;">${esc(horaOperacao)}</div>
      <div style="font-size:8.5px;color:#555;margin-top:4px;">Verifique em:</div>
      <div style="font-size:8.5px;font-weight:bold;">portalfiscal.agt.gov.ao</div>
    </div>
  </div>

  ${fatura.emitidoPor ? `<div style="font-size:8px;color:#888;text-align:right;margin-bottom:6px;">Emitido por: ${esc(fatura.emitidoPor)}</div>` : ""}

  <!-- ═══ RODAPÉ AGT OBRIGATÓRIO ═══════════════════════════════════════════ -->
  <div style="border-top:1.5px solid #111;padding-top:8px;">
    <div style="text-align:center;font-size:9px;font-weight:bold;margin-bottom:3px;">${esc(config.nomeClinica)}${config.nif ? " — NIF: " + esc(config.nif) : ""}</div>
    <div style="text-align:center;font-size:8px;color:#444;">${[config.endereco, config.telefone ? "Tel: " + config.telefone : "", config.email].filter(Boolean).map(esc).join("  |  ")}</div>
    <div style="text-align:center;font-size:8px;color:#666;margin-top:5px;">
      <strong>Processado por computador</strong> — Nos termos da Lei n.º 2/22, de 27 de Fevereiro (Lei do IVA) e do Decreto Presidencial n.º 292/18 (PVD/AGT).
    </div>
    <div style="text-align:center;font-size:7.5px;color:#888;margin-top:2px;">
      Autoridade Geral Tributária — República de Angola &nbsp;|&nbsp; Este documento é válido como fatura fiscal.
    </div>
  </div>

</div>
<p style="font-size:8px;color:#555">Certificação AGT pendente. O hash interno não equivale a assinatura fiscal certificada.</p></body>
</html>`;
}

export function downloadFatura(html: string, numero: string): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Por favor, permita popups para imprimir.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 600);
}

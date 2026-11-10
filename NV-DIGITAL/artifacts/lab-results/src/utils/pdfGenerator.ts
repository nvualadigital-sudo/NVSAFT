import { Resultado, Paciente, Config } from "../store/storage";
import { ParametroResult } from "../store/storage";

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generatePDFHTML(
  resultado: Resultado,
  paciente: Paciente | undefined,
  config: Config,
  trace?: { processo?: string; accession?: string; sampleCode?: string; provisional?: boolean; reviewState?: string; version?: number; releasedBy?: string },
): string {
  const pac = paciente || ({} as Paciente);
  const amostra = trace?.sampleCode || pac.nAmostra;

  // Group by exam — only keep params that have a result filled in
  const byExame: Record<string, ParametroResult[]> = {};
  for (const p of resultado.parametros) {
    if (!p.resultado?.trim()) continue; // skip empty results
    if (!byExame[p.exame]) byExame[p.exame] = [];
    byExame[p.exame].push(p);
  }

  const rowsHTML = Object.entries(byExame)
    .map(([exame, params]) => {
      const exameHeader = `
        <tr>
          <td colspan="4" style="
            font-weight: bold;
            font-size: 10px;
            padding: 5px 8px 4px 8px;
            border-top: 1px solid #000;
            border-bottom: 1px solid #ccc;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${esc(exame)}</td>
        </tr>`;
      const paramRows = params
        .map(
          (p) => `
          <tr>
            <td style="padding: 3.5px 8px; font-size: 10.5px; width: 42%; border-bottom: 0.5px solid #ddd;">${esc(p.parametro)}</td>
            <td style="padding: 3.5px 8px; font-size: 10.5px; width: 18%; text-align: center; font-weight: bold; border-bottom: 0.5px solid #ddd;">${esc(p.resultado.trim())}</td>
            <td style="padding: 3.5px 8px; font-size: 10px; width: 14%; text-align: center; color: #444; border-bottom: 0.5px solid #ddd;">${esc(p.unidade)}</td>
            <td style="padding: 3.5px 8px; font-size: 10px; width: 26%; text-align: center; color: #444; border-bottom: 0.5px solid #ddd;">${esc(p.referencia)}</td>
          </tr>`,
        )
        .join("");
      return exameHeader + paramRows;
    })
    .join("");

  const totalExames = Object.keys(byExame).length;
  const totalParams = Object.values(byExame).reduce(
    (s, ps) => s + ps.length,
    0,
  );

  const logoHTML = config.logoData
    ? `<img src="${esc(config.logoData)}" style="max-height:70px;max-width:160px;object-fit:contain;" />`
    : "";

  const sexoLabel =
    pac.sexo === "M"
      ? "Masculino"
      : pac.sexo === "F"
        ? "Feminino"
        : esc(pac.sexo || "—");
  const tecnicoNome = resultado.tecnicoNome || "";

  const signatureHTML = !trace?.provisional && config.assinaturaData
    ? `<img src="${esc(config.assinaturaData)}" style="max-height:50px;max-width:180px;object-fit:contain;display:block;margin:0 auto 4px;" />`
    : `<div style="height:36px;"></div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${trace?.provisional ? "Provisório — " : ""}Resultados — ${esc(resultado.pacienteNome || pac.nome || "")}</title>
  <style>
    @page { size: A4; margin: 1.4cm 1.6cm 1.8cm 1.6cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div style="width:100%;">
  ${trace?.provisional ? `<div style="border:2px solid #9a6700;color:#704900;background:#fff8db;padding:10px;margin-bottom:12px;text-align:center;font-size:13px;font-weight:bold;">EM REVISÃO — DOCUMENTO PROVISÓRIO<br><span style="font-size:10px;font-weight:normal;">Cópia interna · Versão ${esc(trace.version || 0)} · Aguarda validação. Não constitui resultado final autorizado.</span></div>` : ""}

  <!-- CABEÇALHO -->
  <table style="width:100%;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:8px;">
    <tr>
      <td style="vertical-align:middle;">
        ${logoHTML}
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <div style="font-size:17px;font-weight:bold;">${esc(config.nomeClinica)}</div>
        ${config.nif ? `<div style="font-size:9px;color:#555;margin-top:1px;">NIF: ${esc(config.nif)}</div>` : ""}
      </td>
    </tr>
  </table>

  <div style="text-align:center;font-size:11.5px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;border-bottom:1px solid #ccc;padding-bottom:6px;">
    Relatório de Resultados de Análises Clínicas
  </div>

  <!-- INFO SUPERIOR -->
  <table style="width:100%;margin-bottom:10px;">
    <tr>
      <td style="width:38%;vertical-align:top;padding-right:12px;">
        <table style="width:100%;font-size:10.5px;">
          <tr><td style="color:#555;white-space:nowrap;padding:2px 4px;">Processo N°:</td><td style="padding:2px 4px;"><strong>${esc(trace?.processo || pac.processo || "—")}</strong></td></tr>
          ${amostra ? `<tr><td style="color:#555;white-space:nowrap;padding:2px 4px;">${trace?.sampleCode ? "N° Amostra:" : "Ref. amostra (hist.):"}</td><td style="padding:2px 4px;"><strong>${esc(amostra)}</strong></td></tr>` : ""}
          ${trace?.accession ? `<tr><td>Pedido:</td><td><strong>${esc(trace.accession)}</strong></td></tr>` : ""}
          <tr><td style="color:#555;white-space:nowrap;padding:2px 4px;">Data de Colheita:</td><td style="padding:2px 4px;">${esc(resultado.data)}</td></tr>
          <tr><td style="color:#555;white-space:nowrap;padding:2px 4px;">Data de Emissão:</td><td style="padding:2px 4px;">${esc(resultado.dataEmissao)}</td></tr>
          ${pac.medico ? `<tr><td style="color:#555;white-space:nowrap;padding:2px 4px;">Médico Req.:</td><td style="padding:2px 4px;">${esc(pac.medico)}</td></tr>` : ""}
          ${pac.recolha ? `<tr><td style="color:#555;white-space:nowrap;padding:2px 4px;">Local de Recolha:</td><td style="padding:2px 4px;">${esc(pac.recolha)}</td></tr>` : ""}
          ${tecnicoNome ? `<tr><td style="color:#555;white-space:nowrap;padding:2px 4px;">Técnico:</td><td style="padding:2px 4px;">${esc(tecnicoNome)}</td></tr>` : ""}
        </table>
      </td>
      <td style="width:62%;vertical-align:top;">
        <div style="border:1.5px solid #333;border-radius:4px;padding:10px 14px;">
          <div style="font-size:12.5px;font-weight:bold;margin-bottom:6px;">
            ${esc(pac.nome || resultado.pacienteNome)}
          </div>
          <table style="font-size:10.5px;width:100%;">
            <tr>
              <td style="color:#555;padding:2px 0;">Sexo:</td>
              <td style="padding:2px 8px;">${sexoLabel}</td>
              <td style="color:#555;padding:2px 0;">Idade:</td>
              <td style="padding:2px 8px;">${pac.idade ? esc(pac.idade) + " Ano(s)" : "—"}</td>
            </tr>
            <tr>
              <td style="color:#555;padding:2px 0;">Data de Nasc.:</td>
              <td style="padding:2px 8px;">${esc(pac.nasc || "—")}</td>
              ${pac.empresa ? `<td style="color:#555;padding:2px 0;">Entidade:</td><td style="padding:2px 8px;">${esc(pac.empresa)}</td>` : "<td></td><td></td>"}
            </tr>
            ${pac.bi ? `<tr><td style="color:#555;padding:2px 0;">BI:</td><td colspan="3" style="padding:2px 8px;">${esc(pac.bi)}</td></tr>` : ""}
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- SUMÁRIO -->
  <div style="border:0.5px solid #bbb;padding:4px 10px;margin-bottom:8px;font-size:9.5px;display:flex;gap:20px;">
    <span>Exames com resultados: <strong>${totalExames}</strong></span>
    <span>Total de parâmetros: <strong>${totalParams}</strong></span>
    ${tecnicoNome ? `<span>Técnico responsável: <strong>${esc(tecnicoNome)}</strong></span>` : ""}
  </div>

  <!-- TABELA DE RESULTADOS -->
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="border-top:1.5px solid #111;border-bottom:1px solid #111;">
        <th style="padding:5px 8px;text-align:left;font-size:10px;font-weight:bold;width:42%;">Análises / Parâmetros</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;font-weight:bold;width:18%;">Resultado</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;font-weight:bold;width:14%;">Unidade</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;font-weight:bold;width:26%;">Valor de Referência</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#888;font-size:10px;">Nenhum resultado registado.</td></tr>`}
    </tbody>
  </table>

  <!-- RODAPÉ -->
  <div style="margin-top:36px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;">
      <!-- Director Técnico -->
      <div style="text-align:center;min-width:200px;">
        ${signatureHTML}
        <div style="border-top:1px solid #333;padding-top:4px;">
          <div style="font-size:10.5px;font-weight:bold;">${trace?.provisional ? "Validação pendente" : "Director(a) Técnico(a)"}</div>
          <div style="font-size:10px;margin-top:2px;font-style:italic;">${trace?.provisional ? "Documento interno em revisão" : esc(config.directorTecnico)}</div>
        </div>
      </div>
      <!-- Técnico Responsável -->
      ${
        tecnicoNome
          ? `
      <div style="text-align:center;min-width:200px;">
        <div style="height:40px;"></div>
        <div style="border-top:1px solid #333;padding-top:4px;">
          <div style="font-size:10.5px;font-weight:bold;">Técnico Responsável</div>
          <div style="font-size:10px;margin-top:2px;font-style:italic;">${esc(tecnicoNome)}</div>
        </div>
      </div>`
          : ""
      }
    </div>
    ${!trace?.provisional && trace?.releasedBy ? `<div style="font-size:9px;text-align:center;margin-bottom:12px;color:#333;">Libertação autorizada no sistema por: <strong>${esc(trace.releasedBy)}</strong></div>` : ""}

    <div style="border-top:1.5px solid #111;padding-top:7px;text-align:center;">
      <div style="font-size:9.5px;font-weight:bold;">${esc(config.nomeClinica)}</div>
      <div style="font-size:8.5px;color:#555;margin-top:2px;">
        ${[config.nif ? "NIF: " + config.nif : "", config.endereco, config.telefone ? "Tel: " + config.telefone : "", config.email].filter(Boolean).map(esc).join("  |  ")}
      </div>
      <div style="font-size:8px;color:#777;margin-top:4px;font-style:italic;">
        Emitido em: ${formatDateLong(resultado.dataEmissao)}
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

function formatDateLong(dateStr: string): string {
  try {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      return d.toLocaleDateString("pt-PT", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  } catch {
    /* ignore */
  }
  return dateStr;
}

export function downloadPDF(html: string, _filename: string): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Por favor, permita popups para gerar o PDF.");
    return;
  }
  // Inject auto-print script inside the document itself so it runs after
  // the content has fully loaded — avoids the blank-page race condition.
  const printable = html.replace(
    "</body>",
    `<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script></body>`,
  );
  win.document.write(printable);
  win.document.close();
  win.focus();
}

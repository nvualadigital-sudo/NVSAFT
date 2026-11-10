import { Produto, Config } from "../store/AppContext";

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(n: number, moeda: string): string {
  return (
    new Intl.NumberFormat("pt-AO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) +
    " " +
    (moeda || "AOA")
  );
}

function hoje(): string {
  return new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function cabecalho(titulo: string, subtitulo: string, config: Config): string {
  const logo = config.logoData
    ? `<img src="${esc(config.logoData)}" style="max-height:60px;max-width:140px;object-fit:contain;" />`
    : `<div style="width:60px;height:60px;border-radius:50%;background:#00AEEF;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;">L</div>`;
  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:14px;border-bottom:2px solid #00AEEF;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:14px;">
        ${logo}
        <div>
          <div style="font-size:15px;font-weight:900;color:#1a1a2e;">${esc(config.nomeClinica || "Laboratório")}</div>
          ${config.nif ? `<div style="font-size:10px;color:#555;">NIF: ${esc(config.nif)}</div>` : ""}
          ${config.endereco ? `<div style="font-size:10px;color:#555;">${esc(config.endereco)}</div>` : ""}
          ${config.telefone ? `<div style="font-size:10px;color:#555;">Tel: ${esc(config.telefone)}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:800;color:#00AEEF;text-transform:uppercase;letter-spacing:1px;">${esc(titulo)}</div>
        <div style="font-size:11px;color:#555;margin-top:3px;">${esc(subtitulo)}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">Data de emissão: ${hoje()}</div>
      </div>
    </div>`;
}

function wrapDoc(body: string, titulo: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; padding: 28px 32px; }
  @page { margin: 18mm 14mm; size: A4; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
  table { width: 100%; border-collapse: collapse; }
  th { background: #00AEEF; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 7px 8px; text-align: left; }
  td { padding: 6px 8px; font-size: 10.5px; border-bottom: 0.5px solid #e8e8ee; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fbff; }
  tr:hover td { background: #eaf6ff; }
  .cat-header td { background: #e6f4fa; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #0077aa; letter-spacing: 0.5px; padding: 5px 8px; border-top: 1px solid #b8dff0; }
  .badge { display:inline-block; padding: 2px 7px; border-radius: 20px; font-size: 9px; font-weight: 700; }
  .badge-blue { background:#dbeafe; color:#1d4ed8; }
  .badge-amber { background:#fef3c7; color:#92400e; }
  .badge-green { background:#d1fae5; color:#065f46; }
  .badge-red { background:#fee2e2; color:#991b1b; }
  .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #888; display: flex; justify-content: space-between; }
</style>
</head>
<body>${body}</body>
</html>`;
}

// ── PRODUTOS ──────────────────────────────────────────────────────────────────

export function downloadProdutosPDF(
  produtos: Produto[],
  config: Config,
  moeda: string,
): void {
  const ativos = produtos.filter((p) => p.ativo);
  const inativos = produtos.filter((p) => !p.ativo);
  const total = produtos.length;
  const semPreco = ativos.filter((p) => p.preco === 0).length;

  // Group by category
  const porCat: Record<string, Produto[]> = {};
  for (const p of [...ativos, ...inativos]) {
    const c = p.categoria || "Sem Categoria";
    if (!porCat[c]) porCat[c] = [];
    porCat[c].push(p);
  }
  const cats = Object.keys(porCat).sort();

  const statsRow = `
    <div style="display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap;">
      ${[
        ["Total", total, "#1d4ed8", "#dbeafe"],
        ["Activos", ativos.length, "#065f46", "#d1fae5"],
        ["Sem Preço", semPreco, "#92400e", "#fef3c7"],
        ["Categorias", cats.length, "#6b21a8", "#f3e8ff"],
      ]
        .map(
          ([l, v, c, bg]) =>
            `<div style="background:${bg};border-radius:10px;padding:10px 18px;min-width:90px;text-align:center;">
          <div style="font-size:20px;font-weight:900;color:${c};">${v}</div>
          <div style="font-size:9px;color:${c};font-weight:600;text-transform:uppercase;">${l}</div>
        </div>`,
        )
        .join("")}
    </div>`;

  let rows = "";
  for (const cat of cats) {
    rows += `<tr class="cat-header"><td colspan="6">📂 ${esc(cat)} (${porCat[cat].length})</td></tr>`;
    for (const p of porCat[cat]) {
      const precoStr =
        p.preco === 0
          ? `<span class="badge badge-amber">Sem preço</span>`
          : `<strong style="color:#00AEEF;">${esc(fmt(p.preco, moeda))}</strong>`;
      const estadoBadge = p.ativo
        ? `<span class="badge badge-green">Activo</span>`
        : `<span class="badge badge-red">Inactivo</span>`;
      const ivaBadge = p.ivaIsento
        ? `<span class="badge" style="background:#f0fdf4;color:#15803d;">Isento</span>`
        : `<span class="badge" style="background:#f1f5f9;color:#475569;">${esc(String(config.ivaTaxa ?? 14))}%</span>`;
      rows += `<tr>
        <td style="color:#888;font-size:9px;">${esc(p.codigo)}</td>
        <td style="font-weight:600;">${esc(p.nome)}</td>
        <td style="color:#555;">${esc(p.descricao || "—")}</td>
        <td style="text-align:center;">${ivaBadge}</td>
        <td style="text-align:center;">${estadoBadge}</td>
        <td style="text-align:right;">${precoStr}</td>
      </tr>`;
    }
  }

  const tableHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:8%;">Código</th>
          <th style="width:30%;">Nome / Serviço</th>
          <th style="width:28%;">Descrição</th>
          <th style="width:10%;text-align:center;">IVA</th>
          <th style="width:10%;text-align:center;">Estado</th>
          <th style="width:14%;text-align:right;">Preço</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      <span>${esc(config.nomeClinica || "Laboratório")} · NIF ${esc(config.nif || "—")}</span>
      <span>Tabela de Preços (PVD) · Emitida em ${hoje()}</span>
    </div>`;

  const html = wrapDoc(
    cabecalho(
      "Tabela de Preços",
      `Lista de Produtos e Serviços · ${total} registos`,
      config,
    ) +
      statsRow +
      tableHTML,
    "Tabela de Preços — " + (config.nomeClinica || "Laboratório"),
  );
  openPDF(html);
}

// ── EXAMES ────────────────────────────────────────────────────────────────────

interface ExameItem {
  cat: string;
  nome: string;
  params: { param: string; unidade: string; referencia: string }[];
  tipo: "Padrão" | "Personalizado";
}

export function downloadExamesPDF(allItems: ExameItem[], config: Config): void {
  const total = allItems.length;
  const padrao = allItems.filter((i) => i.tipo === "Padrão").length;
  const custom = allItems.filter((i) => i.tipo === "Personalizado").length;

  const porCat: Record<string, ExameItem[]> = {};
  for (const item of allItems) {
    if (!porCat[item.cat]) porCat[item.cat] = [];
    porCat[item.cat].push(item);
  }
  const cats = Object.keys(porCat).sort();

  const statsRow = `
    <div style="display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap;">
      ${[
        ["Total", total, "#1d4ed8", "#dbeafe"],
        ["Padrão", padrao, "#065f46", "#d1fae5"],
        ["Personalizado", custom, "#92400e", "#fef3c7"],
        ["Categorias", cats.length, "#6b21a8", "#f3e8ff"],
      ]
        .map(
          ([l, v, c, bg]) =>
            `<div style="background:${bg};border-radius:10px;padding:10px 18px;min-width:90px;text-align:center;">
          <div style="font-size:20px;font-weight:900;color:${c};">${v}</div>
          <div style="font-size:9px;color:${c};font-weight:600;text-transform:uppercase;">${l}</div>
        </div>`,
        )
        .join("")}
    </div>`;

  let rows = "";
  for (const cat of cats) {
    rows += `<tr class="cat-header"><td colspan="4">🔬 ${esc(cat)} (${porCat[cat].length})</td></tr>`;
    for (const item of porCat[cat]) {
      const tipoBadge =
        item.tipo === "Padrão"
          ? `<span class="badge badge-blue">Padrão</span>`
          : `<span class="badge badge-amber">Personalizado</span>`;
      const paramPreview =
        item.params
          .slice(0, 3)
          .map((p) => esc(p.param))
          .join(", ") +
        (item.params.length > 3 ? ` +${item.params.length - 3}` : "");
      rows += `<tr>
        <td style="font-weight:600;">${esc(item.nome)}</td>
        <td style="color:#555;">${esc(item.cat)}</td>
        <td style="text-align:center;">${tipoBadge}</td>
        <td style="color:#555;font-size:9.5px;">${paramPreview || "—"}</td>
      </tr>`;
    }
  }

  const tableHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:32%;">Nome do Exame</th>
          <th style="width:22%;">Categoria</th>
          <th style="width:12%;text-align:center;">Tipo</th>
          <th style="width:34%;">Parâmetros (prévia)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      <span>${esc(config.nomeClinica || "Laboratório")} · NIF ${esc(config.nif || "—")}</span>
      <span>Catálogo de Exames · Emitida em ${hoje()}</span>
    </div>`;

  const html = wrapDoc(
    cabecalho(
      "Catálogo de Exames",
      `Lista completa de exames · ${total} registos`,
      config,
    ) +
      statsRow +
      tableHTML,
    "Catálogo de Exames — " + (config.nomeClinica || "Laboratório"),
  );
  openPDF(html);
}

// ── Shared open ───────────────────────────────────────────────────────────────

function openPDF(html: string): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Por favor, permita popups para gerar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 600);
}

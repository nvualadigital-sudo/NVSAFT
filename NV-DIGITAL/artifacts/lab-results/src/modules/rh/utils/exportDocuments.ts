import {
  institutionalModel,
  institutionalPdf,
  institutionalXlsx,
  type RosterModel,
} from "./institutionalRoster";
import { PDF_FONTS } from "./pdfFonts";
import JSZip from "jszip";
import {
  SHIFT_LEGEND,
  getDaysInMonth,
  getWeekdayAbbr,
  getShiftHours,
} from "@workspace/api-zod";
type Cell = { v: string | number; bg?: string; fg?: string };
export type Sheet = {
  title: string;
  subtitle: string;
  columns: string[];
  widths: number[];
  rows: Cell[][];
  notes: string[];
  legend?: Cell[];
  roster?: RosterModel;
  printLayout?: "a4-month" | "a3-month";
};
export function documentSheet(exported: any): Sheet {
  const d = exported.document,
    period = d.month,
    company = exported.company?.nome_clinica || "NVUALASOFT";
  const title =
    exported.kind === "roster"
      ? "Escala mensal"
      : exported.kind === "slip"
        ? "Recibo de remuneração"
        : "Folha de salários";
  const subtitle = `${company} | ${period} | ${d.department || "Grupo A / regime geral"} | ${d.status.toUpperCase()} | Rev. ${d.revision}`;
  const notes = [
    `Exportação por ${exported.exportedBy} em ${exported.exportedAt.slice(0, 10)}. Dados guardados no servidor.`,
    d.status === "rascunho"
      ? "RASCUNHO — sujeito a revisão e aprovação."
      : `Aprovação: ${d.approved_by || d.actor || "—"}.`,
    d.payment_reference
      ? "Referência de pagamento registada: " + d.payment_reference
      : "Não comprova uma transferência bancária.",
  ];
  if (exported.kind === "roster") {
    const [y, m] = period.split("-").map(Number),
      days = getDaysInMonth(y, m - 1);
    return {
      title,
      subtitle,
      roster: institutionalModel(exported),
      columns: [
        "Colaborador",
        ...Array.from(
          { length: days },
          (_, i) => `${i + 1} ${getWeekdayAbbr(y, m - 1, i + 1)}`,
        ),
        "Horas",
      ],
      widths: [28, ...Array(days).fill(4.4), 8],
      rows: d.data.rows.map((r: any) => {
        let hours = 0;
        return [
          { v: r.name },
          ...Array.from({ length: days }, (_, i) => {
            const code = r.days[i + 1];
            hours += getShiftHours(
              code,
              /chefe/i.test((r.roleCategory || "") + (r.jobTitle || "")),
              d.data.rules,
            );
            const style = SHIFT_LEGEND[code as keyof typeof SHIFT_LEGEND];
            return {
              v: code || "—",
              bg: style?.bg || "#ffffff",
              fg: style?.fg || "#475569",
            };
          }),
          { v: hours, bg: "#ecfeff", fg: "#155e75" },
        ];
      }),
      notes: [
        ...notes.slice(0, 2),
        ...(d.data.reviewNote ? ["Revisão: " + d.data.reviewNote] : []),
        "Horas planeadas. Não equivalem a assiduidade ou horas extraordinárias aprovadas.",
      ],
      legend: Object.entries(SHIFT_LEGEND).map(([k, v]) => ({
        v: k + " — " + v.label,
        bg: v.bg,
        fg: v.fg,
      })),
    };
  }
  if (exported.kind === "inss")
    return {
      title: "Mapa de contribuições INSS",
      subtitle,
      columns: [
        "Colaborador",
        "NIF",
        "N.º INSS",
        "Base INSS",
        "Taxa trab. %",
        "INSS trab.",
        "Taxa entidade %",
        "INSS entidade",
        "Total contribuições",
      ],
      widths: [28, 17, 18, 17, 13, 17, 15, 17, 18],
      rows: d.data.rows.map((r: any) => [
        { v: r.name },
        { v: r.profile.nif },
        { v: r.profile.inssNumber },
        { v: r.ssBase },
        { v: r.employeeRate },
        { v: r.inssEmployee },
        { v: r.employerRate },
        { v: r.inssEmployer },
        {
          v: Math.round((r.inssEmployee + r.inssEmployer) * 100) / 100,
          bg: "#e0f2fe",
          fg: "#0c4a6e",
        },
      ]),
      notes: [
        ...notes,
        "Mapa interno de conferência. Não é um ficheiro de submissão oficial ao INSS.",
      ],
    };
  if (exported.kind === "slip") {
    const r = d.data.rows[0];
    return {
      title: "Recibo de remuneração",
      subtitle,
      columns: ["Rubrica", "Montante AOA"],
      widths: [70, 25],
      rows: [
        [{ v: "Colaborador: " + r.name }, { v: "" }],
        [{ v: "Salário base" }, { v: r.basic }],
        ...r.profile.allowances.map((a: any) => [
          { v: a.label },
          { v: Number(a.value) },
        ]),
        [{ v: "Remuneração bruta" }, { v: r.gross }],
        [{ v: "Base de incidência INSS" }, { v: r.ssBase }],
        [
          { v: `Desconto INSS trabalhador (${r.employeeRate}%)` },
          { v: r.inssEmployee },
        ],
        [{ v: "Matéria colectável IRT" }, { v: r.irtBase }],
        [{ v: "Desconto IRT" }, { v: r.irt }],
        ...(r.internalDetails || []).map((x: any) => [
          {
            v: `Desconto interno: ${x.label}${x.mode === "percent" ? ` (${x.value}% / ${x.basis === "basic" ? "base" : "bruto"})` : ""}`,
          },
          { v: -x.amount },
        ]),
        ...(r.legacyDeductions
          ? [[{ v: "Desconto interno anterior" }, { v: -r.legacyDeductions }]]
          : []),
        [{ v: "Descontos internos" }, { v: r.deductions }],
        [
          { v: "Líquido a receber", bg: "#d1fae5", fg: "#065f46" },
          { v: r.net, bg: "#d1fae5", fg: "#065f46" },
        ],
        [{ v: "INSS entidade — custo da entidade" }, { v: r.inssEmployer }],
        [{ v: "Custo total da entidade" }, { v: r.employerCost }],
      ],
      notes: [
        ...notes,
        `NIF: ${r.profile.nif} | INSS: ${r.profile.inssNumber} | Serviço: ${r.profile.department}`,
        `Colaborador: ${r.name}`,
        ...(r.payrollOptions
          ? [
              `Configuração guardada: INSS trabalhador ${r.payrollOptions.inssEnabled ? "activo" : "desactivado"}; entidade ${r.payrollOptions.employerEnabled ? "activa" : "desactivada"}; IRT ${r.payrollOptions.irtEnabled ? (r.payrollOptions.irtMode === "table" ? "tabela 2026" : r.payrollOptions.irtRate + "% personalizado") : "desactivado"}.`,
              ...(r.payrollOptions.reason
                ? ["Fundamento: " + r.payrollOptions.reason]
                : []),
            ]
          : []),
        ...(r.internalDetails || []).map(
          (x: any) => `Desconto interno ${x.label}: ${x.reason}.`,
        ),
        `Regras: ${d.data.ruleVersion}. Valores em AOA. A contribuição patronal não é descontada no líquido.`,
      ],
    };
  }
  const rows = d.data.rows.map((r: any) => [
    { v: r.name },
    { v: r.basic },
    { v: r.gross },
    { v: r.inssEmployee },
    { v: r.inssEmployer },
    { v: r.irtBase },
    { v: r.irt },
    { v: r.deductions },
    { v: r.net, bg: "#d1fae5", fg: "#065f46" },
    { v: r.employerCost },
  ]);
  const totals =
    rows.length > 1
      ? [
          { v: "TOTAL", bg: "#123b55", fg: "#ffffff" },
          ...Array.from({ length: 9 }, (_, i) => ({
            v:
              Math.round(
                rows.reduce(
                  (s: number, row: any) => s + Number(row[i + 1].v),
                  0,
                ) * 100,
              ) / 100,
            bg: "#123b55",
            fg: "#ffffff",
          })),
        ]
      : null;
  return {
    title,
    subtitle,
    columns: [
      "Colaborador",
      "Salário base",
      "Bruto",
      "INSS trab.",
      "INSS entidade",
      "Base IRT",
      "IRT",
      "Desc. internos",
      "Líquido",
      "Custo entidade",
    ],
    widths: [29, 15, 15, 14, 15, 15, 14, 14, 16, 17],
    rows: totals ? [...rows, totals] : rows,
    notes: [
      ...notes,
      `Montantes em AOA. Regras ${d.data.ruleVersion}. A contribuição INSS da entidade é custo patronal. Descontos internos são rubricas distintas.`,
    ],
  };
}
const xml = (v: any) =>
  String(v ?? "")
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    )
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
const column = (n: number) => {
  let s = "";
  for (n++; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export async function sheetXlsx(s: Sheet) {
  if (s.roster && s.title === "Escala mensal")
    return institutionalXlsx(s.roster);
  const zip = new JSZip(),
    styles: [string, string, boolean][] = [["#ffffff", "#0f172a", false]],
    map = new Map<string, number>();
  function style(bg = "#ffffff", fg = "#0f172a", money = false) {
    const key = [bg, fg, money].join();
    if (map.has(key)) return map.get(key)!;
    const index = styles.length;
    styles.push([bg, fg, money]);
    map.set(key, index);
    return index;
  }
  const lines: string[] = [];
  const row = (i: number, cells: Cell[]) => {
    lines.push(
      `<row r="${i}" ht="${i === 4 ? 38 : i < 5 ? 25 : s.title === "Escala mensal" ? 30 : 22}" customHeight="1">${cells
        .map((c, j) => {
          const idx = style(
            c.bg,
            c.fg,
            typeof c.v === "number" && s.title !== "Escala mensal",
          );
          const ref = column(j) + i;
          return typeof c.v === "number" && Number.isFinite(c.v)
            ? `<c r="${ref}" s="${idx}"><v>${c.v}</v></c>`
            : `<c r="${ref}" s="${idx}" t="inlineStr"><is><t xml:space="preserve">${xml(c.v)}</t></is></c>`;
        })
        .join("")}</row>`,
    );
  };
  row(1, [{ v: s.title, bg: "#123b55", fg: "#ffffff" }]);
  row(2, [{ v: s.subtitle }]);
  row(
    4,
    s.columns.map((v, i) => ({
      v:
        s.title === "Escala mensal" && i > 0 && i < s.columns.length - 1
          ? v.replace(" ", "\n")
          : v,
      bg: "#e0f2fe",
      fg: "#0c4a6e",
    })),
  );
  s.rows.forEach((r, i) => row(i + 5, r));
  let next = s.rows.length + 7;
  for (const item of s.legend || []) row(next++, [item]);
  for (const note of s.notes) row(next++, [{ v: note }]);
  const styleXml = `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="${styles.length}">${styles.map(([_, fg]) => `<font><sz val="11"/><color rgb="FF${fg.slice(1).toUpperCase()}"/><name val="Calibri"/></font>`).join("")}</fonts><fills count="${styles.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${styles.map(([bg]) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${bg.slice(1).toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills><borders count="1"><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.map(([bg, __, money], i) => `<xf numFmtId="${money ? 164 : 0}" fontId="${i}" fillId="${i + 2}" borderId="0" xfId="0" applyFill="1" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" horizontal="${money ? "right" : bg === "#ffffff" ? "left" : "center"}" wrapText="1"/></xf>`).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  zip.file("xl/styles.xml", styleXml);
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${s.title === "Escala mensal" ? "Escala" : "Salários"}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${s.title === "Escala mensal" ? "Escala" : "Salários"}'!$1:$4</definedName></definedNames></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  const end = column(s.columns.length - 1);
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="1" ySplit="4" topLeftCell="B5" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${lines.join("")}</sheetData><mergeCells count="${2 + s.notes.length}"><mergeCell ref="A1:${end}1"/><mergeCell ref="A2:${end}2"/>${s.notes.map((_, i) => `<mergeCell ref="A${s.rows.length + 7 + (s.legend?.length || 0) + i}:${end}${s.rows.length + 7 + (s.legend?.length || 0) + i}"/>`).join("")}</mergeCells><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
const latin = (s: string) =>
  Array.from(s.replace(/[–—]/g, "-").replace(/…/g, "..."))
    .map((c) => (c.charCodeAt(0) <= 255 ? c : "?"))
    .join("");
const pdfText = (s: any) =>
  latin(String(s))
    .replace(/[\\()]/g, "\\$&")
    .replace(/[\r\n]/g, " ");
const rgb = (h: string) =>
  h
    .slice(1)
    .match(/../g)!
    .map((v) => (parseInt(v, 16) / 255).toFixed(3))
    .join(" ");
export function sheetPdf(s: Sheet): Uint8Array {
  if (s.roster && s.title === "Escala mensal")
    return institutionalPdf(s.roster, s.printLayout === "a3-month");
  if (s.title === "Escala mensal") return rosterPdf(s);
  const width = s.title === "Recibo de remuneração" ? 595.28 : 1190.55,
    height = 841.89,
    left = 30,
    available = width - 60,
    unit = available / s.widths.reduce((a, b) => a + b, 0),
    colWidths = s.widths.map((w) => w * unit),
    rowsPerPage = 24;
  const pages: string[] = [];
  const noteLines = s.notes.flatMap((note) => {
    const parts: string[] = [];
    let rest = note;
    const maxChars = Math.floor(available / 4.4);
    while (rest.length > maxChars) {
      const point = rest.lastIndexOf(" ", maxChars);
      const n = point > 40 ? point : maxChars;
      parts.push(rest.slice(0, n));
      rest = rest.slice(n).trimStart();
    }
    if (rest) parts.push(rest);
    return parts;
  });
  const wrapName = (value: string) => {
    const max = Math.max(10, Math.floor((colWidths[0] - 8) / 4.4)),
      parts: string[] = [];
    let rest = value;
    while (rest.length > max) {
      const space = rest.lastIndexOf(" ", max);
      const pos = space > max / 3 ? space : max;
      parts.push(rest.slice(0, pos));
      rest = rest.slice(pos).trimStart();
    }
    parts.push(rest);
    return parts;
  };
  const groups: { row: Cell[]; nameLines: string[]; height: number }[][] = [[]];
  let groupHeight = 0;
  for (const row of s.rows) {
    const nameLines = wrapName(String(row[0]?.v || "")),
      h = Math.max(22, nameLines.length * 10 + 8);
    if (groupHeight + h > 540 && groups[groups.length - 1].length) {
      groups.push([]);
      groupHeight = 0;
    }
    groups[groups.length - 1].push({ row, nameLines, height: h });
    groupHeight += h + 1;
  }
  const dataPages = groups.length,
    extraNotes = noteLines.slice(6),
    notePages = Math.ceil(extraNotes.length / 48),
    count = dataPages + notePages;
  for (let p = 0; p < count; p++) {
    let cmd = "";
    const rect = (x: number, y: number, w: number, h: number, bg: string) => {
      cmd += `${rgb(bg)} rg ${x.toFixed(2)} ${(height - y - h).toFixed(2)} ${w.toFixed(2)} ${h} re f\n`;
    };
    const text = (str: any, x: number, y: number, size = 9, fg = "#0f172a") => {
      cmd += `BT /F1 ${size} Tf ${rgb(fg)} rg 1 0 0 1 ${x.toFixed(2)} ${(height - y).toFixed(2)} Tm (${pdfText(str)}) Tj ET\n`;
    };
    rect(0, 0, width, 92, "#123b55");
    text(s.title, left, 34, 21, "#ffffff");
    const subMax = Math.floor(available / 4.7);
    for (let i = 0; i < s.subtitle.length; i += subMax)
      text(
        s.subtitle.slice(i, i + subMax),
        left,
        60 + (i / subMax) * 11,
        9,
        "#bce5ef",
      );
    text(`Página ${p + 1}/${count}`, width - 110, 33, 9, "#ffffff");
    if (p >= dataPages) {
      text("Detalhes e rubricas (continuação)", left, 120, 14);
      extraNotes
        .slice((p - dataPages) * 48, (p - dataPages + 1) * 48)
        .forEach((n, i) => text(n, left, 150 + i * 12, 9, "#334155"));
      pages.push(cmd);
      continue;
    }
    let x = left,
      y = 112;
    s.columns.forEach((v, i) => {
      rect(x, y, colWidths[i] - 1, 30, "#e0f2fe");
      if (s.title === "Escala mensal" && i > 0 && i < s.columns.length - 1) {
        const [day, dow] = v.split(" ");
        text(day, x + 4, y + 12, 8, "#0c4a6e");
        text(dow, x + 4, y + 24, 7, "#0c4a6e");
      } else text(v, x + 4, y + 19, 8, "#0c4a6e");
      x += colWidths[i];
    });
    y += 31;
    for (const item of groups[p]) {
      const { row, nameLines, height: rowHeight } = item;
      x = left;
      row.forEach((c, i) => {
        const w = colWidths[i];
        rect(x, y, w - 1, rowHeight, c.bg || "#f8fafc");
        let v =
          typeof c.v === "number"
            ? c.v.toLocaleString("pt-AO", {
                minimumFractionDigits: s.title === "Escala mensal" ? 0 : 2,
                maximumFractionDigits: 2,
              })
            : String(c.v);
        if (i === 0)
          nameLines.forEach((line, j) =>
            text(line, x + 4, y + 14 + j * 10, 8, c.fg || "#0f172a"),
          );
        else {
          const font = Math.min(
            9,
            Math.max(5, (w - 8) / (Math.max(1, String(v).length) * 0.55)),
          );
          text(v, x + 4, y + 15, font, c.fg || "#0f172a");
        }
        x += w;
      });
      y += rowHeight + 1;
    }
    let legendX = left;
    const legendY = height - 115;
    for (const item of s.legend || []) {
      const w = 125;
      rect(legendX, legendY, w - 4, 20, item.bg!);
      text(item.v, legendX + 5, legendY + 14, 8, item.fg);
      legendX += w;
    }
    noteLines
      .slice(0, 6)
      .forEach((n, i) => text(n, left, height - 76 + i * 10, 8, "#64748b"));
    pages.push(cmd);
  }
  const objects: string[] = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  const ids: number[] = [];
  for (const content of pages) {
    const pageId = objects.length,
      streamId = pageId + 1;
    ids.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${latin(content).length} >>\nstream\n${latin(content)}endstream`,
    );
  }
  objects[2] = `<< /Type /Pages /Kids [${ids.map((i) => i + " 0 R").join(" ")}] /Count ${ids.length} >>`;
  let output = "%PDF-1.4\n",
    offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(output.length);
    output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const start = output.length;
  output +=
    `xref\n0 ${objects.length}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Uint8Array.from(output, (c) => c.charCodeAt(0));
}
export function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const data = new Uint8Array(bytes);
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Uma folha por escala; nunca divide o mês em duas quinzenas.
function rosterPdf(s: Sheet): Uint8Array {
  const full = s.printLayout === "a3-month",
    width = full ? 1190.55 : 841.89,
    height = full ? 841.89 : 595.28,
    left = 24,
    available = width - left * 2;
  const dayCount = s.columns.length - 2,
    ranges = [[1, dayCount]],
    nameWidth = full ? 225 : 170,
    hoursWidth = full ? 58 : 42;
  const wrap = (input: string, max: number) => {
    const out: string[] = [];
    let rest = input;
    while (rest.length > max) {
      const space = rest.lastIndexOf(" ", max),
        point = space > max / 3 ? space : max;
      out.push(rest.slice(0, point));
      rest = rest.slice(point).trimStart();
    }
    out.push(rest);
    return out;
  };
  const measured = (text: string, size: number) =>
    (Array.from(latin(text)).reduce(
      (sum, c) => sum + (PDF_FONTS[1].widths[c.charCodeAt(0) - 32] || 600),
      0,
    ) *
      size) /
    1000;
  const wrapName = (text: string, size: number) => {
    const out: string[] = [];
    let rest = text;
    while (measured(rest, size) > nameWidth - 14) {
      let end = 1;
      while (
        end < rest.length &&
        measured(rest.slice(0, end + 1), size) <= nameWidth - 14
      )
        end++;
      const space = rest.lastIndexOf(" ", end);
      const cut = space > 0 ? space : end;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    out.push(rest);
    return out;
  };
  let bodyFont = full ? 11 : 9.5,
    items: { row: Cell[]; lines: string[]; height: number }[] = [];
  for (; bodyFont >= (full ? 8 : 7); bodyFont -= 0.5) {
    items = s.rows.map((row) => {
      const lines = wrapName(String(row[0].v), bodyFont);
      return {
        row,
        lines,
        height: Math.max(full ? 22 : 18, lines.length * (bodyFont + 2) + 8),
      };
    });
    if (items.reduce((n, r) => n + r.height, 0) <= height - 245) break;
  }
  if (bodyFont < (full ? 8 : 7))
    throw new Error(
      "Esta equipa não cabe de forma legível numa única folha " +
        (full ? "A3" : "A4") +
        ". Seleccione uma secção/unidade menor" +
        (full ? "." : " ou o formato A3."),
    );
  const pages = [{ range: [1, dayCount], rows: items }];
  const notes = s.notes.flatMap((n) => wrap(n, Math.floor(available / 4.5)));
  if (notes.length > 3)
    notes.splice(
      2,
      notes.length - 2,
      "Notas completas e fundamento da revisão disponíveis no registo digital da escala.",
    );
  const contents: string[] = [];
  for (let page = 0; page < pages.length; page++) {
    const g = pages[page];
    let cmd = "";
    const rect = (x: number, y: number, w: number, h: number, bg: string) => {
      cmd += `${rgb(bg)} rg ${x.toFixed(2)} ${(height - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
    };
    const border = (x: number, y: number, w: number, h: number) => {
      cmd += `0.64 0.70 0.76 RG 0.45 w ${x.toFixed(2)} ${(height - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`;
    };
    const text = (
      v: any,
      x: number,
      y: number,
      size = 11,
      fg = "#172e43",
      bold = false,
    ) => {
      cmd += `BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(fg)} rg 1 0 0 1 ${x.toFixed(2)} ${(height - y).toFixed(2)} Tm (${pdfText(v)}) Tj ET\n`;
    };
    const centered = (
      v: string,
      x: number,
      y: number,
      w: number,
      size = 12,
      fg = "#172e43",
      bold = true,
    ) =>
      text(
        v,
        x +
          Math.max(
            3,
            (w -
              (Array.from(latin(v)).reduce(
                (sum, c) =>
                  sum +
                  (PDF_FONTS[bold ? 1 : 0].widths[c.charCodeAt(0) - 32] || 600),
                0,
              ) *
                size) /
                1000) /
              2,
          ),
        y,
        size,
        fg,
        bold,
      );
    rect(0, 0, width, 83, "#123b55");
    text(s.title, left, 30, 22, "#ffffff", true);
    text(`Página ${page + 1}/${pages.length}`, width - 120, 29, 10, "#ffffff");
    wrap(s.subtitle, Math.floor(available / 5.7))
      .slice(0, 2)
      .forEach((v, i) => text(v, left, 53 + i * 14, 10, "#ffffff"));
    const [first, last] = g.range,
      n = last - first + 1,
      dayWidth = (available - nameWidth - hoursWidth) / n;
    text(
      `MÊS COMPLETO · DIAS ${first} A ${last} · ${full ? "A3" : "A4"} HORIZONTAL`,
      left,
      105,
      11,
      "#123b55",
      true,
    );
    let y = 118;
    rect(left, y, nameWidth, 38, "#e2edf6");
    border(left, y, nameWidth, 38);
    text("COLABORADOR", left + 9, y + 24, 10, "#123b55", true);
    for (let d = first; d <= last; d++) {
      const x = left + nameWidth + (d - first) * dayWidth,
        [day, dow] = s.columns[d].split(" ");
      rect(
        x,
        y,
        dayWidth,
        38,
        ["Sáb", "Dom"].includes(dow) ? "#c3d8ed" : "#e2edf6",
      );
      border(x, y, dayWidth, 38);
      centered(day, x, y + 15, dayWidth, full ? 11 : 8.5);
      centered(dow, x, y + 30, dayWidth, full ? 9 : 7, "#23435e", false);
    }
    const hx = left + available - hoursWidth;
    rect(hx, y, hoursWidth, 38, "#ccebf0");
    border(hx, y, hoursWidth, 38);
    centered("H/mês", hx, y + 24, hoursWidth, full ? 10 : 8);
    y += 38;
    for (const item of g.rows) {
      const { row, lines, height: h } = item;
      rect(left, y, nameWidth, h, "#f7fafc");
      border(left, y, nameWidth, h);
      lines.forEach((v, i) =>
        text(
          v,
          left + 7,
          y + bodyFont + 5 + i * (bodyFont + 2),
          bodyFont,
          "#172e43",
          true,
        ),
      );
      for (let d = first; d <= last; d++) {
        const c = row[d],
          x = left + nameWidth + (d - first) * dayWidth;
        rect(x, y, dayWidth, h, c.bg || "#ffffff");
        border(x, y, dayWidth, h);
        centered(
          String(c.v),
          x,
          y + h / 2 + 4,
          dayWidth,
          full ? 12 : 9.5,
          c.fg || "#172e43",
        );
      }
      rect(hx, y, hoursWidth, h, "#e0f4f5");
      border(hx, y, hoursWidth, h);
      centered(
        String(row[row.length - 1].v),
        hx,
        y + h / 2 + 4,
        hoursWidth,
        full ? 12 : 9.5,
      );
      y += h;
    }
    const legendY = Math.min(y + 22, height - 100),
      legend = s.legend || [],
      lw = available / Math.max(1, legend.length);
    legend.forEach((c, i) => {
      const x = left + i * lw;
      rect(x, legendY, lw - 3, 32, c.bg!);
      border(x, legendY, lw - 3, 32);
      const [code, ...label] = String(c.v).replace(" — ", " ").split(" ");
      text(code, x + 5, legendY + 12, 10, c.fg, true);
      text(label.join(" "), x + 5, legendY + 26, full ? 9 : 8, c.fg);
    });
    text(
      "H/mês = total do mês. Turnos e cores correspondem à escala guardada.",
      left,
      legendY + 49,
      9,
      "#41576a",
    );
    notes
      .slice(0, 3)
      .forEach((v, i) => text(v, left, height - 43 + i * 12, 9, "#41576a"));
    contents.push(cmd);
  }
  const objects: string[] = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "",
    "",
  ];
  for (let i = 0; i < PDF_FONTS.length; i++) {
    const font = PDF_FONTS[i],
      descriptor = objects.length,
      stream = descriptor + 1,
      data = atob(font.data);
    objects[3 + i] =
      `<< /Type /Font /Subtype /TrueType /BaseFont /${font.name} /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 255 /Widths [${font.widths.join(" ")}] /FontDescriptor ${descriptor} 0 R >>`;
    objects.push(
      `<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 /FontBBox [${font.bbox.join(" ")}] /ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight 730 /StemV 80 /FontFile2 ${stream} 0 R >>`,
    );
    objects.push(
      `<< /Length ${data.length} /Length1 ${data.length} >>\nstream\n${data}\nendstream`,
    );
  }
  const ids: number[] = [];
  for (const content of contents) {
    const pageId = objects.length,
      streamId = pageId + 1;
    ids.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${latin(content).length} >>\nstream\n${latin(content)}endstream`,
    );
  }
  objects[2] = `<< /Type /Pages /Kids [${ids.map((i) => i + " 0 R").join(" ")}] /Count ${ids.length} >>`;
  let output = "%PDF-1.4\n",
    offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(output.length);
    output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const start = output.length;
  output +=
    `xref\n0 ${objects.length}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Uint8Array.from(output, (c) => c.charCodeAt(0));
}

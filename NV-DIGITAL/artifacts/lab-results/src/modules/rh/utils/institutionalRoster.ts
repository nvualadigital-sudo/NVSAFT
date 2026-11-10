import JSZip from "jszip";
import {
  getDaysInMonth,
  getShiftHours,
  GLOBAL_DEFAULT_ROSTER_RULES,
} from "@workspace/api-zod";
import { PDF_FONTS } from "./pdfFonts";
const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export type RosterModel = {
  company: string;
  unit: string;
  title: string;
  year: number;
  month: number;
  days: number;
  status: string;
  revision: number;
  activities: string[];
  rules: any;
  rows: {
    name: string;
    role: string;
    days: Record<number, string>;
    hours: number;
    chief: boolean;
    onCall: boolean;
  }[];
  logoRaw: string;
  logo?: { data: Uint8Array; width: number; height: number };
  periods: { morning: string; afternoon: string; onCall: string };
};
export function institutionalModel(exported: any): RosterModel {
  const doc = exported.document,
    [year, month] = doc.month.split("-").map(Number),
    days = getDaysInMonth(year, month - 1),
    rules = doc.data.rules || GLOBAL_DEFAULT_ROSTER_RULES,
    settings = doc.data.printSettings || {};
  return {
    company: exported.company?.nome_clinica || "NVUALASOFT",
    unit:
      settings.unitHeading ||
      (/enferm/i.test(doc.department)
        ? "Direcção de " + doc.department
        : doc.department),
    title:
      settings.title ||
      (/enferm/i.test(doc.department)
        ? "Escala Mensal de Trabalho para os Enfermeiros"
        : "Escala Mensal de Trabalho"),
    year,
    month,
    days,
    status: doc.status,
    revision: doc.revision,
    activities: String(settings.activities || doc.data.reviewNote || "")
      .split("\n")
      .filter(Boolean),
    rules,
    logoRaw: exported.company?.logo_data || "",
    periods: {
      morning: settings.morningPeriod || "07:00h - 15:00h",
      afternoon: settings.afternoonPeriod || "15:00h - 20:00h",
      onCall: settings.onCallPeriod || "07:00h - 07:00h",
    },
    rows: doc.data.rows.map((r: any) => {
      const chief = /chefe/i.test((r.roleCategory || "") + (r.jobTitle || ""));
      return {
        name: r.name,
        role: r.roleCategory === "Equipa" ? "" : r.roleCategory || "",
        days: r.days,
        hours: Object.values(r.days).reduce(
          (n: number, c: any) => n + getShiftHours(c, chief, rules),
          0,
        ),
        chief,
        onCall: Object.values(r.days).includes("M2"),
      };
    }),
  };
}
function jpeg(data: Uint8Array) {
  let i = 2;
  while (i < data.length - 8) {
    if (data[i] !== 255) {
      i++;
      continue;
    }
    const marker = data[i + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker))
      return {
        width: (data[i + 7] << 8) | data[i + 8],
        height: (data[i + 5] << 8) | data[i + 6],
      };
    const length = (data[i + 2] << 8) | data[i + 3];
    if (length < 2) break;
    i += 2 + length;
  }
  throw new Error("Logótipo JPEG inválido.");
}
export async function prepareRosterLogo(model: RosterModel) {
  if (!model.logoRaw) return;
  if (model.logoRaw.length > 3e6)
    throw new Error(
      "O logótipo da empresa é demasiado grande. Use uma imagem até 2 MB.",
    );
  let raw = model.logoRaw;
  if (!/^data:image\/jpe?g;base64,/i.test(raw)) {
    if (!/^data:image\/(png|webp);base64,/i.test(raw))
      throw new Error(
        "Use um logótipo PNG, JPEG ou WebP na configuração da empresa.",
      );
    if (typeof Image === "undefined")
      throw new Error(
        "Converta o logótipo para JPEG ou exporte a partir do navegador.",
      );
    const image = new Image();
    image.src = raw;
    await image.decode();
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar o logótipo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    raw = canvas.toDataURL("image/jpeg", 0.94);
  }
  const data = Uint8Array.from(atob(raw.split(",")[1]), (c) => c.charCodeAt(0));
  model.logo = { data, ...jpeg(data) };
}
const header = "#ffde62",
  pale = "#f7e3a0",
  blue = "#c9ddf1",
  yellow = "#ffe69a";
export function referenceShiftStyle(
  m: RosterModel,
  row: RosterModel["rows"][number],
  day: number,
) {
  const code = row.days[day] || "",
    weekend = [0, 6].includes(
      new Date(Date.UTC(m.year, m.month - 1, day)).getUTCDay(),
    );
  let bg = "#ffffff",
    fg = "#000000";
  if (row.onCall && !["FE", "BM", "L", ""].includes(code)) {
    bg = "#c00000";
    if (code === "M2") fg = "#ffff00";
  } else if (["F", "D"].includes(code) && weekend) bg = "#ffd166";
  if (code === "M") fg = "#29a4cc";
  if (code === "PM") fg = "#00a64b";
  if (code === "FE") fg = "#df4545";
  if (code === "BM") fg = "#9c3e17";
  return { bg, fg };
}
function legends(m: RosterModel) {
  return [
    [
      "M (Diarista / manhã)",
      `${m.periods.morning} = ${m.rules.hours.M}/${m.rules.chiefMorningHours}h (chefia)`,
    ],
    ["PM (Tarde / noite)", `${m.periods.afternoon} = ${m.rules.hours.PM}h`],
    ["M2 (24H)", `${m.periods.onCall} = ${m.rules.hours.M2}h`],
    ["D", "Descanso"],
    ["F", "Folga"],
    ["FE", "Férias / Feriado"],
    ["BM", "Baixa Médica"],
    ["L", "Licença"],
  ];
}
const latin = (v: any) =>
  String(v ?? "")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\xff]/g, "?");
const rgb = (c: string) =>
  c
    .slice(1)
    .match(/../g)!
    .map((h) => (parseInt(h, 16) / 255).toFixed(3))
    .join(" ");
const pdfText = (v: any) => latin(v).replace(/[\\()]/g, "\\$&");
const measure = (v: string, size: number, bold = false) =>
  (Array.from(latin(v)).reduce(
    (n, c) => n + (PDF_FONTS[bold ? 1 : 0].widths[c.charCodeAt(0) - 32] || 600),
    0,
  ) *
    size) /
  1000;
function wrap(v: string, width: number, size: number, bold = false) {
  const lines: string[] = [];
  let remaining = v;
  while (measure(remaining, size, bold) > width) {
    let n = 1;
    while (
      n < remaining.length &&
      measure(remaining.slice(0, n + 1), size, bold) <= width
    )
      n++;
    const space = remaining.lastIndexOf(" ", n);
    const cut = space > 0 ? space : n;
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  lines.push(remaining);
  return lines;
}
export function institutionalPdf(m: RosterModel, a3 = false) {
  if (m.logoRaw && !m.logo)
    throw new Error("Prepare o logótipo da instituição antes de exportar.");
  const width = a3 ? 1190.55 : 841.89,
    height = a3 ? 841.89 : 595.28,
    left = 14,
    total = width - 28,
    roleW = a3 ? 115 : 90,
    nameW = a3 ? 190 : 145,
    hoursW = a3 ? 48 : 38,
    dayW = (total - roleW - nameW - hoursW) / m.days,
    tableTop = 112,
    headH = 30,
    footerH = 145;
  let font = a3 ? 10 : 8.2,
    rows: { lines: string[]; height: number }[] = [];
  for (; font >= 6.5; font -= 0.3) {
    rows = m.rows.map((r) => {
      const lines = wrap(r.name, nameW - 7, font, true);
      return {
        lines,
        height: Math.max(a3 ? 26 : 19, lines.length * (font + 2) + 5),
      };
    });
    if (
      rows.reduce((n, r) => n + r.height, 0) <=
      height - tableTop - headH - footerH - 25
    )
      break;
  }
  if (font < 6.5)
    throw new Error(
      "Esta equipa não cabe legivelmente numa única folha " +
        (a3 ? "A3" : "A4") +
        ". Separe por secção" +
        (a3 ? "." : " ou seleccione A3."),
    );
  let cmd = "";
  const rect = (x: number, y: number, w: number, h: number, bg = "#ffffff") => {
    cmd += `${rgb(bg)} rg ${x.toFixed(2)} ${(height - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f 0 0 0 RG .45 w ${x.toFixed(2)} ${(height - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`;
  };
  const text = (
    v: any,
    x: number,
    y: number,
    size = font,
    fg = "#000000",
    bold = false,
  ) => {
    cmd += `BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(fg)} rg 1 0 0 1 ${x.toFixed(2)} ${(height - y).toFixed(2)} Tm (${pdfText(v)}) Tj ET\n`;
  };
  const center = (
    v: string,
    x: number,
    y: number,
    w: number,
    size = font,
    bold = true,
    fg = "#000000",
  ) =>
    text(
      v,
      x + Math.max(2, (w - measure(v, size, bold)) / 2),
      y,
      size,
      fg,
      bold,
    );
  rect(left, 18, total, 58);
  rect(left, 18, 150, 58);
  if (m.logo) {
    const scale = Math.min(140 / m.logo.width, 48 / m.logo.height),
      w = m.logo.width * scale,
      h = m.logo.height * scale;
    cmd += `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${(left + (150 - w) / 2).toFixed(2)} ${(height - 18 - (58 + h) / 2).toFixed(2)} cm /Logo Do Q\n`;
  } else
    wrap(m.company, 140, 12, true)
      .slice(0, 3)
      .forEach((v, i) => center(v, left, 39 + i * 13, 150, 12, true));
  const heading = wrap(
    m.company + "\n" + m.unit,
    total - 170,
    a3 ? 13 : 11,
    true,
  ).flatMap((v) => v.split("\n"));
  heading
    .slice(0, 3)
    .forEach((v, i) =>
      center(v, left + 150, 39 + i * 13, total - 150, a3 ? 13 : 11, true),
    );
  rect(left, 76, total, 17);
  center(m.title, left, 88, total, a3 ? 11 : 9, true);
  rect(left, 93, total, 19);
  text("Mês: " + months[m.month - 1], left + 7, 106, 9);
  center("Ano: " + m.year, left + total * 0.35, 106, total * 0.18, 9, false);
  text(
    `Data: 01.${String(m.month).padStart(2, "0")}.${m.year} / ${m.days}.${String(m.month).padStart(2, "0")}.${m.year}`,
    left + total * 0.66,
    106,
    9,
  );
  rect(left, tableTop, roleW, headH, header);
  center("Cargo e funções", left, tableTop + 20, roleW, 7.8);
  rect(left + roleW, tableTop, nameW, headH / 2, header);
  center("Dias da semana", left + roleW, tableTop + 11, nameW, 7.5);
  rect(left + roleW, tableTop + 15, nameW, 15, header);
  center("Nomes", left + roleW, tableTop + 26, nameW, 8);
  for (let d = 1; d <= m.days; d++) {
    const x = left + roleW + nameW + (d - 1) * dayW,
      dow = ["D", "S", "T", "Q", "Q", "S", "S"][
        new Date(Date.UTC(m.year, m.month - 1, d)).getUTCDay()
      ];
    rect(x, tableTop, dayW, 15, pale);
    center(dow, x, tableTop + 11, dayW, 7.5);
    rect(x, tableTop + 15, dayW, 15, pale);
    center(String(d).padStart(2, "0"), x, tableTop + 26, dayW, 7.5);
  }
  const hx = left + total - hoursW;
  rect(hx, tableTop, hoursW, headH, pale);
  center("Horas", hx, tableTop + 20, hoursW, 7.7);
  let y = tableTop + headH;
  for (let i = 0; i < m.rows.length; i++) {
    const r = m.rows[i],
      h = rows[i].height;
    rect(left + roleW, y, nameW, h, blue);
    rows[i].lines.forEach((v, j) =>
      text(
        v,
        left + roleW + 4,
        y + font + 4 + j * (font + 2),
        font,
        "#000000",
        true,
      ),
    );
    for (let d = 1; d <= m.days; d++) {
      const x = left + roleW + nameW + (d - 1) * dayW,
        c = referenceShiftStyle(m, r, d);
      rect(x, y, dayW, h, c.bg);
      center(r.days[d] || "", x, y + h / 2 + font / 3, dayW, font, true, c.fg);
    }
    rect(hx, y, hoursW, h, yellow);
    center(String(r.hours), hx, y + h / 2 + font / 3, hoursW, font, true);
    // Cargo e funções: células fundidas para grupos adjacentes.
    if (i === 0 || r.role !== m.rows[i - 1].role) {
      let count = 1;
      while (i + count < m.rows.length && m.rows[i + count].role === r.role)
        count++;
      const groupH = rows.slice(i, i + count).reduce((n, v) => n + v.height, 0);
      rect(left, y, roleW, groupH, r.chief ? "#5b9bd5" : "#ffffff");
      wrap(r.role, roleW - 8, font).forEach((v, j) =>
        text(v, left + 4, y + groupH / 2 + j * (font + 2), font),
      );
    }
    y += h;
  }
  rect(left, y, roleW, 13);
  text("Total", left + 3, y + 10, 8);
  rect(left + roleW, y, total - roleW - hoursW, 13);
  text(String(m.rows.length), left + roleW + 4, y + 10, 8, "#000000", true);
  rect(hx, y, hoursW, 13, yellow);
  center(
    String(m.rows.reduce((n, r) => n + r.hours, 0)),
    hx,
    y + 10,
    hoursW,
    8,
  );
  y += 13;
  const legend = legends(m),
    legendCode = roleW,
    half = total / 2,
    activityNo = 20,
    lh = 14;
  legend.forEach(([code, label], i) => {
    rect(left, y + i * lh, legendCode, lh);
    text(
      code,
      left + 4,
      y + i * lh + 10,
      7.3,
      code.startsWith("M2") ? "#d99700" : code === "FE" ? "#dc5a00" : "#000000",
      true,
    );
    rect(left + legendCode, y + i * lh, half - legendCode, lh);
    text(label, left + legendCode + 4, y + i * lh + 10, 7.3);
  });
  rect(left + half, y, total - half, lh, header);
  center("Formação / Actividades", left + half, y + 10, total - half, 8.4);
  const activityLines = m.activities.flatMap((a) =>
    wrap(a, total - half - activityNo - 8, 7.3),
  );
  for (let i = 0; i < 7; i++) {
    rect(left + half, y + (i + 1) * lh, activityNo, lh, "#ddebf7");
    center(
      String(i + 1),
      left + half,
      y + (i + 1) * lh + 10,
      activityNo,
      7.5,
      false,
    );
    rect(
      left + half + activityNo,
      y + (i + 1) * lh,
      total - half - activityNo,
      lh,
      "#fff2cc",
    );
    const line =
      i === 6 && activityLines.length > 7
        ? "Observações adicionais no registo digital."
        : activityLines[i] || "";
    text(
      line.slice(0, Math.floor((total - half - activityNo - 8) / 4)),
      left + half + activityNo + 3,
      y + (i + 1) * lh + 10,
      7.1,
    );
  }
  text(
    `${m.status.toUpperCase()} · Revisão ${m.revision} · Horas planeadas conforme regras guardadas.`,
    left,
    y + 8 * lh + 13,
    7.4,
    "#555555",
  );
  return makePdf(cmd, width, height, m.logo);
}
function makePdf(
  content: string,
  width: number,
  height: number,
  logo?: RosterModel["logo"],
) {
  const objects: string[] = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "",
    "",
  ];
  for (let i = 0; i < 2; i++) {
    const f = PDF_FONTS[i],
      desc = objects.length,
      stream = desc + 1,
      data = atob(f.data);
    objects[3 + i] =
      `<< /Type /Font /Subtype /TrueType /BaseFont /${f.name} /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 255 /Widths [${f.widths.join(" ")}] /FontDescriptor ${desc} 0 R >>`;
    objects.push(
      `<< /Type /FontDescriptor /FontName /${f.name} /Flags 32 /FontBBox [${f.bbox.join(" ")}] /Ascent ${f.ascent} /Descent ${f.descent} /CapHeight 730 /ItalicAngle 0 /StemV 80 /FontFile2 ${stream} 0 R >>`,
    );
    objects.push(
      `<< /Length ${data.length} /Length1 ${data.length} >>\nstream\n${data}\nendstream`,
    );
  }
  let imageId = 0;
  if (logo) {
    imageId = objects.length;
    const raw = Array.from(logo.data, (c) => String.fromCharCode(c)).join("");
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${raw.length} >>\nstream\n${raw}\nendstream`,
    );
  }
  const page = objects.length,
    stream = page + 1;
  objects[2] = `<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${imageId ? `/XObject << /Logo ${imageId} 0 R >>` : ""} >> /Contents ${stream} 0 R >>`,
  );
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
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
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Uint8Array.from(output, (c) => c.charCodeAt(0));
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
const col = (n: number) => {
  let s = "";
  for (n++; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export async function institutionalXlsx(m: RosterModel) {
  if (m.logoRaw && !m.logo)
    throw new Error("Prepare o logótipo antes de exportar.");
  const z = new JSZip(),
    styles: {
      bg: string;
      fg: string;
      bold: boolean;
      size: number;
      align: string;
    }[] = [],
    styleMap = new Map<string, number>(),
    rows = new Map<number, string[]>(),
    merges: string[] = [],
    end = m.days + 2;
  const style = (
    bg = "#ffffff",
    fg = "#000000",
    bold = false,
    size = 10,
    align = "center",
  ) => {
    const key = JSON.stringify([bg, fg, bold, size, align]);
    if (styleMap.has(key)) return styleMap.get(key)!;
    const n = styles.length;
    styles.push({ bg, fg, bold, size, align });
    styleMap.set(key, n);
    return n;
  };
  const cell = (
    r: number,
    c: number,
    v: any,
    idx = style(),
    formula?: string,
  ) => {
    const arr = rows.get(r) || [];
    arr.push(
      typeof v === "number"
        ? `<c r="${col(c)}${r}" s="${idx}">${formula ? "<f>" + xml(formula) + "</f>" : ""}<v>${v}</v></c>`
        : `<c r="${col(c)}${r}" s="${idx}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`,
    );
    rows.set(r, arr);
  };
  const merge = (r1: number, c1: number, r2: number, c2: number) => {
    if (r1 !== r2 || c1 !== c2) merges.push(`${col(c1)}${r1}:${col(c2)}${r2}`);
  };
  const band = (r: number, c1: number, c2: number, bg = "#ffffff") => {
    for (let c = c1; c <= c2; c++) cell(r, c, "", style(bg));
  };
  // Every merge owns a single anchor, no duplicate Excel cell references.
  const anchor = (
    r: number,
    c: number,
    r2: number,
    c2: number,
    text: string,
    idx: number,
  ) => {
    for (let rr = r; rr <= r2; rr++)
      for (let cc = c; cc <= c2; cc++)
        cell(rr, cc, rr === r && cc === c ? text : "", idx);
    merge(r, c, r2, c2);
  };
  anchor(
    1,
    0,
    3,
    4,
    m.logo ? "" : m.company,
    style("#ffffff", "#086c85", true, 14),
  );
  anchor(
    1,
    5,
    3,
    end,
    m.company + "\n" + m.unit,
    style("#ffffff", "#000000", true, 13),
  );
  anchor(4, 0, 4, end, m.title, style("#ffffff", "#000000", true, 11));
  anchor(5, 0, 5, 1, "Mês: " + months[m.month - 1], style());
  anchor(5, 2, 5, 12, "Ano: " + m.year, style());
  anchor(
    5,
    13,
    5,
    end,
    `Data: 01.${String(m.month).padStart(2, "0")}.${m.year} / ${m.days}.${String(m.month).padStart(2, "0")}.${m.year}`,
    style(),
  );
  anchor(6, 0, 7, 0, "Cargo e funções", style(header, "#000000", true));
  cell(6, 1, "Dias da semana", style(header, "#000000", true, 9));
  cell(7, 1, "Nomes", style(header, "#000000", true));
  for (let d = 1; d <= m.days; d++) {
    cell(
      6,
      d + 1,
      ["D", "S", "T", "Q", "Q", "S", "S"][
        new Date(Date.UTC(m.year, m.month - 1, d)).getUTCDay()
      ],
      style(pale, "#000000", true),
    );
    cell(7, d + 1, String(d).padStart(2, "0"), style(pale, "#000000", true));
  }
  anchor(6, end, 7, end, "Horas", style(pale, "#000000", true));
  m.rows.forEach((row, i) => {
    const r = i + 8;
    cell(r, 1, row.name, style(blue, "#000000", true, 10, "left"));
    for (let d = 1; d <= m.days; d++) {
      const c = referenceShiftStyle(m, row, d);
      cell(r, d + 1, row.days[d] || "", style(c.bg, c.fg, true));
    }
    const range = `C${r}:${col(end - 1)}${r}`;
    const formula = `COUNTIF(${range},"M")*Regras!$${row.chief ? "C" : "B"}$2+COUNTIF(${range},"M2")*Regras!$B$3+COUNTIF(${range},"PM")*Regras!$B$4`;
    cell(r, end, row.hours, style(yellow, "#000000", true), formula);
    if (i === 0 || row.role !== m.rows[i - 1].role) {
      let count = 1;
      while (i + count < m.rows.length && m.rows[i + count].role === row.role)
        count++;
      anchor(
        r,
        0,
        r + count - 1,
        0,
        row.role,
        style(row.chief ? "#5b9bd5" : "#ffffff", "#000000", false, 10, "left"),
      );
    }
  });
  const total = 8 + m.rows.length;
  cell(total, 0, "Total", style());
  anchor(
    total,
    1,
    total,
    end - 1,
    String(m.rows.length),
    style("#ffffff", "#000000", true, 10, "left"),
  );
  cell(
    total,
    end,
    m.rows.reduce((n, r) => n + r.hours, 0),
    style(yellow, "#000000", true),
    m.rows.length ? `SUM(${col(end)}8:${col(end)}${total - 1})` : "0",
  );
  const base = total + 1;
  legends(m).forEach(([code, label], i) => {
    cell(base + i, 0, code, style("#ffffff", "#000000", true, 9, "left"));
    anchor(
      base + i,
      1,
      base + i,
      15,
      label,
      style("#ffffff", "#000000", false, 9, "left"),
    );
  });
  anchor(
    base,
    16,
    base,
    end,
    "Formação / Actividades",
    style(header, "#000000", true, 11),
  );
  for (let i = 1; i <= 7; i++) {
    cell(base + i, 16, i, style("#ddebf7"));
    anchor(
      base + i,
      17,
      base + i,
      end,
      i === 7 && m.activities.length > 7
        ? "Observações adicionais no registo digital."
        : m.activities[i - 1] || "",
      style("#fff2cc", "#000000", false, 9, "left"),
    );
  }
  anchor(
    base + 8,
    0,
    base + 8,
    end,
    `${m.status.toUpperCase()} · Revisão ${m.revision} · Horas conforme regras guardadas`,
    style("#ffffff", "#555555", false, 8, "left"),
  );
  const sh = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="2" ySplit="7" topLeftCell="C8" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="26" customWidth="1"/><col min="3" max="${end}" width="3.6" customWidth="1"/><col min="${end + 1}" max="${end + 1}" width="7" customWidth="1"/></cols><sheetData>${[
    ...rows,
  ]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([r, c]) =>
        `<row r="${r}" ht="${r <= 3 ? 18 : r === 4 ? 20 : r === 5 ? 20 : r <= 7 ? 18 : r < total ? 26 : 18}" customHeight="1">${c
          .sort((a, b) => {
            const index = (x: string) =>
              x
                .match(/r="([A-Z]+)/)![1]
                .split("")
                .reduce((n, k) => n * 26 + k.charCodeAt(0) - 64, 0);
            return index(a) - index(b);
          })
          .join("")}</row>`,
    )
    .join(
      "",
    )}</sheetData><mergeCells count="${merges.length}">${merges.map((v) => `<mergeCell ref="${v}"/>`).join("")}</mergeCells><pageMargins left="0.15" right="0.15" top="0.2" bottom="0.2" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/>${m.logo ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
  const styleXml = `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${styles.length}">${styles.map((s) => `<font><sz val="${s.size}"/><name val="Calibri"/><color rgb="FF${s.fg.slice(1).toUpperCase()}"/>${s.bold ? "<b/>" : ""}</font>`).join("")}</fonts><fills count="${styles.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${styles.map((s) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${s.bg.slice(1).toUpperCase()}"/></patternFill></fill>`).join("")}</fills><borders count="1"><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.map((s, i) => `<xf numFmtId="0" fontId="${i}" fillId="${i + 2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${s.align}" vertical="center" wrapText="1"/></xf>`).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  z.file("xl/worksheets/sheet1.xml", sh);
  z.file("xl/styles.xml", styleXml);
  z.file(
    "xl/worksheets/sheet2.xml",
    `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Código</t></is></c><c r="B1" t="inlineStr"><is><t>Horas</t></is></c><c r="C1" t="inlineStr"><is><t>Chefia</t></is></c></row>${[
      ["M", m.rules.hours.M, m.rules.chiefMorningHours],
      ["M2", m.rules.hours.M2, m.rules.hours.M2],
      ["PM", m.rules.hours.PM, m.rules.hours.PM],
    ]
      .map(
        (v, i) =>
          `<row r="${i + 2}"><c r="A${i + 2}" t="inlineStr"><is><t>${v[0]}</t></is></c><c r="B${i + 2}"><v>${v[1]}</v></c><c r="C${i + 2}"><v>${v[2]}</v></c></row>`,
      )
      .join("")}</sheetData></worksheet>`,
  );
  z.file(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Escala" sheetId="1" r:id="rId1"/><sheet name="Regras" sheetId="2" state="hidden" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'Escala'!$A$1:$${col(end)}$${base + 8}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'Escala'!$1:$7</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
  );
  z.file(
    "xl/_rels/workbook.xml.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  z.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  let extra = "";
  if (m.logo) {
    z.file("xl/media/logo.jpg", m.logo.data);
    z.file(
      "xl/worksheets/_rels/sheet1.xml.rels",
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
    );
    const scale = Math.min(210 / m.logo.width, 65 / m.logo.height),
      w = Math.round(m.logo.width * scale * 9525),
      h = Math.round(m.logo.height * scale * 9525);
    z.file(
      "xl/drawings/drawing1.xml",
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>50000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>30000</xdr:rowOff></xdr:from><xdr:ext cx="${w}" cy="${h}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Logótipo da empresa"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`,
    );
    z.file(
      "xl/drawings/_rels/drawing1.xml.rels",
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.jpg"/></Relationships>',
    );
    extra =
      '<Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
  }
  z.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${extra}</Types>`,
  );
  return z.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

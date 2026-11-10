import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  documentSheet,
  sheetPdf,
  sheetXlsx,
} from "../artifacts/lab-results/src/modules/rh/utils/exportDocuments";
import {
  GLOBAL_DEFAULT_ROSTER_RULES,
  SHIFT_LEGEND,
} from "../lib/api-zod/src/hr-domain";
const JSZip = createRequire(
  new URL("../artifacts/lab-results/package.json", import.meta.url),
)("jszip");
const example = {
  kind: "roster",
  company: { nome_clinica: "NVUALASOFT · Unidade de teste" },
  document: {
    month: "2026-10",
    department: "Enfermagem",
    status: "rascunho",
    revision: 2,
    data: {
      rules: { ...GLOBAL_DEFAULT_ROSTER_RULES },
      rows: Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        name: [
          "Ana Manuel",
          "João António",
          "Maria da Conceição",
          "Paulo Afonso",
          "Teresa Domingos",
        ][i],
        jobTitle: "Enfermagem",
        days: Object.fromEntries(
          Array.from({ length: 31 }, (_, j) => [
            j + 1,
            (["M", "PM", "D", "F", "FE", "BM", "L", "M2"] as const)[
              (i + j) % 8
            ],
          ]),
        ),
      })),
    },
  },
  exportedBy: "Conta de teste",
  exportedAt: "2026-10-28T13:00:00Z",
};
test("institutional PDF uses one A4 page, reference headings, names, roles and planned hours", () => {
  const sheet = documentSheet(example),
    pdf = Buffer.from(sheetPdf(sheet)).toString("latin1");
  assert.ok(pdf.startsWith("%PDF-1.4"));
  for (const term of [
    "Cargo e fun",
    "Nomes",
    "Forma",
    "Actividades",
    "RASCUNHO",
    "841.89 595.28",
    "/Count 1",
  ])
    assert.ok(pdf.includes(term), term);
  assert.ok(pdf.includes("0.753 0.000 0.000 rg"));
  assert.ok(pdf.includes("DejaVuSans"));
});
test("reference XLSX has merged company/role headers, yellow frame, blue names, recalculating hours and one-page print area", async () => {
  const sheet = documentSheet(example),
    z = await JSZip.loadAsync(await sheetXlsx(sheet));
  const xml = await z.file("xl/worksheets/sheet1.xml").async("string"),
    styles = await z.file("xl/styles.xml").async("string"),
    wb = await z.file("xl/workbook.xml").async("string");
  for (const term of [
    "Cargo e funções",
    "Nomes",
    "Formação / Actividades",
    "COUNTIF",
    "Regras!",
    'fitToHeight="1"',
    'orientation="landscape"',
    'state="frozen"',
  ])
    assert.ok(xml.includes(term), term);
  for (const color of ["FFFFDE62", "FFC9DDF1", "FFC00000"])
    assert.ok(styles.includes(color), color);
  assert.ok(wb.includes("Print_Area"));
  assert.ok(wb.includes('name="Regras"'));
  sheet.roster!.rows[0].name = '=HYPERLINK("https://example.invalid")';
  const zz = await JSZip.loadAsync(await sheetXlsx(sheet));
  const raw = await zz.file("xl/worksheets/sheet1.xml").async("string");
  assert.ok(raw.includes('t="inlineStr"'));
  assert.ok(!raw.includes("<f>HYPERLINK"));
  const refs = [...raw.matchAll(/<c r="([A-Z]+[0-9]+)"/g)].map((x) => x[1]);
  assert.equal(new Set(refs).size, refs.length);
});
test("payroll/slip exports identify net and employer contribution separately without changing the saved values", () => {
  const row = {
    workerId: "a",
    name: "Pessoa Exemplo",
    basic: 300000,
    gross: 300000,
    inssEmployee: 9000,
    inssEmployer: 24000,
    irtBase: 291000,
    irt: 47630,
    deductions: 0,
    net: 243370,
    ssBase: 300000,
    employeeRate: 3,
    employerRate: 8,
    employerCost: 324000,
    profile: {
      department: "Enfermagem",
      nif: "5001234567",
      inssNumber: "123",
      allowances: [],
    },
  };
  const s = documentSheet({
    ...example,
    kind: "slip",
    document: {
      ...example.document,
      data: { rows: [row], ruleVersion: "AO-GrupoA-2026-v1" },
    },
  });
  assert.equal(
    s.rows.find((r: any) => r[0].v === "Líquido a receber")?.[1].v,
    243370,
  );
  assert.equal(
    s.rows.find((r: any) => r[0].v === "INSS entidade — custo da entidade")?.[1]
      .v,
    24000,
  );
  assert.ok(s.notes.some((n) => n.includes("NIF:")));
  const pdf = sheetPdf(s);
  assert.match(Buffer.from(pdf).toString("latin1"), /595.28 841.89/);
});

test("long payslip detail notes continue on extra pages rather than disappearing", () => {
  const s = documentSheet(example);
  s.title = "Recibo de remuneração";
  s.notes = Array.from({ length: 60 }, (_, i) => "Rubrica documentada " + i);
  const pdf = Buffer.from(sheetPdf(s)).toString("latin1");
  assert.match(pdf, /Rubrica documentada 59/);
  assert.match(pdf, /\/Count 3/);
});

test("monthly A3 remains available and roster PDFs use bold 12 point shifts with a visible grid", () => {
  const sheet = documentSheet(example);
  sheet.printLayout = "a3-month";
  const pdf = Buffer.from(sheetPdf(sheet)).toString("latin1");
  assert.match(pdf, /1190.55 841.89/);
  assert.match(pdf, /DejaVuSans-Bold/);
  assert.ok(pdf.includes("/F2 10 Tf"));
  assert.ok(pdf.includes(".45 w"));
  assert.ok(!sheet.notes.some((n) => n.includes("transferência")));
});

test("A4 includes all month days on exactly one page and refuses illegible overflow", () => {
  const s = documentSheet(example);
  const pdf = Buffer.from(sheetPdf(s)).toString("latin1");
  assert.match(pdf, /\/Count 1/);
  assert.ok(pdf.includes("Cargo e fun"));
  assert.ok(!pdf.includes("QUINZENA"));
  const crowded = {
    ...s,
    roster: {
      ...s.roster!,
      rows: Array.from({ length: 100 }, () => s.roster!.rows[0]),
    },
  };
  assert.throws(() => sheetPdf(crowded), /não cabe.*única folha/);
});

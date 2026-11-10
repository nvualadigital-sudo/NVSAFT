/** Pré-visualização local de tabelas comerciais. Nunca envia o ficheiro bruto à API. */
import { read, utils } from "xlsx";

export type CatalogImportRow = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  preco: number;
  ativo: boolean;
  selected: boolean;
};

export type CatalogImportPreview = { rows: CatalogImportRow[]; warnings: string[] };

export function normalizeExamName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-PT").replace(/\s+/g, " ").trim();
}

export function parseKwanza(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const raw = String(value ?? "").replace(/\b(?:AOA|AKZ|KZ|KWANZAS?)\b/gi, "").replace(/\s/g, "").trim();
  if (!raw || !/^[0-9.,]+$/.test(raw)) return null;
  let numeric = raw;
  if (raw.includes(",")) numeric = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) numeric = raw.replace(/\./g, "");
  const result = Number(numeric);
  return Number.isFinite(result) && result >= 0 && result <= 1_000_000_000 ? Math.round(result * 100) / 100 : null;
}

function normalizeHeading(v: unknown): string {
  return normalizeExamName(String(v ?? "")).replace(/[^a-z0-9]/g, "");
}

function getColumn(row: unknown[], names: RegExp): number {
  return row.findIndex((v) => names.test(normalizeHeading(v)));
}

function rowsFromSheet(matrix: unknown[][]): { nome: string; preco: number; categoria: string; codigo: string }[] {
  const headerIndex = matrix.slice(0, 12).findIndex((row) =>
    getColumn(row, /^(?:nome|produto|exame|analise|teste|designacao|descricao|servico)$/) >= 0,
  );
  const header = headerIndex >= 0 ? matrix[headerIndex] : [];
  const nameCol = headerIndex >= 0 ? getColumn(header, /^(?:nome|produto|exame|analise|teste|designacao|descricao|servico)$/) : 0;
  const priceCol = headerIndex >= 0 ? getColumn(header, /^(?:preco|valor|pvp|precodevenda|precofinal|valorunitario|precodeexame)$/) : 1;
  const categoryCol = headerIndex >= 0 ? getColumn(header, /^(?:categoria|grupo|area|sector|especialidade)$/) : -1;
  const codeCol = headerIndex >= 0 ? getColumn(header, /^(?:codigo|cod|referencia|ref)$/) : -1;
  return matrix.slice(Math.max(0, headerIndex + 1)).map((row) => ({
    nome: String(row[nameCol] ?? "").trim(),
    preco: parseKwanza(priceCol >= 0 ? row[priceCol] : undefined) ?? 0,
    categoria: categoryCol >= 0 ? String(row[categoryCol] ?? "").trim() : "Laboratório",
    codigo: codeCol >= 0 ? String(row[codeCol] ?? "").trim() : "",
  })).filter((r) => r.nome.length > 1 && !/^total(?:\s|$)/i.test(r.nome));
}

function rowsFromPdfLines(lines: string[]): { nome: string; preco: number; categoria: string; codigo: string }[] {
  const rows: { nome: string; preco: number; categoria: string; codigo: string }[] = [];
  for (const line of lines) {
    const clean = line.replace(/\s+/g, " ").trim();
    // A leitura automática só admite linhas onde o preço é inequívoco no fim.
    const match = /^(.{3,180}?)\s*[|;:]?\s+(?:(?:AOA|AKZ|KZ)\s*)?(\d{1,3}(?:[. ]\d{3})+(?:,\d{1,2})?|\d{4,9}(?:[.,]\d{1,2})?)\s*(?:AOA|AKZ|KZ)?$/i.exec(clean);
    if (!match || /(?:total|subtotal|p[aá]gina|nif|contacto)/i.test(match[1])) continue;
    const preco = parseKwanza(match[2]);
    if (preco === null) continue;
    const nome = match[1].replace(/^\d{2,7}\s+/, "").replace(/\s*[|;:]\s*$/, "").trim();
    if (nome.length < 3) continue;
    rows.push({ nome, preco, categoria: "Laboratório", codigo: "" });
  }
  return rows;
}

async function extractPdfLines(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const pdf = await task.promise;
  const lines: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 30); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const positioned = content.items.filter((v): v is Extract<typeof v, { str: string }> => "str" in v && Boolean(v.str)).map((v) => ({
        text: v.str, y: Math.round(v.transform[5] / 3) * 3, x: v.transform[4],
      }));
      const grouped = new Map<number, { text: string; x: number }[]>();
      for (const item of positioned) grouped.set(item.y, [...(grouped.get(item.y) || []), item]);
      for (const [, parts] of [...grouped.entries()].sort((a, b) => b[0] - a[0])) {
        lines.push(parts.sort((a, b) => a.x - b.x).map((v) => v.text).join(" "));
      }
    }
  } finally {
    await task.destroy();
  }
  return lines;
}

export async function previewCatalogFile(file: File): Promise<CatalogImportPreview> {
  if (file.size > 10 * 1024 * 1024) throw new Error("O ficheiro não pode ultrapassar 10 MB.");
  const ext = file.name.toLocaleLowerCase().split(".").pop();
  if (!ext || !["xlsx", "xls", "csv", "pdf"].includes(ext))
    throw new Error("Utilize PDF, Excel (.xlsx/.xls) ou CSV.");
  const buffer = await file.arrayBuffer();
  let raw: { nome: string; preco: number; categoria: string; codigo: string }[];
  const warnings: string[] = [];
  if (ext === "pdf") {
    const lines = await extractPdfLines(buffer);
    raw = rowsFromPdfLines(lines);
    warnings.push("PDF: a leitura automática pode omitir ou separar linhas. Confirme cada exame e preço na pré-visualização; PDFs digitalizados necessitam de OCR e não são importados automaticamente.");
  } else {
    const book = read(buffer, { type: "array" });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw new Error("A folha de cálculo está vazia.");
    raw = rowsFromSheet(utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }));
  }
  const unique = new Set<string>();
  const prefix = `IMP-${Date.now().toString(36).toUpperCase()}`;
  const rows = raw.slice(0, 300).filter((r) => {
    const key = normalizeExamName(r.nome);
    if (!key || unique.has(key)) return false;
    unique.add(key);
    return true;
  }).map((r, i): CatalogImportRow => ({
    id: String(i + 1), codigo: r.codigo || `${prefix}-${String(i + 1).padStart(3, "0")}`,
    nome: r.nome.slice(0, 300), categoria: (r.categoria || "Laboratório").slice(0, 100),
    preco: r.preco, ativo: false, selected: true,
  }));
  if (raw.length > 300) warnings.push("Apenas os primeiros 300 registos são apresentados. Divida o documento para importar o restante.");
  if (rows.length !== Math.min(raw.length, 300)) warnings.push("Foram omitidas linhas repetidas ou sem nome.");
  if (!rows.length) warnings.push("Não foram detectadas linhas seguras para importar. Verifique as colunas ou utilize um Excel com as colunas Exame e Preço.");
  return { rows, warnings };
}

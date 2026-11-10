export const EXPORT_LABELS: Record<string, string> = {
  data: "Data do acto",
  factura: "Factura",
  seguradora: "Seguradora",
  paciente: "Paciente",
  processo: "Processo",
  cartao: "Cartão",
  apolice: "Apólice",
  plano: "Plano",
  acto: "Código do acto",
  descricao: "Acto clínico",
  servico: "Serviço",
  profissional: "Profissional",
  quantidade: "Quantidade",
  preco: "Preço unitário (Kz)",
  facturado: "Facturado (Kz)",
  responsabilidadeSeguradora: "Parcela seguradora (Kz)",
  responsabilidadePaciente: "Parcela paciente (Kz)",
  autorizacao: "Autorização",
  vencimento: "Vencimento",
  estado: "Estado",
  custoInterno: "Custo interno (Kz)",
  margem: "Margem antes de IVA (Kz)",
  date: "Data",
  kind: "Movimento",
  reference: "Referência",
  numero: "Factura de origem",
  debit: "Débito (Kz)",
  credit: "Crédito (Kz)",
  balance: "Saldo a receber (Kz)",
};
export type ExportColumn = { key: string; label: string };
const safe = (v: any) =>
  typeof v === "string" && /^[\s]*[=+@-]/.test(v) ? "'" + v : (v ?? "");
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function exportInsuranceTable(
  format: "csv" | "xlsx" | "pdf",
  rows: any[],
  columns: ExportColumn[],
  name: string,
  heading: string,
  notes: string[],
  popup?: Window | null,
) {
  const values = rows.map((r) => columns.map((c) => safe(r[c.key]))),
    table = [columns.map((c) => c.label), ...values];
  if (format === "csv") {
    download(
      new Blob(
        [
          "\uFEFF" +
            table
              .map((r) =>
                r
                  .map((c) => '"' + String(c).replace(/"/g, '""') + '"')
                  .join(";"),
              )
              .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      name + ".csv",
    );
    return;
  }
  if (format === "xlsx") {
    const XLSX = await import("xlsx"),
      book = XLSX.utils.book_new(),
      sheet = XLSX.utils.aoa_to_sheet(table);
    sheet["!cols"] = columns.map((c) => ({
      wch: Math.min(45, Math.max(18, c.label.length + 2)),
    }));
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: table.length - 1, c: columns.length - 1 },
      }),
    };
    XLSX.utils.book_append_sheet(book, sheet, "Mapa");
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([[heading], ...notes.map((n) => [n])]),
      "Critérios",
    );
    download(
      new Blob([XLSX.write(book, { bookType: "xlsx", type: "array" })], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      name + ".xlsx",
    );
    return;
  }
  const w = popup || window.open("", "_blank");
  if (!w) throw new Error("Permita a janela de impressão para guardar o PDF.");
  const d = w.document;
  d.title = heading;
  d.body.replaceChildren();
  const style = d.createElement("style");
  style.textContent =
    "@page{size:A4 landscape;margin:10mm}body{font:10px Arial;color:#162336}h1{font-size:17px}p{font-size:10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:5px;text-align:left;overflow-wrap:anywhere}th{background:#e2e8f0}thead{display:table-header-group}tr{break-inside:avoid}footer{margin-top:12px;font-size:9px}";
  d.head.append(style);
  const title = d.createElement("h1");
  title.textContent = heading;
  d.body.append(title);
  for (const n of notes) {
    const p = d.createElement("p");
    p.textContent = n;
    d.body.append(p);
  }
  const t = d.createElement("table"),
    thead = d.createElement("thead"),
    body = d.createElement("tbody");
  const header = d.createElement("tr");
  columns.forEach((c) => {
    const th = d.createElement("th");
    th.textContent = c.label;
    header.append(th);
  });
  thead.append(header);
  for (const row of rows) {
    const tr = d.createElement("tr");
    for (const c of columns) {
      const td = d.createElement("td"),
        v = row[c.key];
      td.textContent =
        typeof v === "number"
          ? v.toLocaleString("pt-AO", { maximumFractionDigits: 2 })
          : String(v ?? "");
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(thead, body);
  d.body.append(t);
  const footer = d.createElement("footer");
  footer.textContent =
    "Valores em Kz · Gerado em " +
    new Date().toLocaleString("pt-AO") +
    " · Documento interno da instituição";
  d.body.append(footer);
  w.focus();
  w.print();
}

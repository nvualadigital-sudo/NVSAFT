import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  creditedDocumentNumbers,
  INVOICE_PAGE_SIZE,
  paginateInvoices,
} from "../artifacts/lab-results/src/modules/faturacao/utils/invoiceList";

test("histórico extenso mostra no máximo 40 facturas de cada vez sem perder registos", () => {
  const invoices = Array.from({ length: 1023 }, (_, id) => ({ id }));
  const first = paginateInvoices(invoices, 1);
  const second = paginateInvoices(invoices, 2);
  const last = paginateInvoices(invoices, 999);
  assert.equal(INVOICE_PAGE_SIZE, 40);
  assert.deepEqual([first.page, first.start, first.end, first.total], [1, 1, 40, 1023]);
  assert.equal(second.items[0].id, 40);
  assert.equal(last.page, 26);
  assert.equal(last.items.length, 23);
  assert.equal(last.items.at(-1)?.id, 1022);
  assert.equal(invoices.length, 1023);
});

test("paginação trata listas vazias e páginas inválidas sem erro", () => {
  assert.deepEqual(paginateInvoices([], -4), { page: 1, pages: 1, total: 0, start: 0, end: 0, items: [] });
  assert.equal(paginateInvoices([1, 2, 3], Number.NaN).page, 1);
  assert.equal(paginateInvoices([1, 2, 3], 1, 0).items.length, 3);
});

test("uma nota de crédito anulada não bloqueia nova correcção do documento", () => {
  const credited = creditedDocumentNumbers([
    { tipoDocumento: "nota-credito", documentoOrigem: "FT 2026/1", estado: "emitida" },
    { tipoDocumento: "nota-credito", documentoOrigem: "FT 2026/2", estado: "anulada" },
    { tipoDocumento: "factura", documentoOrigem: "FT 2026/3", estado: "emitida" },
  ]);
  assert.equal(credited.has("FT 2026/1"), true);
  assert.equal(credited.has("FT 2026/2"), false);
  assert.equal(credited.has("FT 2026/3"), false);
});

test("fontes da facturação mantêm pesos e carregam externamente em WOFF2", () => {
  const styles = readFileSync(new URL("../artifacts/lab-results/src/modules/faturacao/styles/reference.ts", import.meta.url), "utf8");
  assert.ok(styles.length < 30000, "fontes não devem ser embebidas no JavaScript");
  assert.ok(!styles.includes("data:font/ttf;base64"));
  for (const weight of [300, 400, 700]) {
    assert.ok(styles.includes(`/fonts/nv-roboto-${weight}.woff2`));
    assert.ok(styles.includes(`font-weight:${weight}`));
    const font = readFileSync(new URL(`../artifacts/lab-results/public/fonts/nv-roboto-${weight}.woff2`, import.meta.url));
    assert.equal(font.subarray(0, 4).toString("ascii"), "wOF2");
  }
});

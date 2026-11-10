import test from "node:test";
import assert from "node:assert/strict";
import {
  financialSummary,
  reportDate,
} from "../artifacts/lab-results/src/utils/resumoFinanceiro";
test("revenue totals exclude receipts, proformas and drafts while retaining credit notes and cross-month dates", () => {
  const docs = [
    { estado: "paga", tipoDocumento: "factura", total: 100 },
    { estado: "paga", tipoDocumento: "recibo", total: 100 },
    { estado: "emitida", tipoDocumento: "pro-forma", total: 200 },
    { estado: "rascunho", tipoDocumento: "factura", total: 300 },
    { estado: "anulada", tipoDocumento: "factura", total: 50 },
    { estado: "emitida", tipoDocumento: "nota-credito", total: -20 },
    { estado: "emitida", tipoDocumento: "factura", total: 40 },
  ];
  const summary = financialSummary(docs);
  assert.equal(summary.total, 120);
  assert.equal(summary.paid, 100);
  assert.equal(summary.pending, 40);
  assert.ok(reportDate("02/01/2027") > reportDate("31/12/2026"));
  assert.ok(Number.isNaN(reportDate("31/02/2026")));
});
test("partial patient and insurance payments count actual receipts without counting the receipt twice",()=>{
 const result=financialSummary([{estado:"emitida",tipoDocumento:"factura",total:50000,receivableBalance:25000,cashReceived:25000,insured:true},{estado:"paga",tipoDocumento:"recibo",total:25000},{estado:"emitida",tipoDocumento:"factura",total:12000,receivableBalance:7000,cashReceived:5000}]);
 assert.equal(result.total,62000);assert.equal(result.paid,30000);assert.equal(result.pending,32000);
});

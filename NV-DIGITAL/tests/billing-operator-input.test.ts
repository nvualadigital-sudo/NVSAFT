import test from "node:test";
import assert from "node:assert/strict";
import {
  inputNumber,
  invoicePreview,
} from "../artifacts/lab-results/src/modules/faturacao/utils/billingNumbers";
import { totals, parseIvaRate } from "../artifacts/api-server/src/lib/billing-engine";
import {
  code128Bits,
  qrPayload,
} from "../artifacts/lab-results/src/modules/faturacao/utils/documentCodes";
test("operator decimal comma, separators and blank discounts are read consistently", () => {
  for (const [text, n] of [
    ["", 0],
    ["10,50", 10.5],
    ["1.250,50", 1250.5],
    ["1 250,50", 1250.5],
    ["1250.50", 1250.5],
    ["0", 0],
  ] as const)
    assert.equal(inputNumber(text), n, text);
  for (const v of ["1,2,3", "abc", "1.2.3", "-", "."])
    assert.ok(Number.isNaN(inputNumber(v)), v);
});
test("invoice preview agrees with server rounding for mixed IVA, fractional quantities and both discount formats", () => {
  let checked = 0;
  for (const tax of [0, 5, 7, 14])
    for (const percent of ["", "0", "10,50", "33,33", "100"]) {
      const lines = [
        {
          descricao: "A",
          quantidade: 2.5,
          precoUnitario: 1250.5,
          ivaIsento: false,
        },
        { descricao: "B", quantidade: 1, precoUnitario: 250, ivaIsento: true },
        {
          descricao: "C",
          quantidade: 0.000001,
          precoUnitario: 100,
          ivaIsento: false,
        },
      ];
      const preview = invoicePreview(lines, tax, percent, "");
      assert.equal(preview.error, "");
      const server = totals({
        tipoDocumento: "factura",
        linhas: lines,
        ivaTaxa: tax,
        desconto: inputNumber(percent),
      });
      for (const k of ["subtotalSemIva", "totalIva", "total"] as const)
        assert.equal(preview[k], server[k]);
      checked++;
    }
  for (const fixed of ["125,50", "1.250,50"]) {
    const lines = [
      {
        descricao: "A",
        quantidade: 3,
        precoUnitario: 1234.56,
        ivaIsento: false,
      },
      { descricao: "B", quantidade: 1, precoUnitario: 250, ivaIsento: true },
    ];
    const p = invoicePreview(lines, 14, "", fixed),
      s = totals({
        tipoDocumento: "pro-forma",
        linhas: lines,
        ivaTaxa: 14,
        desconto: 0,
        descontoValor: inputNumber(fixed),
      });
    assert.equal(p.error, "");
    assert.equal(p.total, s.total);
    checked++;
  }
  assert.equal(checked, 22);
});
test("invalid discounts give a specific correction without showing a negative total", () => {
  const lines = [
    { descricao: "A", quantidade: 1, precoUnitario: 100, ivaIsento: false },
  ];
  assert.match(invoicePreview(lines, 14, "200", "").error, /percentual/);
  assert.match(invoicePreview(lines, 14, "", "101").error, /ultrapassar/);
  assert.match(invoicePreview(lines, 19, "", "").error, /IVA/);
  assert.match(invoicePreview(lines, 14, "NaN", "").error, /percentual/);
  assert.equal(invoicePreview(lines, 14, "", "101").total, 0);
  assert.equal(invoicePreview(lines, 14, "", "10,50").error, "");
});

test("IVA: tax selection is explicit; invalid empty and fractional rates never become exemptions", () => {
  const line = { descricao: "Teste", quantidade: 1, precoUnitario: 100, ivaIsento: false };
  for (const rate of [0, 5, 7, 14]) {
    assert.equal(parseIvaRate(rate), rate);
    assert.equal(parseIvaRate(String(rate) + "%"), rate);
    assert.equal(parseIvaRate(String(rate) + ",0"), rate);
    assert.equal(totals({ tipoDocumento: "factura", linhas: [line], ivaTaxa: rate }).total, 100 + rate);
  }
  for (const invalid of [null, undefined, "", " ", "abc", "19", 1, "1%", "14,5", "0,5", NaN, Infinity, {}, "0/14"]) {
    assert.throws(() => parseIvaRate(invalid), /IVA inválida/);
    assert.throws(() => totals({ tipoDocumento: "factura", linhas: [line], ivaTaxa: invalid }), /IVA inválida/);
    assert.match(invoicePreview([line], invalid, "", "").error, /IVA/);
  }
  const exempt = totals({ tipoDocumento: "factura", linhas: [{ ...line, ivaIsento: true }], ivaTaxa: 14 });
  assert.equal(exempt.totalIva, 0);
  assert.equal(exempt.total, 100);
  const zero = totals({ tipoDocumento: "factura", linhas: [line], ivaTaxa: 0 });
  assert.equal(zero.totalIva, 0);
  assert.equal(zero.linhas[0].ivaIsento, false, "Taxa 0% não atribui automaticamente isenção legal");
});

test("internal print references are deterministic, privacy limited and contain valid Code128 start and stop symbols", () => {
  const f: any = {
    id: 123,
    numero: "FT TEST2026A/5",
    tipoDocumento: "factura",
    ambiente: "homologacao",
    clienteNome: "Paciente confidencial",
    clienteNif: "5001234567",
  };
  const payload = JSON.parse(qrPayload(f));
  assert.equal(payload.ref, "NV1-123");
  assert.equal(payload.ambiente, "formacao");
  assert.equal(payload.documento, f.numero);
  assert.ok(!JSON.stringify(payload).includes(f.clienteNome));
  assert.ok(!JSON.stringify(payload).includes(f.clienteNif));
  const bits = code128Bits(payload.ref);
  assert.ok(bits.startsWith("11010010000"));
  assert.ok(bits.endsWith("1100011101011"));
  assert.equal(bits.length, (7 + 3) * 11 + 2);
  assert.throws(() => code128Bits("é"));
});

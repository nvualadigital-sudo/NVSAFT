import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../artifacts/lab-results/src/modules/faturacao/utils/printTemplate";
const f: any = {
  id: 1,
  numero: "FT TEST/1",
  data: "28/10/2026",
  horaOperacao: "12:00",
  dataVencimento: "28/10/2026",
  tipoDocumento: "factura",
  estado: "emitida",
  clienteNome: "<script>alert(1)</script>",
  clienteNif: "5001234567",
  ambiente: "homologacao",
  managed: "nvuala-v1",
  observacoes: "<img src=x onerror=alert(1)>",
  linhas: [
    {
      descricao: "Serviço & material",
      quantidade: 1,
      precoUnitario: 100,
      baseLiquida: 90,
      ivaIsento: false,
    },
  ],
  subtotalSemIva: 90,
  totalIva: 12.6,
  total: 102.6,
  ivaTaxa: 14,
  desconto: 10,
};
const c: any = {
  nomeClinica: 'Clínica "Teste"',
  nif: "5001234567",
  endereco: "Luanda",
  telefone: "",
  email: "",
  configuracaoFiscal: { softwareVersao: "2026.10" },
};
test("A4/thermal templates escape user values, retain fiscal fields and label training", () => {
  for (const format of ["a4", "58mm", "80mm"]) {
    const html = render(f, c, format, "ORIGINAL");
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img src=x"));
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /SEM VALIDADE FISCAL/);
    assert.match(html, /ARQUIVO DO FORNECEDOR/);
    assert.match(html, /CIRCULAÇÃO/);
    assert.match(html, /FT TEST\/1/);
    assert.equal((html.match(/<section/g) || []).length, 3);
  }
});
test("reprints and proformas cannot be labelled a fresh fiscal original", () => {
  const copy = render(f, c, "a4", "2.ª via, em conformidade com a original");
  assert.equal((copy.match(/<section/g) || []).length, 1);
  assert.match(copy, /2.ª via, em conformidade com a original/);
  const draft = render({ ...f, estado: "rascunho" }, c, "a4", "ORIGINAL");
  assert.match(draft, /RASCUNHO/);
  assert.equal((draft.match(/<section/g) || []).length, 1);
});

test("training print names missing taxpayer and exemption data explicitly without claiming a fiscal identity", () => {
  for (const format of ["a4", "58mm", "80mm"]) {
    const html = render(
      {
        ...f,
        ivaTaxa: 0,
        linhas: [{ ...f.linhas[0], ivaIsento: true }],
        motivoIsencao: "",
      } as any,
      { ...c, nif: "", configuracaoFiscal: {} } as any,
      format,
      "ORIGINAL",
    );
    assert.match(html, /SEM VALIDADE FISCAL/);
    assert.match(html, /Não configurado — documento de formação/);
    assert.match(html, /enquadramento fiscal por validar/);
    assert.ok(!html.includes("NIF: 999999999"));
  }
});

test("training invoice and proforma print QR and Code128 locally in A4 and thermal layouts", () => {
  for (const format of ["a4", "58mm", "80mm"])
    for (const type of ["factura", "pro-forma"]) {
      const html = render({ ...f, tipoDocumento: type }, c, format, "ORIGINAL");
      assert.match(html, /class="document-qr"/);
      assert.match(html, /class="document-barcode"/);
      assert.match(html, /NV1-1/);
      assert.match(html, /Não é código fiscal AGT/);
      assert.ok(!html.includes("https://"));
      assert.ok(!html.includes("<script"));
    }
});

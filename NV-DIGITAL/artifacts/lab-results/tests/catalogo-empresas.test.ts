import { test } from "node:test";
import assert from "node:assert/strict";
import { utils, write } from "xlsx";
import { gerarProdutosDosCatalogo } from "../src/utils/seedProdutos.ts";
import { parseKwanza, previewCatalogFile } from "../src/utils/catalogImport.ts";

test("catálogo comum nunca atribui preços nem activa produtos de uma nova empresa", () => {
  const produtos = gerarProdutosDosCatalogo();
  assert.ok(produtos.length > 100);
  assert.ok(produtos.every((p) => p.preco === 0 && p.ativo === false));
});

test("parser respeita formatos angolanos de preços", () => {
  assert.equal(parseKwanza("20.000,00 Kz"), 20000);
  assert.equal(parseKwanza("20.000 Kz"), 20000);
  assert.equal(parseKwanza("12500"), 12500);
  assert.equal(parseKwanza("12.500,75 AOA"), 12500.75);
  assert.equal(parseKwanza("gratuito"), null);
});

test("pré-visualização Excel mantém valores editáveis sem activar por defeito", async () => {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet([
    ["Código", "Exame", "Preço", "Categoria"],
    ["HEM-1", "Hemograma Completo", "8.500,00 Kz", "Hematologia"],
    ["BIO-2", "Glicemia em Jejum", "2.000 Kz", "Bioquímica"],
  ]), "Tabela");
  const bytes = write(wb, { bookType: "xlsx", type: "array" });
  const file = new File([bytes], "precos.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const result = await previewCatalogFile(file);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((r) => r.preco), [8500, 2000]);
  assert.deepEqual(result.rows.map((r) => r.codigo), ["HEM-1", "BIO-2"]);
  assert.ok(result.rows.every((r) => r.ativo === false));
});

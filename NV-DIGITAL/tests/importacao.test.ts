import test from "node:test";
import assert from "node:assert/strict";
import { parseCadastro } from "../artifacts/lab-results/src/utils/lerCadastro";
test("document import uses actual CSV/JSON values and never fabricates a patient, price or stock", () => {
  const person = parseCadastro(
    '{"nome":"Pessoa fictícia de teste","bi":"DOC-TESTE"}',
    "cliente",
  );
  assert.equal(person.nome, "Pessoa fictícia de teste");
  assert.equal(person.bi, "DOC-TESTE");
  assert.equal(person.dataNascimento, "");
  const product = parseCadastro(
    'nome;codigo;preco;stock\n"Produto de teste";COD-TESTE;12,50;7',
    "produto",
  );
  assert.equal(product.preco, 12.5);
  assert.equal(product.stock, 7);
  assert.equal(product.codigo, "COD-TESTE");
  assert.throws(() => parseCadastro("conteudo-cifrado-sem-campos", "cliente"));
  assert.throws(() => parseCadastro('{"nome":"Produto sem preço"}', "produto"));
  assert.throws(() =>
    parseCadastro("nome,codigo,preco\nProduto,COD,-1", "produto"),
  );
  assert.throws(() => parseCadastro('[{"nome":"A"},{"nome":"B"}]', "cliente"));
  const quoted = parseCadastro('nome,bi\n"Pessoa, de teste",TESTE', "cliente");
  assert.equal(quoted.nome, "Pessoa, de teste");
});

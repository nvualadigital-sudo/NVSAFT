import assert from "node:assert/strict";
import test from "node:test";
import { POS_SECTORS, posCategories, productSector } from "../artifacts/lab-results/src/modules/faturacao/utils/posCatalog";
import type { Produto } from "../artifacts/lab-results/src/modules/faturacao/types";

const make = (id: number, categoria: string, nome: string, ativo = true): Produto => ({
  id, categoria, nome, codigo: `SKU-${id}`, preco: 100, stock: 10,
  stockMinimo: 0, unidadeMedida: "un", ivaIsento: false, ativo,
});

test("o catálogo POS usa apenas os dois sectores pedidos", () => {
  assert.deepEqual(POS_SECTORS, ["Todos", "Comércio (EXAMES-LAB)", "Farmácia"]);
});

test("exame hospitalar e serviço clínico não são confundidos com farmácia", () => {
  const exame = make(1, "Exames laboratoriais", "Exame de saúde hospitalar");
  const consulta = make(2, "Consultas", "Consulta médica e medicamentos");
  assert.equal(productSector(exame), "Comércio (EXAMES-LAB)");
  assert.equal(productSector(consulta), "Comércio (EXAMES-LAB)");
  assert.equal(productSector(make(3, "Medicamentos", "Paracetamol")), "Farmácia");
  assert.equal(productSector(make(4, "Produtos farmacêuticos", "Soro")), "Farmácia");
});

test("as categorias aparecem do catálogo real, sem incluir itens inactivos", () => {
  const products = [
    make(1, "Exames laboratoriais", "Hemograma"),
    make(2, "Exames laboratoriais", "Glicemia"),
    make(3, "Consultas", "Geral"),
    make(4, "Medicamentos", "Paracetamol"),
    make(5, "Restaurante", "Refeição", false),
  ];
  assert.deepEqual(posCategories(products, "Comércio (EXAMES-LAB)"), ["Consultas", "Exames laboratoriais"]);
  assert.deepEqual(posCategories(products, "Farmácia"), ["Medicamentos"]);
  assert.deepEqual(posCategories(products, "Todos"), ["Consultas", "Exames laboratoriais", "Medicamentos"]);
});

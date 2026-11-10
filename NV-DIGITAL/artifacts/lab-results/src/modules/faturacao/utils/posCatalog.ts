import type { Produto } from "../types";

/** Sectores operacionais da instituição; categorias são as do catálogo real. */
export type PosSector = "Comércio (EXAMES-LAB)" | "Farmácia";
export type PosSectorFilter = "Todos" | PosSector;

export const POS_SECTORS: readonly PosSectorFilter[] = [
  "Todos",
  "Comércio (EXAMES-LAB)",
  "Farmácia",
];

function normalizar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * O nome/descrição do artigo não determina o sector: "exame de saúde" ou
 * "consulta hospitalar" não são medicamentos. A categoria é definida pela
 * própria instituição ao cadastrar o produto.
 */
export function productSector(product: Pick<Produto, "categoria">): PosSector {
  const category = normalizar(product.categoria || "");
  if (/\b(farmacia|farmaceutic[oa]s?|medicamentos?|farmacos?|medicinas?)\b/.test(category)) {
    return "Farmácia";
  }
  return "Comércio (EXAMES-LAB)";
}

/** Sem categorias fixas: apenas as categorias que realmente têm artigos activos. */
export function posCategories(
  products: readonly Produto[],
  sector: PosSectorFilter,
): string[] {
  const seen = new Map<string, string>();
  for (const product of products) {
    if (!product.ativo || (sector !== "Todos" && productSector(product) !== sector)) continue;
    const value = (product.categoria || "").trim();
    if (value && !seen.has(normalizar(value))) seen.set(normalizar(value), value);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt"));
}

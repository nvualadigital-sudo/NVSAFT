/** Paginação apenas da interface: a pesquisa e os totais continuam a considerar todos os documentos. */
export const INVOICE_PAGE_SIZE = 40;

export function paginateInvoices<T>(items: readonly T[], requestedPage: number, pageSize = INVOICE_PAGE_SIZE) {
  const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : INVOICE_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(items.length / safeSize));
  const requested = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1;
  const page = Math.min(Math.max(requested, 1), pages);
  const offset = (page - 1) * safeSize;
  return {
    page,
    pages,
    total: items.length,
    start: items.length ? offset + 1 : 0,
    end: Math.min(items.length, offset + safeSize),
    items: items.slice(offset, offset + safeSize),
  };
}

type CreditDocument = { tipoDocumento: string; documentoOrigem?: string; estado: string };

/** Evita procurar todas as notas de crédito repetidamente por cada linha do histórico. */
export function creditedDocumentNumbers(documents: readonly CreditDocument[]) {
  const numbers = new Set<string>();
  for (const doc of documents) {
    if (doc.tipoDocumento === "nota-credito" && doc.estado !== "anulada" && doc.documentoOrigem) {
      numbers.add(doc.documentoOrigem);
    }
  }
  return numbers;
}

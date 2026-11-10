import { check, cents, localStamp } from "../billing-engine.js";
import { isoDate, type Profile, type Rule } from "./wire.js";
import type { Producer } from "./runtime.js";
const esc = (v: any) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const el = (n: string, v: any) => `<${n}>${esc(v)}</${n}>`;
const block = (n: string, v: string) => `<${n}>${v}</${n}>`;
const money = (v: any) => Math.abs(Number(v)).toFixed(2);
const sum = (rows: any[], fn: (r: any) => number) =>
  (rows.reduce((n, r) => n + fn(r), 0) / 100).toFixed(2);
export function exportSaft(
  all: any[],
  company: { nif: string; name: string },
  p: Profile,
  producer: Producer,
  start: any,
  end: any,
) {
  const startDate = isoDate(start),
    endDate = isoDate(end);
  check(
    startDate <= endDate && startDate.slice(0, 4) === endDate.slice(0, 4),
    "O SAF-T exige um período válido dentro do mesmo ano fiscal.",
  );
  check(
    company.name &&
      /^[A-Za-z0-9]{10,15}$/.test(company.nif) &&
      company.nif !== "999999999" &&
      p.companyId &&
      p.address &&
      p.city,
    "Complete a razão social, NIF, registo comercial, morada e cidade do emitente.",
  );
  check(
    producer.legalName && /^[A-Za-z0-9]{10,15}$/.test(producer.nif),
    "Complete a identificação legal verdadeira do produtor.",
  );
  const rows = all.filter((row) => {
    if (row.billing_meta?.pharmacyPosTraining) return false;
    if (
      row.estado === "rascunho" &&
      !(
        row.tipo_documento === "pro-forma" &&
        row.billing_meta?.proformaFinalizada
      )
    )
      return false;
    const date = isoDate(row.data);
    return date >= startDate && date <= endDate;
  });
  check(
    rows.length > 0 && rows.length <= 20000,
    "O período deve conter entre 1 e 20.000 documentos finalizados.",
  );
  check(
    rows.every((r) => r.billing_meta?.ambiente === "homologacao"),
    "Esta exportação é exclusiva da formação/homologação. O arquivo de produção requer um circuito certificado próprio.",
  );
  check(
    !rows.some(
      (row) => row.agt_has_replacement || row.billing_meta?.agtCorrection,
    ),
    "O período contém uma substituição AGT. Confirme com a AGT o tratamento no SAF-T antes de exportar este período; a factura original não foi declarada anulada.",
  );
  const warnings: string[] = [
    "ENSAIO / HOMOLOGAÇÃO — SEM VALIDADE FISCAL. Validação XSD não é aprovação da AGT.",
    "Âmbito: facturação; não inclui contabilidade geral nem inventário.",
  ];
  if (
    !/^(?:\d+\/AGT\/\d{4}|0)$/.test(
      producer.saftValidationNumber || producer.softwareValidationNumber || "",
    )
  )
    warnings.push(
      "O número de certificação FE não foi convertido num certificado SAF-T legado. O campo SoftwareValidationNumber usa 0 neste ficheiro de ensaio; confirme o formato e o XSD com a AGT.",
    );
  const address = (detail: string, city: string, postal = "") =>
    el("AddressDetail", detail) +
    el("City", city) +
    (postal ? el("PostalCode", postal) : "") +
    el("Country", "AO");
  const header = block(
    "Header",
    el("AuditFileVersion", "1.01_01") +
      el("CompanyID", p.companyId) +
      el("TaxRegistrationNumber", company.nif) +
      el("TaxAccountingBasis", "F") +
      el("CompanyName", company.name) +
      block("CompanyAddress", address(p.address, p.city, p.postalCode)) +
      el("FiscalYear", startDate.slice(0, 4)) +
      el("StartDate", startDate) +
      el("EndDate", endDate) +
      el("CurrencyCode", "AOA") +
      el("DateCreated", localStamp().iso) +
      el("TaxEntity", "Global") +
      el("ProductCompanyTaxID", producer.nif) +
      el(
        "SoftwareValidationNumber",
        /^(?:\d+\/AGT\/\d{4}|0)$/.test(
          producer.saftValidationNumber ||
            producer.softwareValidationNumber ||
            "",
        )
          ? producer.saftValidationNumber || producer.softwareValidationNumber
          : "0",
      ) +
      el("ProductID", producer.productId + "/" + producer.legalName) +
      el("ProductVersion", producer.productVersion) +
      el("HeaderComment", "ENSAIO / HOMOLOGAÇÃO — SEM VALIDADE FISCAL"),
  );
  const customers = new Map<string, any>(),
    products = new Map<string, any>(),
    taxes = new Map<string, any>();
  const customerId = (r: any) =>
    r.paciente_id
      ? "PAC" + r.paciente_id
      : r.cliente_nif
        ? "NIF" + r.cliente_nif
        : "FINAL";
  function ruleFor(r: any, l: any): Rule {
    const rule =
      r.billing_meta?.agtProfile?.taxRules?.[l.codigo] || p.taxRules[l.codigo];
    check(
      rule,
      "Falta o enquadramento fiscal do artigo " +
        String(l.codigo || "sem código") +
        ".",
    );
    check(
      l.codigo && l.descricao && l.unidade,
      "Há linhas sem código, descrição ou unidade.",
    );
    if (l.ivaIsento)
      check(
        rule.taxCode === "ISE" &&
          rule.exemptionCode &&
          rule.exemptionReason?.length >= 6,
        "A linha isenta exige código e fundamento legal completo.",
      );
    else check(rule.taxCode !== "ISE", "Enquadramento de IVA inconsistente.");
    return rule;
  }
  for (const row of rows) {
    customers.set(customerId(row), row);
    if (row.tipo_documento === "recibo") continue;
    for (const line of row.linhas) {
      const rule = ruleFor(row, line);
      products.set(line.codigo, { line, rule });
      const rate = line.ivaIsento ? 0 : Number(row.iva_taxa);
      taxes.set(rule.taxCode + "-" + rate, { rule, rate });
    }
  }
  const masters = block(
    "MasterFiles",
    Array.from(customers, ([id, r]) =>
      block(
        "Customer",
        el("CustomerID", id) +
          el("AccountID", "Desconhecido") +
          el("CustomerTaxID", r.cliente_nif || "999999999") +
          el("CompanyName", r.cliente_nome) +
          block(
            "BillingAddress",
            address(r.cliente_endereco || "Desconhecido", "Desconhecido"),
          ) +
          el("SelfBillingIndicator", 0),
      ),
    ).join("") +
      Array.from(products.values(), ({ line, rule }) =>
        block(
          "Product",
          el("ProductType", rule.productType) +
            el("ProductCode", line.codigo) +
            el("ProductDescription", line.descricao) +
            el("ProductNumberCode", line.codigo),
        ),
      ).join("") +
      block(
        "TaxTable",
        Array.from(taxes.values(), ({ rule, rate }) =>
          block(
            "TaxTableEntry",
            el("TaxType", "IVA") +
              el("TaxCountryRegion", "AO") +
              el("TaxCode", rule.taxCode) +
              el(
                "Description",
                rule.taxCode === "ISE"
                  ? rule.exemptionReason
                  : "IVA " + rate + "%",
              ) +
              el("TaxPercentage", rate),
          ),
        ).join(""),
      ),
  );
  const entry = (r: any) => {
    const date =
      r.billing_meta?.fiscalSaft?.entryDate ||
      r.billing_meta?.createdAt?.slice(0, 19);
    check(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date || ""),
      "Documento sem data de entrada válida.",
    );
    return date;
  };
  const hash = (r: any) => {
    const s = r.billing_meta?.fiscalSaft;
    if (s?.hash) {
      check(/^[A-Za-z0-9+/]{171}=$/.test(s.hash), "Assinatura SAF-T inválida.");
      return el("Hash", s.hash) + el("HashControl", s.keyVersion);
    }
    warnings.push(
      "Documento " +
        r.numero +
        " sem assinatura SAF-T original: exportado com Hash=0 e HashControl=0; não foi assinado retroactivamente.",
    );
    return el("Hash", "0") + el("HashControl", "0");
  };
  const netOf = (r: any) =>
    r.tipo_documento === "recibo"
      ? (r.billing_meta?.fiscalReceipt?.netTotal ?? r.subtotal_sem_iva)
      : r.subtotal_sem_iva;
  const taxOf = (r: any) =>
    r.tipo_documento === "recibo"
      ? (r.billing_meta?.fiscalReceipt?.taxPayable ?? r.total_iva)
      : r.total_iva;
  const total = (r: any) =>
    block(
      "DocumentTotals",
      el("TaxPayable", money(taxOf(r))) +
        el("NetTotal", money(netOf(r))) +
        el("GrossTotal", money(r.total)),
    );
  const lines = (r: any, work = false) =>
    r.linhas
      .map((l: any, i: number) => {
        const rule = ruleFor(r, l),
          date = isoDate(r.data),
          base = Math.abs(cents(l.baseLiquida));
        const refs =
          r.tipo_documento === "nota-credito"
            ? block(
                "References",
                el("Reference", r.billing_meta.documentoOrigem) +
                  el(
                    "Reason",
                    r.billing_meta.motivoAnulacaoOuCredito || "Nota de crédito",
                  ),
              )
            : "";
        const tax = block(
          "Tax",
          el("TaxType", "IVA") +
            el("TaxCountryRegion", "AO") +
            el("TaxCode", rule.taxCode) +
            el("TaxPercentage", l.ivaIsento ? 0 : r.iva_taxa),
        );
        return block(
          "Line",
          el("LineNumber", i + 1) +
            el("ProductCode", l.codigo) +
            el("ProductDescription", l.descricao) +
            el("Quantity", Math.abs(l.quantidade)) +
            el("UnitOfMeasure", l.unidade) +
            el("UnitPrice", money(l.precoUnitario)) +
            el("TaxPointDate", date) +
            (work ? "" : refs) +
            el("Description", l.descricao) +
            (work ? refs : "") +
            el(
              r.tipo_documento === "nota-credito"
                ? "DebitAmount"
                : "CreditAmount",
              (base / 100).toFixed(2),
            ) +
            tax +
            (l.ivaIsento
              ? el("TaxExemptionReason", rule.exemptionReason) +
                el("TaxExemptionCode", rule.exemptionCode)
              : "") +
            el(
              "SettlementAmount",
              Math.max(
                0,
                Math.abs(l.quantidade) * l.precoUnitario - base / 100,
              ).toFixed(2),
            ),
        );
      })
      .join("");
  const sales = rows.filter((r) =>
      ["factura", "factura-recibo", "factura-global", "nota-credito"].includes(
        r.tipo_documento,
      ),
    ),
    work = rows.filter((r) => r.tipo_documento === "pro-forma"),
    receipts = rows.filter((r) => r.tipo_documento === "recibo");
  check(
    sales.length + work.length + receipts.length === rows.length,
    "Há tipos documentais sem mapeamento SAF-T.",
  );
  const counts = (list: any[], receipt = false) =>
    el("NumberOfEntries", list.length) +
    el(
      "TotalDebit",
      sum(list, (r) =>
        r.estado === "anulada"
          ? 0
          : r.tipo_documento === "nota-credito"
            ? Math.abs(cents(netOf(r)))
            : 0,
      ),
    ) +
    el(
      "TotalCredit",
      sum(list, (r) =>
        r.estado === "anulada" || r.tipo_documento === "nota-credito"
          ? 0
          : Math.abs(cents(netOf(r))),
      ),
    );
  const salesXml = sales.length
    ? block(
        "SalesInvoices",
        counts(sales) +
          sales
            .map((r) =>
              block(
                "Invoice",
                el("InvoiceNo", r.numero) +
                  block(
                    "DocumentStatus",
                    el("InvoiceStatus", r.estado === "anulada" ? "A" : "N") +
                      el("InvoiceStatusDate", entry(r)) +
                      el("SourceID", r.emitido_por) +
                      el("SourceBilling", "P"),
                  ) +
                  hash(r) +
                  el("InvoiceDate", isoDate(r.data)) +
                  el("InvoiceType", docTypesForSaft(r.tipo_documento)) +
                  block(
                    "SpecialRegimes",
                    el("SelfBillingIndicator", 0) +
                      el("CashVATSchemeIndicator", 0) +
                      el("ThirdPartiesBillingIndicator", 0),
                  ) +
                  el("SourceID", r.emitido_por) +
                  el("SystemEntryDate", entry(r)) +
                  el("CustomerID", customerId(r)) +
                  lines(r) +
                  total(r),
              ),
            )
            .join(""),
      )
    : "";
  const workXml = work.length
    ? block(
        "WorkingDocuments",
        counts(work) +
          work
            .map((r) =>
              block(
                "WorkDocument",
                el("DocumentNumber", r.numero) +
                  block(
                    "DocumentStatus",
                    el("WorkStatus", r.estado === "anulada" ? "A" : "N") +
                      el("WorkStatusDate", entry(r)) +
                      el("SourceID", r.emitido_por) +
                      el("SourceBilling", "P"),
                  ) +
                  hash(r) +
                  el("WorkDate", isoDate(r.data)) +
                  el("WorkType", "PF") +
                  el("SourceID", r.emitido_por) +
                  el("SystemEntryDate", entry(r)) +
                  el("CustomerID", customerId(r)) +
                  lines(r, true) +
                  total(r),
              ),
            )
            .join(""),
      )
    : "";
  const paymentXml = receipts.length
    ? block(
        "Payments",
        counts(receipts, true) +
          receipts
            .map((r) => {
              const o = all.find(
                (o) =>
                  o.numero === r.billing_meta?.documentoOrigem &&
                  o.empresa_id === r.empresa_id,
              );
              check(o, "Recibo sem documento de origem na empresa.");
              if (!r.billing_meta?.fiscalReceipt && Number(o.total_iva) !== 0)
                throw new Error(
                  "Recibo antigo sem repartição fiscal congelada. Não será recalculado para exportação; seleccione um período com recibos novos.",
                );
              return block(
                "Payment",
                el("PaymentRefNo", r.numero) +
                  el("TransactionDate", isoDate(r.data)) +
                  el("PaymentType", "RC") +
                  block(
                    "DocumentStatus",
                    el("PaymentStatus", r.estado === "anulada" ? "A" : "N") +
                      el("PaymentStatusDate", entry(r)) +
                      el("SourceID", r.emitido_por) +
                      el("SourcePayment", "P"),
                  ) +
                  el("SourceID", r.emitido_por) +
                  el("SystemEntryDate", entry(r)) +
                  el("CustomerID", customerId(r)) +
                  block(
                    "Line",
                    el("LineNumber", 1) +
                      block(
                        "SourceDocumentID",
                        el("OriginatingON", o.numero) +
                          el("InvoiceDate", isoDate(o.data)),
                      ) +
                      el("CreditAmount", money(netOf(r))),
                  ) +
                  total(r),
              );
            })
            .join(""),
      )
    : "";
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01">' +
    header +
    masters +
    block("SourceDocuments", salesXml + workXml + paymentXml) +
    "</AuditFile>\n";
  return {
    xml,
    count: rows.length,
    fileName: `SAFT_AO_HOMOLOGACAO_${startDate}_${endDate}.xml`,
    warnings,
  };
}
function docTypesForSaft(type: string) {
  return (
    {
      factura: "FT",
      "factura-recibo": "FR",
      "factura-global": "FG",
      "nota-credito": "NC",
    } as Record<string, string>
  )[type];
}

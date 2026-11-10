import { randomUUID } from "node:crypto";
import { check, cents } from "../billing-engine.js";
import { jws } from "./crypto.js";
import { certificateReady, type Runtime } from "./runtime.js";
export const docTypes: Record<string, string> = {
  factura: "FT",
  "factura-recibo": "FR",
  "factura-global": "FG",
  "nota-credito": "NC",
  recibo: "RG",
};
export type Rule = {
  operationType: string;
  taxCode: string;
  exemptionCode?: string;
  exemptionReason?: string;
  productType: string;
};
export type Profile = {
  enabled: boolean;
  companyId: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  taxRules: Record<string, Rule>;
  series: Record<string, string>;
};
export const emptyProfile: Profile = {
  enabled: false,
  companyId: "",
  address: "",
  city: "",
  postalCode: "",
  country: "AO",
  taxRules: {},
  series: {},
};
export function validateProfile(v: any): Profile {
  check(
    v && typeof v === "object" && !Array.isArray(v),
    "Perfil fiscal inválido.",
  );
  const p: Profile = {
    ...emptyProfile,
    taxRules: {},
    series: {},
    enabled: v.enabled === true,
  };
  for (const k of ["companyId", "address", "city", "postalCode"] as const) {
    check(
      typeof v[k] === "string" && v[k].length <= 200,
      "Identificação fiscal inválida.",
    );
    p[k] = v[k].trim();
  }
  check(
    v.country === "AO",
    "Este conector suporta emitentes estabelecidos em Angola.",
  );
  check(
    v.taxRules &&
      typeof v.taxRules === "object" &&
      !Array.isArray(v.taxRules) &&
      Object.keys(v.taxRules).length <= 3000,
    "Regras fiscais inválidas.",
  );
  for (const [code, r] of Object.entries(v.taxRules) as [string, any][]) {
    check(
      !["__proto__", "constructor", "prototype"].includes(code) &&
        code.length > 0 &&
        code.length <= 80 &&
        r &&
        [
          "SS",
          "SE",
          "STP",
          "SR",
          "SIF",
          "SHS",
          "ST",
          "SG",
          "AS",
          "TB",
          "QT",
          "RD",
        ].includes(r.operationType) &&
        ["NOR", "INT", "RED", "ISE", "OUT"].includes(r.taxCode) &&
        ["P", "S", "O"].includes(r.productType),
      "Código de artigo, operação ou imposto inválido.",
    );
    const rule: Rule = {
      operationType: r.operationType,
      taxCode: r.taxCode,
      productType: r.productType,
    };
    if (r.taxCode === "ISE") {
      check(
        /^[A-Za-z0-9]{3}$/.test(r.exemptionCode || "") &&
          typeof r.exemptionReason === "string" &&
          r.exemptionReason.trim().length >= 6 &&
          r.exemptionReason.length <= 60,
        "A isenção exige código de 3 caracteres e norma legal (até 60 caracteres).",
      );
      rule.exemptionCode = r.exemptionCode;
      rule.exemptionReason = r.exemptionReason.trim();
    }
    p.taxRules[code] = rule;
  }
  check(
    v.series && typeof v.series === "object" && !Array.isArray(v.series),
    "Selecção de séries inválida.",
  );
  for (const [type, code] of Object.entries(v.series)) {
    check(
      Object.values(docTypes).includes(type) &&
        typeof code === "string" &&
        /^[A-Za-z0-9_-]{3,45}$/.test(code),
      "Série inválida.",
    );
    p.series[type] = code as string;
  }
  if (p.enabled)
    check(
      p.companyId && p.address && p.city && Object.keys(p.series).length,
      "Complete o registo comercial, morada, cidade e pelo menos uma série confirmada.",
    );
  return p;
}
export function isoDate(value: any) {
  const s = String(value || ""),
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const v = m ? `${m[3]}-${m[2]}-${m[1]}` : s;
  check(
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
    "Data fiscal inválida.",
  );
  return v;
}
export function softwareInfo(r: Runtime) {
  check(
    certificateReady(r.producer),
    "Indique o número real de certificação/registo atribuído pela AGT para homologação; não invente um número.",
  );
  const d = {
    productId: r.producer.productId,
    productVersion: r.producer.productVersion,
    softwareValidationNumber: r.producer.softwareValidationNumber,
    signatureVersion: r.producer.signatureVersion,
  };
  return { softwareInfoDetail: d, jwsSoftwareSignature: jws(d, r.producerKey) };
}
export function baseRequest(nif: string, r: Runtime) {
  check(
    /^[A-Za-z0-9]{8,15}$/.test(nif) && nif !== "999999999",
    "Configure o NIF verdadeiro do emitente.",
  );
  return {
    schemaVersion: "2.0",
    taxRegistrationNumber: nif,
    submissionTimeStamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    softwareInfo: softwareInfo(r),
  };
}
export function unitPriceForLine(
  baseCents: number,
  quantity: number,
  debit = false,
) {
  const q = BigInt(Math.round(Math.abs(quantity) * 1e6));
  check(
    q > 0n && Number.isSafeInteger(baseCents) && baseCents >= 0,
    "Quantidade ou base inválida.",
  );
  const numerator = BigInt(baseCents) * 100000000000000n;
  const units = debit ? numerator / q : (numerator + q - 1n) / q;
  const price = Number(units) / 1e10;
  // Confirmar a representação decimal que efectivamente segue no JSON.
  const [coefficient, exponent = "0"] = String(price).toLowerCase().split("e");
  const decimals = coefficient.split(".")[1]?.length || 0,
    power = Number(exponent) - decimals;
  let n = BigInt(coefficient.replace(".", "")),
    d = 1n;
  if (power >= 0) n *= 10n ** BigInt(power);
  else d = 10n ** BigInt(-power);
  const raw = n * q * 100n,
    den = d * 1000000n,
    computed = debit ? (raw + den - 1n) / den : raw / den;
  check(
    computed === BigInt(baseCents),
    "Não foi possível representar o preço líquido sem perder cêntimos. Reveja a quantidade/preço num novo documento de ensaio.",
  );
  return price;
}
/** A local support report only. Never use this structure as a FE payload. */
export function partialReceiptDiagnostic(row: any, origin: any) {
  const m = row?.billing_meta,
    allocation = m?.fiscalReceipt;
  check(
    row?.tipo_documento === "recibo" &&
      row.estado === "paga" &&
      m?.agtMode === "homologacao_oficial" &&
      origin?.empresa_id === row.empresa_id &&
      origin.billing_meta?.agtMode === "homologacao_oficial" &&
      m.documentoOrigem === origin.numero &&
      allocation?.originNo === origin.numero &&
      allocation.allocation === "proporcional-centimos",
    "Seleccione um recibo de homologação com factura de origem e valores congelados.",
  );
  const original = {
    grossTotal: Number(origin.total),
    netTotal: Number(origin.subtotal_sem_iva),
    taxPayable: Number(origin.total_iva),
  };
  const partial = {
    grossTotal: allocation.grossTotal,
    netTotal: allocation.netTotal,
    taxPayable: allocation.taxPayable,
  };
  check(
    cents(partial.grossTotal) === cents(row.total) &&
      cents(partial.grossTotal) > 0 &&
      cents(partial.grossTotal) < cents(original.grossTotal) &&
      [original, partial].every(
        (x) =>
          cents(x.netTotal) >= 0 &&
          cents(x.taxPayable) >= 0 &&
          cents(x.netTotal) + cents(x.taxPayable) === cents(x.grossTotal),
      ),
    "O recibo não é parcial ou os valores congelados não coincidem.",
  );
  return {
    finalidade: "DIAGNOSTICO_INTERNO_RECIBO_PARCIAL",
    ambiente: "homologacao",
    transmissivel: false,
    assinado: false,
    estado: "AGUARDA_ESCLARECIMENTO_AGT",
    moeda: "AOA",
    recibo: row.numero,
    origem: origin.numero,
    totaisOriginais: original,
    reparticaoLocalDoRecebimento: partial,
    aviso:
      "O registo local é válido para o ensaio. Confirme com a AGT quais os totais e bases a enviar no recibo parcial antes de preparar um pedido electrónico.",
  };
}
export function documentPayload(
  row: any,
  nif: string,
  p: Profile,
  r: Runtime,
  origin?: any,
) {
  const m = row.billing_meta || {},
    type = docTypes[row.tipo_documento];
  check(
    type &&
      row.estado !== "rascunho" &&
      row.estado !== "anulada" &&
      m.ambiente === "homologacao" &&
      m.agtMode === "homologacao_oficial",
    "Escolha um documento novo, emitido numa série de homologação confirmada pela AGT.",
  );
  check(
    m.agtProfile && m.agtProfile.taxRules,
    "Documento sem enquadramento fiscal congelado.",
  );
  const frozen = m.agtProfile as Profile;
  check(
    row.numero.startsWith(type + " " + row.serie + "/") &&
      /^[1-9]\d*$/.test(row.numero.split("/").at(-1)) &&
      row.numero.length <= 60,
    "Numeração fiscal inválida.",
  );
  check(
    row.emitente_snapshot?.nif === nif,
    "O NIF do documento difere do emitente actual.",
  );
  const totals = {
    taxPayable: Math.abs(Number(row.total_iva)),
    netTotal: Math.abs(Number(row.subtotal_sem_iva)),
    grossTotal: Math.abs(Number(row.total)),
  };
  check(
    cents(totals.netTotal) + cents(totals.taxPayable) ===
      cents(totals.grossTotal),
    "Totais inconsistentes no documento congelado.",
  );
  const d: any = {
    documentNo: row.numero,
    documentStatus: "N",
    documentType: type,
    documentDate: isoDate(row.data),
    systemEntryDate: m.createdAt?.replace(/\.\d{3}Z$/, "Z"),
    customerCountry: m.customerCountry || "AO",
    customerTaxID: row.cliente_nif || "999999999",
    companyName: row.cliente_nome,
    documentTotals: totals,
  };
  if (m.agtCorrection) {
    const previous = m.agtCorrection;
    check(
      type === "FT" &&
        Number.isSafeInteger(previous.invoiceId) &&
        previous.invoiceId > 0 &&
        previous.invoiceId < row.id &&
        typeof previous.documentNo === "string" &&
        /^FT .+\/[1-9]\d*$/.test(previous.documentNo) &&
        previous.documentNo.length <= 60 &&
        previous.documentNo !== row.numero,
      "O documento corrigido não possui uma referência anterior válida.",
    );
    d.documentStatus = "C";
    d.rejectedDocumentNo = previous.documentNo;
  }
  check(
    typeof d.companyName === "string" &&
      d.companyName.length > 0 &&
      d.companyName.length <= 200 &&
      typeof d.systemEntryDate === "string" &&
      !Number.isNaN(Date.parse(d.systemEntryDate)),
    "Identificação ou data do documento inválida.",
  );
  check(
    d.customerCountry === "AO",
    "Compradores estrangeiros exigem configuração de exportação ainda não suportada por este circuito.",
  );
  if (type === "RG") {
    check(
      origin &&
        origin.empresa_id === row.empresa_id &&
        m.documentoOrigem === origin.numero &&
        origin.billing_meta?.agtMode === "homologacao_oficial",
      "Recibo sem origem fiscal de homologação desta empresa.",
    );
    check(
      cents(row.total) === cents(origin.total),
      "O envio electrónico de recibos parciais fica bloqueado até confirmar com a AGT o cálculo dos totais de origem.",
    );
    d.documentTotals = {
      taxPayable: Math.abs(Number(origin.total_iva)),
      netTotal: Math.abs(Number(origin.subtotal_sem_iva)),
      grossTotal: Math.abs(Number(origin.total)),
    };
    d.paymentReceipt = {
      sourceDocuments: [
        {
          lineNo: 1,
          sourceDocumentID: {
            OriginatingON: origin.numero,
            documentDate: isoDate(origin.data),
          },
          creditAmount: Math.abs(Number(origin.subtotal_sem_iva)),
        },
      ],
    };
  } else {
    check(
      m.calculoFiscalAGT === true,
      "Documento anterior ao cálculo FE 2.0; não pode ser recalculado nem enviado retroactivamente.",
    );
    let net = 0,
      tax = 0;
    d.lines = row.linhas.map((l: any, i: number) => {
      const rule = frozen.taxRules[l.codigo];
      check(rule, "Configure a regra fiscal de cada artigo antes de emitir.");
      const base = Math.abs(cents(l.baseLiquida)),
        iva = Math.abs(cents(l.ivaValor));
      const rate = l.ivaIsento ? 0 : Number(row.iva_taxa);
      check(
        (l.ivaIsento && rule.taxCode === "ISE") ||
          (!l.ivaIsento && rule.taxCode !== "ISE" && rate > 0),
        "Taxa e enquadramento do artigo não coincidem.",
      );
      const standardRate = (
        { NOR: 14, INT: 7, RED: 5 } as Record<string, number>
      )[rule.taxCode];
      check(
        standardRate === undefined || standardRate === rate,
        "A taxa não coincide com o código IVA normal/intermédio/reduzido configurado.",
      );
      check(
        l.ivaIsento || iva === Math.ceil((base * rate) / 100),
        "O IVA da linha não segue o arredondamento FE 2.0.",
      );
      net += base;
      tax += iva;
      const taxes: any = {
        taxType: "IVA",
        taxCountryRegion: "AO",
        taxCode: rule.taxCode,
        taxPercentage: rate,
        taxContribution: iva / 100,
      };
      if (rule.taxCode === "ISE") {
        check(
          rule.exemptionCode && rule.exemptionReason,
          "Isenção sem código e norma legal.",
        );
        taxes.taxExemptionCode = rule.exemptionCode;
      }
      const line: any = {
        lineNumber: i + 1,
        operationType: rule.operationType,
        productCode: l.codigo,
        productDescription: l.descricao,
        quantity: Math.abs(l.quantidade),
        unitOfMeasure: l.unidade || "UN",
        unitPriceBase: l.precoUnitario,
        unitPrice: unitPriceForLine(
          base,
          Math.abs(l.quantidade),
          type === "NC",
        ),
        [type === "NC" ? "debitAmount" : "creditAmount"]: base / 100,
        taxes: [taxes],
        settlementAmount: Math.max(
          0,
          Number(
            (Math.abs(l.quantidade) * l.precoUnitario - base / 100).toFixed(2),
          ),
        ),
      };
      check(
        line.productCode &&
          line.productCode.length <= 60 &&
          line.productDescription &&
          line.productDescription.length <= 200 &&
          line.unitOfMeasure.length <= 20,
        "Código, descrição ou unidade excede os limites FE.",
      );
      if (type === "FG") line.operationDate = isoDate(m.dataOperacao);
      if (type === "NC") {
        check(
          origin &&
            origin.empresa_id === row.empresa_id &&
            origin.numero === m.documentoOrigem,
          "Nota de crédito sem origem desta empresa.",
        );
        line.referenceInfo = {
          reference: origin.numero,
          reason: String(m.motivoAnulacaoOuCredito || "").slice(0, 60),
        };
      }
      return line;
    });
    check(
      net === cents(totals.netTotal) && tax === cents(totals.taxPayable),
      "As linhas não coincidem com os totais congelados.",
    );
  }
  const signed = {
    documentNo: d.documentNo,
    taxRegistrationNumber: nif,
    documentType: d.documentType,
    documentDate: d.documentDate,
    customerTaxID: d.customerTaxID,
    customerCountry: d.customerCountry,
    companyName: d.companyName,
    documentTotals: d.documentTotals,
  };
  d.jwsDocumentSignature = jws(signed, r.issuerKey);
  return d;
}
export function registerPayload(
  rows: any[],
  nif: string,
  p: Profile,
  r: Runtime,
  origins: Map<string, any>,
) {
  check(
    rows.length >= 1 && rows.length <= 30,
    "Seleccione entre 1 e 30 documentos.",
  );
  return {
    ...baseRequest(nif, r),
    submissionUUID: randomUUID(),
    numberOfEntries: rows.length,
    documents: rows.map((row) =>
      documentPayload(
        row,
        nif,
        p,
        r,
        origins.get(row.billing_meta?.documentoOrigem),
      ),
    ),
  };
}
export const operations = [
  "registarFactura",
  "obterEstado",
  "consultarFactura",
  "solicitarSerie",
  "listarSeries",
  "listarFacturas",
  "validarDocumento",
] as const;
export function servicePayload(
  operation: string,
  input: any,
  nif: string,
  r: Runtime,
) {
  let fields: any;
  switch (operation) {
    case "obterEstado":
      check(
        /^\d{1,15}$/.test(input.requestID || ""),
        "Identificador AGT inválido.",
      );
      fields = { requestID: input.requestID };
      break;
    case "consultarFactura":
      check(
        typeof input.documentNo === "string" &&
          input.documentNo.length >= 8 &&
          input.documentNo.length <= 60,
        "Número de documento inválido.",
      );
      fields = { documentNo: input.documentNo };
      break;
    case "solicitarSerie":
      check(
        Object.values(docTypes).includes(input.documentType) &&
          Number.isInteger(input.seriesYear) &&
          input.seriesYear >= 2025 &&
          input.seriesYear <= new Date().getUTCFullYear() + 1 &&
          /^\d{1,5}$/.test(input.establishmentNumber || ""),
        "Tipo, ano ou estabelecimento inválido.",
      );
      fields = {
        seriesYear: input.seriesYear,
        documentType: input.documentType,
        establishmentNumber: input.establishmentNumber,
        seriesContingencyIndicator: "N",
      };
      break;
    case "listarSeries":
      fields = {};
      break;
    case "listarFacturas":
      fields = {
        queryStartDate: isoDate(input.queryStartDate),
        queryEndDate: isoDate(input.queryEndDate),
      };
      check(fields.queryStartDate <= fields.queryEndDate, "Período inválido.");
      break;
    case "validarDocumento": {
      check(
        ["C", "R"].includes(input.action) &&
          typeof input.documentNo === "string" &&
          input.documentNo.length >= 8 &&
          input.documentNo.length <= 60,
        "Acção ou documento inválido.",
      );
      fields = { documentNo: input.documentNo, action: input.action };
      if (input.action === "C") {
        check(
          ["AD", "ND", "LD"].includes(input.deductAllVAT),
          "Seleccione expressamente o regime de dedução do IVA.",
        );
        fields.deductAllVAT = input.deductAllVAT;
        if (input.deductAllVAT === "LD") {
          check(
            Array.isArray(input.deductibleVATLines) &&
              input.deductibleVATLines.length > 0 &&
              input.deductibleVATLines.length <= 500,
            "Indique as linhas com dedução de IVA.",
          );
          const seen = new Set<number>();
          fields.deductibleVATLines = input.deductibleVATLines.map((l: any) => {
            check(
              Number.isSafeInteger(l.lineNo) &&
                l.lineNo >= 1 &&
                !seen.has(l.lineNo) &&
                ["S", "N"].includes(l.deductLineVAT) &&
                (!l.applyProRata || ["S", "N"].includes(l.applyProRata)),
              "Linha de dedução inválida ou repetida.",
            );
            seen.add(l.lineNo);
            return {
              lineNo: l.lineNo,
              deductLineVAT: l.deductLineVAT,
              ...(l.applyProRata ? { applyProRata: l.applyProRata } : {}),
            };
          });
        }
      }
      break;
    }
    default:
      throw new Error("Serviço de homologação não permitido.");
  }
  return {
    ...baseRequest(nif, r),
    ...fields,
    jwsSignature: jws(
      operation === "validarDocumento"
        ? { taxRegistrationNumber: nif, documentNo: fields.documentNo }
        : { taxRegistrationNumber: nif, ...fields },
      r.issuerKey,
    ),
  };
}

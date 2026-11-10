import { cents, check } from "../billing-engine.js";
import { classifyState } from "./transport.js";

export type ReplacementProof = {
  invoiceId: number;
  documentNo: string;
  jobId: string;
  requestID: string;
  reason: string;
};

export function rejectionEvidence(row: any, jobs: any[]) {
  for (const j of jobs) {
    if (
      j.operation !== "registarFactura" ||
      !["parcial", "rejeitado"].includes(j.status) ||
      !Array.isArray(j.invoice_ids) ||
      !j.invoice_ids.includes(row.id) ||
      typeof j.agt_request_id !== "string" ||
      !/^\d{1,15}$/.test(j.agt_request_id) ||
      j.response?.httpStatus !== 200 ||
      !Array.isArray(j.payload?.documents) ||
      j.payload.taxRegistrationNumber !== row.emitente_snapshot?.nif ||
      !j.payload.documents.some((d: any) => d.documentNo === row.numero)
    )
      continue;
    const b = j.response.body;
    if (
      !b ||
      String(b.requestID) !== j.agt_request_id ||
      (b.taxRegistrationNumber &&
        b.taxRegistrationNumber !== j.payload.taxRegistrationNumber) ||
      b.successRequestID ||
      (b.errorList != null &&
        (!Array.isArray(b.errorList) || b.errorList.length > 0)) ||
      (b.requestErrorList != null &&
        (!Array.isArray(b.requestErrorList) || b.requestErrorList.length > 0))
    )
      continue;
    try {
      if (
        classifyState(
          b,
          j.payload.documents.map((d: any) => d.documentNo),
        ) !== j.status
      )
        continue;
      const rejected = b.documentStatusList.find(
        (d: any) => d.documentNo === row.numero,
      );
      if (
        rejected?.documentStatus !== "I" ||
        !Array.isArray(rejected.errorList) ||
        !rejected.errorList.length
      )
        continue;
      const codes = rejected.errorList.map(
        (e: any) => e?.errorCode || e?.idError,
      );
      // E09 may mean the original is already valid. E46 and E41 are also
      // referred for review; they are not a reason to allocate another number.
      if (
        codes.some(
          (c: any) =>
            !/^E\d{2}$/.test(c || "") || ["E09", "E46", "E41"].includes(c),
        )
      )
        continue;
      return { jobId: j.id as string, requestID: j.agt_request_id, codes };
    } catch {
      /* Incomplete or inconsistent replies cannot authorise correction. */
    }
  }
  return null;
}

export function replacementType(row: any) {
  return (
    row.tipo_documento === "factura" &&
    row.estado === "emitida" &&
    row.billing_meta?.managed === "nvuala-v1" &&
    row.billing_meta?.ambiente === "homologacao" &&
    row.billing_meta?.agtMode === "homologacao_oficial" &&
    !row.billing_meta?.insurance &&
    !row.billing_meta?.insuranceAmounts &&
    !row.billing_meta?.settlement &&
    !row.billing_meta?.caixaSessaoId &&
    !row.billing_meta?.formasPagamentoDetalhe?.length
  );
}

export async function findReplacement(c: any, org: string, invoiceId: number) {
  return (
    await c.query(
      "SELECT f.numero FROM public.nv_agt_replacements r JOIN public.faturas f ON f.empresa_id=r.empresa_id AND f.id=r.replacement_id WHERE r.empresa_id=$1 AND r.original_id=$2",
      [org, invoiceId],
    )
  ).rows[0]?.numero as string | undefined;
}

export async function preflightReplacement(c: any, org: string, original: any) {
  check(
    original && replacementType(original),
    "A correcção exige uma FT de homologação em aberto, sem seguro nem pagamento.",
  );
  check(
    !(await findReplacement(c, org, original.id)),
    "Esta factura já tem um documento substituto.",
  );
  const dependencies = (
    await c.query(
      `SELECT
       EXISTS(SELECT 1 FROM public.nv_insurance_claims WHERE empresa_id=$1 AND invoice_id=$2)
       OR EXISTS(SELECT 1 FROM public.nv_cash_entries WHERE empresa_id=$1 AND invoice_id=$2)
       OR EXISTS(SELECT 1 FROM public.faturas WHERE empresa_id=$1 AND estado<>'rascunho' AND billing_meta->>'documentoOrigem'=$3)
       AS found`,
      [org, original.id, original.numero],
    )
  ).rows[0];
  check(
    !dependencies.found,
    "Há seguro, movimentos de caixa ou documentos dependentes. Reveja a conta antes de corrigir.",
  );
  const entries = (
    await c.query(
      "SELECT kind,party_type,party_id,debit,credit FROM public.nv_receivable_entries WHERE empresa_id=$1 AND invoice_id=$2 FOR UPDATE",
      [org, original.id],
    )
  ).rows;
  const valid = original.paciente_id
    ? entries.length === 1 &&
      entries[0].kind === "invoice" &&
      entries[0].party_type === "patient" &&
      entries[0].party_id === String(original.paciente_id) &&
      cents(entries[0].debit) === cents(original.total) &&
      cents(entries[0].credit) === 0
    : entries.length === 0;
  check(
    valid,
    "A conta da factura já tem recebimentos, créditos ou outro movimento. A correcção exige revisão financeira.",
  );
}

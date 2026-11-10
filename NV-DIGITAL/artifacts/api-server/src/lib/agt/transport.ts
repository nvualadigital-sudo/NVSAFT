import { canonical } from "./crypto.js";
import { operations } from "./wire.js";
import type { Runtime } from "./runtime.js";
export type Reply = { httpStatus: number; body: any; retrySeconds: number };
export async function hmlRequest(
  operation: string,
  payload: any,
  r: Runtime,
): Promise<Reply> {
  if (!(operations as readonly string[]).includes(operation) || !r.live)
    throw new Error(
      "O envio para homologação está desligado na configuração local.",
    );
  // O destino não é configurável por HTTP, perfil ou variável de ambiente.
  const url = "https://sifphml.minfin.gov.ao/sigt/fe/v1/" + operation;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization:
        "Basic " +
        Buffer.from(r.username + ":" + r.password).toString("base64"),
    },
    body: JSON.stringify(payload),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const reader = response.body?.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  if (reader)
    while (true) {
      const v = await reader.read();
      if (v.done) break;
      bytes += v.value.length;
      if (bytes > 2_000_000) {
        await reader.cancel();
        throw new Error(
          "Resposta AGT demasiado grande; confirme o estado antes de repetir.",
        );
      }
      chunks.push(v.value);
    }
  let body: any;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error(
      "Resposta AGT ilegível; confirme o estado antes de repetir.",
    );
  }
  const header = response.headers.get("Retry-After"),
    seconds =
      header && /^\d+$/.test(header)
        ? Number(header)
        : header && Number.isFinite(Date.parse(header))
          ? Math.ceil((Date.parse(header) - Date.now()) / 1000)
          : 30;
  return {
    httpStatus: response.status,
    body,
    retrySeconds: Math.max(30, Math.min(seconds, 86400)),
  };
}
export function classifyState(body: any, numbers: string[]) {
  if (!body || !/^(0|1|2|7|8|9)$/.test(String(body.resultCode)))
    throw new Error(
      "Resultado AGT desconhecido; o pedido não foi aprovado localmente.",
    );
  const code = Number(body.resultCode);
  if (code === 7 || code === 8) return "processando";
  if (code === 9) return "cancelado";
  const list = body.documentStatusList;
  if (
    !Array.isArray(list) ||
    list.length !== numbers.length ||
    new Set(list.map((d) => d.documentNo)).size !== numbers.length ||
    list.some(
      (d) =>
        !numbers.includes(d.documentNo) ||
        !["V", "I"].includes(d.documentStatus) ||
        (d.documentStatus === "V" && d.errorList?.length > 0),
    )
  )
    throw new Error(
      "A AGT não devolveu um estado conclusivo para cada documento deste pedido.",
    );
  const valid = list.filter((d) => d.documentStatus === "V").length;
  if (
    (code === 0 && valid !== numbers.length) ||
    (code === 1 && (!valid || valid === numbers.length)) ||
    (code === 2 && valid)
  )
    throw new Error("Resultado e estados AGT inconsistentes.");
  return code === 0 ? "validado" : code === 1 ? "parcial" : "rejeitado";
}

/** Fail closed for penalties, annulments and ambiguous or incomplete evidence. */
export function matchesConsultedDocument(
  reply: Reply,
  expected: any,
  nif: string,
) {
  const b = reply.body;
  if (
    reply.httpStatus !== 200 ||
    !b ||
    b.documentNo !== expected.documentNo ||
    (b.taxRegistrationNumber !== undefined &&
      b.taxRegistrationNumber !== nif) ||
    (b.errorList !== undefined &&
      (!Array.isArray(b.errorList) || b.errorList.length > 0))
  )
    return false;
  const v2 =
    Object.hasOwn(b, "documents") || Object.hasOwn(b, "validationStatus");
  if (
    v2 &&
    (b.validationStatus !== "V" ||
      !Array.isArray(b.documents) ||
      b.documents.length !== 1 ||
      Object.hasOwn(b, "document") ||
      Object.hasOwn(b, "documentStatus"))
  )
    return false;
  if (!v2 && b.documentStatus !== "V") return false;
  let d = v2 ? b.documents[0] : b.document;
  if (!v2 && typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return false;
    }
  }
  return (
    !!d &&
    [
      "documentNo",
      "documentStatus",
      "documentType",
      "documentDate",
      "customerTaxID",
      "customerCountry",
      "companyName",
      "jwsDocumentSignature",
      "rejectedDocumentNo",
    ].every((key) => d[key] === expected[key]) &&
    d.documentTotals &&
    canonical(d.documentTotals) === canonical(expected.documentTotals)
  );
}

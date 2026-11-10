import QRCode from "qrcode";
/** Diagnóstico da especificação publicada; nunca substitui o QR interno por um QR fiscal não aprovado. */
export function agtQrPreflight(nif: string, documentNo: string) {
  if (
    !/^[A-Za-z0-9]{8,15}$/.test(nif) ||
    nif === "999999999" ||
    typeof documentNo !== "string" ||
    documentNo.length < 8 ||
    documentNo.length > 60
  )
    throw Error("Indique o NIF do emitente e um número de documento válido.");
  const url =
    "https://quiosqueagt.minfin.gov.ao/facturacao-eletronica/consultar-fe?emissor=" +
    encodeURIComponent(nif) +
    "&document=" +
    encodeURIComponent(documentNo);
  const segments = [
    { data: new TextEncoder().encode(url), mode: "byte" as const },
  ];
  const suggested = QRCode.create(segments, { errorCorrectionLevel: "M" });
  let fixedVersionMatches = false;
  try {
    QRCode.create(segments, { version: 4, errorCorrectionLevel: "M" });
    fixedVersionMatches = true;
  } catch {}
  return {
    encodedURL: url,
    utf8Bytes: new TextEncoder().encode(url).length,
    publishedVersion: 4,
    publishedModules: 33,
    errorCorrection: "M",
    suggestedVersion: suggested.version,
    suggestedModules: suggested.modules.size,
    fixedVersionMatches,
    approved: false,
    notice: fixedVersionMatches
      ? "Falta verificar PNG 350×350, logotipo e aceitação pela AGT."
      : "A URL publicada não cabe na versão 4 com correcção M. Confirme a versão/layout com a AGT; não foi gerado um QR fiscal alternativo.",
  };
}

/** Standalone sample for a capacity/scan check; never embedded in a fiscal document. */
export async function agtQrExamplePng(nif: string, documentNo: string) {
  const report = agtQrPreflight(nif, documentNo);
  const dataUrl = await QRCode.toDataURL(
    [{ data: new TextEncoder().encode(report.encodedURL), mode: "byte" }],
    {
      version: report.suggestedVersion,
      errorCorrectionLevel: "M",
      width: 350,
      margin: 4,
      type: "image/png",
    },
  );
  return {
    dataUrl,
    ...report,
    notice:
      "QR de ensaio — não fiscal, sem logótipo. A versão alternativa requer confirmação da AGT.",
  };
}

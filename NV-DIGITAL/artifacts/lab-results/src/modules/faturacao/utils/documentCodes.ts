import QRCode from "qrcode";
import { CODE128_PATTERNS } from "../vendor/code128Patterns";
import type { Fatura } from "../types";
export function code128Bits(value: string) {
  if (!/^[\x20-\x7e]{1,60}$/.test(value))
    throw Error("Referência inválida para o código de barras.");
  const values = Array.from(value, (c) => c.charCodeAt(0) - 32),
    checksum = (104 + values.reduce((n, v, i) => n + v * (i + 1), 0)) % 103;
  return [104, ...values, checksum, 106]
    .map((n) => CODE128_PATTERNS[n])
    .join("");
}
export function documentReference(f: Pick<Fatura, "id" | "numero">) {
  return Number.isSafeInteger(f.id) && f.id > 0 ? `NV1-${f.id}` : "";
}
export function qrPayload(f: Fatura) {
  return JSON.stringify({
    v: 1,
    app: "NVUALASOFT",
    ref: documentReference(f),
    documento: String(f.numero),
    ambiente: (f as any).ambiente === "homologacao" ? "formacao" : "arquivo",
    tipo: f.tipoDocumento,
  });
}
export function documentCodes(f: Fatura) {
  const reference = documentReference(f);
  if (!reference) return "";
  const qr = QRCode.create(qrPayload(f), { errorCorrectionLevel: "M" }),
    size = qr.modules.size,
    margin = 4;
  let path = "";
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (qr.modules.get(y, x)) path += `M${x + margin} ${y + margin}h1v1h-1z`;
  const matrix = `<svg class="document-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + margin * 2} ${size + margin * 2}" role="img" aria-label="QR de referência interna"><rect width="100%" height="100%" fill="white"/><path fill="black" shape-rendering="crispEdges" d="${path}"/></svg>`;
  const bits = code128Bits(reference),
    quiet = 10,
    rects = Array.from(bits, (b, i) =>
      b === "1" ? `<rect x="${i + quiet}" y="0" width="1" height="42"/>` : "",
    ).join("");
  const bars = `<svg class="document-barcode" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bits.length + quiet * 2} 42" role="img" aria-label="Código de barras de referência interna"><rect width="100%" height="100%" fill="white"/><g fill="black" shape-rendering="crispEdges">${rects}</g></svg>`;
  return `<div class="document-identifiers"><div>${matrix}</div><div>${bars}<div class="document-reference">${reference}</div><small>Referência interna${(f as any).ambiente === "homologacao" ? " de formação" : ""}<br>Não é código fiscal AGT</small></div></div>`;
}

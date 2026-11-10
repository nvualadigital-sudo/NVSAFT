import QRCode from "qrcode";
export const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function labelWindow(
  win: Window,
  s: any,
  order: any,
  institution: string,
  size: string,
) {
  const [w, h] = size.split("x").map(Number),
    qr = await QRCode.toDataURL(s.code, {
      margin: 4,
      width: 220,
      errorCorrectionLevel: "M",
    });
  win.document.write(
    `<!doctype html><html lang="pt-AO"><head><meta charset="utf-8"><title>Etiqueta ${escape(s.code)}</title><style>@page{size:${w}mm ${h}mm;margin:0}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff;font:7pt Arial}article{width:${w}mm;height:${h}mm;padding:1.5mm;display:grid;grid-template-columns:1fr 14mm;gap:1mm;overflow:hidden}p{margin:.6mm 0;overflow-wrap:anywhere}strong{font-size:8pt}.sample-code{font-size:9pt;font-weight:bold}.sample-code.legacy{font-size:6pt}img{width:14mm;height:14mm}small{font-size:5pt}button{margin:8px}@media print{button{display:none}}</style></head><body><article><div><p class="sample-code${String(s.code).length > 16 ? " legacy" : ""}">${escape(s.code)}</p><strong>${escape(order.patient_name)}</strong><p>ID ${escape(order.patient_id)} · ${escape(order.processo || "—")}</p><p>Nasc. ${escape(order.nasc || "—")}</p><p>${escape(s.material)} · ${escape(s.container)}</p><p>${escape(new Date(s.collected_at).toLocaleString("pt-AO", { timeZone: "Africa/Luanda" }))}</p><small>${escape(institution)}</small></div><div><img alt="Código do recipiente" src="${qr}"></div></article><button onclick="window.print()">Imprimir etiqueta</button></body></html>`,
  );
  win.document.close();
}

export function printClinical(title: string, paragraphs: string[]) {
  const popup = window.open("", "_blank", "width=900,height=900");
  if (!popup) throw new Error("Permita a janela de impressão neste navegador.");
  const d = popup.document;
  d.title = title;
  const style = d.createElement("style");
  style.textContent =
    "@page{size:A4;margin:22mm}body{font:12pt Georgia,serif;color:#111;line-height:1.5}h1{font:18pt system-ui;border-bottom:2px solid #0f766e;padding-bottom:12px}p{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:32px;font-size:10pt;color:#555}";
  d.head.append(style);
  const h = d.createElement("h1");
  h.textContent = title;
  d.body.append(h);
  for (const text of paragraphs) {
    const p = d.createElement("p");
    p.textContent = text;
    d.body.append(p);
  }
  const footer = d.createElement("footer");
  footer.textContent =
    "Documento preparado pelo sistema. A identificação inserida não constitui assinatura digital. Assinatura e carimbo do profissional: __________________________";
  d.body.append(footer);
  popup.focus();
  popup.print();
}

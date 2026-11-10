import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import Papa from "papaparse";
import Code from "qrcode";
const waiting = new Map();
addEventListener("message", (event) => {
  const context = globalThis.__nvPassContext;
  if (
    !context ||
    event.source !== parent ||
    event.origin !== context.parentOrigin ||
    event.data?.scope !== context.scope ||
    event.data?.type !== "nv-pass-rendered"
  )
    return;
  const item = waiting.get(event.data.requestId);
  if (!item) return;
  waiting.delete(event.data.requestId);
  clearTimeout(item.timeout);
  if (event.data.error) item.reject(new Error(event.data.error));
  else item.resolve(event.data.image);
});
async function html2canvas(element) {
  const context = globalThis.__nvPassContext;
  if (!context) throw new Error("Abra o Criador de Passes pelo sistema.");
  const clone = element.cloneNode(true),
    originals = [...element.querySelectorAll("canvas")];
  for (const [index, canvas] of [
    ...clone.querySelectorAll("canvas"),
  ].entries()) {
    const original = originals[index],
      img = document.createElement("img");
    img.src = original.toDataURL("image/png");
    img.style.cssText = original.style.cssText;
    img.style.width = getComputedStyle(original).width;
    img.style.height = getComputedStyle(original).height;
    canvas.replaceWith(img);
  }
  const requestId = crypto.randomUUID();
  const data = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waiting.delete(requestId);
      reject(new Error("A exportação demorou demasiado. Tente novamente."));
    }, 45000);
    waiting.set(requestId, { resolve, reject, timeout });
    parent.postMessage(
      {
        type: "nv-pass-render",
        scope: context.scope,
        requestId,
        markup: clone.outerHTML,
        width: element.offsetWidth,
        height: element.offsetHeight,
      },
      context.parentOrigin,
    );
  });
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () =>
      reject(new Error("Não foi possível preparar a imagem do passe."));
    img.src = data;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return canvas;
}
function QRCode(element, options) {
  const canvas = element.ownerDocument.createElement("canvas");
  element.appendChild(canvas);
  Code.toCanvas(canvas, options.text, {
    width: 220,
    margin: 4,
    errorCorrectionLevel: "M",
    color: {
      dark: options.colorDark || "#000000",
      light: options.colorLight || "#ffffff",
    },
  })
    .then(() => {
      canvas.style.width = options.width + "px";
      canvas.style.height = options.height + "px";
    })
    .catch(() => {
      element.textContent = "QR indisponível";
    });
}
QRCode.CorrectLevel = { M: "M" };
Object.assign(globalThis, {
  html2canvas,
  jspdf: { jsPDF },
  JsBarcode,
  Papa,
  QRCode,
});

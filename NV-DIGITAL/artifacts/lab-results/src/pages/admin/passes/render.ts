import html2canvas from "html2canvas";
import DOMPurify from "dompurify";
import original from "./modelos-originais.html?raw";
const styles = original.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
/** Render a static, sanitised card. No executable content from the designer enters the host. */
export async function renderPassImage(payload: {
  markup: string;
  width: number;
  height: number;
}) {
  const width = Math.ceil(Number(payload.width)),
    height = Math.ceil(Number(payload.height));
  if (
    typeof payload.markup !== "string" ||
    payload.markup.length > 500000 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 40 ||
    height < 40 ||
    width > 800 ||
    height > 1200
  )
    throw new Error("Dimensões ou conteúdo do passe inválidos.");
  const markup = DOMPurify.sanitize(payload.markup, {
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "link",
      "meta",
      "base",
      "form",
      "input",
      "button",
      "style",
      "foreignObject",
      "animate",
      "animateTransform",
    ],
    FORBID_ATTR: ["srcset", "href", "xlink:href", "formaction", "action"],
  });
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-12000px;top:0;width:${width + 32}px;height:${height + 32}px;border:0;pointer-events:none`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc)
      throw new Error("Não foi possível preparar a impressão do passe.");
    doc.open();
    doc.write(
      "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>",
    );
    doc.close();
    const css = doc.createElement("style");
    css.textContent =
      styles +
      "\nbody{margin:0!important;padding:0!important;background:#fff!important}.pass-preview{transform:none!important}";
    doc.head.append(css);
    const wrapper = doc.createElement("div");
    wrapper.innerHTML = markup;
    doc.body.append(wrapper);
    for (const element of wrapper.querySelectorAll("*")) {
      if (element.tagName.toUpperCase() === "IMG") {
        const source = element.getAttribute("src") || "";
        if (!/^data:image\/(?:png|jpeg|webp|gif|svg\+xml)[;,]/i.test(source))
          element.removeAttribute("src");
      }
      const inline = element.getAttribute("style") || "";
      if (/url\(\s*['"]?(?:https?:|\/\/)/i.test(inline))
        element.removeAttribute("style");
    }
    const card = wrapper.firstElementChild as HTMLElement | null;
    if (!card) throw new Error("Passe vazio.");
    await Promise.all(
      [...doc.images].map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
      ),
    );
    const canvas = await html2canvas(card, {
      scale: 3,
      backgroundColor: null,
      useCORS: false,
      allowTaint: false,
      logging: false,
    });
    return canvas.toDataURL("image/png");
  } finally {
    frame.remove();
  }
}

import { command } from "../store/AppContext";
import type { Fatura, ConfigSistema } from "../types";
import { render } from "./printTemplate";

export const formatCurrency = (n: number, currency = "AOA") =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency }).format(
    Number(n) || 0,
  );
export const validarNifAngola = (n: string | undefined, consumer = false) =>
  !n ? consumer : /^[A-Za-z0-9]{8,15}$/.test(n);
export const validarNifEmitente = (n: string | undefined) =>
  !!n && validarNifAngola(n) && n !== "999999999" && !/^0+$/.test(n);

export function generateFaturaHTML(
  f: Fatura,
  c: ConfigSistema,
  options: { segundaVia?: boolean; termica?: boolean } = {},
) {
  const format = options.termica
    ? c.perfisImpressoras?.find((p) => p.padrao)?.larguraPapel === "58mm"
      ? "58mm"
      : "80mm"
    : "a4";
  return (
    `<!--NVPRINT:${f.id}:${format}-->` +
    render(
      f,
      (f as any).emitenteSnapshot || c,
      format,
      "PRÉ-VISUALIZAÇÃO — NÃO IMPRIMIR",
    )
  );
}

export function openInvoicePrint() {
  try {
    const w = window.open("", "_blank");
    if (!w) return null;
    w.opener = null;
    w.document.write("<p>A aguardar o documento do servidor…</p>");
    return w;
  } catch {
    return null;
  }
}

/** Reserves the print on the server before rendering it, including POS automatic prints. */
export async function printIssuedInvoice(
  id: number,
  format: "a4" | "58mm" | "80mm",
  w: Window | null,
  source: "billing" | "pharmacy" = "billing",
) {
  if (!w || w.closed) return false;
  try {
    const endpoint =
      source === "pharmacy" ? "/pharmacy-pos/sales/" : "/documents/";
    const r = await command<any>(endpoint + id + "/print", { format });
    if (w.closed) return false;
    w.document.open();
    w.document.write(render(r.fatura, r.config, r.format, r.notice));
    w.document.close();
    w.focus();
    setTimeout(() => {
      if (!w.closed) w.print();
    }, 300);
    return true;
  } catch (e: any) {
    if (!w.closed)
      w.document.body.textContent = "Impressão não confirmada: " + e.message;
    return false;
  }
}

export async function downloadFatura(html: string, _name: string) {
  const marker = html.match(/^<!--NVPRINT:(\d+):(a4|58mm|80mm)-->/);
  if (!marker) {
    window.alert("Documento sem identificação de impressão.");
    return;
  }
  const w = openInvoicePrint();
  if (!w) {
    window.alert("Permita janelas de impressão neste site e tente novamente.");
    return;
  }
  await printIssuedInvoice(
    Number(marker[1]),
    marker[2] as "a4" | "58mm" | "80mm",
    w,
  );
}

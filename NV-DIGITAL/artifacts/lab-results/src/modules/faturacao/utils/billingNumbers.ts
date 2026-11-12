import type { LinhaFatura } from "../types";

// Accept the decimal comma used by operators and ordinary decimal-point values.
// Empty is zero; malformed input stays invalid instead of silently becoming zero.
export function inputNumber(value: unknown): number {
  if (typeof value === "number") return value;
  let s = String(value ?? "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "");
  if (!s) return 0;
  if (s.includes(",")) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{0,6}$/.test(s)) return NaN;
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (!/^-?\d*(?:\.\d{0,6})?$/.test(s) || s === "-" || s === ".")
    return NaN;
  return Number(s);
}
const round = (a: bigint, b: bigint) => (a + b / 2n) / b;
export function invoicePreview(
  lines: LinhaFatura[],
  taxInput: unknown,
  percentInput: unknown,
  fixedInput: unknown,
  rounding: "legacy" | "agt2" = "legacy",
) {
  const blank = {
    subtotalBruto: 0,
    subtotalSemIva: 0,
    totalIva: 0,
    descontoValor: 0,
    retencao: 0,
    total: 0,
    error: "",
  };
  try {
    const fail = (message: string): never => {
      throw Error(message);
    };
    const pct = inputNumber(percentInput),
      fixed = pct > 0 ? 0 : inputNumber(fixedInput),
      tax = inputNumber(taxInput);
    if (
      !Number.isFinite(pct) ||
      pct < 0 ||
      pct > 100 ||
      Math.abs(pct * 100 - Math.round(pct * 100)) > 0.0001
    )
      fail(
        "O desconto percentual deve estar entre 0 e 100, com até duas casas decimais. Para um desconto em Kz, use o campo Valor.",
      );
    if (
      !Number.isFinite(fixed) ||
      fixed < 0 ||
      Math.abs(fixed * 100 - Math.round(fixed * 100)) > 0.0001
    )
      fail(
        "Indique um desconto em Kz válido, com até duas casas decimais; por exemplo, 1250,50.",
      );
    if (taxInput === null || taxInput === undefined ||
        (typeof taxInput === "string" && !taxInput.trim()) ||
        ![0, 5, 7, 14].includes(tax))
      fail("Seleccione expressamente uma taxa de IVA válida: 0%, 5%, 7% ou 14%.");
    if (!lines.length) return blank;
    let gross = 0n;
    const raw = lines.map((l, i) => {
      const q = Number(l.quantidade),
        p = Number(l.precoUnitario);
      if (
        !Number.isFinite(q) ||
        q <= 0 ||
        q > 1e6 ||
        Math.abs(q * 1e6 - Math.round(q * 1e6)) > 0.0001
      )
        fail(`Verifique a quantidade do item ${i + 1}.`);
      if (
        !Number.isFinite(p) ||
        p < 0 ||
        p > 1e11 ||
        Math.abs(p * 100 - Math.round(p * 100)) > 0.0001
      )
        fail(
          `Verifique o preço do item ${i + 1}: use até duas casas decimais.`,
        );
      const v = round(
        BigInt(Math.round(q * 1e6)) * BigInt(Math.round(p * 100)),
        1000000n,
      );
      gross += v;
      return rounding === "agt2"
        ? (BigInt(Math.round(q * 1e6)) *
            BigInt(Math.round(p * 100)) *
            BigInt(10000 - Math.round(pct * 100))) /
            10000000000n
        : round(v * BigInt(10000 - Math.round(pct * 100)), 10000n);
    });
    const before = raw.reduce((a, b) => a + b, 0n),
      fixedCents = BigInt(Math.round(fixed * 100));
    if (fixedCents > before)
      fail(
        "O desconto em Kz não pode ultrapassar o valor dos itens. Reduza o desconto ou acrescente os itens em falta.",
      );
    const allocated = raw.map((v) => (before ? (fixedCents * v) / before : 0n));
    let remainder = fixedCents - allocated.reduce((a, b) => a + b, 0n);
    const order = raw
      .map((v, i) => ({
        i,
        remainder: before ? (fixedCents * v) % before : 0n,
      }))
      .sort((a, b) =>
        a.remainder > b.remainder
          ? -1
          : a.remainder < b.remainder
            ? 1
            : a.i - b.i,
      );
    for (const { i } of order) {
      if (!remainder) break;
      if (allocated[i] < raw[i]) {
        allocated[i]++;
        remainder--;
      }
    }
    const base = before - fixedCents;
    const iva = raw.reduce(
      (sum, v, i) =>
        sum +
        (lines[i].ivaIsento
          ? 0n
          : rounding === "agt2"
            ? ((v - allocated[i]) * BigInt(tax) + 99n) / 100n
            : round((v - allocated[i]) * BigInt(tax), 100n)),
      0n,
    );
    if (base + iva > 10000000000000n)
      fail("O total ultrapassa o limite suportado por documento.");
    return {
      subtotalBruto: Number(gross) / 100,
      subtotalSemIva: Number(base) / 100,
      totalIva: Number(iva) / 100,
      descontoValor: Number(gross - base) / 100,
      retencao: 0,
      total: Number(base + iva) / 100,
      error: "",
    };
  } catch (e) {
    return { ...blank, error: (e as Error).message };
  }
}

import { createHash } from "node:crypto";
export const codes: Record<string, string> = {
  factura: "FT",
  "factura-recibo": "FR",
  "factura-global": "FG",
  "pro-forma": "PF",
  "nota-credito": "NC",
  recibo: "RC",
};
export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Object.assign(new Error(message), { status: 400 });
}
export function text(v: unknown, max = 500) {
  check(
    typeof v === "string" && v.length <= max,
    "Texto inválido ou demasiado longo.",
  );
  return v.trim();
}
export function cents(v: unknown): number {
  const n = Number(v);
  check(Number.isFinite(n) && Math.abs(n) <= 1e11, "Valor monetário inválido.");
  check(
    Math.abs(n * 100 - Math.round(n * 100)) < 0.0001,
    "Use no máximo duas casas decimais.",
  );
  return Math.round(n * 100);
}
export function roundRatio(a: bigint, b: bigint) {
  return (a + b / 2n) / b;
}
export function totals(d: any, rounding: "legacy" | "agt2" = "legacy") {
  check(codes[d.tipoDocumento], "Tipo de documento inválido.");
  check(
    Array.isArray(d.linhas) && d.linhas.length > 0 && d.linhas.length <= 300,
    "Introduza entre 1 e 300 linhas.",
  );
  const discount = Number(d.desconto || 0),
    rate = Number(d.ivaTaxa);
  check(
    Number.isFinite(discount) &&
      discount >= 0 &&
      discount <= 100 &&
      Math.abs(discount * 100 - Math.round(discount * 100)) < 0.0001,
    "Desconto inválido.",
  );
  check(
    [0, 5, 7, 14].includes(rate),
    "Taxa de IVA não suportada. Confirme o enquadramento tributário.",
  );
  let net = 0n,
    tax = 0n;
  const lines = d.linhas.map((l: any) => {
    const q = Number(l.quantidade),
      price = cents(l.precoUnitario);
    check(
      Number.isFinite(q) &&
        q !== 0 &&
        Math.abs(q) <= 1e6 &&
        Math.abs(q * 1e6 - Math.round(q * 1e6)) < 0.0001,
      "Quantidade inválida (máximo 6 casas decimais).",
    );
    check(
      price >= 0 && (d.tipoDocumento === "nota-credito" ? q < 0 : q > 0),
      "Preço ou sinal da quantidade inválido.",
    );
    check(
      typeof l.ivaIsento === "boolean",
      "Indique o enquadramento de IVA da linha.",
    );
    const value = roundRatio(
      BigInt(Math.round(Math.abs(q) * 1e6)) * BigInt(price),
      1000000n,
    );
    const numerator =
      BigInt(Math.round(Math.abs(q) * 1e6)) *
      BigInt(price) *
      BigInt(10000 - Math.round(discount * 100));
    const taxable =
      rounding === "agt2"
        ? d.tipoDocumento === "nota-credito"
          ? (numerator + 10000000000n - 1n) / 10000000000n
          : numerator / 10000000000n
        : roundRatio(
            value * BigInt(10000 - Math.round(discount * 100)),
            10000n,
          );
    net += taxable;
    return {
      _base: taxable,
      descricao: text(l.descricao, 500),
      quantidade: q,
      precoUnitario: price / 100,
      ivaIsento: l.ivaIsento,
      ...(l.produtoId ? { produtoId: Number(l.produtoId) } : {}),
      codigo: String(l.codigo || "").slice(0, 80),
      unidade: String(l.unidade || "un").slice(0, 30),
      lote: String(l.lote || "").slice(0, 100),
      dataValidade: String(l.dataValidade || "").slice(0, 30),
      ...(Number.isInteger(l.originActIndex) && l.originActIndex >= 0
        ? { originActIndex: l.originActIndex }
        : {}),
    };
  });
  const fixed = cents(d.descontoValor || 0);
  check(
    fixed >= 0 && BigInt(fixed) <= net,
    "Desconto em valor superior à base.",
  );
  const baseBeforeFixed = net;
  const allocations = lines.map((l: any) =>
    baseBeforeFixed === 0n ? 0n : (BigInt(fixed) * l._base) / baseBeforeFixed,
  );
  let remaining =
    BigInt(fixed) - allocations.reduce((a: bigint, b: bigint) => a + b, 0n);
  const order = lines
    .map((l: any, i: number) => ({
      i,
      remainder:
        baseBeforeFixed === 0n
          ? 0n
          : (BigInt(fixed) * l._base) % baseBeforeFixed,
    }))
    .sort((a: any, b: any) =>
      a.remainder > b.remainder
        ? -1
        : a.remainder < b.remainder
          ? 1
          : a.i - b.i,
    );
  for (const item of order) {
    if (remaining <= 0n) break;
    if (allocations[item.i] < lines[item.i]._base) {
      allocations[item.i]++;
      remaining--;
    }
  }
  check(remaining === 0n, "Não foi possível distribuir o desconto.");
  const sign = d.tipoDocumento === "nota-credito" ? -1 : 1;
  const finalLines = lines.map((l: any, index: number) => {
    const base: bigint = BigInt(l._base) - BigInt(allocations[index]);
    const lineTax = l.ivaIsento
      ? 0n
      : rounding === "agt2"
        ? (base * BigInt(rate) + 99n) / 100n
        : roundRatio(base * BigInt(rate), 100n);
    tax += lineTax;
    const { _base, ...clean } = l;
    return {
      ...clean,
      baseLiquida: (sign * Number(base)) / 100,
      ivaValor: (sign * Number(lineTax)) / 100,
    };
  });
  net -= BigInt(fixed);
  const result = {
    linhas: finalLines,
    subtotalSemIva: (sign * Number(net)) / 100,
    totalIva: (sign * Number(tax)) / 100,
    total: (sign * Number(net + tax)) / 100,
    ivaTaxa: rate,
    desconto: discount,
    descontoValor: fixed / 100,
  };
  check(Math.abs(result.total) <= 1e11, "Total fora do limite suportado.");
  return result;
}
export function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function localStamp(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Luanda",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (k: string) => p.find((x) => x.type === k)!.value;
  return {
    data: `${get("day")}/${get("month")}/${get("year")}`,
    hora: `${get("hour")}:${get("minute")}:${get("second")}`,
    year: Number(get("year")),
    iso: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

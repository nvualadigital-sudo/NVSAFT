type Doc = {
  estado: string;
  tipoDocumento?: string;
  total: number;
  insured?: boolean;
  insuredBalance?: number;
  receivableBalance?: number;
  cashReceived?: number;
  totalIva?: number;
  subtotalSemIva?: number;
};
export function countsAsRevenue(f: Doc) {
  return (
    ["emitida", "paga"].includes(f.estado) &&
    !["recibo", "pro-forma"].includes(f.tipoDocumento || "")
  );
}
export function financialSummary(docs: Doc[]) {
  const sales = docs.filter(countsAsRevenue);
  return {
    total: sales.reduce((s, f) => s + f.total, 0),
    tax: sales.reduce((s, f) => s + (f.totalIva || 0), 0),
    base: sales.reduce((s, f) => s + (f.subtotalSemIva || 0), 0),
    paid: sales.reduce((s,f)=>s+(f.receivableBalance!==undefined ? (f.cashReceived || 0) : f.estado==="paga" ? f.total : 0),0),
    pending: sales
      .filter(
        (f) => f.estado === "emitida" && f.tipoDocumento !== "nota-credito",
      )
      .reduce((s, f) => s + (f.receivableBalance!==undefined ? Math.max(0,f.receivableBalance) : f.total), 0),
  };
}
export function reportDate(text: string) {
  const [day, month, year] = text.split("/").map(Number),
    date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date.getTime()
    : NaN;
}

export const escapeLedgerText = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function ledgerDate(s: unknown) {
  const text = String(s || ""),
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : text;
  const d = new Date(iso + "T12:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === iso
    ? iso
    : "";
}
export function ledgerTotals(rows: { tipo: string; valor: number | string }[]) {
  const sum = (type: string) =>
    rows
      .filter((r) => r.tipo === type)
      .reduce((n, r) => n + Math.round(Number(r.valor) * 100), 0);
  const incoming = sum("entrada"),
    outgoing = sum("saida");
  return {
    incoming: incoming / 100,
    outgoing: outgoing / 100,
    balance: (incoming - outgoing) / 100,
  };
}

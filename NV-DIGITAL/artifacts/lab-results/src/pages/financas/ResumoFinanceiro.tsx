import { useApp } from "../../store/AppContext";
import type { Session } from "../../store/auth";
import { formatCurrency } from "../../store/storage";
export default function ResumoFinanceiro(_p: { session?: Session }) {
  const { data } = useApp();
  const issued = data.faturas.filter(
    (f) =>
      ["emitida", "paga"].includes(f.estado) &&
      !["recibo", "pro-forma"].includes(f.tipoDocumento || ""),
  );
  const total = issued.reduce((s, f) => s + Number(f.total), 0),
    paid = issued
      .filter((f) => f.estado === "paga")
      .reduce((s, f) => s + Number(f.total), 0),
    balance = data.movimentosCC.reduce(
      (s, m) => s + (m.tipo === "entrada" ? 1 : -1) * Number(m.valor),
      0,
    );
  return (
    <section className="space-y-4 p-5">
      <h1 className="text-2xl font-bold">Resumo financeiro</h1>
      <p className="text-sm text-slate-500">
        Valores acumulados dos documentos existentes. Recibos e pro-formas não
        são somados novamente à facturação.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Facturação líquida", total],
          ["Documentos pagos", paid],
          ["Saldo da conta corrente", balance],
        ].map(([k, v]) => (
          <article className="rounded-xl border bg-white p-5" key={k}>
            <p>{k}</p>
            <strong>{formatCurrency(Number(v), data.config.moeda)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

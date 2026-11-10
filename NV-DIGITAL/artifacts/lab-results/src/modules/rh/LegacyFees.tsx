import { useState } from "react";
import { reqDirect } from "../../store/api";
export default function LegacyFees() {
  const [rows, setRows] = useState<any[] | null>(null),
    [error, setError] = useState("");
  return (
    <details
      className="mt-5 rounded border p-4"
      onToggle={(e) => {
        if (e.currentTarget.open && rows === null && !error)
          void Promise.all([
            reqDirect<any[]>("GET", "/hospital/records/fees"),
            reqDirect<any[]>("GET", "/hospital/records/payroll"),
          ])
            .then(([fees, payroll]) =>
              setRows([
                ...fees.map((r) => ({ ...r, legacyKind: "Honorário" })),
                ...payroll.map((r) => ({
                  ...r,
                  legacyKind: "Salário",
                  data: {
                    ...r.data,
                    reference: r.data.period,
                    date: r.data.period,
                    amount:
                      Number(r.data.base || 0) +
                      Number(r.data.extras || 0) -
                      Number(r.data.deductions || 0),
                  },
                })),
              ]),
            )
            .catch((e) => setError(e.message));
      }}
    >
      <summary className="cursor-pointer font-semibold">
        Consultar honorários e salários antigos
      </summary>
      <p className="my-3 text-sm">
        Registos anteriores conservados para consulta. Não são somados
        automaticamente à folha salarial nem criam um segundo pagamento.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows?.length ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Profissional</th>
              <th>Referência</th>
              <th>Data</th>
              <th>Valor apurado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.legacyKind}</td>
                <td>{r.data.name}</td>
                <td>{r.data.reference}</td>
                <td>{r.data.date}</td>
                <td>
                  {Number(r.data.amount || 0).toLocaleString("pt-AO", {
                    style: "currency",
                    currency: "AOA",
                  })}
                </td>
                <td>{r.data.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        rows && <p>Sem registos antigos nesta empresa.</p>
      )}
    </details>
  );
}

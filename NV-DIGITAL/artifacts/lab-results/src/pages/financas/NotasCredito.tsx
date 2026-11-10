import { useState } from "react";
import { useApp } from "../../store/AppContext";
import {
  generateFaturaHTML,
  downloadFatura,
} from "../../utils/faturaGenerator";
export default function NotasCredito() {
  const { data, addFatura } = useApp();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="space-y-4 p-5">
      <h1 className="text-xl font-bold">Notas de crédito</h1>
      {message && <p role="status">{message}</p>}
      <p className="text-sm">
        Rectificação integral da factura seleccionada, sem reposição automática
        de stock. Devoluções físicas devem ser conferidas e registadas na
        farmácia.
      </p>
      {data.faturas
        .filter(
          (f) =>
            ["emitida", "paga"].includes(f.estado) &&
            !["recibo", "nota-credito", "pro-forma"].includes(
              f.tipoDocumento || "",
            ),
        )
        .map((f) => (
          <article
            className="flex flex-wrap justify-between gap-3 rounded-xl border bg-white p-4"
            key={f.id}
          >
            <span>
              {f.numero} · {f.clienteNome} · {f.total}
            </span>
            <button
              disabled={busy}
              className="underline"
              onClick={async () => {
                const reason = prompt("Motivo da rectificação integral:");
                if (!reason?.trim()) return;
                setBusy(true);
                try {
                  await addFatura({
                    ...f,
                    faturaOrigemId: f.id,
                    data: new Date().toLocaleDateString("pt-PT"),
                    linhas: f.linhas.map((l) => ({
                      ...l,
                      quantidade: -Math.abs(l.quantidade),
                    })),
                    subtotalSemIva: -Math.abs(f.subtotalSemIva),
                    totalIva: -Math.abs(f.totalIva),
                    total: -Math.abs(f.total),
                    estado: "emitida",
                    tipoDocumento: "nota-credito",
                    observacoes: reason,
                  });
                  setMessage("Nota de crédito confirmada no servidor.");
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "Emissão não confirmada.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Criar nota de crédito
            </button>
          </article>
        ))}
      {data.faturas
        .filter((f) => f.tipoDocumento === "nota-credito")
        .map((f) => (
          <article key={f.id} className="rounded-xl border bg-white p-4">
            {f.numero} · {f.clienteNome} · {f.total}
            <button
              className="ml-3 underline"
              onClick={() =>
                downloadFatura(generateFaturaHTML(f, data.config), f.numero)
              }
            >
              Imprimir / PDF
            </button>
          </article>
        ))}
    </section>
  );
}

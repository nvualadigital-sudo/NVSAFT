import { useApp } from "../../store/AppContext";
import type { Session } from "../../store/auth";
import { useClinical } from "../medicos/clinica/store";
export default function Relatorios({ session }: { session?: Session }) {
  const { data } = useApp();
  const { state } = useClinical(session?.empresaId || "");
  return (
    <section className="space-y-4 p-5">
      <h1 className="text-2xl font-bold">Relatórios da instituição</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Pacientes", data.pacientes.length],
          ["Resultados", data.resultados.length],
          ["Consultas", state.visits.length],
          ["Documentos médicos", state.documents.length],
        ].map(([k, v]) => (
          <article className="rounded-xl border bg-white p-4" key={k}>
            <p>{k}</p>
            <strong className="text-2xl">{v}</strong>
          </article>
        ))}
      </div>
      {state.documents.map((d) => (
        <article className="rounded-xl border bg-white p-4" key={d.id}>
          <strong>{d.title}</strong>
          <p>
            {d.patient.nome} · {d.doctor}
          </p>
          <p className="whitespace-pre-wrap">{d.text}</p>
          <p>{d.voided ? "Anulado" : d.finalized ? "Emitido" : "Rascunho"}</p>
        </article>
      ))}
    </section>
  );
}

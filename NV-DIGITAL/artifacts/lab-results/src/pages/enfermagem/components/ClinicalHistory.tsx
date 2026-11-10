import type { WardKind } from "../shared";
import { useWardContext } from "../WardContext";
import { displayReference } from "../../../utils/displayReference";
export default function ClinicalHistory({ kind }: { kind: WardKind }) {
  const { state, patientId, day, patients } = useWardContext();
  const entries = state.events
    .filter(
      (e) =>
        e.kind === kind &&
        (!patientId || String(e.patientId) === patientId) &&
        e.when.slice(0, 10) === day,
    )
    .slice()
    .reverse();
  return (
    <div className="space-y-3">
      {!entries.length && (
        <p className="p-4 text-slate-500">
          Sem registos para esta data e selecção.
        </p>
      )}
      {entries.map((e) => (
        <article
          key={e.id}
          className="space-y-2 rounded-xl border bg-white p-4"
        >
          <strong>{e.title}</strong>
          <p className="text-sm">
            {patients.find((p) => p.idEnf === e.patientId)?.nomePaciente} ·{" "}
            {new Date(e.when).toLocaleString("pt-PT")}
          </p>
          <p className="whitespace-pre-wrap text-sm">{e.note}</p>
          {e.values && (
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              {Object.entries(e.values).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-slate-500">{key}</dt>
                  <dd className="whitespace-pre-wrap">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-xs text-slate-500">
            {e.author} · Gravado em{" "}
            {new Date(e.created).toLocaleString("pt-PT")} · <span title={String(e.id)}>Ref. {displayReference(e.id)}</span>
          </p>
        </article>
      ))}
    </div>
  );
}

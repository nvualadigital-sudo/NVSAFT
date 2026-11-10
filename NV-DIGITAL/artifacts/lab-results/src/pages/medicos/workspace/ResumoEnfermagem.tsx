import { useEffect, useState } from "react";
import { clinicalRequest } from "../../enfermagem/integrated/api";
import type { Observation } from "../../enfermagem/integrated/model";

const nursingBaseUrl = `${
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || ""
}/api/hospital/nursing-integrated`;

const observationLabels: Record<Observation["kind"], string> = {
  vitais: "Sinais vitais",
  balanco: "Balanço hídrico",
  evolucao: "Evolução de Enfermagem",
  incidente: "Incidente",
  triagem: "Triagem clínica",
  avaliacao: "Avaliação de risco",
  dispositivo: "Dispositivo",
  procedimento: "Procedimento",
};

export default function ResumoEnfermagem({
  patientId,
  triageId,
  visitStarted,
}: {
  patientId: string;
  triageId?: string;
  visitStarted: string;
}) {
  const [events, setEvents] = useState<Observation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await clinicalRequest(
          {
            baseUrl: nursingBaseUrl,
            getAccessToken: () =>
              sessionStorage.getItem("lab_token_emp_v4") || undefined,
          },
          "/bootstrap",
        );
        if (active) {
          setEvents(result.state.observations);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível ler os registos da Enfermagem.",
          );
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    const refreshOnFocus = () => void load();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [patientId, triageId, visitStarted]);

  const visitTime = new Date(visitStarted).getTime();
  const visibleEvents = events
    .filter(
      (event) =>
        event.patientId === patientId &&
        (event.id === triageId ||
          (Number.isFinite(visitTime) &&
            new Date(event.at).getTime() >= visitTime)),
    )
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Registos de Enfermagem deste episódio</h2>
      <p className="text-sm text-slate-600">
        Paciente central {patientId}
        {triageId ? ` · triagem vinculada ${triageId}` : ""}
      </p>
      {error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="rounded-xl border bg-white p-4 text-sm">
          A carregar os registos de Enfermagem…
        </p>
      ) : !visibleEvents.length ? (
        <p className="rounded-xl border bg-white p-4 text-sm">
          Ainda não há registos de Enfermagem associados a este episódio.
        </p>
      ) : (
        visibleEvents.map((event) => (
          <article className="rounded-xl border bg-white p-4" key={event.id}>
            <strong>{observationLabels[event.kind] || event.kind}</strong>
            <p className="text-sm text-slate-500">
              {new Date(event.at).toLocaleString("pt-PT")} · {event.author}
            </p>
            {event.kind === "triagem" && (
              <p className="text-sm font-medium">
                Prioridade: {String(event.values.priority || "não classificada")} ·
                Queixa: {String(event.values.complaint || "não informada")}
              </p>
            )}
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {Object.entries(event.values).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="font-medium">{key}:</dt>
                  <dd className="whitespace-pre-wrap">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))
      )}
    </div>
  );
}

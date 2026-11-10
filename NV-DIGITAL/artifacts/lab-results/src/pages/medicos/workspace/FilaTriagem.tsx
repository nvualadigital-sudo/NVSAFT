import { useEffect, useMemo, useRef, useState } from "react";
import {
  buttonStyle,
  ClinicalPatient,
  ClinicalSession,
  useClinical,
} from "../clinica/store";
import {
  openNursingTriages,
  triageMatchesPatient,
  TriageRow,
} from "../clinica/triage";
import { clinicalRequest } from "../../enfermagem/integrated/api";

const nursingBaseUrl = `${
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || ""
}/api/hospital/nursing-integrated`;

export default function FilaTriagem({
  session,
  selectedPatient,
  onSelectPatient,
  onStart,
}: {
  session: ClinicalSession;
  selectedPatient?: ClinicalPatient;
  onSelectPatient: (id: string) => void;
  onStart: (triageId: string, patientId: string) => Promise<string | undefined>;
}) {
  const [nursingState, setNursingState] = useState<
    Awaited<ReturnType<typeof clinicalRequest>>["state"] | undefined
  >();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState("");
  const [busyTriage, setBusyTriage] = useState("");
  const inFlight = useRef(false);
  const { state } = useClinical(session.empresaId!);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
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
          setNursingState(result.state);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar as triagens da Enfermagem.",
          );
      } finally {
        inFlight.current = false;
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
  }, [session.empresaId]);

  useEffect(() => setConfirmed(""), [selectedPatient?.id]);

  const rows: TriageRow[] = useMemo(
    () => openNursingTriages(nursingState, state),
    [nursingState, state],
  );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Pacientes triados pela Enfermagem</h2>
      <p className="text-sm text-slate-600">
        A fila apresenta as triagens clínicas registadas pela Enfermagem. Cada
        triagem é associada ao paciente pelo identificador do cadastro central.
      </p>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="rounded-xl border bg-white p-4 text-sm">
          A carregar as triagens…
        </p>
      )}
      {!loading && !error && !rows.length && (
        <p className="rounded-xl border bg-white p-6">
          Sem pacientes em espera nas triagens desta instituição.
        </p>
      )}
      {rows.map(({ event, patient }) => {
        const matches = triageMatchesPatient(event, selectedPatient);
        const priority = String(event.values.priority || "Não classificada");
        const triageTime = new Date(event.at);
        return (
          <article
            className="space-y-3 rounded-xl border bg-white p-4"
            key={event.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <strong>{patient.name}</strong>
                <p className="text-xs text-slate-500">
                  Processo {patient.code || "não informado"} · ID central{" "}
                  {patient.id}
                </p>
              </div>
              <span className="rounded border px-3 py-1 text-sm font-semibold">
                Prioridade: {priority}
              </span>
            </div>
            <p className="text-sm">
              {patient.sex || "Sexo não informado"} · Nascimento:{" "}
              {patient.birthDate || "Não informado"} · Alergias:{" "}
              {patient.allergies || "Não informadas — confirmar"}
            </p>
            <p className="text-sm">
              Queixa: {String(event.values.complaint || "Não informada")} ·{" "}
              {Number.isNaN(triageTime.getTime())
                ? "Data não informada"
                : triageTime.toLocaleString("pt-PT")}
            </p>
            <p className="text-sm">
              Discriminador: {String(event.values.discriminator || "Não informado")} ·
              Registado por: {event.author}
            </p>
            {selectedPatient && !matches && (
              <p role="alert" className="text-sm text-amber-800">
                O paciente seleccionado no cadastro central não corresponde a
                esta triagem. Seleccione o registo correcto para continuar.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {!matches && (
                <button
                  type="button"
                  className={buttonStyle}
                  onClick={() => onSelectPatient(event.patientId)}
                >
                  Seleccionar paciente central
                </button>
              )}
              {matches && (
                <label className="block text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed === event.id}
                    onChange={(e) =>
                      setConfirmed(e.target.checked ? event.id : "")
                    }
                  />{" "}
                  Confirmei a identidade com o registo de triagem.
                </label>
              )}
              <button
                type="button"
                disabled={!matches || confirmed !== event.id || !!busyTriage}
                className={buttonStyle}
                onClick={async () => {
                  setBusyTriage(event.id);
                  try {
                    await onStart(event.id, event.patientId);
                  } finally {
                    setBusyTriage("");
                  }
                }}
              >
                {busyTriage === event.id
                  ? "A abrir consulta…"
                  : "Receber para consulta"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

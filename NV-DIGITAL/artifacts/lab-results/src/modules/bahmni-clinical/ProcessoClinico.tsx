import { useState } from "react";
import type { ClinicalSession } from "../../pages/medicos/clinica/store";
import PatientDetails from "./PatientDetails";
import GenericServiceRequestTable from "./GenericServiceRequestTable";
import { formatDateTime } from "./patient-adapter";
import { useClinicalOverview } from "./useClinicalOverview";
import SourceAttribution from "./SourceAttribution";
import "./clinical-overview.css";

export type ClinicalArea =
  | "consulta"
  | "prescricoes"
  | "documentos"
  | "exames"
  | "enfermagem";
interface Props {
  session: ClinicalSession;
  patientId: string;
  episodeId?: string;
  onNavigate?: (area: ClinicalArea, visitId?: string) => void;
}
const fieldLabels: Record<string, string> = {
  priority: "Prioridade",
  complaint: "Queixa",
  temperature: "Temperatura",
  systolic: "Pressão sistólica",
  diastolic: "Pressão diastólica",
  heartRate: "Frequência cardíaca",
  respiratoryRate: "Frequência respiratória",
  oxygen: "Saturação",
  spo2: "SpO₂",
  weight: "Peso",
  height: "Altura",
  pain: "Dor",
  note: "Observação",
  notes: "Observações",
  assessment: "Avaliação",
  plan: "Plano",
  value: "Valor",
};

/** The existing NV record is read through a scoped adapter; the Bahmni widgets provide its patient and order views. */
export default function ProcessoClinico({
  session,
  patientId,
  episodeId,
  onNavigate,
}: Props) {
  const [history, setHistory] = useState(!episodeId);
  const activeEpisode = history ? undefined : episodeId;
  const { data, error, loading, refresh } = useClinicalOverview(
    session.empresaId || "",
    patientId,
    activeEpisode,
  );
  return (
    <section
      className="clinical-overview"
      aria-label="Processo clínico integrado"
    >
      <header className="co-heading">
        <div>
          <span className="co-eyebrow">ACOMPANHAMENTO DO PACIENTE</span>
          <h2>Processo clínico integrado</h2>
          <p>
            {session.empresaNome || "Instituição"} ·{" "}
            {history ? "Histórico do paciente" : "Atendimento seleccionado"}
          </p>
        </div>
        <button
          className="co-button co-button-secondary"
          type="button"
          disabled={loading}
          onClick={refresh}
        >
          {loading ? "A actualizar…" : "Actualizar"}
        </button>
      </header>
      {episodeId && (
        <div
          className="co-scope"
          role="group"
          aria-label="Período do processo clínico"
        >
          <button
            type="button"
            aria-pressed={!history}
            onClick={() => setHistory(false)}
          >
            Este atendimento
          </button>
          <button
            type="button"
            aria-pressed={history}
            onClick={() => setHistory(true)}
          >
            Histórico do paciente
          </button>
        </div>
      )}
      {error && (
        <p className="co-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="co-loading" role="status">
          A carregar o processo clínico do paciente…
        </p>
      )}
      {data && (
        <>
          <PatientDetails patient={data.patient} />
          <div className="co-alerts">
            <div>
              <strong>Alergias registadas</strong>
              <p>
                {data.patient.allergies ||
                  "Não informadas — confirmar com o paciente."}
              </p>
            </div>
            <div>
              <strong>Antecedentes registados</strong>
              <p>{data.patient.conditions || "Sem informação registada."}</p>
            </div>
          </div>
          {onNavigate && (
            <nav className="co-actions" aria-label="Acções do atendimento">
              {(
                [
                  ["consulta", "Consulta clínica"],
                  ["prescricoes", "Prescrições"],
                  ["documentos", "Documentos"],
                  ["exames", "Exames laboratoriais"],
                  ["enfermagem", "Enfermagem"],
                ] as [ClinicalArea, string][]
              ).map(([area, label]) => (
                <button
                  type="button"
                  className="co-button co-button-secondary"
                  key={area}
                  onClick={() => onNavigate(area)}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
          <div className="co-counts">
            {[
              ["Consultas", data.visits.length],
              ["Prescrições", data.prescriptions.length],
              ["Análises", data.laboratory.length],
              ["Documentos", data.documents.length],
            ].map(([label, count]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <section className="co-panel">
            <header>
              <h3>Consultas e evolução</h3>
              <span>{data.visits.length} registo(s)</span>
            </header>
            {!data.visits.length ? (
              <p className="co-empty">Sem consultas neste período.</p>
            ) : (
              data.visits.map((visit) => (
                <details className="co-record" key={visit.id}>
                  <summary>
                    <span>
                      <strong>{visit.specialty || "Consulta clínica"}</strong>
                      <small>
                        {
                          formatDateTime(visit.started, undefined, true)
                            .formattedResult
                        }{" "}
                        · {visit.doctor}
                      </small>
                    </span>
                    <span className="co-pill">
                      {visit.closed ? "Concluída" : "Aberta"}
                    </span>
                  </summary>
                  <p className="co-diagnosis">
                    {visit.diagnosis || "Diagnóstico não registado."}
                  </p>
                  <dl className="co-notes">
                    {[
                      ["Queixa e história", visit.subjective],
                      ["Exame objectivo", visit.objective],
                      ["Avaliação", visit.assessment],
                      ["Plano", visit.plan],
                      ["Seguimento", visit.followup],
                    ]
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                  {onNavigate && (
                    <button
                      type="button"
                      className="co-button co-button-secondary"
                      onClick={() => onNavigate("consulta", visit.id)}
                    >
                      Abrir esta consulta
                    </button>
                  )}
                </details>
              ))
            )}
          </section>
          <section className="co-panel">
            <header>
              <h3>Pedidos e resultados laboratoriais</h3>
              <span>{data.laboratory.length} análise(s)</span>
            </header>
            <GenericServiceRequestTable requests={data.laboratory} />
          </section>
          <div className="co-columns">
            <section className="co-panel">
              <header>
                <h3>Medicação prescrita e dispensada</h3>
              </header>
              {!data.prescriptions.length ? (
                <p className="co-empty">Sem prescrições neste período.</p>
              ) : (
                data.prescriptions.map((rx) => (
                  <article className="co-record" key={rx.id}>
                    <div className="co-record-title">
                      <strong>{rx.doctor}</strong>
                      <span className="co-pill">
                        {rx.cancelled ? "Suspensa" : "Emitida"}
                      </span>
                    </div>
                    <small>
                      {
                        formatDateTime(rx.created, undefined, true)
                          .formattedResult
                      }
                    </small>
                    {rx.items.map((item) => (
                      <div className="co-medication" key={item.id}>
                        <strong>{item.name}</strong>
                        <p>
                          {[
                            item.dose,
                            item.route,
                            item.frequency,
                            item.duration,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <small>
                          Prescrita: {item.quantity} {item.unit} · Dispensada:{" "}
                          {item.dispensed} {item.unit}
                        </small>
                      </div>
                    ))}
                    {onNavigate && (
                      <button
                        type="button"
                        className="co-button co-button-secondary"
                        onClick={() => onNavigate("prescricoes", rx.visitId)}
                      >
                        Abrir prescrição
                      </button>
                    )}
                  </article>
                ))
              )}
            </section>
            <section className="co-panel">
              <header>
                <h3>Documentos clínicos</h3>
              </header>
              {!data.documents.length ? (
                <p className="co-empty">Sem documentos neste período.</p>
              ) : (
                data.documents.map((doc) => (
                  <article className="co-record" key={doc.id}>
                    <div className="co-record-title">
                      <strong>
                        {doc.title || doc.kind || "Documento clínico"}
                      </strong>
                      <span className="co-pill">
                        {doc.voided
                          ? "Anulado"
                          : doc.finalized
                            ? "Emitido"
                            : "Rascunho"}
                      </span>
                    </div>
                    <small>
                      {
                        formatDateTime(doc.created, undefined, true)
                          .formattedResult
                      }
                    </small>
                    {onNavigate && (
                      <button
                        type="button"
                        className="co-button co-button-secondary"
                        onClick={() => onNavigate("documentos", doc.visitId)}
                      >
                        Abrir documento
                      </button>
                    )}
                  </article>
                ))
              )}
            </section>
          </div>
          <section className="co-panel">
            <header>
              <h3>Enfermagem</h3>
              <span>
                {history
                  ? "Registos do paciente"
                  : "Triagem associada ao atendimento"}
              </span>
            </header>
            {!data.nursing.length ? (
              <p className="co-empty">
                Sem registos associados neste período.
                {!history &&
                  " Consulte o histórico do paciente para ver outros registos de enfermagem."}
              </p>
            ) : (
              data.nursing.map((o) => (
                <details className="co-record" key={o.id}>
                  <summary>
                    <span>
                      <strong>
                        {(
                          {
                            triagem: "Triagem",
                            vitais: "Sinais vitais",
                            evolucao: "Evolução",
                            balanco: "Balanço",
                            incidente: "Incidente",
                            avaliacao: "Avaliação",
                            dispositivo: "Dispositivo",
                            procedimento: "Procedimento",
                          } as Record<string, string>
                        )[o.kind] || "Registo de enfermagem"}
                      </strong>
                      <small>
                        {formatDateTime(o.at, undefined, true).formattedResult}{" "}
                        · {o.author}
                      </small>
                    </span>
                  </summary>
                  <dl className="co-notes">
                    {Object.entries(o.values).map(([key, value]) => (
                      <div key={key}>
                        <dt>{fieldLabels[key] || key}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ))
            )}
          </section>
        </>
      )}
      <SourceAttribution />
    </section>
  );
}

export function ClinicalOverviewDisclosure(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className="co-disclosure">
      <button
        type="button"
        className="co-button co-button-secondary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Fechar processo clínico" : "Abrir processo clínico integrado"}
      </button>
      {open && (
        <ProcessoClinico
          key={
            props.session.empresaId +
            ":" +
            props.patientId +
            ":" +
            (props.episodeId || "")
          }
          {...props}
        />
      )}
    </section>
  );
}

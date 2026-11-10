import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  Target,
  UserCheck,
} from "lucide-react";
import { type Actor, type Care, type ClinicalState, allowed } from "./model";
import { formatStamp } from "./clinicalSelectors";
export function CarePlanBoard({
  state,
  actor,
  patientId,
  onAction,
  disabled,
}: {
  state: ClinicalState;
  actor: Actor;
  patientId: string;
  onAction: (care: Care) => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState("active");
  const all = state.care.filter((c) => !patientId || c.patientId === patientId);
  const rows = all
    .filter(
      (c) =>
        filter === "all" ||
        (filter === "active" && c.status !== "avaliado") ||
        (filter === "evaluation" && c.status === "realizado") ||
        (filter === "done" && c.status === "avaliado"),
    )
    .slice()
    .sort((a, b) => a.due.localeCompare(b.due));
  return (
    <section className="op-surface">
      <header className="op-section-head">
        <div>
          <div className="op-overline">PROCESSO DE ENFERMAGEM</div>
          <h2>Plano individual de cuidados</h2>
          <p>
            Diagnóstico e objectivo, execução identificada e reavaliação
            documentada.
          </p>
        </div>
        <div className="op-segment">
          {[
            { id: "active", label: "Em curso" },
            { id: "evaluation", label: "Por avaliar" },
            { id: "done", label: "Avaliados" },
            { id: "all", label: "Todos" },
          ].map((x) => (
            <button
              key={x.id}
              className={filter === x.id ? "active" : ""}
              onClick={() => setFilter(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
      </header>
      <div className="op-care-summary">
        <span>
          <b>{all.filter((c) => c.status === "planeado").length}</b>{" "}
          intervenções planeadas
        </span>
        <span>
          <b>{all.filter((c) => c.status === "realizado").length}</b> a aguardar
          avaliação
        </span>
        <span>
          <b>{all.filter((c) => c.status === "avaliado").length}</b> avaliadas
        </span>
      </div>
      <div className="op-care-list">
        {rows.map((c) => {
          const p = state.patients.find((p) => p.id === c.patientId),
            late = c.status === "planeado" && Date.parse(c.due) < Date.now();
          return (
            <article key={c.id}>
              <header>
                <div>
                  <span className="op-overline">
                    {p?.code} · {p?.name}
                  </span>
                  <h3>{c.diagnosis}</h3>
                </div>
                <span className={`op-care-status ${c.status}`}>
                  {c.status === "planeado"
                    ? "Intervenção planeada"
                    : c.status === "realizado"
                      ? "Intervenção realizada"
                      : "Resultado avaliado"}
                </span>
              </header>
              <div className="op-care-content">
                <div>
                  <span>
                    <Target size={14} />
                    Resultado esperado
                  </span>
                  <p>{c.goal}</p>
                </div>
                <div>
                  <span>
                    <ClipboardCheck size={14} />
                    Intervenção e frequência
                  </span>
                  <p>{c.intervention}</p>
                </div>
                <div>
                  <span>
                    <Clock3 size={14} />
                    Prazo / aprazamento
                  </span>
                  <p className={late ? "late" : ""}>
                    {formatStamp(c.due)}
                    {late && <small>Prazo ultrapassado</small>}
                  </p>
                </div>
              </div>
              <div className="op-care-progress">
                <div className="complete">
                  <i>
                    <Check size={12} />
                  </i>
                  <span>
                    <b>Plano registado</b>
                    <small>{c.author}</small>
                  </span>
                </div>
                <span className="op-progress-line" />
                <div className={c.status !== "planeado" ? "complete" : ""}>
                  <i>{c.status !== "planeado" ? <Check size={12} /> : "2"}</i>
                  <span>
                    <b>Intervenção</b>
                    <small>
                      {c.performedAt
                        ? `${formatStamp(c.performedAt)} · ${c.performedBy}`
                        : c.status !== "planeado"
                          ? "Registo anterior disponível na auditoria"
                          : "Por realizar"}
                    </small>
                  </span>
                </div>
                <span className="op-progress-line" />
                <div className={c.status === "avaliado" ? "complete" : ""}>
                  <i>{c.status === "avaliado" ? <Check size={12} /> : "3"}</i>
                  <span>
                    <b>Avaliação</b>
                    <small>
                      {c.evaluatedAt
                        ? `${formatStamp(c.evaluatedAt)} · ${c.evaluatedBy}`
                        : c.status === "avaliado"
                          ? "Registo anterior disponível na auditoria"
                          : "Por documentar"}
                    </small>
                  </span>
                </div>
              </div>
              {c.outcome && (
                <div className="op-care-outcome">
                  <CheckCheck size={16} />
                  <span>
                    <b>Avaliação do resultado</b>
                    <p>{c.outcome}</p>
                  </span>
                </div>
              )}
              <footer>
                <span>
                  <UserCheck size={14} />
                  Autoria: {c.author}
                </span>
                {c.status !== "avaliado" &&
                  allowed(actor, "enfermeiro", "chefe_enfermagem") && (
                    <button
                      disabled={disabled}
                      className="nc-btn primary"
                      onClick={() => onAction(c)}
                    >
                      {c.status === "planeado"
                        ? "Registar intervenção"
                        : "Avaliar resultado"}
                      <ArrowRight size={14} />
                    </button>
                  )}
              </footer>
            </article>
          );
        })}
        {!rows.length && (
          <div className="op-empty">
            <ClipboardCheck size={30} />
            <h3>Sem planos nesta selecção</h3>
            <p>
              Crie um plano com diagnóstico de enfermagem, resultado esperado e
              intervenção para acompanhar a execução.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

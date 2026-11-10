import { useEffect, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LayoutGrid,
  List,
  Pill,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import {
  type Actor,
  type Care,
  type ClinicalState,
  type Dose,
  type Episode,
  type Person,
  allowed,
} from "./model";
import {
  buildAgenda,
  currentEpisode,
  formatStamp,
  formatTime,
  isPendingDose,
  latestObservation,
  localDay,
  patientDoses,
  periodEnd,
} from "./clinicalSelectors";
export type ClinicalNavigate = (
  patientId: string,
  page?: "records" | "mar" | "care" | "handover" | "patients",
) => void;
type Actions = {
  onPatient: ClinicalNavigate;
  onRecord: (kind: string, patientId?: string) => void;
  onAssume: (e: Episode) => void;
  onDose: (dose: Dose) => void;
  onCare: (care: Care) => void;
  disabled: boolean;
};
export function ClinicalCensus({
  state,
  actor,
  patients,
  onPatient,
  onRecord,
  onAssume,
  disabled,
  compact = false,
}: {
  state: ClinicalState;
  actor: Actor;
  patients: Person[];
  compact?: boolean;
} & Pick<Actions, "onPatient" | "onRecord" | "onAssume" | "disabled">) {
  const [layout, setLayout] = useState<"rows" | "beds">("rows");
  useEffect(() => {
    const media = window.matchMedia("(max-width:680px)");
    const update = () => setLayout(media.matches ? "beds" : "rows");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const canNurse = allowed(actor, "enfermeiro", "chefe_enfermagem");
  if (!patients.length)
    return (
      <div className="op-empty">
        <BedDouble size={30} />
        <h3>Sem pacientes nesta selecção</h3>
        <p>
          Altere os filtros ou admita um paciente para iniciar o acompanhamento.
        </p>
      </div>
    );
  return (
    <div className="op-census">
      <div className="op-census-tools">
        <span>
          <i className="op-online-dot" />
          {patients.length} paciente(s) · dados do processo
        </span>
        <div className="op-segment">
          <button
            className={layout === "rows" ? "active" : ""}
            onClick={() => setLayout("rows")}
            aria-label="Vista em lista clínica"
          >
            <List size={15} /> Lista clínica
          </button>
          <button
            className={layout === "beds" ? "active" : ""}
            onClick={() => setLayout("beds")}
            aria-label="Vista em leitos"
          >
            <LayoutGrid size={15} /> Leitos
          </button>
        </div>
      </div>
      {layout === "rows" ? (
        <div className="op-table-scroll">
          <table className="op-census-table">
            <thead>
              <tr>
                <th>Leito / prioridade</th>
                <th>Paciente e situação clínica</th>
                <th>Últimas constantes</th>
                <th>Pendências</th>
                <th>Responsável / acções</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => {
                const e = currentEpisode(state, p.id),
                  v = latestObservation(state, p.id, "vitais"),
                  t = latestObservation(state, p.id, "triagem"),
                  ds = patientDoses(state, p.id).filter(isPendingDose),
                  cs = state.care.filter(
                    (c) => c.patientId === p.id && c.status === "planeado",
                  );
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="op-bed">
                        <BedDouble size={15} />
                        {e?.bed || "—"}
                      </span>
                      <small>{e?.ward || "Sem admissão"}</small>
                      {t && (
                        <span
                          className={`op-priority ${String(t.values.priority).toLowerCase()}`}
                        >
                          {t.values.priority}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="op-patient-link"
                        onClick={() => onPatient(p.id)}
                      >
                        {p.name}
                        <ChevronRight size={14} />
                      </button>
                      <small>
                        {p.code} · {e?.specialty || "Cadastro clínico"}
                      </small>
                      <p className="op-diagnosis">
                        {e?.diagnosis ||
                          p.conditions ||
                          "Sem diagnóstico de admissão registado"}
                      </p>
                      <span
                        className={`op-allergy ${/sem alergias conhecidas/i.test(p.allergies) ? "known" : "attention"}`}
                      >
                        <ShieldAlert size={12} />
                        {p.allergies}
                      </span>
                    </td>
                    <td>
                      {v ? (
                        <>
                          <div className="op-vital-line">
                            <b>
                              {v.values.systolic}/{v.values.diastolic}
                            </b>
                            <span>mmHg</span>
                            <i />
                            <b>{v.values.pulse}</b>
                            <span>bpm</span>
                          </div>
                          <div className="op-vital-line">
                            <b>{v.values.spo2}%</b>
                            <span>SpO₂</span>
                            <i />
                            <b>{v.values.temperature}°</b>
                            <span>Temp.</span>
                          </div>
                          <small>
                            <Clock3 size={11} />
                            {formatStamp(v.at)}
                          </small>
                        </>
                      ) : (
                        <span className="op-no-data">
                          Sem constantes registadas
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`op-task-pill ${ds.some((d) => Date.parse(d.due) < Date.now()) ? "late" : ""}`}
                        onClick={() => onPatient(p.id, "mar")}
                      >
                        <Pill size={13} />
                        {ds.length} dose(s)
                      </button>
                      <button
                        className="op-task-pill"
                        onClick={() => onPatient(p.id, "care")}
                      >
                        <ClipboardCheck size={13} />
                        {cs.length} cuidado(s)
                      </button>
                      {e?.status === "alta_autorizada" && (
                        <span className="op-pending-discharge">
                          Alta autorizada
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="op-assigned">
                        <UserCheck size={14} />
                        {e?.nurseName || "Sem enfermeiro atribuído"}
                      </span>
                      <div className="op-inline-actions">
                        <button
                          disabled={
                            disabled ||
                            !allowed(
                              actor,
                              "medico",
                              "enfermeiro",
                              "chefe_enfermagem",
                            )
                          }
                          onClick={() => onRecord("vitais", p.id)}
                        >
                          Constantes
                        </button>
                        {e &&
                          e.status === "activo" &&
                          canNurse &&
                          e.nurseId !== actor.id && (
                            <button
                              disabled={disabled}
                              onClick={() => onAssume(e)}
                            >
                              Assumir
                            </button>
                          )}
                        <button onClick={() => onPatient(p.id)}>
                          Processo <ArrowRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`op-bed-grid ${compact ? "compact" : ""}`}>
          {patients.map((p) => {
            const e = currentEpisode(state, p.id),
              t = latestObservation(state, p.id, "triagem"),
              v = latestObservation(state, p.id, "vitais"),
              ds = patientDoses(state, p.id).filter(isPendingDose);
            return (
              <article className="op-bed-card" key={p.id}>
                <header>
                  <span>
                    <BedDouble size={16} />
                    Leito {e?.bed || "—"}
                  </span>
                  {t && (
                    <span
                      className={`op-priority ${String(t.values.priority).toLowerCase()}`}
                    >
                      {t.values.priority}
                    </span>
                  )}
                </header>
                <button onClick={() => onPatient(p.id)}>
                  {p.name}
                  <ChevronRight size={16} />
                </button>
                <small>
                  {p.code} · {e?.ward || "Sem admissão"}
                </small>
                <p>{e?.diagnosis || "Sem diagnóstico de admissão registado"}</p>
                <div className="op-bed-constants">
                  {v ? (
                    <>
                      <span>
                        PA{" "}
                        <b>
                          {v.values.systolic}/{v.values.diastolic}
                        </b>{" "}
                        mmHg
                      </span>
                      <span>
                        FC <b>{v.values.pulse}</b> bpm
                      </span>
                      <span>
                        SpO₂ <b>{v.values.spo2}%</b>
                      </span>
                    </>
                  ) : (
                    <span>Sem constantes registadas</span>
                  )}
                </div>
                <span className="op-assigned">
                  <UserCheck size={13} />
                  {e?.nurseName || "Sem enfermeiro atribuído"}
                </span>
                {e &&
                  e.status === "activo" &&
                  canNurse &&
                  e.nurseId !== actor.id && (
                    <button
                      className="op-assume-card"
                      disabled={disabled}
                      onClick={() => onAssume(e)}
                    >
                      Assumir paciente
                    </button>
                  )}
                <footer>
                  <span>
                    <Pill size={14} />
                    {ds.length} pendentes
                  </span>
                  <button onClick={() => onPatient(p.id, "mar")}>
                    Abrir medicação <ArrowRight size={13} />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function ClinicalWorkbench({
  state,
  actor,
  patients,
  ...actions
}: { state: ClinicalState; actor: Actor; patients: Person[] } & Actions) {
  const [ward, setWard] = useState(""),
    [scope, setScope] = useState("all"),
    [day, setDay] = useState(localDay()),
    [period, setPeriod] = useState("day"),
    [taskKind, setTaskKind] = useState("all");
  const wards = Array.from(
    new Set(
      state.episodes.filter((e) => e.status !== "encerrado").map((e) => e.ward),
    ),
  ).sort();
  const active = patients.filter((p) => {
    const e = currentEpisode(state, p.id);
    return (
      !!e &&
      (!ward || e.ward === ward) &&
      (scope !== "mine" || e.nurseId === actor.id) &&
      (scope !== "pending" ||
        patientDoses(state, p.id).some(isPendingDose) ||
        state.care.some((c) => c.patientId === p.id && c.status === "planeado"))
    );
  });
  const agenda = buildAgenda(
    state,
    active.map((p) => p.id),
    periodEnd(day, period),
  );
  const tasks = agenda.filter((x) => taskKind === "all" || x.kind === taskKind);
  const meds = agenda.filter((x) => x.kind === "dose"),
    care = agenda.filter((x) => x.kind === "care"),
    handover = agenda.filter((x) => x.kind === "handover");
  const critical = active.filter((p) =>
    ["Vermelho", "Laranja"].includes(
      String(latestObservation(state, p.id, "triagem")?.values.priority),
    ),
  ).length;
  return (
    <div className="op-workbench">
      <div className="op-work-controls">
        <div className="op-ward-control">
          <HospitalIcon />
          <label>
            Unidade assistencial
            <select
              aria-label="Filtrar serviço assistencial"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            >
              <option value="">Todos os serviços</option>
              {wards.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="op-period">
          <label>
            Data
            <input
              aria-label="Data da agenda"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value || localDay())}
            />
          </label>
          <label>
            Até ao fim do período
            <select
              aria-label="Período da agenda"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="day">Dia completo · 24h</option>
              <option value="morning">Manhã · até 14h</option>
              <option value="afternoon">Tarde · até 22h</option>
              <option value="night">Noite · até 06h do dia seguinte</option>
            </select>
          </label>
        </div>
      </div>
      <div className="op-metrics">
        {[
          {
            label: "Pacientes em acompanhamento",
            value: active.length,
            sub: `${active.filter((p) => currentEpisode(state, p.id)?.nurseId === actor.id).length} sob a minha responsabilidade`,
            icon: Users,
            tone: "navy",
          },
          {
            label: "Medicação por realizar",
            value: meds.length,
            sub: `${meds.filter((x) => x.late).length} com horário ultrapassado`,
            icon: Pill,
            tone: meds.some((x) => x.late) ? "amber" : "teal",
          },
          {
            label: "Cuidados planeados",
            value: care.length,
            sub: `${care.filter((x) => x.late).length} com prazo ultrapassado`,
            icon: ClipboardCheck,
            tone: "teal",
          },
          {
            label: "Passagens por receber",
            value: handover.length,
            sub: `${critical} prioridade(s) vermelha / laranja registada(s)`,
            icon: ArrowRight,
            tone: "blue",
          },
        ].map((k) => (
          <div className={`op-metric ${k.tone}`} key={k.label}>
            <span className="op-metric-icon">
              <k.icon size={21} />
            </span>
            <div>
              <span>{k.label}</span>
              <strong>{k.value}</strong>
              <small>{k.sub}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="op-main-grid">
        <section className="op-surface">
          <header className="op-section-head">
            <div>
              <div className="op-overline">CENSO ASSISTENCIAL</div>
              <h2>
                Pacientes do posto <span>{active.length}</span>
              </h2>
            </div>
            <div className="op-segment">
              {[
                { id: "all", label: "Todos" },
                { id: "mine", label: "Meus pacientes" },
                { id: "pending", label: "Com pendências" },
              ].map((x) => (
                <button
                  className={scope === x.id ? "active" : ""}
                  key={x.id}
                  onClick={() => setScope(x.id)}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </header>
          <ClinicalCensus
            state={state}
            actor={actor}
            patients={active}
            {...actions}
          />
        </section>
        <aside className="op-surface op-agenda">
          <header className="op-section-head">
            <div>
              <div className="op-overline">EXECUÇÃO E CONTINUIDADE</div>
              <h2>Agenda assistencial</h2>
            </div>
            <span className="op-count">{tasks.length}</span>
          </header>
          <div className="op-agenda-tabs">
            {[
              { id: "all", label: "Tudo" },
              { id: "dose", label: "Medicação" },
              { id: "care", label: "Cuidados" },
            ].map((x) => (
              <button
                className={taskKind === x.id ? "active" : ""}
                key={x.id}
                onClick={() => setTaskKind(x.id)}
              >
                {x.label}
              </button>
            ))}
          </div>
          <p className="op-agenda-note">
            Inclui pendências anteriores até ao fim do período seleccionado.
          </p>
          <div className="op-agenda-items">
            {tasks.slice(0, 30).map((item) => {
              const p = state.patients.find((p) => p.id === item.patientId)!;
              return (
                <article
                  className={`op-agenda-item ${item.late ? "overdue" : ""}`}
                  key={item.id}
                >
                  <div className="op-task-time">
                    <span>{formatTime(item.due)}</span>
                    <small>
                      {new Date(item.due).toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </small>
                  </div>
                  <div className="op-task-content">
                    <span className="op-task-kind">
                      {item.kind === "dose"
                        ? "MEDICAÇÃO"
                        : item.kind === "care"
                          ? "CUIDADO"
                          : "PASSAGEM DE TURNO"}
                      {item.late && <b>Prazo ultrapassado</b>}
                    </span>
                    <button
                      className="op-patient-link"
                      onClick={() => actions.onPatient(p.id)}
                    >
                      {p.name}
                    </button>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    {item.dose ? (
                      <button
                        className="op-task-action"
                        disabled={actions.disabled}
                        onClick={() => actions.onDose(item.dose!)}
                      >
                        {item.dose.status === "dispensada" &&
                        allowed(actor, "enfermeiro", "chefe_enfermagem")
                          ? "Conferir e administrar"
                          : item.dose.status === "aguarda_farmacia" &&
                              allowed(actor, "farmaceutico")
                            ? "Validar dispensa"
                            : "Consultar prescrição"}
                        <ArrowRight size={13} />
                      </button>
                    ) : item.care ? (
                      <button
                        className="op-task-action"
                        disabled={
                          actions.disabled ||
                          !allowed(actor, "enfermeiro", "chefe_enfermagem")
                        }
                        onClick={() => actions.onCare(item.care!)}
                      >
                        Registar intervenção
                        <Check size={13} />
                      </button>
                    ) : (
                      <button
                        className="op-task-action"
                        onClick={() => actions.onPatient(p.id, "handover")}
                      >
                        Abrir passagem
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {!tasks.length && (
              <div className="op-empty small">
                <CheckCheck size={27} />
                <h3>Sem pendências nesta selecção</h3>
                <p>
                  As prescrições e planos de cuidados alimentam esta agenda
                  automaticamente.
                </p>
              </div>
            )}
            {tasks.length > 30 && (
              <p className="op-agenda-note">
                Mais {tasks.length - 30} pendências. Use o mapa de medicação ou
                os planos para consultar a lista completa.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
function HospitalIcon() {
  return (
    <span className="op-hospital-symbol">
      <BedDouble size={23} />
    </span>
  );
}

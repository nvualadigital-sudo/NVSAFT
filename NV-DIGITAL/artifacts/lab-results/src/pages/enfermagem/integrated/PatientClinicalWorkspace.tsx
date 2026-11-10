import { useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Droplets,
  FileText,
  HeartPulse,
  Pill,
  Plus,
  ShieldAlert,
  Stethoscope,
  Syringe,
  UserCheck,
  Users,
} from "lucide-react";
import {
  type Actor,
  type ClinicalState,
  type Observation,
  type Person,
  allowed,
} from "./model";
import {
  currentEpisode,
  formatPatientAge,
  fluidBalance,
  formatStamp,
  latestObservation,
  observationLabels,
  patientDoses,
  isPendingDose,
} from "./clinicalSelectors";
import { type ClinicalNavigate } from "./ClinicalWorkbench";
import { delivered, useClinical } from "../../medicos/clinica/store";
const soapier = [
  ["subjective", "S", "Subjectivo"],
  ["objective", "O", "Objectivo"],
  ["analysis", "A", "Avaliação"],
  ["plan", "P", "Plano"],
  ["intervention", "I", "Intervenção"],
  ["evaluation", "E", "Evolução / resultado"],
  ["reassessment", "R", "Reavaliação"],
] as const;
export function PatientClinicalWorkspace({
  state,
  actor,
  patient,
  patients,
  onPatient,
  onRecord,
  onWristband,
  onHandover,
  disabled,
}: {
  state: ClinicalState;
  actor: Actor;
  patient?: Person;
  patients: Person[];
  onPatient: ClinicalNavigate;
  onRecord: (kind: string, patientId?: string) => void;
  onWristband: (p: Person) => void;
  onHandover: () => void;
  disabled: boolean;
}) {
  const [tab, setTab] = useState("overview"),
    [kind, setKind] = useState("all"),
    [limit, setLimit] = useState(12);
  const {
    state: medicalState,
    error: medicalError,
  } = useClinical(actor.tenantId);
  const canWrite = allowed(actor, "medico", "enfermeiro", "chefe_enfermagem");
  if (!patient)
    return (
      <section className="op-surface">
        <header className="op-section-head">
          <div>
            <div className="op-overline">PROCESSO DE ENFERMAGEM</div>
            <h2>Seleccionar paciente</h2>
            <p>
              Abra um processo para consultar constantes, evoluções, cuidados e
              dispositivos.
            </p>
          </div>
          <Users size={24} />
        </header>
        <div className="op-patient-picker">
          {patients.map((p) => {
            const e = currentEpisode(state, p.id);
            return (
              <button key={p.id} onClick={() => onPatient(p.id)}>
                <span className="nc-avatar">
                  {p.name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.code} · {e ? `${e.ward} / ${e.bed}` : "Sem admissão"}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            );
          })}
          {!patients.length && (
            <div className="op-empty">
              <FileText size={28} />
              <h3>Sem pacientes registados</h3>
              <p>O cadastro central alimenta os processos da unidade.</p>
            </div>
          )}
        </div>
      </section>
    );
  const p = patient,
    e = currentEpisode(state, p.id),
    v = latestObservation(state, p.id, "vitais"),
    risk = latestObservation(state, p.id, "avaliacao"),
    triage = latestObservation(state, p.id, "triagem");
  const records = state.observations
    .filter((o) => o.patientId === p.id)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
  const balance = fluidBalance(state, p.id),
    doses = patientDoses(state, p.id).filter(isPendingDose),
    plans = state.care.filter(
      (c) => c.patientId === p.id && c.status !== "avaliado",
    );
  const vitals = records
    .filter((o) => o.kind === "vitais")
    .slice()
    .reverse();
  const age = () => formatPatientAge(p.birthDate);
  const write = (k: string) => onRecord(k, p.id);
  const prescriptions = medicalState.prescriptions
    .filter((rx) => String(rx.patient?.id) === p.id)
    .slice()
    .reverse();
  return (
    <div className="op-patient-workspace">
      <section className="op-patient-identity">
        <div className="op-identity-top">
          <span className="op-bed">
            <BedDouble size={17} />
            {e ? `${e.ward} · ${e.bed}` : "Processo sem admissão"}
          </span>
          <span className="op-patient-status">
            {e?.status === "alta_autorizada"
              ? "Alta médica autorizada"
              : e
                ? "Episódio activo"
                : "Cadastro clínico"}
          </span>
          <button className="nc-btn" onClick={() => onWristband(p)}>
            Pulseira QR
          </button>
        </div>
        <div className="op-identity-main">
          <span className="op-large-avatar">
            {p.name
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <div className="op-overline">PROCESSO {p.code}</div>
            <h2>{p.name}</h2>
            <p>
              {p.birthDate || "Nascimento não registado"}{" "}
              {age() && `· ${age()}`} ·{" "}
              {({ M: "Masculino", F: "Feminino" } as Record<string, string>)[
                p.sex
              ] ||
                p.sex ||
                "Sexo não registado"}{" "}
              {e?.specialty && `· ${e.specialty}`}
            </p>
          </div>
        </div>
        <div className="op-identity-bottom">
          <div>
            <Stethoscope size={16} />
            <span>
              <small>Diagnóstico / motivo de admissão</small>
              <strong>
                {e?.diagnosis || "Sem diagnóstico de admissão registado"}
              </strong>
            </span>
          </div>
          <div>
            <UserCheck size={16} />
            <span>
              <small>Enfermeiro responsável</small>
              <strong>{e?.nurseName || "Ainda não atribuído"}</strong>
            </span>
          </div>
        </div>
        <div className="op-allergy-banner">
          <ShieldAlert size={17} />
          <span>
            <b>Alergias e segurança</b>
            {p.allergies}
          </span>
          {triage && (
            <span
              className={`op-priority ${String(triage.values.priority).toLowerCase()}`}
            >
              Última triagem: {triage.values.priority}
            </span>
          )}
        </div>
      </section>
      <section className="op-surface space-y-3">
        <header className="op-section-head">
          <div>
            <div className="op-overline">PRESCRIÇÕES DO MÉDICO</div>
            <h3>Medicação e estado da dispensa</h3>
            <p>
              Receitas deste paciente, partilhadas com a Farmácia. A
              administração continua a ser registada no mapa de Enfermagem.
            </p>
          </div>
          <Pill size={20} />
        </header>
        {medicalError && (
          <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Não foi possível actualizar as prescrições médicas: {medicalError}
          </p>
        )}
        {!prescriptions.length ? (
          <p className="text-sm text-slate-600">
            Nenhuma prescrição médica está associada a este paciente.
          </p>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((rx) => (
              <article className="rounded-lg border bg-white p-3" key={rx.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>
                    {rx.specialty || "Especialidade não registada"} ·{" "}
                    {rx.doctor}
                  </strong>
                  <span className="text-xs text-slate-500">
                    {rx.cancelled
                      ? "Suspensa"
                      : new Date(rx.validUntil) < new Date()
                        ? "Expirada"
                        : "Válida até " +
                          new Date(rx.validUntil).toLocaleDateString("pt-PT")}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {rx.registration} ·{" "}
                  {new Date(rx.created).toLocaleString("pt-PT")}
                  {rx.diagnosis ? ` · Diagnóstico: ${rx.diagnosis}` : ""}
                </p>
                <div className="mt-2 space-y-2">
                  {rx.items.map((item) => (
                    <div
                      className="rounded bg-slate-50 p-2 text-sm"
                      key={item.id}
                    >
                      <strong>{item.name}</strong> · {item.dose} · {item.route} ·{" "}
                      {item.frequency} · {item.duration}
                      <p className="text-xs text-slate-600">
                        Quantidade prescrita: {item.quantity} {item.unit} ·
                        Dispensada pela Farmácia:{" "}
                        {delivered(medicalState, rx.id, item.id)} {item.unit}
                      </p>
                      {item.instructions && <p>{item.instructions}</p>}
                    </div>
                  ))}
                </div>
                {rx.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{rx.notes}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="op-record-actions">
        {[
          { kind: "vitais", label: "Registar constantes", icon: HeartPulse },
          { kind: "evolucao", label: "Evoluir · SOAPIER", icon: FileText },
          { kind: "avaliacao", label: "Avaliar riscos", icon: ShieldAlert },
          { kind: "balanco", label: "Balanço hídrico", icon: Droplets },
          {
            kind: "procedimento",
            label: "Procedimento / curativo",
            icon: ClipboardCheck,
          },
          { kind: "dispositivo", label: "Dispositivo", icon: Syringe },
          { kind: "triagem", label: "Triagem / reavaliação", icon: Activity },
        ].map((x) => (
          <button
            disabled={disabled || !canWrite}
            onClick={() => write(x.kind)}
            key={x.kind}
          >
            <x.icon size={18} />
            {x.label}
            <Plus size={13} />
          </button>
        ))}
      </div>
      <nav className="op-record-tabs" aria-label="Secções do processo clínico">
        {[
          { id: "overview", label: "Visão clínica" },
          { id: "notes", label: "Evoluções e registos" },
          { id: "vitals", label: "Constantes e tendências" },
          { id: "balance", label: "Balanço de 24h" },
          { id: "devices", label: "Dispositivos / procedimentos" },
        ].map((x) => (
          <button
            key={x.id}
            className={tab === x.id ? "active" : ""}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </nav>
      {(tab === "overview" || tab === "vitals") && (
        <div className="op-vital-cards">
          {[
            {
              label: "Pressão arterial",
              value: v ? `${v.values.systolic}/${v.values.diastolic}` : "—",
              unit: "mmHg",
              icon: Activity,
            },
            {
              label: "Frequência cardíaca",
              value: v?.values.pulse ?? "—",
              unit: "bpm",
              icon: HeartPulse,
            },
            {
              label: "Saturação periférica",
              value: v?.values.spo2 ?? "—",
              unit: "SpO₂ %",
              icon: Activity,
            },
            {
              label: "Temperatura",
              value: v?.values.temperature ?? "—",
              unit: "°C",
              icon: Activity,
            },
          ].map((x) => (
            <article key={x.label}>
              <span>
                <x.icon size={17} />
                {x.label}
              </span>
              <strong>
                {x.value}
                <small>{x.unit}</small>
              </strong>
              <footer>
                {v ? (
                  <>
                    <Clock3 size={11} />
                    {formatStamp(v.at)}
                  </>
                ) : (
                  "Ainda sem registo"
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
      {tab === "overview" && (
        <div className="op-patient-columns">
          <div>
            <section className="op-surface">
              <header className="op-section-head">
                <div>
                  <div className="op-overline">EVOLUÇÃO E CONTINUIDADE</div>
                  <h2>Últimos registos clínicos</h2>
                </div>
                <button className="op-link" onClick={() => setTab("notes")}>
                  Ver todos
                  <ArrowRight size={14} />
                </button>
              </header>
              <ObservationTimeline
                records={records
                  .filter((o) => !["vitais", "balanco"].includes(o.kind))
                  .slice(0, 4)}
              />
            </section>
            <section className="op-surface">
              <header className="op-section-head">
                <div>
                  <h2>Constantes nas últimas observações</h2>
                  <p>
                    Valores registados pela equipa, sem classificação clínica
                    automática.
                  </p>
                </div>
                <button className="op-link" onClick={() => setTab("vitals")}>
                  Abrir tendências
                  <ArrowRight size={14} />
                </button>
              </header>
              <VitalTrend records={vitals.slice(-8)} />
            </section>
          </div>
          <aside>
            <section className="op-surface">
              <header className="op-section-head">
                <div>
                  <div className="op-overline">PREVENÇÃO E SEGURANÇA</div>
                  <h2>Avaliação de riscos</h2>
                </div>
                <ShieldAlert size={19} />
              </header>
              <div className="op-risk-list">
                {[
                  ["Queda", risk?.values.fallRisk],
                  ["Lesão por pressão", risk?.values.pressureRisk],
                  ["Mobilidade", risk?.values.mobility],
                  ["Integridade cutânea", risk?.values.skin],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <small>{label}</small>
                    <strong>{value || "Não registado"}</strong>
                  </div>
                ))}
                <p>
                  {risk
                    ? `${risk.author} · ${formatStamp(risk.at)}`
                    : "Sem avaliação de enfermagem registada."}
                </p>
              </div>
            </section>
            <section className="op-surface">
              <header className="op-section-head">
                <h2>Pendências do paciente</h2>
              </header>
              <div className="op-patient-pending">
                <button onClick={() => onPatient(p.id, "mar")}>
                  <span>
                    <PillIcon />
                    {doses.length} administrações pendentes
                  </span>
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => onPatient(p.id, "care")}>
                  <span>
                    <ClipboardCheck size={17} />
                    {plans.length} plano(s) a executar / avaliar
                  </span>
                  <ChevronRight size={16} />
                </button>
                <button onClick={onHandover}>
                  <span>
                    <Users size={17} />
                    Passagem de turno · SBAR
                  </span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>
            <BalanceSummary
              balance={balance}
              onOpen={() => setTab("balance")}
            />
            {p.conditions && (
              <section className="op-surface">
                <header className="op-section-head">
                  <h2>Antecedentes registados</h2>
                </header>
                <p className="op-background-note">{p.conditions}</p>
              </section>
            )}
          </aside>
        </div>
      )}
      {tab === "notes" && (
        <section className="op-surface">
          <header className="op-section-head">
            <div>
              <h2>Evoluções e registos de enfermagem</h2>
              <p>Autoria, data e sequência do processo clínico.</p>
            </div>
            <select
              aria-label="Tipo de registo clínico"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setLimit(12);
              }}
            >
              <option value="all">Todos os registos</option>
              {Object.entries(observationLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </header>
          <ObservationTimeline
            records={records
              .filter((o) => kind === "all" || o.kind === kind)
              .slice(0, limit)}
          />
          {records.filter((o) => kind === "all" || o.kind === kind).length >
            limit && (
            <button
              className="nc-btn op-more"
              onClick={() => setLimit((n) => n + 12)}
            >
              Mostrar mais registos
            </button>
          )}
        </section>
      )}
      {tab === "vitals" && (
        <>
          <section className="op-surface">
            <header className="op-section-head">
              <div>
                <h2>Tendência das constantes</h2>
                <p>Apenas observações medidas e registadas no processo.</p>
              </div>
            </header>
            <VitalTrend records={vitals.slice(-12)} />
          </section>
          <section className="op-surface">
            <header className="op-section-head">
              <h2>Folha de constantes</h2>
            </header>
            <div className="op-table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Data / hora",
                      "PA (mmHg)",
                      "FC (bpm)",
                      "FR (/min)",
                      "SpO₂ (%)",
                      "Temp. (°C)",
                      "Dor (0–10)",
                      "Profissional",
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vitals
                    .slice()
                    .reverse()
                    .map((o) => (
                      <tr key={o.id}>
                        <td>{formatStamp(o.at)}</td>
                        <td>
                          {o.values.systolic}/{o.values.diastolic}
                        </td>
                        <td>{o.values.pulse}</td>
                        <td>{o.values.respiration}</td>
                        <td>{o.values.spo2}</td>
                        <td>{o.values.temperature}</td>
                        <td>{o.values.pain}</td>
                        <td>{o.author}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!vitals.length && (
                <div className="op-empty small">
                  <HeartPulse size={27} />
                  <h3>Sem constantes registadas</h3>
                  <p>Utilize «Registar constantes» para iniciar a folha.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
      {tab === "balance" && (
        <>
          <BalanceSummary balance={balance} />
          <section className="op-surface">
            <header className="op-section-head">
              <div>
                <h2>Entradas e saídas · últimas 24 horas</h2>
                <p>Janela móvel de 24 horas até ao momento actual.</p>
              </div>
              <button
                disabled={disabled || !canWrite}
                className="nc-btn primary"
                onClick={() => write("balanco")}
              >
                <Plus size={15} />
                Lançar volume
              </button>
            </header>
            <div className="op-table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Data / hora",
                      "Tipo",
                      "Origem / líquido",
                      "Volume (mL)",
                      "Profissional",
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balance.rows
                    .slice()
                    .reverse()
                    .map((o) => (
                      <tr key={o.id}>
                        <td>{formatStamp(o.at)}</td>
                        <td>
                          <span
                            className={`op-fluid-type ${o.values.direction}`}
                          >
                            {o.values.direction === "entrada" ? (
                              <ArrowDownLeft size={13} />
                            ) : (
                              <ArrowUpRight size={13} />
                            )}{" "}
                            {o.values.direction === "entrada"
                              ? "Entrada"
                              : "Saída"}
                          </span>
                        </td>
                        <td>{o.values.source}</td>
                        <td>
                          <strong>{o.values.ml}</strong>
                        </td>
                        <td>{o.author}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!balance.rows.length && (
                <div className="op-empty small">
                  <Droplets size={27} />
                  <h3>Sem volumes registados nas últimas 24h</h3>
                  <p>O saldo representa apenas os volumes documentados.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
      {tab === "devices" && (
        <section className="op-surface">
          <header className="op-section-head">
            <div>
              <h2>Dispositivos, procedimentos e curativos</h2>
              <p>
                Histórico de inserção, manutenção, avaliação e retirada; não
                presume que um dispositivo continua activo.
              </p>
            </div>
            <button
              disabled={disabled || !canWrite}
              className="nc-btn"
              onClick={() => write("dispositivo")}
            >
              <Plus size={15} />
              Registar dispositivo
            </button>
          </header>
          <ObservationTimeline
            records={records.filter((o) =>
              ["dispositivo", "procedimento"].includes(o.kind),
            )}
          />
        </section>
      )}
    </div>
  );
}
function PillIcon() {
  return <Syringe size={17} />;
}
function BalanceSummary({
  balance,
  onOpen,
}: {
  balance: ReturnType<typeof fluidBalance>;
  onOpen?: () => void;
}) {
  return (
    <section className="op-surface op-fluid-summary">
      <header className="op-section-head">
        <div>
          <div className="op-overline">BALANÇO HÍDRICO</div>
          <h2>Últimas 24 horas</h2>
        </div>
        {onOpen && (
          <button className="op-link" onClick={onOpen}>
            Detalhar
            <ArrowRight size={14} />
          </button>
        )}
      </header>
      <div>
        {[
          { label: "Entradas", value: balance.input, cls: "entry" },
          { label: "Saídas", value: balance.output, cls: "exit" },
          {
            label: "Saldo documentado",
            value: balance.balance,
            cls: "balance",
          },
        ].map((x) => (
          <article className={x.cls} key={x.label}>
            <small>{x.label}</small>
            <strong>
              {x.value.toLocaleString("pt-PT")}
              <span>mL</span>
            </strong>
          </article>
        ))}
      </div>
      <p>
        {balance.rows.length} lançamento(s) no período. Ausência de registo não
        significa ausência de volume.
      </p>
    </section>
  );
}
export function ObservationTimeline({ records }: { records: Observation[] }) {
  return records.length ? (
    <div className="op-observation-timeline">
      {records.map((o) => (
        <article key={o.id}>
          <span className={`op-record-icon ${o.kind}`}>
            <span>
              {o.kind === "evolucao" ? (
                <FileText size={17} />
              ) : o.kind === "vitais" ? (
                <HeartPulse size={17} />
              ) : o.kind === "dispositivo" ? (
                <Syringe size={17} />
              ) : (
                <ClipboardCheck size={17} />
              )}
            </span>
          </span>
          <div className="op-record-content">
            <header>
              <strong>{observationLabels[o.kind]}</strong>
              <span>{formatStamp(o.at)}</span>
            </header>
            <p className="op-record-author">
              {o.author}
              {o.values.format === "SOAPIER" && <b>SOAPIER</b>}
            </p>
            {o.values.format === "SOAPIER" ? (
              <div className="op-soapier">
                {soapier.map(([key, letter, label]) => (
                  <div key={key}>
                    <b>{letter}</b>
                    <span>
                      <strong>{label}</strong>
                      <p>{o.values[key]}</p>
                    </span>
                  </div>
                ))}
              </div>
            ) : o.kind === "vitais" ? (
              <p className="op-record-values">
                PA {o.values.systolic}/{o.values.diastolic} mmHg · FC{" "}
                {o.values.pulse} bpm · FR {o.values.respiration}/min · SpO₂{" "}
                {o.values.spo2}% · Temp. {o.values.temperature} °C · Dor{" "}
                {o.values.pain}/10
              </p>
            ) : o.kind === "balanco" ? (
              <p>
                {o.values.direction === "entrada" ? "Entrada" : "Saída"}:{" "}
                {o.values.ml} mL · {o.values.source}
              </p>
            ) : o.kind === "triagem" ? (
              <>
                <span
                  className={`op-priority ${String(o.values.priority).toLowerCase()}`}
                >
                  {o.values.priority}
                </span>
                <p>{o.values.complaint}</p>
                <p>{o.values.discriminator}</p>
              </>
            ) : (
              <>
                {o.kind === "avaliacao" && (
                  <dl className="op-record-assessment">
                    {[
                      ["Consciência", "consciousness"],
                      ["Pele", "skin"],
                      ["Mobilidade", "mobility"],
                      ["Queda", "fallRisk"],
                      ["Lesão por pressão", "pressureRisk"],
                    ].map(([l, k]) => (
                      <div key={k}>
                        <dt>{l}</dt>
                        <dd>{o.values[k]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {o.kind === "dispositivo" && (
                  <p>
                    <b>
                      {o.values.device} · {o.values.action}
                    </b>
                    <br />
                    {o.values.site}
                  </p>
                )}
                {o.kind === "procedimento" && (
                  <p>
                    <b>{o.values.procedure}</b>
                  </p>
                )}
                <p>{o.values.note}</p>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  ) : (
    <div className="op-empty small">
      <FileText size={27} />
      <h3>Ainda sem registos nesta secção</h3>
      <p>
        Os registos datados e identificados ficam disponíveis à equipa neste
        processo.
      </p>
    </div>
  );
}
function VitalTrend({ records }: { records: Observation[] }) {
  const [metric, setMetric] = useState("pulse");
  const labels: Record<string, { name: string; unit: string }> = {
    pulse: { name: "Frequência cardíaca", unit: "bpm" },
    spo2: { name: "Saturação periférica", unit: "%" },
    temperature: { name: "Temperatura", unit: "°C" },
    respiration: { name: "Frequência respiratória", unit: "/min" },
  };
  const selected = records.filter((o) => typeof o.values[metric] === "number");
  const values = selected.map((o) => Number(o.values[metric]));
  const min = values.length ? Math.min(...values) : 0,
    max = values.length ? Math.max(...values) : 1,
    span = Math.max(max - min, metric === "temperature" ? 0.5 : 2);
  const low = min - span * 0.3,
    high = max + span * 0.3;
  const points = selected.map((o, i) => ({
    x: 50 + i * (600 / Math.max(selected.length - 1, 1)),
    y: 170 - ((Number(o.values[metric]) - low) / (high - low)) * 140,
    o,
  }));
  return (
    <div className="op-vital-trend">
      <div className="op-trend-toolbar">
        <div className="op-segment">
          {Object.entries(labels).map(([k]) => (
            <button
              key={k}
              className={metric === k ? "active" : ""}
              onClick={() => setMetric(k)}
            >
              {k === "pulse"
                ? "FC"
                : k === "spo2"
                  ? "SpO₂"
                  : k === "temperature"
                    ? "Temp."
                    : "FR"}
            </button>
          ))}
        </div>
        <span>
          {labels[metric].name} · {labels[metric].unit}
        </span>
      </div>
      {points.length ? (
        <svg
          viewBox="0 0 700 220"
          role="img"
          aria-label={`Tendência de ${labels[metric].name}: ${values.join(", ")} ${labels[metric].unit}`}
        >
          <g>
            {[0, 1, 2, 3].map((i) => {
              const y = 30 + (i * 140) / 3;
              return (
                <g key={i}>
                  <line
                    x1="50"
                    x2="660"
                    y1={y}
                    y2={y}
                    stroke="#e7edf1"
                    strokeDasharray="3 4"
                  />
                  <text x="40" y={y + 4} textAnchor="end">
                    {(high - (i * (high - low)) / 3).toFixed(
                      metric === "temperature" ? 1 : 0,
                    )}
                  </text>
                </g>
              );
            })}
          </g>
          {points.length > 1 && (
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#0b8278"
              strokeWidth="2.5"
            />
          )}
          {points.map(({ x, y, o }, i) => (
            <g key={o.id}>
              <circle
                cx={x}
                cy={y}
                r="4.5"
                fill="#0b8278"
                stroke="white"
                strokeWidth="2"
              >
                <title>
                  {formatStamp(o.at)}: {o.values[metric]} {labels[metric].unit}
                </title>
              </circle>
              <text
                x={x}
                y={y - 12}
                textAnchor="middle"
                className="op-chart-value"
              >
                {o.values[metric]}
              </text>
              {(selected.length <= 6 || i % 2 === 0) && (
                <text x={x} y="202" textAnchor="middle">
                  {new Date(o.at).toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </text>
              )}
            </g>
          ))}
        </svg>
      ) : (
        <div className="op-empty small">
          <HeartPulse size={26} />
          <h3>Sem medições para esta constante</h3>
          <p>O gráfico é construído apenas com os valores registados.</p>
        </div>
      )}
    </div>
  );
}

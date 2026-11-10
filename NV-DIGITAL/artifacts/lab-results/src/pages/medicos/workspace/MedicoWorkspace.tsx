import { MEDICAL_SPECIALTIES } from "@workspace/api-zod";
import { useResource } from "../../comunicacao/shared";
import Laboratorio from "../../laboratorio/Laboratorio";
import { useState, useEffect } from "react";
import type { Session } from "../../../store/auth";
import {
  buttonStyle,
  ClinicalPatient,
  ClinicalSession,
  commitClinical,
  inputStyle,
  useClinical,
  Visit,
} from "../clinica/store";
import Consulta from "./Consulta";
import Documentos from "./Documentos";
import FilaTriagem from "./FilaTriagem";
import Prescricoes from "./Prescricoes";
import ResumoEnfermagem from "./ResumoEnfermagem";

export interface MedicalProps {
  session: ClinicalSession;
  visit: Visit;
  doctor: string;
  registration: string;
  onMessage: (s: string) => void;
}
const tabs = [
  ["fila", "Fila / triagem"],
  ["consulta", "Consulta clínica"],
  ["prescricoes", "Prescrições"],
  ["documentos", "Documentos médicos"],
  ["enfermagem", "Enfermagem"],
  ["historico", "Histórico"],
  ["exames", "Exames laboratoriais"],
] as const;
export default function MedicoWorkspace({
  session,
  patients,
  specialty = "Clínica Geral",
}: {
  session: ClinicalSession;
  patients: ClinicalPatient[];
  specialty?: string;
}) {
  const org = session.empresaId!;
  const settings = useResource<any>("/institution", null);
  const professional = useResource<any>("/professionals/me", null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(specialty);
  const { state, error } = useClinical(org);
  const [tab, setTab] = useState("fila");
  const [visitId, setVisitId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [doctor, setDoctor] = useState("");
  const [registration, setRegistration] = useState("");
  useEffect(() => {
    const current = professional.data;
    if (current?.funcionarioId) {
      setDoctor(current.name);
      setRegistration(current.profile.credential || "");
      const profileSpecialties = String(current.profile.specialties || "")
        .split(/[;,]/)
        .map((value: string) => value.trim())
        .filter(Boolean);
      const configuredSpecialty = profileSpecialties.find((value: string) =>
        /medicina dent[aá]ria|estomatologia/i.test(value),
      );
      if (specialty === "Clínica Geral" && configuredSpecialty)
        setSelectedSpecialty(configuredSpecialty);
    }
  }, [professional.data, specialty]);
  const visit = state.visits.find((v) => v.id === visitId);
  const patient = patients.find((p) => String(p.id) === patientId);
  const filtered = patients.filter((p) =>
    `${p.nome} ${p.bi || ""} ${p.processo || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  async function start(triageId?: string, triagePatientId?: string) {
    try {
      if (!patient)
        throw new Error("Seleccione o paciente no cadastro central.");
      if (
        triageId &&
        (!triagePatientId || String(patient.id) !== triagePatientId)
      )
        throw new Error(
          "O paciente seleccionado não corresponde ao identificador central desta triagem.",
        );
      if (!doctor.trim() || !registration.trim() || !session.username)
        throw new Error(
          "Preencha nome e registo profissional do médico e utilize uma sessão identificada.",
        );
      const existing = state.visits.find(
        (v) => !v.closed && String(v.patient.id) === String(patient.id),
      );
      if (existing) {
        if (triageId && existing.triageId !== triageId)
          throw new Error(
            "Já existe uma consulta aberta deste paciente. Resolva-a antes de receber outro episódio de triagem.",
          );
        setVisitId(existing.id);
        setTab("consulta");
        return existing.id;
      }
      const id = crypto.randomUUID();
      const item: Visit = {
        id,
        specialty: selectedSpecialty,
        owner: session.username,
        patient: { ...patient },
        triageId,
        started: new Date().toISOString(),
        doctor: doctor.trim(),
        registration: registration.trim(),
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        diagnosis: "",
        followup: "",
      };
      await commitClinical(
        org,
        session.username,
        "Consulta iniciada",
        id,
        (s) => {
          if (
            s.visits.some(
              (v) =>
                (triageId && v.triageId === triageId) ||
                (!v.closed && String(v.patient.id) === String(patient.id)),
            )
          )
            throw new Error("Esta triagem já foi recebida.");
          return { ...s, visits: [...s.visits, item] };
        },
      );
      setVisitId(id);
      setTab("consulta");
      setMessage("Consulta iniciada.");
      return id;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao iniciar.");
      return undefined;
    }
  }
  const props = visit
    ? {
        session,
        visit,
        doctor: visit.doctor,
        registration: visit.registration,
        onMessage: setMessage,
      }
    : null;
  return (
    <section className="space-y-4 bg-slate-50 p-4 text-slate-900 md:p-6">
      <header className="rounded-xl bg-teal-800 p-5 text-white">
        <h1 className="text-2xl font-bold">
          Atendimento Clínico · {selectedSpecialty}
        </h1>
        <p>
          {session.empresaNome || "Instituição"} · {session.username}
        </p>
        <p className="mt-2 text-xs">
          Documentos e receitas usam a identificação, a especialidade e as imagens profissionais guardadas na emissão. A credencial é verificada em Instituição e acessos.
        </p>
      </header>
      {professional.data&&!professional.data.canIssue&&<p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">A emissão de receitas e documentos exige uma conta individual de médico com credencial vigente verificada em Instituição e acessos. Pode preparar a consulta e os rascunhos.</p>}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Consultas abertas", state.visits.filter((v) => !v.closed).length],
          ["Consultas concluídas", state.visits.filter((v) => v.closed).length],
          ["Prescrições", state.prescriptions.length],
          ["Documentos", state.documents.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">{k}</p>
            <strong className="text-2xl">{v}</strong>
          </div>
        ))}
      </div>
      {(message || error) && (
        <p
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          {error || message}
        </p>
      )}
      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
        <label className="text-sm">
          Especialidade do atendimento
          <select
            className={inputStyle}
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
          >
            {[
              ...new Set([
                selectedSpecialty,
                ...MEDICAL_SPECIALTIES,
                "Estomatologia",
                "Estomatologia / Medicina Dentária",
                ...(settings.data?.data.specialties || []),
              ]),
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Nome completo do médico
          <input
            className={inputStyle}
            value={doctor}
            readOnly={Boolean(professional.data?.funcionarioId)}
            onChange={(e) => setDoctor(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Registo profissional
          <input
            className={inputStyle}
            value={registration}
            readOnly={Boolean(professional.data?.profile?.credential)}
            onChange={(e) => setRegistration(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Pesquisar paciente
          <input
            className={inputStyle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Paciente do cadastro central
          <select
            aria-label="Paciente central"
            className={inputStyle}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · BI {p.bi || "não informado"} · Processo{" "}
                {p.processo || p.id}
              </option>
            ))}
          </select>
        </label>
        <button className={buttonStyle} onClick={() => start()}>
          Abrir consulta do paciente
        </button>
        <label className="text-sm">
          Consulta em trabalho
          <select
            aria-label="Consulta em trabalho"
            className={inputStyle}
            value={visitId}
            onChange={(e) => {
              setVisitId(e.target.value);
              setTab("consulta");
            }}
          >
            <option value="">Seleccionar</option>
            {state.visits
              .slice()
              .reverse()
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.patient.nome} ·{" "}
                  {new Date(v.started).toLocaleDateString("pt-PT")} ·{" "}
                  {v.closed ? "Concluída" : "Aberta"}
                </option>
              ))}
          </select>
        </label>
      </div>
      {visit && (
        <div className="rounded-lg border border-teal-300 bg-teal-50 p-3 text-sm">
          <strong>{visit.patient.nome}</strong> · BI{" "}
          {visit.patient.bi || "Não informado"} · Alergias:{" "}
          {visit.patient.alergias ||
            "Não informadas — confirmar com o paciente"}{" "}
          · {visit.closed ? "Consulta concluída" : "Consulta aberta"}
          <p className="text-xs">
            Médico do episódio: {visit.doctor} · {visit.registration}
          </p>
        </div>
      )}
      <nav className="flex flex-wrap gap-2" aria-label="Áreas do Médico">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg border px-3 py-2 text-sm ${tab === key ? "bg-teal-700 text-white" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "fila" ? (
        <FilaTriagem
          session={session}
          selectedPatient={patient}
          onSelectPatient={(id) => {
            setPatientId(id);
            setQuery("");
            setMessage("");
          }}
          onStart={start}
        />
      ) : tab === "exames" ? (
        <Laboratorio
          session={session as Session}
          initialPatientId={visit ? Number(visit.patient.id) : undefined}
          initialEpisodeId={visit?.id}
        />
      ) : tab === "historico" ? (
        <div className="space-y-3">
          {state.visits
            .filter((v) => !patientId || String(v.patient.id) === patientId)
            .slice()
            .reverse()
            .map((v) => (
              <article key={v.id} className="rounded-xl border bg-white p-4">
                <strong>{v.patient.nome}</strong>
                <p className="text-sm">
                  {new Date(v.started).toLocaleString("pt-PT")} · {v.doctor} ·{" "}
                  {v.closed ? "Concluída" : "Aberta"}
                </p>
                <p className="whitespace-pre-wrap text-sm">{v.diagnosis}</p>
                <button
                  className={buttonStyle}
                  onClick={async () => {
                    setVisitId(v.id);
                    setTab("consulta");
                  }}
                >
                  Abrir episódio
                </button>
              </article>
            ))}
        </div>
      ) : !props ? (
        <p className="rounded-xl border bg-white p-6">
          Seleccione ou abra uma consulta para trabalhar nesta área.
        </p>
      ) : tab === "consulta" ? (
        <Consulta key={visit!.id} {...props} />
      ) : tab === "prescricoes" ? (
        <Prescricoes key={visit!.id} {...props} />
      ) : tab === "documentos" ? (
        <Documentos key={visit!.id} {...props} />
      ) : (
        <ResumoEnfermagem
          patientId={String(visit!.patient.id)}
          triageId={visit!.triageId}
          visitStarted={visit!.started}
        />
      )}
    </section>
  );
}

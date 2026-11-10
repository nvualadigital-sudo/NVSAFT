import { useState } from "react";
import { buttonStyle, commitClinical, inputStyle } from "../clinica/store";
import { MedicalProps } from "./MedicoWorkspace";
import DentistryAssessmentEditor from "./DentistryAssessmentEditor";
import {
  isDentistrySpecialty,
  normalizeDentalAssessment,
} from "./dentistry";
export default function Consulta({ session, visit, onMessage }: MedicalProps) {
  const [f, setF] = useState({
    subjective: visit.subjective,
    objective: visit.objective,
    assessment: visit.assessment,
    plan: visit.plan,
    diagnosis: visit.diagnosis,
    followup: visit.followup,
  });
  const [extra, setExtra] = useState<Record<string, string>>(
    visit.specialtyData || {},
  );
  const [dentistry, setDentistry] = useState(() =>
    normalizeDentalAssessment(visit.dentistry),
  );
  const dentalSpecialty = isDentistrySpecialty(visit.specialty);
  const [confirmed, setConfirmed] = useState(false);
  async function save(close = false) {
    try {
      if (
        close &&
        (!confirmed ||
          ![f.subjective, f.assessment, f.plan, f.diagnosis].every((v) =>
            v.trim(),
          ))
      )
        throw new Error(
          "Complete queixa/história, avaliação, diagnóstico e plano e confirme a revisão para concluir.",
        );
      await commitClinical(
        session.empresaId!,
        session.username!,
        close ? "Consulta concluída" : "Evolução guardada",
        visit.id,
        (s) => {
          const current = s.visits.find((v) => v.id === visit.id);
          if (!current || current.closed || current.owner !== session.username)
            throw new Error("Consulta indisponível ou já concluída.");
          const when = new Date().toISOString();
          const revision = {
            when,
            author: session.username!,
            subjective: current.subjective,
            objective: current.objective,
            assessment: current.assessment,
            plan: current.plan,
            diagnosis: current.diagnosis,
            followup: current.followup,
            specialtyData: current.specialtyData,
            dentistry: current.dentistry,
          };
          return {
            ...s,
            visits: s.visits.map((v) =>
              v.id === visit.id
                ? {
                    ...v,
                    ...f,
                    specialtyData: extra,
                    dentistry: dentalSpecialty
                      ? { ...dentistry, updatedAt: when }
                      : current.dentistry,
                    history: [...(v.history || []), revision],
                    ...(close ? { closed: when } : {}),
                  }
                : v,
            ),
          };
        },
      );
      onMessage(
        close
          ? "Consulta concluída. Registo preservado."
          : "Evolução guardada.",
      );
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Falha ao guardar.");
    }
  }
  return (
    <div className="space-y-4 rounded-xl border bg-white p-5">
      {dentalSpecialty && (
        <DentistryAssessmentEditor
          value={dentistry}
          onChange={setDentistry}
          disabled={!!visit.closed}
        />
      )}
      {visit.specialty && !dentalSpecialty && (
        <fieldset className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
          <legend className="font-bold">Registo de {visit.specialty}</legend>
          {(visit.specialty === "Nutrição"
            ? [
                "Peso (kg)",
                "Altura (cm)",
                "Avaliação alimentar",
                "Objectivos acordados",
                "Plano alimentar",
              ]
            : visit.specialty === "Ginecologia"
              ? [
                  "Data da última menstruação",
                  "Antecedentes obstétricos",
                  "Gestações e partos",
                  "Avaliação ginecológica",
                  "Plano e seguimento",
                ]
              : visit.specialty === "Cardiologia"
                ? [
                    "Pressão arterial",
                    "Frequência cardíaca",
                    "Antecedentes cardiovasculares",
                    "Descrição / referência do ECG",
                    "Plano e seguimento",
                  ]
                : ["Antecedentes relevantes", "Exame clínico complementar"]
          ).map((label) => (
            <label key={label} className="text-sm">
              {label}
              <textarea
                className={inputStyle}
                value={extra[label] || ""}
                onChange={(e) =>
                  setExtra({ ...extra, [label]: e.target.value })
                }
              />
            </label>
          ))}
        </fieldset>
      )}
      <h2 className="text-lg font-bold">Consulta e evolução clínica</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            "subjective",
            "objective",
            "assessment",
            "diagnosis",
            "plan",
            "followup",
          ] as const
        ).map((key, i) => (
          <label key={key} className="text-sm">
            {
              [
                "Queixa, história e sintomas (S)",
                "Exame físico e achados (O)",
                "Avaliação clínica (A)",
                "Diagnósticos / códigos informados pelo médico",
                "Plano e conduta (P)",
                "Orientações, retorno e sinais de alarme definidos pelo médico",
              ][i]
            }
            <textarea
              disabled={!!visit.closed}
              className={inputStyle}
              rows={5}
              value={f[key]}
              onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      {!visit.closed && (
        <>
          <label className="block text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            Revisei os dados clínicos e a conduta antes de concluir.
          </label>
          <div className="flex gap-3">
            <button className={buttonStyle} onClick={() => save()}>
              Guardar evolução
            </button>
            <button className={buttonStyle} onClick={() => save(true)}>
              Concluir consulta
            </button>
          </div>
        </>
      )}
      <details className="text-sm">
        <summary>
          Versões anteriores da evolução ({visit.history?.length || 0})
        </summary>
        {visit.history?.map((v, i) => {
          const dentalTeeth = Object.entries(v.dentistry?.teeth || {})
            .filter(
              ([, tooth]) =>
                tooth.condition !== "saudavel" ||
                tooth.surfaces.length > 0 ||
                Boolean(tooth.note),
            )
            .map(([id, tooth]) => `${id}: ${tooth.condition}`)
            .join(", ");
          return (
            <div key={i} className="my-3 rounded border p-3">
              <p>
                {new Date(v.when).toLocaleString("pt-PT")} · {v.author}
              </p>
              <p className="whitespace-pre-wrap">
                {[
                  "História: " + v.subjective,
                  "Exame: " + v.objective,
                  "Avaliação: " + v.assessment,
                  "Diagnóstico: " + v.diagnosis,
                  "Plano: " + v.plan,
                  "Retorno: " + v.followup,
                ].join("\n\n")}
              </p>
              {v.dentistry && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  <strong>Registo dentário guardado</strong>
                  <p>
                    Dor:{" "}
                    {v.dentistry.painScore === ""
                      ? "não registada"
                      : `${v.dentistry.painScore}/10`}
                    {dentalTeeth ? ` · Dentes: ${dentalTeeth}` : ""}
                  </p>
                  {v.dentistry.procedures.length > 0 && (
                    <p>
                      Procedimentos:{" "}
                      {v.dentistry.procedures
                        .map(
                          (item) =>
                            `${item.procedure}${item.tooth ? ` (${item.tooth})` : ""} — ${item.status}`,
                        )
                        .join("; ")}
                    </p>
                  )}
                  {v.dentistry.generalNotes && (
                    <p className="whitespace-pre-wrap">
                      {v.dentistry.generalNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </details>
    </div>
  );
}

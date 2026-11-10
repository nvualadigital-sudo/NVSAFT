import type {
  ClinicalState as NursingState,
  Observation,
  Person,
} from "../../enfermagem/integrated/model";
import type { ClinicalState, ClinicalPatient } from "./store";

export interface TriageRow {
  event: Observation;
  patient: Person;
}

const priorityOrder: Record<string, number> = {
  Vermelho: 0,
  Laranja: 1,
  Amarelo: 2,
  Verde: 3,
  Azul: 4,
};

/**
 * The medical queue reads the same server-backed observations written by the
 * current nursing module. A triage already linked to a medical visit is not
 * offered again, and records are joined by the central patient ID only.
 */
export function openNursingTriages(
  nursing: Pick<NursingState, "patients" | "observations"> | undefined,
  medical: Pick<ClinicalState, "visits">,
): TriageRow[] {
  if (!nursing) return [];
  const linked = new Set(
    medical.visits.map((visit) => visit.triageId).filter(Boolean),
  );
  const latestByPatient = new Map<string, Observation>();

  for (const event of nursing.observations) {
    if (event.kind !== "triagem") continue;
    const previous = latestByPatient.get(event.patientId);
    if (!previous || event.at > previous.at)
      latestByPatient.set(event.patientId, event);
  }

  const patients = new Map(nursing.patients.map((patient) => [patient.id, patient]));
  return [...latestByPatient.values()]
    .flatMap((event) => {
      if (linked.has(event.id)) return [];
      const patient = patients.get(event.patientId);
      return patient ? [{ event, patient }] : [];
    })
    .sort((a, b) => {
      const aPriority = String(a.event.values.priority || "");
      const bPriority = String(b.event.values.priority || "");
      return (
        (priorityOrder[aPriority] ?? 99) -
          (priorityOrder[bPriority] ?? 99) ||
        a.event.at.localeCompare(b.event.at)
      );
    });
}

export function triageMatchesPatient(
  event: Observation,
  patient: ClinicalPatient | undefined,
) {
  return Boolean(patient && String(patient.id) === event.patientId);
}

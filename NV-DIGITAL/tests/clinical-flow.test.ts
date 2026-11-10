import assert from "node:assert/strict";
import test from "node:test";
import type {
  ClinicalState as NursingState,
  Observation,
  Person,
} from "../artifacts/lab-results/src/pages/enfermagem/integrated/model";
import type {
  ClinicalPatient,
  ClinicalState,
  Visit,
} from "../artifacts/lab-results/src/pages/medicos/clinica/store";
import {
  openNursingTriages,
  triageMatchesPatient,
} from "../artifacts/lab-results/src/pages/medicos/clinica/triage";
import {
  createDentalAssessment,
  isDentistrySpecialty,
  normalizeDentalAssessment,
} from "../artifacts/lab-results/src/pages/medicos/workspace/dentistry";

function triage(
  id: string,
  patientId: string,
  at: string,
  priority: string,
): Observation {
  return {
    id,
    patientId,
    kind: "triagem",
    at,
    author: "Enfermagem",
    values: { priority, complaint: "Dor", discriminator: "Dor intensa" },
  };
}

test("the medical queue shows the latest unlinked triage for a central patient", () => {
  const patients: Person[] = [
    {
      id: "patient-1",
      code: "PROC-1",
      name: "Ana",
      birthDate: "1990-01-01",
      sex: "F",
      allergies: "",
      conditions: "",
    },
    {
      id: "patient-2",
      code: "PROC-2",
      name: "Ana",
      birthDate: "1980-01-01",
      sex: "F",
      allergies: "",
      conditions: "",
    },
  ];
  const nursing = {
    patients,
    observations: [
      triage("old", "patient-1", "2026-01-01T09:00:00Z", "Verde"),
      triage("latest", "patient-1", "2026-01-01T10:00:00Z", "Vermelho"),
      triage("old-linked", "patient-2", "2026-01-01T07:00:00Z", "Verde"),
      triage("linked", "patient-2", "2026-01-01T08:00:00Z", "Amarelo"),
      triage("orphan", "patient-deleted", "2026-01-01T11:00:00Z", "Laranja"),
    ],
  } as Pick<NursingState, "patients" | "observations">;
  const medical = {
    visits: [{ triageId: "linked" } as Visit],
  } as Pick<ClinicalState, "visits">;

  const result = openNursingTriages(nursing, medical);
  assert.deepEqual(
    result.map(({ event, patient }) => [event.id, patient.id]),
    [["latest", "patient-1"]],
  );
});

test("a similar patient name cannot satisfy the triage identity check", () => {
  const event = triage("triage-1", "patient-1", "2026-01-01T10:00:00Z", "Verde");
  const wrongPatient: ClinicalPatient = {
    id: "patient-2",
    nome: "Ana",
  };
  assert.equal(triageMatchesPatient(event, wrongPatient), false);
  assert.equal(
    triageMatchesPatient(event, { ...wrongPatient, id: "patient-1" }),
    true,
  );
});

test("the dental assessment starts with a complete, editable FDI chart", () => {
  const assessment = createDentalAssessment();
  assert.equal(Object.keys(assessment.teeth).length, 32);
  assert.equal(assessment.teeth["18"].condition, "saudavel");
  assert.equal(assessment.teeth["48"].surfaces.length, 0);
  assert.equal(isDentistrySpecialty("Medicina Dentária"), true);
  assert.equal(isDentistrySpecialty("Estomatologia"), true);
  assert.equal(isDentistrySpecialty("Cardiologia"), false);
});

test("old or incomplete dental data is normalized without losing valid findings", () => {
  const normalized = normalizeDentalAssessment({
    teeth: {
      "11": { condition: "carie", surfaces: ["M"], note: "Vestibular" },
      "99": { condition: "carie", surfaces: ["O"], note: "fora do FDI" },
    },
  });
  assert.equal(normalized.teeth["11"].condition, "carie");
  assert.deepEqual(normalized.teeth["11"].surfaces, ["M"]);
  assert.equal(normalized.teeth["18"].condition, "saudavel");
  assert.equal(Object.hasOwn(normalized.teeth, "99"), false);
});

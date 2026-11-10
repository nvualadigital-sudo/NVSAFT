export const UPPER_RIGHT_TEETH = [
  "18", "17", "16", "15", "14", "13", "12", "11",
] as const;
export const UPPER_LEFT_TEETH = [
  "21", "22", "23", "24", "25", "26", "27", "28",
] as const;
export const LOWER_RIGHT_TEETH = [
  "48", "47", "46", "45", "44", "43", "42", "41",
] as const;
export const LOWER_LEFT_TEETH = [
  "31", "32", "33", "34", "35", "36", "37", "38",
] as const;

export const PERMANENT_TEETH = [
  ...UPPER_RIGHT_TEETH,
  ...UPPER_LEFT_TEETH,
  ...LOWER_RIGHT_TEETH,
  ...LOWER_LEFT_TEETH,
] as const;

export const TOOTH_SURFACES = [
  ["O", "Oclusal"],
  ["M", "Mesial"],
  ["D", "Distal"],
  ["V", "Vestibular"],
  ["L", "Lingual / palatina"],
] as const;

export const TOOTH_CONDITIONS = [
  ["saudavel", "Sem alteração"],
  ["carie", "Cárie"],
  ["restaurado", "Restaurado"],
  ["endodontia", "Tratamento endodôntico"],
  ["ausente", "Ausente"],
  ["extraccao", "Extracção indicada"],
  ["coroa", "Coroa / prótese"],
  ["implante", "Implante"],
  ["selante", "Selante"],
] as const;

export type ToothCondition = (typeof TOOTH_CONDITIONS)[number][0];
export type DentalProcedureStatus =
  | "planeado"
  | "em_curso"
  | "concluido"
  | "cancelado";

export interface DentalToothRecord {
  condition: ToothCondition;
  surfaces: string[];
  note: string;
}

export interface DentalProcedure {
  id: string;
  tooth: string;
  procedure: string;
  status: DentalProcedureStatus;
  note: string;
}

export interface DentalAssessment {
  version: 1;
  updatedAt?: string;
  history: string;
  painScore: number | "";
  sensitivity: string;
  bleedingGums: string;
  lastVisitDate: string;
  oralHygieneFrequency: string;
  flossing: string;
  bruxism: string;
  tobaccoUse: string;
  mucosa: string;
  gingiva: string;
  periodontal: string;
  occlusion: string;
  generalNotes: string;
  teeth: Record<string, DentalToothRecord>;
  procedures: DentalProcedure[];
}

export function isDentistrySpecialty(value?: string) {
  return /medicina dent[aá]ria|estomatologia/i.test(value || "");
}

export function createDentalAssessment(): DentalAssessment {
  return {
    version: 1,
    history: "",
    painScore: "",
    sensitivity: "",
    bleedingGums: "",
    lastVisitDate: "",
    oralHygieneFrequency: "",
    flossing: "",
    bruxism: "",
    tobaccoUse: "",
    mucosa: "",
    gingiva: "",
    periodontal: "",
    occlusion: "",
    generalNotes: "",
    teeth: Object.fromEntries(
      PERMANENT_TEETH.map((tooth) => [
        tooth,
        { condition: "saudavel", surfaces: [], note: "" },
      ]),
    ),
    procedures: [],
  };
}

export function normalizeDentalAssessment(
  value?: Partial<DentalAssessment> | null,
): DentalAssessment {
  const defaults = createDentalAssessment();
  const sourceTeeth =
    value?.teeth && typeof value.teeth === "object" ? value.teeth : {};
  for (const tooth of PERMANENT_TEETH) {
    const record = sourceTeeth[tooth];
    if (!record || typeof record !== "object") continue;
    const allowed = TOOTH_CONDITIONS.map(([key]) => key) as string[];
    defaults.teeth[tooth] = {
      condition: allowed.includes(record.condition)
        ? record.condition
        : "saudavel",
      surfaces: Array.isArray(record.surfaces)
        ? record.surfaces.filter((surface) =>
            TOOTH_SURFACES.some(([code]) => code === surface),
          )
        : [],
      note: typeof record.note === "string" ? record.note : "",
    };
  }
  const procedures = Array.isArray(value?.procedures)
    ? value.procedures
        .filter(
          (procedure) =>
            procedure &&
            typeof procedure.id === "string" &&
            typeof procedure.procedure === "string",
        )
        .map((procedure) => ({
          id: procedure.id,
          tooth: PERMANENT_TEETH.includes(
            procedure.tooth as (typeof PERMANENT_TEETH)[number],
          )
            ? procedure.tooth
            : "",
          procedure: procedure.procedure,
          status: [
            "planeado",
            "em_curso",
            "concluido",
            "cancelado",
          ].includes(procedure.status)
            ? procedure.status
            : "planeado",
          note: typeof procedure.note === "string" ? procedure.note : "",
        }))
    : [];

  return {
    ...defaults,
    ...value,
    version: 1,
    painScore:
      typeof value?.painScore === "number" &&
      value.painScore >= 0 &&
      value.painScore <= 10
        ? value.painScore
        : "",
    teeth: defaults.teeth,
    procedures,
  };
}

import { readRemote, updateRemote } from "../../../store/hospital";
import { useEffect, useState } from "react";
import type { DentalAssessment } from "../workspace/dentistry";
export interface ClinicalSession {
  empresaId?: string;
  empresaNome?: string;
  username?: string;
}
export interface ClinicalPatient {
  id: number | string;
  nome: string;
  bi?: string;
  nasc?: string;
  dataNascimento?: string;
  sexo?: string;
  alergias?: string;
  telefone?: string;
  processo?: string;
}
export interface Visit {
  specialty?: string;
  specialtyData?: Record<string, string>;
  dentistry?: DentalAssessment;
  id: string;
  owner: string;
  patient: ClinicalPatient;
  triageId?: string;
  wardPatientId?: number;
  started: string;
  doctor: string;
  registration: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnosis: string;
  followup: string;
  closed?: string;
  history?: {
    when: string;
    author: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    diagnosis: string;
    followup: string;
    specialtyData?: Record<string, string>;
    dentistry?: DentalAssessment;
  }[];
}
export interface Medication {
  id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: number;
  unit: string;
  instructions: string;
}
export interface Prescription {
  id: string;
  visitId: string;
  patient: ClinicalPatient;
  specialty?: string;
  diagnosis?: string;
  wardPatientId?: number;
  doctor: string;
  registration: string;
  created: string;
  validUntil: string;
  items: Medication[];
  notes: string;
  cancelled?: string;
  cancelReason?: string;
}
export interface Delivery {
  id: string;
  prescriptionId: string;
  itemId: string;
  quantity: number;
  lot: string;
  expiry: string;
  author: string;
  created: string;
  note: string;
}
export interface MedicalDocument {
  id: string;
  visitId: string;
  patient: ClinicalPatient;
  kind: string;
  title: string;
  text: string;
  from: string;
  to: string;
  doctor: string;
  registration: string;
  created: string;
  finalized?: string;
  voided?: string;
  voidReason?: string;
}
export interface ClinicalAudit {
  id: string;
  when: string;
  actor: string;
  action: string;
  ref: string;
}
export interface ClinicalState {
  version: 1;
  revision: number;
  visits: Visit[];
  prescriptions: Prescription[];
  deliveries: Delivery[];
  documents: MedicalDocument[];
  audit: ClinicalAudit[];
}
const empty = (): ClinicalState => ({
  version: 1,
  revision: 0,
  visits: [],
  prescriptions: [],
  deliveries: [],
  documents: [],
  audit: [],
});
export const clinicalKey = (org: string) =>
  `hospital:clinical:v1:${encodeURIComponent(org)}`;
export const changeEvent = "hospital:clinical-change";
export function readClinical(org: string): ClinicalState {
  return readRemote(clinicalKey(org), empty());
}
export function notifyLocal(key: string) {
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: key }));
}
export async function commitClinical(
  org: string,
  actor: string,
  action: string,
  ref: string,
  update: (s: ClinicalState) => ClinicalState,
) {
  if (!actor.trim()) throw new Error("Utilizador não identificado.");
  const next = await updateRemote(clinicalKey(org), empty(), update);
  notifyLocal(clinicalKey(org));
  return next;
}
export function useClinical(org: string) {
  const [state, setState] = useState<ClinicalState>(empty);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => {
      try {
        setState(readClinical(org));
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao ler os registos.");
      }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(changeEvent, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(changeEvent, refresh);
    };
  }, [org]);
  return { state, error };
}
export function delivered(
  state: ClinicalState,
  prescriptionId: string,
  itemId: string,
) {
  return state.deliveries
    .filter((d) => d.prescriptionId === prescriptionId && d.itemId === itemId)
    .reduce((s, d) => s + d.quantity, 0);
}
export function localDate() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
export const inputStyle =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
export const buttonStyle =
  "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";

export function isLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export type Role =
  | "admin"
  | "medico"
  | "enfermeiro"
  | "chefe_enfermagem"
  | "farmaceutico"
  | "auditor";
export interface Actor {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  roles: Role[];
  registration?: string;
}
export interface Person {
  id: string;
  code: string;
  name: string;
  birthDate: string;
  sex: string;
  allergies: string;
  conditions: string;
}
export interface Episode {
  id: string;
  patientId: string;
  specialty: string;
  ward: string;
  bed: string;
  diagnosis: string;
  status: "activo" | "alta_autorizada" | "encerrado";
  dischargeNote?: string;
  admittedAt?: string;
  nurseId?: string;
  nurseName?: string;
  assignedAt?: string;
}
export interface Drug {
  id: string;
  name: string;
  ingredient: string;
  strength: string;
  unit: string;
  highAlert: boolean;
  sourceCode?: string;
  needsReview?: boolean;
}
export interface Batch {
  id: string;
  drugId: string;
  lot: string;
  expires: string;
  quantity: number;
}
export interface Order {
  id: string;
  patientId: string;
  episodeId: string;
  drugId: string;
  dose: string;
  route: string;
  indication: string;
  specialty: string;
  instructions: string;
  prescriber: string;
  registration: string;
  start: string;
  interval: number;
  count: number;
  status: "activa" | "suspensa";
}
export interface Dose {
  id: string;
  orderId: string;
  due: string;
  units: number;
  status:
    | "aguarda_farmacia"
    | "dispensada"
    | "administrada"
    | "omitida"
    | "suspensa";
  batchId?: string;
  pharmacist?: string;
  administeredBy?: string;
  at?: string;
  note?: string;
  returned?: boolean;
  returnDisposition?: "stock" | "perda";
  witness?: string;
}
export interface Observation {
  id: string;
  patientId: string;
  kind:
    | "vitais"
    | "balanco"
    | "evolucao"
    | "incidente"
    | "triagem"
    | "avaliacao"
    | "dispositivo"
    | "procedimento";
  at: string;
  author: string;
  values: Record<string, string | number>;
}
export interface Care {
  id: string;
  patientId: string;
  diagnosis: string;
  goal: string;
  intervention: string;
  due: string;
  status: "planeado" | "realizado" | "avaliado";
  author: string;
  outcome?: string;
  performedAt?: string;
  performedBy?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
}
export interface Handover {
  id: string;
  patientId: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  authorId: string;
  author: string;
  at: string;
  acceptedBy?: string;
  acceptedAt?: string;
}
export interface Audit {
  id: string;
  at: string;
  actorId: string;
  actor: string;
  action: string;
  entityId: string;
  detail: string;
}
export interface ClinicalState {
  revision: number;
  patients: Person[];
  episodes: Episode[];
  drugs: Drug[];
  batches: Batch[];
  orders: Order[];
  doses: Dose[];
  observations: Observation[];
  care: Care[];
  handovers: Handover[];
  audit: Audit[];
}
export const emptyState = (): ClinicalState => ({
  revision: 0,
  patients: [],
  episodes: [],
  drugs: [],
  batches: [],
  orders: [],
  doses: [],
  observations: [],
  care: [],
  handovers: [],
  audit: [],
});
export const specialties = [
  "Medicina Geral e Familiar",
  "Medicina Interna",
  "Pediatria",
  "Neonatologia",
  "Ginecologia e Obstetrícia",
  "Cardiologia",
  "Cirurgia Geral",
  "Ortopedia",
  "Neurologia",
  "Neurocirurgia",
  "Pneumologia",
  "Gastroenterologia",
  "Nefrologia",
  "Urologia",
  "Endocrinologia",
  "Infecciologia",
  "Hematologia",
  "Oncologia",
  "Psiquiatria",
  "Dermatologia",
  "Oftalmologia",
  "Otorrinolaringologia",
  "Anestesiologia",
  "Cuidados Intensivos",
  "Medicina de Urgência",
  "Medicina Física e Reabilitação",
  "Estomatologia",
  "Outra especialidade",
];
export type Command = {
  type: string;
  payload: Record<string, unknown>;
  revision: number;
  requestId: string;
};
export type Bootstrap = { actor: Actor; state: ClinicalState };
export const allowed = (a: Actor | undefined, ...roles: Role[]) =>
  !!a?.roles.some((r) => r === "admin" || roles.includes(r));
export const doseLabels: Record<Dose["status"], string> = {
  aguarda_farmacia: "Aguarda farmácia",
  dispensada: "Pronta a administrar",
  administrada: "Administrada",
  omitida: "Não administrada",
  suspensa: "Suspensa",
};

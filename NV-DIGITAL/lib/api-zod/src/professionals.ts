export const STAFF_ACCESS_ROLES = [
  "admin",
  "gestor",
  "tecnico",
  "rececionista",
  "financeiro",
  "medico",
  "enfermeiro",
  "farmaceutico",
] as const;
/** Requested at registration; active authority is stored only in nv_grants. */
export const LAB_STAFF_DELEGATIONS = [
  "lab.validate.technical",
  "lab.validate.release",
  "lab.critical.release",
  "lab.validate.solo",
] as const;
export const PROFESSIONAL_CATEGORIES = [
  "Médico",
  "Médico clínico geral",
  "Médico especialista",
  "Enfermeiro",
  "Técnico de enfermagem",
  "Enfermeiro especialista",
  "Técnico de análises clínicas",
  "Técnico superior de análises clínicas",
  "Analista clínico",
  "Biomédico",
  "Biólogo",
  "Bioquímico",
  "Técnico de imagiologia",
  "Farmacêutico",
  "Técnico de farmácia",
  "Nutricionista",
  "Fisioterapeuta",
  "Psicólogo",
  "Técnico administrativo",
  "Recepcionista",
  "Técnico de finanças",
  "Gestor",
  "Outra categoria",
] as const;
export const MEDICAL_SPECIALTIES = [
  "Clínica Geral",
  "Medicina Geral e Familiar",
  "Medicina Interna",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Cardiologia",
  "Cirurgia Geral",
  "Ortopedia",
  "Anestesiologia",
  "Dermatologia",
  "Neurologia",
  "Psiquiatria",
  "Pneumologia",
  "Urologia",
  "Oftalmologia",
  "Otorrinolaringologia",
  "Medicina Dentária",
  "Imagiologia",
  "Patologia Clínica",
  "Nutrição",
] as const;
export interface ProfessionalDetails {
  category: string;
  specialties: string;
  credential: string;
  service: string;
  contract: string;
  employeeCode: string;
  phone: string;
  email: string;
  qualification: string;
  position: string;
  credentialAuthority: string;
  validUntil: string;
  signatureData: string;
  stampData: string;
  requestedLabPermissions?: string[];
  status?: string;
  verifiedBy?: string;
  verification?: string;
}
export const emptyProfessional = (): ProfessionalDetails => ({
  category: "",
  specialties: "",
  credential: "",
  service: "",
  contract: "",
  employeeCode: "",
  phone: "",
  email: "",
  qualification: "",
  position: "",
  credentialAuthority: "",
  validUntil: "",
  signatureData: "",
  stampData: "",
  requestedLabPermissions: [],
});
export interface ProfessionalIssuer {
  name: string;
  username: string;
  funcionarioId: string;
  category: string;
  specialties: string;
  credential: string;
  credentialAuthority: string;
  service: string;
  position: string;
  signatureData: string;
  stampData: string;
  verifiedBy: string;
  verifiedAt?: string;
}
export const NURSING_DOCUMENT_KINDS = [
  "Relatório de enfermagem",
  "Evolução de enfermagem",
  "Plano de cuidados",
  "Passagem de turno",
  "Orientações de alta de enfermagem",
  "Declaração de cuidados de enfermagem",
] as const;

export interface InsuranceRate {
  code: string;
  description: string;
  service: string;
  price: number;
  coverage: number;
  internalCost: number | null;
  maxCovered: number | null;
}
export interface InsuranceContract {
  id: string;
  insurerId: string;
  revision: number;
  name: string;
  start: string;
  end: string;
  active: boolean;
  requiresAuthorization: boolean;
  rates: InsuranceRate[];
}
export interface InsuranceSelection {
  beneficiaryId: string;
  contractId: string;
  authorization: string;
  serviceDate: string;
  acts: { code: string; professional: string }[];
}
export interface InsuranceAct extends InsuranceRate {
  quantity: number;
  net: number;
  tax: number;
  gross: number;
  insurerAmount: number;
  patientAmount: number;
  cost: number | null;
  professional: string;
  index: number;
}
export interface InsuranceQuote {
  insurer: any;
  beneficiary: any;
  patient: any;
  contract: InsuranceContract;
  authorization: string;
  serviceDate: string;
  dueDate: string;
  acts: InsuranceAct[];
  total: number;
  insurerAmount: number;
  patientAmount: number;
  internalCost: number | null;
}
export const INSURANCE_EXPORT_COLUMNS = [
  "data",
  "factura",
  "seguradora",
  "paciente",
  "processo",
  "cartao",
  "apolice",
  "plano",
  "acto",
  "descricao",
  "servico",
  "profissional",
  "quantidade",
  "preco",
  "facturado",
  "responsabilidadeSeguradora",
  "responsabilidadePaciente",
  "autorizacao",
  "vencimento",
  "estado",
] as const;

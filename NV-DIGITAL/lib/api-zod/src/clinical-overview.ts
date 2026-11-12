export interface ClinicalOverview {
  empresaId: string;
  patient: {
    id: string;
    name: string;
    birthDate: string;
    sex: string;
    processNumber: string;
    document: string;
    allergies: string;
    conditions: string;
  };
  episodeId: string | null;
  visits: {
    id: string;
    started: string;
    closed: string;
    doctor: string;
    specialty: string;
    diagnosis: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    followup: string;
  }[];
  prescriptions: {
    id: string;
    visitId: string;
    created: string;
    doctor: string;
    validUntil: string;
    cancelled: string;
    items: {
      id: string;
      name: string;
      dose: string;
      route: string;
      frequency: string;
      duration: string;
      quantity: number;
      unit: string;
      dispensed: number;
    }[];
  }[];
  documents: {
    id: string;
    visitId: string;
    title: string;
    kind: string;
    created: string;
    finalized: string;
    voided: string;
  }[];
  laboratory: {
    id: string;
    orderId: string | null;
    episodeId: string | null;
    accession: string;
    name: string;
    requestedAt: string;
    requestedBy: string;
    priority: string;
    cancelled: boolean;
    value: string | null;
    unit: string;
    reference: string;
    version: number | null;
    released: boolean;
    reportId: number | null;
    legacy: boolean;
  }[];
  nursing: {
    id: string;
    kind: string;
    at: string;
    author: string;
    values: Record<string, string | number>;
  }[];
}

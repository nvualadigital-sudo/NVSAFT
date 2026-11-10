import type { Resultado } from "../../store/AppContext";
export interface ReportRow {
  result: Resultado & { solicitacaoId?: string; faturaId?: number | null };
  version: number;
  state: "legado" | "pronto" | "revisao" | "rascunho";
  managed: {
    testId: string;
    orderId: string;
    accession?: string;
    sampleCode?: string | null;
  } | null;
  enteredBy?: string;
}
export interface ReportDetail {
  result: ReportRow["result"];
  published: Resultado;
  version: number;
  canEdit: boolean;
  canTechnical: boolean;
  canRelease: boolean;
  canSolo: boolean;
  managed: ReportRow["managed"];
  history: {
    id: string;
    version: number;
    origin: "manual" | "legado";
    data: ReportRow["result"];
    reason: string;
    entered_by: string | null;
    technical_by?: string;
    technical_at?: string;
    technical_note?: string;
    released_by?: string;
    released_at?: string;
    release_note?: string;
    created_at: string;
  }[];
}
export const RESULT_STATES = {
  legado: "Pronto · legado",
  pronto: "Pronto",
  revisao: "Aguarda libertação",
  rascunho: "Aguarda validação técnica",
};

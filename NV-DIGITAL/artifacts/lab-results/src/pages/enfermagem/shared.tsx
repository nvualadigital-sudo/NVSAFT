import { readRemote, updateRemote } from "../../store/hospital";
import {
  File,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Pill,
  Syringe,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { changeEvent, notifyLocal } from "../medicos/clinica/store";
export interface AtendEnfermagem {
  idEnf: number;
  codigoAtendimento: number;
  nomePaciente: string;
  contacto: string;
  dataNascimento: string;
  idade: number;
  sexo: string;
  quarto: string;
  leito: string;
  diagnosticoPrincipal: string;
  motivoAtendimento: string;
  pressaoArterial: string;
  frequenciaCardiaca: number;
  frequenciaRespiratoria: number;
  temperatura: number;
  saturacaoO2: number;
  glicemia: number;
  dorEVA: number;
  peso: number;
  altura: number;
  consciencia: string;
  hidratacao: string;
  diurese: string;
  debitoDrenos: string;
  alergias: string;
  medicacoes: string;
  procedimentos: string;
  observacoes: string;
  planoCuidados: string;
  dataAtendimento: string;
  horaAtendimento: string;
  codigoEnfermeiro: number;
  nomeEnfermeiro: string;
  turno: string;
  followUp?: string;
  risco: "baixo" | "moderado" | "alto" | "emergencia";
}

export interface AnexoEnf {
  libraryId?: string;
  id: number;
  idAtendimento: number;
  tipo:
    | "prescricao"
    | "evolucao"
    | "procedimento"
    | "exame"
    | "imagem"
    | "outro";
  nome: string;
  descricao: string;
  data: string;
  tamanho: string;
  formato: string;
  instituicao?: string;
  profissional?: string;
  observacoes?: string;
  previewUrl?: string;
}

export interface AnexoTempEnf {
  id: number;
  file: File;
  nome: string;
  tamanho: string;
  formato: string;
  tipo: AnexoEnf["tipo"];
  descricao: string;
  instituicao: string;
  profissional: string;
  observacoes: string;
  data: string;
  previewUrl?: string;
}

export interface NotificacaoEnf {
  id: number;
  tipo: "followup" | "alerta" | "info" | "urgente";
  titulo: string;
  descricao: string;
  data: string;
  lida: boolean;
}

export const TIPOS_ANEXO_ENF = {
  prescricao: {
    label: "Prescrição Médica",
    icon: Pill,
    cor: "bg-blue-500",
    corLight: "bg-blue-50 text-blue-700 border-blue-200",
  },
  evolucao: {
    label: "Evolução Enfermagem",
    icon: FileText,
    cor: "bg-emerald-500",
    corLight: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  procedimento: {
    label: "Procedimento",
    icon: Syringe,
    cor: "bg-purple-500",
    corLight: "bg-purple-50 text-purple-700 border-purple-200",
  },
  exame: {
    label: "Exame Complementar",
    icon: FlaskConical,
    cor: "bg-amber-500",
    corLight: "bg-amber-50 text-amber-700 border-amber-200",
  },
  imagem: {
    label: "Imagem Clínica",
    icon: ImageIcon,
    cor: "bg-pink-500",
    corLight: "bg-pink-50 text-pink-700 border-pink-200",
  },
  outro: {
    label: "Outro",
    icon: File,
    cor: "bg-slate-500",
    corLight: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

export const RISCO_CONFIG = {
  baixo: {
    label: "Baixo",
    cor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    corIcon: "text-emerald-600",
  },
  moderado: {
    label: "Moderado",
    cor: "bg-amber-100 text-amber-700 border-amber-200",
    corIcon: "text-amber-600",
  },
  alto: {
    label: "Alto",
    cor: "bg-orange-100 text-orange-700 border-orange-200",
    corIcon: "text-orange-600",
  },
  emergencia: {
    label: "Emergência",
    cor: "bg-red-100 text-red-700 border-red-200",
    corIcon: "text-red-600",
  },
};

export const FORMATOS_PERMITIDOS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
];

export const TAMANHO_MAX_MB = 25;

export interface NursingSession {
  empresaId?: string;
  empresaNome?: string;
  username?: string;
}

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const nowLocal = () =>
  `${todayLocal()}T${new Date().toTimeString().slice(0, 5)}`;

export function useNursingStore<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => Promise<void>, string] {
  const [value, setValue] = useState(() => readRemote(key, initial)),
    [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => {
      setValue(readRemote(key, initial));
    };
    window.addEventListener(changeEvent, refresh);
    return () => window.removeEventListener(changeEvent, refresh);
  }, [key]);
  async function save(next: T | ((prev: T) => T)) {
    try {
      await updateRemote(key, initial, (s) =>
        typeof next === "function" ? (next as (v: T) => T)(s) : next,
      );
      setValue(readRemote(key, initial));
      setError("");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Gravação não confirmada.";
      setError(message);
      throw e;
    }
  }
  return [value, save, error];
}

export type WardKind =
  | "cuidados"
  | "medicacao"
  | "sinais"
  | "balanco"
  | "evolucao"
  | "turno"
  | "ocorrencia"
  | "triagem"
  | "dor"
  | "avaliacao"
  | "prescricao";

export interface WardEvent {
  id: string;
  patientId: number;
  kind: WardKind;
  when: string;
  created: string;
  author: string;
  title: string;
  note: string;
  status: "pendente" | "concluido" | "nao_realizado";
  completed?: string;
  completedBy?: string;
  reason?: string;
  amount?: number;
  direction?: "entrada" | "saida";
  values?: Record<string, string>;
  prescription?: string;
  prescriptionId?: string;
  centralRxId?: string;
  centralItemId?: string;
  dose?: string;
  route?: string;
}

export interface WardBed {
  id: string;
  ward: string;
  room: string;
  bed: string;
  blocked: boolean;
}

export interface WardStay {
  patientId: number;
  bedId: string;
  admitted: string;
  closed?: string;
  outcome?: string;
}

export interface WardState {
  events: WardEvent[];
  beds: WardBed[];
  stays: WardStay[];
}

export const WARD_TABS = [
  ["triagem", "Triagem Manchester"],
  ["dor", "Dor / EVA"],
  ["avaliacao", "Avaliações e riscos"],
  ["prescricao", "Receitas / prescrições"],
  ["leitos", "Leitos"],
  ["cuidados", "Cuidados e horários"],
  ["medicacao", "Medicação"],
  ["sinais", "Sinais vitais"],
  ["balanco", "Balanço hídrico"],
  ["evolucao", "Evolução"],
  ["turno", "Passagem de turno"],
  ["ocorrencia", "Ocorrências"],
] as const;

export type FuncaoFuncionario =
  | "admin"
  | "gestor"
  | "tecnico"
  | "rececionista"
  | "financeiro"
  | "medico"
  | "enfermeiro"
  | "farmaceutico";

export const FUNCAO_LABELS: Record<FuncaoFuncionario, string> = {
  enfermeiro: "Enfermeiro",
  farmaceutico: "Farmacêutico",
  admin: "Administrador",
  gestor: "Gestor",
  tecnico: "Técnico de Laboratório",
  rececionista: "Recepcionista",
  financeiro: "Financeiro",
  medico: "Médico",
};

export interface Session {
  role: "developer" | "funcionario" | "parceiro" | "empresa";
  empresaId?: string;
  empresaNome?: string;
  username: string;
  funcao?: FuncaoFuncionario;
  funcionarioId?: string;
  funcionarioNome?: string;
  parceiroId?: string;
  parceiroNome?: string;
  parceiroInstituicao?: string;
  modulos?: string[];
}

function sessionKey(): string {
  const path = window.location.pathname;
  if (path.includes("/admin")) return "lab_session_dev_v4";
  if (path.includes("/parceiro")) return "lab_session_par_v4";
  return "lab_session_emp_v4";
}

export function loadSession(): Session | null {
  try {
    const key = sessionKey();
    const raw = sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Session;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveSession(session: Session | null): void {
  const key = sessionKey();
  if (session) {
    const data = JSON.stringify(session);
    sessionStorage.setItem(key, data);
    localStorage.removeItem(key);
  } else {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
}

export function canAccess(
  funcao: FuncaoFuncionario | undefined,
  allowedRoles: FuncaoFuncionario[],
): boolean {
  if (!funcao) return false;
  return allowedRoles.includes(funcao);
}

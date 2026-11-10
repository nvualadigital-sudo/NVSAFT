const invoiceRequests = new Map<string, string>();
// In Netlify, set VITE_API_URL=https://your-api.onrender.com in Netlify env vars.
// In Replit dev/prod, leave VITE_API_URL unset — requests use the same origin (/api).
const BASE = (import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "") + "/api";

import {
  cacheWrite,
  cacheRead,
  queuePendingOp,
  getPendingOps,
  removePendingOp,
} from "./storage";

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function tokenKey(): string {
  const path = window.location.pathname;
  if (path.includes("/admin")) return "lab_token_dev_v4";
  if (path.includes("/parceiro")) return "lab_token_par_v4";
  return "lab_token_emp_v4";
}

function getToken(): string | null {
  return sessionStorage.getItem(tokenKey());
}

function setToken(t: string | null) {
  localStorage.removeItem(tokenKey());
  if (t) sessionStorage.setItem(tokenKey(), t);
  else sessionStorage.removeItem(tokenKey());
}

function headers(): Record<string, string> {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

// ─── Path → offline-cache key mapping ────────────────────────────────────────
// Only cacheable GET endpoints that don't depend on URL parameters
const PATH_CACHE_KEY: Record<string, string> = {
  "/pacientes": "pacientes",
  "/resultados": "resultados",
  "/faturas": "faturas",
  "/movimentos": "movimentos",
  "/produtos": "produtos",
  "/config": "config",
  "/exames-custom": "exames-custom",
  "/reagentes": "reagentes",
  "/stock-movimentos": "stock-movimentos",
};

// ─── Direct fetch (no offline handling) ──────────────────────────────────────
export async function reqDirect<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401)
      window.dispatchEvent(new Event("lab:unauthenticated"));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return undefined as unknown as T;
  return res.json();
}

// ─── Offline-aware request ────────────────────────────────────────────────────
async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  return reqDirect<T>(method, path, body);
}

// Operações antigas sem instituição nunca são reenviadas noutra sessão.
async function syncPending(): Promise<{ synced: number; failed: number }> {
  return { synced: 0, failed: 0 };
}

// ─── SSE subscription (LAN live sync) ────────────────────────────────────────
function subscribeSync(onEvent: (event: string, data: unknown) => void) {
  const timer = window.setInterval(() => {
    if (!document.hidden && getToken()) onEvent("change", {});
  }, 30000);
  return () => window.clearInterval(timer);
}

export const api = {
  // ── Connectivity / sync ─────────────────────────────────────────────────
  getToken,
  setToken,
  isOnline: () => navigator.onLine,
  syncPending,
  subscribeSync,
  getPendingCount: async () => (await getPendingOps()).length,

  // ── Auth ─────────────────────────────────────────────────────────────────
  auth: {
    login: (username: string, password: string) =>
      req<{
        token: string;
        role: string;
        empresaId?: string;
        empresaNome?: string;
        username: string;
        funcao?: string;
        funcionarioId?: string;
        funcionarioNome?: string;
        parceiroId?: string;
        parceiroNome?: string;
        parceiroInstituicao?: string;
        modulos?: string[];
      }>("POST", "/auth/login", { username, password }),
    logout: () => req("POST", "/auth/logout"),
    me: () =>
      req<{
        role: string;
        empresaId?: string;
        empresaNome?: string;
        username: string;
        funcao?: string;
        funcionarioId?: string;
        funcionarioNome?: string;
        parceiroId?: string;
        parceiroNome?: string;
        parceiroInstituicao?: string;
      }>("GET", "/auth/me"),
  },

  // ── Empresas / funcionários / parceiros ───────────────────────────────────
  empresas: {
    list: () => req<any[]>("GET", "/empresas"),
    create: (data: any) => req<any>("POST", "/empresas", data),
    update: (id: string, data: any) => req<any>("PUT", `/empresas/${id}`, data),
    delete: (id: string) => req("DELETE", `/empresas/${id}`),
    listFuncionarios: (id: string) =>
      req<any[]>("GET", `/empresas/${id}/funcionarios`),
    getFuncionario: (id: string, fid: string) => req<any>("GET", `/empresas/${id}/funcionarios/${fid}`),
    createFuncionario: (id: string, data: any) =>
      req<any>("POST", `/empresas/${id}/funcionarios`, data),
    updateFuncionario: (id: string, fid: string, data: any) =>
      req<any>("PUT", `/empresas/${id}/funcionarios/${fid}`, data),
    deleteFuncionario: (id: string, fid: string) =>
      req("DELETE", `/empresas/${id}/funcionarios/${fid}`),
    listParceiros: (id: string) =>
      req<any[]>("GET", `/empresas/${id}/parceiros`),
    createParceiro: (id: string, data: any) =>
      req<any>("POST", `/empresas/${id}/parceiros`, data),
    updateParceiro: (id: string, pid: string, data: any) =>
      req<any>("PUT", `/empresas/${id}/parceiros/${pid}`, data),
    deleteParceiro: (id: string, pid: string) =>
      req("DELETE", `/empresas/${id}/parceiros/${pid}`),
  },

  parceiros: {
    list: () => req<any[]>("GET", "/parceiros"),
    create: (data: any) => req<any>("POST", "/parceiros", data),
    update: (id: string, data: any) =>
      req<any>("PUT", `/parceiros/${id}`, data),
    delete: (id: string) => req("DELETE", `/parceiros/${id}`),
  },

  solicitacoes: {
    listLab: () => req<any[]>("GET", "/solicitacoes"),
    listMinhas: () => req<any[]>("GET", "/solicitacoes/minhas"),
    listMedico: () => req<any[]>("GET", "/solicitacoes/medico"),
    create: (data: any) => req<any>("POST", "/solicitacoes", data),
    createInterno: (data: any) =>
      req<any>("POST", "/solicitacoes/interno", data),
    updateEstado: (id: number | string, estado: string, resultadoId?: number) =>
      req<any>("PUT", `/solicitacoes/${id}`, { estado, resultadoId }),
    getResultado: (id: number | string) =>
      req<{ resultado: any; paciente: any | null }>(
        "GET",
        `/solicitacoes/${id}/resultado`,
      ),
  },

  parceiroPacientes: {
    list: () => req<any[]>("GET", "/parceiro/pacientes"),
    create: (data: any) => req<any>("POST", "/parceiro/pacientes", data),
    update: (id: string, data: any) =>
      req<any>("PUT", `/parceiro/pacientes/${id}`, data),
    delete: (id: string) => req("DELETE", `/parceiro/pacientes/${id}`),
  },

  sucursais: {
    list: () => req<any[]>("GET", "/sucursais"),
    create: (data: any) => req<any>("POST", "/sucursais", data),
    delete: (id: string) => req("DELETE", `/sucursais/${id}`),
  },

  config: {
    get: () => req<any>("GET", "/config"),
    update: (data: any) => req<any>("PUT", "/config", data),
  },

  pacientes: {
    list: () => req<any[]>("GET", "/pacientes"),
    create: (data: any) => req<any>("POST", "/pacientes", data),
    update: (id: number, data: any) =>
      req<any>("PUT", `/pacientes/${id}`, data),
    delete: (id: number) => req("DELETE", `/pacientes/${id}`),
  },

  resultados: {
    list: () => req<any[]>("GET", "/resultados"),
    create: (data: any) => req<any>("POST", "/resultados", data),
    update: (id: number, data: any) =>
      req<any>("PUT", `/resultados/${id}`, data),
    delete: (id: number) => req("DELETE", `/resultados/${id}`),
  },

  faturas: {
    list: () => req<any[]>("GET", "/faturas"),
    create: async (data: any) => {
      const key = JSON.stringify(data);
      const requestId = invoiceRequests.get(key) || crypto.randomUUID();
      invoiceRequests.set(key, requestId);
      const value = await req<any>("POST", "/faturas", { ...data, requestId });
      invoiceRequests.delete(key);
      return value;
    },
    update: (id: number, data: any) => req<any>("PUT", `/faturas/${id}`, data),
    delete: (id: number) => req("DELETE", `/faturas/${id}`),
  },

  movimentos: {
    list: () => req<any[]>("GET", "/movimentos"),
    create: (data: any) => req<any>("POST", "/movimentos", data),
    delete: (id: number) => req("DELETE", `/movimentos/${id}`),
  },

  produtos: {
    list: () => req<any[]>("GET", "/produtos"),
    create: (data: any) => req<any>("POST", "/produtos", data),
    importar: (produtos: any[]) =>
      req<{ importados: number; ignorados: number; nomesIgnorados: string[] }>(
        "POST", "/produtos/importar", { produtos },
      ),
    update: (id: number, data: any) => req<any>("PUT", `/produtos/${id}`, data),
    delete: (id: number) => req("DELETE", `/produtos/${id}`),
  },

  examesCustom: {
    list: () => req<any[]>("GET", "/exames-custom"),
    create: (data: any) => req<any>("POST", "/exames-custom", data),
    update: (id: number, data: any) =>
      req<any>("PUT", `/exames-custom/${id}`, data),
    delete: (id: number) => req("DELETE", `/exames-custom/${id}`),
  },

  reagentes: {
    list: () => req<any[]>("GET", "/reagentes"),
    create: (data: any) => req<any>("POST", "/reagentes", data),
    update: (id: number, data: any) =>
      req<any>("PUT", `/reagentes/${id}`, data),
    delete: (id: number) => req("DELETE", `/reagentes/${id}`),
  },

  stockMovimentos: {
    list: () => req<any[]>("GET", "/stock-movimentos"),
    create: (data: any) => req<any>("POST", "/stock-movimentos", data),
    delete: (id: number) => req("DELETE", `/stock-movimentos/${id}`),
  },
};

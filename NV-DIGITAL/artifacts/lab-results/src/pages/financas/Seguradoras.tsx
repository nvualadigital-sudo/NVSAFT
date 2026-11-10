import InsuranceFinance from "./InsuranceFinance";
import { useApp } from "../../store/AppContext";
import { exportInsuranceTable } from "../../utils/insuranceExports";
import { hospitalApi } from "../../store/hospital";
import { useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";

/* ============================================================================ */
/*  PALETA VISUAL (SolicitacoesExames Style)                                    */
/* ============================================================================ */
const CORES = {
  navy: "#0d2b3e",
  teal: "#0d7a8a",
  tealClaro: "#3bb5c4",
  vermelho: "#c0392b",
  vermelhoEscuro: "#7a0000",
  verdeEscuro: "#005a2a",
  oliva: "#8b7a00",
  sidebar: "#1e3a3a",
  borda: "#e5e7eb",
};
const FONTE = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
const HEAD_BG = "#f5f6f7";
const BD = { borderColor: CORES.borda };

const inputCls = "w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#0d7a8a] focus:ring-1 focus:ring-[#0d7a8a]/40 transition-colors";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500";
const btnTeal = "rounded-sm px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]";
const btnOutline = "rounded-sm border px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50";

/* ============================================================================ */
/*  ÍCONES SVG                                                                  */
/* ============================================================================ */
const IconX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconEdit = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconSave = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconDownload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconShield = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconUsers = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const IconUser = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconCheck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconAlert = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IconChart = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconClock = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;

/* ============================================================================ */
/*  COMPONENTES VISUAIS                                                         */
/* ============================================================================ */
function StatBlock({ title, value, bg, icon, subtitle }: { title: string; value: number; bg: string; icon: ReactNode; subtitle?: string }) {
  return (
    <div className="relative overflow-hidden rounded-sm p-5 text-white" style={{ backgroundColor: bg, minHeight: 110 }}>
      <p className="text-sm font-medium opacity-90">{title}</p>
      <p className="mt-2 text-3xl font-extralight">{value}</p>
      {subtitle && <p className="mt-1 text-xs opacity-75">{subtitle}</p>}
      <div className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>{icon}</div>
    </div>
  );
}

function CardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b px-5 py-3" style={{ ...BD, backgroundColor: HEAD_BG }}>
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-gray-700">{title}</h3>
      {right}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, footer, maxW = "max-w-md" }: any) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`w-full ${maxW} rounded-sm border bg-white shadow-xl`} style={BD} onClick={(e: any) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ ...BD, backgroundColor: HEAD_BG }}>
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-gray-700">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IconX /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-5 py-3" style={BD}>{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: ReactElement; required?: boolean }) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function FormSection({ title }: { title: string }) {
  return (
    <div className="mb-3 mt-4 flex items-center gap-2 border-b pb-1 first:mt-0" style={{ borderColor: `${CORES.teal}33` }}>
      <div className="h-4 w-1 rounded-full" style={{ backgroundColor: CORES.teal }}></div>
      <h4 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: CORES.teal }}>{title}</h4>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; dot: string }> = {
    Activo: { bg: "#eaf5ee", text: CORES.verdeEscuro, dot: CORES.verdeEscuro },
    Activa: { bg: "#eaf5ee", text: CORES.verdeEscuro, dot: CORES.verdeEscuro },
    Suspenso: { bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af" },
    Inactiva: { bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af" },
    Expirado: { bg: "#fbeaea", text: CORES.vermelho, dot: CORES.vermelho },
    "Por iniciar": { bg: "#e6f4f6", text: CORES.teal, dot: CORES.teal },
    "Seguradora inactiva": { bg: "#fdfbea", text: CORES.oliva, dot: CORES.oliva },
  };
  const c = cfg[status] || cfg.Suspenso;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: c.bg, color: c.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.dot }}></span>
      {status}
    </span>
  );
}

/* ============================================================================ */
/*  TIPOS E INTERFACES                                                          */
/* ============================================================================ */
interface SessionInfo {
  empresaId?: string;
  empresaNome?: string;
  username?: string;
  funcao?: string;
}
interface Props { session: SessionInfo; }

type Insurer = {
  id: string;
  nome: string;
  nif: string;
  contacto: string;
  email: string;
  contrato: string;
  cobertura: number;
  prazo: number;
  activa: boolean;
};

type Beneficiary = {
  id: string;
  pacienteId: string;
  nome: string;
  seguradoraId: string;
  apolice: string;
  cartao: string;
  plano: string;
  inicio: string;
  fim: string;
  cobertura: number;
  activo: boolean;
  relationship?: "titular" | "dependente";
};

type Database = {
  version: 1;
  seguradoras: Insurer[];
  assegurados: Beneficiary[];
};

type View = "seguradoras" | "assegurados" | "financeiro";

const EMPTY: Database = { version: 1, seguradoras: [], assegurados: [] };

const insurerBlank = (): Insurer => ({
  id: "", nome: "", nif: "", contacto: "", email: "", contrato: "",
  cobertura: 100, prazo: 30, activa: true,
});

const beneficiaryBlank = (): Beneficiary => ({
  id: "", pacienteId: "", nome: "", seguradoraId: "", apolice: "", cartao: "",
  plano: "", inicio: "", fim: "", cobertura: 100, activo: true,
});

const isText = (value: unknown): value is string => typeof value === "string";

function validDatabase(value: unknown): value is Database {
  if (!value || typeof value !== "object") return false;
  const d = value as Database;
  return (
    d.version === 1 &&
    Array.isArray(d.seguradoras) &&
    Array.isArray(d.assegurados) &&
    d.seguradoras.every(
      (s) =>
        s &&
        [s.id, s.nome, s.nif, s.contacto, s.email, s.contrato].every(isText) &&
        s.id && s.nome &&
        Number.isFinite(s.cobertura) && s.cobertura >= 0 && s.cobertura <= 100 &&
        Number.isInteger(s.prazo) && s.prazo >= 0 &&
        typeof s.activa === "boolean",
    ) &&
    d.assegurados.every(
      (a) =>
        a &&
        [a.id, a.pacienteId, a.nome, a.seguradoraId, a.apolice, a.cartao, a.plano, a.inicio, a.fim].every(isText) &&
        a.id && a.nome &&
        typeof a.activo === "boolean" &&
        Number.isFinite(a.cobertura) && a.cobertura >= 0 && a.cobertura <= 100 &&
        d.seguradoras.some((s) => s.id === a.seguradoraId),
    ) &&
    new Set(d.seguradoras.map((s) => s.id)).size === d.seguradoras.length &&
    new Set(d.assegurados.map((a) => a.id)).size === d.assegurados.length
  );
}

function readDatabase(_key: string): { data: Database; error: string } {
  return { data: EMPTY, error: "" };
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateLabel(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

const normalise = (value: string) => value.trim().toLocaleLowerCase();
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/* ============================================================================ */
/*  COMPONENTE PRINCIPAL                                                        */
/* ============================================================================ */
export default function Seguradoras({ session }: Props) {
  if (!session.empresaId) {
    return (
      <div className="min-h-screen bg-white p-6" style={{ fontFamily: FONTE }}>
        <div className="flex items-center gap-2 rounded-sm border px-4 py-3 text-sm" style={{ borderColor: `${CORES.oliva}33`, backgroundColor: "#fdfbea", color: CORES.oliva }}>
          <IconAlert /> Seleccione uma instituição antes de gerir seguradoras.
        </div>
      </div>
    );
  }
  const key = `hospital:seguradoras:v1:${encodeURIComponent(session.empresaId)}:${encodeURIComponent(session.username ?? "utilizador")}`;
  return <InsuranceWorkspace key={key} storageKey={key} session={session} />;
}

function InsuranceWorkspace({ storageKey, session }: { storageKey: string; session: SessionInfo }) {
  const { data: appData } = useApp();
  const [loaded] = useState(() => readDatabase(storageKey));
  const [data, setData] = useState<Database>(loaded.data);
  const [view, setView] = useState<View>("seguradoras");
  const [search, setSearch] = useState("");
  const [insurerFilter, setInsurerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [insurer, setInsurer] = useState<Insurer | null>(null);
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; error?: boolean } | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const canEdit = ["admin", "gestor", "financeiro", "rececionista"].includes(session.funcao ?? "admin");
  const insurerById = (id: string) => data.seguradoras.find((s) => s.id === id);

  function status(a: Beneficiary) {
    if (!a.activo) return "Suspenso";
    if (!insurerById(a.seguradoraId)?.activa) return "Seguradora inactiva";
    if (a.inicio && a.inicio > today()) return "Por iniciar";
    if (a.fim && a.fim < today()) return "Expirado";
    return "Activo";
  }

  const revision = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void hospitalApi<any[]>("GET", "/records/insurance")
      .then((rows) => {
        const row = rows.find((x) => x.id === session.empresaId);
        if (row) {
          if (!validDatabase(row.data)) throw new Error("Dados da seguradora inválidos.");
          setData(row.data);
          revision.current = row.revision;
        }
        setReady(true);
      })
      .catch((e) => setFeedback({ msg: e.message, error: true }));
  }, [session.empresaId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.error ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function commit(next: Database) {
    if (!canEdit || !ready) {
      setToast({ msg: "Aguarde os dados ou verifique as permissões.", error: true });
      return false;
    }
    try {
      const saved = await hospitalApi<any>("POST", "/records/insurance", {
        id: session.empresaId,
        revision: revision.current,
        data: next,
      });
      revision.current = saved.revision;
      setData(saved.data);
      setToast({ msg: "Registo confirmado no servidor." });
      return true;
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Gravação não confirmada.", error: true });
      return false;
    }
  }

  async function saveInsurer(event: FormEvent) {
    event.preventDefault();
    if (!insurer) return;
    const item = {
      ...insurer,
      id: insurer.id || newId(),
      nome: insurer.nome.trim(),
      nif: insurer.nif.trim(),
      email: insurer.email.trim(),
      contacto: insurer.contacto.trim(),
      contrato: insurer.contrato.trim(),
    };
    if (
      !item.nome ||
      !Number.isFinite(item.cobertura) || item.cobertura < 0 || item.cobertura > 100 ||
      !Number.isInteger(item.prazo) || item.prazo < 0
    ) {
      setFeedback({ msg: "Verifique o nome, a cobertura (0–100%) e o prazo em dias inteiros.", error: true });
      return;
    }
    if (
      data.seguradoras.some((s) =>
        s.id !== item.id &&
        (normalise(s.nome) === normalise(item.nome) ||
          (item.nif && normalise(s.nif) === normalise(item.nif)))
      )
    ) {
      setFeedback({ msg: "Já existe uma seguradora com este nome ou NIF.", error: true });
      return;
    }
    if (
      await commit({
        ...data,
        seguradoras: insurer.id
          ? data.seguradoras.map((s) => (s.id === item.id ? item : s))
          : [...data.seguradoras, item],
      })
    ) {
      setInsurer(null);
      setFeedback(null);
    }
  }

  async function saveBeneficiary(event: FormEvent) {
    event.preventDefault();
    if (!beneficiary) return;
    const item = {
      ...beneficiary,
      id: beneficiary.id || newId(),
      nome: beneficiary.nome.trim(),
      pacienteId: beneficiary.pacienteId.trim(),
      apolice: beneficiary.apolice.trim(),
      cartao: beneficiary.cartao.trim(),
      plano: beneficiary.plano.trim(),
    };
    if (
      !item.nome || !item.pacienteId || !item.cartao ||
      !insurerById(item.seguradoraId) || !item.inicio || !item.fim ||
      item.fim < item.inicio ||
      !Number.isFinite(item.cobertura) || item.cobertura < 0 || item.cobertura > 100
    ) {
      setFeedback({ msg: "Preencha o paciente, a seguradora, o cartão, a validade e uma cobertura entre 0 e 100%.", error: true });
      return;
    }
    if (item.activo && !insurerById(item.seguradoraId)?.activa) {
      setFeedback({ msg: "Seleccione uma seguradora activa ou suspenda este vínculo.", error: true });
      return;
    }
    if (
      data.assegurados.some((a) =>
        a.id !== item.id &&
        a.seguradoraId === item.seguradoraId &&
        normalise(a.cartao) === normalise(item.cartao)
      )
    ) {
      setFeedback({ msg: "Este cartão já está registado nesta seguradora.", error: true });
      return;
    }
    if (
      await commit({
        ...data,
        assegurados: beneficiary.id
          ? data.assegurados.map((a) => (a.id === item.id ? item : a))
          : [...data.assegurados, item],
      })
    ) {
      setBeneficiary(null);
      setFeedback(null);
    }
  }

  const insurers = data.seguradoras
    .filter((s) => `${s.nome} ${s.nif} ${s.contrato}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  const beneficiaries = data.assegurados.filter((a) =>
    (!insurerFilter || a.seguradoraId === insurerFilter) &&
    (!statusFilter || status(a) === statusFilter) &&
    `${a.nome} ${a.pacienteId} ${a.cartao} ${a.apolice} ${insurerById(a.seguradoraId)?.nome}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase())
  );

  function exportCsv() {
    const rows: (string | number)[][] =
      view === "seguradoras"
        ? [
            ["Seguradora", "NIF", "Contacto", "Email", "Contrato", "Cobertura (%)", "Prazo (dias)", "Estado"],
            ...insurers.map((s) => [s.nome, s.nif, s.contacto, s.email, s.contrato, s.cobertura, s.prazo, s.activa ? "Activa" : "Inactiva"]),
          ]
        : [
            ["Paciente", "N.º processo", "Seguradora", "Apólice", "Cartão", "Plano", "Início", "Fim", "Cobertura (%)", "Estado"],
            ...beneficiaries.map((a) => [a.nome, a.pacienteId, insurerById(a.seguradoraId)?.nome ?? "", a.apolice, a.cartao, a.plano, a.inicio, a.fim, a.cobertura, status(a)]),
          ];
    const cell = (value: string | number) => {
      let text = String(value);
      if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${view}-${today()}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast({ msg: "CSV exportado com sucesso" });
  }

  async function exportCadastro(format: "xlsx" | "pdf") {
    const popup = format === "pdf" ? window.open("", "_blank") : null;
    try {
      const rows = view === "seguradoras"
        ? insurers
        : beneficiaries.map(a => ({ ...a, seguradora: insurerById(a.seguradoraId)?.nome, estado: status(a) }));
      const keys = view === "seguradoras"
        ? ["nome", "nif", "contacto", "email", "contrato", "cobertura", "prazo"]
        : ["pacienteId", "nome", "seguradora", "cartao", "apolice", "plano", "inicio", "fim", "cobertura", "estado"];
      const labels: Record<string, string> = {
        pacienteId: "ID do paciente", nome: "Nome", nif: "NIF", contacto: "Contacto",
        email: "Email", contrato: "Contrato", cobertura: "Cobertura (%)", prazo: "Prazo (dias)",
        seguradora: "Seguradora", cartao: "Cartão", apolice: "Apólice", plano: "Plano",
        inicio: "Início", fim: "Validade", estado: "Situação",
      };
      await exportInsuranceTable(
        format, rows,
        keys.map(key => ({ key, label: labels[key] })),
        "cadastro-seguradoras",
        session.empresaNome || "Cadastro de seguradoras",
        [
          "Filtros: " + search + " · Seguradora: " + (insurerById(insurerFilter)?.nome || "Todas") + " · Situação: " + (statusFilter || "Todas"),
          "Registos: " + rows.length,
        ],
        popup
      );
      setToast({ msg: `${format.toUpperCase()} exportado` });
    } catch (e) {
      popup?.close();
      setToast({ msg: (e as Error).message, error: true });
    }
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  VIEW: FINANCEIRO                                                       */
  /* ════════════════════════════════════════════════════════════════════════ */
  if (view === "financeiro") {
    return (
      <div className="min-h-screen bg-white p-6 md:p-8" style={{ fontFamily: FONTE }}>
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between" style={BD}>
          <div>
            <h2 className="text-xl font-light text-gray-600">Financeiro · Seguradoras</h2>
            <p className="text-xs text-gray-500">Cobrança, actos e extractos por seguradora</p>
          </div>
          <div className="flex gap-2">
            <button className={btnOutline} style={{ borderColor: "#d1d5db" }} onClick={() => setView("seguradoras")}>
              ← Seguradoras
            </button>
            <button className={btnOutline} style={{ borderColor: "#d1d5db" }} onClick={() => setView("assegurados")}>
              ← Assegurados
            </button>
          </div>
        </div>
        <InsuranceFinance insurers={data.seguradoras} session={session} />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  VIEWS: SEGURADORAS / ASSEGURADOS                                       */
  /* ════════════════════════════════════════════════════════════════════════ */
  const stats = {
    totalSeguradoras: data.seguradoras.length,
    seguradorasActivas: data.seguradoras.filter((s) => s.activa).length,
    totalVinculos: data.assegurados.length,
    vinculosActivos: data.assegurados.filter((a) => status(a) === "Activo").length,
  };

  const VIEW_TABS: { id: View; label: string; icon: ReactNode; color: string }[] = [
    { id: "seguradoras", label: "Seguradoras", icon: <IconShield />, color: CORES.teal },
    { id: "assegurados", label: "Pacientes Assegurados", icon: <IconUsers />, color: CORES.navy },
    ...(canEdit ? [{ id: "financeiro" as View, label: "Financeiro", icon: <IconChart />, color: CORES.verdeEscuro }] : []),
  ];

  return (
    <div className="min-h-screen bg-white p-6 md:p-8" style={{ fontFamily: FONTE }}>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between" style={BD}>
        <div>
          <h2 className="text-xl font-light text-gray-600">Seguradoras e Pacientes Assegurados</h2>
          <p className="text-xs text-gray-500">
            {session.empresaNome || "Gestão de vínculos e coberturas"}
          </p>
        </div>
        {session.username && (
          <div className="flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs" style={{ borderColor: `${CORES.teal}33`, backgroundColor: "#e6f4f6" }}>
            <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: CORES.teal }}>
              {(session.username || "?").charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold" style={{ color: CORES.teal }}>{session.username}</span>
            {session.funcao && <span className="text-gray-500">· {session.funcao}</span>}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="mb-5 flex items-start gap-2 rounded-sm border px-4 py-3 text-xs" style={{ borderColor: `${CORES.teal}33`, backgroundColor: "#e6f4f6", color: CORES.teal }}>
        <IconAlert />
        <span>Registos partilhados no servidor da instituição. A cobertura registada deve ser confirmada com a seguradora em cada atendimento; não altera automaticamente os preços da facturação.</span>
      </div>

      {/* Erro de carregamento */}
      {loaded.error && (
        <div className="mb-4 flex items-center gap-2 rounded-sm border px-4 py-3 text-sm font-medium" style={{ borderColor: `${CORES.vermelho}33`, backgroundColor: "#fbeaea", color: CORES.vermelho }}>
          <IconAlert /> {loaded.error}
        </div>
      )}

      {/* Feedback inline */}
      {feedback && (
        <div className="mb-4 flex items-start gap-2 rounded-sm border px-4 py-3 text-sm" style={feedback.error ? { borderColor: `${CORES.vermelho}33`, backgroundColor: "#fbeaea", color: CORES.vermelho } : { borderColor: `${CORES.teal}33`, backgroundColor: "#e6f4f6", color: CORES.teal }}>
          {feedback.error ? <IconAlert /> : <IconCheck />}
          <span className="flex-1">{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100"><IconX /></button>
        </div>
      )}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock title="Total de Seguradoras" value={stats.totalSeguradoras} bg={CORES.navy} icon={<IconShield />} />
        <StatBlock title="Seguradoras Activas" value={stats.seguradorasActivas} bg={CORES.teal} icon={<IconCheck />} subtitle={`de ${stats.totalSeguradoras} registadas`} />
        <StatBlock title="Vínculos Registados" value={stats.totalVinculos} bg={CORES.tealClaro} icon={<IconUsers />} />
        <StatBlock title="Vínculos Activos" value={stats.vinculosActivos} bg={CORES.verdeEscuro} icon={<IconCheck />} subtitle={`de ${stats.totalVinculos} total`} />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {VIEW_TABS.map((tab) => {
          const isActive = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setView(tab.id); setSearch(""); setFeedback(null); }}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${isActive ? "border-transparent text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              style={isActive ? { backgroundColor: tab.color, borderColor: tab.color } : { borderColor: "#d1d5db" }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Ações (export + criar) */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className={`${btnOutline} flex items-center gap-2`} style={{ borderColor: "#d1d5db" }} onClick={exportCsv}>
          <IconDownload /> CSV
        </button>
        <button className={`${btnOutline} flex items-center gap-2`} style={{ borderColor: "#d1d5db" }} disabled={!ready} onClick={() => void exportCadastro("xlsx")}>
          <IconDownload /> XLSX
        </button>
        <button className={`${btnOutline} flex items-center gap-2`} style={{ borderColor: "#d1d5db" }} disabled={!ready} onClick={() => void exportCadastro("pdf")}>
          <IconDownload /> PDF
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className={`${btnTeal} flex items-center gap-2`}
          style={{ backgroundColor: CORES.teal }}
          disabled={!canEdit || !!loaded.error || (view === "assegurados" && !data.seguradoras.some((s) => s.activa))}
          onClick={() => {
            setFeedback(null);
            if (view === "seguradoras") setInsurer(insurerBlank());
            else setBeneficiary(beneficiaryBlank());
          }}
        >
          <IconPlus />
          {view === "seguradoras" ? "Nova Seguradora" : "Novo Assegurado"}
        </button>
      </div>

      {/* Aviso: sem seguradoras ativas */}
      {view === "assegurados" && !data.seguradoras.some((s) => s.activa) && (
        <div className="mb-5 flex items-center gap-2 rounded-sm border px-4 py-3 text-xs font-semibold" style={{ borderColor: `${CORES.oliva}33`, backgroundColor: "#fdfbea", color: CORES.oliva }}>
          <IconAlert /> Cadastre uma seguradora activa antes de adicionar pacientes assegurados.
        </div>
      )}

      {/* Filtros + Pesquisa */}
      <div className="mb-4 rounded-sm border bg-white p-4" style={BD}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><IconSearch /></div>
            <input
              className={`${inputCls} pl-10`}
              placeholder={view === "seguradoras" ? "Pesquisar nome, NIF ou contrato..." : "Pesquisar paciente, processo, cartão ou apólice..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {view === "assegurados" && (
            <>
              <select className={inputCls} value={insurerFilter} onChange={(e) => setInsurerFilter(e.target.value)}>
                <option value="">Todas as seguradoras</option>
                {data.seguradoras.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Todos os estados</option>
                {["Activo", "Suspenso", "Expirado", "Por iniciar", "Seguradora inactiva"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-sm border bg-white" style={BD}>
        <CardHeader
          title={view === "seguradoras" ? `Seguradoras (${insurers.length})` : `Pacientes Assegurados (${beneficiaries.length})`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ backgroundColor: HEAD_BG }}>
              <tr>
                {(view === "seguradoras"
                  ? ["Seguradora / NIF", "Contacto", "Contrato", "Cobertura", "Estado", "Acções"]
                  : ["Paciente / Processo", "Seguradora / Plano", "Cartão / Apólice", "Validade", "Cobertura", "Estado", "Acções"]
                ).map((title) => (
                  <th key={title} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view === "seguradoras" ? (
                insurers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="mb-3 flex justify-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full text-gray-300" style={{ backgroundColor: "#f3f4f6" }}><IconShield /></div>
                      </div>
                      <p className="font-semibold text-gray-800">Nenhuma seguradora registada</p>
                      <p className="mt-1 text-sm text-gray-500">Use "Nova Seguradora" para adicionar a primeira.</p>
                    </td>
                  </tr>
                ) : (
                  insurers.map((s) => (
                    <tr key={s.id} className="border-b transition hover:bg-[#fafbfc]" style={{ borderColor: CORES.borda }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: s.activa ? CORES.teal : "#9ca3af" }}>
                            {s.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800">{s.nome}</div>
                            <div className="font-mono text-[10px] text-gray-400">{s.nif || "NIF não indicado"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-gray-700">{s.contacto || "—"}</div>
                        {s.email && <div className="mt-0.5 text-gray-500">{s.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-gray-800">{s.contrato || "—"}</div>
                        <div className="mt-0.5 text-gray-500">Pagamento: {s.prazo} dias</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold" style={{ color: CORES.teal }}>{s.cobertura}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={s.activa ? "Activa" : "Inactiva"} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className={`${btnOutline} flex items-center gap-1.5`}
                          style={{ borderColor: `${CORES.teal}66`, color: CORES.teal }}
                          disabled={!canEdit || !!loaded.error}
                          onClick={() => { setFeedback(null); setInsurer({ ...s }); }}
                        >
                          <IconEdit /> Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                beneficiaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="mb-3 flex justify-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full text-gray-300" style={{ backgroundColor: "#f3f4f6" }}><IconUsers /></div>
                      </div>
                      <p className="font-semibold text-gray-800">Nenhum paciente assegurado</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {search || insurerFilter || statusFilter ? "Ajuste os filtros acima." : 'Use "Novo Assegurado" para registar o primeiro vínculo.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  beneficiaries.map((a) => {
                    const st = status(a);
                    return (
                      <tr key={a.id} className="border-b transition hover:bg-[#fafbfc]" style={{ borderColor: CORES.borda, borderLeft: `4px solid ${st === "Activo" ? CORES.verdeEscuro : st === "Expirado" ? CORES.vermelho : st === "Por iniciar" ? CORES.teal : CORES.oliva}` }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: CORES.teal }}>
                              {a.nome.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-800">{a.nome}</div>
                              <div className="text-[10px] text-gray-500">
                                Proc. {a.pacienteId}
                                {a.relationship === "dependente" && " · Dependente"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-semibold text-gray-800">{insurerById(a.seguradoraId)?.nome || "—"}</div>
                          <div className="mt-0.5 text-gray-500">{a.plano || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-mono font-semibold text-gray-800">{a.cartao}</div>
                          <div className="mt-0.5 text-gray-400">Apól. {a.apolice || "—"}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                          <div>{dateLabel(a.inicio)}</div>
                          <div className="text-gray-400">até {dateLabel(a.fim)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold" style={{ color: CORES.teal }}>{a.cobertura}%</span>
                          <div className="text-[10px] text-gray-400">Utente {100 - a.cobertura}%</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={st} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className={`${btnOutline} flex items-center gap-1.5`}
                            style={{ borderColor: `${CORES.teal}66`, color: CORES.teal }}
                            disabled={!canEdit || !!loaded.error}
                            onClick={() => { setFeedback(null); setBeneficiary({ ...a }); }}
                          >
                            <IconEdit /> Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  MODAL: SEGURADORA                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {insurer && (
        <Modal
          title={insurer.id ? "Editar Seguradora" : "Nova Seguradora"}
          subtitle={insurer.id ? `A actualizar: ${insurer.nome}` : "Preencha os dados da seguradora"}
          onClose={() => { setInsurer(null); setFeedback(null); }}
          maxW="max-w-2xl"
          footer={
            <>
              <button type="button" className={btnOutline} style={{ borderColor: "#d1d5db" }} onClick={() => { setInsurer(null); setFeedback(null); }}>
                Cancelar
              </button>
              <button type="submit" form="insurer-form" className={`${btnTeal} flex items-center gap-2`} style={{ backgroundColor: CORES.teal }} disabled={!canEdit || !!loaded.error}>
                <IconSave /> {insurer.id ? "Guardar alterações" : "Criar seguradora"}
              </button>
            </>
          }
        >
          <form id="insurer-form" noValidate onSubmit={saveInsurer} className="space-y-4">
            {feedback && feedback.msg && (
              <div className="flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold" style={{ borderColor: `${CORES.vermelho}33`, backgroundColor: "#fbeaea", color: CORES.vermelho }}>
                <IconAlert /> {feedback.msg}
              </div>
            )}

            <FormSection title="Identificação" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome da seguradora" required>
                <input autoFocus required maxLength={160} className={inputCls} value={insurer.nome} onChange={(e) => setInsurer({ ...insurer, nome: e.target.value })} />
              </Field>
              <Field label="NIF">
                <input maxLength={40} className={inputCls} value={insurer.nif} onChange={(e) => setInsurer({ ...insurer, nif: e.target.value })} />
              </Field>
            </div>

            <FormSection title="Contacto" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contacto">
                <input type="tel" maxLength={60} className={inputCls} placeholder="+244 9XX XXX XXX" value={insurer.contacto} onChange={(e) => setInsurer({ ...insurer, contacto: e.target.value })} />
              </Field>
              <Field label="Email">
                <input type="email" maxLength={160} className={inputCls} value={insurer.email} onChange={(e) => setInsurer({ ...insurer, email: e.target.value })} />
              </Field>
            </div>

            <FormSection title="Contrato e condições" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contrato / Convenção">
                <input maxLength={100} className={inputCls} value={insurer.contrato} onChange={(e) => setInsurer({ ...insurer, contrato: e.target.value })} />
              </Field>
              <Field label="Prazo de pagamento (dias)" required>
                <input type="number" required min={0} step={1} className={inputCls} value={Number.isNaN(insurer.prazo) ? "" : insurer.prazo} onChange={(e) => setInsurer({ ...insurer, prazo: e.target.valueAsNumber })} />
              </Field>
              <Field label="Cobertura padrão (%)" required>
                <input type="number" required min={0} max={100} step={0.01} className={inputCls} value={Number.isNaN(insurer.cobertura) ? "" : insurer.cobertura} onChange={(e) => setInsurer({ ...insurer, cobertura: e.target.valueAsNumber })} />
              </Field>
              <Field label="Estado">
                <select className={inputCls} value={insurer.activa ? "activa" : "inactiva"} onChange={(e) => setInsurer({ ...insurer, activa: e.target.value === "activa" })}>
                  <option value="activa">Activa</option>
                  <option value="inactiva">Inactiva</option>
                </select>
              </Field>
            </div>
            <p className="text-[11px] text-gray-400">
              A cobertura padrão é proposta para novos vínculos. Editar este valor não altera vínculos existentes.
            </p>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  MODAL: ASSEGURADO                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {beneficiary && (
        <Modal
          title={beneficiary.id ? "Editar Assegurado" : "Novo Assegurado"}
          subtitle={beneficiary.id ? `A actualizar: ${beneficiary.nome}` : "Vincule um paciente a uma seguradora"}
          onClose={() => { setBeneficiary(null); setFeedback(null); }}
          maxW="max-w-2xl"
          footer={
            <>
              <button type="button" className={btnOutline} style={{ borderColor: "#d1d5db" }} onClick={() => { setBeneficiary(null); setFeedback(null); }}>
                Cancelar
              </button>
              <button type="submit" form="beneficiary-form" className={`${btnTeal} flex items-center gap-2`} style={{ backgroundColor: CORES.teal }} disabled={!canEdit || !!loaded.error}>
                <IconSave /> {beneficiary.id ? "Guardar alterações" : "Criar vínculo"}
              </button>
            </>
          }
        >
          <form id="beneficiary-form" noValidate onSubmit={saveBeneficiary} className="space-y-4">
            {feedback && feedback.msg && (
              <div className="flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold" style={{ borderColor: `${CORES.vermelho}33`, backgroundColor: "#fbeaea", color: CORES.vermelho }}>
                <IconAlert /> {feedback.msg}
              </div>
            )}

            <FormSection title="Paciente" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Paciente do cadastro único" required>
                <select
                  required
                  autoFocus
                  className={inputCls}
                  value={beneficiary.pacienteId}
                  onChange={e => {
                    const p = appData.pacientes.find(p => String(p.id) === e.target.value);
                    setBeneficiary({ ...beneficiary, pacienteId: e.target.value, nome: p?.nome || "" });
                  }}
                >
                  <option value="">Pesquisar / seleccionar paciente</option>
                  {beneficiary.pacienteId && !appData.pacientes.some(p => String(p.id) === beneficiary.pacienteId) && (
                    <option value={beneficiary.pacienteId}>Vínculo anterior: {beneficiary.pacienteId} — associe o paciente correcto</option>
                  )}
                  {appData.pacientes.map(p => (
                    <option value={p.id} key={p.id}>{p.nome} · {p.processo || "ID " + p.id}</option>
                  ))}
                </select>
              </Field>
              <Field label="Titular ou dependente">
                <select className={inputCls} value={beneficiary.relationship || "titular"} onChange={e => setBeneficiary({ ...beneficiary, relationship: e.target.value as "titular" | "dependente" })}>
                  <option value="titular">Titular</option>
                  <option value="dependente">Dependente</option>
                </select>
              </Field>
            </div>

            <FormSection title="Seguro" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Seguradora" required>
                <select
                  required
                  className={inputCls}
                  value={beneficiary.seguradoraId}
                  onChange={(e) => {
                    const s = insurerById(e.target.value);
                    setBeneficiary({ ...beneficiary, seguradoraId: e.target.value, cobertura: s?.cobertura ?? 100 });
                  }}
                >
                  <option value="">Seleccionar</option>
                  {data.seguradoras.map((s) => (
                    <option key={s.id} value={s.id} disabled={!s.activa && s.id !== beneficiary.seguradoraId}>
                      {s.nome}{s.activa ? "" : " (inactiva)"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Plano">
                <input maxLength={100} className={inputCls} value={beneficiary.plano} onChange={(e) => setBeneficiary({ ...beneficiary, plano: e.target.value })} />
              </Field>
              <Field label="N.º do cartão" required>
                <input required maxLength={100} className={inputCls} value={beneficiary.cartao} onChange={(e) => setBeneficiary({ ...beneficiary, cartao: e.target.value })} />
              </Field>
              <Field label="N.º da apólice">
                <input maxLength={100} className={inputCls} value={beneficiary.apolice} onChange={(e) => setBeneficiary({ ...beneficiary, apolice: e.target.value })} />
              </Field>
            </div>

            <FormSection title="Validade e cobertura" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Início da validade" required>
                <input type="date" required className={inputCls} value={beneficiary.inicio} onChange={(e) => setBeneficiary({ ...beneficiary, inicio: e.target.value })} />
              </Field>
              <Field label="Fim da validade" required>
                <input type="date" required min={beneficiary.inicio || undefined} className={inputCls} value={beneficiary.fim} onChange={(e) => setBeneficiary({ ...beneficiary, fim: e.target.value })} />
              </Field>
              <Field label="Cobertura da seguradora (%)" required>
                <input type="number" required min={0} max={100} step={0.01} className={inputCls} value={Number.isNaN(beneficiary.cobertura) ? "" : beneficiary.cobertura} onChange={(e) => setBeneficiary({ ...beneficiary, cobertura: e.target.valueAsNumber })} />
              </Field>
              <Field label="Estado do vínculo">
                <select className={inputCls} value={beneficiary.activo ? "activo" : "suspenso"} onChange={(e) => setBeneficiary({ ...beneficiary, activo: e.target.value === "activo" })}>
                  <option value="activo">Activo</option>
                  <option value="suspenso">Suspenso</option>
                </select>
              </Field>
            </div>
            <p className="text-[11px] text-gray-400">
              O vínculo utiliza o ID do cadastro central. O nome e processo são confirmados pelo servidor; um cartão não cria outro paciente.
            </p>
          </form>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold text-white shadow-xl"
          style={{ backgroundColor: toast.error ? CORES.vermelho : CORES.verdeEscuro }}
        >
          {toast.error ? <IconAlert /> : <IconCheck />}
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-lg text-white/70 hover:text-white">×</button>
        </div>
      )}
    </div>
  );
}

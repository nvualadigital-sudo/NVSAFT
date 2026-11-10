import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  Fragment,
} from "react";
import { useApp } from "../../store/AppContext";
import { EXAMES_BUILTIN } from "../../data/exames";
import { normalizeExamName } from "../../utils/catalogImport";
import { Session } from "../../store/auth";
import { Fatura } from "../../store/AppContext";
import { api } from "../../store/api";
import { hospitalApi } from "../../store/hospital";
import { patientDisplayReference } from "../../utils/displayReference";
import type { ReportDetail } from "./relatorios";

/* ============================================================================ */
/*  PALETA VISUAL                                                               */
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
  sidebarHeader: "#1a3030",
  menuText: "#5ec4d4",
  borda: "#e5e7eb",
};
const FONTE = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
const HEAD_BG = "#f5f6f7";
const BD = { borderColor: CORES.borda };

const inputCls =
  "w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#0d7a8a] focus:ring-1 focus:ring-[#0d7a8a]/40 transition-colors";
const labelCls =
  "mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500";
const btnTeal =
  "rounded-sm px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]";
const btnOutline =
  "rounded-sm border px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50";
const btnRed =
  "rounded-sm border px-3 py-1.5 text-xs font-bold transition hover:bg-[#fbeaea]";

/* ============================================================================ */
/*  ÍCONES                                                                      */
/* ============================================================================ */
const IconX = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconSearch = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconList = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
  </svg>
);
const IconClock = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconFlask = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M10 2v7.31L4.34 19.03A2 2 0 0 0 6.07 22h11.86a2 2 0 0 0 1.73-2.97L14 9.31V2" />
    <line x1="8.5" y1="2" x2="15.5" y2="2" />
  </svg>
);
const IconSave = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconPrinter = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);
const IconEdit = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconArrowLeft = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);
const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconAI = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconRefresh = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);
const IconTrash = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);
const IconCheck = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const IconAlert = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const IconLink = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);
const IconUser = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/* ============================================================================ */
/*  COMPONENTES VISUAIS                                                         */
/* ============================================================================ */
function StatBlock({
  title,
  value,
  bg,
  icon,
}: {
  title: string;
  value: number;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-sm p-5 text-white"
      style={{ backgroundColor: bg, minHeight: 100 }}
    >
      <p className="text-sm font-medium opacity-90">{title}</p>
      <p className="mt-2 text-3xl font-extralight">{value}</p>
      <div
        className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
      >
        {icon}
      </div>
    </div>
  );
}

function CardHeader({
  title,
  right,
  num,
}: {
  title: string;
  right?: React.ReactNode;
  num?: string;
}) {
  return (
    <div
      className="flex items-center justify-between border-b px-5 py-3"
      style={{ ...BD, backgroundColor: HEAD_BG }}
    >
      <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-gray-700">
        {num && (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-sm text-xs font-bold text-white"
            style={{ backgroundColor: CORES.teal }}
          >
            {num}
          </span>
        )}
        {title}
      </h3>
      {right}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxW = "max-w-md",
}: any) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxW} rounded-sm border bg-white shadow-xl`}
        style={BD}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ ...BD, backgroundColor: HEAD_BG }}
        >
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-gray-700">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <IconX />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t px-5 py-3" style={BD}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: any) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

/* ============================================================================ */
/*  TIPOS E CONSTANTES                                                          */
/* ============================================================================ */
interface ParamRow {
  exame: string;
  parametro: string;
  resultado: string;
  unidade: string;
  referencia: string;
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface FilaItem {
  fatura: Fatura;
  pacienteNome: string;
  pacienteId?: number;
  temResultados: boolean;
}

type Solicitacao = {
  id: string;
  resultadoId?: string;
  parceiroNome: string;
  parceiroInstituicao: string;
  pacienteNome: string;
  pacienteNascimento: string;
  pacienteSexo: string;
  pacienteTelefone: string;
  pacienteBi: string;
  examesSolicitados: string[];
  observacoes: string;
  urgente: boolean;
  estado: string;
  data: string;
  hora: string;
};

const ESTADO_CFG: Record<
  string,
  { label: string; dot: string; bg: string; text: string }
> = {
  pendente: {
    label: "Pendente",
    dot: CORES.oliva,
    bg: "#fdfbea",
    text: CORES.oliva,
  },
  em_processo: {
    label: "Em Processo",
    dot: CORES.teal,
    bg: "#e6f4f6",
    text: CORES.teal,
  },
  concluido: {
    label: "Concluído",
    dot: CORES.verdeEscuro,
    bg: "#eaf5ee",
    text: CORES.verdeEscuro,
  },
  cancelado: {
    label: "Cancelado",
    dot: CORES.vermelho,
    bg: "#fbeaea",
    text: CORES.vermelho,
  },
};

/* ============================================================================ */
/*  PRINT SOLICITAÇÃO                                                           */
/* ============================================================================ */
function PrintSolicitacao({ sol }: { sol: Solicitacao }) {
  return (
    <div
      className="pdf-preview"
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: "#000",
        padding: "40px",
        maxWidth: "700px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          borderBottom: "2px solid #333",
          paddingBottom: "16px",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>PEDIDO DE EXAMES</h2>
        <p style={{ margin: "4px 0", color: "#555", fontSize: "12px" }}>
          Solicitação Externa nº {sol.id}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <div style={{ fontSize: "10px", color: "#888", marginBottom: "2px" }}>
            PARCEIRO / MÉDICO SOLICITANTE
          </div>
          <div style={{ fontWeight: "bold" }}>{sol.parceiroNome}</div>
          {sol.parceiroInstituicao && (
            <div style={{ color: "#555" }}>{sol.parceiroInstituicao}</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "#888", marginBottom: "2px" }}>
            DATA DO PEDIDO
          </div>
          <div style={{ fontWeight: "bold" }}>{sol.data}</div>
          {sol.hora && <div style={{ color: "#555" }}>{sol.hora}</div>}
        </div>
      </div>
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "6px",
          padding: "14px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "#888",
            fontWeight: "bold",
            marginBottom: "8px",
          }}
        >
          DADOS DO PACIENTE
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          <div>
            <span style={{ color: "#555" }}>Nome:</span>{" "}
            <strong>{sol.pacienteNome}</strong>
          </div>
          {sol.pacienteNascimento && (
            <div>
              <span style={{ color: "#555" }}>Nascimento:</span>{" "}
              {sol.pacienteNascimento}
            </div>
          )}
          {sol.pacienteSexo && (
            <div>
              <span style={{ color: "#555" }}>Sexo:</span>{" "}
              {sol.pacienteSexo === "M" ? "Masculino" : "Feminino"}
            </div>
          )}
          {sol.pacienteTelefone && (
            <div>
              <span style={{ color: "#555" }}>Telefone:</span>{" "}
              {sol.pacienteTelefone}
            </div>
          )}
          {sol.pacienteBi && (
            <div>
              <span style={{ color: "#555" }}>BI:</span> {sol.pacienteBi}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "6px",
          padding: "14px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "#888",
            fontWeight: "bold",
            marginBottom: "8px",
          }}
        >
          EXAMES SOLICITADOS
        </div>
        {sol.urgente && (
          <div
            style={{
              background: "#fee2e2",
              color: "#b91c1c",
              padding: "4px 10px",
              borderRadius: "4px",
              marginBottom: "8px",
              fontSize: "11px",
              fontWeight: "bold",
            }}
          >
            ⚠ PEDIDO URGENTE
          </div>
        )}
        {(sol.examesSolicitados || []).map((e, i) => (
          <div
            key={i}
            style={{
              padding: "5px 0",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                border: "1px solid #999",
                borderRadius: "3px",
                flexShrink: 0,
                marginTop: "1px",
              }}
            />
            <span>{e}</span>
          </div>
        ))}
      </div>
      {sol.observacoes && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "6px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              color: "#888",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            OBSERVAÇÕES CLÍNICAS
          </div>
          <p style={{ margin: 0 }}>{sol.observacoes}</p>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "50px",
          paddingTop: "16px",
          borderTop: "1px solid #ddd",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              borderTop: "1px solid #333",
              width: "180px",
              marginBottom: "4px",
            }}
          />
          <div style={{ fontSize: "11px", color: "#555" }}>
            Assinatura do Técnico
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              borderTop: "1px solid #333",
              width: "180px",
              marginBottom: "4px",
            }}
          />
          <div style={{ fontSize: "11px", color: "#555" }}>
            Carimbo do Laboratório
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================ */
/*  TIPOS AI                                                                    */
/* ============================================================================ */
interface AIExame {
  categoria?: string;
  exame?: string;
  parametro?: string;
  resultado?: string;
  unidade?: string;
  referencia?: string;
}
interface AIResultado {
  pacienteNome?: string;
  pacienteNasc?: string;
  pacienteSexo?: string;
  dataColheita?: string;
  tecnico?: string;
  exames?: AIExame[];
  observacoes?: string;
  raw?: string;
  parseError?: boolean;
}

/* ============================================================================ */
/*  COMPONENTE PRINCIPAL                                                        */
/* ============================================================================ */
export default function LancarResultados({
  session,
  initialReport,
  onSaved,
  onCancel,
  onOpenReport,
}: {
  session?: Session;
  initialReport?: ReportDetail;
  onSaved?: (id: number) => void;
  onCancel?: () => void;
  onOpenReport?: (id: number) => void;
}) {
  const { data, reload } = useApp();
  const saving = useRef(false);
  const submission = useRef<{ fingerprint: string; id: string } | null>(null);
  const [reason, setReason] = useState("");
  const [filaFaturas, setFilaFaturas] = useState<
    (Fatura & { reportId?: number })[]
  >([]);
  const [loadError, setLoadError] = useState("");
  const loadFila = useCallback(async () => {
    try {
      setFilaFaturas(await hospitalApi("GET", "/lab/launch-queue"));
      setLoadError("");
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Não foi possível carregar a fila.",
      );
    }
  }, []);
  useEffect(() => {
    void loadFila();
  }, [loadFila]);
  useEffect(() => {
    if (!initialReport) return;
    const r = initialReport.result;
    setSelectedPacienteId(r.pacienteId ? String(r.pacienteId) : "");
    setDataColheita(r.data);
    setTecnicoNome(session?.funcionarioNome || session?.username || "");
    setSelectedExames(new Set(r.parametros.map((p) => p.exame)));
    setParams(r.parametros.map((p) => ({ ...p })));
    setReason("");
    setView("entrada");
  }, [initialReport?.result.id, initialReport?.version]);
  function requestId(payload: unknown) {
    const fingerprint = JSON.stringify(payload);
    if (submission.current?.fingerprint !== fingerprint)
      submission.current = { fingerprint, id: crypto.randomUUID() };
    return submission.current!.id;
  }
  const [selectedPacienteId, setSelectedPacienteId] = useState<string>("");
  const [selectedFaturaNum, setSelectedFaturaNum] = useState<string>("");
  const [pacienteSearch, setPacienteSearch] = useState("");
  const [dataColheita, setDataColheita] = useState(todayStr);
  const [tecnicoNome, setTecnicoNome] = useState(
    session?.funcionarioNome || session?.username || "",
  );
  const [selectedExames, setSelectedExames] = useState<Set<string>>(new Set());
  const [params, setParams] = useState<ParamRow[]>([]);
  const [exameSearch, setExameSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [produtos, setProdutos] = useState<any[]>([]);
  useEffect(() => {
    api.produtos
      .list()
      .then(setProdutos)
      .catch(() => {});
  }, []);
  const [view, setView] = useState<
    "fila" | "entrada" | "externos" | "lançar_externo"
  >(initialReport ? "entrada" : "fila");

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIResultado | null>(null);
  const [aiError, setAiError] = useState<string>("");
  const [aiFileName, setAiFileName] = useState<string>("");

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loadingSols, setLoadingSols] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [printSol, setPrintSol] = useState<Solicitacao | null>(null);
  const [lancandoSol, setLancandoSol] = useState<Solicitacao | null>(null);
  const [guardandoExterno, setGuardandoExterno] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [successMsg, setSuccessMsg] = useState("");

  const loadSolicitacoes = useCallback(async () => {
    setLoadingSols(true);
    try {
      const list = await api.solicitacoes.listLab();
      setSolicitacoes(list);
    } catch (e) {
      setLoadError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar os pedidos externos.",
      );
    } finally {
      setLoadingSols(false);
    }
  }, []);

  useEffect(() => {
    loadSolicitacoes();
  }, [loadSolicitacoes]);

  const pendentesCount = solicitacoes.filter(
    (s) => s.estado === "pendente",
  ).length;

  const fila = useMemo<FilaItem[]>(() => {
    const itens: FilaItem[] = [];
    const faturasFiltradas = [...filaFaturas]
      .filter((f) => f.estado === "paga" || f.estado === "emitida")
      .sort((a, b) => b.id - a.id);

    for (const fatura of faturasFiltradas) {
      const pacienteId = fatura.pacienteId;
      const pacienteNome = pacienteId
        ? data.pacientes.find((p) => p.id === pacienteId)?.nome ||
          fatura.clienteNome
        : fatura.clienteNome;
      const temResultados = Boolean(fatura.reportId);
      itens.push({ fatura, pacienteNome, pacienteId, temResultados });
    }
    return itens;
  }, [filaFaturas, data.pacientes]);

  const allExames = useMemo(() => {
    const merged: Record<
      string,
      Record<string, [string, string, string][]>
    > = {};
    for (const [cat, sub] of Object.entries(EXAMES_BUILTIN)) {
      merged[cat] = {};
      for (const [nome, ps] of Object.entries(sub)) {
        merged[cat][nome] = ps as [string, string, string][];
      }
    }
    for (const [cat, sub] of Object.entries(data.examesCustom)) {
      if (!merged[cat]) merged[cat] = {};
      for (const [nome, ps] of Object.entries(sub)) {
        merged[cat][nome] = ps.map(
          (p) => [p.param, p.unidade, p.referencia] as [string, string, string],
        );
      }
    }
    return merged;
  }, [data.examesCustom]);

  const refByNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of produtos) {
      if (p.nome && p.codigo) m.set(p.nome.toLowerCase().trim(), p.codigo);
    }
    return m;
  }, [produtos]);

  const filteredExames = useMemo(() => {
    const q = exameSearch.toLowerCase().trim();
    const enabled = new Set(data.produtos.filter((p) => p.ativo).map((p) => normalizeExamName(p.nome)));
    const result: typeof allExames = {};
    for (const [cat, sub] of Object.entries(allExames)) {
      const matchedSub: typeof sub = {};
      for (const [nome, ps] of Object.entries(sub)) {
        if (!enabled.has(normalizeExamName(nome))) continue;
        const codigo = refByNome.get(nome.toLowerCase().trim()) || "";
        if (
          !q ||
          nome.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          codigo.toLowerCase().includes(q)
        )
          matchedSub[nome] = ps;
      }
      if (Object.keys(matchedSub).length > 0) result[cat] = matchedSub;
    }
    return result;
  }, [allExames, exameSearch, refByNome, data.produtos]);

  const filteredPacientes = useMemo(() => {
    const q = pacienteSearch.toLowerCase().trim();
    if (!q) return data.pacientes;
    return data.pacientes.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.processo.toLowerCase().includes(q) ||
        String(p.id).includes(q),
    );
  }, [data.pacientes, pacienteSearch]);

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });
  }
  function isCatExpanded(cat: string) {
    return exameSearch.trim() ? true : expandedCats.has(cat);
  }

  const buildRows = useCallback(
    (next: Set<string>, previous: ParamRow[] = []): ParamRow[] => {
      const rows: ParamRow[] = [];
      for (const exame of next) {
        const existing = previous.filter((p) => p.exame === exame);
        const configured = Object.values(allExames).find((sub) => sub[exame])?.[
          exame
        ];
        if (existing.length) rows.push(...existing);
        else if (configured)
          for (const [parametro, unidade, referencia] of configured)
            rows.push({ exame, parametro, unidade, referencia, resultado: "" });
        else
          rows.push({
            exame,
            parametro: "Resultado",
            unidade: "",
            referencia: "",
            resultado: "",
          });
      }
      return rows;
    },
    [allExames],
  );

  const toggleExame = useCallback(
    (nome: string) => {
      setSelectedExames((prev) => {
        const n = new Set(prev);
        if (n.has(nome)) n.delete(nome);
        else n.add(nome);
        setParams((previous) => buildRows(n, previous));
        return n;
      });
    },
    [buildRows],
  );

  function toggleAllInCat(cat: string, examNames: string[]) {
    setSelectedExames((prev) => {
      const n = new Set(prev);
      const allSelected = examNames.every((x) => n.has(x));
      if (allSelected) examNames.forEach((x) => n.delete(x));
      else examNames.forEach((x) => n.add(x));
      setParams((previous) => buildRows(n, previous));
      return n;
    });
  }

  function updateResultado(idx: number, value: string) {
    setParams((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, resultado: value } : p)),
    );
  }

  function selectFromFila(item: FilaItem) {
    if ((item.fatura as Fatura & { reportId?: number }).reportId) {
      onOpenReport?.((item.fatura as Fatura & { reportId?: number }).reportId!);
      return;
    }
    if (item.pacienteId) setSelectedPacienteId(String(item.pacienteId));
    else setSelectedPacienteId("");
    setSelectedFaturaNum(item.fatura.numero);
    setPacienteSearch("");
    setDataColheita(todayStr());
    setTecnicoNome(session?.funcionarioNome || session?.username || "");

    const examNames = (item.fatura.linhas || [])
      .map((l) => l.descricao?.trim())
      .filter(Boolean) as string[];
    const next = new Set<string>();
    for (const nomeExame of examNames) {
      let matched = false;
      for (const [_cat, sub] of Object.entries(allExames)) {
        for (const nome of Object.keys(sub)) {
          if (nome.toLowerCase() === nomeExame.toLowerCase()) {
            next.add(nome);
            matched = true;
          }
        }
      }
      if (!matched) next.add(nomeExame);
    }
    setSelectedExames(next);

    const rows: ParamRow[] = [];
    for (const nomeExame of next) {
      let found = false;
      for (const [_cat, sub] of Object.entries(allExames)) {
        if (sub[nomeExame]) {
          for (const [param, unidade, referencia] of sub[nomeExame]) {
            rows.push({
              exame: nomeExame,
              parametro: param,
              resultado: "",
              unidade,
              referencia,
            });
          }
          found = true;
          break;
        }
      }
      if (!found)
        rows.push({
          exame: nomeExame,
          parametro: "Resultado",
          resultado: "",
          unidade: "",
          referencia: "",
        });
    }
    setParams(rows);
    setView("entrada");
  }

  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    if (saving.current) return;
    if (!selectedPacienteId && !initialReport) {
      alert("Seleccione um paciente.");
      return;
    }
    if (!params.some((p) => p.resultado.trim())) {
      alert("Insira pelo menos um resultado.");
      return;
    }
    if (initialReport && !reason.trim()) {
      alert("Indique o motivo da alteração.");
      return;
    }
    const invoice = filaFaturas.find((f) => f.numero === selectedFaturaNum);
    const payload = {
      pacienteId:
        initialReport?.result.pacienteId ??
        (Number(selectedPacienteId) || null),
      data: dataColheita,
      parametros: params,
      reason,
      previousVersion: initialReport?.version || 0,
      ...(initialReport ? {} : { faturaId: invoice?.id }),
    };
    saving.current = true;
    setGuardando(true);
    try {
      const confirmed = await hospitalApi<{ id: number }>(
        "POST",
        initialReport
          ? "/lab/reports/" + initialReport.result.id + "/drafts"
          : "/lab/reports",
        { ...payload, requestId: requestId(payload) },
      );
      submission.current = null;
      setSelectedExames(new Set());
      setParams([]);
      setSelectedPacienteId("");
      setSelectedFaturaNum("");
      setReason("");
      await reload().catch(() => {});
      await loadFila();
      if (onSaved) onSaved(confirmed.id);
      else {
        setView("fila");
        alert("Versão guardada. Aguarda validação independente.");
      }
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Não foi possível confirmar a gravação.",
      );
    } finally {
      saving.current = false;
      setGuardando(false);
    }
  }

  async function handleUpdateEstado(sol: Solicitacao, estado: string) {
    setUpdatingId(sol.id);
    try {
      await api.solicitacoes.updateEstado(sol.id, estado);
      await loadSolicitacoes();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleIniciarLançamento(sol: Solicitacao) {
    if (sol.resultadoId) {
      onOpenReport?.(Number(sol.resultadoId));
      return;
    }
    if (sol.estado === "concluido") {
      alert(
        "O pedido concluído não tem resultado associado. Reveja a associação antes de editar.",
      );
      return;
    }
    if (sol.estado === "pendente") {
      setUpdatingId(sol.id);
      try {
        await api.solicitacoes.updateEstado(sol.id, "em_processo");
        await loadSolicitacoes();
        sol = { ...sol, estado: "em_processo" };
      } finally {
        setUpdatingId(null);
      }
    }
    setLancandoSol(sol);
    setDataColheita(todayStr());
    setTecnicoNome(session?.funcionarioNome || session?.username || "");
    const examesSol = sol.examesSolicitados || [];
    const next = new Set<string>();
    for (const nomeExame of examesSol) {
      for (const [_cat, sub] of Object.entries(allExames)) {
        for (const nome of Object.keys(sub)) {
          if (
            nome.toLowerCase() === nomeExame.toLowerCase() ||
            nome === nomeExame
          )
            next.add(nome);
        }
      }
      if (![...next].some((n) => n.toLowerCase() === nomeExame.toLowerCase()))
        next.add(nomeExame);
    }
    setSelectedExames(next);
    const rows: ParamRow[] = [];
    for (const nomeExame of next) {
      let found = false;
      for (const [_cat, sub] of Object.entries(allExames)) {
        if (sub[nomeExame]) {
          for (const [param, unidade, referencia] of sub[nomeExame]) {
            rows.push({
              exame: nomeExame,
              parametro: param,
              resultado: "",
              unidade,
              referencia,
            });
          }
          found = true;
          break;
        }
      }
      if (!found)
        rows.push({
          exame: nomeExame,
          parametro: "Resultado",
          resultado: "",
          unidade: "",
          referencia: "",
        });
    }
    setParams(rows);
    setFiltroEstado("em_processo");
    setView("lançar_externo");
  }

  async function handleGuardarExterno() {
    if (!lancandoSol || saving.current) return;
    if (!params.some((p) => p.resultado.trim())) {
      alert("Insira pelo menos um resultado.");
      return;
    }
    const payload = {
      solicitacaoId: lancandoSol.id,
      data: dataColheita,
      parametros: params,
      previousVersion: 0,
    };
    saving.current = true;
    setGuardandoExterno(true);
    try {
      const result = await hospitalApi<{ id: number }>("POST", "/lab/reports", {
        ...payload,
        requestId: requestId(payload),
      });
      submission.current = null;
      await loadSolicitacoes();
      await reload().catch(() => {});
      setLancandoSol(null);
      setSelectedExames(new Set());
      setParams([]);
      if (onSaved) onSaved(result.id);
      else {
        setSuccessMsg(
          "Versão guardada. O pedido fica em processo até à validação.",
        );
        setView("externos");
      }
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Não foi possível confirmar a gravação.",
      );
    } finally {
      saving.current = false;
      setGuardandoExterno(false);
    }
  }

  function handlePrintSol(sol: Solicitacao) {
    setPrintSol(sol);
    setTimeout(() => {
      window.print();
      setPrintSol(null);
    }, 200);
  }

  async function handleAnalisarDocumento(file: File) {
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    setAiFileName(file.name);
    if (
      file.size > 10 * 1024 * 1024 ||
      ![
        "image/png",
        "image/jpeg",
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/json",
      ].includes(file.type)
    ) {
      setAiError("Use PNG, JPEG, PDF, TXT, CSV ou JSON até 10 MB.");
      setAiLoading(false);
      return;
    }
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mimeType = file.type || "image/jpeg";
      const token = api.getToken() || "";
      const res = await fetch(
        (import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "") +
          "/api/ai/analisar-documento",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error || "Erro desconhecido");
        return;
      }
      setAiResult(json as AIResultado);
    } catch (e: any) {
      setAiError(e?.message || "Erro ao enviar documento");
    } finally {
      setAiLoading(false);
    }
  }

  function handleAplicarAI() {
    if (!aiResult) return;
    if (aiResult.dataColheita) setDataColheita(aiResult.dataColheita);
    if (aiResult.tecnico) setTecnicoNome(aiResult.tecnico);
    const exames = aiResult.exames || [];
    if (exames.length > 0) {
      const newParams: ParamRow[] = exames
        .filter((e) => e.parametro || e.exame)
        .map((e) => ({
          exame: e.exame || e.categoria || "Análise",
          parametro: e.parametro || "Resultado",
          resultado: e.resultado || "",
          unidade: e.unidade || "",
          referencia: e.referencia || "",
        }));
      if (newParams.length > 0) {
        const exameNames = new Set(newParams.map((p) => p.exame));
        setSelectedExames(exameNames);
        setParams(newParams);
      }
    }
    setAiModalOpen(false);
    setAiResult(null);
  }

  const groupedParams: Record<string, ParamRow[]> = {};
  for (const p of params) {
    if (!groupedParams[p.exame]) groupedParams[p.exame] = [];
    groupedParams[p.exame].push(p);
  }
  const selectedPaciente = data.pacientes.find(
    (p) => p.id === parseInt(selectedPacienteId, 10),
  );

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  AI MODAL                                                                */
  /* ════════════════════════════════════════════════════════════════════════ */
  const renderAIModal = () => (
    <Modal
      title="Importar Documento com IA"
      subtitle="Fotografia, PDF ou imagem → preenchimento automático"
      onClose={() => {
        setAiModalOpen(false);
        setAiResult(null);
        setAiError("");
      }}
      maxW="max-w-2xl"
      footer={
        aiResult && !aiLoading ? (
          <>
            <button
              onClick={() => {
                setAiResult(null);
                setAiFileName("");
              }}
              className={btnOutline}
              style={{ borderColor: "#d1d5db" }}
            >
              Novo Ficheiro
            </button>
            <button
              onClick={handleAplicarAI}
              className={btnTeal}
              style={{ backgroundColor: CORES.teal }}
            >
              <IconCheck /> Aplicar
            </button>
          </>
        ) : undefined
      }
    >
      {!aiResult && !aiLoading && (
        <label className="block cursor-pointer">
          <div
            className="rounded-sm border-2 border-dashed p-10 text-center transition hover:bg-[#fafbfc]"
            style={{ borderColor: `${CORES.teal}55` }}
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "#e6f4f6", color: CORES.teal }}
            >
              <IconAI />
            </div>
            <p className="text-sm font-semibold" style={{ color: CORES.teal }}>
              Clique para seleccionar ficheiro
            </p>
            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG, PDF (max 10 MB)
            </p>
            {aiFileName && (
              <p
                className="mt-2 text-xs font-medium"
                style={{ color: CORES.teal }}
              >
                📎 {aiFileName}
              </p>
            )}
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAnalisarDocumento(f);
            }}
          />
        </label>
      )}
      {aiLoading && (
        <div className="py-12 text-center">
          <div
            className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: CORES.teal }}
          />
          <p className="text-sm font-semibold" style={{ color: CORES.teal }}>
            A analisar documento...
          </p>
        </div>
      )}
      {aiError && (
        <div
          className="rounded-sm border px-4 py-3 text-sm"
          style={{
            backgroundColor: "#fbeaea",
            borderColor: `${CORES.vermelho}33`,
            color: CORES.vermelho,
          }}
        >
          <div className="flex items-center gap-2 font-semibold">
            <IconAlert /> {aiError}
          </div>
          <button
            className="mt-2 text-xs underline"
            onClick={() => {
              setAiError("");
              setAiFileName("");
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {aiResult && !aiLoading && (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 rounded-sm border px-4 py-2.5 text-xs"
            style={{
              backgroundColor: "#eaf5ee",
              borderColor: `${CORES.verdeEscuro}33`,
              color: CORES.verdeEscuro,
            }}
          >
            <IconCheck /> Documento analisado. Reveja antes de aplicar.
          </div>
          {(aiResult.exames || []).length > 0 && (
            <div className="overflow-hidden rounded-sm border" style={BD}>
              <div
                className="border-b px-3 py-2 text-xs font-bold text-gray-500"
                style={{ backgroundColor: HEAD_BG }}
              >
                {aiResult.exames!.length} parâmetro(s) extraído(s)
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-xs">
                  <thead
                    className="sticky top-0"
                    style={{ backgroundColor: HEAD_BG }}
                  >
                    <tr>
                      <th className="px-3 py-1.5 text-left font-semibold">
                        Exame / Parâmetro
                      </th>
                      <th className="w-24 px-3 py-1.5 text-center font-semibold">
                        Resultado
                      </th>
                      <th className="w-20 px-3 py-1.5 text-center font-semibold">
                        Unidade
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiResult.exames!.map((e, i) => (
                      <tr
                        key={i}
                        className="border-t"
                        style={{ borderColor: CORES.borda }}
                      >
                        <td className="px-3 py-1.5">
                          {e.exame && (
                            <span
                              className="font-semibold"
                              style={{ color: CORES.teal }}
                            >
                              {e.exame} ·{" "}
                            </span>
                          )}
                          {e.parametro}
                        </td>
                        <td className="px-3 py-1.5 text-center font-medium">
                          {e.resultado}
                        </td>
                        <td className="px-3 py-1.5 text-center text-gray-400">
                          {e.unidade}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );

  if (printSol) return <PrintSolicitacao sol={printSol} />;

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  VIEW: LANÇAR EXTERNO                                                    */
  /* ════════════════════════════════════════════════════════════════════════ */
  if (view === "lançar_externo" && lancandoSol) {
    const solGrouped: Record<string, ParamRow[]> = {};
    for (const p of params) {
      if (!solGrouped[p.exame]) solGrouped[p.exame] = [];
      solGrouped[p.exame].push(p);
    }

    return (
      <div
        className="min-h-screen bg-white p-6 md:p-8"
        style={{ fontFamily: FONTE }}
      >
        <div
          className="mb-6 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
          style={BD}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setFiltroEstado("em_processo");
                setView("externos");
                setLancandoSol(null);
                setSelectedExames(new Set());
                setParams([]);
              }}
              className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-80"
              style={{ color: CORES.teal }}
            >
              <IconArrowLeft /> Parceiros
            </button>
            <h2 className="text-xl font-light text-gray-600">
              Lançar Resultados
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {lancandoSol.urgente && (
              <span
                className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase text-white"
                style={{ backgroundColor: CORES.vermelho }}
              >
                URGENTE
              </span>
            )}
            <button
              onClick={() => {
                setAiModalOpen(true);
                setAiResult(null);
                setAiError("");
                setAiFileName("");
              }}
              className={`${btnOutline} flex items-center gap-2`}
              style={{ borderColor: `${CORES.teal}66`, color: CORES.teal }}
            >
              <IconAI /> Importar IA
            </button>
          </div>
        </div>

        {aiModalOpen && renderAIModal()}

        {/* Paciente */}
        <div className="mb-5 rounded-sm border bg-white" style={BD}>
          <CardHeader num="1" title="Dados do Pedido" />
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ backgroundColor: CORES.teal }}
              >
                {lancandoSol.pacienteNome.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-gray-800">
                  {lancandoSol.pacienteNome}
                </div>
                <div className="text-xs text-gray-500">
                  Por <strong>{lancandoSol.parceiroNome}</strong>
                  {lancandoSol.parceiroInstituicao &&
                    ` · ${lancandoSol.parceiroInstituicao}`}{" "}
                  · {lancandoSol.data}
                </div>
              </div>
            </div>
            <div
              className="grid grid-cols-2 gap-3 rounded-sm border p-3 text-xs md:grid-cols-4"
              style={{ backgroundColor: "#fafbfc", ...BD }}
            >
              {lancandoSol.pacienteNascimento && (
                <div>
                  <span className="font-bold text-gray-500">Nasc:</span>{" "}
                  <span>{lancandoSol.pacienteNascimento}</span>
                </div>
              )}
              {lancandoSol.pacienteSexo && (
                <div>
                  <span className="font-bold text-gray-500">Sexo:</span>{" "}
                  <span>
                    {lancandoSol.pacienteSexo === "M"
                      ? "Masculino"
                      : "Feminino"}
                  </span>
                </div>
              )}
              {lancandoSol.pacienteBi && (
                <div>
                  <span className="font-bold text-gray-500">BI:</span>{" "}
                  <span>{lancandoSol.pacienteBi}</span>
                </div>
              )}
              {lancandoSol.pacienteTelefone && (
                <div>
                  <span className="font-bold text-gray-500">Tel:</span>{" "}
                  <span>{lancandoSol.pacienteTelefone}</span>
                </div>
              )}
            </div>
            {lancandoSol.observacoes && (
              <div
                className="rounded-sm border p-3 text-xs italic"
                style={{
                  borderColor: `${CORES.oliva}55`,
                  backgroundColor: "#fdfbea",
                  color: CORES.oliva,
                }}
              >
                <span className="font-bold not-italic">Observações:</span>{" "}
                {lancandoSol.observacoes}
              </div>
            )}
            <div>
              <span className={labelCls}>Exames solicitados</span>
              <div className="flex flex-wrap gap-1.5">
                {(lancandoSol.examesSolicitados || []).map((e) => (
                  <span
                    key={e}
                    className="rounded-sm border px-2.5 py-1 text-xs font-medium text-gray-600"
                    style={BD}
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Colheita */}
        <div className="mb-5 rounded-sm border bg-white" style={BD}>
          <CardHeader num="2" title="Informações do Lançamento" />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Data de Colheita">
              <input
                value={dataColheita}
                onChange={(e) => setDataColheita(e.target.value)}
                className={inputCls}
                placeholder="DD/MM/AAAA"
              />
            </Field>
            <Field label="Técnico Responsável">
              <input
                readOnly
                value={tecnicoNome}
                className={inputCls}
                placeholder="Nome do técnico..."
              />
            </Field>
          </div>
        </div>

        {/* Resultados */}
        <div className="rounded-sm border bg-white" style={BD}>
          <CardHeader
            num="3"
            title={`Parâmetros e Resultados (${params.length})`}
            right={
              <button
                onClick={handleGuardarExterno}
                disabled={
                  guardandoExterno || !params.some((p) => p.resultado.trim())
                }
                className={`${btnTeal} flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
                style={{ backgroundColor: CORES.verdeEscuro }}
              >
                {guardandoExterno ? (
                  "A guardar..."
                ) : (
                  <>
                    <IconSave /> Guardar para validação
                  </>
                )}
              </button>
            }
          />
          {params.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center border-t border-dashed py-16 text-center"
              style={BD}
            >
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-gray-300"
                style={{ backgroundColor: "#f3f4f6" }}
              >
                <IconFlask />
              </div>
              <p className="font-semibold text-gray-800">
                Exames não encontrados no catálogo
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: HEAD_BG }}>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Parâmetro
                    </th>
                    <th className="w-40 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Resultado *
                    </th>
                    <th className="hidden w-28 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:table-cell">
                      Unidade
                    </th>
                    <th className="hidden w-44 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:table-cell">
                      Referência
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(solGrouped).map(([exame, exameParams]) => {
                    const startIdx = params.findIndex((p) => p.exame === exame);
                    return (
                      <Fragment key={exame}>
                        <tr key={`h-${exame}`}>
                          <td
                            colSpan={4}
                            className="border-y px-4 py-2 text-xs font-bold"
                            style={{
                              backgroundColor: "#e6f4f6",
                              color: CORES.teal,
                              borderColor: `${CORES.teal}33`,
                            }}
                          >
                            <IconFlask /> {exame}
                          </td>
                        </tr>
                        {exameParams.map((p, localIdx) => {
                          const globalIdx = params.indexOf(p);
                          return (
                            <tr
                              key={`${exame}-${localIdx}`}
                              className="border-b transition hover:bg-[#fafbfc]"
                              style={{ borderColor: CORES.borda }}
                            >
                              <td className="px-4 py-2 text-xs">
                                <div>{p.parametro}</div>
                                <div className="mt-0.5 text-[10px] text-gray-400 sm:hidden">
                                  {p.unidade}{" "}
                                  {p.referencia ? `· ${p.referencia}` : ""}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <input
                                  value={p.resultado}
                                  onChange={(e) =>
                                    updateResultado(globalIdx, e.target.value)
                                  }
                                  className="w-full rounded-sm border border-gray-300 px-2 py-1.5 text-center text-sm font-medium focus:border-[#0d7a8a] focus:outline-none focus:ring-1 focus:ring-[#0d7a8a]/40"
                                  placeholder="—"
                                />
                              </td>
                              <td className="hidden px-4 py-2 text-center text-xs text-gray-400 sm:table-cell">
                                {p.unidade}
                              </td>
                              <td className="hidden px-4 py-2 text-center text-xs text-gray-400 sm:table-cell">
                                {p.referencia}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={() => {
              setFiltroEstado("em_processo");
              setView("externos");
              setLancandoSol(null);
              setSelectedExames(new Set());
              setParams([]);
            }}
            className={`${btnOutline} flex items-center gap-2`}
            style={{ borderColor: "#d1d5db" }}
          >
            <IconArrowLeft /> Voltar
          </button>
          <button
            onClick={handleGuardarExterno}
            disabled={
              guardandoExterno || !params.some((p) => p.resultado.trim())
            }
            className={`${btnTeal} flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
            style={{ backgroundColor: CORES.verdeEscuro }}
          >
            {guardandoExterno ? (
              "A guardar..."
            ) : (
              <>
                <IconSave /> Guardar para validação
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  VIEW: EXTERNOS                                                          */
  /* ════════════════════════════════════════════════════════════════════════ */
  if (view === "externos") {
    const solicitacoesFiltradas = solicitacoes.filter(
      (s) => filtroEstado === "todos" || s.estado === filtroEstado,
    );
    return (
      <div
        className="min-h-screen bg-white p-6 md:p-8"
        style={{ fontFamily: FONTE }}
      >
        <div
          className="mb-6 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
          style={BD}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                initialReport && onCancel ? onCancel() : setView("fila")
              }
              className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-80"
              style={{ color: CORES.teal }}
            >
              <IconArrowLeft /> Fila de Atendimento
            </button>
            <h2 className="text-xl font-light text-gray-600">
              Pedidos de Parceiros
            </h2>
          </div>
          <button
            onClick={loadSolicitacoes}
            className={`${btnOutline} flex items-center gap-2`}
            style={{ borderColor: "#d1d5db" }}
          >
            <IconRefresh /> Actualizar
          </button>
        </div>

        {loadError && (
          <p
            role="alert"
            className="mb-4 text-sm"
            style={{ color: CORES.vermelho }}
          >
            {loadError}
          </p>
        )}
        {successMsg && (
          <div
            className="mb-4 flex items-start gap-3 rounded-sm px-4 py-3 text-sm"
            style={{ backgroundColor: "#eaf5ee", color: CORES.verdeEscuro }}
          >
            <IconCheck />
            <span className="flex-1 font-medium">{successMsg}</span>
            <button
              onClick={() => setSuccessMsg("")}
              className="opacity-80 hover:opacity-100"
            >
              <IconX />
            </button>
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatBlock
            title="Total"
            value={solicitacoes.length}
            bg={CORES.navy}
            icon={<IconList />}
          />
          <StatBlock
            title="Pendentes"
            value={solicitacoes.filter((s) => s.estado === "pendente").length}
            bg={CORES.oliva}
            icon={<IconClock />}
          />
          <StatBlock
            title="Em processo"
            value={
              solicitacoes.filter((s) => s.estado === "em_processo").length
            }
            bg={CORES.teal}
            icon={<IconFlask />}
          />
          <StatBlock
            title="Concluídos"
            value={solicitacoes.filter((s) => s.estado === "concluido").length}
            bg={CORES.verdeEscuro}
            icon={<IconCheck />}
          />
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {[
            { key: "todos", label: "Todos" },
            { key: "pendente", label: "Pendente" },
            { key: "em_processo", label: "Em Processo" },
            { key: "concluido", label: "Concluído" },
            { key: "cancelado", label: "Cancelado" },
          ].map(({ key, label }) => {
            const count =
              key === "todos"
                ? solicitacoes.length
                : solicitacoes.filter((s) => s.estado === key).length;
            const isActive = filtroEstado === key;
            return (
              <button
                key={key}
                onClick={() => setFiltroEstado(key)}
                className={`whitespace-nowrap rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${isActive ? "border-transparent text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                style={
                  isActive
                    ? {
                        backgroundColor: CORES.sidebar,
                        borderColor: CORES.sidebar,
                      }
                    : { borderColor: "#d1d5db" }
                }
              >
                {label}{" "}
                <span
                  className={`ml-1.5 rounded-sm px-1.5 py-0.5 text-[10px] ${isActive ? "bg-white/20" : "bg-gray-100"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loadingSols ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-sm bg-gray-100"
              />
            ))}
          </div>
        ) : solicitacoesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center rounded-sm border border-dashed border-gray-300 py-16 text-center">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-gray-300"
              style={{ backgroundColor: "#f3f4f6" }}
            >
              <IconList />
            </div>
            <p className="font-semibold text-gray-800">
              Nenhum pedido encontrado
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {solicitacoesFiltradas.map((sol) => {
              const estadoCfg = ESTADO_CFG[sol.estado] ?? {
                label: sol.estado,
                dot: "#9ca3af",
                bg: "#f3f4f6",
                text: "#4b5563",
              };
              return (
                <div
                  key={sol.id}
                  className="rounded-sm border bg-white transition-shadow hover:shadow-md"
                  style={{ ...BD, borderLeft: `4px solid ${estadoCfg.dot}` }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                        style={{ backgroundColor: CORES.teal }}
                      >
                        {sol.pacienteNome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-gray-800">
                            {sol.pacienteNome}
                          </span>
                          {sol.urgente && (
                            <span
                              className="rounded-sm px-2 py-0.5 text-[10px] font-extrabold uppercase text-white"
                              style={{ backgroundColor: CORES.vermelho }}
                            >
                              URGENTE
                            </span>
                          )}
                          <span
                            className="rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              backgroundColor: estadoCfg.bg,
                              color: estadoCfg.text,
                            }}
                          >
                            {estadoCfg.label}
                          </span>
                        </div>
                        <div className="mb-2 text-xs font-medium text-gray-400">
                          Por:{" "}
                          <span className="font-semibold text-gray-600">
                            {sol.parceiroNome}
                          </span>
                          {sol.parceiroInstituicao &&
                            ` · ${sol.parceiroInstituicao}`}{" "}
                          · {sol.data} {sol.hora}
                        </div>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {(sol.examesSolicitados || []).map((e) => (
                            <span
                              key={e}
                              className="rounded-sm border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                        {sol.observacoes && (
                          <p
                            className="rounded-sm bg-gray-50 p-2 text-xs italic text-gray-500"
                            style={{ borderLeft: `2px solid ${CORES.teal}` }}
                          >
                            "{sol.observacoes}"
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handlePrintSol(sol)}
                            className={`${btnOutline} flex items-center gap-1.5`}
                            style={{ borderColor: "#d1d5db" }}
                          >
                            <IconPrinter /> Imprimir
                          </button>
                          {(sol.estado === "pendente" ||
                            sol.estado === "em_processo") && (
                            <button
                              onClick={() => handleIniciarLançamento(sol)}
                              disabled={updatingId === sol.id}
                              className={`${btnTeal} flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
                              style={{ backgroundColor: CORES.teal }}
                            >
                              <IconEdit />{" "}
                              {sol.estado === "pendente"
                                ? "Iniciar e Lançar"
                                : "Lançar Resultados"}
                            </button>
                          )}
                          {sol.estado === "concluido" && (
                            <button
                              onClick={() => handleIniciarLançamento(sol)}
                              className={`${btnOutline} flex items-center gap-1.5`}
                              style={{
                                borderColor: CORES.verdeEscuro,
                                color: CORES.verdeEscuro,
                              }}
                            >
                              <IconEdit /> Editar Resultados
                            </button>
                          )}
                          {(sol.estado === "pendente" ||
                            sol.estado === "em_processo") && (
                            <button
                              onClick={() =>
                                handleUpdateEstado(sol, "cancelado")
                              }
                              disabled={updatingId === sol.id}
                              className={`${btnRed} flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
                              style={{
                                borderColor: CORES.vermelho,
                                color: CORES.vermelho,
                              }}
                            >
                              <IconX /> Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  VIEW: FILA                                                              */
  /* ════════════════════════════════════════════════════════════════════════ */
  if (view === "fila") {
    const pendentesFila = fila.filter((i) => !i.temResultados).length;
    return (
      <div
        className="min-h-screen bg-white p-6 md:p-8"
        style={{ fontFamily: FONTE }}
      >
        <div
          className="mb-6 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
          style={BD}
        >
          <h2 className="text-xl font-light text-gray-600">
            Fila de Atendimento
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setView("externos");
                loadSolicitacoes();
              }}
              className={`${btnOutline} flex items-center gap-2`}
              style={{ borderColor: `${CORES.teal}66`, color: CORES.teal }}
            >
              <IconLink /> Parceiros
              {pendentesCount > 0 && (
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: CORES.vermelho }}
                >
                  {pendentesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setSelectedPacienteId("");
                setSelectedFaturaNum("");
                setView("entrada");
              }}
              className={`${btnTeal} flex items-center gap-2`}
              style={{ backgroundColor: CORES.teal }}
            >
              <IconPlus /> Lançar sem fatura
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatBlock
            title="Na fila"
            value={fila.length}
            bg={CORES.navy}
            icon={<IconList />}
          />
          <StatBlock
            title="Aguardando resultados"
            value={pendentesFila}
            bg={CORES.teal}
            icon={<IconClock />}
          />
          <StatBlock
            title="Já lançados"
            value={fila.length - pendentesFila}
            bg={CORES.verdeEscuro}
            icon={<IconCheck />}
          />
        </div>

        <div
          className="mb-5 flex items-center gap-2 rounded-sm border px-4 py-2.5 text-xs"
          style={{
            borderColor: `${CORES.oliva}55`,
            backgroundColor: "#fdfbea",
            color: CORES.oliva,
          }}
        >
          <IconAlert /> Pacientes com fatura emitida ou paga aguardam
          lançamento.
        </div>

        {loadError && (
          <p
            role="alert"
            className="mb-4 rounded-sm border p-3 text-sm"
            style={{ color: CORES.vermelho, borderColor: CORES.vermelho }}
          >
            {loadError}
          </p>
        )}
        <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
          <span>Últimas 200 facturas elegíveis desta instituição.</span>
          <button className={btnOutline} onClick={() => void loadFila()}>
            Actualizar fila
          </button>
        </div>
        {fila.length === 0 ? (
          <div className="flex flex-col items-center rounded-sm border border-dashed border-gray-300 py-16 text-center">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-gray-300"
              style={{ backgroundColor: "#f3f4f6" }}
            >
              <IconFlask />
            </div>
            <p className="font-semibold text-gray-800">
              Nenhum paciente na fila
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Emita uma fatura em <strong>Faturação</strong>.
            </p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-sm border bg-white"
            style={BD}
          >
            <CardHeader title={`Pacientes aguardando (${fila.length})`} />
            <div
              className="grid grid-cols-12 gap-2 border-b px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500"
              style={{ backgroundColor: HEAD_BG, borderColor: CORES.borda }}
            >
              <div className="col-span-4">Paciente</div>
              <div className="col-span-2">N.º Fatura</div>
              <div className="col-span-2 text-center">Data</div>
              <div className="col-span-2 text-center">Estado</div>
              <div className="col-span-1 text-center">Resultados</div>
              <div className="col-span-1 text-center">Acção</div>
            </div>
            <div className="divide-y" style={{ borderColor: CORES.borda }}>
              {fila.map((item) => (
                <div
                  key={item.fatura.id}
                  className={`grid grid-cols-12 items-center gap-2 px-5 py-3.5 transition-colors hover:bg-[#fafbfc] ${item.temResultados ? "opacity-70" : ""}`}
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{
                        backgroundColor: item.temResultados
                          ? "#9ca3af"
                          : CORES.teal,
                      }}
                    >
                      {item.pacienteNome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-800">
                        {item.pacienteNome}
                      </div>
                      {item.fatura.clienteNif && (
                        <div className="text-xs text-gray-400">
                          NIF: {item.fatura.clienteNif}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span
                      className="font-mono text-xs font-bold"
                      style={{ color: CORES.teal }}
                    >
                      {item.fatura.numero}
                    </span>
                  </div>
                  <div className="col-span-2 text-center text-xs text-gray-400">
                    {item.fatura.data}
                  </div>
                  <div className="col-span-2 text-center">
                    <span
                      className="rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor:
                          item.fatura.estado === "paga" ? "#eaf5ee" : "#e6f4f6",
                        color:
                          item.fatura.estado === "paga"
                            ? CORES.verdeEscuro
                            : CORES.teal,
                      }}
                    >
                      {item.fatura.estado === "paga" ? "Pago" : "Emitida"}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    {item.temResultados ? (
                      <span
                        className="text-xs font-bold"
                        style={{ color: CORES.verdeEscuro }}
                      >
                        ✓ Tem
                      </span>
                    ) : (
                      <span
                        className="text-xs font-bold"
                        style={{ color: CORES.oliva }}
                      >
                        Pendente
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      onClick={() => selectFromFila(item)}
                      className={`${btnTeal} text-xs`}
                      style={{
                        backgroundColor: item.temResultados
                          ? "#6b7280"
                          : CORES.teal,
                      }}
                    >
                      {item.temResultados ? "Abrir" : "Iniciar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  VIEW: ENTRADA                                                           */
  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div
      className="min-h-screen bg-white p-6 md:p-8"
      style={{ fontFamily: FONTE }}
    >
      <div
        className="mb-6 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
        style={BD}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              initialReport && onCancel ? onCancel() : setView("fila")
            }
            className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-80"
            style={{ color: CORES.teal }}
          >
            <IconArrowLeft /> Fila
          </button>
          <h2 className="text-xl font-light text-gray-600">
            {initialReport
              ? "Editar Resultado #" + initialReport.result.id
              : "Lançar Resultados"}
          </h2>
          {selectedFaturaNum && (
            <span
              className="rounded-sm px-2 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: CORES.teal }}
            >
              Fatura: {selectedFaturaNum}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setAiModalOpen(true);
            setAiResult(null);
            setAiError("");
            setAiFileName("");
          }}
          className={`${btnOutline} flex items-center gap-2`}
          style={{ borderColor: `${CORES.teal}66`, color: CORES.teal }}
        >
          <IconAI /> Importar IA
        </button>
      </div>

      {aiModalOpen && renderAIModal()}

      {/* Paciente */}
      <div className="mb-5 rounded-sm border bg-white" style={BD}>
        <CardHeader num="1" title="Identificação e Colheita" />
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Pesquisar Paciente">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <IconSearch />
                </div>
                <input
                  disabled={!!initialReport}
                  value={pacienteSearch}
                  onChange={(e) => {
                    setPacienteSearch(e.target.value);
                    setSelectedPacienteId("");
                  }}
                  className={`${inputCls} pl-10`}
                  placeholder="Nome, processo ou ID..."
                />
              </div>
            </Field>
            <Field label="Paciente *">
              <select
                disabled={!!initialReport}
                value={selectedPacienteId}
                onChange={(e) => {
                  setSelectedPacienteId(e.target.value);
                  setPacienteSearch("");
                }}
                className={inputCls}
              >
                <option value="">
                  {filteredPacientes.length === 0 ? "Nenhum" : "Seleccionar..."}
                </option>
                {filteredPacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {patientDisplayReference(p)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data de Colheita">
              <input
                value={dataColheita}
                onChange={(e) => setDataColheita(e.target.value)}
                className={inputCls}
                placeholder="DD/MM/AAAA"
              />
            </Field>
            <Field label="Técnico Responsável">
              <input
                readOnly
                value={tecnicoNome}
                className={inputCls}
                placeholder="Nome..."
              />
            </Field>
          </div>

          {initialReport && (
            <div
              className="rounded-sm border p-4 text-sm"
              style={{ ...BD, backgroundColor: "#fdfbea", color: CORES.oliva }}
            >
              <strong>
                {initialReport.result.pacienteNome} · versão{" "}
                {initialReport.version}
              </strong>
              <p className="mt-1 text-xs">
                A versão anterior fica preservada. A correcção aguarda nova
                validação antes da entrega.
              </p>
              <Field label="Motivo da alteração *">
                <textarea
                  className={inputCls}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                  rows={2}
                />
              </Field>
            </div>
          )}
          {selectedPaciente && (
            <div
              className="overflow-hidden rounded-sm border"
              style={{
                borderColor: `${CORES.teal}66`,
                backgroundColor: "#e6f4f6",
              }}
            >
              <div
                className="flex items-center gap-3 border-b px-4 py-3"
                style={{
                  borderColor: `${CORES.teal}33`,
                  backgroundColor: "rgba(13, 122, 138, 0.08)",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: CORES.teal }}
                >
                  {selectedPaciente.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-800">
                    {selectedPaciente.nome}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-gray-600">
                    {selectedPaciente.sexo && (
                      <span>
                        {selectedPaciente.sexo === "M"
                          ? "Masculino"
                          : "Feminino"}
                      </span>
                    )}
                    {selectedPaciente.nasc && (
                      <span>Nasc: {selectedPaciente.nasc}</span>
                    )}
                    {selectedPaciente.idade && (
                      <span>{selectedPaciente.idade} anos</span>
                    )}
                  </div>
                </div>
                {selectedPaciente.grupoSanguineo && (
                  <span
                    className="shrink-0 rounded-sm px-2.5 py-1 text-xs font-bold text-white"
                    style={{ backgroundColor: CORES.vermelho }}
                  >
                    {selectedPaciente.grupoSanguineo}
                    {selectedPaciente.fatorRh || ""}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-xs md:grid-cols-3 lg:grid-cols-4">
                {selectedPaciente.processo && (
                  <div>
                    <span className="font-bold text-gray-500">Processo:</span>{" "}
                    <span className="ml-1">{selectedPaciente.processo}</span>
                  </div>
                )}
                {selectedPaciente.nAmostra && (
                  <div>
                    <span className="font-bold text-gray-500">Amostra:</span>{" "}
                    <span className="ml-1">{selectedPaciente.nAmostra}</span>
                  </div>
                )}
                {selectedPaciente.medico && (
                  <div>
                    <span className="font-bold text-gray-500">Médico:</span>{" "}
                    <span className="ml-1">{selectedPaciente.medico}</span>
                  </div>
                )}
                {selectedPaciente.bi && (
                  <div>
                    <span className="font-bold text-gray-500">BI:</span>{" "}
                    <span className="ml-1">{selectedPaciente.bi}</span>
                  </div>
                )}
                {selectedPaciente.telefone && (
                  <div>
                    <span className="font-bold text-gray-500">Tel:</span>{" "}
                    <span className="ml-1">{selectedPaciente.telefone}</span>
                  </div>
                )}
                {selectedPaciente.alergias && (
                  <div className="col-span-2 md:col-span-3 lg:col-span-4">
                    <span
                      className="font-bold"
                      style={{ color: CORES.vermelho }}
                    >
                      ⚠ Alergias:
                    </span>
                    <span
                      className="ml-1 font-bold"
                      style={{ color: CORES.vermelho }}
                    >
                      {selectedPaciente.alergias}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exames + Resultados */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="overflow-hidden rounded-sm border bg-white" style={BD}>
          <CardHeader
            num="2"
            title="Exames"
            right={
              selectedExames.size > 0 ? (
                <button
                  onClick={() => {
                    setSelectedExames(new Set());
                    setParams([]);
                  }}
                  className="text-xs font-bold hover:underline"
                  style={{ color: CORES.vermelho }}
                >
                  Limpar
                </button>
              ) : undefined
            }
          />
          <div className="border-b p-3" style={BD}>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <IconSearch />
              </div>
              <input
                value={exameSearch}
                onChange={(e) => setExameSearch(e.target.value)}
                className={`${inputCls} pl-9`}
                placeholder="Pesquisar..."
              />
            </div>
            {selectedExames.size > 0 && (
              <div className="mt-2 text-xs">
                <span className="font-bold" style={{ color: CORES.teal }}>
                  {selectedExames.size} seleccionado(s)
                </span>
              </div>
            )}
          </div>
          <div className="max-h-[450px] space-y-1 overflow-auto p-2">
            {Object.keys(filteredExames).length === 0 && (
              <div className="py-6 text-center text-xs text-gray-400">
                Nenhum exame.
              </div>
            )}
            {Object.entries(filteredExames).map(([cat, sub]) => {
              const examNames = Object.keys(sub);
              const allSel = examNames.every((n) => selectedExames.has(n));
              const someSel = examNames.some((n) => selectedExames.has(n));
              const expanded = isCatExpanded(cat);
              return (
                <div
                  key={cat}
                  className="overflow-hidden rounded-sm border"
                  style={BD}
                >
                  <button
                    type="button"
                    onClick={() => toggleCat(cat)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold transition-colors"
                    style={{
                      backgroundColor: someSel ? "#e6f4f6" : HEAD_BG,
                      color: someSel ? CORES.teal : "#374151",
                    }}
                  >
                    <span className="flex-1 truncate">{cat}</span>
                    {someSel && (
                      <span
                        className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: CORES.teal }}
                      >
                        {examNames.filter((n) => selectedExames.has(n)).length}
                      </span>
                    )}
                    <span
                      className="shrink-0 text-gray-400"
                      style={{
                        display: "inline-block",
                        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s",
                      }}
                    >
                      ▶
                    </span>
                  </button>
                  {expanded && (
                    <div className="bg-white">
                      <label
                        className="flex cursor-pointer items-center gap-2 border-b px-3 py-1.5 text-xs text-gray-500 transition hover:bg-[#fafbfc]"
                        style={{ borderColor: `${CORES.borda}66` }}
                      >
                        <input
                          type="checkbox"
                          checked={allSel}
                          ref={(el) => {
                            if (el) el.indeterminate = someSel && !allSel;
                          }}
                          onChange={() => toggleAllInCat(cat, examNames)}
                          className="accent-[#0d7a8a]"
                        />
                        <span className="italic">Seleccionar todos</span>
                      </label>
                      {examNames.map((nome) => {
                        const codigo = refByNome.get(nome.toLowerCase().trim());
                        return (
                          <label
                            key={nome}
                            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors ${selectedExames.has(nome) ? "font-semibold" : "text-gray-700 hover:bg-[#fafbfc]"}`}
                            style={{
                              backgroundColor: selectedExames.has(nome)
                                ? "#e6f4f6"
                                : "transparent",
                              color: selectedExames.has(nome)
                                ? CORES.teal
                                : undefined,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedExames.has(nome)}
                              onChange={() => toggleExame(nome)}
                              className="accent-[#0d7a8a]"
                            />
                            {codigo && (
                              <span
                                className="shrink-0 rounded-sm border px-1 py-0.5 font-mono text-[10px] leading-none"
                                style={{
                                  backgroundColor: `${CORES.teal}15`,
                                  color: CORES.teal,
                                  borderColor: `${CORES.teal}33`,
                                }}
                              >
                                {codigo}
                              </span>
                            )}
                            <span className="truncate">{nome}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border bg-white" style={BD}>
          <CardHeader
            num="3"
            title={`Parâmetros e Resultados (${params.length})`}
          />
          {params.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center border-t border-dashed py-16 text-center"
              style={BD}
            >
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-gray-300"
                style={{ backgroundColor: "#f3f4f6" }}
              >
                <IconFlask />
              </div>
              <p className="font-semibold text-gray-800">
                Nenhum exame seleccionado
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Seleccione exames à esquerda.
              </p>
            </div>
          ) : (
            <div className="max-h-[450px] overflow-auto">
              <table className="w-full text-sm">
                <thead
                  className="sticky top-0"
                  style={{ backgroundColor: HEAD_BG }}
                >
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Parâmetro
                    </th>
                    <th className="w-36 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Resultado
                    </th>
                    <th className="w-28 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Unidade
                    </th>
                    <th className="w-40 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Referência
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedParams).map(([exame, exameParams]) => {
                    const startIdx = params.findIndex((p) => p.exame === exame);
                    return (
                      <Fragment key={exame}>
                        <tr key={`h-${exame}`}>
                          <td
                            colSpan={4}
                            className="border-y px-4 py-2 text-xs font-bold"
                            style={{
                              backgroundColor: "#e6f4f6",
                              color: CORES.teal,
                              borderColor: `${CORES.teal}33`,
                            }}
                          >
                            <IconFlask /> {exame}
                          </td>
                        </tr>
                        {exameParams.map((p, localIdx) => {
                          const globalIdx = params.indexOf(p);
                          return (
                            <tr
                              key={`${exame}-${localIdx}`}
                              className="border-b transition hover:bg-[#fafbfc]"
                              style={{ borderColor: CORES.borda }}
                            >
                              <td className="px-4 py-1.5 text-xs text-gray-800">
                                {p.parametro}
                              </td>
                              <td className="px-2 py-1 text-center">
                                <input
                                  value={p.resultado}
                                  onChange={(e) =>
                                    updateResultado(globalIdx, e.target.value)
                                  }
                                  className="w-full rounded-sm border border-gray-300 px-2 py-1 text-center text-xs focus:border-[#0d7a8a] focus:outline-none focus:ring-1 focus:ring-[#0d7a8a]/40"
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-4 py-1.5 text-center text-xs text-gray-400">
                                {p.unidade}
                              </td>
                              <td className="px-4 py-1.5 text-center text-xs text-gray-400">
                                {p.referencia}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div
        className="mb-6 flex flex-col items-center justify-between gap-3 rounded-sm border bg-white px-5 py-3 sm:flex-row"
        style={BD}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs">
            {!selectedPacienteId && (
              <span
                className="flex items-center gap-1 font-bold"
                style={{ color: CORES.oliva }}
              >
                <IconAlert /> Seleccione um paciente
              </span>
            )}
            {selectedPacienteId && params.length === 0 && (
              <span
                className="flex items-center gap-1 font-bold"
                style={{ color: CORES.oliva }}
              >
                <IconAlert /> Seleccione exames
              </span>
            )}
            {selectedPacienteId &&
              params.length > 0 &&
              !params.some((p) => p.resultado.trim()) && (
                <span
                  className="flex items-center gap-1 font-bold"
                  style={{ color: CORES.oliva }}
                >
                  <IconAlert /> Preencha resultados
                </span>
              )}
            {selectedPacienteId && params.some((p) => p.resultado.trim()) && (
              <span
                className="flex items-center gap-1 font-bold"
                style={{ color: CORES.verdeEscuro }}
              >
                <IconCheck /> Pronto para guardar
              </span>
            )}
          </div>
          {params.length > 0 && (
            <button
              onClick={() =>
                setParams((ps) => ps.map((p) => ({ ...p, resultado: "" })))
              }
              className={`${btnOutline} flex items-center gap-1.5`}
              style={{ borderColor: "#d1d5db" }}
            >
              <IconTrash /> Limpar
            </button>
          )}
        </div>
        <button
          onClick={handleGuardar}
          disabled={
            guardando ||
            (!selectedPacienteId && !initialReport) ||
            !params.some((p) => p.resultado.trim())
          }
          className={`${btnTeal} flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
          style={{ backgroundColor: CORES.verdeEscuro }}
        >
          {guardando ? (
            "A guardar..."
          ) : (
            <>
              <IconSave /> Guardar para validação
            </>
          )}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Session } from "../../store/auth";
import { api } from "../../store/api";
import { EXAMES_BUILTIN } from "../../data/exames";
import { generatePDFHTML, downloadPDF } from "../../utils/pdfGenerator";

interface Props {
  session: Session;
  onLogout: () => void;
}

type Tab =
  | "dashboard"
  | "externo"
  | "interno"
  | "resultados"
  | "pacientes"
  | "processamento"
  | "faturacao"
  | "produtos";

type ParceiroPaciente = {
  id: string;
  codigo: string;
  nome: string;
  nascimento: string;
  sexo: string;
  telefone: string;
  bi: string;
};

type Solicitacao = {
  id: string;
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
  resultadoId?: string;
  medicoSolicitante?: string;
  tipoPedido?: string;
};

type ExameItem = { codigo: string; designacao: string };

type Produto = {
  id: string;
  codigo: string;
  designacao: string;
  categoria: string;
  unidade: string;
  preco: number;
  custo: number;
  stock: number;
  stockMinimo: number;
  fornecedor?: string;
  validade?: string;
  ativo: boolean;
};

type Fatura = {
  id: string;
  numero: string;
  serie: string;
  data: string;
  dataVencimento?: string;
  pacienteId?: string;
  pacienteNome: string;
  solicitacaoId?: string;
  itens: {
    designacao: string;
    quantidade: number;
    precoUnit: number;
    iva: number;
  }[];
  subtotal: number;
  ivaTotal: number;
  total: number;
  estado: "emitida" | "paga" | "anulada" | "vencida";
  observacoes?: string;
};

const ESTADOS: Record<string, { label: string; cls: string; dot: string }> = {
  pendente: {
    label: "Pendente",
    cls: "bg-amber-50 text-amber-700 border border-amber-200/60",
    dot: "bg-amber-500",
  },
  em_processo: {
    label: "Em Processo",
    cls: "bg-blue-50 text-blue-700 border border-blue-200/60",
    dot: "bg-blue-500",
  },
  concluido: {
    label: "Concluído",
    cls: "bg-green-50 text-green-700 border border-green-200/60",
    dot: "bg-green-500",
  },
  cancelado: {
    label: "Cancelado",
    cls: "bg-rose-50 text-rose-700 border border-rose-200/60",
    dot: "bg-rose-500",
  },
};

const ESTADOS_FATURA: Record<string, { label: string; cls: string }> = {
  emitida: {
    label: "Emitida",
    cls: "bg-blue-50 text-blue-700 border border-blue-200/60",
  },
  paga: {
    label: "Paga",
    cls: "bg-green-50 text-green-700 border border-green-200/60",
  },
  anulada: {
    label: "Anulada",
    cls: "bg-slate-50 text-slate-500 border border-slate-200/60",
  },
  vencida: {
    label: "Vencida",
    cls: "bg-rose-50 text-rose-700 border border-rose-200/60",
  },
};

const PURPLE = "#6941c6";
const PURPLE_LIGHT = "#f4f0ff";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function nowTime() {
  return new Date().toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatMoeda(v: number, moeda = "AOA") {
  return `${Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moeda}`;
}

const EXAMES_FLAT: ExameItem[] = [];
let _code = 1;
for (const [, subs] of Object.entries(EXAMES_BUILTIN)) {
  for (const nome of Object.keys(subs)) {
    EXAMES_FLAT.push({
      codigo: String(_code).padStart(4, "0"),
      designacao: nome,
    });
    _code++;
  }
}

// ── Gráficos SVG ─────────────────────────────────────────────────────────────
function BarChart({
  data,
  height = 140,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ height }}>
      <svg
        viewBox={`0 0 ${data.length * 40} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 25);
          return (
            <g key={i}>
              <rect
                x={i * 40 + 8}
                y={height - h - 18}
                width={24}
                height={h}
                rx={4}
                fill={d.color || PURPLE}
                opacity={0.9}
              />
              <text
                x={i * 40 + 20}
                y={height - 4}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
                fontWeight="500"
              >
                {d.label}
              </text>
              {d.value > 0 && (
                <text
                  x={i * 40 + 20}
                  y={height - h - 22}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#1e293b"
                  fontWeight="600"
                >
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LineChart({
  data,
  color = PURPLE,
  height = 120,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length === 0)
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-slate-400 text-xs font-medium"
      >
        Sem dados suficientes
      </div>
    );
  const max = Math.max(...data, 1);
  const w = 300,
    h = height;
  const step = w / Math.max(data.length - 1, 1);
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * (h - 24) - 12}`)
    .join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <div style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#lineGrad)" />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((v, i) => (
          <circle
            key={i}
            cx={i * step}
            cy={h - (v / max) * (h - 24) - 12}
            r="3.5"
            fill="white"
            stroke={color}
            strokeWidth="2.5"
          />
        ))}
      </svg>
    </div>
  );
}

function DonutChart({
  data,
  size = 120,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0)
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center text-slate-300 text-xs"
      >
        Sem dados
      </div>
    );
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth="12"
      />
      {data.map((d, i) => {
        const len = (d.value / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth="12"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="round"
          />
        );
        offset += len;
        return el;
      })}
      <text
        x={size / 2}
        y={size / 2 - 2}
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill="#1e293b"
      >
        {total}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        fontSize="9"
        fill="#94a3b8"
        fontWeight="600"
        letterSpacing="0.5px"
        className="uppercase"
      >
        Total
      </text>
    </svg>
  );
}

// ── Resultado Modal ──────────────────────────────────────────────────────────
function ResultadoModal({
  solId,
  onClose,
}: {
  solId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ resultado: any; paciente: any } | null>(
    null,
  );
  const [labConfig, setLabConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api.solicitacoes.getResultado(solId), api.config.get()])
      .then(([result, cfg]) => {
        setData(result);
        setLabConfig(cfg);
      })
      .catch((e) => setErr(e.message || "Erro ao carregar resultado"))
      .finally(() => setLoading(false));
  }, [solId]);

  const byExame = useMemo(() => {
    if (!data?.resultado?.parametros) return {};
    const r: Record<string, any[]> = {};
    for (const p of data.resultado.parametros) {
      if (!p.resultado?.trim()) continue;
      if (!r[p.exame]) r[p.exame] = [];
      r[p.exame].push(p);
    }
    return r;
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="font-bold text-slate-800 text-base">
              Resultado do Exame
            </div>
            {data?.resultado && (
              <div className="text-xs text-slate-400 mt-0.5">
                Emitido em {data.resultado.dataEmissao || data.resultado.data}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading && (
            <div className="py-12 text-center text-slate-400 text-sm">
              A carregar informações...
            </div>
          )}
          {err && (
            <div className="py-12 text-center text-rose-500 text-sm font-medium">
              {err}
            </div>
          )}
          {data && !loading && (
            <>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Paciente
                </div>
                <div className="font-bold text-slate-800 text-sm">
                  {data.resultado.pacienteNome}
                </div>
                {data.paciente && (
                  <div className="text-xs text-slate-500 mt-1 flex gap-2 divide-x divide-slate-200">
                    {data.paciente.nasc && (
                      <span className="pr-2">{data.paciente.nasc}</span>
                    )}
                    {data.paciente.sexo && (
                      <span className="px-2">
                        {data.paciente.sexo === "M" ? "Masculino" : "Feminino"}
                      </span>
                    )}
                    {data.paciente.bi && (
                      <span className="pl-2">BI: {data.paciente.bi}</span>
                    )}
                  </div>
                )}
              </div>
              {Object.keys(byExame).length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  Os resultados detalhados ainda não foram preenchidos
                </div>
              ) : (
                Object.entries(byExame).map(([exame, params]) => (
                  <div
                    key={exame}
                    className="rounded-lg overflow-hidden border border-slate-200"
                  >
                    <div className="px-4 py-2 bg-violet-50 text-violet-700 text-xs font-bold uppercase tracking-wider">
                      {exame}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-slate-400 border-b border-slate-100 uppercase tracking-wider bg-slate-50/50">
                          <th className="text-left px-4 py-2 font-bold">
                            Parâmetro
                          </th>
                          <th className="text-center px-2 py-2 font-bold w-24">
                            Resultado
                          </th>
                          <th className="text-center px-2 py-2 font-bold w-20">
                            Unidade
                          </th>
                          <th className="text-center px-2 py-2 font-bold w-32">
                            Referência
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {params.map((p, i) => (
                          <tr
                            key={i}
                            className="border-t border-slate-100 hover:bg-slate-50/40"
                          >
                            <td className="px-4 py-2.5 text-slate-700 font-medium">
                              {p.parametro}
                            </td>
                            <td className="px-2 py-2.5 text-center font-bold text-slate-900">
                              {p.resultado}
                            </td>
                            <td className="px-2 py-2.5 text-center text-slate-400 text-xs font-mono">
                              {p.unidade || "—"}
                            </td>
                            <td className="px-2 py-2.5 text-center text-slate-400 text-xs font-mono">
                              {p.referencia || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
              {data.resultado.tecnicoNome && (
                <div className="text-xs text-center text-slate-400 pt-2 border-t border-slate-100">
                  Técnico Responsável:{" "}
                  <span className="font-semibold text-slate-600">
                    {data.resultado.tecnicoNome}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50 rounded-b-xl">
          {data && !loading && Object.keys(byExame).length > 0 && (
            <button
              onClick={() => {
                const config = labConfig ?? {
                  nomeClinica: "Laboratório",
                  nif: "",
                  endereco: "",
                  telefone: "",
                  email: "",
                  directorTecnico: "",
                  logoData: "",
                  assinaturaData: "",
                  serie: "A",
                  proximoNumeroFatura: 1,
                  ivaTaxa: 14,
                  moeda: "AOA",
                  website: "",
                };
                const resultado = data.resultado;
                const paciente = data.paciente ?? undefined;
                downloadPDF(
                  generatePDFHTML(resultado, paciente, config),
                  `Resultado_${resultado.pacienteNome}`,
                );
              }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90 shadow-sm"
              style={{ background: "#6941c6" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="6 9 12 15 18 9" />
                <line x1="12" y1="15" x2="12" y2="3" />
                <rect x="3" y="17" width="18" height="4" rx="1" />
              </svg>
              Imprimir PDF
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Novo Paciente Modal ──────────────────────────────────────────────────────
function NovoPacienteModal({
  onSave,
  onClose,
  initial,
}: {
  onSave: (p: Omit<ParceiroPaciente, "id">) => Promise<void>;
  onClose: () => void;
  initial?: ParceiroPaciente;
}) {
  const [form, setForm] = useState({
    codigo: initial?.codigo || "",
    nome: initial?.nome || "",
    nascimento: initial?.nascimento || "",
    sexo: initial?.sexo || "",
    telefone: initial?.telefone || "",
    bi: initial?.bi || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErr("Nome é obrigatório");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onSave(form);
      onClose();
    } catch (ex: any) {
      setErr(ex.message || "Erro de validação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="font-bold text-slate-800 text-base">
            {initial ? "Editar Ficha de Paciente" : "Registar Novo Paciente"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 transition"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handle} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Código
              </label>
              <input
                value={form.codigo}
                onChange={(e) => set("codigo", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Nome Completo *
              </label>
              <input
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Nascimento
              </label>
              <input
                value={form.nascimento}
                onChange={(e) => set("nascimento", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Sexo
              </label>
              <select
                value={form.sexo}
                onChange={(e) => set("sexo", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all bg-white"
              >
                <option value="">— Selecionar —</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Telefone
              </label>
              <input
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                BI / Passaporte
              </label>
              <input
                value={form.bi}
                onChange={(e) => set("bi", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
          </div>
          {err && (
            <div className="text-xs text-rose-500 font-medium bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
              {err}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition hover:opacity-95 disabled:opacity-60"
              style={{ background: PURPLE }}
            >
              {saving ? "A guardar..." : "Salvar Ficha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Produto Modal ────────────────────────────────────────────────────────────
function ProdutoModal({
  onSave,
  onClose,
  initial,
}: {
  onSave: (p: Omit<Produto, "id">) => Promise<void>;
  onClose: () => void;
  initial?: Produto;
}) {
  const [form, setForm] = useState<Omit<Produto, "id">>({
    codigo: initial?.codigo || "",
    designacao: initial?.designacao || "",
    categoria: initial?.categoria || "Geral",
    unidade: initial?.unidade || "un",
    preco: initial?.preco || 0,
    custo: initial?.custo || 0,
    stock: initial?.stock || 0,
    stockMinimo: initial?.stockMinimo || 0,
    fornecedor: initial?.fornecedor || "",
    validade: initial?.validade || "",
    ativo: initial?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!form.designacao.trim()) {
      setErr("Designação é obrigatória");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onSave(form);
      onClose();
    } catch (ex: any) {
      setErr(ex.message || "Erro ao guardar produto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="font-bold text-slate-800 text-base">
            {initial ? "Editar Artigo/Produto" : "Novo Artigo de Stock"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 transition"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handle}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Ref. Código
              </label>
              <input
                value={form.codigo}
                onChange={(e) => set("codigo", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Designação do Produto *
              </label>
              <input
                value={form.designacao}
                onChange={(e) => set("designacao", e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Categoria
              </label>
              <input
                value={form.categoria}
                onChange={(e) => set("categoria", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Unidade de Medida
              </label>
              <input
                value={form.unidade}
                onChange={(e) => set("unidade", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                placeholder="Ex: un, cx, ml, flasco"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Preço de Venda (AOA)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.preco}
                onChange={(e) => set("preco", parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Custo Unitário (AOA)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.custo}
                onChange={(e) => set("custo", parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Stock Atual
              </label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => set("stock", parseInt(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Alerta Limite Mínimo
              </label>
              <input
                type="number"
                value={form.stockMinimo}
                onChange={(e) =>
                  set("stockMinimo", parseInt(e.target.value) || 0)
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Fornecedor Principal
              </label>
              <input
                value={form.fornecedor}
                onChange={(e) => set("fornecedor", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Data de Validade
              </label>
              <input
                value={form.validade}
                onChange={(e) => set("validade", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                placeholder="dd/mm/aaaa"
              />
            </div>
          </div>
          <div className="pt-1">
            <label className="inline-flex items-center gap-2.5 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => set("ativo", e.target.checked)}
                className="w-4.5 h-4.5 rounded accent-purple-600 transition-colors"
              />
              <span className="font-semibold text-slate-700">
                Artigo Ativo para Inventário
              </span>
            </label>
          </div>
          {err && (
            <div className="text-xs text-rose-500 font-medium bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
              {err}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition hover:opacity-95 disabled:opacity-60"
              style={{ background: PURPLE }}
            >
              {saving ? "A guardar..." : "Salvar Produto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Stock Mov Modal ──────────────────────────────────────────────────────────
function StockMovModal({
  produto,
  onConfirm,
  onClose,
}: {
  produto: Produto;
  onConfirm: (
    tipo: "entrada" | "saida",
    qtd: number,
    motivo: string,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [qtd, setQtd] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handle() {
    if (qtd <= 0) {
      setErr("Quantidade inválida");
      return;
    }
    if (tipo === "saida" && qtd > produto.stock) {
      setErr("Stock insuficiente em armazém");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onConfirm(tipo, qtd, motivo);
      onClose();
    } catch (ex: any) {
      setErr(ex.message || "Erro no registo de stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="font-bold text-slate-800 text-base">
              Movimento de Stock
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {produto.designacao} · Stock Atual: {produto.stock}{" "}
              {produto.unidade}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 transition"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipo("entrada")}
              className={`py-2.5 rounded-lg border-2 text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                tipo === "entrada"
                  ? "border-green-500 bg-green-50/50 text-green-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span>↓</span> Entrada
            </button>
            <button
              type="button"
              onClick={() => setTipo("saida")}
              className={`py-2.5 rounded-lg border-2 text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                tipo === "saida"
                  ? "border-rose-500 bg-rose-50/50 text-rose-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span>↑</span> Saída
            </button>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
              Quantidade de Artigos
            </label>
            <input
              type="number"
              min={1}
              value={qtd}
              onChange={(e) => setQtd(parseInt(e.target.value) || 0)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
              Motivo / Notas da Operação
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none"
              placeholder="Ex: Reforço de inventário, rutura de lote, consumo interno, etc..."
            />
          </div>
          {err && (
            <div className="text-xs text-rose-500 font-medium bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
              {err}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handle}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition hover:opacity-95 disabled:opacity-60"
              style={{ background: PURPLE }}
            >
              {saving ? "A processar..." : "Gravar Lançamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fatura Modal ─────────────────────────────────────────────────────────────
function FaturaModal({
  pacientes,
  solicitacoes,
  onSaved,
  onClose,
  initial,
}: {
  pacientes: ParceiroPaciente[];
  solicitacoes: Solicitacao[];
  onSaved: () => void;
  onClose: () => void;
  initial?: Fatura;
}) {
  const [pacienteId, setPacienteId] = useState(initial?.pacienteId || "");
  const [solId, setSolId] = useState(initial?.solicitacaoId || "");
  const [dataVenc, setDataVenc] = useState(initial?.dataVencimento || "");
  const [itens, setItens] = useState(
    initial?.itens || [
      { designacao: "", quantidade: 1, precoUnit: 0, iva: 14 },
    ],
  );
  const [observacoes, setObservacoes] = useState(initial?.observacoes || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const paciente = pacientes.find((p) => p.id === pacienteId);
  const sol = solicitacoes.find((s) => s.id === solId);

  function carregarDaSolicitacao() {
    if (!sol) return;
    const novosItens = (sol.examesSolicitados || []).map((e) => ({
      designacao: e,
      quantidade: 1,
      precoUnit: 0,
      iva: 14,
    }));
    setItens(
      novosItens.length
        ? novosItens
        : [{ designacao: "", quantidade: 1, precoUnit: 0, iva: 14 }],
    );
    if (sol.pacienteNome && pacienteId === "") {
      const match = pacientes.find((p) => p.nome === sol.pacienteNome);
      if (match) setPacienteId(match.id);
    }
  }

  function atualizarItem(i: number, k: keyof (typeof itens)[0], v: any) {
    setItens((arr) =>
      arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)),
    );
  }
  function adicionarItem() {
    setItens((arr) => [
      ...arr,
      { designacao: "", quantidade: 1, precoUnit: 0, iva: 14 },
    ]);
  }
  function removerItem(i: number) {
    setItens((arr) => arr.filter((_, idx) => idx !== i));
  }

  const subtotal = itens.reduce(
    (s, it) => s + (Number(it.quantidade) || 0) * (Number(it.precoUnit) || 0),
    0,
  );
  const ivaTotal = itens.reduce(
    (s, it) =>
      s +
      (Number(it.quantidade) || 0) *
        (Number(it.precoUnit) || 0) *
        ((Number(it.iva) || 0) / 100),
    0,
  );
  const total = subtotal + ivaTotal;

  async function handle() {
    if (!pacienteId) {
      setErr("Seleccione um paciente");
      return;
    }
    if (itens.length === 0 || itens.some((it) => !it.designacao.trim())) {
      setErr("Preencha a designação de todos os itens");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (initial) {
        await (api as any).faturas.update(initial.id, {
          pacienteId,
          pacienteNome: paciente?.nome || "",
          solicitacaoId: solId || undefined,
          dataVencimento: dataVenc,
          itens,
          subtotal,
          ivaTotal,
          total,
          observacoes,
        });
      } else {
        await (api as any).faturas.create({
          pacienteId,
          pacienteNome: paciente?.nome || "",
          solicitacaoId: solId || undefined,
          data: todayStr(),
          dataVencimento: dataVenc,
          itens,
          subtotal,
          ivaTotal,
          total,
          observacoes,
        });
      }
      onSaved();
      onClose();
    } catch (ex: any) {
      setErr(ex.message || "Erro de faturação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="font-bold text-slate-800 text-base">
            {initial ? `Fatura nº ${initial.numero}` : "Emitir Nova Fatura"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 transition"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Paciente destinatário *
              </label>
              <select
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              >
                <option value="">— Seleccionar —</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                    {p.codigo ? ` (${p.codigo})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                Data de Vencimento
              </label>
              <input
                value={dataVenc}
                onChange={(e) => setDataVenc(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                placeholder="dd/mm/aaaa"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Especificação de Serviços
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={carregarDaSolicitacao}
                  disabled={!solId}
                  className="text-xs font-bold px-2.5 py-1.5 rounded border border-purple-200 text-purple-600 bg-white hover:bg-purple-50 transition disabled:opacity-40"
                >
                  Importar Exames
                </button>
                <button
                  type="button"
                  onClick={adicionarItem}
                  className="text-xs font-bold px-3 py-1.5 rounded text-white transition hover:opacity-95"
                  style={{ background: PURPLE }}
                >
                  + Linha de Serviço
                </button>
              </div>
            </div>
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <select
                value={solId}
                onChange={(e) => setSolId(e.target.value)}
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-200/20 focus:border-purple-300"
              >
                <option value="">
                  — Associar a uma requisição em aberto (opcional) —
                </option>
                {solicitacoes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.data} · {s.pacienteNome} ·{" "}
                    {(s.examesSolicitados || []).length} exame(s)
                  </option>
                ))}
              </select>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  <th className="text-left px-3 py-2">
                    Descrição dos Exames / Serviços
                  </th>
                  <th className="text-center px-2 py-2 w-16">Qtd</th>
                  <th className="text-right px-2 py-2 w-28">
                    Preço Unit. (AOA)
                  </th>
                  <th className="text-center px-2 py-2 w-16">IVA %</th>
                  <th className="text-right px-2 py-2 w-28">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-8 text-slate-400 text-xs font-medium"
                    >
                      Nenhum serviço adicionado.
                    </td>
                  </tr>
                ) : (
                  itens.map((it, i) => {
                    const linhaTotal =
                      (Number(it.quantidade) || 0) *
                      (Number(it.precoUnit) || 0);
                    return (
                      <tr
                        key={i}
                        className="border-t border-slate-100 hover:bg-slate-50/20"
                      >
                        <td className="px-2 py-2">
                          <input
                            value={it.designacao}
                            onChange={(e) =>
                              atualizarItem(i, "designacao", e.target.value)
                            }
                            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200/20 focus:border-purple-300"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            min={1}
                            value={it.quantidade}
                            onChange={(e) =>
                              atualizarItem(
                                i,
                                "quantidade",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full border border-slate-200 rounded py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-200/20 focus:border-purple-300"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={it.precoUnit}
                            onChange={(e) =>
                              atualizarItem(
                                i,
                                "precoUnit",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-200/20 focus:border-purple-300"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={it.iva}
                            onChange={(e) =>
                              atualizarItem(
                                i,
                                "iva",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full border border-slate-200 rounded py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-200/20 focus:border-purple-300"
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-semibold text-slate-700 text-xs">
                          {linhaTotal.toLocaleString("pt-PT", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removerItem(i)}
                            className="text-slate-300 hover:text-rose-500 transition-colors text-xs"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-72 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Subtotal</span>
                <span>
                  {subtotal.toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  AOA
                </span>
              </div>
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Imposto (IVA)</span>
                <span>
                  {ivaTotal.toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  AOA
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
                <span>Total a Pagar</span>
                <span>
                  {total.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}{" "}
                  AOA
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
              Observações internas / Termos de Pagamento
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none"
            />
          </div>
          {err && (
            <div className="text-xs text-rose-500 font-medium bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
              {err}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-2 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-300 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handle}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition hover:opacity-95 disabled:opacity-60"
            style={{ background: PURPLE }}
          >
            {saving ? "A guardar..." : "Emitir Fatura"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Processamento Modal ──────────────────────────────────────────────────────
function ProcessamentoModal({
  sol,
  onSaved,
  onClose,
}: {
  sol: Solicitacao;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [parametros, setParametros] = useState<
    Record<string, { resultado: string; observacao: string }[]>
  >({});
  const [tecnicoNome, setTecnicoNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const init: Record<string, { resultado: string; observacao: string }[]> =
      {};
    (sol.examesSolicitados || []).forEach((ex) => {
      if (!init[ex]) init[ex] = [{ resultado: "", observacao: "" }];
    });
    setParametros(init);
  }, [sol.id]);

  function addParam(exame: string) {
    setParametros((p) => ({
      ...p,
      [exame]: [...(p[exame] || []), { resultado: "", observacao: "" }],
    }));
  }
  function setParam(
    exame: string,
    i: number,
    k: "resultado" | "observacao",
    v: string,
  ) {
    setParametros((p) => ({
      ...p,
      [exame]: (p[exame] || []).map((it, idx) =>
        idx === i ? { ...it, [k]: v } : it,
      ),
    }));
  }
  function removeParam(exame: string, i: number) {
    setParametros((p) => ({
      ...p,
      [exame]: (p[exame] || []).filter((_, idx) => idx !== i),
    }));
  }

  async function handleSalvar(rascunho: boolean) {
    setSaving(true);
    setErr("");
    try {
      const paramsFlat: any[] = [];
      Object.entries(parametros).forEach(([exame, lista]) => {
        lista.forEach((p) => {
          if (p.resultado.trim() || !rascunho) {
            paramsFlat.push({
              exame,
              parametro: "Resultado",
              resultado: p.resultado,
              observacao: p.observacao,
              unidade: "",
              referencia: "",
            });
          }
        });
      });
      await (api as any).solicitacoes.registrarResultado(sol.id, {
        parametros: paramsFlat,
        tecnicoNome,
        rascunho,
      });
      onSaved();
      onClose();
    } catch (ex: any) {
      setErr(ex.message || "Erro de validação de resultados");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl max-h-[92vh] flex flex-col border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="font-bold text-slate-800 text-base">
              Digitação de Resultados
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Paciente: {sol.pacienteNome} · {sol.data} {sol.hora}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="bg-violet-50/50 border border-violet-100 rounded-lg p-3 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">
              Requisição Aberta
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(sol.examesSolicitados || []).map((e, i) => (
                <span
                  key={i}
                  className="text-xs bg-white border border-violet-200/80 text-violet-700 px-3 py-1 rounded-full font-medium"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
              Técnico Analista Responsável
            </label>
            <input
              value={tecnicoNome}
              onChange={(e) => setTecnicoNome(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              placeholder="Digite o nome completo do analista"
            />
          </div>

          {Object.keys(parametros).map((exame) => (
            <div
              key={exame}
              className="border border-slate-200 rounded-lg overflow-hidden bg-white"
            >
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {exame}
                </span>
                <button
                  type="button"
                  onClick={() => addParam(exame)}
                  className="text-xs font-bold px-2.5 py-1 rounded text-white transition hover:opacity-95"
                  style={{ background: PURPLE }}
                >
                  + Adicionar Campo
                </button>
              </div>
              <div className="p-3 space-y-2 bg-slate-50/20">
                {(parametros[exame] || []).map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={p.resultado}
                      onChange={(e) =>
                        setParam(exame, i, "resultado", e.target.value)
                      }
                      placeholder="Resultado (Ex: Positivo, 120 mg/dl, etc)"
                      className="col-span-5 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                    <input
                      value={p.observacao}
                      onChange={(e) =>
                        setParam(exame, i, "observacao", e.target.value)
                      }
                      placeholder="Notas de referência adicionais"
                      className="col-span-6 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => removeParam(exame, i)}
                      className="col-span-1 text-slate-300 hover:text-rose-500 transition-colors text-center font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {(parametros[exame] || []).length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-3">
                    Nenhum parâmetro de análise registado. Adicione no botão
                    acima.
                  </div>
                )}
              </div>
            </div>
          ))}

          {err && (
            <div className="text-xs text-rose-500 font-medium bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
              {err}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-2 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-300 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSalvar(true)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
          >
            {saving ? "..." : "Guardar Rascunho"}
          </button>
          <button
            type="button"
            onClick={() => handleSalvar(false)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition hover:opacity-95 disabled:opacity-60 animate-none"
            style={{ background: PURPLE }}
          >
            {saving ? "A processar..." : "Publicar Resultados"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Requisição PDF HTML generator ────────────────────────────────────────────
function generateRequisicaoPDFHTML(sol: Solicitacao, session: Session): string {
  function esc(v: unknown): string {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  const medicoNome = esc(sol.medicoSolicitante || session.parceiroNome || "");
  const instituicao = session.parceiroInstituicao
    ? `<div style="color:#555;font-size:11px;">${esc(session.parceiroInstituicao)}</div>`
    : "";
  const urgente = sol.urgente
    ? `<div style="background:#fee2e2;color:#b91c1c;padding:5px 10px;border-radius:4px;margin-bottom:10px;font-size:11px;font-weight:bold;">⚠ PEDIDO URGENTE</div>`
    : "";
  const pacienteSexo =
    sol.pacienteSexo === "M"
      ? "Masculino"
      : sol.pacienteSexo === "F"
        ? "Feminino"
        : esc(sol.pacienteSexo || "");
  const pacienteCells = [
    `<tr><td style="color:#555;padding:3px 0;">Nome:</td><td style="padding:3px 8px;font-weight:bold;">${esc(sol.pacienteNome)}</td><td></td><td></td></tr>`,
    sol.pacienteNascimento
      ? `<tr><td style="color:#555;padding:3px 0;">Nascimento:</td><td style="padding:3px 8px;">${esc(sol.pacienteNascimento)}</td><td style="color:#555;padding:3px 0;">Sexo:</td><td style="padding:3px 8px;">${pacienteSexo}</td></tr>`
      : "",
    sol.pacienteTelefone
      ? `<tr><td style="color:#555;padding:3px 0;">Telefone:</td><td style="padding:3px 8px;">${esc(sol.pacienteTelefone)}</td><td style="color:#555;padding:3px 0;">${sol.pacienteBi ? "BI:" : ""}</td><td style="padding:3px 8px;">${esc(sol.pacienteBi || "")}</td></tr>`
      : sol.pacienteBi
        ? `<tr><td style="color:#555;padding:3px 0;">BI:</td><td colspan="3" style="padding:3px 8px;">${esc(sol.pacienteBi)}</td></tr>`
        : "",
  ].join("");
  const examenRows = (sol.examesSolicitados || [])
    .map((e, i) => {
      const found = EXAMES_FLAT.find((x) => x.designacao === e);
      return `<tr style="border-bottom:1px solid #f5f5f5;">
      <td style="padding:5px 8px;color:#555;width:100px;">${esc(found?.codigo || String(i + 1).padStart(4, "0"))}</td>
      <td style="padding:5px 8px;">${esc(e)}</td>
    </tr>`;
    })
    .join("");
  const observacoesBlock = sol.observacoes
    ? `<div style="border:1px solid #ddd;border-radius:6px;padding:14px;margin-bottom:16px;">
        <div style="font-size:10px;color:#888;font-weight:bold;margin-bottom:6px;text-transform:uppercase;">Observações</div>
        <p style="margin:0;font-size:11px;">${esc(sol.observacoes)}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Requisição — ${esc(sol.pacienteNome)}</title>
  <style>
    @page { size: A4; margin: 1.5cm 1.8cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: white; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div style="width:100%;max-width:700px;margin:0 auto;">
  <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:14px;margin-bottom:16px;">
    <h2 style="margin:0;font-size:17px;letter-spacing:1px;text-transform:uppercase;">Requisição de Exames Laboratoriais</h2>
    <p style="margin:5px 0 2px;color:#555;font-size:12px;">${esc(session.empresaNome || "")}</p>
    <p style="margin:0;font-size:10px;color:#888;">${sol.tipoPedido === "interno" ? "PEDIDO INTERNO (MÉDICO)" : "PEDIDO EXTERNO"}</p>
  </div>
  <table style="width:100%;margin-bottom:18px;">
    <tr>
      <td style="vertical-align:top;">
        <div style="font-size:10px;color:#888;margin-bottom:3px;text-transform:uppercase;">Médico / Parceiro Solicitante</div>
        <div style="font-weight:bold;font-size:12px;">${medicoNome}</div>
        ${instituicao}
      </td>
      <td style="text-align:right;vertical-align:top;">
        <div style="font-size:10px;color:#888;margin-bottom:3px;text-transform:uppercase;">Data e Hora</div>
        <div style="font-weight:bold;">${esc(sol.data)}</div>
        <div style="color:#555;">${esc(sol.hora)}</div>
      </td>
    </tr>
  </table>
  <div style="border:1px solid #ddd;border-radius:6px;padding:14px;margin-bottom:16px;">
    <div style="font-size:10px;color:#888;font-weight:bold;margin-bottom:10px;text-transform:uppercase;">Dados do Paciente</div>
    <table style="width:100%;font-size:11px;">${pacienteCells}</table>
  </div>
  <div style="border:1px solid #ddd;border-radius:6px;padding:14px;margin-bottom:16px;">
    <div style="font-size:10px;color:#888;font-weight:bold;margin-bottom:10px;text-transform:uppercase;">Exames Solicitados</div>
    ${urgente}
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="border-bottom:1px solid #ddd;">
          <th style="text-align:left;padding:4px 8px;color:#888;font-weight:600;">Código</th>
          <th style="text-align:left;padding:4px 8px;color:#888;font-weight:600;">Designação</th>
        </tr>
      </thead>
      <tbody>${examenRows}</tbody>
    </table>
  </div>
  ${observacoesBlock}
  <div style="display:flex;justify-content:space-between;margin-top:50px;padding-top:16px;border-top:1px solid #ddd;">
    <div style="text-align:center;min-width:220px;">
      <div style="border-top:1px solid #333;padding-top:5px;">
        <div style="font-size:11px;color:#555;">Assinatura do Médico / Parceiro</div>
        <div style="font-size:11px;font-weight:bold;margin-top:2px;">${medicoNome}</div>
      </div>
    </div>
    <div style="text-align:center;min-width:220px;">
      <div style="border-top:1px solid #333;padding-top:5px;">
        <div style="font-size:11px;color:#555;">Carimbo do Laboratório</div>
      </div>
    </div>
  </div>
  <p style="text-align:center;font-size:9px;color:#aaa;margin-top:30px;">
    Ref: ${esc(sol.id)} · ${esc(session.empresaNome || "")} · ${new Date().toLocaleString("pt-PT")}
  </p>
</div>
</body>
</html>`;
}

// ── Requisição Form ──────────────────────────────────────────────────────────
function RequisicaoForm({
  tipoPedido,
  pacientes,
  session,
  onSaved,
}: {
  tipoPedido: "externo" | "interno";
  pacientes: ParceiroPaciente[];
  session: Session;
  onSaved: () => void;
}) {
  const [selectedPacienteId, setSelectedPacienteId] = useState("");
  const [medicoSolicitante, setMedicoSolicitante] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [exameTable, setExameTable] = useState<ExameItem[]>([]);
  const [selectedExameNome, setSelectedExameNome] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");

  const selectedPaciente = pacientes.find((p) => p.id === selectedPacienteId);

  const examesFiltered = useMemo(() => {
    if (!search) return EXAMES_FLAT;
    return EXAMES_FLAT.filter(
      (e) =>
        e.designacao.toLowerCase().includes(search.toLowerCase()) ||
        e.codigo.includes(search),
    );
  }, [search]);

  function adicionarExame() {
    if (!selectedExameNome) return;
    const found = EXAMES_FLAT.find((e) => e.designacao === selectedExameNome);
    if (!found) return;
    if (exameTable.some((e) => e.designacao === found.designacao)) return;
    setExameTable((t) => [...t, found]);
    setSelectedExameNome("");
    setSearch("");
  }

  function removerSelecionados() {
    if (selectedRows.size === 0) {
      setExameTable([]);
    } else {
      setExameTable((t) => t.filter((_, i) => !selectedRows.has(i)));
      setSelectedRows(new Set());
    }
  }

  function toggleRow(i: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function handleSalvar() {
    if (!selectedPacienteId) {
      setMsg({ text: "Seleccione um paciente.", ok: false });
      return;
    }
    if (exameTable.length === 0) {
      setMsg({ text: "Adicione pelo menos um exame.", ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const pac = pacientes.find((p) => p.id === selectedPacienteId)!;
      await api.solicitacoes.create({
        pacienteNome: pac.nome,
        pacienteNascimento: pac.nascimento,
        pacienteSexo: pac.sexo,
        pacienteTelefone: pac.telefone,
        pacienteBi: pac.bi,
        examesSolicitados: exameTable.map((e) => e.designacao),
        observacoes,
        urgente,
        medicoSolicitante,
        tipoPedido,
        data: todayStr(),
        hora: nowTime(),
      });
      setMsg({ text: "✓ Requisição enviada com sucesso!", ok: true });
      setSelectedPacienteId("");
      setExameTable([]);
      setSelectedRows(new Set());
      setMedicoSolicitante("");
      setObservacoes("");
      setUrgente(false);
      onSaved();
    } catch (ex: any) {
      setMsg({ text: ex.message || "Erro ao enviar requisição.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              {tipoPedido === "interno"
                ? "Nova Requisição de Exame Interno"
                : "Nova Requisição de Exame Externo"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Introduza os dados clínicos e associe os exames correspondentes
            </p>
          </div>
          {urgente && (
            <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
              Prioritário / Urgente
            </span>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Seção Paciente */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Seleção do Paciente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div className="md:col-span-1">
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">
                  Pesquisar Paciente *
                </label>
                <select
                  value={selectedPacienteId}
                  onChange={(e) => setSelectedPacienteId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                >
                  <option value="">— Encontrar na lista —</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.codigo ? ` [Cód: ${p.codigo}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPaciente ? (
                <div className="md:col-span-2 bg-slate-50 border border-slate-200/60 rounded-lg p-3.5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                  <div className="w-full font-bold text-slate-800 text-sm mb-1">
                    {selectedPaciente.nome}
                  </div>
                  {selectedPaciente.codigo && (
                    <div>
                      Cód:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedPaciente.codigo}
                      </span>
                    </div>
                  )}
                  {selectedPaciente.bi && (
                    <div>
                      NIF/BI:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedPaciente.bi}
                      </span>
                    </div>
                  )}
                  {selectedPaciente.nascimento && (
                    <div>
                      Nascimento:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedPaciente.nascimento}
                      </span>
                    </div>
                  )}
                  {selectedPaciente.sexo && (
                    <div>
                      Sexo:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedPaciente.sexo === "M"
                          ? "Masculino"
                          : "Feminino"}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="md:col-span-2 bg-slate-50/50 border border-dashed border-slate-200 rounded-lg p-4 flex items-center justify-center text-xs text-slate-400">
                  Nenhum paciente selecionado para a consulta.
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Seção Exames */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. Catálogo de Exames
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">
                  Digitar para filtrar
                </label>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedExameNome("");
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                  placeholder="Ex: Hemograma, Glicose..."
                  list="exames-list"
                />
                <datalist id="exames-list">
                  {examesFiltered.slice(0, 80).map((e) => (
                    <option key={e.codigo} value={e.designacao} />
                  ))}
                </datalist>
              </div>

              <div className="md:col-span-6">
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">
                  Resultados Encontrados
                </label>
                <select
                  value={selectedExameNome}
                  onChange={(e) => {
                    setSelectedExameNome(e.target.value);
                    setSearch("");
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                >
                  <option value="">— Seleccionar Exame correspondente —</option>
                  {examesFiltered.slice(0, 100).map((e) => (
                    <option key={e.codigo} value={e.designacao}>
                      {e.codigo} – {e.designacao}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex gap-2 w-full">
                <button
                  type="button"
                  onClick={adicionarExame}
                  disabled={!selectedExameNome}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-bold transition disabled:opacity-40 hover:opacity-95 shadow-sm"
                  style={{ background: PURPLE }}
                >
                  + Associar
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Exames Adicionados */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  <th className="w-10 px-3 py-2 text-center">Sel.</th>
                  <th className="text-left px-3 py-2 w-24">Código</th>
                  <th className="text-left px-3 py-2">
                    Designação de Exame Clínico
                  </th>
                  <th className="w-12 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exameTable.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-10 text-slate-400 text-xs font-medium"
                    >
                      Nenhum exame adicionado para esta requisição ainda.
                    </td>
                  </tr>
                ) : (
                  exameTable.map((e, i) => (
                    <tr
                      key={i}
                      onClick={() => toggleRow(i)}
                      className={`cursor-pointer transition-colors ${selectedRows.has(i) ? "bg-purple-50/40" : "hover:bg-slate-50/40"}`}
                    >
                      <td
                        className="px-3 py-2 text-center"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRows.has(i)}
                          onChange={() => toggleRow(i)}
                          className="accent-purple-600 rounded"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400 text-xs">
                        {e.codigo}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {e.designacao}
                      </td>
                      <td
                        className="px-3 py-2 text-center"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setExameTable((t) => t.filter((_, j) => j !== i));
                            selectedRows.delete(i);
                          }}
                          className="text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <hr className="border-slate-100" />

          {/* Outros Detalhes Clínicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">
                Médico Prescritor / Requisitante
              </label>
              <input
                value={medicoSolicitante}
                onChange={(e) => setMedicoSolicitante(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                placeholder="Ex: Dra. Ana Silva (opcional)"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">
                Observações / Sintomas / Diagnóstico Prévio
              </label>
              <input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                placeholder="Ex: Jejum de 12 horas obrigatório"
              />
            </div>
          </div>

          <div className="flex items-center">
            <label className="inline-flex items-center gap-2.5 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={urgente}
                onChange={(e) => setUrgente(e.target.checked)}
                className="w-4.5 h-4.5 rounded accent-rose-600"
              />
              <span className="font-bold text-rose-600">
                Sinalizar como Urgente (Prioridade de Análise)
              </span>
            </label>
          </div>

          {msg && (
            <div
              className={`text-xs px-4 py-3 rounded-lg font-medium border ${msg.ok ? "bg-green-50 text-green-700 border-green-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}
            >
              {msg.text}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 justify-between pt-4 border-t border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={removerSelecionados}
              disabled={exameTable.length === 0}
              className="px-4 py-2 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold bg-rose-50/50 hover:bg-rose-100 transition disabled:opacity-40"
            >
              {selectedRows.size > 0
                ? `Remover ${selectedRows.size} Seleccionado(s)`
                : "Limpar Toda a Lista"}
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={saving}
              className="px-6 py-2 rounded-lg text-white text-sm font-bold transition hover:opacity-95 disabled:opacity-60 flex items-center gap-1.5"
              style={{ background: PURPLE }}
            >
              {saving ? "A processar..." : "Gravar e Submeter Requisição"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Portal ──────────────────────────────────────────────────────────────
export default function PortalParceiro({ session, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [pacientes, setPacientes] = useState<ParceiroPaciente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loadingSol, setLoadingSol] = useState(false);
  const [loadingPac, setLoadingPac] = useState(false);
  const [loadingProd, setLoadingProd] = useState(false);
  const [loadingFat, setLoadingFat] = useState(false);
  const [resultadoModal, setResultadoModal] = useState<string | null>(null);
  const [novoPacModal, setNovoPacModal] = useState(false);
  const [editPac, setEditPac] = useState<ParceiroPaciente | null>(null);
  const [pacSearch, setPacSearch] = useState("");
  const [newResultsToast, setNewResultsToast] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const prevConcluidosRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [prodModal, setProdModal] = useState(false);
  const [editProd, setEditProd] = useState<Produto | null>(null);
  const [stockMovProd, setStockMovProd] = useState<Produto | null>(null);
  const [prodSearch, setProdSearch] = useState("");
  const [prodCategoria, setProdCategoria] = useState("");
  const [fatModal, setFatModal] = useState(false);
  const [editFat, setEditFat] = useState<Fatura | null>(null);
  const [fatSearch, setFatSearch] = useState("");
  const [fatEstado, setFatEstado] = useState("");
  const [processSol, setProcessSol] = useState<Solicitacao | null>(null);

  const loadSolicitacoes = useCallback(async (silent = false) => {
    if (!silent) setLoadingSol(true);
    try {
      const rows = await api.solicitacoes.listMinhas();
      const newCount = rows.filter((s: any) => s.estado === "concluido").length;
      if (silent && newCount > prevConcluidosRef.current) {
        setNewResultsToast(true);
        setTimeout(() => setNewResultsToast(false), 5000);
      }
      prevConcluidosRef.current = newCount;
      setSolicitacoes(rows);
      setLastRefresh(new Date());
    } catch {
      /* ignore */
    } finally {
      if (!silent) setLoadingSol(false);
    }
  }, []);

  const loadPacientes = useCallback(async () => {
    setLoadingPac(true);
    try {
      setPacientes(await api.parceiroPacientes.list());
    } catch {
      /* ignore */
    } finally {
      setLoadingPac(false);
    }
  }, []);

  const loadProdutos = useCallback(async () => {
    setLoadingProd(true);
    try {
      const lista = (await (api as any).produtos?.list?.()) ?? [];
      setProdutos(lista);
    } catch {
      /* ignore */
    } finally {
      setLoadingProd(false);
    }
  }, []);

  const loadFaturas = useCallback(async () => {
    setLoadingFat(true);
    try {
      const lista = (await (api as any).faturas?.list?.()) ?? [];
      setFaturas(lista);
    } catch {
      /* ignore */
    } finally {
      setLoadingFat(false);
    }
  }, []);

  useEffect(() => {
    loadSolicitacoes();
    loadPacientes();
    loadProdutos();
    loadFaturas();
    pollingRef.current = setInterval(() => loadSolicitacoes(true), 30_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadSolicitacoes, loadPacientes, loadProdutos, loadFaturas]);

  async function savePaciente(data: Omit<ParceiroPaciente, "id">) {
    if (editPac) {
      await api.parceiroPacientes.update(editPac.id, data);
    } else {
      await api.parceiroPacientes.create(data);
    }
    await loadPacientes();
    setEditPac(null);
  }

  async function deletePaciente(id: string) {
    if (!confirm("Pretende realmente eliminar este registo de paciente?"))
      return;
    await api.parceiroPacientes.delete(id);
    await loadPacientes();
  }

  function handlePrint(sol: Solicitacao) {
    downloadPDF(
      generateRequisicaoPDFHTML(sol, session),
      `Requisicao_${sol.pacienteNome}`,
    );
  }

  async function saveProduto(data: Omit<Produto, "id">) {
    if (editProd) {
      await (api as any).produtos.update(editProd.id, data);
    } else {
      await (api as any).produtos.create(data);
    }
    await loadProdutos();
    setEditProd(null);
  }

  async function deleteProduto(id: string) {
    if (!confirm("Pretende mesmo remover este produto de stock?")) return;
    await (api as any).produtos.delete(id);
    await loadProdutos();
  }

  async function registrarMovStock(
    tipo: "entrada" | "saida",
    qtd: number,
    motivo: string,
  ) {
    if (!stockMovProd) return;
    await (api as any).produtos.movimentar(stockMovProd.id, {
      tipo,
      quantidade: qtd,
      motivo,
    });
    await loadProdutos();
    setStockMovProd(null);
  }

  async function mudarEstadoFatura(id: string, novoEstado: Fatura["estado"]) {
    await (api as any).faturas.update(id, { estado: novoEstado });
    await loadFaturas();
  }

  async function deleteFatura(id: string) {
    if (!confirm("Pretende anular o registo desta fatura comercial?")) return;
    await (api as any).faturas.update(id, { estado: "anulada" });
    await loadFaturas();
  }

  const concluidos = solicitacoes.filter((s) => s.estado === "concluido");
  const emAberto = solicitacoes.filter(
    (s) => s.estado === "pendente" || s.estado === "em_processo",
  );
  const pendentes = solicitacoes.filter((s) => s.estado === "pendente");
  const emProcesso = solicitacoes.filter((s) => s.estado === "em_processo");

  const pacientesFiltrados = useMemo(() => {
    if (!pacSearch.trim()) return pacientes;
    return pacientes.filter(
      (p) =>
        p.nome.toLowerCase().includes(pacSearch.toLowerCase()) ||
        p.codigo.includes(pacSearch) ||
        p.bi.includes(pacSearch),
    );
  }, [pacientes, pacSearch]);

  const produtosFiltrados = useMemo(() => {
    let lista = produtos;
    if (prodCategoria)
      lista = lista.filter((p) => p.categoria === prodCategoria);
    if (prodSearch.trim()) {
      const q = prodSearch.toLowerCase();
      lista = lista.filter(
        (p) =>
          p.designacao.toLowerCase().includes(q) ||
          p.codigo.toLowerCase().includes(q) ||
          (p.fornecedor || "").toLowerCase().includes(q),
      );
    }
    return lista;
  }, [produtos, prodSearch, prodCategoria]);

  const faturasFiltradas = useMemo(() => {
    let lista = faturas;
    if (fatEstado) lista = lista.filter((f) => f.estado === fatEstado);
    if (fatSearch.trim()) {
      const q = fatSearch.toLowerCase();
      lista = lista.filter(
        (f) =>
          (f.numero || "").toLowerCase().includes(q) ||
          (f.pacienteNome || "").toLowerCase().includes(q),
      );
    }
    return lista;
  }, [faturas, fatSearch, fatEstado]);

  const categoriasProdutos = useMemo(() => {
    const set = new Set(produtos.map((p) => p.categoria).filter(Boolean));
    return Array.from(set).sort();
  }, [produtos]);

  const stockBaixo = produtos.filter((p) => p.stock <= p.stockMinimo);
  const faturasPendentes = faturas.filter(
    (f) => f.estado === "emitida" || f.estado === "vencida",
  );

  const totalFaturadoMes = useMemo(() => {
    const now = new Date();
    const mes = now.getMonth();
    const ano = now.getFullYear();
    return faturas
      .filter((f) => {
        if (f.estado !== "paga") return false;
        const [d, m, y] = (f.data || "").split("/").map(Number);
        return m - 1 === mes && y === ano;
      })
      .reduce((s, f) => s + (f.total || 0), 0);
  }, [faturas]);

  const chartRequisicoes = useMemo(() => {
    const hoje = new Date();
    const dias: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      const str = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const count = solicitacoes.filter((s) => s.data === str).length;
      dias.push({ label: String(d.getDate()).padStart(2, "0"), value: count });
    }
    return dias;
  }, [solicitacoes]);

  const chartFaturacao = useMemo(() => {
    const hoje = new Date();
    const meses: { label: string; value: number }[] = [];
    const nomes = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const total = faturas
        .filter((f) => {
          if (f.estado === "anulada") return false;
          const [fd, fm, fy] = (f.data || "").split("/").map(Number);
          return fm - 1 === d.getMonth() && fy === d.getFullYear();
        })
        .reduce((s, f) => s + f.total, 0);
      meses.push({ label: nomes[d.getMonth()], value: total });
    }
    return meses;
  }, [faturas]);

  const chartEstados = useMemo(() => {
    return [
      { label: "Pendente", value: pendentes.length, color: "#f59e0b" },
      { label: "Em processo", value: emProcesso.length, color: "#3b82f6" },
      { label: "Concluído", value: concluidos.length, color: "#10b981" },
      {
        label: "Cancelado",
        value: solicitacoes.filter((s) => s.estado === "cancelado").length,
        color: "#ef4444",
      },
    ].filter((d) => d.value > 0);
  }, [solicitacoes]);

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "dashboard", label: "Painel Geral" },
    { key: "externo", label: "Pedido Externo" },
    { key: "interno", label: "Pedido Interno" },
    {
      key: "processamento",
      label: "Digitação Laboratório",
      badge: pendentes.length + emProcesso.length,
    },
    {
      key: "resultados",
      label: "Resultados Emitidos",
      badge: concluidos.length,
    },
    { key: "faturacao", label: "Faturação", badge: faturasPendentes.length },
    { key: "produtos", label: "Stock & Reagentes", badge: stockBaixo.length },
    { key: "pacientes", label: "Fichas de Clientes" },
  ];

  return (
    <>
      {resultadoModal && (
        <ResultadoModal
          solId={resultadoModal}
          onClose={() => setResultadoModal(null)}
        />
      )}

      {processSol && (
        <ProcessamentoModal
          sol={processSol}
          onSaved={loadSolicitacoes}
          onClose={() => setProcessSol(null)}
        />
      )}

      {prodModal && (
        <ProdutoModal
          initial={editProd || undefined}
          onSave={saveProduto}
          onClose={() => {
            setProdModal(false);
            setEditProd(null);
          }}
        />
      )}

      {stockMovProd && (
        <StockMovModal
          produto={stockMovProd}
          onConfirm={registrarMovStock}
          onClose={() => setStockMovProd(null)}
        />
      )}

      {fatModal && (
        <FaturaModal
          pacientes={pacientes}
          solicitacoes={solicitacoes}
          initial={editFat || undefined}
          onSaved={loadFaturas}
          onClose={() => {
            setFatModal(false);
            setEditFat(null);
          }}
        />
      )}

      {newResultsToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold animate-bounce">
          <span className="text-lg">🔔</span>
          <span>Resultados publicados disponíveis!</span>
          <button
            onClick={() => {
              setTab("resultados");
              setNewResultsToast(false);
            }}
            className="ml-1 underline text-green-100 text-xs"
          >
            Aceder
          </button>
        </div>
      )}

      {(novoPacModal || editPac) && (
        <NovoPacienteModal
          initial={editPac || undefined}
          onSave={savePaciente}
          onClose={() => {
            setNovoPacModal(false);
            setEditPac(null);
          }}
        />
      )}

      <div className="min-h-screen flex flex-col bg-slate-50/50">
        <header className="bg-white border-b border-slate-200/80 flex-shrink-0 sticky top-0 z-40 backdrop-blur-md bg-white/95">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 text-sm font-bold shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${PURPLE}, #8b5cf6)`,
              }}
            >
              {(session.parceiroNome || session.username || "P")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800 text-sm leading-tight truncate">
                {session.parceiroNome || session.username}
              </div>
              <div className="text-xs text-slate-400 font-medium leading-tight mt-0.5">
                {session.parceiroInstituicao
                  ? `${session.parceiroInstituicao} · `
                  : ""}
                {session.empresaNome}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs">
              {emAberto.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold">
                  {emAberto.length} consultas pendentes
                </span>
              )}
              {concluidos.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200/60 font-semibold">
                  {concluidos.length} concluídas
                </span>
              )}
              {stockBaixo.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold">
                  ⚠ {stockBaixo.length} em rutura
                </span>
              )}
            </div>
            <button
              onClick={onLogout}
              className="text-xs text-slate-500 hover:text-rose-600 font-bold px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50/40 transition flex-shrink-0"
            >
              Terminar Sessão
            </button>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex gap-1 overflow-x-auto border-t border-slate-100 scrollbar-none">
              {TABS.map((t) => {
                const badge = t.badge && t.badge > 0 ? t.badge : 0;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-3.5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${
                      tab === t.key
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span>{t.label}</span>
                    {badge > 0 && tab !== t.key && (
                      <span
                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-white font-bold px-1"
                        style={{ background: PURPLE, fontSize: "9px" }}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full">
          {/* ── DASHBOARD ── */}
          {tab === "dashboard" && (
            <div className="p-4 sm:p-6 space-y-5">
              <div className="bg-gradient-to-br from-purple-700 via-purple-800 to-indigo-900 rounded-2xl p-6 text-white shadow-md">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-purple-200">
                      Painel Geral do Parceiro
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold mt-1">
                      Bem-vindo, {session.parceiroNome || session.username}
                    </h1>
                    <p className="text-purple-100/90 text-xs sm:text-sm mt-1">
                      Consulte o resumo clínico, faturas e controle de
                      inventário em tempo real.
                    </p>
                  </div>
                  <button
                    onClick={() => setTab("externo")}
                    className="px-4 py-2 bg-white text-purple-800 hover:bg-purple-50 rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    + Registar Requisição
                  </button>
                </div>
              </div>

              {/* Cartões Estatísticos */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Aguardar Análise
                      </div>
                      <div className="text-2xl font-bold text-amber-600 mt-1">
                        {emAberto.length}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {pendentes.length} pend. · {emProcesso.length} proc.
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-lg">
                      ⏱
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Resultados Prontos
                      </div>
                      <div className="text-2xl font-bold text-green-600 mt-1">
                        {concluidos.length}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Total de resultados entregues
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600 font-bold text-lg">
                      ✓
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Faturação Liquidada (Mês)
                      </div>
                      <div className="text-xl font-extrabold mt-1 text-slate-800">
                        {formatMoeda(totalFaturadoMes)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {faturasPendentes.length} cobranças pendentes
                      </div>
                    </div>
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                      style={{ background: PURPLE_LIGHT, color: PURPLE }}
                    >
                      💰
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Base de Dados
                      </div>
                      <div className="text-2xl font-bold text-slate-800 mt-1">
                        {pacientes.length}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {produtos.length} reagentes em inventário
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">
                      👥
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Histórico de Requisições
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Atividade diária na última semana
                      </p>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      Total:{" "}
                      <span className="text-slate-800 font-extrabold">
                        {chartRequisicoes.reduce((s, d) => s + d.value, 0)}
                      </span>
                    </div>
                  </div>
                  <BarChart data={chartRequisicoes} height={160} />
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                    Divisão de Estados
                  </h3>
                  <div className="flex justify-center">
                    <DonutChart data={chartEstados} size={140} />
                  </div>
                  <div className="mt-5 space-y-2">
                    {chartEstados.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs font-medium"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: d.color }}
                          />
                          <span className="text-slate-600">{d.label}</span>
                        </div>
                        <span className="font-bold text-slate-800">
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Evolução de Faturação e Alertas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Evolução Mensal de Receitas
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Histórico financeiro consolidado de faturas
                    </p>
                  </div>
                  <LineChart
                    data={chartFaturacao.map((d) => d.value)}
                    color={PURPLE}
                    height={140}
                  />
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm flex flex-col">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Alertas de Rutura de Stock
                    </span>
                    <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 font-bold px-2 py-0.5 rounded-full">
                      {stockBaixo.length} Artigo(s)
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto flex-1">
                    {stockBaixo.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-medium">
                        Não existem produtos abaixo do limite em stock.
                      </div>
                    ) : (
                      stockBaixo.slice(0, 8).map((p) => (
                        <div
                          key={p.id}
                          className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => setTab("produtos")}
                        >
                          <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-sm font-bold">
                            📦
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">
                              {p.designacao}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Stock Atual: {p.stock} / Limite de Alerta:{" "}
                              {p.stockMinimo} {p.unidade}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Acesso Rápido */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Atalhos de Gestão
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => setTab("externo")}
                    className="p-3 rounded-xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/50 transition duration-200 text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                      style={{ background: PURPLE_LIGHT }}
                    >
                      <span style={{ color: PURPLE }}>📋</span>
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Pedido Externo
                    </div>
                  </button>
                  <button
                    onClick={() => setTab("interno")}
                    className="p-3 rounded-xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/50 transition duration-200 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2.5 text-blue-600 font-bold">
                      🩺
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Pedido Interno
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setFatModal(true);
                      setEditFat(null);
                    }}
                    className="p-3 rounded-xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/50 transition duration-200 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mb-2.5 text-green-600 font-bold">
                      💰
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Emitir Fatura
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setProdModal(true);
                      setEditProd(null);
                    }}
                    className="p-3 rounded-xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/50 transition duration-200 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2.5 text-amber-600 font-bold">
                      📦
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Novo Produto
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "externo" && (
            <RequisicaoForm
              tipoPedido="externo"
              pacientes={pacientes}
              session={session}
              onSaved={loadSolicitacoes}
            />
          )}

          {tab === "interno" && (
            <RequisicaoForm
              tipoPedido="interno"
              pacientes={pacientes}
              session={session}
              onSaved={loadSolicitacoes}
            />
          )}

          {/* ── PROCESSAMENTO ── */}
          {tab === "processamento" && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Processamento de Resultados Pendentes (
                    {pendentes.length + emProcesso.length})
                  </span>
                  <button
                    onClick={() => loadSolicitacoes()}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:text-purple-600 transition duration-150"
                  >
                    ↻ Atualizar Lista
                  </button>
                </div>
                {loadingSol ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    A ler dados...
                  </div>
                ) : pendentes.length + emProcesso.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="text-slate-300 text-5xl mb-3">✓</div>
                    <div className="text-slate-600 font-bold">
                      Fila de espera vazia
                    </div>
                    <div className="text-slate-400 text-xs mt-1">
                      Todos os exames submetidos já se encontram processados.
                    </div>
                  </div>
                ) : (
                  <>
                    {pendentes.length > 0 && (
                      <div>
                        <div className="bg-amber-50/50 border-b border-amber-100 px-5 py-2.5">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                            Aguardar Início ({pendentes.length})
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {pendentes.map((sol) => (
                            <div
                              key={sol.id}
                              className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/40"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-slate-800">
                                  {sol.pacienteNome}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5 flex gap-2 items-center">
                                  <span>
                                    {sol.data} {sol.hora}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {(sol.examesSolicitados || []).length}{" "}
                                    exames associados
                                  </span>
                                  {sol.urgente && (
                                    <span className="text-rose-600 font-extrabold ml-1">
                                      ⚠ PRIORITÁRIO
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 mt-1 truncate max-w-2xl font-medium">
                                  {(sol.examesSolicitados || []).join(", ")}
                                </div>
                              </div>
                              <button
                                onClick={() => setProcessSol(sol)}
                                className="px-3.5 py-2 rounded-lg text-xs font-bold text-white flex-shrink-0 hover:opacity-95 shadow-sm transition-opacity"
                                style={{ background: PURPLE }}
                              >
                                Digitar Resultados
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {emProcesso.length > 0 && (
                      <div className="border-t border-slate-100">
                        <div className="bg-blue-50/50 border-b border-blue-100 px-5 py-2.5">
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                            Análise em Curso ({emProcesso.length})
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {emProcesso.map((sol) => (
                            <div
                              key={sol.id}
                              className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/40"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-slate-800">
                                  {sol.pacienteNome}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {sol.data} às {sol.hora}
                                </div>
                              </div>
                              <button
                                onClick={() => setProcessSol(sol)}
                                className="px-3.5 py-2 rounded-lg text-xs font-bold text-white flex-shrink-0 hover:opacity-95 shadow-sm transition-opacity"
                                style={{ background: PURPLE }}
                              >
                                Retomar Preenchimento
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── RESULTADOS ── */}
          {tab === "resultados" && (
            <div className="p-4 sm:p-6">
              <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Laudos & Resultados Emitidos
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">
                      Atualizado em: {lastRefresh.toLocaleTimeString("pt-PT")}
                    </span>
                    <button
                      onClick={() => loadSolicitacoes()}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:text-purple-600 transition"
                    >
                      ↻ Sincronizar
                    </button>
                  </div>
                </div>
                {loadingSol ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    A carregar registos...
                  </div>
                ) : concluidos.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="text-slate-300 text-5xl mb-3">📋</div>
                    <div className="text-slate-600 font-bold">
                      Nenhum laudo publicado
                    </div>
                    <div className="text-slate-400 text-xs mt-1">
                      Os resultados aparecem nesta área assim que forem
                      validados pela equipa analítica.
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-bold bg-slate-50/50">
                          <th className="text-left px-5 py-3">
                            Paciente / Utente
                          </th>
                          <th className="text-left px-4 py-3 hidden sm:table-cell">
                            Exames Registados
                          </th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">
                            Prescritor
                          </th>
                          <th className="text-left px-4 py-3">Data Emissão</th>
                          <th className="text-center px-5 py-3">Acções</th>
                        </tr>
                      </thead>
                      <tbody>
                        {concluidos.map((sol) => (
                          <tr
                            key={sol.id}
                            className="border-t border-slate-100 hover:bg-slate-50/25 transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-800 text-sm">
                                {sol.pacienteNome}
                              </div>
                              <div className="text-xs text-slate-400 font-medium mt-0.5">
                                {sol.pacienteBi && (
                                  <span className="mr-2">
                                    BI: {sol.pacienteBi}
                                  </span>
                                )}
                                {sol.tipoPedido === "interno" && (
                                  <span className="text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.5 rounded text-[10px]">
                                    Interno
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 hidden sm:table-cell">
                              <div className="text-xs text-slate-500 font-medium max-w-xs truncate">
                                {sol.examesSolicitados.join(", ")}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 hidden md:table-cell text-slate-500 text-xs font-semibold">
                              {sol.medicoSolicitante || "—"}
                            </td>
                            <td className="px-4 py-3.5 text-slate-400 text-xs font-medium whitespace-nowrap">
                              {sol.data}
                              <br />
                              {sol.hora}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setResultadoModal(sol.id)}
                                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-95"
                                  style={{ background: PURPLE }}
                                >
                                  Consultar
                                </button>
                                <button
                                  onClick={() => handlePrint(sol)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                                >
                                  Imprimir PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {emAberto.length > 0 && (
                <div className="mt-5 border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-2.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Pedidos na Fila de Análise ({emAberto.length})
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {emAberto.map((sol) => {
                      const cfg = ESTADOS[sol.estado] ?? {
                        label: sol.estado,
                        cls: "bg-slate-100 text-slate-500 border border-slate-200/60",
                        dot: "bg-slate-500",
                      };
                      return (
                        <div
                          key={sol.id}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/25 transition-colors"
                        >
                          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-800">
                              {sol.pacienteNome}
                            </div>
                            <div className="text-xs text-slate-400 font-medium mt-0.5">
                              {sol.data} às {sol.hora}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${cfg.cls}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── FATURAÇÃO ── */}
          {tab === "faturacao" && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Total faturado
                  </div>
                  <div className="text-base sm:text-lg font-bold text-slate-800 mt-1">
                    {formatMoeda(
                      faturas
                        .filter((f) => f.estado !== "anulada")
                        .reduce((s, f) => s + f.total, 0),
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Lançamentos Pagos
                  </div>
                  <div className="text-base sm:text-lg font-bold text-green-600 mt-1">
                    {formatMoeda(
                      faturas
                        .filter((f) => f.estado === "paga")
                        .reduce((s, f) => s + f.total, 0),
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Crédito a Receber
                  </div>
                  <div className="text-base sm:text-lg font-bold text-amber-600 mt-1">
                    {formatMoeda(
                      faturas
                        .filter((f) => f.estado === "emitida")
                        .reduce((s, f) => s + f.total, 0),
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Contas Vencidas
                  </div>
                  <div className="text-base sm:text-lg font-bold text-rose-600 mt-1">
                    {formatMoeda(
                      faturas
                        .filter((f) => f.estado === "vencida")
                        .reduce((s, f) => s + f.total, 0),
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Faturas Emitidas ({faturasFiltradas.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={fatEstado}
                      onChange={(e) => setFatEstado(e.target.value)}
                      className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-200/30"
                    >
                      <option value="">Filtro: Todos os estados</option>
                      {Object.entries(ESTADOS_FATURA).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setFatModal(true);
                        setEditFat(null);
                      }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white hover:opacity-95 transition-all shadow-sm"
                      style={{ background: PURPLE }}
                    >
                      + Emitir Fatura
                    </button>
                  </div>
                </div>

                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/20">
                  <input
                    value={fatSearch}
                    onChange={(e) => setFatSearch(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200/20 focus:border-purple-300 transition-all"
                    placeholder="Filtrar por nº de fatura ou por nome de paciente..."
                  />
                </div>

                {loadingFat ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    A carregar dados contabilísticos...
                  </div>
                ) : faturasFiltradas.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="text-slate-300 text-5xl mb-3">🧾</div>
                    <div className="text-slate-600 font-bold">
                      {fatSearch || fatEstado
                        ? "Sem correspondência na procura"
                        : "Sem faturação emitida"}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-bold bg-slate-50/50">
                          <th className="text-left px-5 py-3">Número</th>
                          <th className="text-left px-4 py-3">
                            Paciente / Utente
                          </th>
                          <th className="text-left px-4 py-3 hidden sm:table-cell">
                            Data Emissão
                          </th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">
                            Vencimento
                          </th>
                          <th className="text-right px-4 py-3">Valor Total</th>
                          <th className="text-center px-4 py-3">Estado</th>
                          <th className="text-center px-5 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {faturasFiltradas.map((f) => {
                          const cfg = ESTADOS_FATURA[f.estado] ?? {
                            label: f.estado,
                            cls: "bg-slate-100 text-slate-500 border border-slate-200/60",
                          };
                          return (
                            <tr
                              key={f.id}
                              className="border-t border-slate-100 hover:bg-slate-50/20 transition-colors"
                            >
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-700 font-semibold">
                                {f.numero || f.id.slice(0, 8)}
                              </td>
                              <td className="px-4 py-3.5 font-semibold text-slate-800">
                                {f.pacienteNome}
                              </td>
                              <td className="px-4 py-3.5 text-slate-400 text-xs font-medium hidden sm:table-cell">
                                {f.data}
                              </td>
                              <td className="px-4 py-3.5 text-slate-400 text-xs font-medium hidden md:table-cell">
                                {f.dataVencimento || "—"}
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                                {formatMoeda(f.total)}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}
                                >
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center justify-center gap-3">
                                  {f.estado === "emitida" && (
                                    <button
                                      onClick={() =>
                                        mudarEstadoFatura(f.id, "paga")
                                      }
                                      className="text-xs font-bold text-green-600 hover:underline"
                                    >
                                      Liquidada
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditFat(f);
                                      setFatModal(true);
                                    }}
                                    className="text-xs font-bold text-purple-600 hover:underline"
                                  >
                                    Editar
                                  </button>
                                  {f.estado !== "anulada" && (
                                    <button
                                      onClick={() => deleteFatura(f.id)}
                                      className="text-xs font-bold text-rose-500 hover:underline"
                                    >
                                      Anular
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PRODUTOS & STOCK ── */}
          {tab === "produtos" && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Produtos Registados
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mt-1">
                    {produtos.length}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Valor total de inventário
                  </div>
                  <div
                    className="text-xl font-extrabold mt-1"
                    style={{ color: PURPLE }}
                  >
                    {formatMoeda(
                      produtos.reduce((s, p) => s + p.custo * p.stock, 0),
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Abaixo do Limite
                  </div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    {stockBaixo.length}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Rutura Absoluta
                  </div>
                  <div className="text-2xl font-bold text-rose-600 mt-1">
                    {produtos.filter((p) => p.stock === 0).length}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Controlo de Inventário ({produtosFiltrados.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={prodCategoria}
                      onChange={(e) => setProdCategoria(e.target.value)}
                      className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-200/30"
                    >
                      <option value="">Filtro: Categorias</option>
                      {categoriasProdutos.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setProdModal(true);
                        setEditProd(null);
                      }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white hover:opacity-95 transition-all shadow-sm"
                      style={{ background: PURPLE }}
                    >
                      + Registar Artigo
                    </button>
                  </div>
                </div>

                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/20">
                  <input
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200/20 focus:border-purple-300 transition-all"
                    placeholder="Filtrar por nome de artigo, referência de código ou fornecedor..."
                  />
                </div>

                {loadingProd ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    A carregar inventário...
                  </div>
                ) : produtosFiltrados.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="text-slate-300 text-5xl mb-3">📦</div>
                    <div className="text-slate-600 font-bold">
                      {prodSearch || prodCategoria
                        ? "Sem correspondência no stock"
                        : "Armazém sem reagentes"}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-bold bg-slate-50/50">
                          <th className="text-left px-5 py-3">Código</th>
                          <th className="text-left px-4 py-3">Designação</th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">
                            Categoria
                          </th>
                          <th className="text-right px-4 py-3 hidden sm:table-cell">
                            Preço Unit.
                          </th>
                          <th className="text-center px-4 py-3">Nível Stock</th>
                          <th className="text-left px-4 py-3 hidden lg:table-cell">
                            Distribuidor
                          </th>
                          <th className="text-left px-4 py-3 hidden lg:table-cell">
                            Validade
                          </th>
                          <th className="text-center px-5 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtosFiltrados.map((p) => {
                          const baixo = p.stock <= p.stockMinimo;
                          return (
                            <tr
                              key={p.id}
                              className={`border-t border-slate-100 hover:bg-slate-50/20 transition-colors ${baixo ? "bg-rose-50/20" : ""}`}
                            >
                              <td className="px-5 py-3.5 font-mono text-slate-400 text-xs">
                                {p.codigo || "—"}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-800 text-sm">
                                  {p.designacao}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                  Embalagem: {p.unidade}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 hidden md:table-cell">
                                <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                                  {p.categoria}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-medium text-slate-600 text-xs hidden sm:table-cell">
                                {formatMoeda(p.preco)}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span
                                  className={`text-xs font-extrabold px-2 py-1 rounded-md ${
                                    p.stock === 0
                                      ? "bg-rose-100 text-rose-700"
                                      : baixo
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {p.stock}
                                </span>
                                {baixo && (
                                  <div className="text-[9px] text-rose-500 font-bold uppercase tracking-wide mt-1.5">
                                    Mínimo: {p.stockMinimo}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 text-xs font-semibold hidden lg:table-cell">
                                {p.fornecedor || "—"}
                              </td>
                              <td className="px-4 py-3.5 text-slate-400 text-xs font-mono hidden lg:table-cell">
                                {p.validade || "—"}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                  <button
                                    onClick={() => setStockMovProd(p)}
                                    className="text-xs font-bold text-blue-600 hover:underline"
                                  >
                                    Ajustar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditProd(p);
                                      setProdModal(true);
                                    }}
                                    className="text-xs font-bold text-purple-600 hover:underline"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => deleteProduto(p.id)}
                                    className="text-xs font-bold text-rose-500 hover:underline"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PACIENTES ── */}
          {tab === "pacientes" && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Fichas de Clientes / Pacientes ({pacientes.length})
                  </span>
                  <button
                    onClick={() => setNovoPacModal(true)}
                    className="text-xs font-bold px-3.5 py-1.5 rounded-lg text-white transition-all shadow-sm"
                    style={{ background: PURPLE }}
                  >
                    + Adicionar Utente
                  </button>
                </div>

                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/20">
                  <input
                    value={pacSearch}
                    onChange={(e) => setPacSearch(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200/20 focus:border-purple-300 transition-all"
                    placeholder="Pesquisa rápida de utente por nome, identificação de código interno ou nº de BI..."
                  />
                </div>

                {loadingPac ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    A ler dados clínicos...
                  </div>
                ) : pacientesFiltrados.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="text-slate-300 text-5xl mb-3">Utentes</div>
                    <div className="text-slate-600 font-bold">
                      {pacSearch
                        ? "Sem correspondência na procura"
                        : "Não existem utentes registados"}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-bold bg-slate-50/50">
                          <th className="text-left px-5 py-3">Cód. Interno</th>
                          <th className="text-left px-4 py-3">Nome Completo</th>
                          <th className="text-left px-4 py-3 hidden sm:table-cell">
                            Nascimento
                          </th>
                          <th className="text-left px-4 py-3 hidden sm:table-cell">
                            Gênero
                          </th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">
                            Contacto
                          </th>
                          <th className="text-left px-4 py-3 hidden md:table-cell">
                            NIF / BI
                          </th>
                          <th className="text-center px-5 py-3">
                            Ações de Registo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pacientesFiltrados.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-slate-100 hover:bg-slate-50/20 transition-colors"
                          >
                            <td className="px-5 py-3.5 font-mono text-slate-400 text-xs font-semibold">
                              {p.codigo || "—"}
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-800 text-sm">
                              {p.nome}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-xs font-medium hidden sm:table-cell">
                              {p.nascimento || "—"}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-xs font-medium hidden sm:table-cell">
                              {p.sexo === "M"
                                ? "Masculino"
                                : p.sexo === "F"
                                  ? "Feminino"
                                  : "—"}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-xs font-medium hidden md:table-cell">
                              {p.telefone || "—"}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-xs font-mono hidden md:table-cell">
                              {p.bi || "—"}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  onClick={() => setEditPac(p)}
                                  className="text-xs font-bold text-purple-600 hover:underline"
                                >
                                  Editar Ficha
                                </button>
                                <span className="text-slate-200">|</span>
                                <button
                                  onClick={() => deletePaciente(p.id)}
                                  className="text-xs font-bold text-rose-500 hover:underline"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white py-3.5 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-slate-400 font-medium">
            <div>{session.empresaNome} · Painel de Gestão e Parcerias</div>
            <div className="flex items-center gap-1.5 text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Ligado à Base de Dados Central</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

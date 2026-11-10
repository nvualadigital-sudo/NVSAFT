import { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "../../store/AppContext";
import { EXAMES_BUILTIN } from "../../data/exames";
import { downloadExamesPDF } from "../../utils/listPdfGenerator";
import { api } from "../../store/api";

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
/*  ÍCONES SVG                                                                  */
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
const IconPlus = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
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
const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);
const IconPDF = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
const IconSync = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 014-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 01-4 4H3" />
  </svg>
);
const IconArrowLeft = () => (
  <svg
    width="16"
    height="16"
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
const IconCheck = () => (
  <svg
    width="16"
    height="16"
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
    width="16"
    height="16"
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
const IconSave = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
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

/* ============================================================================ */
/*  COMPONENTES VISUAIS AUXILIARES                                              */
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
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
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
/*  TIPOS                                                                       */
/* ============================================================================ */
interface ParamInput {
  param: string;
  unidade: string;
  referencia: string;
}

interface SyncProd {
  key: string;
  codigo: string;
  nome: string;
  categoria: string;
}

function emptyParam(): ParamInput {
  return { param: "", unidade: "", referencia: "" };
}

type ViewMode = "lista" | "editor";

/* ============================================================================ */
/*  COMPONENTE PRINCIPAL                                                        */
/* ============================================================================ */
export default function CadastrarExames() {
  const { data, addExameCustom, updateExameCustom, removeExameCustom, reload } =
    useApp();

  const [view, setView] = useState<ViewMode>("lista");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"todos" | "padrao" | "custom">(
    "todos",
  );
  const [filterCat, setFilterCat] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editCatCustom, setEditCatCustom] = useState("");
  const [editNome, setEditNome] = useState("");
  const [editParams, setEditParams] = useState<ParamInput[]>([
    emptyParam(),
    emptyParam(),
    emptyParam(),
  ]);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [produtos, setProdutos] = useState<any[]>([]);
  useEffect(() => {
    api.produtos
      .list()
      .then(setProdutos)
      .catch(() => {});
  }, []);

  const refByNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of produtos) {
      if (p.nome && p.codigo) m.set(p.nome.toLowerCase().trim(), p.codigo);
    }
    return m;
  }, [produtos]);

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncItems, setSyncItems] = useState<SyncProd[]>([]);
  const [syncSelected, setSyncSelected] = useState<Set<string>>(new Set());
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const allBuiltin = useMemo(() => {
    const items: {
      cat: string;
      nome: string;
      params: ParamInput[];
      tipo: "Padrão";
      id?: number;
    }[] = [];
    for (const [cat, sub] of Object.entries(EXAMES_BUILTIN)) {
      for (const [nome, ps] of Object.entries(sub)) {
        items.push({
          cat,
          nome,
          params: (ps as any[]).map((p: any) => ({
            param: p[0],
            unidade: p[1],
            referencia: p[2],
          })),
          tipo: "Padrão",
        });
      }
    }
    return items;
  }, []);

  const allCustomRaw = useMemo(() => {
    const items: {
      cat: string;
      nome: string;
      params: ParamInput[];
      tipo: "Personalizado";
      id?: number;
    }[] = [];
    for (const [cat, sub] of Object.entries(data.examesCustom)) {
      for (const [nome, ps] of Object.entries(sub)) {
        const rawRow = data.examesCustomRaw.find(
          (r: any) => r.categoria === cat && r.nome === nome,
        );
        items.push({
          cat,
          nome,
          id: rawRow?.id,
          params: (ps as any[]).map((p: any) => ({
            param: p.param,
            unidade: p.unidade,
            referencia: p.referencia,
          })),
          tipo: "Personalizado",
        });
      }
    }
    return items;
  }, [data.examesCustom, data.examesCustomRaw]);

  const allItems = useMemo(() => {
    let items = [...allBuiltin, ...allCustomRaw];
    if (filterTipo === "padrao")
      items = items.filter((i) => i.tipo === "Padrão");
    if (filterTipo === "custom")
      items = items.filter((i) => i.tipo === "Personalizado");
    if (filterCat) items = items.filter((i) => i.cat === filterCat);
    if (search)
      items = items.filter(
        (i) =>
          i.nome.toLowerCase().includes(search.toLowerCase()) ||
          i.cat.toLowerCase().includes(search.toLowerCase()) ||
          (refByNome.get(i.nome.toLowerCase().trim()) || "").includes(search),
      );
    return items;
  }, [allBuiltin, allCustomRaw, filterTipo, filterCat, search, refByNome]);

  const allCats = useMemo(() => {
    return [
      ...new Set([...allBuiltin, ...allCustomRaw].map((i) => i.cat)),
    ].sort();
  }, [allBuiltin, allCustomRaw]);

  function handleNovo() {
    setEditCat("");
    setEditCatCustom("");
    setEditNome("");
    setEditParams([emptyParam(), emptyParam(), emptyParam()]);
    setIsEditingCustom(false);
    setEditingId(null);
    setMsg(null);
    setView("editor");
  }

  function handleEditar(item: (typeof allItems)[0]) {
    const params = item.params.length > 0 ? [...item.params] : [emptyParam()];
    setEditCat(item.cat);
    setEditCatCustom("");
    setEditNome(item.nome);
    setEditParams(params);
    setIsEditingCustom(item.tipo === "Personalizado");
    setEditingId(
      item.tipo === "Personalizado" && item.id != null ? item.id : null,
    );
    setMsg(null);
    setView("editor");
  }

  async function handleSave() {
    if (saveLock.current) return;
    const cat = editCatCustom.trim() || editCat.trim();
    const nome = editNome.trim();
    if (!cat || !nome) {
      setMsg({ text: "Preencha a categoria e o nome do exame.", ok: false });
      return;
    }
    const params = editParams.filter((p) => p.param.trim());
    if (params.length === 0) {
      setMsg({ text: "Adicione pelo menos um parâmetro.", ok: false });
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      if (isEditingCustom && editingId !== null) {
        await updateExameCustom(editingId, cat, nome, params);
        setMsg({ text: "Exame actualizado com sucesso.", ok: true });
      } else {
        await addExameCustom(cat, nome, params);
        setMsg({ text: `Exame "${nome}" criado com sucesso.`, ok: true });
      }
      setView("lista");
    } catch (err: any) {
      setMsg({ text: err.message || "Erro ao guardar exame.", ok: false });
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function handleRemover(item: (typeof allItems)[0]) {
    if (item.tipo !== "Personalizado") {
      alert("Só é possível eliminar exames personalizados.");
      return;
    }
    if (item.id == null) {
      alert("Não foi possível encontrar o ID do exame.");
      return;
    }
    if (!window.confirm(`Remover o exame "${item.nome}"?`)) return;
    try {
      await removeExameCustom(item.id);
      setView("lista");
    } catch (err: any) {
      alert(err.message || "Erro ao remover exame.");
    }
  }

  async function openSincronizar() {
    setMsg(null);
    setSyncOpen(true);
    setSyncLoading(true);
    setSyncMsg("");
    setSyncError("");
    try {
      const prods = await api.produtos.list();
      setProdutos(prods);
      const nomesExistentes = new Set(
        [...allBuiltin, ...allCustomRaw].map((i) =>
          i.nome.toLowerCase().trim(),
        ),
      );
      const items: SyncProd[] = [];
      const seen = new Set<string>();
      for (const p of prods) {
        // Produtos desactivados pertencem à tabela comercial, não à oferta clínica da unidade.
        if (!p.ativo || !p.nome) continue;
        const key = p.nome.toLowerCase().trim();
        if (!nomesExistentes.has(key) && !seen.has(key)) {
          seen.add(key);
          items.push({
            key: String(p.id),
            codigo: p.codigo || "",
            nome: p.nome,
            categoria: p.categoria || "Geral",
          });
        }
      }
      setSyncItems(items);
      setSyncSelected(new Set(items.map((i) => i.key)));
    } catch (e) {
      setSyncItems([]);
      setSyncError(
        e instanceof Error
          ? e.message
          : "Não foi possível consultar os produtos.",
      );
    } finally {
      setSyncLoading(false);
    }
  }

  function lookupBuiltinParams(nome: string): ParamInput[] | null {
    const nLower = nome.toLowerCase().trim();
    for (const sub of Object.values(EXAMES_BUILTIN)) {
      for (const [exNome, ps] of Object.entries(sub as Record<string, any[]>)) {
        if (exNome.toLowerCase().trim() === nLower) {
          return (ps as any[]).map((p: any) => ({
            param: p[0],
            unidade: p[1],
            referencia: p[2],
          }));
        }
      }
    }
    return null;
  }

  async function handleImportar() {
    if (syncSaving || saveLock.current) return;
    const toImport = syncItems.filter((i) => syncSelected.has(i.key));
    if (!toImport.length) return;
    saveLock.current = true;
    setSyncSaving(true);
    setSyncError("");
    try {
      const results = await Promise.allSettled(
        toImport.map((item) =>
          api.examesCustom.create({
            categoria: item.categoria,
            nome: item.nome,
            parametros: lookupBuiltinParams(item.nome) ?? [
              { param: item.nome, unidade: "", referencia: "" },
            ],
          }),
        ),
      );
      const succeeded = new Set(
        toImport
          .filter((_, i) => results[i].status === "fulfilled")
          .map((i) => i.key),
      );
      setSyncItems((old) => old.filter((i) => !succeeded.has(i.key)));
      setSyncSelected(
        (old) => new Set([...old].filter((id) => !succeeded.has(id))),
      );
      await reload().catch(() =>
        setSyncError(
          "Os exames foram importados, mas a lista precisa de ser actualizada.",
        ),
      );
      const failures = results.filter((r) => r.status === "rejected").length;
      setSyncMsg(succeeded.size + " exame(s) confirmado(s) no servidor.");
      if (failures)
        setSyncError(
          failures +
            " exame(s) não foram confirmados. Apenas esses permanecem seleccionados para repetir.",
        );
      else setSyncOpen(false);
    } finally {
      saveLock.current = false;
      setSyncSaving(false);
    }
  }

  const CATS_BUILTIN = [...new Set(allBuiltin.map((i) => i.cat))].sort();

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                   */
  /* ════════════════════════════════════════════════════════════════════════ */

  return (
    <div
      className="min-h-screen bg-white p-6 md:p-8"
      style={{ fontFamily: FONTE }}
    >
      {/* ── Cabeçalho ── */}
      <div
        className="mb-6 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
        style={BD}
      >
        <div className="flex items-center gap-3">
          {view === "editor" && (
            <button
              onClick={() => setView("lista")}
              className="flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80"
              style={{ color: CORES.teal }}
            >
              <IconArrowLeft /> Voltar à lista
            </button>
          )}
          <h2 className="text-xl font-light text-gray-600">
            {view === "lista"
              ? "Cadastro de Exames"
              : isEditingCustom
                ? "Editar Exame"
                : "Novo Exame Personalizado"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "lista" && (
            <>
              <button
                onClick={() => downloadExamesPDF(allItems, data.config)}
                className={`${btnRed} flex items-center gap-2 whitespace-nowrap`}
                style={{ borderColor: CORES.vermelho, color: CORES.vermelho }}
              >
                <IconPDF /> Baixar PDF
              </button>
              <button
                onClick={openSincronizar}
                className={`${btnOutline} flex items-center gap-2 whitespace-nowrap`}
                style={{ borderColor: `${CORES.teal}66`, color: CORES.teal }}
              >
                <IconSync /> Sincronizar Produtos
              </button>
              <button
                onClick={handleNovo}
                className={`${btnTeal} flex items-center gap-2`}
                style={{ backgroundColor: CORES.teal }}
              >
                <IconPlus /> Novo Exame
              </button>
            </>
          )}
        </div>
      </div>

      {msg && view === "lista" && (
        <p
          role={msg.ok ? "status" : "alert"}
          className="mb-4 rounded-sm border p-3 text-sm"
          style={{ ...BD, color: msg.ok ? CORES.verdeEscuro : CORES.vermelho }}
        >
          {msg.text}
        </p>
      )}
      {syncMsg && (
        <div
          className="mb-4 flex items-center gap-2 rounded-sm px-4 py-3 text-sm font-medium text-white"
          style={{ backgroundColor: CORES.verdeEscuro }}
        >
          <IconCheck /> {syncMsg}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  VIEW: LISTA                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === "lista" && (
        <>
          {/* Estatísticas */}
          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatBlock
              title="Total de exames"
              value={allItems.length}
              bg={CORES.navy}
              icon={<IconList />}
            />
            <StatBlock
              title="Personalizados"
              value={allCustomRaw.length}
              bg={CORES.teal}
              icon={<IconFlask />}
            />
            <StatBlock
              title="Códigos ligados"
              value={refByNome.size}
              bg={CORES.tealClaro}
              icon={<IconCheck />}
            />
          </div>

          {/* Filtros */}
          <div className="mb-5 rounded-sm border bg-white p-4" style={BD}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <IconSearch />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar exame ou código..."
                  className={`${inputCls} pl-10`}
                />
              </div>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value as any)}
                className={inputCls}
              >
                <option value="todos">Todos os tipos</option>
                <option value="padrao">Padrão</option>
                <option value="custom">Personalizado</option>
              </select>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                className={inputCls}
              >
                <option value="">Todas as categorias</option>
                {allCats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de exames */}
          <div
            className="overflow-hidden rounded-sm border bg-white"
            style={BD}
          >
            <CardHeader
              title={`Exames (${allItems.length})`}
              right={
                <span
                  className="rounded-sm px-2 py-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: CORES.oliva }}
                >
                  ✦ {allCustomRaw.length} personalizado(s)
                </span>
              }
            />
            {allItems.length === 0 ? (
              <div
                className="flex flex-col items-center border-t border-dashed py-16 text-center"
                style={BD}
              >
                <div
                  className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-gray-300"
                  style={{ backgroundColor: "#f3f4f6" }}
                >
                  <IconFlask />
                </div>
                <p className="font-semibold text-gray-800">
                  Nenhum exame encontrado
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Ajuste os filtros ou crie um novo exame personalizado.
                </p>
              </div>
            ) : (
              (() => {
                const bycat = allItems.reduce<Record<string, typeof allItems>>(
                  (acc, item) => {
                    if (!acc[item.cat]) acc[item.cat] = [];
                    acc[item.cat].push(item);
                    return acc;
                  },
                  {},
                );
                return (
                  <div>
                    {Object.entries(bycat).map(([cat, items]) => (
                      <div key={cat}>
                        {/* Category header */}
                        <div
                          className="flex items-center gap-2 border-y px-5 py-2"
                          style={{
                            borderColor: `${CORES.teal}33`,
                            backgroundColor: "#e6f4f6",
                          }}
                        >
                          <span
                            className="text-xs font-bold uppercase tracking-wide"
                            style={{ color: CORES.teal }}
                          >
                            {cat}
                          </span>
                          <span
                            className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: CORES.teal }}
                          >
                            {items.length}
                          </span>
                        </div>
                        {/* Exam rows */}
                        <div
                          className="divide-y"
                          style={{ borderColor: CORES.borda }}
                        >
                          {items.map((item, i) => {
                            const codigo = refByNome.get(
                              item.nome.toLowerCase().trim(),
                            );
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#fafbfc]"
                              >
                                {/* Código do produto */}
                                <div className="w-16 shrink-0 text-right">
                                  {codigo ? (
                                    <span
                                      className="inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold"
                                      style={{
                                        backgroundColor: `${CORES.teal}15`,
                                        color: CORES.teal,
                                        borderColor: `${CORES.teal}33`,
                                      }}
                                    >
                                      {codigo}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-300">
                                      —
                                    </span>
                                  )}
                                </div>
                                {/* Nome + contagem de params */}
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-800">
                                    {item.nome}
                                  </span>
                                  <span className="shrink-0 rounded-sm bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                    {item.params.length} param.
                                  </span>
                                </div>
                                {/* Tipo badge */}
                                <span
                                  className="shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                                  style={{
                                    backgroundColor:
                                      item.tipo === "Padrão"
                                        ? CORES.navy
                                        : CORES.oliva,
                                  }}
                                >
                                  {item.tipo}
                                </span>
                                {/* Ações */}
                                <div className="flex shrink-0 gap-1.5">
                                  <button
                                    onClick={() => handleEditar(item)}
                                    className={`${btnOutline} flex items-center gap-1.5`}
                                    style={
                                      item.tipo === "Personalizado"
                                        ? {
                                            borderColor: CORES.teal,
                                            color: CORES.teal,
                                          }
                                        : { borderColor: "#d1d5db" }
                                    }
                                  >
                                    <IconEdit />{" "}
                                    {item.tipo === "Personalizado"
                                      ? "Editar"
                                      : "Ver"}
                                  </button>
                                  {item.tipo === "Personalizado" && (
                                    <button
                                      onClick={() => handleRemover(item)}
                                      className={`${btnRed} flex items-center gap-1.5`}
                                      style={{
                                        borderColor: CORES.vermelho,
                                        color: CORES.vermelho,
                                      }}
                                    >
                                      <IconTrash /> Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  VIEW: EDITOR                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === "editor" && (
        <div className="mx-auto max-w-2xl">
          <div className="rounded-sm border bg-white" style={BD}>
            <CardHeader
              num="1"
              title={
                isEditingCustom ? "Editar Exame" : "Novo Exame Personalizado"
              }
            />
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Categoria *">
                  <select
                    value={editCat}
                    onChange={(e) => {
                      setEditCat(e.target.value);
                      setEditCatCustom("");
                    }}
                    className={inputCls}
                  >
                    <option value="">— Nova categoria —</option>
                    {CATS_BUILTIN.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {!editCat && (
                    <input
                      value={editCatCustom}
                      onChange={(e) => setEditCatCustom(e.target.value)}
                      placeholder="Nome da nova categoria"
                      className={`${inputCls} mt-2`}
                    />
                  )}
                </Field>
                <Field label="Nome do Exame *">
                  <input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className={inputCls}
                    placeholder="Ex: Glicemia em Jejum"
                  />
                </Field>
              </div>

              <div>
                <span className={labelCls}>Parâmetros</span>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <div>Parâmetro</div>
                    <div>Unidade</div>
                    <div>Referência</div>
                  </div>
                  {editParams.map((p, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2">
                      <input
                        value={p.param}
                        onChange={(e) => {
                          const ps = [...editParams];
                          ps[i] = { ...p, param: e.target.value };
                          setEditParams(ps);
                        }}
                        className={inputCls}
                        placeholder="Ex: Glicose"
                      />
                      <input
                        value={p.unidade}
                        onChange={(e) => {
                          const ps = [...editParams];
                          ps[i] = { ...p, unidade: e.target.value };
                          setEditParams(ps);
                        }}
                        className={inputCls}
                        placeholder="mg/dL"
                      />
                      <input
                        value={p.referencia}
                        onChange={(e) => {
                          const ps = [...editParams];
                          ps[i] = { ...p, referencia: e.target.value };
                          setEditParams(ps);
                        }}
                        className={inputCls}
                        placeholder="70-110"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditParams([...editParams, emptyParam()])}
                    className="mt-1 flex items-center gap-1.5 text-xs font-bold hover:underline"
                    style={{ color: CORES.teal }}
                  >
                    <IconPlus /> Adicionar parâmetro
                  </button>
                </div>
              </div>

              {msg && (
                <div
                  className="flex items-center gap-2 rounded-sm px-3 py-2 text-xs"
                  style={
                    msg.ok
                      ? { backgroundColor: "#eaf5ee", color: CORES.verdeEscuro }
                      : { backgroundColor: "#fbeaea", color: CORES.vermelho }
                  }
                >
                  {msg.ok ? <IconCheck /> : <IconAlert />} {msg.text}
                </div>
              )}

              <div className="flex gap-3 border-t pt-4" style={BD}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`${btnTeal} flex items-center gap-2`}
                  style={{ backgroundColor: CORES.verdeEscuro }}
                >
                  <IconSave />{" "}
                  {saving
                    ? "A guardar..."
                    : isEditingCustom
                      ? "Guardar Alterações"
                      : "Criar Exame"}
                </button>
                <button
                  onClick={() => setView("lista")}
                  className={btnOutline}
                  style={{ borderColor: "#d1d5db" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  MODAL: SINCRONIZAR PRODUTOS                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {syncOpen && (
        <Modal
          title="Sincronizar com Lista de Produtos"
          subtitle="Importar apenas produtos activos como exames personalizados (quando ainda não existem)"
          onClose={() => !syncSaving && setSyncOpen(false)}
          maxW="max-w-2xl"
          footer={
            syncItems.length > 0 && !syncLoading ? (
              <>
                <button
                  onClick={() => setSyncOpen(false)}
                  disabled={syncSaving}
                  className={btnOutline}
                  style={{ borderColor: "#d1d5db" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportar}
                  disabled={syncSaving || syncSelected.size === 0}
                  className={`${btnTeal} flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
                  style={{ backgroundColor: CORES.teal }}
                >
                  {syncSaving ? (
                    "A importar..."
                  ) : (
                    <>
                      <IconCheck /> Importar {syncSelected.size} exame(s)
                    </>
                  )}
                </button>
              </>
            ) : undefined
          }
        >
          {syncError && (
            <p
              role="alert"
              className="m-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {syncError}
            </p>
          )}
          <p className="mx-5 mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Os parâmetros e intervalos de referência existentes no catálogo serão sugeridos. Para exames novos, a referência fica por validar: o Director Técnico deve preencher e confirmar unidades, método, equipamento e intervalos aplicáveis antes da emissão clínica.
          </p>
          {syncLoading ? (
            <div className="py-16 text-center">
              <div
                className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: CORES.teal }}
              />
              <p
                className="text-sm font-semibold"
                style={{ color: CORES.teal }}
              >
                A carregar produtos...
              </p>
            </div>
          ) : syncItems.length === 0 && !syncError ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: "#eaf5ee", color: CORES.verdeEscuro }}
              >
                <IconSync />
              </div>
              <p className="font-semibold text-gray-800">Tudo sincronizado</p>
              <p className="text-sm text-gray-500">
                Todos os produtos já existem como exames.
              </p>
            </div>
          ) : (
            <>
              {/* Controlos */}
              <div
                className="flex flex-wrap items-center gap-3 border-b px-5 py-3"
                style={BD}
              >
                <span className="text-xs text-gray-500">
                  {syncItems.length} produto(s) disponíveis
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSyncSelected(new Set(syncItems.map((i) => i.key)))
                    }
                    className="text-xs font-bold hover:underline"
                    style={{ color: CORES.teal }}
                  >
                    Seleccionar todos
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setSyncSelected(new Set())}
                    className="text-xs font-bold text-gray-500 hover:underline"
                  >
                    Desmarcar todos
                  </button>
                  <span
                    className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: CORES.teal }}
                  >
                    {syncSelected.size} seleccionados
                  </span>
                </div>
              </div>

              {/* Lista */}
              <div
                className="max-h-96 divide-y overflow-y-auto"
                style={{ borderColor: CORES.borda }}
              >
                {syncItems.map((item) => {
                  const checked = syncSelected.has(item.key);
                  return (
                    <label
                      key={item.key}
                      className={`flex cursor-pointer items-center gap-3 px-5 py-2.5 transition ${checked ? "hover:bg-[#fafbfc]" : "opacity-50 hover:bg-[#fafbfc]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSyncSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.key)) next.delete(item.key);
                            else next.add(item.key);
                            return next;
                          })
                        }
                        className="h-4 w-4 shrink-0 accent-[#0d7a8a]"
                      />
                      <span
                        className="w-14 shrink-0 rounded-sm border px-1.5 py-0.5 text-center font-mono text-[10px] font-bold"
                        style={{
                          backgroundColor: `${CORES.teal}15`,
                          color: CORES.teal,
                          borderColor: `${CORES.teal}33`,
                        }}
                      >
                        {item.codigo || "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-gray-800">
                          {item.nome}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.categoria}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Rodapé info */}
              <div
                className="flex items-center gap-2 border-t px-5 py-3 text-xs"
                style={{
                  borderColor: `${CORES.oliva}55`,
                  backgroundColor: "#fdfbea",
                  color: CORES.oliva,
                }}
              >
                <IconAlert /> Importados como exames personalizados — podes
                editar os parâmetros depois.
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

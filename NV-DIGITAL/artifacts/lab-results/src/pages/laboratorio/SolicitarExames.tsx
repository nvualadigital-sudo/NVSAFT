import { useState, useCallback, useEffect, useMemo } from "react";
import { useApp } from "../../store/AppContext";
import { api } from "../../store/api";
import { Session } from "../../store/auth";
import { EXAMES_BUILTIN } from "../../data/exames";
import { normalizeExamName } from "../../utils/catalogImport";

// Configuração visual dos estados
const ESTADO_CFG: Record<string, { label: string; cls: string }> = {
  pendente: {
    label: "Pendente",
    cls: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  em_processo: {
    label: "Em Processo",
    cls: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  concluido: {
    label: "Concluído",
    cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    cls: "bg-red-50 text-red-600 border border-red-200",
  },
};

// Ícones SVG (Componentes reutilizáveis)
const IconPlus = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const IconSearch = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
const IconTrash = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);
const IconSave = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
);
const IconX = () => (
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
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
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
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);
const IconList = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

export default function SolicitarExames({ session }: { session?: Session }) {
  const { data } = useApp();

  // Construção do catálogo de exames (Builtin + Customizados)
  const allExames = useMemo(() => {
    const merged: Record<string, Record<string, true>> = {};
    const enabled = new Set(data.produtos.filter((p) => p.ativo).map((p) => normalizeExamName(p.nome)));

    // Adiciona exames nativos
    for (const [cat, sub] of Object.entries(EXAMES_BUILTIN)) {
      merged[cat] = merged[cat] || {};
      for (const nome of Object.keys(sub)) if (enabled.has(normalizeExamName(nome))) merged[cat][nome] = true;
    }

    // Adiciona exames customizados do banco
    for (const ex of data.examesCustomRaw ?? []) {
      const cat = ex.categoria || "Outros";
      merged[cat] = merged[cat] || {};
      if (enabled.has(normalizeExamName(ex.nome))) merged[cat][ex.nome] = true;
    }
    return merged;
  }, [data.examesCustomRaw, data.produtos]);

  // Controle de Visualização (Lista vs Formulário)
  const [view, setView] = useState<"lista" | "form">("lista");

  // ── Estados da Lista de Pedidos ────────────────────────────────────────────
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [successMsg, setSuccessMsg] = useState("");

  const loadPedidos = useCallback(async () => {
    setLoadingLista(true);
    try {
      // Busca os pedidos do médico logado na API
      const lista = await api.solicitacoes.listMedico();
      setPedidos(lista);
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
    } finally {
      setLoadingLista(false);
    }
  }, []);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  // ── Estados do Formulário ──────────────────────────────────────────────────
  const [pacSearch, setPacSearch] = useState("");
  const [selectedPac, setSelectedPac] = useState<any | null>(null);

  // Dados para preenchimento manual
  const [manualData, setManualData] = useState({
    code: "",
    name: "",
    nasc: "",
    sexo: "M",
    bi: "",
    tel: "",
  });
  const [useManual, setUseManual] = useState(false);

  // Carrinho de Exames
  const [selectedExames, setSelectedExames] = useState<Set<string>>(new Set());
  const [exSearch, setExSearch] = useState(""); // Termo de busca no select

  // Outros campos
  const [urgente, setUrgente] = useState(false);
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [medicoId, setMedicoId] = useState("");

  // Filtro de Pacientes (Busca dinâmica)
  const filteredPacs = useMemo(() => {
    const q = pacSearch.toLowerCase().trim();
    if (!q) return data.pacientes.slice(0, 8);
    return data.pacientes
      .filter(
        (p) =>
          p.nome?.toLowerCase().includes(q) || p.bi?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [data.pacientes, pacSearch]);

  // Filtro de Exames (Busca dinâmica dentro das categorias)
  const filteredExames = useMemo(() => {
    const q = exSearch.toLowerCase().trim();
    if (!q) return allExames;
    const result: Record<string, Record<string, true>> = {};
    for (const [cat, sub] of Object.entries(allExames)) {
      const names = Object.keys(sub).filter(
        (n) => n.toLowerCase().includes(q) || cat.toLowerCase().includes(q),
      );
      if (names.length > 0) {
        result[cat] = {};
        names.forEach((n) => (result[cat][n] = true));
      }
    }
    return result;
  }, [allExames, exSearch]);

  // Funções Auxiliares do Formulário
  function toggleExame(nome: string) {
    setSelectedExames((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  function resetForm() {
    setPacSearch("");
    setSelectedPac(null);
    setUseManual(false);
    setManualData({ code: "", name: "", nasc: "", sexo: "M", bi: "", tel: "" });
    setSelectedExames(new Set());
    setExSearch("");
    setUrgente(false);
    setObs("");
    setFormError("");
    setMedicoId("");
  }

  async function handleSubmit() {
    const nome = useManual ? manualData.name.trim() : selectedPac?.nome;

    // Validações básicas
    if (!nome) {
      setFormError("Seleccione ou preencha o paciente.");
      return;
    }
    if (selectedExames.size === 0) {
      setFormError("Adicione pelo menos um exame à lista.");
      return;
    }

    setFormError("");
    setSubmitting(true);

    try {
      await api.solicitacoes.createInterno({
        pacienteNome: nome,
        pacienteNascimento: useManual
          ? manualData.nasc
          : selectedPac?.dataNascimento || "",
        pacienteSexo: useManual ? manualData.sexo : selectedPac?.sexo || "",
        pacienteTelefone: useManual
          ? manualData.tel
          : selectedPac?.telefone || "",
        pacienteBi: useManual ? manualData.bi : selectedPac?.bi || "",
        examesSolicitados: [...selectedExames],
        urgente,
        observacoes: obs,
        medicoId: medicoId || undefined,
      });

      setSuccessMsg(`Pedido enviado com sucesso para ${nome}.`);
      resetForm();
      setView("lista");
      loadPedidos(); // Recarrega a lista
    } catch (e: any) {
      setFormError(e?.message || "Erro de conexão ao enviar pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── RENDERIZAÇÃO: VIEW DE LISTA ────────────────────────────────────────────
  if (view === "lista") {
    const pedidosFiltrados = pedidos.filter(
      (p) => filtro === "todos" || p.estado === filtro,
    );

    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto bg-gray-50 min-h-screen font-sans">
        {/* Cabeçalho Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Solicitação de Exames
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie e acompanhe seus pedidos de laboratório
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setView("form");
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium transition-all hover:shadow-md active:scale-95"
            style={{
              background:
                "linear-gradient(135deg, hsl(258 70% 55%), hsl(258 70% 45%))",
            }}
          >
            <IconPlus /> Novo Pedido
          </button>
        </div>

        {/* Mensagem de Sucesso */}
        {successMsg && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium animate-fade-in">
            <IconCheck />
            <span className="flex-1">{successMsg}</span>
            <button
              onClick={() => setSuccessMsg("")}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <IconX />
            </button>
          </div>
        )}

        {/* Abas de Filtro */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { key: "todos", label: "Todos" },
            { key: "pendente", label: "Pendentes" },
            { key: "em_processo", label: "Em Processo" },
            { key: "concluido", label: "Concluídos" },
            { key: "cancelado", label: "Cancelados" },
          ].map(({ key, label }) => {
            const count =
              key === "todos"
                ? pedidos.length
                : pedidos.filter((p) => p.estado === key).length;
            const isActive = filtro === key;
            return (
              <button
                key={key}
                onClick={() => setFiltro(key)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                  isActive
                    ? "bg-gray-900 text-white border-gray-900 shadow-md"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                {label}{" "}
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-white/20" : "bg-gray-100"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Conteúdo da Lista */}
        {loadingLista ? (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            Carregando pedidos...
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl py-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
              <IconList />
            </div>
            <p className="text-gray-900 font-semibold">
              Nenhum pedido encontrado
            </p>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              {filtro === "todos"
                ? "Comece criando sua primeira solicitação."
                : `Não há pedidos com status "${ESTADO_CFG[filtro]?.label}".`}
            </p>
            {filtro === "todos" && (
              <button
                onClick={() => {
                  resetForm();
                  setView("form");
                }}
                className="text-sm font-semibold px-5 py-2 rounded-xl text-white hover:opacity-90 transition"
                style={{ background: "hsl(258 70% 55%)" }}
              >
                Criar primeiro pedido
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {pedidosFiltrados.map((ped) => {
              const estadoCfg = ESTADO_CFG[ped.estado] ?? {
                label: ped.estado,
                cls: "bg-gray-100 text-gray-600 border border-gray-200",
              };
              return (
                <div
                  key={ped.id}
                  className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 bg-indigo-50 text-indigo-600">
                      {ped.pacienteNome?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-gray-900 text-base">
                          {ped.pacienteNome}
                        </span>
                        {ped.urgente && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase tracking-wide">
                            Urgente
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${estadoCfg.cls}`}
                        >
                          {estadoCfg.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 font-medium mb-3">
                        {ped.data} {ped.hora ? `· ${ped.hora}` : ""}
                      </div>

                      {/* Tags de Exames */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(ped.examesSolicitados || [])
                          .slice(0, 4)
                          .map((e: string) => (
                            <span
                              key={e}
                              className="text-xs px-2.5 py-1 rounded-md bg-gray-50 text-gray-600 border border-gray-100 font-medium"
                            >
                              {e}
                            </span>
                          ))}
                        {(ped.examesSolicitados || []).length > 4 && (
                          <span className="text-xs px-2 py-1 rounded-md bg-gray-50 text-gray-400 border border-gray-100">
                            +{(ped.examesSolicitados || []).length - 4} mais
                          </span>
                        )}
                      </div>

                      {ped.observacoes && (
                        <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg border border-gray-100">
                          "{ped.observacoes}"
                        </p>
                      )}

                      {ped.estado === "concluido" && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
                          <IconCheck /> Resultados disponíveis
                        </div>
                      )}
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

  // ── RENDERIZAÇÃO: VIEW DE FORMULÁRIO ───────────────────────────────────────
  const pacNome = useManual ? manualData.name.trim() : selectedPac?.nome;
  const canSubmit = !!pacNome && selectedExames.size > 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen font-sans">
      {/* Header do Formulário */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => {
            resetForm();
            setView("lista");
          }}
          className="text-sm text-gray-500 hover:text-gray-900 font-medium flex items-center gap-1 transition-colors"
        >
          ← Voltar para lista
        </button>
        <h2 className="text-xl font-bold text-gray-900">Nova Requisição</h2>
      </div>

      {formError && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Dados do Paciente e Médico */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card Paciente */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                  1
                </span>
                Identificação do Paciente
              </h3>
              <button
                onClick={() => {
                  setUseManual((v) => !v);
                  setSelectedPac(null);
                  setPacSearch("");
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {useManual ? "Buscar no sistema" : "+ Preencher manualmente"}
              </button>
            </div>

            <div className="p-6 space-y-5">
              {!useManual ? (
                <>
                  <div className="relative group">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Buscar Paciente
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <IconSearch />
                      </div>
                      <input
                        value={pacSearch}
                        onChange={(e) => {
                          setPacSearch(e.target.value);
                          setSelectedPac(null);
                        }}
                        className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50 focus:bg-white"
                        placeholder="Digite nome ou BI..."
                      />
                    </div>

                    {/* Dropdown de Sugestões */}
                    {!selectedPac && pacSearch && filteredPacs.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                        {filteredPacs.map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedPac(p);
                              setPacSearch(p.nome);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition flex items-center gap-3 border-b border-gray-50 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                              {p.nome?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">
                                {p.nome}
                              </div>
                              <div className="text-xs text-gray-500">
                                {p.bi ? `BI: ${p.bi}` : p.dataNascimento}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Resumo do Paciente Selecionado */}
                  {selectedPac && (
                    <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                        {selectedPac.nome?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900">
                          {selectedPac.nome}
                        </div>
                        <div className="text-xs text-gray-500">
                          BI: {selectedPac.bi || "N/A"} · Nasc:{" "}
                          {selectedPac.dataNascimento}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPac(null);
                          setPacSearch("");
                        }}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <IconX />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                // Formulário Manual
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Nome Completo *
                    </label>
                    <input
                      value={manualData.name}
                      onChange={(e) =>
                        setManualData({ ...manualData, name: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Data Nascimento
                    </label>
                    <input
                      value={manualData.nasc}
                      onChange={(e) =>
                        setManualData({ ...manualData, nasc: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Sexo
                    </label>
                    <select
                      value={manualData.sexo}
                      onChange={(e) =>
                        setManualData({ ...manualData, sexo: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      BI / ID
                    </label>
                    <input
                      value={manualData.bi}
                      onChange={(e) =>
                        setManualData({ ...manualData, bi: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Telefone
                    </label>
                    <input
                      value={manualData.tel}
                      onChange={(e) =>
                        setManualData({ ...manualData, tel: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card Médico */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                  2
                </span>
                Médico Solicitante
              </h3>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Selecione o Médico
              </label>
              <select
                value={medicoId}
                onChange={(e) => setMedicoId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              >
                <option value="">Selecione o Médico Desejado...</option>
                {/* Aqui você pode mapear data.medicos se existir */}
                <option value="1">Dr. Silva (Cardiologia)</option>
                <option value="2">Dra. Santos (Clínica Geral)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Seleção de Exames e Resumo */}
        <div className="space-y-6">
          {/* Card Adicionar Exames */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                  3
                </span>
                Exames
              </h3>
              {selectedExames.size > 0 && (
                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700">
                  {selectedExames.size} item(s)
                </span>
              )}
            </div>

            {/* Área de Busca e Adição Rápida */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Adicionar Exame
              </label>
              <div className="flex gap-2">
                <select
                  value={exSearch}
                  onChange={(e) => setExSearch(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">Selecione...</option>
                  {Object.entries(filteredExames).flatMap(([cat, subs]) =>
                    Object.keys(subs).map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    )),
                  )}
                </select>
                <button
                  onClick={() => {
                    if (exSearch) {
                      toggleExame(exSearch);
                      setExSearch("");
                    }
                  }}
                  disabled={!exSearch}
                  className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <IconPlus />
                </button>
              </div>
            </div>

            {/* Tabela de Itens Selecionados (Carrinho) */}
            <div className="flex-1 overflow-y-auto max-h-[400px] p-0">
              {selectedExames.size === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-sm italic">
                  Nenhum exame adicionado
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-gray-50">
                    {[...selectedExames].map((ex) => (
                      <tr
                        key={ex}
                        className="group hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {ex}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => toggleExame(ex)}
                            className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <IconTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rodapé do Card com Ações Finais */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  onClick={() => setUrgente((v) => !v)}
                  className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${urgente ? "bg-red-500" : "bg-gray-300"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${urgente ? "translate-x-4" : ""}`}
                  />
                </div>
                <span
                  className={`text-sm font-bold ${urgente ? "text-red-600" : "text-gray-500"}`}
                >
                  Marcar como Urgente
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Observações Clínicas
                </label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  placeholder="Justificativa clínica..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setSelectedExames(new Set())}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-sm font-bold transition-colors"
                >
                  <IconTrash /> Limpar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold shadow-sm transition-all active:scale-95"
                >
                  {submitting ? (
                    "Enviando..."
                  ) : (
                    <>
                      <IconSave /> Salvar Pedido
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

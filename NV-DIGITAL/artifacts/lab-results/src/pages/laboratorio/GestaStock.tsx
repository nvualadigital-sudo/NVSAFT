import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "../../store/api";
import type { Session } from "../../store/auth";
import { EXAMES_BUILTIN } from "../../data/exames";

interface Reagente {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  tipo: string;
  unidade: string;
  quantidadeAtual: number;
  quantidadeMinima: number;
  lote: string;
  validade: string;
  fornecedor: string;
  localizacao: string;
  observacoes: string;
  ativo: boolean;
}

interface StockMovimento {
  id: number;
  reagenteId: number;
  tipo: string;
  quantidade: number;
  lote: string;
  validade: string;
  motivo: string;
  data: string;
  registadoPor: string;
}

const CATEGORIAS = [
  "Hematologia",
  "Bioquímica",
  "Imunologia / Serologia",
  "Hormonas / Endocrinologia",
  "Microbiologia",
  "Coagulação",
  "Parasitologia",
  "Uroanálise",
  "Marcadores Tumorais",
  "Marcadores Cardíacos",
  "Biologia Molecular",
  "Material Consumível",
  "Outro",
];

const CAT_MAP: Record<string, string> = {
  "Função Tiroideia": "Hormonas / Endocrinologia",
  "iChroma I — Tiróide": "Hormonas / Endocrinologia",
  "iChroma II — Cardíaco/Anemia": "Marcadores Cardíacos",
  "iChroma III — Hormonal": "Hormonas / Endocrinologia",
  "Análise de Urina": "Uroanálise",
  "Microbiologia / Bacteriologia": "Microbiologia",
  "Parasitologia / Coprologia": "Parasitologia",
  "Genética / Biologia Molecular": "Biologia Molecular",
  "Toxicologia / Drogas": "Outro",
  "Consulta Médica": "Outro",
  Ecografia: "Outro",
  Radiografia: "Outro",
  Electrocardiograma: "Outro",
  "Taxa de Urgência": "Material Consumível",
  "Taxa de Colheita": "Material Consumível",
  "Material de Consumo": "Material Consumível",
  "Serviço Hospitalar": "Outro",
};

function mapCategoria(cat: string): string {
  if (CATEGORIAS.includes(cat)) return cat;
  return CAT_MAP[cat] || "Outro";
}

interface SyncItem {
  key: string;
  nome: string;
  categoria: string;
  fonte: "produto" | "exame";
}

const UNIDADES = [
  "unidades",
  "frascos",
  "caixas",
  "ampolas",
  "kits",
  "litros",
  "ml",
  "g",
  "mg",
  "tiras",
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function diasParaVencer(validade: string): number | null {
  if (!validade) return null;
  const diff = new Date(validade).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function StatusBadge({ reagente }: { reagente: Reagente }) {
  if (!reagente.ativo)
    return (
      <span className="badge text-xs bg-gray-100 text-gray-500 border border-gray-200">
        Inactivo
      </span>
    );
  const dias = diasParaVencer(reagente.validade);
  if (dias !== null && dias < 0)
    return (
      <span className="badge text-xs bg-red-50 text-red-700 border border-red-200">
        Vencido
      </span>
    );
  if (dias !== null && dias <= 30)
    return (
      <span className="badge text-xs bg-amber-50 text-amber-700 border border-amber-200">
        A vencer
      </span>
    );
  if (reagente.quantidadeAtual <= 0)
    return (
      <span className="badge text-xs bg-red-50 text-red-700 border border-red-200">
        Sem stock
      </span>
    );
  if (reagente.quantidadeAtual <= reagente.quantidadeMinima)
    return (
      <span className="badge text-xs bg-orange-50 text-orange-700 border border-orange-200">
        Stock baixo
      </span>
    );
  return (
    <span className="badge text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
      Normal
    </span>
  );
}

const emptyForm: Omit<Reagente, "id"> = {
  codigo: "",
  nome: "",
  categoria: "Bioquímica",
  tipo: "reagente",
  unidade: "frascos",
  quantidadeAtual: 0,
  quantidadeMinima: 0,
  lote: "",
  validade: "",
  fornecedor: "",
  localizacao: "",
  observacoes: "",
  ativo: true,
};

export default function GestaStock({ session }: { session?: Session }) {
  const [tab, setTab] = useState<"reagentes" | "movimentos">("reagentes");
  const [reagentes, setReagentes] = useState<Reagente[]>([]);
  const [movimentos, setMovimentos] = useState<StockMovimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Reagente | null>(null);
  const [form, setForm] = useState<Omit<Reagente, "id">>(emptyForm);
  const [deletandoId, setDeletandoId] = useState<number | null>(null);

  const [movModalOpen, setMovModalOpen] = useState(false);
  const [movReagente, setMovReagente] = useState<Reagente | null>(null);
  const [movForm, setMovForm] = useState({
    tipo: "entrada",
    quantidade: 0,
    lote: "",
    validade: "",
    motivo: "",
    data: todayStr(),
  });

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [syncSelected, setSyncSelected] = useState<Set<string>>(new Set());
  const [syncFonte, setSyncFonte] = useState<"todos" | "produto" | "exame">(
    "todos",
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        api.reagentes.list(),
        api.stockMovimentos.list(),
      ]);
      setReagentes(r);
      setMovimentos(m);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  const filtered = useMemo(() => {
    return reagentes.filter((r) => {
      if (filtroCategoria !== "todas" && r.categoria !== filtroCategoria)
        return false;
      if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
      if (filtroStatus !== "todos") {
        const dias = diasParaVencer(r.validade);
        if (
          filtroStatus === "baixo" &&
          !(r.quantidadeAtual > 0 && r.quantidadeAtual <= r.quantidadeMinima)
        )
          return false;
        if (filtroStatus === "critico" && r.quantidadeAtual > 0) return false;
        if (filtroStatus === "vencido" && !(dias !== null && dias < 0))
          return false;
        if (
          filtroStatus === "avencer" &&
          !(dias !== null && dias >= 0 && dias <= 30)
        )
          return false;
      }
      if (busca) {
        const q = busca.toLowerCase();
        return (
          r.nome.toLowerCase().includes(q) ||
          r.codigo.toLowerCase().includes(q) ||
          r.fornecedor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reagentes, filtroCategoria, filtroTipo, filtroStatus, busca]);

  // Stats
  const totalAtivos = reagentes.filter((r) => r.ativo).length;
  const stockCritico = reagentes.filter(
    (r) => r.ativo && r.quantidadeAtual <= 0,
  ).length;
  const stockBaixo = reagentes.filter(
    (r) =>
      r.ativo &&
      r.quantidadeAtual > 0 &&
      r.quantidadeAtual <= r.quantidadeMinima,
  ).length;
  const hoje = todayStr();
  const aVencer = reagentes.filter((r) => {
    const dias = diasParaVencer(r.validade);
    return r.ativo && dias !== null && dias >= 0 && dias <= 30;
  }).length;
  const movHoje = movimentos.filter((m) => m.data === hoje).length;

  function openNovo() {
    setEditando(null);
    setForm({
      ...emptyForm,
      codigo: "REA-" + String(reagentes.length + 1).padStart(3, "0"),
    });
    setErr("");
    setModalOpen(true);
  }

  function openEditar(r: Reagente) {
    setEditando(r);
    setForm({
      codigo: r.codigo,
      nome: r.nome,
      categoria: r.categoria,
      tipo: r.tipo,
      unidade: r.unidade,
      quantidadeAtual: r.quantidadeAtual,
      quantidadeMinima: r.quantidadeMinima,
      lote: r.lote,
      validade: r.validade,
      fornecedor: r.fornecedor,
      localizacao: r.localizacao,
      observacoes: r.observacoes,
      ativo: r.ativo,
    });
    setErr("");
    setModalOpen(true);
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      setErr("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (editando) {
        await api.reagentes.update(editando.id, form);
        showSuccess(`Reagente "${form.nome}" actualizado com sucesso.`);
      } else {
        await api.reagentes.create(form);
        showSuccess(`Reagente "${form.nome}" criado com sucesso.`);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setErr(e.message || "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: number) {
    setSaving(true);
    try {
      await api.reagentes.delete(id);
      setDeletandoId(null);
      await load();
      showSuccess("Reagente eliminado.");
    } catch {
      setErr("Erro ao eliminar.");
    } finally {
      setSaving(false);
    }
  }

  function openMovimento(r: Reagente) {
    setMovReagente(r);
    setMovForm({
      tipo: "entrada",
      quantidade: 0,
      lote: r.lote,
      validade: r.validade,
      motivo: "",
      data: todayStr(),
    });
    setMovModalOpen(true);
  }

  async function handleSalvarMovimento() {
    if (!movReagente) return;
    if (!movForm.quantidade || movForm.quantidade <= 0) {
      setErr("Quantidade deve ser maior que zero.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.stockMovimentos.create({
        reagenteId: movReagente.id,
        tipo: movForm.tipo,
        quantidade: movForm.quantidade,
        lote: movForm.lote,
        validade: movForm.validade,
        motivo: movForm.motivo,
        data: movForm.data,
        registadoPor: session?.funcionarioNome || session?.username || "",
      });
      const tipoLabel =
        movForm.tipo === "entrada"
          ? "Entrada"
          : movForm.tipo === "saida"
            ? "Saída"
            : "Ajuste";
      showSuccess(
        `${tipoLabel} de ${movForm.quantidade} ${movReagente.unidade} registada para "${movReagente.nome}".`,
      );
      setMovModalOpen(false);
      await load();
    } catch (e: any) {
      setErr(e.message || "Erro ao registar movimento.");
    } finally {
      setSaving(false);
    }
  }

  const movimentosComNome = useMemo(() => {
    return movimentos
      .map((m) => ({
        ...m,
        reagenteNome:
          reagentes.find((r) => r.id === m.reagenteId)?.nome ||
          `#${m.reagenteId}`,
        reagenteUnidade:
          reagentes.find((r) => r.id === m.reagenteId)?.unidade || "",
      }))
      .sort((a, b) => b.id - a.id);
  }, [movimentos, reagentes]);

  async function openSincronizar() {
    setSyncLoading(true);
    setSyncOpen(true);
    setSyncFonte("todos");
    try {
      const [produtos, examesCustomRaw] = await Promise.all([
        api.produtos.list(),
        api.examesCustom.list(),
      ]);

      const nomesExistentes = new Set(
        reagentes.map((r) => r.nome.toLowerCase().trim()),
      );

      const items: SyncItem[] = [];
      const seen = new Set<string>();

      // From produtos
      for (const p of produtos) {
        const key = p.nome.toLowerCase().trim();
        if (!nomesExistentes.has(key) && !seen.has(key)) {
          seen.add(key);
          items.push({
            key: `prod:${p.id}`,
            nome: p.nome,
            categoria: mapCategoria(p.categoria || ""),
            fonte: "produto",
          });
        }
      }

      // From EXAMES_BUILTIN
      for (const [cat, subs] of Object.entries(EXAMES_BUILTIN)) {
        for (const nome of Object.keys(subs)) {
          const key = nome.toLowerCase().trim();
          if (!nomesExistentes.has(key) && !seen.has(key)) {
            seen.add(key);
            items.push({
              key: `builtin:${cat}:${nome}`,
              nome,
              categoria: mapCategoria(cat),
              fonte: "exame",
            });
          }
        }
      }

      // From examesCustom
      for (const row of examesCustomRaw) {
        const nome = row.nome || "";
        const key = nome.toLowerCase().trim();
        if (!nomesExistentes.has(key) && !seen.has(key)) {
          seen.add(key);
          items.push({
            key: `custom:${row.id}`,
            nome,
            categoria: mapCategoria(row.categoria || ""),
            fonte: "exame",
          });
        }
      }

      setSyncItems(items);
      setSyncSelected(new Set(items.map((i) => i.key)));
    } catch {
      setSyncItems([]);
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleImportarSelecionados() {
    const toImport = syncItems.filter((i) => syncSelected.has(i.key));
    if (toImport.length === 0) return;
    setSaving(true);
    setErr("");
    let count = 0;
    let base = reagentes.length;
    for (const item of toImport) {
      try {
        await api.reagentes.create({
          codigo: "REA-" + String(base + 1).padStart(3, "0"),
          nome: item.nome,
          categoria: item.categoria,
          tipo: "reagente",
          unidade: "frascos",
          quantidadeAtual: 0,
          quantidadeMinima: 0,
          lote: "",
          validade: "",
          fornecedor: "",
          localizacao: "",
          observacoes: "",
          ativo: true,
        });
        base++;
        count++;
      } catch {}
    }
    setSaving(false);
    setSyncOpen(false);
    await load();
    showSuccess(`${count} reagente(s) importado(s) com sucesso.`);
  }

  const syncFiltered = useMemo(() => {
    if (syncFonte === "todos") return syncItems;
    return syncItems.filter((i) => i.fonte === syncFonte);
  }, [syncItems, syncFonte]);

  function toggleSyncItem(key: string) {
    setSyncSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllFiltered(select: boolean) {
    setSyncSelected((prev) => {
      const next = new Set(prev);
      syncFiltered.forEach((i) =>
        select ? next.add(i.key) : next.delete(i.key),
      );
      return next;
    });
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "hsl(258 70% 55%)" }}
          >
            Stock de Reagentes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestão de reagentes e materiais do laboratório
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openSincronizar}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-border bg-white hover:bg-secondary/60 transition text-foreground"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 014-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            Sincronizar
          </button>
          <button
            onClick={openNovo}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
            style={{ background: "hsl(258 70% 55%)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo Reagente
          </button>
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="shrink-0 text-emerald-600"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="flex-1">{successMsg}</span>
          <button
            onClick={() => setSuccessMsg("")}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Activos",
            value: totalAtivos,
            sub: "reagentes e materiais",
            icon: (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path d="M9 3v11a6 6 0 006-6V3" />
                <line x1="6" y1="3" x2="18" y2="3" />
                <path d="M5 21h14" />
              </svg>
            ),
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
          {
            label: "Stock Crítico",
            value: stockCritico,
            sub: "sem stock disponível",
            icon: (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ),
            color: "text-red-600",
            bg: "bg-red-50",
          },
          {
            label: "Stock Baixo",
            value: stockBaixo,
            sub: "abaixo do mínimo",
            icon: (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ),
            color: "text-orange-600",
            bg: "bg-orange-50",
          },
          {
            label: "A Vencer (30d)",
            value: aVencer,
            sub: "expiram em breve",
            icon: (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            ),
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-white border border-border rounded-xl p-4 flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg} ${c.color}`}
            >
              {c.icon}
            </div>
            <div>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground font-medium">
                {c.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: "reagentes", label: "Reagentes & Materiais" },
          {
            key: "movimentos",
            label: `Movimentos${movHoje > 0 ? ` (${movHoje} hoje)` : ""}`,
          },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition ${tab === key ? "text-white" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}
            style={tab === key ? { background: "hsl(258 70% 55%)" } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          A carregar...
        </div>
      ) : tab === "reagentes" ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por nome, código, fornecedor..."
              className="text-sm border border-border rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="todas">Todas categorias</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="todos">Todos os tipos</option>
              <option value="reagente">Reagente</option>
              <option value="material">Material consumível</option>
            </select>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="todos">Todos os estados</option>
              <option value="critico">Sem stock</option>
              <option value="baixo">Stock baixo</option>
              <option value="avencer">A vencer (30d)</option>
              <option value="vencido">Vencidos</option>
            </select>
            {(busca ||
              filtroCategoria !== "todas" ||
              filtroTipo !== "todos" ||
              filtroStatus !== "todos") && (
              <button
                onClick={() => {
                  setBusca("");
                  setFiltroCategoria("todas");
                  setFiltroTipo("todos");
                  setFiltroStatus("todos");
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Limpar filtros
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground font-medium">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white border border-border rounded-xl py-16 text-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto mb-3 text-muted-foreground/30"
              >
                <path d="M9 3v11a6 6 0 006-6V3" />
                <line x1="6" y1="3" x2="18" y2="3" />
                <path d="M5 21h14" />
              </svg>
              <p className="text-muted-foreground text-sm font-medium">
                {reagentes.length === 0
                  ? "Nenhum reagente registado."
                  : "Nenhum reagente corresponde aos filtros."}
              </p>
              {reagentes.length === 0 && (
                <button
                  onClick={openNovo}
                  className="mt-4 text-sm font-semibold px-4 py-2 rounded-lg text-white"
                  style={{ background: "hsl(258 70% 55%)" }}
                >
                  + Registar primeiro reagente
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Código / Nome
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        Categoria
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Quantidade
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                        Lote / Validade
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                        Fornecedor
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const dias = diasParaVencer(r.validade);
                      const qtdCls =
                        r.quantidadeAtual <= 0
                          ? "text-red-600 font-bold"
                          : r.quantidadeAtual <= r.quantidadeMinima
                            ? "text-orange-600 font-semibold"
                            : "text-foreground font-semibold";
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-border/50 hover:bg-secondary/20 transition"
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold">{r.nome}</div>
                            {r.codigo && (
                              <div className="text-xs text-muted-foreground">
                                {r.codigo}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground capitalize md:hidden">
                              {r.categoria}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                            <div>{r.categoria}</div>
                            <div className="capitalize text-foreground/70">
                              {r.tipo === "material" ? "Material" : "Reagente"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={qtdCls}>{r.quantidadeAtual}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              {r.unidade}
                            </span>
                            {r.quantidadeMinima > 0 && (
                              <div className="text-xs text-muted-foreground">
                                mín: {r.quantidadeMinima}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {r.lote && (
                              <div className="text-xs font-medium">
                                {r.lote}
                              </div>
                            )}
                            {r.validade ? (
                              <div
                                className={`text-xs ${dias !== null && dias < 0 ? "text-red-600 font-semibold" : dias !== null && dias <= 30 ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}
                              >
                                {r.validade}
                                {dias !== null
                                  ? ` (${dias < 0 ? "expirado" : dias === 0 ? "hoje" : `${dias}d`})`
                                  : ""}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                            {r.fornecedor || (
                              <span className="text-muted-foreground/40">
                                —
                              </span>
                            )}
                            {r.localizacao && (
                              <div className="text-xs text-muted-foreground/70">
                                {r.localizacao}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge reagente={r} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => openMovimento(r)}
                                title="Registar movimento"
                                className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-600 transition"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <polyline points="19 12 12 19 5 12" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openEditar(r)}
                                title="Editar"
                                className="p-1.5 rounded-lg hover:bg-blue-100 transition text-blue-500 hover:text-blue-700"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletandoId(r.id)}
                                title="Eliminar"
                                className="p-1.5 rounded-lg hover:bg-red-100 transition text-red-500 hover:text-red-700"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Movimentos tab */}
          {movimentosComNome.length === 0 ? (
            <div className="bg-white border border-border rounded-xl py-16 text-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto mb-3 text-muted-foreground/30"
              >
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
              <p className="text-muted-foreground text-sm">
                Nenhum movimento registado.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Data
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Reagente
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Quantidade
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        Lote / Validade
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                        Motivo
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                        Registado por
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentosComNome.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-border/50 hover:bg-secondary/20 transition"
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {m.data}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {m.reagenteNome}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.tipo === "entrada" && (
                            <span className="badge text-xs bg-blue-50 text-blue-700 border border-blue-200">
                              Entrada
                            </span>
                          )}
                          {m.tipo === "saida" && (
                            <span className="badge text-xs bg-orange-50 text-orange-700 border border-orange-200">
                              Saída
                            </span>
                          )}
                          {m.tipo === "ajuste" && (
                            <span className="badge text-xs bg-purple-50 text-purple-700 border border-purple-200">
                              Ajuste
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">
                          <span
                            className={
                              m.tipo === "saida"
                                ? "text-orange-600"
                                : m.tipo === "entrada"
                                  ? "text-blue-600"
                                  : "text-purple-600"
                            }
                          >
                            {m.tipo === "saida"
                              ? "−"
                              : m.tipo === "entrada"
                                ? "+"
                                : "="}
                            {m.quantidade}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {m.reagenteUnidade}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                          {m.lote || "—"}
                          {m.validade && <div>{m.validade}</div>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                          {m.motivo || "—"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                          {m.registadoPor || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODAL REAGENTE ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editando ? "Editar Reagente" : "Novo Reagente"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary transition text-muted-foreground"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {err && (
                <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {err}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Código
                  </label>
                  <input
                    value={form.codigo}
                    onChange={(e) =>
                      setForm({ ...form, codigo: e.target.value })
                    }
                    placeholder="REA-001"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Tipo
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  >
                    <option value="reagente">Reagente</option>
                    <option value="material">Material consumível</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Nome *
                </label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Hemograma Completo — Reactivo EDTA"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={form.categoria}
                    onChange={(e) =>
                      setForm({ ...form, categoria: e.target.value })
                    }
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Unidade de medida
                  </label>
                  <select
                    value={form.unidade}
                    onChange={(e) =>
                      setForm({ ...form, unidade: e.target.value })
                    }
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Quantidade actual
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.quantidadeAtual}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quantidadeAtual: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Quantidade mínima (alerta)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.quantidadeMinima}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quantidadeMinima: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Lote actual
                  </label>
                  <input
                    value={form.lote}
                    onChange={(e) => setForm({ ...form, lote: e.target.value })}
                    placeholder="Ex: LOT-2024-001"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Validade
                  </label>
                  <input
                    type="date"
                    value={form.validade}
                    onChange={(e) =>
                      setForm({ ...form, validade: e.target.value })
                    }
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Fornecedor
                  </label>
                  <input
                    value={form.fornecedor}
                    onChange={(e) =>
                      setForm({ ...form, fornecedor: e.target.value })
                    }
                    placeholder="Nome do fornecedor"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Localização
                  </label>
                  <input
                    value={form.localizacao}
                    onChange={(e) =>
                      setForm({ ...form, localizacao: e.target.value })
                    }
                    placeholder="Ex: Frigorífico A — Prateleira 2"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Observações
                </label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) =>
                    setForm({ ...form, observacoes: e.target.value })
                  }
                  rows={2}
                  placeholder="Notas adicionais..."
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={(e) =>
                    setForm({ ...form, ativo: e.target.checked })
                  }
                  className="rounded"
                />
                <label htmlFor="ativo" className="text-sm font-medium">
                  Activo
                </label>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="text-sm font-semibold px-5 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={saving}
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ background: "hsl(258 70% 55%)" }}
              >
                {saving ? (
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                ) : null}
                {saving
                  ? "A guardar..."
                  : editando
                    ? "Guardar alterações"
                    : "Criar reagente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MOVIMENTO ── */}
      {movModalOpen && movReagente && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setMovModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Registar Movimento</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {movReagente.nome} — stock actual:{" "}
                  <strong>
                    {movReagente.quantidadeAtual} {movReagente.unidade}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setMovModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary transition text-muted-foreground"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {err && (
                <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {err}
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">
                  Tipo de movimento
                </label>
                <div className="flex gap-2">
                  {[
                    {
                      val: "entrada",
                      label: "Entrada",
                      cls:
                        movForm.tipo === "entrada"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
                    },
                    {
                      val: "saida",
                      label: "Saída",
                      cls:
                        movForm.tipo === "saida"
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
                    },
                    {
                      val: "ajuste",
                      label: "Ajuste",
                      cls:
                        movForm.tipo === "ajuste"
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
                    },
                  ].map(({ val, label, cls }) => (
                    <button
                      key={val}
                      onClick={() => setMovForm({ ...movForm, tipo: val })}
                      className={`flex-1 text-sm font-semibold py-2 rounded-lg border transition ${cls}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Quantidade ({movReagente.unidade}) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={movForm.quantidade || ""}
                    onChange={(e) =>
                      setMovForm({
                        ...movForm,
                        quantidade: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
                  />
                  {movForm.tipo !== "ajuste" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {movForm.tipo === "entrada"
                        ? `Após: ${movReagente.quantidadeAtual + (movForm.quantidade || 0)} ${movReagente.unidade}`
                        : `Após: ${Math.max(0, movReagente.quantidadeAtual - (movForm.quantidade || 0))} ${movReagente.unidade}`}
                    </p>
                  )}
                  {movForm.tipo === "ajuste" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Nova quantidade: {movForm.quantidade}{" "}
                      {movReagente.unidade}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Data
                  </label>
                  <input
                    type="date"
                    value={movForm.data}
                    onChange={(e) =>
                      setMovForm({ ...movForm, data: e.target.value })
                    }
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              {movForm.tipo === "entrada" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Lote
                    </label>
                    <input
                      value={movForm.lote}
                      onChange={(e) =>
                        setMovForm({ ...movForm, lote: e.target.value })
                      }
                      placeholder="Ex: LOT-2025-001"
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Validade do lote
                    </label>
                    <input
                      type="date"
                      value={movForm.validade}
                      onChange={(e) =>
                        setMovForm({ ...movForm, validade: e.target.value })
                      }
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Motivo / Observação
                </label>
                <input
                  value={movForm.motivo}
                  onChange={(e) =>
                    setMovForm({ ...movForm, motivo: e.target.value })
                  }
                  placeholder={
                    movForm.tipo === "entrada"
                      ? "Ex: Compra ao fornecedor"
                      : movForm.tipo === "saida"
                        ? "Ex: Utilização em análises"
                        : "Ex: Contagem física de inventário"
                  }
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setMovModalOpen(false)}
                className="text-sm font-semibold px-5 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarMovimento}
                disabled={saving || !movForm.quantidade}
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-lg text-white disabled:opacity-50"
                style={{
                  background:
                    movForm.tipo === "saida"
                      ? "#ea580c"
                      : movForm.tipo === "ajuste"
                        ? "hsl(258 70% 55%)"
                        : "#2563eb",
                }}
              >
                {saving ? (
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                ) : null}
                {saving
                  ? "A registar..."
                  : movForm.tipo === "entrada"
                    ? "Registar Entrada"
                    : movForm.tipo === "saida"
                      ? "Registar Saída"
                      : "Aplicar Ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SINCRONIZAR ── */}
      {syncOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !saving && setSyncOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold">
                  Sincronizar com Produtos e Exames
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Importar como reagentes os itens que ainda não existem no
                  stock
                </p>
              </div>
              <button
                onClick={() => setSyncOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary transition text-muted-foreground"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {syncLoading ? (
              <div className="flex-1 flex items-center justify-center py-16 text-sm text-muted-foreground">
                A carregar...
              </div>
            ) : syncItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-emerald-400"
                >
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 014-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 01-4 4H3" />
                </svg>
                <p className="text-sm text-muted-foreground font-medium">
                  Tudo sincronizado — nenhum item novo encontrado.
                </p>
                <button
                  onClick={() => setSyncOpen(false)}
                  className="text-sm px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition font-semibold"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                {/* Filter + select controls */}
                <div className="px-6 py-3 border-b border-border shrink-0 flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1">
                    {(
                      [
                        ["todos", "Todos"],
                        ["produto", "Produtos"],
                        ["exame", "Exames"],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setSyncFonte(v)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${syncFonte === v ? "text-white" : "bg-secondary text-secondary-foreground hover:opacity-80"}`}
                        style={
                          syncFonte === v
                            ? { background: "hsl(258 70% 55%)" }
                            : {}
                        }
                      >
                        {l}{" "}
                        {v === "todos"
                          ? `(${syncItems.length})`
                          : v === "produto"
                            ? `(${syncItems.filter((i) => i.fonte === "produto").length})`
                            : `(${syncItems.filter((i) => i.fonte === "exame").length})`}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => selectAllFiltered(true)}
                      className="text-xs text-violet-600 hover:underline font-medium"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-muted-foreground/40">|</span>
                    <button
                      onClick={() => selectAllFiltered(false)}
                      className="text-xs text-muted-foreground hover:underline font-medium"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "hsl(258 70% 55%)" }}
                  >
                    {syncFiltered.filter((i) => syncSelected.has(i.key)).length}
                    /{syncFiltered.length} seleccionados
                  </span>
                </div>

                {/* Item list */}
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {syncFiltered.map((item) => {
                    const checked = syncSelected.has(item.key);
                    return (
                      <label
                        key={item.key}
                        className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-secondary/30 transition ${checked ? "" : "opacity-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSyncItem(item.key)}
                          className="w-4 h-4 accent-violet-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {item.nome}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.categoria}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${item.fonte === "produto" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-violet-50 text-violet-700 border border-violet-200"}`}
                        >
                          {item.fonte === "produto" ? "Produto" : "Exame"}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Os reagentes serão criados com quantidade 0. Podes depois
                    registar entradas de stock.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setSyncOpen(false)}
                      disabled={saving}
                      className="text-sm font-semibold px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleImportarSelecionados}
                      disabled={saving || syncSelected.size === 0}
                      className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition disabled:opacity-50"
                      style={{ background: "hsl(258 70% 55%)" }}
                    >
                      {saving
                        ? "A importar..."
                        : `Importar ${[...syncSelected].filter((k) => syncFiltered.some((i) => i.key === k)).length} item(s)`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIRMAÇÃO ELIMINAR ── */}
      {deletandoId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-destructive"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-base">Eliminar reagente?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Todos os movimentos associados também serão eliminados. Esta
                acção é irreversível.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletandoId(null)}
                className="flex-1 text-sm font-semibold py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEliminar(deletandoId)}
                disabled={saving}
                className="flex-1 text-sm font-semibold py-2 rounded-lg bg-destructive text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? "A eliminar..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useRef } from "react";
import { useApp } from "../../store/AppContext";
import { Produto } from "../../store/AppContext";
import { formatCurrency } from "../../store/storage";
import { gerarProdutosDosCatalogo } from "../../utils/seedProdutos";
import { EXAMES_BUILTIN } from "../../data/exames";
import { downloadProdutosPDF } from "../../utils/listPdfGenerator";
import { api } from "../../store/api";
import { normalizeExamName } from "../../utils/catalogImport";
import CatalogImportDialog from "../../components/hospital/CatalogImportDialog";

const CATEGORIAS = [
  "Hematologia",
  "Bioquímica",
  "Imunologia / Serologia",
  "Hormonas / Endocrinologia",
  "Função Tiroideia",
  "iChroma I — Tiróide",
  "iChroma II — Cardíaco/Anemia",
  "iChroma III — Hormonal",
  "Análise de Urina",
  "Microbiologia / Bacteriologia",
  "Parasitologia / Coprologia",
  "Marcadores Tumorais",
  "Marcadores Cardíacos",
  "Coagulação",
  "Genética / Biologia Molecular",
  "Toxicologia / Drogas",
  "Consulta Médica",
  "Ecografia",
  "Radiografia",
  "Electrocardiograma",
  "Taxa de Urgência",
  "Taxa de Colheita",
  "Material de Consumo",
  "Serviço Hospitalar",
  "Outro",
];

function nextCodigo(produtos: Produto[]): string {
  const nums = produtos
    .map((p) => parseInt(p.codigo.replace(/\D/g, "") || "0"))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return "LAB-" + String(next).padStart(3, "0");
}

const emptyForm: Omit<Produto, "id"> = {
  codigo: "",
  nome: "",
  categoria: "Bioquímica",
  preco: 0,
  ivaIsento: false,
  descricao: "",
  ativo: false,
  stock: 0,
  stockMinimo: 0,
};

// Inline price editor component
function InlinePreco({
  produto,
  onSave,
  moeda,
}: {
  produto: Produto;
  onSave: (id: number, preco: number) => void;
  moeda: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(produto.preco));
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    setVal(String(produto.preco));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  }

  function commit() {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) onSave(produto.id, n);
    setEditing(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <input
          ref={inputRef}
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="w-28 border border-[#00AEEF] rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#00AEEF]/30"
          min={0}
          step={0.01}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      title="Clique para editar preço"
      className={`text-xs font-bold text-right w-full transition-colors group flex items-center justify-end gap-1 ${
        produto.preco === 0
          ? "text-red-500 hover:text-red-700"
          : "text-[#00AEEF] hover:text-[#0090c5]"
      }`}
    >
      <span>{formatCurrency(produto.preco, moeda)}</span>
      <span className="opacity-0 group-hover:opacity-60 text-gray-400 text-[10px]">
        ✏
      </span>
    </button>
  );
}

export default function GestaProdutos() {
  const { data, addProduto, updateProduto, removeProduto, reload } = useApp();
  const moeda = data.config.moeda || "AOA";
  const produtos = data.produtos ?? [];

  const [form, setForm] = useState<Omit<Produto, "id">>(() => ({
    ...emptyForm,
    codigo: nextCodigo(produtos),
  }));
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [filtroPreco, setFiltroPreco] = useState<"todos" | "sempreco">("todos");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [fileImportOpen, setFileImportOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSelected, setCatalogSelected] = useState<Set<string>>(new Set());
  const [catalogPrices, setCatalogPrices] = useState<Record<string, number>>({});
  const [catalogActive, setCatalogActive] = useState<Set<string>>(new Set());

  const semPrecoCount = useMemo(
    () => produtos.filter((p) => p.ativo && p.preco === 0).length,
    [produtos],
  );

  // All exams from EXAMES_BUILTIN as flat list {cat, nome}
  const builtinExames = useMemo(() => {
    const items: { cat: string; nome: string }[] = [];
    for (const [cat, sub] of Object.entries(EXAMES_BUILTIN)) {
      for (const nome of Object.keys(sub)) {
        items.push({ cat, nome });
      }
    }
    return items;
  }, []);

  // Exams from examesCustom flat list
  const customExames = useMemo(() => {
    const items: { cat: string; nome: string }[] = [];
    for (const [cat, sub] of Object.entries(data.examesCustom)) {
      for (const nome of Object.keys(sub)) {
        items.push({ cat, nome });
      }
    }
    return items;
  }, [data.examesCustom]);

  // O catálogo não transporta preços: o que existe é apenas a oferta possível.
  const examesSemProduto = useMemo(() => {
    const nomesExistentes = new Set(
      produtos.map((p) => normalizeExamName(p.nome)),
    );
    const candidatos = [...builtinExames, ...customExames, ...gerarProdutosDosCatalogo().map((p) => ({ cat: p.categoria, nome: p.nome }))];
    const vistos = new Set<string>();
    return candidatos.filter((e) => {
      const key = normalizeExamName(e.nome);
      if (!key || nomesExistentes.has(key) || vistos.has(key)) return false;
      vistos.add(key); return true;
    });
  }, [produtos, builtinExames, customExames]);

  function handleImportarCatalogo() {
    setCatalogOpen(true);
  }

  async function handleSincronizarCatalogo() {
    setCatalogOpen(true);
  }

  async function confirmarCatalogo() {
    const chosen = examesSemProduto.filter((e) => catalogSelected.has(normalizeExamName(e.nome)));
    if (!chosen.length) return setMsg({ text: "Seleccione os exames que esta empresa pretende disponibilizar.", ok: false });
    if (!window.confirm(`Criar ${chosen.length} produto(s) nesta empresa, sem copiar preços de outras unidades?`)) return;
    setSyncing(true);
    try {
      const prefix = `EX-${Date.now().toString(36).toUpperCase()}`;
      const result = await api.produtos.importar(chosen.slice(0, 300).map((e, i) => ({
        codigo: `${prefix}-${String(i + 1).padStart(3, "0")}`,
        nome: e.nome, categoria: e.cat,
        preco: catalogPrices[normalizeExamName(e.nome)] ?? 0,
        ativo: catalogActive.has(normalizeExamName(e.nome)),
      })));
      await reload();
      setCatalogOpen(false); setCatalogSelected(new Set()); setCatalogActive(new Set()); setCatalogPrices({});
      setMsg({ text: `${result.importados} produto(s) criados para esta empresa; ${result.ignorados} já existiam. Nenhum preço anterior foi alterado.`, ok: true });
    } catch (e: any) { setMsg({ text: e?.message || "Falha na sincronização.", ok: false }); }
    finally { setSyncing(false); }
  }

  function handleInlinePreco(id: number, novoPreco: number) {
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    updateProduto(id, { ...p, preco: novoPreco });
  }

  function f<K extends keyof typeof emptyForm>(
    field: K,
    val: (typeof emptyForm)[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setMsg({ text: "O nome é obrigatório.", ok: false });
      return;
    }
    if (!form.codigo.trim()) {
      setMsg({ text: "O código é obrigatório.", ok: false });
      return;
    }
    const dup = produtos.find(
      (p) => p.codigo === form.codigo.trim() && p.id !== editId,
    );
    if (dup) {
      setMsg({ text: "Já existe um produto com este código.", ok: false });
      return;
    }
    if (editId !== null) {
      updateProduto(editId, {
        ...form,
        nome: form.nome.trim(),
        codigo: form.codigo.trim(),
      });
      setMsg({ text: "Produto actualizado com sucesso.", ok: true });
      setEditId(null);
    } else {
      addProduto({
        ...form,
        nome: form.nome.trim(),
        codigo: form.codigo.trim(),
      });
      setMsg({ text: `Produto "${form.nome}" registado.`, ok: true });
    }
    const next = {
      ...emptyForm,
      codigo: nextCodigo([...produtos, { id: 0, ...form }]),
    };
    setForm(next);
  }

  function handleEdit(p: Produto) {
    const { id, ...rest } = p;
    setForm(rest);
    setEditId(id);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRemove(p: Produto) {
    if (!window.confirm(`Eliminar "${p.nome}"?`)) return;
    removeProduto(p.id);
  }

  const filtered = produtos.filter((p) => {
    const matchSearch =
      !search ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filtroCat || p.categoria === filtroCat;
    const matchPreco =
      filtroPreco === "todos" || (filtroPreco === "sempreco" && p.preco === 0);
    return matchSearch && matchCat && matchPreco;
  });

  const cats = [...new Set(produtos.map((p) => p.categoria))].sort();
  const totalAtivos = produtos.filter((p) => p.ativo).length;
  const totalCategorias = new Set(produtos.map((p) => p.categoria)).size;

  const inp =
    "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white";

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-primary">
            Gestão de Produtos e Serviços
          </h2>
          <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
            Tabela de Preços (PVD)
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFileImportOpen(true)} className="flex items-center gap-2 bg-[#0d7a8a] hover:opacity-90 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm">
            📎 Importar PDF / Excel / CSV
          </button>
          <button
            onClick={() => downloadProdutosPDF(produtos, data.config, moeda)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm whitespace-nowrap"
          >
            📄 Baixar PDF
          </button>
        </div>
      </div>

      {/* Alerta de exames sem preço */}
      {semPrecoCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <span className="text-lg">⚠️</span>
            <span>
              <strong>
                {semPrecoCount} produto{semPrecoCount !== 1 ? "s" : ""}
              </strong>{" "}
              activo{semPrecoCount !== 1 ? "s" : ""} sem preço definido. Clique
              no preço na tabela para editar directamente.
            </span>
          </div>
          <button
            onClick={() =>
              setFiltroPreco(filtroPreco === "sempreco" ? "todos" : "sempreco")
            }
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition whitespace-nowrap ${
              filtroPreco === "sempreco"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white border-amber-400 text-amber-700 hover:bg-amber-50"
            }`}
          >
            {filtroPreco === "sempreco"
              ? "✓ A mostrar sem preço"
              : "Ver sem preço"}
          </button>
        </div>
      )}

      {/* Alerta de exames não sincronizados */}
      {examesSemProduto.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-700 flex items-center justify-between gap-4 flex-wrap">
          <span>
            <strong>
              {examesSemProduto.length} exame
              {examesSemProduto.length !== 1 ? "s" : ""}
            </strong>{" "}
            do catálogo ainda não têm produto associado. Sincronize para
            adicioná-los à tabela de preços.
          </span>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleImportarCatalogo}
              className="bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-800 transition whitespace-nowrap"
            >
              ⬇ Escolher exames do catálogo
            </button>
            <button
              onClick={handleSincronizarCatalogo}
              disabled={syncing}
              className="bg-white border border-blue-400 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition whitespace-nowrap disabled:opacity-60"
            >
              {syncing ? "A sincronizar…" : "🔄 Sincronizar todos os exames"}
            </button>
          </div>
        </div>
      )}

      {/* Quando já está tudo sincronizado mostrar só o botão de sync */}
      {examesSemProduto.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-700 flex items-center justify-between gap-4 flex-wrap">
          <span>
            Esta tabela alimenta directamente a faturação e o sistema PVD/AGT.
          </span>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleImportarCatalogo}
              className="bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-800 transition whitespace-nowrap"
            >
              ⬇ Escolher exames do catálogo
            </button>
            <button
              onClick={handleSincronizarCatalogo}
              disabled={syncing}
              className="bg-white border border-blue-400 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition whitespace-nowrap disabled:opacity-60"
            >
              {syncing ? "A sincronizar…" : "🔄 Sincronizar exames"}
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary">
            {produtos.length}
          </div>
          <div className="text-xs text-muted-foreground">
            Produtos Registados
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{totalAtivos}</div>
          <div className="text-xs text-muted-foreground">Activos</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <div
            className={`text-2xl font-bold ${semPrecoCount > 0 ? "text-amber-500" : "text-gray-400"}`}
          >
            {semPrecoCount}
          </div>
          <div className="text-xs text-muted-foreground">Sem Preço</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {totalCategorias}
          </div>
          <div className="text-xs text-muted-foreground">Categorias</div>
        </div>
      </div>
      {catalogOpen && <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/65 p-3" role="dialog" aria-modal="true" aria-label="Seleccionar exames e preços">
        <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
          <div className="flex justify-between gap-3"><div><h3 className="text-lg font-bold text-primary">Catálogo de exames — empresa actual</h3><p className="mt-1 text-sm text-slate-600">Seleccione só os exames que esta unidade realiza. Preços são próprios e começam em 0 Kz; nenhum preço antigo será copiado.</p></div><button type="button" className="rounded border px-3 py-1" onClick={() => setCatalogOpen(false)}>Fechar</button></div>
          <input className="my-3 w-full rounded border px-3 py-2 text-sm" placeholder="Pesquisar exame ou categoria" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} />
          <p className="mb-2 text-sm font-semibold">{examesSemProduto.length} disponível(is) · {catalogSelected.size} seleccionado(s)</p>
          <div className="max-h-[52vh] overflow-auto rounded border"><table className="w-full min-w-[730px] text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Escolher</th><th className="p-2">Exame</th><th className="p-2">Categoria</th><th className="p-2">Preço (Kz)</th><th className="p-2">Activar</th></tr></thead><tbody>
            {examesSemProduto.filter((e) => normalizeExamName(e.nome + " " + e.cat).includes(normalizeExamName(catalogSearch))).slice(0, 80).map((e) => {
              const key = normalizeExamName(e.nome);
              return <tr key={key} className="border-t"><td className="p-2"><input type="checkbox" checked={catalogSelected.has(key)} onChange={(ev) => setCatalogSelected((old) => { const s = new Set(old); if (ev.target.checked) s.add(key); else s.delete(key); return s; })} /></td><td className="p-2 font-medium">{e.nome}</td><td className="p-2 text-xs">{e.cat}</td><td className="p-2"><input aria-label={`Preço de ${e.nome}`} type="number" min="0" step="0.01" value={catalogPrices[key] ?? 0} className="w-28 rounded border px-2 py-1 text-right" onChange={(ev) => setCatalogPrices((s) => ({ ...s, [key]: Number(ev.target.value) }))} /></td><td className="p-2"><input type="checkbox" aria-label={`Activar ${e.nome}`} checked={catalogActive.has(key)} onChange={(ev) => setCatalogActive((old) => { const s = new Set(old); if (ev.target.checked) { s.add(key); setCatalogSelected((sel) => new Set(sel).add(key)); } else s.delete(key); return s; })} /></td></tr>;
            })}
          </tbody></table></div>
          <p className="mt-2 text-xs text-slate-600">Apresentados até 80 resultados por pesquisa. Pesquise outros nomes para seleccionar mais. A importação admite até 300 exames por operação.</p>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setCatalogOpen(false)} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => void confirmarCatalogo()} disabled={syncing || catalogSelected.size === 0 || catalogSelected.size > 300} className="rounded bg-[#0d7a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{syncing ? "A sincronizar…" : `Guardar ${catalogSelected.size} exame(s)`}</button></div>
        </div>
      </div>}
      {fileImportOpen && <CatalogImportDialog onClose={() => setFileImportOpen(false)} onSaved={(importados, ignorados) => {
        setFileImportOpen(false);
        void reload();
        setMsg({ text: `${importados} produto(s) importado(s); ${ignorados} já existiam nesta empresa e foram preservados.`, ok: true });
      }} />}

      {msg && (
        <div
          className={`text-sm rounded-lg px-4 py-3 flex items-center justify-between ${msg.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}
        >
          <span>{msg.text}</span>
          <button
            onClick={() => setMsg(null)}
            className="ml-4 opacity-60 hover:opacity-100 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-4">
            {editId !== null ? "Editar Produto" : "Novo Produto / Serviço"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Código *
                </label>
                <input
                  value={form.codigo}
                  onChange={(e) => f("codigo", e.target.value)}
                  className={inp}
                  placeholder="LAB-001"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Categoria *
                </label>
                <select
                  value={form.categoria}
                  onChange={(e) => f("categoria", e.target.value)}
                  className={inp}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nome do Produto / Serviço *
              </label>
              <input
                value={form.nome}
                onChange={(e) => f("nome", e.target.value)}
                className={inp}
                placeholder="Ex: Hemograma Completo"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Descrição (opcional)
              </label>
              <textarea
                value={form.descricao}
                onChange={(e) => f("descricao", e.target.value)}
                className={inp + " resize-none"}
                rows={2}
                placeholder="Breve descrição do serviço..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Preço ({moeda}) *
              </label>
              <input
                type="number"
                value={form.preco}
                onChange={(e) => f("preco", Number(e.target.value))}
                className={inp}
                min={0}
                step={0.01}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.ivaIsento}
                  onChange={(e) => f("ivaIsento", e.target.checked)}
                  style={{ accentColor: "hsl(var(--primary))" }}
                />
                Isento de IVA
              </label>
              {editId !== null && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => f("ativo", e.target.checked)}
                    style={{ accentColor: "hsl(var(--primary))" }}
                  />
                  Produto activo
                </label>
              )}
            </div>
            {!form.ivaIsento && (
              <div className="text-xs text-muted-foreground bg-secondary/50 rounded px-3 py-2">
                Preço c/ IVA ({data.config.ivaTaxa}%):{" "}
                <strong>
                  {formatCurrency(
                    form.preco * (1 + (data.config.ivaTaxa || 14) / 100),
                    moeda,
                  )}
                </strong>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
              >
                {editId !== null ? "Guardar" : "Registar Produto"}
              </button>
              {editId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...emptyForm, codigo: nextCodigo(produtos) });
                    setEditId(null);
                    setMsg(null);
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-bold">Catálogo ({filtered.length})</h3>
            <select
              value={filtroCat}
              onChange={(e) => setFiltroCat(e.target.value)}
              className="border border-border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-40"
            >
              <option value="">Todas as categorias</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {/* Filtro sem preço */}
            <button
              type="button"
              onClick={() =>
                setFiltroPreco((p) => (p === "sempreco" ? "todos" : "sempreco"))
              }
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                filtroPreco === "sempreco"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600"
              }`}
            >
              {filtroPreco === "sempreco" ? "✓ Sem preço" : "Sem preço"}
              {semPrecoCount > 0 && (
                <span
                  className={`ml-1 font-bold ${filtroPreco === "sempreco" ? "text-white" : "text-amber-500"}`}
                >
                  ({semPrecoCount})
                </span>
              )}
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="ml-auto border border-border rounded px-3 py-1.5 text-xs w-44 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground text-sm">
              {produtos.length === 0
                ? "Nenhum produto registado. Use o formulário ao lado para começar."
                : "Nenhum produto encontrado com os filtros actuais."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs">
                      Código
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs">
                      Nome / Serviço
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs">
                      Categoria
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs">
                      Preço s/IVA
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground normal-case">
                        (clique p/ editar)
                      </span>
                    </th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs">
                      Preço c/IVA
                    </th>
                    <th className="text-center px-4 py-2.5 font-semibold text-xs">
                      IVA
                    </th>
                    <th className="text-center px-4 py-2.5 font-semibold text-xs">
                      Estado
                    </th>
                    <th className="text-center px-4 py-2.5 font-semibold text-xs">
                      Acções
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const precoComIva = p.ivaIsento
                      ? p.preco
                      : p.preco * (1 + (data.config.ivaTaxa || 14) / 100);
                    const semPreco = p.preco === 0;
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-border hover:bg-accent/20 transition-colors ${!p.ativo ? "opacity-50" : ""} ${semPreco ? "bg-amber-50/30" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {p.codigo}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-xs flex items-center gap-1.5">
                            {p.nome}
                            {semPreco && (
                              <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">
                                Sem preço
                              </span>
                            )}
                          </div>
                          {p.descricao && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-48">
                              {p.descricao}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {p.categoria}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <InlinePreco
                            produto={p}
                            onSave={handleInlinePreco}
                            moeda={moeda}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right font-bold text-primary">
                          {semPreco ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            formatCurrency(precoComIva, moeda)
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.ivaIsento ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700"}`}
                          >
                            {p.ivaIsento
                              ? "Isento"
                              : (data.config.ivaTaxa || 14) + "%"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                          >
                            {p.ativo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-xs">
                            <button
                              onClick={() => handleEdit(p)}
                              className="bg-blue-500 text-white px-2.5 py-1 rounded font-semibold hover:bg-blue-600 transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() =>
                                updateProduto(p.id, { ...p, ativo: !p.ativo })
                              }
                              className={`px-2.5 py-1 rounded font-semibold transition text-white ${p.ativo ? "bg-amber-500 hover:bg-amber-600" : "bg-green-500 hover:bg-green-600"}`}
                            >
                              {p.ativo ? "Desact." : "Activar"}
                            </button>
                            <button
                              onClick={() => handleRemove(p)}
                              className="bg-red-500 text-white px-2.5 py-1 rounded font-semibold hover:bg-red-600 transition"
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
    </div>
  );
}

import { useState } from "react";
import { api } from "../../store/api";
import { normalizeExamName, previewCatalogFile, type CatalogImportRow } from "../../utils/catalogImport";

/** Pré-visualização obrigatória: nenhum ficheiro é enviado e nenhum preço é gravado sem confirmação. */
export default function CatalogImportDialog({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: (importados: number, ignorados: number) => void;
}) {
  const [rows, setRows] = useState<CatalogImportRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function edit(id: string, update: Partial<CatalogImportRow>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...update } : r));
  }

  async function load(file?: File) {
    if (!file) return;
    setRows([]); setWarnings([]); setError(""); setFileName(file.name); setLoading(true);
    try {
      const parsed = await previewCatalogFile(file);
      setRows(parsed.rows); setWarnings(parsed.warnings);
    } catch (e: any) {
      setError(e?.message || "Não foi possível interpretar o documento.");
    } finally { setLoading(false); }
  }

  async function save() {
    if (saving) return;
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) return setError("Seleccione pelo menos um exame ou produto.");
    const names = new Set<string>(), codes = new Set<string>();
    for (const r of selected) {
      const name = normalizeExamName(r.nome), code = normalizeExamName(r.codigo);
      if (!name || !code || !r.categoria.trim() || !Number.isFinite(r.preco) || r.preco < 0) {
        setError("Corrija os nomes, códigos, categorias e preços assinalados antes de importar."); return;
      }
      if (names.has(name) || codes.has(code)) { setError("Existem nomes ou códigos repetidos na selecção."); return; }
      names.add(name); codes.add(code);
    }
    if (!window.confirm(`Confirmar a importação de ${selected.length} produto(s) para a empresa actual? Os produtos existentes e respectivos preços não serão alterados.`)) return;
    setSaving(true); setError("");
    try {
      const result = await api.produtos.importar(selected.map(({ codigo, nome, categoria, preco, ativo }) => ({ codigo, nome, categoria, preco, ativo })));
      onSaved(result.importados, result.ignorados);
    } catch (e: any) { setError(e?.message || "Não foi possível guardar a tabela de preços."); }
    finally { setSaving(false); }
  }

  const count = rows.filter((r) => r.selected).length;
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 p-3" role="dialog" aria-modal="true" aria-label="Importar exames e preços">
    <div className="w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-[#0d2b3e]">Importar exames e preços da empresa</h2><p className="text-sm text-slate-600">PDF, Excel ou CSV · pré-visualização obrigatória · sem partilhar preços entre empresas</p></div>
        <button type="button" onClick={onClose} disabled={saving} className="rounded border px-3 py-1.5 text-sm">Fechar</button>
      </div>
      <label className="block rounded-lg border-2 border-dashed border-sky-300 bg-sky-50 p-4 text-sm font-semibold text-sky-900">
        Seleccionar documento da tabela de preços
        <input type="file" accept=".pdf,.xlsx,.xls,.csv" disabled={saving || loading} className="mt-2 block w-full text-sm" onChange={(e) => void load(e.target.files?.[0])} />
      </label>
      {fileName && <p className="my-2 text-xs text-slate-600">Documento: {fileName}</p>}
      {loading && <p className="py-4 text-sm">A interpretar o ficheiro localmente…</p>}
      {warnings.map((w, i) => <p key={i} className="my-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{w}</p>)}
      {error && <p role="alert" className="my-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {rows.length > 0 && <>
        <div className="my-3 flex flex-wrap items-center justify-between gap-3 text-sm"><strong>{rows.length} linha(s) detectada(s) · {count} seleccionada(s)</strong><div className="flex gap-2"><button type="button" className="rounded border px-2 py-1" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, selected: true })))}>Seleccionar todos</button><button type="button" className="rounded border px-2 py-1" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, selected: false })))}>Limpar selecção</button></div></div>
        <p className="mb-2 text-sm text-amber-800">Os exames entram desactivados por defeito. Defina os preços próprios e marque «Activar» apenas para os serviços realizados nesta unidade. Os intervalos de referência clínicos são configurados e validados separadamente.</p>
        <div className="max-h-[48vh] overflow-auto rounded border"><table className="w-full min-w-[850px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Importar</th><th className="p-2">Código</th><th className="p-2">Exame/produto</th><th className="p-2">Categoria</th><th className="p-2">Preço (Kz)</th><th className="p-2">Activar</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="p-2"><input type="checkbox" checked={row.selected} onChange={(e) => edit(row.id, { selected: e.target.checked })} /></td><td className="p-1"><input aria-label="Código" className="w-32 rounded border px-2 py-1" value={row.codigo} onChange={(e) => edit(row.id, { codigo: e.target.value })} /></td><td className="p-1"><input aria-label="Nome" className="w-full min-w-60 rounded border px-2 py-1" value={row.nome} onChange={(e) => edit(row.id, { nome: e.target.value })} /></td><td className="p-1"><input aria-label="Categoria" className="w-full min-w-36 rounded border px-2 py-1" value={row.categoria} onChange={(e) => edit(row.id, { categoria: e.target.value })} /></td><td className="p-1"><input aria-label="Preço" type="number" step="0.01" min="0" className="w-28 rounded border px-2 py-1 text-right" value={row.preco} onChange={(e) => edit(row.id, { preco: Number(e.target.value) })} /></td><td className="p-2"><input type="checkbox" checked={row.ativo} onChange={(e) => edit(row.id, { ativo: e.target.checked })} /></td></tr>)}</tbody></table></div>
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => void save()} disabled={saving || count === 0} className="rounded bg-[#0d7a8a] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "A guardar…" : `Confirmar ${count} produto(s)`}</button></div>
      </>}
    </div>
  </div>;
}

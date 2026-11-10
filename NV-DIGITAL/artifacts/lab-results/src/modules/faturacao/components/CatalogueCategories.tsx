import { useState } from "react";
import { useApp } from "../store/AppContext";
export function CategoryField({
  value,
  onChange,
  label = "Categoria",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const { categorias = [], currentUser, saveCategory } = useApp();
  const [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const choices = [...new Set([...categorias, ...(value ? [value] : [])])];
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await saveCategory(name.trim());
      onChange(name.trim());
      setCreating(false);
      setName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label className="block text-sm">
        {label}
        <select
          aria-label={label}
          className="block w-full border rounded p-2 bg-white"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Sem categoria</option>
          {choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {currentUser.role === "admin" && (
        <button
          type="button"
          className="text-blue-700 text-xs mt-1 underline"
          onClick={() => setCreating((v) => !v)}
        >
          Criar categoria
        </button>
      )}
      {creating && (
        <div className="mt-2 p-3 bg-slate-50 border rounded">
          <label className="block text-sm">
            Nome da nova categoria
            <input
              aria-label="Nome da nova categoria"
              className="block w-full p-2 border rounded"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
            className="mt-2 p-2 rounded bg-blue-700 text-white"
          >
            Guardar categoria
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-700 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
export function CategoryManager() {
  const {
    categorias = [],
    saveCategory,
    deleteCategory,
    currentUser,
  } = useApp();
  const [name, setName] = useState(""),
    [previous, setPrevious] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  if (currentUser.role !== "admin") return null;
  async function save() {
    setBusy(true);
    try {
      await saveCategory(name.trim(), previous || undefined);
      setName("");
      setPrevious("");
      setMsg("Categoria guardada. O catálogo utiliza esta mesma categoria.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="my-4 p-4 bg-white border rounded"
      aria-label="Gestão de categorias"
    >
      <h3 className="font-semibold mb-2">Categorias do catálogo</h3>
      <p className="text-sm text-slate-600 mb-3">
        Defina as categorias usadas nos produtos, kits, pesquisa e POS. Não há
        prefixos obrigatórios.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Nome da categoria"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
          placeholder="Nome da categoria"
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void save()}
          className="bg-blue-700 text-white p-2 rounded"
        >
          {previous ? "Guardar alteração" : "Adicionar categoria"}
        </button>
        {previous && (
          <button
            type="button"
            onClick={() => {
              setPrevious("");
              setName("");
            }}
          >
            Cancelar
          </button>
        )}
      </div>
      <p role="status" className="my-2 text-sm">
        {msg}
      </p>
      <ul>
        {categorias.map((c) => (
          <li key={c} className="border-t py-2 flex items-center gap-3">
            <span className="flex-1">{c}</span>
            <button
              type="button"
              className="text-blue-700"
              onClick={() => {
                setPrevious(c);
                setName(c);
              }}
            >
              Renomear
            </button>
            <button
              type="button"
              className="text-red-700"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm(`Remover a categoria ${c}?`)) return;
                setBusy(true);
                try {
                  await deleteCategory(c);
                  setMsg("Categoria removida.");
                } catch (e) {
                  setMsg((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      {!categorias.length && (
        <p className="text-sm text-slate-500">
          Ainda não há categorias. Crie apenas as necessárias à sua instituição.
        </p>
      )}
    </section>
  );
}

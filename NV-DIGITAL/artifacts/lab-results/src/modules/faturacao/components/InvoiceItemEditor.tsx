import { useState, type FormEvent } from "react";
import { useApp } from "../store/AppContext";
import type { Produto } from "../types";
import { CategoryField } from "./CatalogueCategories";
import { inputNumber } from "../utils/billingNumbers";
export default function InvoiceItemEditor({
  onClose,
  onSaved,
  initial,
  addToInvoice = true,
}: {
  addToInvoice?: boolean;
  onClose: () => void;
  onSaved: (p: Produto) => void;
  initial?: Produto;
}) {
  const { addProduto, updateProduto, currentUser } = useApp();
  const [form, setForm] = useState({
      nome: initial?.nome || "",
      codigo: initial?.codigo || "",
      codigoBarras: initial?.codigoBarras || "",
      categoria: initial?.categoria || "",
      preco: String(initial?.preco ?? ""),
      stock: initial?.stock || 0,
      stockMinimo: initial?.stockMinimo || 0,
      unidadeMedida: initial?.unidadeMedida || "un",
      ativo: initial?.ativo ?? true,
      ivaIsento: initial?.ivaIsento || false,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const price = inputNumber(form.preco);
      if (
        !Number.isFinite(price) ||
        price < 0 ||
        Math.abs(price * 100 - Math.round(price * 100)) > 0.0001
      )
        throw Error("Indique um preço válido, por exemplo 1250,50.");
      const data = { ...form, preco: price };
      let p: Produto;
      if (initial) {
        await updateProduto(initial.id, data);
        p = { ...initial, ...data };
      } else p = await addProduto(data);
      onSaved(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-[350] bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Editar item" : "Criar novo item"}
    >
      <form
        onSubmit={save}
        className="bg-white rounded p-6 max-w-lg w-full space-y-4 max-h-[92vh] overflow-auto"
      >
        <h2 className="text-xl font-semibold">
          {initial ? "Editar Item" : "Criar Novo Item"}
        </h2>
        {currentUser.role !== "admin" ? (
          <p>
            O cadastro de artigos está reservado à gestão. Seleccione um item
            existente ou solicite o cadastro ao responsável.
          </p>
        ) : (
          <>
            {[
              ["nome", "Descrição"],
              ["codigo", "Código"],
              ["codigoBarras", "Código de barras"],
              ["unidadeMedida", "Unidade"],
            ].map(([k, label]) => (
              <label key={k} className="block text-sm">
                {label}
                <input
                  className="block w-full rounded border p-2"
                  required={k === "nome"}
                  value={(form as any)[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </label>
            ))}
            <CategoryField
              value={form.categoria}
              onChange={(categoria) => setForm({ ...form, categoria })}
            />
            <label className="block text-sm">
              Preço unitário (Kz)
              <input
                inputMode="decimal"
                required
                className="block w-full rounded border p-2"
                placeholder="1250,50"
                value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })}
              />
            </label>
            <div className="flex gap-3">
              {[
                ["stock", "Stock"],
                ["stockMinimo", "Stock mínimo"],
              ].map(([k, label]) => (
                <label key={k} className="block text-sm flex-1">
                  {label}
                  <input
                    type="number"
                    min="0"
                    step="0.000001"
                    className="block w-full p-2 border rounded"
                    value={(form as any)[k]}
                    onChange={(e) =>
                      setForm({ ...form, [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ivaIsento}
                onChange={(e) =>
                  setForm({ ...form, ivaIsento: e.target.checked })
                }
              />
              Isento de IVA
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Activo
            </label>
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <button
              className="bg-blue-600 text-white rounded px-4 py-2"
              disabled={busy}
            >
              {busy
                ? "A guardar…"
                : initial
                  ? "Guardar alterações"
                  : addToInvoice
                    ? "Guardar e adicionar à factura"
                    : "Guardar produto"}
            </button>
          </>
        )}
        <button
          type="button"
          className="border rounded px-4 py-2 ml-2"
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </button>
      </form>
    </div>
  );
}

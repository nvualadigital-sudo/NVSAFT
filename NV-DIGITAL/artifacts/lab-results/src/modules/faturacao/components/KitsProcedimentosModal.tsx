import { useState, type FormEvent } from "react";
import { useApp } from "../store/AppContext";
import type { KitProduto } from "../types";
import { CategoryField } from "./CatalogueCategories";
import { inputNumber } from "../utils/billingNumbers";
import { formatCurrency } from "../utils/faturaGenerator";
export function KitsProcedimentosModal({
  isOpen,
  onClose,
  onInsertKit,
  currency,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInsertKit: (kit: KitProduto, mode: "detalhado" | "linha_unica") => void;
  currency: string;
}) {
  const {
    kits,
    produtos,
    addKit,
    updateKit,
    deleteKit,
    currentUser,
    categorias = [],
  } = useApp();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [editing, setEditing] = useState<KitProduto | null | undefined>(undefined),
    [codigo, setCodigo] = useState(""),
    [nome, setNome] = useState(""),
    [descricao, setDescricao] = useState(""),
    [categoria, setCategoria] = useState(""),
    [preco, setPreco] = useState(""),
    [items, setItems] = useState<{ produtoId: number; quantidade: number }[]>(
      [],
    ),
    [productSearch, setProductSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const total =
    Math.round(
      items.reduce(
        (sum, i) =>
          sum +
          Math.round(
            (produtos.find((p) => p.id === i.produtoId)?.preco || 0) *
              i.quantidade *
              100,
          ) /
            100,
        0,
      ) * 100,
    ) / 100;
  function edit(k: KitProduto | null) {
    setEditing(k);
    setCodigo(k?.codigo || "");
    setNome(k?.nome || "");
    setDescricao(k?.descricao || "");
    setCategoria(k?.categoria || "");
    setPreco(k ? String(k.precoVendaKit) : "");
    setItems(
      k?.itens.map((i) => ({
        produtoId: i.produtoId!,
        quantidade: i.quantidade,
      })) || [],
    );
    setError("");
    setProductSearch("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!items.length) {
      setError("Adicione pelo menos um produto ou serviço.");
      return;
    }
    setBusy(true);
    try {
      if (
        preco.trim() &&
        (!Number.isFinite(inputNumber(preco)) || inputNumber(preco) < 0)
      )
        throw Error("Indique um preço de venda válido, por exemplo 2000,25.");
      const data: any = {
        codigo,
        nome,
        descricao,
        categoria,
        itens: items,
        precoVendaKit: preco.trim() ? inputNumber(preco) : undefined,
        ativo: true,
      };
      if (editing) await updateKit(editing.id, data);
      else await addKit(data);
      setEditing(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!isOpen) return null;
  const shown = kits.filter(
    (k) =>
      (!category || k.categoria === category) &&
      `${k.codigo} ${k.nome} ${k.descricao}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <div
      className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kits e procedimentos"
    >
      <section className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[92vh] overflow-auto">
        <header className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">
              Kits de Produtos e Procedimentos
            </h2>
            <p className="text-sm">
              Componentes do catálogo desta instituição.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar kits"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>
        <div className="p-5">
          {error && (
            <p role="alert" className="mb-3 border p-2 text-red-700 bg-red-50">
              {error}
            </p>
          )}
          {editing !== undefined ? (
            <form onSubmit={save} className="space-y-4">
              <h3 className="font-semibold">
                {editing ? "Editar kit" : "Criar Novo Kit"}
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                <label>
                  Código do kit
                  <input
                    required
                    aria-label="Código do kit"
                    className="block w-full border p-2 rounded"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                  />
                </label>
                <label>
                  Nome do kit
                  <input
                    required
                    aria-label="Nome do kit"
                    className="block w-full border p-2 rounded"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </label>
              </div>
              <CategoryField value={categoria} onChange={setCategoria} />
              <label className="block">
                Descrição do kit
                <textarea
                  aria-label="Descrição do kit"
                  className="block w-full border p-2 rounded"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </label>
              <label className="block">
                Adicionar componente
                <input
                  aria-label="Adicionar componente"
                  className="block w-full border p-2 rounded"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Pesquisar serviço, produto ou código de barras"
                />
              </label>
              <div className="max-h-36 overflow-auto">
                {produtos
                  .filter(
                    (p) =>
                      p.ativo &&
                      productSearch.trim() &&
                      `${p.nome} ${p.codigo} ${p.codigoBarras || ""}`
                        .toLowerCase()
                        .includes(productSearch.toLowerCase()),
                  )
                  .slice(0, 20)
                  .map((p) => (
                    <button
                      type="button"
                      className="block w-full p-2 text-left border-b hover:bg-blue-50"
                      key={p.id}
                      onClick={() => {
                        setItems((old) =>
                          old.some((i) => i.produtoId === p.id)
                            ? old.map((i) =>
                                i.produtoId === p.id
                                  ? { ...i, quantidade: i.quantidade + 1 }
                                  : i,
                              )
                            : [...old, { produtoId: p.id, quantidade: 1 }],
                        );
                        setProductSearch("");
                      }}
                    >
                      {p.nome} · {p.codigo} ·{" "}
                      {formatCurrency(p.preco, currency)}
                    </button>
                  ))}
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Componente</th>
                    <th>Quantidade</th>
                    <th>Preço</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, index) => {
                    const p = produtos.find((p) => p.id === i.produtoId);
                    return (
                      <tr key={i.produtoId} className="border-b">
                        <td>{p?.nome || "Componente indisponível"}</td>
                        <td>
                          <input
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            aria-label={`Quantidade do componente ${index + 1}`}
                            className="w-24 border p-1"
                            value={i.quantidade}
                            onChange={(e) =>
                              setItems((old) =>
                                old.map((x, n) =>
                                  n === index
                                    ? {
                                        ...x,
                                        quantidade: Number(e.target.value),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>{formatCurrency(p?.preco || 0, currency)}</td>
                        <td>
                          <button
                            type="button"
                            aria-label={`Remover componente ${index + 1}`}
                            onClick={() =>
                              setItems((old) =>
                                old.filter((_, n) => n !== index),
                              )
                            }
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p>
                Preço dos componentes:{" "}
                <strong>{formatCurrency(total, currency)}</strong>
              </p>
              <label className="block">
                Preço de venda do kit (Kz)
                <input
                  aria-label="Preço de venda do kit (Kz)"
                  inputMode="decimal"
                  className="block w-full border p-2 rounded"
                  value={preco}
                  placeholder="Vazio: soma dos componentes"
                  onChange={(e) => setPreco(e.target.value)}
                />
              </label>
              <p className="text-xs text-slate-600">
                Na inserção detalhada aplicam-se os preços individuais. A linha
                única usa o preço do kit e exige o mesmo enquadramento de IVA em
                todos os componentes.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={busy}
                  className="bg-blue-700 text-white px-4 py-2 rounded"
                >
                  {busy ? "A guardar…" : "Guardar kit"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(undefined);
                    setError("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  aria-label="Pesquisar kits"
                  className="border p-2 rounded flex-1"
                  placeholder="Pesquisar kits"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Categoria dos kits"
                  className="border p-2 rounded"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {categorias.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                {currentUser.role === "admin" && (
                  <button
                    type="button"
                    className="bg-blue-700 text-white p-2 rounded"
                    onClick={() => edit(null)}
                  >
                    Criar Novo Kit
                  </button>
                )}
              </div>
              {!shown.length && (
                <p>
                  Nenhum kit encontrado. A gestão pode criar kits com os
                  serviços e produtos da instituição.
                </p>
              )}
              {shown.map((k) => (
                <article key={k.id} className="border rounded p-4 mb-3">
                  <h3 className="font-semibold">
                    {k.codigo} · {k.nome}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {k.categoria}
                    {k.descricao ? " · " + k.descricao : ""}
                  </p>
                  <ul className="text-sm my-2">
                    {k.itens.map((i, n) => (
                      <li key={n}>
                        {i.quantidade} × {i.produtoNome}
                      </li>
                    ))}
                  </ul>
                  <strong>{formatCurrency(k.precoVendaKit, currency)}</strong>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <button
                      type="button"
                      className="border p-2 rounded"
                      disabled={!k.ativo}
                      onClick={() => onInsertKit(k, "detalhado")}
                    >
                      Inserir componentes
                    </button>
                    <button
                      type="button"
                      className="bg-blue-700 text-white p-2 rounded"
                      disabled={!k.ativo}
                      onClick={() => {
                        if (
                          k.itens.some(
                            (i) =>
                              Boolean(i.ivaIsento) !==
                              Boolean(k.itens[0]?.ivaIsento),
                          )
                        ) {
                          setError(
                            "Este kit tem componentes com IVA diferente. Use Inserir componentes.",
                          );
                          return;
                        }
                        onInsertKit(k, "linha_unica");
                      }}
                    >
                      Inserir pelo preço do kit
                    </button>
                    {currentUser.role === "admin" && (
                      <>
                        <button
                          type="button"
                          className="text-blue-700"
                          onClick={() => edit(k)}
                        >
                          Editar kit
                        </button>
                        <button
                          type="button"
                          className="text-red-700"
                          disabled={busy}
                          onClick={async () => {
                            if (!window.confirm(`Remover o kit ${k.nome}?`))
                              return;
                            setBusy(true);
                            try {
                              await deleteKit(k.id);
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Remover kit
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

import { useState } from "react";
import PharmacyPOS from "./PharmacyPOS";
import type { Session } from "../../store/auth";
import { refreshRemote } from "../../store/hospital";
import { useClinical, delivered } from "../medicos/clinica/store";
import {
  button,
  hospitalApi,
  input,
  Notice,
  useResource,
} from "../comunicacao/shared";
interface Product {
  id: string;
  code: string;
  name: string;
  lot: string;
  expiry: string;
  stock: string;
  minimum: string;
  price: string;
}
function medicineKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export default function Farmacia({ session }: { session?: Session }) {
  const { state } = useClinical(session?.empresaId || ""),
    resource = useResource<{ products: Product[]; movements: any[] }>(
      "/pharmacy",
      { products: [], movements: [] },
    );
  const [tab, setTab] = useState("prescricoes"),
    [search, setSearch] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [f, setF] = useState({
      code: "",
      name: "",
      lot: "",
      expiry: "",
      stock: "0",
      minimum: "0",
      price: "0",
    }),
    [move, setMove] = useState({
      productId: "",
      quantity: "",
      reason: "",
      prescriptionId: "",
      itemId: "",
      requestId: "",
    });
  const canWrite = ["admin", "gestor", "farmaceutico"].includes(
    session?.funcao || "",
  );
  const filteredPrescriptions = state.prescriptions.filter((rx) =>
    [
      rx.patient.nome,
      rx.patient.processo,
      rx.patient.bi,
      rx.id,
      rx.doctor,
      rx.specialty,
      ...(rx.items || []).map((item) => item.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selectedPrescriptionItem = move.prescriptionId
    ? state.prescriptions
        .find((rx) => rx.id === move.prescriptionId)
        ?.items.find((item) => item.id === move.itemId)
    : undefined;
  const availableProducts = resource.data.products.filter(
    (product) =>
      !move.prescriptionId ||
      (!!selectedPrescriptionItem &&
        medicineKey(product.name) === medicineKey(selectedPrescriptionItem.name)),
  );
  async function run(fn: () => Promise<any>, success: string) {
    setBusy(true);
    try {
      await fn();
      await resource.load();
      await refreshRemote();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operação não confirmada.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 p-5">
      <header>
        <h1 className="text-2xl font-bold">Farmácia</h1>
        <p className="text-sm text-slate-500">
          Prescrições, inventário por lote e movimentos da instituição · mesma
          sessão do hospital
        </p>
      </header>
      <Notice error={resource.error} message={message} />
      <nav className="flex flex-wrap gap-2">
        {[
          ["prescricoes", "Prescrições recebidas"],
          ["stock", "Produtos e lotes"],
          ["movimentos", "Movimentos"],
          ...(canWrite ? [["pos", "Balcão POS"]] : []),
        ].map(([k, v]) => (
          <button key={k} className={button} onClick={() => setTab(k)}>
            {v}
          </button>
        ))}
      </nav>
      {tab === "pos" && canWrite ? (
        <PharmacyPOS key={session?.empresaId + ":" + session?.username} />
      ) : (
        <>
          <label className="block text-sm">
            Pesquisar
            <input
              className={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {tab === "prescricoes" ? (
            <div className="space-y-3">
              {filteredPrescriptions
                .slice()
                .reverse()
                .map((rx) => (
                  <article
                    className="space-y-3 rounded-xl border bg-white p-4"
                    key={rx.id}
                  >
                    <h2 className="font-bold">{rx.patient.nome}</h2>
                    <p className="text-xs text-slate-600">
                      Processo {rx.patient.processo || rx.patient.id} · BI{" "}
                      {rx.patient.bi || "não informado"} · Prescrição{" "}
                      {rx.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {rx.doctor} · {rx.registration} ·{" "}
                      {rx.specialty || "Especialidade não registada"} ·{" "}
                      {rx.cancelled
                        ? "SUSPENSA"
                        : new Date(rx.validUntil) < new Date()
                          ? "EXPIRADA"
                          : "Recebida"}
                    </p>
                    {rx.diagnosis && (
                      <p className="text-sm">
                        Diagnóstico associado: {rx.diagnosis}
                      </p>
                    )}
                    <p
                      className={
                        rx.patient.alergias
                          ? "rounded bg-amber-50 p-2 text-sm text-amber-900"
                          : "rounded bg-slate-50 p-2 text-sm text-slate-700"
                      }
                    >
                      Alergias:{" "}
                      {rx.patient.alergias ||
                        "Não informadas — confirmar antes de dispensar"}
                    </p>
                    {rx.items.map((item) => (
                      <div
                        className="flex flex-wrap justify-between gap-3 border-t pt-3"
                        key={item.id}
                      >
                        <div>
                          <strong className="text-sm">{item.name}</strong>
                          <p className="text-sm">
                            {item.dose} · {item.route} · {item.frequency} ·{" "}
                            {item.duration}
                          </p>
                          <p className="text-xs">
                            Prescrito: {item.quantity} · Entregue:{" "}
                            {delivered(state, rx.id, item.id)} ·{" "}
                            {item.instructions}
                          </p>
                        </div>
                        <button
                          className={button}
                          disabled={
                            !canWrite ||
                            busy ||
                            Boolean(rx.cancelled) ||
                            new Date(rx.validUntil) < new Date() ||
                            delivered(state, rx.id, item.id) >= item.quantity
                          }
                          onClick={() =>
                            setMove({
                              productId: "",
                              quantity: String(
                                -(
                                  item.quantity -
                                  delivered(state, rx.id, item.id)
                                ),
                              ),
                              reason: `Dispensa conferida de ${item.name}`,
                              prescriptionId: rx.id,
                              itemId: item.id,
                              requestId: crypto.randomUUID(),
                            })
                          }
                        >
                          Conferir e dispensar
                        </button>
                      </div>
                    ))}
                  </article>
                ))}
              {!filteredPrescriptions.length && (
                <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">
                  Nenhuma prescrição corresponde à pesquisa nesta instituição.
                </p>
              )}
            </div>
          ) : tab === "stock" ? (
            <>
              <form
                className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () => hospitalApi("POST", "/pharmacy", f),
                    "Produto/lote guardado.",
                  );
                }}
              >
                {Object.keys(f).map((key) => (
                  <label className="text-sm" key={key}>
                    {
                      (
                        {
                          code: "Código",
                          name: "Medicamento / apresentação",
                          lot: "Lote",
                          expiry: "Validade",
                          stock: "Stock inicial",
                          minimum: "Stock mínimo",
                          price: "Preço de venda",
                        } as any
                      )[key]
                    }
                    <input
                      className={input}
                      required
                      type={
                        ["stock", "minimum", "price"].includes(key)
                          ? "number"
                          : key === "expiry"
                            ? "date"
                            : "text"
                      }
                      min="0"
                      step="any"
                      value={f[key as keyof typeof f]}
                      onChange={(e) => setF({ ...f, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <button className={button} disabled={busy || !canWrite}>
                  Registar produto/lote
                </button>
              </form>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Produto",
                        "Lote / validade",
                        "Stock",
                        "Preço",
                        "Acção",
                      ].map((x) => (
                        <th scope="col" key={x} className="p-3">
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.products
                      .filter((p) =>
                        `${p.name} ${p.code} ${p.lot}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((p) => (
                        <tr className="border-t" key={p.id}>
                          <td className="p-3">
                            {p.name}
                            <p className="text-xs">{p.code}</p>
                          </td>
                          <td className="p-3">
                            {p.lot} · {String(p.expiry).slice(0, 10)}
                          </td>
                          <td
                            className={`p-3 ${Number(p.stock) <= Number(p.minimum) ? "font-bold text-red-700" : ""}`}
                          >
                            {p.stock}
                          </td>
                          <td className="p-3">
                            {Number(p.price).toLocaleString("pt-AO")} AOA
                          </td>
                          <td className="p-3">
                            <button
                              className={button}
                              disabled={busy || !canWrite}
                              onClick={() =>
                                setMove({
                                  productId: p.id,
                                  quantity: "",
                                  reason: "",
                                  prescriptionId: "",
                                  itemId: "",
                                  requestId: crypto.randomUUID(),
                                })
                              }
                            >
                              Movimentar
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {resource.data.movements.map((m) => (
                <article
                  className="rounded-xl border bg-white p-3 text-sm"
                  key={m.id}
                >
                  {
                    resource.data.products.find((p) => p.id === m.product_id)
                      ?.name
                  }{" "}
                  · {m.quantity} · {m.reason}
                  <p className="text-xs text-slate-500">
                    {m.actor} · {new Date(m.created_at).toLocaleString("pt-AO")}
                  </p>
                </article>
              ))}
            </div>
          )}
          {move.requestId && (
            <form
              className="space-y-3 rounded-xl border-2 border-teal-600 bg-white p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !confirm(
                    "Confirma paciente, medicamento/apresentação, quantidade e lote seleccionado?",
                  )
                )
                  return;
                void run(async () => {
                  await hospitalApi("POST", "/pharmacy/move", {
                    ...move,
                    quantity: Number(move.quantity),
                  });
                  setMove({ ...move, requestId: "" });
                }, "Movimento confirmado; stock e saldo da prescrição actualizados juntos.");
              }}
            >
              <h2 className="font-bold">Conferência e movimento de stock</h2>
              <label className="block text-sm">
                Produto e lote
                <select
                  required
                  className={input}
                  value={move.productId}
                  onChange={(e) =>
                    setMove({ ...move, productId: e.target.value })
                  }
                >
                  <option value="">
                    Seleccione o medicamento/apresentação que conferiu
                  </option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.lot} · Validade{" "}
                      {String(p.expiry).slice(0, 10)} · Stock {p.stock}
                    </option>
                  ))}
                </select>
              </label>
              {move.prescriptionId && !availableProducts.length && (
                <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">
                  Não existe lote no stock com a mesma designação do
                  medicamento prescrito. Actualize o catálogo ou confirme a
                  prescrição antes de dispensar.
                </p>
              )}
              <label className="block text-sm">
                Quantidade (saída negativa, entrada positiva)
                <input
                  required
                  type="number"
                  step="0.001"
                  max={move.prescriptionId ? -0.001 : undefined}
                  className={input}
                  value={move.quantity}
                  onChange={(e) =>
                    setMove({ ...move, quantity: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                Motivo
                <input
                  required
                  className={input}
                  value={move.reason}
                  onChange={(e) => setMove({ ...move, reason: e.target.value })}
                />
              </label>
              <button
                className={button}
                disabled={
                  busy ||
                  !canWrite ||
                  (Boolean(move.prescriptionId) && !selectedPrescriptionItem)
                }
              >
                Confirmar no servidor
              </button>
              <button
                type="button"
                className="ml-3 underline"
                disabled={busy}
                onClick={() => setMove({ ...move, requestId: "" })}
              >
                Voltar
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}

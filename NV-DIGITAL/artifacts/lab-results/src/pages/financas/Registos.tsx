import { useState } from "react";
import {
  button,
  hospitalApi,
  input,
  Notice,
  useResource,
} from "../comunicacao/shared";
interface Field {
  key: string;
  label: string;
  type?: string;
}
const definitions: Record<string, { title: string; fields: Field[] }> = {
  purchases: {
    title: "Pedidos de compra",
    fields: [
      { key: "name", label: "Fornecedor" },
      { key: "reference", label: "Artigo / serviço solicitado" },
      { key: "quantity", label: "Quantidade", type: "number" },
      { key: "cost", label: "Custo unitário (Kz)", type: "number" },
      { key: "date", label: "Data", type: "date" },
      { key: "notes", label: "Justificação e condições" },
    ],
  },
  imaging: {
    title: "Imagiologia · pedidos e relatórios",
    fields: [
      { key: "name", label: "Paciente / processo" },
      { key: "reference", label: "Exame / pedido" },
      { key: "professional", label: "Profissional responsável" },
      { key: "date", label: "Data", type: "date" },
      { key: "notes", label: "Relatório / conclusão" },
    ],
  },
};
export default function Registos({ kind }: { kind: string }) {
  const config = definitions[kind],
    resource = useResource<any[]>("/records/" + kind, []),
    [form, setForm] = useState<Record<string, string>>({}),
    [edit, setEdit] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  async function submit() {
    setBusy(true);
    try {
      await hospitalApi("POST", "/records/" + kind, {
        id: edit?.id || crypto.randomUUID(),
        revision: edit?.revision || 0,
        data: { ...form, status: form.status || "pendente" },
      });
      await resource.load();
      setForm({});
      setEdit(null);
      setMessage("Registo confirmado no servidor.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 p-5">
      <h1 className="text-2xl font-bold">{config.title}</h1>
      <Notice error={resource.error} message={message} />
      <form
        className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {config.fields.map((f) => (
          <label key={f.key} className="text-sm">
            {f.label}
            {f.key === "notes" ? (
              <textarea
                className={input}
                value={form[f.key] || ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <input
                required
                className={input}
                min={f.type === "number" ? 0 : undefined}
                step="any"
                type={f.type || "text"}
                value={form[f.key] || ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            )}
          </label>
        ))}
        <label className="text-sm">
          Estado
          <select
            className={input}
            value={form.status || "pendente"}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <button className={button} disabled={busy}>
          {edit ? "Guardar alteração" : "Criar registo"}
        </button>
      </form>
      <label className="block text-sm">
        Pesquisar registos
        <input
          className={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {resource.data
        .filter((r) =>
          JSON.stringify(r.data).toLowerCase().includes(query.toLowerCase()),
        )
        .map((r) => (
          <article
            className="space-y-2 rounded-xl border bg-white p-4"
            key={r.id}
          >
            <strong>{r.data.name}</strong>
            <dl className="grid gap-1 text-sm md:grid-cols-2">
              {config.fields
                .filter((f) => f.key !== "name")
                .map((f) => (
                  <div key={f.key}>
                    <dt className="inline text-slate-500">{f.label}: </dt>
                    <dd className="inline whitespace-pre-wrap">
                      {r.data[f.key]}
                    </dd>
                  </div>
                ))}
            </dl>
            {kind === "payroll" && (
              <p className="font-semibold">
                Líquido:{" "}
                {(
                  Number(r.data.base || 0) +
                  Number(r.data.extras || 0) -
                  Number(r.data.deductions || 0)
                ).toLocaleString("pt-AO")}{" "}
                Kz
              </p>
            )}
            {kind === "purchases" && (
              <p>
                Total:{" "}
                {(Number(r.data.quantity) * Number(r.data.cost)).toLocaleString(
                  "pt-AO",
                )}{" "}
                Kz
              </p>
            )}
            <p className="text-xs text-slate-500">
              {r.data.status} · Revisão {r.revision}
            </p>
            <button
              className={button}
              onClick={() => {
                setEdit(r);
                setForm({ ...r.data });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Editar registo
            </button>
          </article>
        ))}
      {!resource.loading && !resource.error && !resource.data.length && (
        <p>Sem registos nesta instituição.</p>
      )}
    </section>
  );
}

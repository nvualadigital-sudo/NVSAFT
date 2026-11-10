import { useState, useRef } from "react";
import {
  FlaskConical,
  ScanLine,
  Plus,
  ArrowLeft,
  ClipboardCheck,
} from "lucide-react";
import type { Session } from "../../store/auth";
import { useApp } from "../../store/AppContext";
import { patientDisplayReference } from "../../utils/displayReference";
import {
  Panel,
  Field,
  Feedback,
  useAction,
  hospitalApi,
  useResource,
  dataForm,
  Status,
  Empty,
  Pagination,
  dateTime,
} from "../../components/hospital/Workspace";
import Catalogo from "./operacional/Catalogo";
import Rastreabilidade from "./operacional/Rastreabilidade";
export default function CircuitoLaboratorial({
  session,
  initialPatientId,
  initialEpisodeId,
  initialOrderId,
}: {
  session: Session;
  initialPatientId?: number;
  initialEpisodeId?: string;
  initialOrderId?: string;
}) {
  const [tab, setTab] = useState("pedidos"),
    [selected, setSelected] = useState(initialOrderId || ""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [newOrder, setNewOrder] = useState(!!initialPatientId);
  const orders = useResource<any[]>(
      `/lab/orders?page=${page}&q=${encodeURIComponent(query)}`,
      [],
    ),
    catalog = useResource<any[]>("/lab/catalog", []),
    metrics = useResource<any>("/lab/indicators", null),
    action = useAction(),
    { data } = useApp();
  const requestId = useRef(crypto.randomUUID());
  return (
    <div className="nv-workspace">
      <header className="nv-page-head">
        <div className="nv-page-icon">
          <FlaskConical />
        </div>
        <div>
          <span className="nv-eyebrow">
            DIAGNÓSTICO · {session.empresaNome}
          </span>
          <h1>Laboratório</h1>
          <p>Pedidos, colheitas, rastreabilidade e validação de resultados</p>
        </div>
        <button
          className="nv-btn"
          onClick={() => {
            setSelected("");
            setTab("pedidos");
            setNewOrder((x) => !x);
          }}
        >
          <Plus size={16} />
          Novo pedido
        </button>
      </header>
      <nav className="nv-tabs" aria-label="Laboratório">
        {[
          ["pedidos", "Pedidos e amostras"],
          ["catalogo", "Catálogo aprovado"],
          ["qualidade", "Qualidade e equipamento"],
          ["indicadores", "Indicadores"],
          ["numeracao", "Numeração"],
        ].map(([k, l]) => (
          <button
            key={k}
            aria-current={tab === k ? "page" : undefined}
            onClick={() => {
              setTab(k);
              setSelected("");
            }}
          >
            {l}
          </button>
        ))}
      </nav>
      <Feedback error={action.error} message={action.message} />
      {tab === "catalogo" ? (
        <Catalogo />
      ) : tab === "qualidade" ? (
        <Qualidade />
      ) : tab === "numeracao" ? (
        <Numeracao />
      ) : tab === "indicadores" ? (
        <Panel title="Qualidade do circuito">
          <Feedback error={metrics.error} />
          {metrics.data && (
            <>
              <div className="nv-stats">
                {[
                  ["Recipientes", metrics.data.total],
                  ["Por colher", metrics.data.awaiting],
                  ["Em processamento", metrics.data.processing],
                  ["Rejeitados", metrics.data.rejected],
                  ["Reimpressões", metrics.data.reprints],
                  [
                    "Críticos sem confirmação",
                    metrics.data.criticalUnacknowledged,
                  ],
                ].map(([k, v]) => (
                  <div className="nv-stat" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <p>
                Tempo médio de transporte:{" "}
                {metrics.data.transport_minutes ?? "Sem medições"} min
              </p>
              <p className="nv-help">
                Origem: {metrics.data.source} · Actualizado{" "}
                {dateTime(metrics.data.updatedAt)}. Indicadores de todo o
                histórico desta instituição.
              </p>
            </>
          )}
        </Panel>
      ) : selected ? (
        <>
          <button
            className="nv-btn nv-btn-secondary"
            onClick={() => setSelected("")}
          >
            <ArrowLeft size={16} />
            Voltar aos pedidos
          </button>
          <Rastreabilidade
            id={selected}
            initialTab={initialOrderId ? "resultados" : undefined}
            institution={
              data.config.nomeClinica || session.empresaNome || "Instituição"
            }
          />
        </>
      ) : (
        <>
          {newOrder && (
            <Panel title="Pedido laboratorial">
              <form
                className="nv-form"
                onSubmit={(e) => {
                  const form = e.currentTarget,
                    body = dataForm(e),
                    tests = new FormData(form).getAll("tests");
                  void action.run(async () => {
                    const result = await hospitalApi<any>(
                      "POST",
                      "/lab/orders",
                      {
                        ...body,
                        patientId: Number(body.patientId),
                        tests,
                        requestId: requestId.current,
                      },
                    );
                    requestId.current = crypto.randomUUID();
                    setNewOrder(false);
                    setSelected(result.id);
                    await orders.load();
                  }, "Pedido e recipientes criados.");
                }}
              >
                <div className="nv-form-grid">
                  <Field label="Paciente do cadastro central" name="patientId">
                    <select
                      name="patientId"
                      required
                      defaultValue={initialPatientId || ""}
                    >
                      <option value="" disabled>
                        Seleccionar paciente
                      </option>
                      {data.pacientes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} · Processo {patientDisplayReference(p)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Episódio clínico (UUID, quando aplicável)"
                    name="episodeId"
                    defaultValue={initialEpisodeId}
                  />
                  <Field
                    label="Serviço / origem da colheita"
                    name="origin"
                    required
                  />
                  <Field label="Prioridade" name="priority">
                    <select name="priority">
                      <option value="rotina">Rotina</option>
                      <option value="urgente">Urgente</option>
                      <option value="emergente">Emergente</option>
                    </select>
                  </Field>
                </div>
                <Field
                  label="Indicação / informações necessárias ao exame"
                  name="indication"
                  required
                  type="textarea"
                />
                <fieldset className="nv-fieldset">
                  <legend>Análises vigentes</legend>
                  {catalog.data
                    .filter((t) => t.approved_at && !t.retired_at)
                    .map((t) => (
                      <label className="nv-check" key={t.id}>
                        <input name="tests" value={t.id} type="checkbox" />
                        {t.code} · {t.data.name} · {t.data.material} /{" "}
                        {t.data.container}
                      </label>
                    ))}
                  {!catalog.data.some(
                    (t) => t.approved_at && !t.retired_at,
                  ) && (
                    <Empty>
                      É necessário aprovar o catálogo institucional antes de
                      pedir exames.
                    </Empty>
                  )}
                </fieldset>
                <button className="nv-btn" disabled={action.busy}>
                  Confirmar pedido
                </button>
              </form>
            </Panel>
          )}
          <div className="nv-toolbar">
            <label className="nv-search">
              <ScanLine size={18} />
              <input
                placeholder="Nome, processo, pedido ou amostra…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                aria-label="Pesquisar pedidos"
              />
            </label>
            <form
              className="nv-actions"
              onSubmit={(e) => {
                const body = dataForm(e);
                void action.run(async () => {
                  const found = await hospitalApi<any>(
                    "GET",
                    "/lab/scan?code=" + encodeURIComponent(body.code.trim()),
                  );
                  setSelected(found.order_id);
                });
              }}
            >
              <input
                name="code"
                className="nv-input"
                placeholder="Ler ou escrever o código da amostra"
                aria-label="Código do recipiente"
                required
                autoComplete="off"
              />
              <button
                className="nv-btn nv-btn-secondary"
                disabled={action.busy}
              >
                Localizar
              </button>
            </form>
          </div>
          <Feedback error={orders.error} />
          <Panel
            title="Fila de pedidos"
            actions={<Status>{orders.data.length} nesta página</Status>}
          >
            <div className="nv-table-wrap">
              <table className="nv-table">
                <thead>
                  <tr>
                    <th>Paciente / identificação</th>
                    <th>Pedido</th>
                    <th>Prioridade</th>
                    <th>Origem</th>
                    <th>Recipientes</th>
                    <th>Criado em</th>
                    <th>Acção</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.patient_name}</strong>
                        <small>Processo {o.processo || "—"}</small>
                      </td>
                      <td>
                        <code className="break-all" title={o.accession}>
                          {o.accession}
                        </code>
                        {o.cancelled_at && <Status>Cancelado</Status>}
                      </td>
                      <td>
                        <Status>{o.priority}</Status>
                      </td>
                      <td>{o.origin}</td>
                      <td>{o.containers}</td>
                      <td>{dateTime(o.created_at)}</td>
                      <td>
                        <button
                          className="nv-btn nv-btn-secondary"
                          onClick={() => setSelected(o.id)}
                        >
                          Abrir circuito
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!orders.loading && !orders.data.length && (
              <Empty>
                Nenhum pedido encontrado. Os pedidos registados aparecem aqui.
              </Empty>
            )}
            <Pagination
              page={page}
              setPage={setPage}
              length={orders.data.length}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
function Numeracao() {
  const settings = useResource<{ prefix: string; canEdit: boolean } | null>(
    "/lab/numbering",
    null,
  );
  const action = useAction();
  const [draft, setDraft] = useState<string | null>(null);
  const prefix = settings.data?.prefix;
  return (
    <Panel title="Referências da instituição">
      <Feedback
        error={settings.error || action.error}
        message={action.message}
      />
      {prefix && (
        <div className="nv-stack">
          <p>
            Prefixo em uso: <strong>{prefix}</strong> · Formato:{" "}
            <code>{prefix}/001</code>
          </p>
          <p>
            O processo identifica o paciente. O pedido e cada recipiente recebem
            referências próprias. A numeração é contínua e os códigos já
            emitidos são conservados.
          </p>
          {settings.data?.canEdit && (
            <form
              className="nv-actions"
              onSubmit={(e) => {
                const body = dataForm(e);
                void action.run(async () => {
                  await hospitalApi("PUT", "/lab/numbering", {
                    prefix: body.prefix,
                  });
                  await settings.load();
                  setDraft(null);
                }, "Prefixo guardado. Aplica-se às próximas referências.");
              }}
            >
              <Field
                label="Prefixo"
                name="prefix"
                required
                pattern="[A-Z][A-Z0-9]{1,9}"
                maxLength={10}
                value={draft ?? prefix}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDraft(e.target.value.toUpperCase())
                }
              />
              <button className="nv-btn" disabled={action.busy}>
                Guardar prefixo
              </button>
            </form>
          )}
        </div>
      )}
    </Panel>
  );
}

function Qualidade() {
  const list = useResource<any[]>("/lab/quality", []),
    action = useAction();
  return (
    <div className="nv-split">
      <Panel title="Registar controlo / disponibilidade">
        <Feedback error={action.error} message={action.message} />
        <form
          className="nv-form"
          onSubmit={(e) => {
            const body = dataForm(e);
            void action.run(async () => {
              await hospitalApi("POST", "/lab/quality", {
                ...body,
                validUntil: new Date(body.validUntil).toISOString(),
              });
              await list.load();
            });
          }}
        >
          <Field
            label="Sector (exactamente como no catálogo)"
            name="sector"
            required
          />
          <Field label="Equipamento / bancada" name="equipment" required />
          <Field label="Lote do reagente" name="reagentLot" required />
          <Field label="Decisão técnica" name="outcome">
            <select name="outcome">
              <option value="aprovado">Aprovado</option>
              <option value="reprovado">Reprovado</option>
              <option value="bloqueado">Equipamento bloqueado</option>
            </select>
          </Field>
          <Field
            label="Válido até"
            name="validUntil"
            required
            type="datetime-local"
          />
          <Field
            label="Resultados do controlo, critérios e acção correctiva"
            name="note"
            required
            type="textarea"
          />
          <p className="nv-help">
            A validação consulta o controlo mais recente para o sector,
            equipamento e lote. CQ reprovado ou expirado bloqueia a libertação.
          </p>
          <button className="nv-btn" disabled={action.busy}>
            <ClipboardCheck size={16} />
            Registar decisão
          </button>
        </form>
      </Panel>
      <Panel title="Histórico de qualidade">
        <Feedback error={list.error} />
        {list.data.map((q) => (
          <article className="nv-list-item" key={q.id}>
            <strong>
              {q.sector} · {q.equipment}
            </strong>
            <p>
              Lote {q.reagent_lot} · <Status>{q.outcome}</Status>
            </p>
            <p>{q.note}</p>
            <small>
              {q.actor} · {dateTime(q.created_at)} · validade{" "}
              {dateTime(q.valid_until)}
            </small>
          </article>
        ))}
        {!list.data.length && <Empty>Sem controlos registados.</Empty>}
      </Panel>
    </div>
  );
}

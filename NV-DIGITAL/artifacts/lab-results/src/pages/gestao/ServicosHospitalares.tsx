import HRWorkspace from "../../modules/rh/HRWorkspace";
import { useState } from "react";
import { SERVICE_DEFINITIONS, INSTITUTION_PROFILES } from "@workspace/api-zod";
import { Activity, Plus, History, Save, ArrowLeft } from "lucide-react";
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
export default function ServicosHospitalares({
  session,
  initialHRTab,
}: {
  session: Session;
  initialHRTab?: string;
}) {
  const hrAccess = useResource<any>("/hr/access", null);
  const settings = useResource<any>("/institution", null),
    [kind, setKind] = useState(initialHRTab ? "escalas" : "");
  const configured = (settings.data?.data.services || []).filter(
    (k: string) => {
      const s = SERVICE_DEFINITIONS[k];
      return (
        (s?.roles.includes(session.funcao || "") ||
          (k === "escalas" &&
            session.funcao === "enfermeiro" &&
            (hrAccess.data?.canSchedule || hrAccess.data?.canPayroll))) &&
        (k !== "escalas" ||
          session.funcao !== "enfermeiro" ||
          hrAccess.data?.canSchedule ||
          hrAccess.data?.canPayroll) &&
        (!s.permission ||
          settings.data.permissions.some(
            (p: any) => p.permission === s.permission,
          ))
      );
    },
  );
  const current = configured.includes(kind) ? kind : configured[0];
  return (
    <div className="nv-workspace">
      <header className="nv-page-head">
        <div className="nv-page-icon">
          <Activity />
        </div>
        <div>
          <span className="nv-eyebrow">
            GESTÃO HOSPITALAR · {session.empresaNome}
          </span>
          <h1>Serviços e percursos assistenciais</h1>
          <p>
            {INSTITUTION_PROFILES.find(
              (p) => p.id === settings.data?.data.profile,
            )?.label || "Configuração institucional"}
          </p>
        </div>
      </header>
      <Feedback error={settings.error} />
      {configured.length ? (
        <>
          <nav className="nv-tabs" aria-label="Serviços activos">
            {configured.map((k: string) => (
              <button
                key={k}
                aria-current={current === k ? "page" : undefined}
                onClick={() => setKind(k)}
              >
                {SERVICE_DEFINITIONS[k].label}
              </button>
            ))}
          </nav>
          {current === "escalas" ? (
            <HRWorkspace session={session} initialTab={initialHRTab} />
          ) : (
            <ServiceWorkspace key={current} kind={current} session={session} />
          )}
        </>
      ) : (
        <Empty>
          Sem serviços opcionais activados para a sua função. O responsável pode
          configurar os serviços e autorizações em Administração → Instituição e
          acessos.
        </Empty>
      )}
    </div>
  );
}
function ServiceWorkspace({
  kind,
  session,
}: {
  kind: string;
  session: Session;
}) {
  const spec = SERVICE_DEFINITIONS[kind],
    { data } = useApp(),
    [page, setPage] = useState(0),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [historyId, setHistoryId] = useState("");
  const list = useResource<any[]>(`/services/${kind}?page=${page}`, []),
    action = useAction();
  const visible = list.data.filter((c) =>
    `${c.reference} ${c.title} ${c.patient_name || ""} ${c.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="nv-stack">
      <Feedback error={action.error || list.error} message={action.message} />
      <div className="nv-toolbar">
        <input
          className="nv-input"
          placeholder="Pesquisar nesta página"
          aria-label="Pesquisar registos"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="nv-btn"
          onClick={() => {
            setHistoryId("");
            setEditing({
              id: crypto.randomUUID(),
              revision: 0,
              status: "aberto",
              assigned_to: session.username,
              data: {},
            });
          }}
        >
          <Plus size={16} />
          Novo registo
        </button>
      </div>
      {historyId && (
        <CaseHistory
          kind={kind}
          id={historyId}
          close={() => setHistoryId("")}
        />
      )}
      {editing && (
        <Panel
          title={
            editing.revision
              ? `Editar ${editing.reference}`
              : `Novo · ${spec.label}`
          }
          actions={
            <button
              className="nv-btn nv-btn-secondary"
              onClick={() => setEditing(null)}
            >
              Fechar formulário
            </button>
          }
        >
          <form
            className="nv-form"
            key={editing.id + editing.revision}
            onSubmit={(e) => {
              const body = dataForm(e);
              void action.run(async () => {
                const result = await hospitalApi<any>(
                  "PUT",
                  `/services/${kind}/${editing.id}`,
                  {
                    title: body.title,
                    status: body.status,
                    patientId: body.patientId ? Number(body.patientId) : null,
                    episodeId: body.episodeId || null,
                    assignedTo: body.assignedTo,
                    reason: body.reason,
                    revision: editing.revision,
                    data: Object.fromEntries(
                      spec.fields.map((f) => [f.key, body[f.key] || ""]),
                    ),
                  },
                );
                setEditing(result);
                await list.load();
              }, "Registo confirmado e versão conservada no histórico.");
            }}
          >
            <div className="nv-form-grid">
              <Field
                label="Título / motivo do registo"
                name="title"
                defaultValue={editing.title}
                required
              />
              {spec.patient && (
                <Field label="Paciente do cadastro central" name="patientId">
                  <select
                    name="patientId"
                    required
                    defaultValue={editing.patient_id || ""}
                    disabled={editing.revision > 0}
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
                  {editing.revision > 0 && (
                    <input
                      type="hidden"
                      name="patientId"
                      value={editing.patient_id}
                    />
                  )}
                </Field>
              )}
              {spec.patient && (
                <Field
                  label="Episódio (UUID, quando aplicável)"
                  name="episodeId"
                  defaultValue={editing.episode_id || ""}
                  readOnly={editing.revision > 0}
                />
              )}
              <Field
                label="Responsável (conta individual)"
                name="assignedTo"
                required
                defaultValue={editing.assigned_to}
              />
              <Field label="Estado" name="status">
                <select name="status" defaultValue={editing.status}>
                  <option value="aberto">Aberto</option>
                  <option value="em_curso">Em curso</option>
                  <option value="concluido">Concluído / assinado</option>
                  <option value="cancelado">Cancelado com motivo</option>
                </select>
              </Field>
            </div>
            <fieldset className="nv-fieldset">
              <legend>{spec.label}</legend>
              <div className="nv-form-grid">
                {spec.fields.map((f) => (
                  <Field
                    key={f.key}
                    name={f.key}
                    label={f.label}
                    type={f.type || "text"}
                    required={f.required}
                    defaultValue={editing.data[f.key] || ""}
                    step={f.type === "number" ? "any" : undefined}
                  />
                ))}
              </div>
            </fieldset>
            <Field
              label="Motivo desta criação / alteração / encerramento"
              name="reason"
              required
              type="textarea"
            />
            <p className="nv-help">
              Registos concluídos preservam o conteúdo e a autoria. A avaliação
              e os parâmetros clínicos são registados pelo profissional segundo
              os protocolos aprovados da instituição.
            </p>
            <button className="nv-btn" disabled={action.busy}>
              <Save size={16} />
              {action.busy ? "A confirmar…" : "Guardar versão"}
            </button>
          </form>
        </Panel>
      )}
      <Panel
        title={spec.label}
        actions={<Status>{list.data.length} nesta página</Status>}
      >
        <div className="nv-table-wrap">
          <table className="nv-table">
            <thead>
              <tr>
                <th>Referência</th>
                <th>Registo / paciente</th>
                <th>Responsável</th>
                <th>Estado</th>
                <th>Actualização</th>
                <th>Acções</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code>{c.reference}</code>
                  </td>
                  <td>
                    <strong>{c.title}</strong>
                    <small>{c.patient_name || "Registo operacional"}</small>
                  </td>
                  <td>{c.assigned_to}</td>
                  <td>
                    <Status>{c.status.replaceAll("_", " ")}</Status>
                  </td>
                  <td>{dateTime(c.updated_at)}</td>
                  <td>
                    <div className="nv-actions">
                      <button
                        className="nv-btn nv-btn-secondary"
                        onClick={() => setHistoryId(c.id)}
                      >
                        <History size={14} />
                        Histórico
                      </button>
                      {!["concluido", "cancelado"].includes(c.status) && (
                        <button
                          className="nv-btn nv-btn-secondary"
                          onClick={() => {
                            setEditing(c);
                            setHistoryId("");
                          }}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <Empty>Sem registos encontrados neste serviço.</Empty>
        )}
        <Pagination
          page={page}
          setPage={setPage}
          length={list.data.length}
          size={100}
        />
      </Panel>
    </div>
  );
}
function CaseHistory({
  kind,
  id,
  close,
}: {
  kind: string;
  id: string;
  close: () => void;
}) {
  const list = useResource<any[]>(`/services/${kind}/${id}/history`, []);
  return (
    <Panel
      title="Histórico e conteúdo das versões"
      actions={
        <button className="nv-btn nv-btn-secondary" onClick={close}>
          <ArrowLeft size={16} />
          Fechar
        </button>
      }
    >
      <Feedback error={list.error} />
      <div className="nv-timeline">
        {list.data.map((e) => (
          <article key={e.id}>
            <time>{dateTime(e.created_at)}</time>
            <strong>
              {e.actor} · versão {e.snapshot.revision} · {e.snapshot.status}
            </strong>
            <p>{e.note}</p>
            <dl className="nv-meta">
              {SERVICE_DEFINITIONS[kind].fields.map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{e.snapshot.data[f.key] || "—"}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </Panel>
  );
}

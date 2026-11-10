import { useState } from "react";
import { SERVICE_DEFINITIONS, INSTITUTION_PROFILES } from "@workspace/api-zod";
import { ShieldCheck, Building2, Users, KeyRound, History } from "lucide-react";
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
  dateTime,
} from "../../components/hospital/Workspace";
export default function Instituicao() {
  const config = useResource<any>("/institution", null),
    access = useResource<any>("/access", null),
    action = useAction(),
    [tab, setTab] = useState("instituicao"),
    [professional, setProfessional] = useState("");
  const tabs = [
    ["instituicao", "Instituição e serviços", Building2],
    ["profissionais", "Profissionais e credenciais", Users],
    ["acessos", "Autorizações e sessões", KeyRound],
    ["auditoria", "Auditoria", History],
  ] as const;
  const selected = access.data?.professionals.find(
    (p: any) => p.funcionario_id === professional,
  );
  return (
    <div className="nv-workspace">
      <header className="nv-page-head">
        <div className="nv-page-icon">
          <ShieldCheck />
        </div>
        <div>
          <span className="nv-eyebrow">ADMINISTRAÇÃO E SEGURANÇA</span>
          <h1>Instituição, profissionais e acessos</h1>
          <p>
            Serviços activados, credenciais verificadas e autorizações com
            validade
          </p>
        </div>
      </header>
      <nav className="nv-tabs" aria-label="Administração institucional">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      <Feedback
        error={config.error || access.error || action.error}
        message={action.message}
      />
      {tab === "auditoria" ? (
        <Auditoria />
      ) : tab === "instituicao" ? (
        config.data && (
          <Panel title="Configuração institucional">
            <form
              className="nv-form"
              key={config.data.revision}
              onSubmit={(e) => {
                const body = dataForm(e),
                  services = new FormData(e.currentTarget).getAll("services");
                void action.run(async () => {
                  await hospitalApi("PUT", "/institution", {
                    revision: config.data.revision,
                    data: {
                      profile: body.profile,
                      services,
                      labSectors: body.labSectors
                        .split("\n")
                        .map((s: string) => s.trim())
                        .filter(Boolean),
                      specialties: body.specialties
                        .split("\n")
                        .map((s: string) => s.trim())
                        .filter(Boolean),
                      protocolReference: body.protocolReference,
                    },
                  });
                  await config.load();
                });
              }}
            >
              <Field label="Perfil institucional" name="profile">
                <select name="profile" defaultValue={config.data.data.profile}>
                  {INSTITUTION_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <fieldset className="nv-fieldset">
                <legend>Serviços realmente utilizados pela instituição</legend>
                <div className="nv-form-grid">
                  {Object.entries(SERVICE_DEFINITIONS).map(([key, spec]) => (
                    <label className="nv-check" key={key}>
                      <input
                        type="checkbox"
                        name="services"
                        value={key}
                        defaultChecked={config.data.data.services?.includes(
                          key,
                        )}
                      />
                      {spec.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="nv-form-grid">
                <Field
                  label="Sectores laboratoriais activos (um por linha)"
                  name="labSectors"
                  type="textarea"
                  defaultValue={(config.data.data.labSectors || []).join("\n")}
                />
                <Field
                  label="Especialidades do atendimento clínico (uma por linha)"
                  name="specialties"
                  type="textarea"
                  defaultValue={(config.data.data.specialties || []).join("\n")}
                />
              </div>
              <Field
                label="Referência dos protocolos e aprovação institucional"
                name="protocolReference"
                type="textarea"
                defaultValue={config.data.data.protocolReference}
              />
              <button className="nv-btn" disabled={action.busy}>
                Guardar configuração
              </button>
            </form>
          </Panel>
        )
      ) : tab === "profissionais" ? (
        access.data && (
          <div className="nv-split">
            <Panel title="Contas e cadastro profissional">
              <div className="nv-list">
                {access.data.users.map((u: any) => (
                  <button
                    className={
                      "nv-list-item nv-select " +
                      (professional === u.id ? "is-selected" : "")
                    }
                    key={u.id}
                    onClick={() => setProfessional(u.id)}
                  >
                    <strong>{u.nome}</strong>
                    <small>
                      {u.username} · {u.funcao}
                    </small>
                    <Status>
                      {u.ativo ? "Conta activa" : "Conta suspensa"}
                    </Status>
                  </button>
                ))}
              </div>
              {!access.data.users.length && (
                <Empty>
                  Crie contas individuais em Funcionários antes de registar as
                  credenciais.
                </Empty>
              )}
            </Panel>
            {professional && (
              <Panel title="Verificação de credencial">
                <form
                  key={professional + selected?.revision}
                  className="nv-form"
                  onSubmit={(e) => {
                    const body = dataForm(e);
                    void action.run(async () => {
                      await hospitalApi(
                        "PUT",
                        "/professionals/" + professional,
                        { revision: selected?.revision || 0, data: body },
                      );
                      await access.load();
                    });
                  }}
                >
                  {[
                    ["category", "Categoria profissional"],
                    ["specialties", "Especialidades verificadas"],
                    ["credential", "Cédula / licença"],
                    ["service", "Serviço / unidade"],
                    ["contract", "Vínculo"],
                    ["validUntil", "Validade", "date"],
                    ["verification", "Evidência de verificação", "textarea"],
                  ].map(([name, label, type]) => (
                    <Field
                      key={name}
                      name={name}
                      label={label}
                      type={type || "text"}
                      required
                      defaultValue={
                        name === "validUntil"
                          ? selected?.data[name]?.slice(0, 10)
                          : selected?.data[name]
                      }
                    />
                  ))}
                  <Field label="Situação profissional" name="status">
                    <select
                      name="status"
                      required
                      defaultValue={selected?.data.status || "pendente"}
                    >
                      <option value="pendente" disabled>Pendente de verificação — seleccione a decisão</option>
                      <option value="activo">Activo</option>
                      <option value="suspenso">Suspenso</option>
                      <option value="desligado">Desligado</option>
                    </select>
                  </Field>
                  <p className="nv-help">
                    Suspender/desligar bloqueia a conta, revoga sessões e
                    autorizações. A reactivação da conta exige revisão explícita
                    em Funcionários.
                  </p>
                  <button className="nv-btn" disabled={action.busy}>
                    Guardar verificação
                  </button>
                </form>
              </Panel>
            )}
          </div>
        )
      ) : (
        access.data && (
          <div className="nv-stack">
            <div className="nv-split">
              <Panel title="Delegar competência por prazo">
                <form
                  className="nv-form"
                  onSubmit={(e) => {
                    const body = dataForm(e);
                    void action.run(async () => {
                      await hospitalApi("POST", "/access/grants", {
                        ...body,
                        expiresAt: new Date(body.expiresAt).toISOString(),
                      });
                      await access.load();
                    });
                  }}
                >
                  <Field label="Conta individual" name="actor">
                    <select name="actor" required defaultValue="">
                      <option value="" disabled>
                        Seleccionar
                      </option>
                      {access.data.users
                        .filter((u: any) => u.ativo)
                        .map((u: any) => (
                          <option key={u.id} value={u.username}>
                            {u.nome} · {u.funcao}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Competência" name="permission">
                    <select name="permission">
                      {access.data.permissions.map((p: string) => (
                        <option key={p} value={p}>
                          {p === "lab.validate.solo" ? "Director Técnico / substituto autorizado (técnico único)" : p}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Expira em"
                    name="expiresAt"
                    type="datetime-local"
                    required
                  />
                  <Field
                    label="Justificação e referência da autorização"
                    name="reason"
                    required
                    type="textarea"
                  />
                  <p className="nv-help">
                    Não é possível autorizar a própria conta. Competências
                    laboratoriais exigem credencial verificada e vigente.
                    A nomeação excepcional de um técnico como substituto autorizado
                    exige decisão institucional fundamentada, validade até 90 dias
                    e não dispensa revisão independente de resultados críticos
                    ou de validação clínica obrigatória.
                  </p>
                  <button className="nv-btn" disabled={action.busy}>
                    Conceder autorização
                  </button>
                </form>
              </Panel>
              <Panel title="Sessões em validade">
                <div className="nv-list">
                  {access.data.sessions.map((s: any) => (
                    <div className="nv-list-item" key={s.id}>
                      <strong>{s.actor}</strong>
                      <small>Validade: {dateTime(s.expires_at)}</small>
                      {s.revoked_at ? (
                        <Status>Revogada</Status>
                      ) : (
                        <button
                          className="nv-btn nv-btn-secondary"
                          disabled={action.busy}
                          onClick={() => {
                            const reason = prompt(
                              "Motivo da revogação da sessão",
                            );
                            if (reason)
                              void action.run(async () => {
                                await hospitalApi(
                                  "POST",
                                  `/access/sessions/${s.id}/revoke`,
                                  { reason },
                                );
                                await access.load();
                              });
                          }}
                        >
                          Revogar sessão
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <Panel title="Histórico das autorizações">
              <div className="nv-table-wrap">
                <table className="nv-table">
                  <thead>
                    <tr>
                      <th>Profissional</th>
                      <th>Competência</th>
                      <th>Concedida por</th>
                      <th>Validade</th>
                      <th>Estado / acção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {access.data.grants.map((g: any) => (
                      <tr key={g.id}>
                        <td>{g.actor}</td>
                        <td>
                          <code>{g.permission}</code>
                          <small>{g.reason}</small>
                        </td>
                        <td>{g.granted_by}</td>
                        <td>{dateTime(g.expires_at)}</td>
                        <td>
                          {g.revoked_at ? (
                            "Revogada"
                          ) : new Date(g.expires_at).getTime() < Date.now() ? (
                            "Expirada"
                          ) : (
                            <button
                              className="nv-btn nv-btn-secondary"
                              disabled={action.busy}
                              onClick={() => {
                                const reason = prompt("Motivo da revogação");
                                if (reason)
                                  void action.run(async () => {
                                    await hospitalApi(
                                      "POST",
                                      `/access/grants/${g.id}/revoke`,
                                      { reason },
                                    );
                                    await access.load();
                                  });
                              }}
                            >
                              Revogar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )
      )}
    </div>
  );
}
function Auditoria() {
  const [after, setAfter] = useState(0),
    [verified, setVerified] = useState<any>(null),
    list = useResource<any[]>("/audit?after=" + after, []),
    action = useAction();
  return (
    <Panel
      title="Trilho de acesso e alterações"
      actions={
        <button
          className="nv-btn nv-btn-secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(
              async () =>
                setVerified(await hospitalApi("GET", "/audit/verify")),
              "Cadeia verificada.",
            )
          }
        >
          Verificar integridade
        </button>
      }
    >
      <Feedback
        error={list.error || action.error}
        message={
          verified
            ? `${verified.valid ? "Cadeia consistente" : "Inconsistência detectada"} · ${verified.count} eventos · ${dateTime(verified.checkedAt)}`
            : action.message
        }
      />
      <div className="nv-table-wrap">
        <table className="nv-table">
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>Conta</th>
              <th>Acção</th>
              <th>Referência</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((e) => (
              <tr key={e.id}>
                <td>{dateTime(e.at)}</td>
                <td>{e.actor}</td>
                <td>
                  <code>{e.action}</code>
                </td>
                <td>
                  <code>{e.reference}</code>
                </td>
                <td>
                  <code title={e.hash}>{e.hash.slice(0, 12)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="nv-actions">
        <button
          className="nv-btn nv-btn-secondary"
          disabled={!after}
          onClick={() => setAfter(0)}
        >
          Início
        </button>
        <button
          className="nv-btn nv-btn-secondary"
          disabled={list.data.length < 100}
          onClick={() => setAfter(Number(list.data.at(-1)?.id) || 0)}
        >
          Mais eventos
        </button>
      </div>
      <p className="nv-help">
        A cadeia detecta inconsistências no conteúdo armazenado. A protecção
        contra administradores do banco exige controlo de privilégios e cópia
        externa protegida.
      </p>
    </Panel>
  );
}

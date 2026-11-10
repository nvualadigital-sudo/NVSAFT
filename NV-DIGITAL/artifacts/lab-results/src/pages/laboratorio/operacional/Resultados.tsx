import {
  Panel,
  Field,
  Feedback,
  useAction,
  hospitalApi,
  dataForm,
  Status,
  dateTime,
} from "../../../components/hospital/Workspace";
export default function Resultados({
  detail: d,
  reload,
}: {
  detail: any;
  reload: () => Promise<void>;
}) {
  const action = useAction();
  return (
    <div className="nv-stack">
      <Feedback error={action.error} message={action.message} />
      {d.tests.map((t: any) => {
        const history = d.values.filter((v: any) => v.test_id === t.id),
          latest = history[0],
          samples = d.containers.filter(
            (s: any) =>
              s.test_ids.includes(t.id) && s.status === "em_processamento",
          );
        return (
          <Panel
            key={t.id}
            title={`${t.snapshot.code} · ${t.snapshot.name}`}
            actions={<Status>Catálogo v{t.snapshot.version}</Status>}
          >
            <div className="nv-form-grid">
              <div>
                <dl className="nv-meta">
                  <div>
                    <dt>Sector</dt>
                    <dd>{t.snapshot.sector}</dd>
                  </div>
                  <div>
                    <dt>Método</dt>
                    <dd>{t.snapshot.method}</dd>
                  </div>
                  <div>
                    <dt>Referência aprovada</dt>
                    <dd>{t.snapshot.reference}</dd>
                  </div>
                </dl>
                {latest && (
                  <div className="nv-result">
                    <strong>
                      {latest.data.measured} {latest.data.unit}
                    </strong>
                    <Status>
                      {latest.released_at
                        ? "Validado / libertado"
                        : latest.technical_at
                          ? "Validação técnica concluída"
                          : "Aguarda dupla verificação"}
                    </Status>
                    {latest.critical && (
                      <p className="nv-critical">
                        Resultado crítico · requer comunicação e confirmação
                        documentadas
                      </p>
                    )}
                    <p>
                      Introduzido por {latest.entered_by} ·{" "}
                      {dateTime(latest.created_at)}
                    </p>
                    {latest.technical_by && (
                      <p>Validação técnica: {latest.technical_by}</p>
                    )}
                    {latest.released_by && (
                      <p>Libertação: {latest.released_by}</p>
                    )}
                    <div className="nv-actions">
                      {!latest.technical_at && (
                        <button
                          className="nv-btn"
                          disabled={action.busy}
                          onClick={() =>
                            void action.run(async () => {
                              await hospitalApi(
                                "POST",
                                `/lab/values/${latest.id}/validate`,
                                { phase: "technical" },
                              );
                              await reload();
                            })
                          }
                        >
                          Validar tecnicamente
                        </button>
                      )}
                      {!latest.technical_at && !latest.released_at && !latest.critical && !t.snapshot.requiresClinical && (
                        <button
                          className="nv-btn nv-btn-secondary"
                          disabled={action.busy}
                          onClick={() => {
                            const note = window.prompt("Justificação da substituição autorizada e avaliação de risco do exame (mínimo 25 caracteres):");
                            if (!note || note.trim().length < 25) return;
                            if (!window.confirm("Confirmas que tens nomeação vigente para actuar como substituto autorizado e que o exame não requer validação clínica independente?")) return;
                            void action.run(async () => {
                              await hospitalApi("POST", `/lab/values/${latest.id}/validate`, {
                                phase: "solo_release",
                                note: note.trim(),
                                confirmNonCritical: true,
                              });
                              await reload();
                            });
                          }}
                        >
                          Validar e libertar — substituto autorizado
                        </button>
                      )}
                      {latest.technical_at && !latest.released_at && (
                        <button
                          className="nv-btn"
                          disabled={action.busy}
                          onClick={() =>
                            void action.run(async () => {
                              await hospitalApi(
                                "POST",
                                `/lab/values/${latest.id}/validate`,
                                { phase: "release" },
                              );
                              await reload();
                            })
                          }
                        >
                          Libertar resultado
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <form
                className="nv-form"
                key={t.id + (latest?.version || 0)}
                onSubmit={(e) => {
                  const form = e.currentTarget,
                    body = dataForm(e);
                  void action.run(async () => {
                    await hospitalApi("POST", `/lab/tests/${t.id}/values`, {
                      ...body,
                      previousVersion: latest?.version || 0,
                      critical: body.critical === "on",
                      requestId: crypto.randomUUID(),
                    });
                    form.reset();
                    await reload();
                  }, "Versão guardada. Aguarda validação independente.");
                }}
              >
                <h3>
                  {latest
                    ? "Rectificação / nova versão"
                    : "Introdução manual de resultado"}
                </h3>
                <Field label="Recipiente em processamento" name="containerId">
                  <select name="containerId" required defaultValue="">
                    <option value="" disabled>
                      Seleccionar recipiente
                    </option>
                    {samples.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.material} · {s.code}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={`Resultado (${t.snapshot.unit})`}
                  name="measured"
                  required
                  defaultValue={latest?.data.measured || ""}
                />
                <Field
                  label="Observações técnicas"
                  name="comment"
                  type="textarea"
                  defaultValue={latest?.data.comment || ""}
                />
                <Field
                  label="Motivo da rectificação"
                  name="reason"
                  type="textarea"
                  required={!!latest}
                />
                <label className="nv-check">
                  <input name="critical" type="checkbox" />
                  Assinalar como crítico por decisão do profissional
                </label>
                <button
                  className="nv-btn"
                  disabled={action.busy || !samples.length}
                >
                  {action.busy ? "A gravar…" : "Guardar versão para validação"}
                </button>
              </form>
            </div>
            {latest?.critical && (
              <div className="nv-critical-section">
                <h3>Comunicação do resultado crítico</h3>
                <form
                  className="nv-form nv-form-grid"
                  onSubmit={(e) => {
                    const form = e.currentTarget,
                      body = dataForm(e);
                    void action.run(async () => {
                      await hospitalApi(
                        "POST",
                        `/lab/values/${latest.id}/communication`,
                        {
                          ...body,
                          acknowledged: body.acknowledged === "on",
                          requestId: crypto.randomUUID(),
                        },
                      );
                      form.reset();
                      await reload();
                    });
                  }}
                >
                  <Field
                    label="Profissional destinatário"
                    name="recipient"
                    required
                  />
                  <Field label="Canal de contacto" name="channel" required />
                  <Field
                    label="Tentativa, resposta ou escalonamento"
                    name="note"
                    required
                    type="textarea"
                  />
                  <Field
                    label="Repetição/confirmação pelo destinatário"
                    name="readback"
                    type="textarea"
                  />
                  <label className="nv-check">
                    <input name="acknowledged" type="checkbox" />
                    Recepção e compreensão confirmadas
                  </label>
                  <button className="nv-btn" disabled={action.busy}>
                    Registar comunicação
                  </button>
                </form>
                <div className="nv-list">
                  {d.communications
                    .filter((c: any) => c.value_id === latest.id)
                    .map((c: any) => (
                      <p className="nv-list-item" key={c.id}>
                        {dateTime(c.created_at)} · {c.actor} → {c.recipient} ·{" "}
                        {c.channel} ·{" "}
                        {c.acknowledged ? "Confirmado" : "Sem confirmação"}
                        <br />
                        {c.note} {c.readback}
                      </p>
                    ))}
                </div>
              </div>
            )}
            <details className="nv-details">
              <summary>Versões anteriores e autoria ({history.length})</summary>
              {history.map((v: any) => (
                <div className="nv-list-item" key={v.id}>
                  <strong>
                    Versão {v.version}: {v.data.measured} {v.data.unit}
                  </strong>
                  <p>
                    {v.reason || "Introdução inicial"} · {v.entered_by} ·{" "}
                    {dateTime(v.created_at)}
                  </p>
                  <p>
                    Validação: {v.technical_by || "pendente"} · Libertação:{" "}
                    {v.released_by || "pendente"}
                  </p>
                </div>
              ))}
            </details>
          </Panel>
        );
      })}
    </div>
  );
}

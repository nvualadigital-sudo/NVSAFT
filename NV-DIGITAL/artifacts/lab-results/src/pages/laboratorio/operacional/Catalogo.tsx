import { useState } from "react";
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
} from "../../../components/hospital/Workspace";
const fields = [
  ["name", "Designação"],
  ["sector", "Sector"],
  ["material", "Material"],
  ["container", "Recipiente / aditivo"],
  ["minVolume", "Volume mínimo (mL)", "number"],
  ["preparation", "Preparação do paciente"],
  ["transport", "Transporte / temperatura / luz"],
  ["stability", "Estabilidade"],
  ["tatHours", "Prazo esperado (horas)", "number"],
  ["retentionDays", "Retenção (dias)", "number"],
  ["method", "Método"],
  ["unit", "Unidade"],
  ["reference", "Intervalos por população / idade / sexo", "textarea"],
  ["criticalLow", "Valor crítico inferior (opcional)", "number"],
  ["criticalHigh", "Valor crítico superior (opcional)", "number"],
  ["rejection", "Critérios de rejeição", "textarea"],
  ["protocol", "Protocolo aprovado e versão"],
];
export default function Catalogo() {
  const list = useResource<any[]>("/lab/catalog", []),
    action = useAction(),
    [source, setSource] = useState<any>(null),
    [formKey, setFormKey] = useState(0);
  return (
    <div className="nv-split">
      <Panel title="Catálogo e versões">
        <Feedback error={list.error} />
        <div className="nv-list">
          {!list.data.length && (
            <Empty>
              O laboratório deve registar e aprovar o seu catálogo. Não há
              intervalos clínicos predefinidos.
            </Empty>
          )}
          {list.data.map((t) => (
            <article className="nv-list-item" key={t.id}>
              <div>
                <strong>
                  {t.code} · {t.data.name}
                </strong>
                <p>
                  {t.data.sector} · versão {t.version}
                </p>
                <Status>
                  {t.retired_at
                    ? "Retirada"
                    : t.approved_at
                      ? "Aprovada"
                      : "Em revisão"}
                </Status>
                <p>
                  Autor: {t.created_by}{" "}
                  {t.approved_at &&
                    `· Aprovação: ${t.approved_by} · ${dateTime(t.approved_at)}`}
                </p>
              </div>
              <div className="nv-actions">
                <button
                  className="nv-btn nv-btn-secondary"
                  onClick={() => {
                    setSource(t);
                    setFormKey((k) => k + 1);
                  }}
                >
                  Usar numa nova versão
                </button>
                {!t.approved_at && !t.retired_at && (
                  <button
                    className="nv-btn"
                    disabled={action.busy}
                    onClick={() => {
                      const reason = prompt(
                        "Referência da revisão e motivo de aprovação",
                      );
                      if (reason)
                        void action.run(async () => {
                          await hospitalApi(
                            "POST",
                            `/lab/catalog/${t.id}/approve`,
                            { reason },
                          );
                          await list.load();
                        });
                    }}
                  >
                    Aprovar por outro profissional
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <Panel
        title={source ? `Nova versão de ${source.code}` : "Registar análise"}
      >
        <Feedback error={action.error} message={action.message} />
        <form
          key={formKey}
          className="nv-form"
          onSubmit={(e) => {
            const d = dataForm(e);
            void action.run(async () => {
              await hospitalApi("POST", "/lab/catalog", {
                code: d.code,
                data: {
                  ...d,
                  qcRequired: d.qcRequired === "on",
                  requiresClinical: d.requiresClinical === "on",
                },
              });
              await list.load();
              setFormKey((k) => k + 1);
            });
          }}
        >
          <Field
            label="Código local"
            name="code"
            defaultValue={source?.code}
            required
          />
          <div className="nv-form-grid">
            {fields.map(([key, label, type]) => (
              <Field
                key={key}
                label={label}
                name={key}
                type={type || "text"}
                defaultValue={source?.data[key] ?? ""}
                required={!key.startsWith("critical")}
                step="any"
              />
            ))}
          </div>
          <label className="nv-check">
            <input
              name="qcRequired"
              type="checkbox"
              defaultChecked={source?.data.qcRequired !== false}
            />
            Exigir CQ aprovado por equipamento e lote
          </label>
          <label className="nv-check">
            <input
              name="requiresClinical"
              type="checkbox"
              defaultChecked={source?.data.requiresClinical !== false}
            />
            Exigir libertação clínica por outro validador
          </label>
          <p className="nv-help">
            Uma nova versão é um rascunho. A aprovação exige credencial
            verificada e autorização vigente. Cada pedido conserva a versão
            usada.
          </p>
          <button className="nv-btn" disabled={action.busy}>
            {action.busy ? "A gravar…" : "Guardar para revisão"}
          </button>
        </form>
      </Panel>
    </div>
  );
}

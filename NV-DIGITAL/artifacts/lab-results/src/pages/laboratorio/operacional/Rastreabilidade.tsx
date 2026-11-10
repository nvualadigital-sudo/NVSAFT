import { useState, useRef } from "react";
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
import { labelWindow } from "./Impressao";
import Resultados from "./Resultados";
const actions: Record<string, string> = {
  colher: "Registar colheita",
  imprimir: "Pedir impressão / reimpressão",
  etiquetar: "Confirmar etiqueta aplicada",
  transportar: "Registar transporte",
  receber: "Receber por leitura",
  aceitar: "Aceitar após conferência",
  aceitar_ressalva: "Aceitar com ressalva autorizada",
  rejeitar: "Rejeitar e comunicar",
  processar: "Iniciar processamento",
  aliquota: "Criar alíquota",
  recolher: "Solicitar nova colheita",
  quarentena: "Colocar em quarentena",
  armazenar: "Registar armazenamento",
  descartar: "Registar descarte",
};
const available: Record<string, string[]> = {
  por_colher: ["colher"],
  colhida: ["imprimir", "etiquetar", "quarentena"],
  etiquetada: ["transportar", "receber", "imprimir", "quarentena"],
  em_transporte: ["receber", "quarentena"],
  recebida: [
    "aceitar",
    "aceitar_ressalva",
    "rejeitar",
    "quarentena",
    "imprimir",
  ],
  quarentena: ["aceitar", "aceitar_ressalva", "rejeitar"],
  aceite: ["processar", "aliquota", "quarentena", "imprimir"],
  aceite_ressalva: ["processar", "aliquota", "quarentena", "imprimir"],
  em_processamento: ["aliquota", "armazenar", "quarentena", "imprimir"],
  rejeitada: ["recolher", "descartar"],
  armazenada: ["descartar", "transportar", "aliquota", "imprimir"],
  descartada: [],
};
export default function Rastreabilidade({
  id,
  institution,
  initialTab,
}: {
  id: string;
  institution: string;
  initialTab?: string;
}) {
  const detail = useResource<any>("/lab/orders/" + id, null),
    job = useAction(),
    [selected, setSelected] = useState(""),
    [action, setAction] = useState(""),
    [tab, setTab] = useState(initialTab || "recipientes");
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const d = detail.data,
    s = d?.containers.find((s: any) => s.id === selected) || d?.containers[0];
  if (!d)
    return <Feedback error={detail.error} message="A carregar o pedido…" />;
  const current = (available[s?.status] || []).includes(action)
    ? action
    : (available[s?.status] || [])[0] || "";
  return (
    <div className="nv-stack">
      <div className="nv-patient-banner">
        <div>
          <span>Pedido {d.order.accession}</span>
          <h2>{d.order.patient_name}</h2>
          <p>
            ID {d.order.patient_id} · Processo {d.order.processo || "—"} ·
            Nascimento {d.order.nasc || "—"}
          </p>
        </div>
        <div>
          <Status>{d.order.priority}</Status>
          <p>{d.order.origin}</p>
          <small>
            {dateTime(d.order.created_at)} · {d.order.created_by}
          </small>
        </div>
      </div>
      <Feedback error={detail.error || job.error} message={job.message} />
      <nav className="nv-tabs" aria-label="Detalhes do pedido">
        {[
          ["recipientes", "Recipientes e colheitas"],
          ["resultados", "Resultados e validação"],
          ["historico", "Cadeia de custódia"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {d.order.cancelled_at ? (
        <Empty>Pedido cancelado: {d.order.cancel_reason}</Empty>
      ) : tab === "recipientes" ? (
        <div className="nv-split">
          <Panel title="Recipientes físicos">
            <div className="nv-list">
              {d.containers.map((item: any) => (
                <button
                  className={
                    "nv-list-item nv-select " +
                    (item.id === s?.id ? "is-selected" : "")
                  }
                  key={item.id}
                  onClick={() => {
                    setSelected(item.id);
                    setAction("");
                  }}
                >
                  <strong>
                    {item.material} · {item.container}
                  </strong>
                  <code>{item.code}</code>
                  <span>
                    <Status>{item.status.replaceAll("_", " ")}</Status>
                  </span>
                  <small>
                    {item.location} ·{" "}
                    {item.parent_id
                      ? "Derivado / nova colheita"
                      : "Recipiente primário"}
                  </small>
                </button>
              ))}
            </div>
            <p className="nv-help">
              Uma etiqueta por recipiente. Uma nova colheita cria outra amostra;
              uma alíquota mantém a relação com a amostra de origem.
            </p>
          </Panel>
          {s && (
            <Panel title="Registar etapa">
              <dl className="nv-meta">
                <div>
                  <dt>Recipiente</dt>
                  <dd>{s.code}</dd>
                </div>
                <div>
                  <dt>Amostra</dt>
                  <dd>{s.sample_id}</dd>
                </div>
                <div>
                  <dt>Local actual</dt>
                  <dd>{s.location}</dd>
                </div>
                <div>
                  <dt>Colheita</dt>
                  <dd>
                    {dateTime(s.collected_at)} · {s.collected_by || "—"}
                  </dd>
                </div>
              </dl>
              <label className="nv-field">
                <span>Operação</span>
                <select
                  value={current}
                  onChange={(e) => setAction(e.target.value)}
                >
                  {(available[s.status] || []).map((k) => (
                    <option key={k} value={k}>
                      {actions[k]}
                    </option>
                  ))}
                </select>
              </label>
              {current ? (
                <form
                  key={s.id + current + s.revision}
                  className="nv-form"
                  onSubmit={(e) => {
                    const body = dataForm(e),
                      fingerprint = JSON.stringify([
                        s.id,
                        current,
                        s.revision,
                        body,
                      ]);
                    if (request.current?.fingerprint !== fingerprint)
                      request.current = {
                        fingerprint,
                        id: crypto.randomUUID(),
                      };
                    const win =
                      current === "imprimir"
                        ? window.open("", "_blank", "width=600,height=400")
                        : null;
                    if (current === "imprimir" && !win) {
                      void job.run(async () => {
                        throw new Error(
                          "Permita a janela de impressão neste navegador.",
                        );
                      });
                      return;
                    }
                    void job.run(
                      async () => {
                        try {
                          await hospitalApi(
                            "POST",
                            `/lab/containers/${s.id}/action`,
                            {
                              ...body,
                              action: current,
                              revision: s.revision,
                              requestId: request.current!.id,
                              destroyPrevious: body.destroyPrevious === "on",
                              containerConfirmed:
                                body.containerConfirmed === "on",
                              conditionsConfirmed:
                                body.conditionsConfirmed === "on",
                            },
                          );
                          request.current = null;
                          if (win)
                            await labelWindow(
                              win,
                              s,
                              d.order,
                              institution,
                              body.size,
                            );
                          await detail.load();
                        } catch (error) {
                          win?.close();
                          throw error;
                        }
                      },
                      current === "imprimir"
                        ? "Pedido de impressão registado. Confira a impressão física, leia o código e confirme a etiqueta aplicada."
                        : "Etapa registada e auditada.",
                    );
                  }}
                >
                  {["colher", "imprimir", "etiquetar", "receber"].includes(
                    current,
                  ) && (
                    <fieldset className="nv-fieldset">
                      <legend>
                        Conferência junto do paciente / recipiente
                      </legend>
                      <Field
                        label="Nome confirmado"
                        name="identity1"
                        required
                        autoComplete="off"
                      />
                      <Field
                        label="Segundo identificador: ID, processo ou nascimento"
                        name="identity2"
                        required
                        autoComplete="off"
                      />
                    </fieldset>
                  )}
                  {["etiquetar", "receber"].includes(current) && (
                    <Field
                      label="Leitura do código do recipiente"
                      name="scan"
                      required
                      autoComplete="off"
                    />
                  )}
                  {[
                    "colher",
                    "transportar",
                    "receber",
                    "aliquota",
                    "recolher",
                    "armazenar",
                  ].includes(current) && (
                    <Field
                      label="Local / origem física"
                      name="location"
                      required
                    />
                  )}
                  {current === "colher" && (
                    <Field
                      label="Local anatómico / origem"
                      name="site"
                      required
                    />
                  )}
                  {current === "imprimir" && (
                    <>
                      <Field
                        label="Impressora / posto"
                        name="printer"
                        required
                      />
                      <Field
                        label="Tamanho (validar no equipamento)"
                        name="size"
                      >
                        <select name="size">
                          <option value="56x32">56 × 32 mm</option>
                          <option value="50x30">50 × 30 mm</option>
                          <option value="75x25">75 × 25 mm</option>
                        </select>
                      </Field>
                      {s.print_count > 0 && (
                        <label className="nv-check">
                          <input
                            type="checkbox"
                            name="destroyPrevious"
                            required
                          />
                          Inutilizarei a etiqueta anterior para evitar
                          duplicados
                        </label>
                      )}
                    </>
                  )}
                  {["transportar", "descartar"].includes(current) && (
                    <Field label="Destino" name="destination" required />
                  )}
                  {["receber", "transportar"].includes(current) && (
                    <Field
                      label="Condições da embalagem / transporte"
                      name="conditions"
                      required
                      type="textarea"
                    />
                  )}
                  {current === "receber" && (
                    <Field
                      label="Temperatura conferida ou justificação de não aplicabilidade"
                      name="temperature"
                      required
                    />
                  )}
                  {["aceitar", "aceitar_ressalva", "rejeitar"].includes(
                    current,
                  ) && (
                    <>
                      <Field
                        label="Volume conferido (mL)"
                        name="volume"
                        type="number"
                        required
                        step="any"
                        min="0"
                      />
                      <label className="nv-check">
                        <input name="containerConfirmed" type="checkbox" />
                        Recipiente/material conforme catálogo
                      </label>
                      <label className="nv-check">
                        <input name="conditionsConfirmed" type="checkbox" />
                        Tempo, conservação e integridade conferidos
                      </label>
                      {current !== "aceitar" && (
                        <Field
                          label="Serviço/profissional informado"
                          name="serviceNotified"
                          required
                        />
                      )}
                    </>
                  )}
                  {current === "processar" && (
                    <>
                      <Field
                        label="Equipamento ou bancada manual"
                        name="equipment"
                        required
                      />
                      <Field
                        label="Lote de reagente"
                        name="reagentLot"
                        required
                      />
                    </>
                  )}
                  {current === "aliquota" && (
                    <Field
                      label="Recipiente da alíquota"
                      name="container"
                      required
                    />
                  )}
                  <Field
                    label="Motivo / observações"
                    name="note"
                    type="textarea"
                    required={
                      [
                        "rejeitar",
                        "aceitar_ressalva",
                        "quarentena",
                        "recolher",
                        "aliquota",
                        "descartar",
                      ].includes(current) ||
                      (current === "imprimir" && s.print_count > 0)
                    }
                  />
                  <button
                    className={
                      "nv-btn " +
                      (current === "descartar" || current === "rejeitar"
                        ? "nv-btn-danger"
                        : "")
                    }
                    disabled={job.busy}
                  >
                    {job.busy ? "A confirmar…" : actions[current]}
                  </button>
                </form>
              ) : (
                <Empty>
                  Recipiente encerrado. O histórico permanece disponível.
                </Empty>
              )}
            </Panel>
          )}
        </div>
      ) : tab === "resultados" ? (
        <Resultados detail={d} reload={detail.load} />
      ) : (
        <Panel title="Histórico de rastreabilidade">
          <div className="nv-timeline">
            {d.events.map((e: any) => (
              <article key={e.id}>
                <time>{dateTime(e.created_at)}</time>
                <strong>
                  {actions[e.action] || e.action} · {e.actor}
                </strong>
                <code>
                  {d.containers.find((s: any) => s.id === e.container_id)?.code}
                </code>
                <p>
                  {e.details.from} → {e.details.to} · {e.details.location || ""}
                </p>
                <p>{e.details.note || e.details.conditions}</p>
                {e.details.equipment && (
                  <p>
                    Equipamento {e.details.equipment} · lote{" "}
                    {e.details.reagentLot}
                  </p>
                )}
                {e.details.printer && (
                  <p>
                    Impressão pedida em {e.details.printer} · cópia{" "}
                    {e.details.copy}
                  </p>
                )}
              </article>
            ))}
          </div>
          {!d.events.length && (
            <Empty>Sem eventos de colheita registados.</Empty>
          )}
        </Panel>
      )}
    </div>
  );
}

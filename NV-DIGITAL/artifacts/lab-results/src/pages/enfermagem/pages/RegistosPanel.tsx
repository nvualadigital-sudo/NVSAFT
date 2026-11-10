import { Button } from "@/components/ui/button";
import { WARD_TABS } from "../shared";

import { useWardContext } from "../WardContext";
import { displayReference } from "../../../utils/displayReference";

export default function RegistosPanel() {
  const {
    patients,
    error,
    tab,
    day,
    clock,
    draft,
    setCompletion,
    setCompletionReason,
    setIdentityChecked,
    setOrderChecked,
    selected,
    update,
    events,
    totals,
    inputClass,
    field,
    addRecord,
  } = useWardContext();
  return (
    <>
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <h3 className="font-bold">
          Novo registo — {WARD_TABS.find((t) => t[0] === tab)?.[1]}
        </h3>
        <p className="text-xs text-slate-500">
          Registos concluídos permanecem no histórico. Rectificações devem ser
          acrescentadas na evolução com referência ao registo original.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {field(
            ["cuidados", "medicacao"].includes(tab)
              ? "Horário previsto"
              : "Data e hora da realização",
            "when",
            "datetime-local",
          )}
          {!["sinais", "turno"].includes(tab) &&
            field(
              tab === "medicacao"
                ? "Medicamento conforme prescrição"
                : tab === "balanco"
                  ? "Origem (ex.: oral, urina, dreno)"
                  : "Título / cuidado",
              "title",
            )}
          {tab === "medicacao" && (
            <>
              {field("Referência da prescrição / prescritor", "prescription")}
              {field("Dose prescrita (com unidade)", "dose")}
              {field("Via prescrita", "route")}
            </>
          )}
          {tab === "sinais" && (
            <>
              {field("PA (mmHg, ex.: 120/80)", "pa")}
              {field("FC (bpm)", "fc", "number")}
              {field("FR (irpm)", "fr", "number")}
              {field("Temperatura (°C)", "temp", "number")}
              {field("SpO₂ (%)", "spo2", "number")}
              {field("Glicemia (mg/dL)", "glicemia", "number")}
              {field("Dor (0–10)", "dor", "number")}
            </>
          )}
          {tab === "balanco" && (
            <>
              {field("Volume medido (mL)", "amount", "number")}
              <label className="text-sm">
                Movimento
                <select
                  className={inputClass}
                  value={draft.direction}
                  onChange={(e) => update("direction", e.target.value)}
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </label>
            </>
          )}
          {tab === "turno" && (
            <>
              {field("Situação actual", "situation")}
              {field("Antecedentes relevantes", "background")}
              {field("Avaliação do enfermeiro", "assessment")}
              {field("Recomendações e pendências", "recommendation")}
            </>
          )}
        </div>
        <label className="block text-sm">
          Descrição / observações
          <textarea
            className={inputClass}
            rows={3}
            value={draft.note}
            onChange={(e) => update("note", e.target.value)}
          />
        </label>
        <Button disabled={!selected || !!error} onClick={addRecord}>
          {["cuidados", "medicacao"].includes(tab)
            ? "Agendar conforme plano / prescrição"
            : "Guardar registo"}
        </Button>
        {tab === "medicacao" && (
          <p className="text-xs text-slate-600">
            Este registo transcreve uma prescrição existente. Não cria ordens
            médicas nem calcula doses; a administração exige conferência pelo
            profissional.
          </p>
        )}
      </div>
      {tab === "balanco" && (
        <div className="rounded-lg border bg-blue-50 p-4">
          {selected
            ? `Balanço de ${selected.nomePaciente} em ${day}: entradas ${totals.entrada} mL · saídas ${totals.saida} mL · saldo ${totals.entrada - totals.saida} mL`
            : "Seleccione um paciente para calcular o balanço individual."}
        </div>
      )}
      <div className="space-y-3">
        {!events.length && (
          <p className="p-6 text-center text-slate-500">
            Sem registos nesta data e selecção.
          </p>
        )}
        {events.map((e) => (
          <article
            key={e.id}
            className="space-y-2 rounded-xl border bg-white p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{e.title}</strong>
              <span
                className={`text-sm ${e.status === "pendente" && new Date(e.when).getTime() < clock ? "font-bold text-red-700" : "text-slate-600"}`}
              >
                {e.status === "pendente" && new Date(e.when).getTime() < clock
                  ? "Horário ultrapassado"
                  : e.status === "nao_realizado"
                    ? "Não realizado"
                    : e.status === "concluido"
                      ? "Concluído"
                      : "Pendente"}
              </span>
            </div>
            <p className="text-sm">
              {patients.find((p) => p.idEnf === e.patientId)?.nomePaciente ||
                `Atendimento ${e.patientId}`}{" "}
              · {new Date(e.when).toLocaleString("pt-PT")}
            </p>
            {e.prescription && (
              <p className="text-sm">
                Prescrição: {e.prescription} · Dose: {e.dose} · Via: {e.route}
              </p>
            )}
            {e.values && (
              <div className="flex flex-wrap gap-3 text-sm">
                {Object.entries(e.values).map(([k, v]) => (
                  <span key={k}>
                    {
                      (
                        {
                          pa: "PA (mmHg)",
                          fc: "FC (bpm)",
                          fr: "FR (irpm)",
                          temp: "T (°C)",
                          spo2: "SpO₂ (%)",
                          glicemia: "Glicemia (mg/dL)",
                          dor: "Dor (0–10)",
                        } as Record<string, string>
                      )[k]
                    }
                    : <strong>{v}</strong>
                  </span>
                ))}
              </div>
            )}
            {e.amount !== undefined && (
              <p>
                {e.direction === "entrada" ? "Entrada" : "Saída"}: {e.amount} mL
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm">{e.note}</p>
            <p className="text-xs text-slate-500">
              Registado por {e.author} ·{" "}
              {new Date(e.created).toLocaleString("pt-PT")} · <span title={String(e.id)}>Ref. {displayReference(e.id)}</span>
            </p>
            {e.completed && (
              <p className="text-xs">
                Execução: {e.completedBy} ·{" "}
                {new Date(e.completed).toLocaleString("pt-PT")} · {e.reason}
              </p>
            )}
            {e.status === "pendente" && (
              <div className="flex gap-2">
                {(["concluido", "nao_realizado"] as const).map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    onClick={() => {
                      setCompletion({ id: e.id, status });
                      setCompletionReason("");
                      setIdentityChecked(false);
                      setOrderChecked(false);
                    }}
                  >
                    {status === "concluido"
                      ? "Registar realização"
                      : "Não realizado / suspenso"}
                  </Button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useWardContext } from "../WardContext";
import {
  TRIAGE_LEVELS,
  clinicalInput,
  clinicalRecord,
  lastByPatient,
  triageDeadline,
} from "../clinical";
import ClinicalHistory from "../components/ClinicalHistory";
import { nowLocal } from "../shared";
export default function TriagemPage() {
  const {
    state,
    apply,
    selected,
    author,
    setMessage,
    clock,
    patients,
    setPatientId,
  } = useWardContext();
  const [form, setForm] = useState({
    arrival: nowLocal(),
    when: nowLocal(),
    complaint: "",
    chart: "",
    discriminator: "",
    protocol: "",
    priority: "",
    target: "",
    reason: "",
    recheck: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const field = (label: string, key: keyof typeof form, type = "text") => (
    <label className="text-sm" key={key}>
      {label}
      <input
        className={clinicalInput}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
      />
    </label>
  );
  const queue = lastByPatient(state.events, "triagem")
    .filter((e) => e.values?.estado !== "Atendimento iniciado")
    .sort(
      (a, b) =>
        Number(a.values?.prioridade) - Number(b.values?.prioridade) ||
        new Date(a.values?.chegada || a.when).getTime() -
          new Date(b.values?.chegada || b.when).getTime(),
    );
  async function save() {
    try {
      if (!selected) throw new Error("Seleccione um paciente.");
      if (!confirmed)
        throw new Error("Confirme a avaliação pelo profissional habilitado.");
      if (
        ![
          form.complaint,
          form.chart,
          form.discriminator,
          form.protocol,
          form.priority,
          form.reason,
        ].every((x) => x.trim())
      )
        throw new Error(
          "Preencha queixa, fluxograma, discriminador, protocolo, prioridade e justificação.",
        );
      if (
        !form.target.trim() ||
        !Number.isInteger(Number(form.target)) ||
        Number(form.target) < 0
      )
        throw new Error(
          "Confirme o tempo-alvo em minutos conforme o protocolo da instituição.",
        );
      if (!form.arrival || new Date(form.arrival) > new Date(form.when))
        throw new Error("A chegada deve ser anterior ou igual à avaliação.");
      if (
        form.recheck &&
        (!Number.isFinite(new Date(form.recheck).getTime()) ||
          new Date(form.recheck) <= new Date(form.when))
      )
        throw new Error(
          "A reavaliação programada deve ser posterior à avaliação.",
        );
      const previous = lastByPatient(state.events, "triagem").find(
        (e) => e.patientId === selected.idEnf,
      );
      const level = TRIAGE_LEVELS.find((x) => x.id === form.priority)!;
      const record = clinicalRecord(
        selected.idEnf,
        author,
        "triagem",
        previous ? "Reavaliação da triagem" : "Triagem inicial",
        form.reason,
        form.when,
        {
          chegada: form.arrival,
          queixa: form.complaint,
          fluxograma: form.chart,
          discriminador: form.discriminator,
          protocolo: form.protocol,
          prioridade: form.priority,
          cor: level.label,
          targetMinutes: form.target,
          reavaliacao: form.recheck,
          estado: "A aguardar avaliação",
          anterior: previous?.id || "",
        },
      );
      if (await apply((p) => ({ ...p, events: [...p.events, record] })))
        setConfirmed(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha no registo.");
    }
  }
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <h3 className="font-bold">
          Triagem Manchester — registo da avaliação profissional
        </h3>
        <p className="text-sm text-slate-600">
          Registe a classificação obtida no protocolo vigente da instituição.
          Este formulário não executa os fluxogramas Manchester nem atribui
          prioridade pela dor. Os tempos apresentados são referências; confirme
          a edição e a aplicação local.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {field("Chegada", "arrival", "datetime-local")}
          {field("Data/hora da avaliação", "when", "datetime-local")}
          {field("Queixa principal", "complaint")}
          {field("Fluxograma utilizado", "chart")}
          {field("Discriminador identificado", "discriminator")}
          {field("Protocolo / edição institucional", "protocol")}
          <label className="text-sm">
            Prioridade atribuída
            <select
              className={clinicalInput}
              value={form.priority}
              onChange={(e) => {
                const level = TRIAGE_LEVELS.find(
                  (x) => x.id === e.target.value,
                );
                setForm((p) => ({
                  ...p,
                  priority: e.target.value,
                  target: level ? String(level.minutes) : "",
                }));
              }}
            >
              <option value="">Seleccionar</option>
              {TRIAGE_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          {field("Tempo-alvo confirmado (minutos)", "target", "number")}
          {field(
            "Próxima reavaliação, se indicada",
            "recheck",
            "datetime-local",
          )}
        </div>
        <label className="block text-sm">
          Fundamentação / alterações desde a avaliação anterior
          <textarea
            className={clinicalInput}
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Classificação efectuada por profissional habilitado, segundo o
          protocolo em vigor.
        </label>
        <Button onClick={save}>Guardar triagem / reavaliação</Button>
      </div>
      <h3 className="font-bold">
        Fila por prioridade — todos os pacientes em espera
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        {queue.map((e) => {
          const level = TRIAGE_LEVELS.find(
            (l) => l.id === e.values?.prioridade,
          );
          return (
            <article
              key={e.id}
              className="space-y-2 rounded-xl border bg-white p-4"
            >
              <span
                className={`inline-block rounded px-3 py-1 text-sm ${level?.color}`}
              >
                {level?.label}
              </span>
              <strong className="block">
                {patients.find((p) => p.idEnf === e.patientId)?.nomePaciente}
              </strong>
              <p className="text-sm">
                {e.values?.queixa} · Chegada{" "}
                {new Date(e.values?.chegada || e.when).toLocaleString("pt-PT")}
              </p>
              <p className="text-sm">
                {triageDeadline(e) <= clock
                  ? "Tempo-alvo atingido — reavaliar conforme protocolo"
                  : `Tempo até ao alvo: ${Math.ceil((triageDeadline(e) - clock) / 60000)} min`}
              </p>
              {e.values?.reavaliacao && (
                <p className="text-sm">
                  Reavaliação:{" "}
                  {new Date(e.values.reavaliacao).toLocaleString("pt-PT")}
                  {new Date(e.values.reavaliacao).getTime() <= clock
                    ? " · Pendente"
                    : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={async () => setPatientId(String(e.patientId))}
                >
                  Seleccionar paciente
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const r = clinicalRecord(
                        e.patientId,
                        author,
                        "triagem",
                        "Início de atendimento registado",
                        "Atendimento iniciado pelo serviço.",
                        nowLocal(),
                        {
                          ...e.values,
                          estado: "Atendimento iniciado",
                          anterior: e.id,
                        },
                      );
                      await apply((p) => ({ ...p, events: [...p.events, r] }));
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : "Falha.");
                    }
                  }}
                >
                  Registar início de atendimento
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <ClinicalHistory kind="triagem" />
    </div>
  );
}

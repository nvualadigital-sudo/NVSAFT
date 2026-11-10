import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useWardContext } from "../WardContext";
import { clinicalInput, clinicalRecord } from "../clinical";
import ClinicalHistory from "../components/ClinicalHistory";
import { nowLocal } from "../shared";
import PrescricoesMedicas from "./PrescricoesMedicas";
import { displayReference } from "../../../utils/displayReference";
export default function PrescricoesPage() {
  const {
    state,
    selected,
    author,
    apply,
    setMessage,
    setDraft,
    setTab,
    patientId,
    day,
  } = useWardContext();
  const [f, setF] = useState({
    when: nowLocal(),
    reference: "",
    prescriber: "",
    registration: "",
    medicine: "",
    dose: "",
    route: "",
    frequency: "",
    start: nowLocal(),
    end: "",
    note: "",
  });
  const [checked, setChecked] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const received = state.events.filter(
    (e) =>
      e.kind === "prescricao" &&
      (!patientId || String(e.patientId) === patientId) &&
      !e.values?.suspende,
  );
  async function save() {
    try {
      if (!selected) throw new Error("Seleccione um paciente.");
      if (
        !checked ||
        ![
          f.reference,
          f.prescriber,
          f.medicine,
          f.dose,
          f.route,
          f.frequency,
        ].every((v) => v.trim())
      )
        throw new Error(
          "Complete os dados e confirme a conferência com a prescrição original.",
        );
      if (
        !f.start ||
        !Number.isFinite(new Date(f.start).getTime()) ||
        (f.end && new Date(f.end) < new Date(f.start))
      )
        throw new Error("Verifique a validade da prescrição.");
      const e = clinicalRecord(
        selected.idEnf,
        author,
        "prescricao",
        "Prescrição recebida — transcrição conferida",
        f.note,
        f.when,
        {
          referencia: f.reference,
          prescritor: f.prescriber,
          registoProfissional: f.registration,
          medicamento: f.medicine,
          dose: f.dose,
          via: f.route,
          frequencia: f.frequency,
          inicio: f.start,
          fim: f.end,
          origem: "Transcrição manual da prescrição original",
        },
      );
      if (await apply((p) => ({ ...p, events: [...p.events, e] })))
        setChecked(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha no registo.");
    }
  }
  return (
    <div className="space-y-4">
      <PrescricoesMedicas />
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <h3 className="font-bold">Receitas e prescrições recebidas</h3>
        <p className="text-sm text-slate-600">
          Consulte e transcreva prescrições já emitidas pelo médico. Esta área
          não emite receitas, não assina ordens médicas e ainda não recebe
          prescrições automaticamente do módulo Médico.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              "when",
              "reference",
              "prescriber",
              "registration",
              "medicine",
              "dose",
              "route",
              "frequency",
              "start",
              "end",
            ] as const
          ).map((key, i) => (
            <label className="text-sm" key={key}>
              {
                [
                  "Data/hora de recepção",
                  "Referência da receita / ordem",
                  "Médico prescritor",
                  "Número profissional, se disponível",
                  "Medicamento",
                  "Dose com unidade",
                  "Via",
                  "Frequência / horários prescritos",
                  "Início da validade",
                  "Fim da validade, se definido",
                ][i]
              }
              <input
                className={clinicalInput}
                type={
                  ["when", "start", "end"].includes(key)
                    ? "datetime-local"
                    : "text"
                }
                value={f[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="block text-sm">
          Instruções adicionais
          <textarea
            className={clinicalInput}
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />{" "}
          Conferi os dados com a prescrição original válida.
        </label>
        <Button onClick={save}>Guardar prescrição recebida</Button>
      </div>
      <h3 className="font-bold">
        Prescrições registadas para o paciente seleccionado
      </h3>
      {!selected && <p>Seleccione um paciente para preparar a medicação.</p>}
      {received.map((e) => {
        const suspended = state.events.some(
          (x) => x.kind === "prescricao" && x.values?.suspende === e.id,
        );
        const expired = !!e.values?.fim && new Date(e.values.fim) < new Date();
        return (
          <article
            className="space-y-2 rounded-xl border bg-white p-4"
            key={e.id}
          >
            <strong>{e.values?.medicamento}</strong>
            <p className="text-sm">
              {e.values?.dose} · {e.values?.via} · {e.values?.frequencia}
            </p>
            <p className="text-sm">
              Prescritor: {e.values?.prescritor} · Referência:{" "}
              {e.values?.referencia}
            </p>
            <p className="text-sm">
              Validade: {e.values?.inicio} —{" "}
              {e.values?.fim || "Fim não indicado"} ·{" "}
              {suspended
                ? "Suspensa"
                : expired
                  ? "Validade terminada"
                  : "Conferir original antes da administração"}
            </p>
            <p className="text-sm whitespace-pre-wrap">{e.note}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  !selected ||
                  selected.idEnf !== e.patientId ||
                  suspended ||
                  expired
                }
                onClick={async () => {
                  setDraft((p) => ({
                    ...p,
                    centralRxId: "",
                    centralItemId: "",
                    sourcePrescriptionId: e.id,
                    title: e.values?.medicamento || "",
                    dose: e.values?.dose || "",
                    route: e.values?.via || "",
                    prescription: `${e.values?.referencia} · ${e.values?.prescritor} · Registo ${displayReference(e.id)}`,
                    note: e.note,
                  }));
                  setTab("medicacao");
                  setMessage(
                    "Prescrição carregada. Defina o horário conforme a ordem e grave cada administração prevista.",
                  );
                }}
              >
                Preparar horário de medicação
              </Button>
              <Button
                variant="outline"
                disabled={suspended}
                onClick={async () => {
                  const reason = window.prompt(
                    "Referência da ordem médica de suspensão e motivo:",
                  );
                  if (!reason?.trim()) return;
                  try {
                    const r = clinicalRecord(
                      e.patientId,
                      author,
                      "prescricao",
                      "Suspensão recebida",
                      reason,
                      nowLocal(),
                      {
                        suspende: e.id,
                        referencia: e.values?.referencia || "",
                      },
                    );
                    if (
                      state.events.some(
                        (x) =>
                          x.status === "pendente" && x.prescriptionId === e.id,
                      )
                    ) {
                      setMessage(
                        "Resolva os horários pendentes desta prescrição como não realizados/suspensos, indicando o motivo, antes de registar a suspensão.",
                      );
                      return;
                    }
                    await apply((p) => ({ ...p, events: [...p.events, r] }));
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : "Falha.");
                  }
                }}
              >
                Registar ordem de suspensão
              </Button>
            </div>
          </article>
        );
      })}
      <p className="text-xs text-slate-500">
        Histórico abaixo filtrado pela data {day}.
      </p>
      <ClinicalHistory kind="prescricao" />
    </div>
  );
}

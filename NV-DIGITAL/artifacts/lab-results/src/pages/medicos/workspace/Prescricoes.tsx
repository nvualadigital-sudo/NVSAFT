import { useState } from "react";
import { printProfessional } from "../../../components/hospital/ProfessionalDocument";
import {
  buttonStyle,
  commitClinical,
  delivered,
  inputStyle,
  isLocalDate,
  localDate,
  Medication,
  Prescription,
  useClinical,
} from "../clinica/store";
import { MedicalProps } from "./MedicoWorkspace";
const emptyItem = () => ({
  name: "",
  dose: "",
  route: "",
  frequency: "",
  duration: "",
  quantity: "",
  unit: "",
  instructions: "",
});
export default function Prescricoes({
  session,
  visit,
  onMessage,
}: MedicalProps) {
  const { state } = useClinical(session.empresaId!);
  const [f, setF] = useState(emptyItem);
  const [items, setItems] = useState<Medication[]>([]);
  const [notes, setNotes] = useState("");
  const [until, setUntil] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const list = state.prescriptions.filter((r) => r.visitId === visit.id);
  function add() {
    if (
      ![f.name, f.dose, f.route, f.frequency, f.duration, f.unit].every((v) =>
        v.trim(),
      ) ||
      !Number.isFinite(Number(f.quantity)) ||
      Number(f.quantity) <= 0
    ) {
      onMessage(
        "Complete medicamento, dose, via, frequência, duração, quantidade e unidade.",
      );
      return;
    }
    setItems((p) => [
      ...p,
      { ...f, id: crypto.randomUUID(), quantity: Number(f.quantity) },
    ]);
    setF(emptyItem());
  }
  async function send() {
    try {
      if (visit.owner !== session.username)
        throw new Error(
          "Somente o médico responsável deste episódio pode emitir a prescrição.",
        );
      if (visit.closed)
        throw new Error("Abra um episódio activo para prescrever.");
      if (!items.length || !confirmed)
        throw new Error(
          "Adicione os medicamentos e confirme a revisão da prescrição e alergias.",
        );
      if (!isLocalDate(until) || until < localDate())
        throw new Error("Indique uma data de validade válida.");
      const id = crypto.randomUUID();
      const rx: Prescription = {
        id,
        visitId: visit.id,
        patient: visit.patient,
        specialty: visit.specialty || "Clínica Geral",
        diagnosis: (visit.diagnosis || "").trim(),
        wardPatientId: visit.wardPatientId,
        doctor: visit.doctor,
        registration: visit.registration,
        created: new Date().toISOString(),
        validUntil: until + "T23:59:59",
        items,
        notes,
      };
      await commitClinical(
        session.empresaId!,
        session.username!,
        "Prescrição emitida no servidor",
        id,
        (s) => ({ ...s, prescriptions: [...s.prescriptions, rx] }),
      );
      setItems([]);
      setConfirmed(false);
      onMessage(
        "Prescrição disponível na Farmácia e na Enfermagem desta instituição, em todos os postos desta instituição.",
      );
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Falha ao prescrever.");
    }
  }
  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold">Prescrição médica</h2>
        <p className="text-sm">
          Alergias do cadastro:{" "}
          <strong>
            {visit.patient.alergias ||
              "Não informadas — confirmar com o paciente"}
          </strong>
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              "name",
              "dose",
              "route",
              "frequency",
              "duration",
              "quantity",
              "unit",
              "instructions",
            ] as const
          ).map((key, i) => (
            <label key={key} className="text-sm">
              {
                [
                  "Medicamento (nome / apresentação)",
                  "Dose com unidade",
                  "Via de administração",
                  "Frequência / horários",
                  "Duração prescrita",
                  "Quantidade total a dispensar",
                  "Unidade da dispensa (ex.: comprimidos)",
                  "Instruções",
                ][i]
              }
              <input
                className={inputStyle}
                type={key === "quantity" ? "number" : "text"}
                value={f[key]}
                onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <button disabled={!!visit.closed} className={buttonStyle} onClick={add}>
          Adicionar medicamento à prescrição
        </button>
        {items.map((m) => (
          <div
            className="flex justify-between gap-3 rounded border p-3 text-sm"
            key={m.id}
          >
            <p>
              {m.name} · {m.dose} · {m.route} · {m.frequency} · {m.duration} ·{" "}
              {m.quantity} {m.unit}
            </p>
            <button
              onClick={() => setItems(items.filter((x) => x.id !== m.id))}
            >
              Remover
            </button>
          </div>
        ))}
        <label className="block text-sm">
          Validade da prescrição
          <input
            className={inputStyle}
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Orientações gerais
          <textarea
            className={inputStyle}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Revisei identificação, alergias, medicamentos, doses, vias, horários,
          duração e quantidades.
        </label>
        <button
          className={buttonStyle}
          disabled={!!visit.closed}
          onClick={send}
        >
          Emitir e disponibilizar para Farmácia / Enfermagem
        </button>
      </div>
      {list.map((r) => (
        <article
          key={r.id}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <strong>Prescrição {r.id.slice(0, 8)}</strong>
          <p className="text-sm">
            {r.doctor} · {r.registration} ·{" "}
            {new Date(r.created).toLocaleString("pt-PT")} ·{" "}
            {r.cancelled ? "Suspensa" : "Emitida"}
          </p>
          {r.items.map((m) => (
            <p className="text-sm" key={m.id}>
              {m.name} · {m.dose} · {m.route} · {m.frequency} · {m.duration} ·
              Dispensa: {delivered(state, r.id, m.id)} / {m.quantity} {m.unit}
            </p>
          ))}
          <p className="whitespace-pre-wrap text-sm">{r.notes}</p>
          {r.cancelReason && <p>Motivo da suspensão: {r.cancelReason}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              className={buttonStyle}
              onClick={async () => {
                try {
                  await printProfessional("prescription", r.id);
                } catch (e) {
                  onMessage(
                    e instanceof Error ? e.message : "Falha ao imprimir.",
                  );
                }
              }}
            >
              Imprimir / guardar PDF
            </button>
            <button
              className={buttonStyle}
              disabled={!!r.cancelled}
              onClick={async () => {
                if (visit.owner !== session.username) {
                  onMessage(
                    "Somente o médico responsável pode suspender esta prescrição.",
                  );
                  return;
                }
                const reason = window.prompt(
                  "Motivo da suspensão da prescrição:",
                );
                if (!reason?.trim()) return;
                try {
                  await commitClinical(
                    session.empresaId!,
                    session.username!,
                    "Prescrição suspensa",
                    r.id,
                    (s) => ({
                      ...s,
                      prescriptions: s.prescriptions.map((x) =>
                        x.id === r.id
                          ? {
                              ...x,
                              cancelled: new Date().toISOString(),
                              cancelReason: reason,
                            }
                          : x,
                      ),
                    }),
                  );
                } catch (e) {
                  onMessage(e instanceof Error ? e.message : "Falha.");
                }
              }}
            >
              Suspender prescrição
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

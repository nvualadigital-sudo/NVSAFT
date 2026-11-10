import { buttonStyle, useClinical } from "../../medicos/clinica/store";
import { useWardContext } from "../WardContext";
import { displayReference } from "../../../utils/displayReference";
export default function PrescricoesMedicas() {
  const { session, selected, setDraft, setTab, setMessage } = useWardContext();
  const { state, error } = useClinical(session.empresaId!);
  const list = state.prescriptions.filter(
    (r) => r.wardPatientId === selected?.idEnf && r.wardPatientId !== undefined,
  );
  return (
    <div className="space-y-3 rounded-xl border border-teal-300 bg-teal-50 p-4">
      <h3 className="font-bold">Prescrições recebidas do Médico</h3>
      {error && <p role="alert">{error}</p>}
      {!selected ? (
        <p>Seleccione o paciente de enfermagem.</p>
      ) : !list.length ? (
        <p>
          Sem prescrições médicas ligadas a este atendimento. O Médico deve
          receber a triagem e confirmar o vínculo ao cadastro central.
        </p>
      ) : (
        list.map((rx) => (
          <article
            key={rx.id}
            className="space-y-2 rounded border bg-white p-3"
          >
            <strong>
              {rx.patient.nome} · {rx.doctor}
            </strong>
            <p className="text-sm">
              <span title={String(rx.id)}>Referência: {displayReference(rx.id)}</span> · {rx.cancelled ? "SUSPENSA" : "Emitida"} ·
              Validade {new Date(rx.validUntil).toLocaleString("pt-PT")}
            </p>
            {rx.items.map((m) => (
              <div key={m.id} className="space-y-2 border-t pt-2 text-sm">
                <p>
                  {m.name} · {m.dose} · {m.route} · {m.frequency} · {m.duration}
                </p>
                <p>{m.instructions}</p>
                <button
                  className={buttonStyle}
                  disabled={
                    !!rx.cancelled || new Date(rx.validUntil) < new Date()
                  }
                  onClick={() => {
                    setDraft((p) => ({
                      ...p,
                      sourcePrescriptionId: "",
                      centralRxId: rx.id,
                      centralItemId: m.id,
                      title: m.name,
                      dose: m.dose,
                      route: m.route,
                      prescription: `${rx.id} · ${rx.doctor} · ${rx.registration}`,
                      note: `Frequência: ${m.frequency}\nDuração: ${m.duration}\n${m.instructions}`,
                    }));
                    setTab("medicacao");
                    setMessage(
                      "Defina o horário de cada administração conforme a prescrição. Não é calculada uma dose automaticamente.",
                    );
                  }}
                >
                  Preparar administração
                </button>
              </div>
            ))}
          </article>
        ))
      )}
    </div>
  );
}

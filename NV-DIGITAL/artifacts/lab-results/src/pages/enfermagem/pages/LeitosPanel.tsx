import { Button } from "@/components/ui/button";

import { useWardContext } from "../WardContext";

export default function LeitosPanel() {
  const {
    patients,
    state,
    setPatientId,
    setMessage,
    bedForm,
    setBedForm,
    targetBed,
    setTargetBed,
    selected,
    apply,
    activeStays,
    inputClass,
    assignBed,
    closeStay,
  } = useWardContext();
  return (
    <>
      <div className="rounded-xl border bg-white p-4">
        <h3 className="mb-3 font-bold">Configurar leitos</h3>
        <div className="grid gap-3 md:grid-cols-4">
          {(["ward", "room", "bed"] as const).map((key, index) => (
            <label className="text-sm" key={key}>
              {["Enfermaria", "Quarto", "Leito"][index]}
              <input
                className={inputClass}
                value={bedForm[key]}
                onChange={(e) =>
                  setBedForm((p) => ({ ...p, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          <Button
            className="self-end"
            onClick={async () => {
              if (!Object.values(bedForm).every((x) => x.trim())) {
                setMessage("Preencha enfermaria, quarto e leito.");
                return;
              }
              const key = (b: typeof bedForm) =>
                Object.values(b)
                  .map((x) => x.trim().toLowerCase())
                  .join("|");
              if (
                state.beds.some(
                  (b) =>
                    key({ ward: b.ward, room: b.room, bed: b.bed }) ===
                    key(bedForm),
                )
              ) {
                setMessage("Este leito já existe.");
                return;
              }
              await apply((prev) => ({
                ...prev,
                beds: [
                  ...prev.beds,
                  {
                    id: crypto.randomUUID(),
                    ward: bedForm.ward.trim(),
                    room: bedForm.room.trim(),
                    bed: bedForm.bed.trim(),
                    blocked: false,
                  },
                ],
              }));
            }}
          >
            Adicionar leito
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Leito de destino"
          className={`${inputClass} max-w-sm`}
          value={targetBed}
          onChange={(e) => setTargetBed(e.target.value)}
        >
          <option value="">Seleccionar leito livre</option>
          {state.beds
            .filter(
              (b) => !b.blocked && !activeStays.some((s) => s.bedId === b.id),
            )
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.ward} · {b.room} · {b.bed}
              </option>
            ))}
        </select>
        <Button disabled={!selected} onClick={assignBed}>
          Atribuir / transferir paciente seleccionado
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.beds.map((b) => {
          const stay = activeStays.find((s) => s.bedId === b.id),
            patient = patients.find((p) => p.idEnf === stay?.patientId);
          return (
            <article
              key={b.id}
              className={`rounded-xl border p-4 ${stay ? "bg-teal-50" : b.blocked ? "bg-slate-100" : "bg-white"}`}
            >
              <h3 className="font-bold">
                {b.ward} · Quarto {b.room} · Leito {b.bed}
              </h3>
              <p className="my-2 text-sm">
                {patient
                  ? patient.nomePaciente
                  : stay
                    ? "Atendimento indisponível"
                    : b.blocked
                      ? "Bloqueado"
                      : "Livre"}
              </p>
              {stay ? (
                <>
                  <p className="text-xs">
                    Entrada: {new Date(stay.admitted).toLocaleString("pt-PT")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => setPatientId(String(stay.patientId))}
                    >
                      Seleccionar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => closeStay(stay, "Alta autorizada")}
                    >
                      Registar alta
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () =>
                        closeStay(stay, "Transferência externa")
                      }
                    >
                      Transferência externa
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={async () =>
                    await apply((prev) => ({
                      ...prev,
                      beds: prev.beds.map((x) =>
                        x.id === b.id ? { ...x, blocked: !x.blocked } : x,
                      ),
                    }))
                  }
                >
                  {b.blocked
                    ? "Desbloquear"
                    : "Bloquear para limpeza / manutenção"}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      {!state.beds.length && (
        <p className="p-6 text-center text-slate-500">
          Configure os leitos reais da instituição para começar.
        </p>
      )}
    </>
  );
}

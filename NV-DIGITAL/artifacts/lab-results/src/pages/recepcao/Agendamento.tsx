import { useState } from "react";
import { useApp } from "../../store/AppContext";
import { readRemote, updateRemote, hospitalEvent } from "../../store/hospital";
import { useEffect } from "react";
import { button, input } from "../comunicacao/shared";
interface Appointment {
  id: string;
  patientId: number;
  patientName: string;
  when: string;
  service: string;
  professional: string;
  status: "marcado" | "confirmado" | "cancelado";
  cancelReason?: string;
  durationMinutes?: number;
  room?: string;
}
export default function Agendamento(_p: { session?: unknown }) {
  const { data } = useApp();
  const [items, setItems] = useState(() =>
      readRemote<Appointment[]>("appointments", []),
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState({
      patientId: "",
      when: "",
      service: "Consulta",
      professional: "",
      durationMinutes: 30,
      room: "",
    });
  useEffect(() => {
    const refresh = () => setItems(readRemote("appointments", []));
    window.addEventListener(hospitalEvent, refresh);
    return () => window.removeEventListener(hospitalEvent, refresh);
  }, []);
  async function save(fn: (s: Appointment[]) => Appointment[]) {
    setBusy(true);
    try {
      await updateRemote("appointments", [], fn);
      setMessage("Agendamento confirmado no servidor.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na gravação.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 p-5">
      <h1 className="text-2xl font-bold">Agendamento</h1>
      {message && <p role="status">{message}</p>}
      <form
        className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const patient = data.pacientes.find(
            (p) => p.id === Number(form.patientId),
          );
          if (!patient) return;
          void save((items) => {
            if (
              items.some(
                (x) =>
                  x.when === form.when &&
                  x.professional === form.professional &&
                  x.status !== "cancelado",
              )
            )
              throw new Error(
                "Este profissional já tem uma marcação neste horário.",
              );
            return [
              ...items,
              {
                id: crypto.randomUUID(),
                patientId: patient.id,
                patientName: patient.nome,
                when: form.when,
                service: form.service,
                professional: form.professional,
                durationMinutes: form.durationMinutes,
                room: form.room,
                status: "marcado",
              },
            ];
          });
        }}
      >
        <label>
          Paciente
          <select
            className={input}
            required
            value={form.patientId}
            onChange={(e) => setForm({ ...form, patientId: e.target.value })}
          >
            <option value="">Seleccionar</option>
            {data.pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data e hora
          <input
            className={input}
            required
            type="datetime-local"
            value={form.when}
            onChange={(e) => setForm({ ...form, when: e.target.value })}
          />
        </label>
        <label>
          Serviço
          <input
            required
            className={input}
            value={form.service}
            onChange={(e) => setForm({ ...form, service: e.target.value })}
          />
        </label>
        <label>
          Profissional
          <input
            required
            className={input}
            value={form.professional}
            onChange={(e) => setForm({ ...form, professional: e.target.value })}
          />
        </label>
        <label>
          Duração (minutos)
          <input
            className={input}
            type="number"
            min="5"
            max="480"
            required
            value={form.durationMinutes}
            onChange={(e) =>
              setForm({ ...form, durationMinutes: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Sala / recurso (opcional)
          <input
            className={input}
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
          />
        </label>
        <button className={button} disabled={busy}>
          Marcar atendimento
        </button>
      </form>
      <div className="space-y-2">
        {items
          .slice()
          .sort((a, b) => a.when.localeCompare(b.when))
          .map((a) => (
            <article
              className="flex flex-wrap justify-between gap-3 rounded-xl border bg-white p-4"
              key={a.id}
            >
              <div>
                <strong>{a.patientName}</strong>
                <p className="text-sm">
                  {a.when.replace("T", " ")} · {a.service} · {a.professional} ·{" "}
                  {a.status}
                </p>
              </div>
              <div className="space-x-2">
                <button
                  className={button}
                  disabled={busy || a.status !== "marcado"}
                  onClick={() =>
                    void save((s) =>
                      s.map((x) =>
                        x.id === a.id ? { ...x, status: "confirmado" } : x,
                      ),
                    )
                  }
                >
                  Confirmar
                </button>
                <button
                  className={button}
                  disabled={busy || a.status === "cancelado"}
                  onClick={() => {
                    const cancelReason = prompt("Motivo do cancelamento");
                    if (cancelReason?.trim())
                      void save((s) =>
                        s.map((x) =>
                          x.id === a.id
                            ? { ...x, status: "cancelado", cancelReason }
                            : x,
                        ),
                      );
                  }}
                >
                  Cancelar
                </button>
              </div>
            </article>
          ))}
        {!items.length && <p>Nenhuma marcação registada.</p>}
      </div>
    </section>
  );
}

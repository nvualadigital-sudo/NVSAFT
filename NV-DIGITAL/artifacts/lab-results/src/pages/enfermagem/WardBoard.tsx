import { Button } from "@/components/ui/button";
import ClinicalPanel from "./pages/ClinicalPanel";
import LeitosPanel from "./pages/LeitosPanel";
import RegistosPanel from "./pages/RegistosPanel";
import { AtendEnfermagem, NursingSession, WARD_TABS } from "./shared";
import { useWard } from "./useWard";
import { useWardContext, WardContext } from "./WardContext";
export default function WardBoard({
  patients,
  scope,
  session,
  onNew,
  onOpen,
}: {
  patients: AtendEnfermagem[];
  scope: string;
  session: NursingSession;
  onNew: () => void;
  onOpen: (p: AtendEnfermagem) => void;
}) {
  const value = useWard({ patients, scope, session, onNew, onOpen });
  return (
    <WardContext.Provider value={value}>
      <WardLayout />
    </WardContext.Provider>
  );
}
function WardLayout() {
  const {
    patients,
    session,
    onNew,
    onOpen,
    state,
    error,
    tab,
    setTab,
    patientId,
    setPatientId,
    query,
    setQuery,
    day,
    setDay,
    message,
    completion,
    setCompletion,
    completionReason,
    setCompletionReason,
    identityChecked,
    setIdentityChecked,
    orderChecked,
    setOrderChecked,
    selected,
    author,
    activeStays,
    filteredPatients,
    overdue,
    inputClass,
    finishRecord,
  } = useWardContext();
  return (
    <section className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Posto de enfermagem</h2>
          <p className="text-sm text-slate-600">
            {session.empresaNome || "Instituição actual"} ·{" "}
            {author || "Utilizador não identificado"}
          </p>
        </div>
        <Button onClick={onNew}>Novo atendimento</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Leitos ocupados", activeStays.length],
          [
            "Leitos livres",
            state.beds.filter(
              (b) => !b.blocked && !activeStays.some((s) => s.bedId === b.id),
            ).length,
          ],
          [
            "Tarefas pendentes",
            state.events.filter((e) => e.status === "pendente").length,
          ],
          ["Horários ultrapassados", overdue.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      {(message || error) && (
        <p
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          {error || message}
        </p>
      )}
      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
        <label className="text-sm">
          Pesquisar paciente / atendimento
          <input
            aria-label="Pesquisar na enfermaria"
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Paciente
          <select
            aria-label="Paciente da enfermaria"
            className={inputClass}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Todos / seleccionar</option>
            {filteredPatients.map((p) => (
              <option key={p.idEnf} value={p.idEnf}>
                #{p.codigoAtendimento} · {p.nomePaciente}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Data dos registos
          <input
            className={inputClass}
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
      </div>
      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-sm">
          <span>
            <strong>{selected.nomePaciente}</strong> · Atendimento #
            {selected.codigoAtendimento} · Alergias registadas:{" "}
            {selected.alergias || "Não informado"}
          </span>
          <Button variant="outline" onClick={() => onOpen(selected)}>
            Abrir ficha original
          </Button>
        </div>
      )}
      <nav aria-label="Áreas da enfermaria" className="flex flex-wrap gap-2">
        {WARD_TABS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg border px-3 py-2 text-sm ${tab === key ? "bg-teal-700 text-white" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {["triagem", "dor", "avaliacao", "prescricao"].includes(tab) ? (
        <ClinicalPanel />
      ) : tab === "leitos" ? (
        <LeitosPanel />
      ) : (
        <RegistosPanel />
      )}
      {completion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar execução"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5">
            <h3 className="font-bold">
              {completion.status === "concluido"
                ? "Confirmar realização"
                : "Registar não realização"}
            </h3>
            <p className="text-sm">
              {
                patients.find(
                  (p) =>
                    p.idEnf ===
                    state.events.find((e) => e.id === completion.id)?.patientId,
                )?.nomePaciente
              }{" "}
              · {state.events.find((e) => e.id === completion.id)?.title}
            </p>
            {state.events.find((e) => e.id === completion.id)?.kind ===
              "medicacao" &&
              completion.status === "concluido" && (
                <>
                  <label className="block text-sm">
                    <input
                      type="checkbox"
                      checked={identityChecked}
                      onChange={(e) => setIdentityChecked(e.target.checked)}
                    />{" "}
                    Confirmei a identificação do paciente.
                  </label>
                  <label className="block text-sm">
                    <input
                      type="checkbox"
                      checked={orderChecked}
                      onChange={(e) => setOrderChecked(e.target.checked)}
                    />{" "}
                    Conferi medicamento, dose, via e horário com a prescrição
                    válida.
                  </label>
                </>
              )}
            <label className="block text-sm">
              Observações / motivo da não realização
              <textarea
                className={inputClass}
                value={completionReason}
                onChange={(e) => setCompletionReason(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={finishRecord}>Confirmar e guardar</Button>
              <Button variant="outline" onClick={() => setCompletion(null)}>
                Cancelar
              </Button>
            </div>
            <p role="status" className="text-sm text-amber-800">
              {message}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

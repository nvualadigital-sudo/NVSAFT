import { useState } from "react";
import {
  DentalAssessment,
  DentalProcedureStatus,
  PERMANENT_TEETH,
  TOOTH_CONDITIONS,
  TOOTH_SURFACES,
  UPPER_LEFT_TEETH,
  UPPER_RIGHT_TEETH,
  LOWER_LEFT_TEETH,
  LOWER_RIGHT_TEETH,
} from "./dentistry";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100";
const procedures = [
  "Consulta de seguimento",
  "Destartarização / higiene oral",
  "Aplicação de flúor",
  "Radiografia dentária",
  "Restauração",
  "Tratamento endodôntico",
  "Extracção",
  "Coroa / prótese",
  "Avaliação de implante",
  "Tratamento periodontal",
  "Avaliação ortodôntica",
  "Outro procedimento",
];

export default function DentistryAssessmentEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: DentalAssessment;
  onChange: (value: DentalAssessment) => void;
  disabled?: boolean;
}) {
  const [selectedTooth, setSelectedTooth] = useState<string>("18");
  const [procedure, setProcedure] = useState(procedures[0]);
  const [procedureTooth, setProcedureTooth] = useState("18");
  const [procedureNote, setProcedureNote] = useState("");
  const tooth = value.teeth[selectedTooth];

  function update<K extends keyof DentalAssessment>(
    key: K,
    nextValue: DentalAssessment[K],
  ) {
    onChange({ ...value, [key]: nextValue });
  }
  function updateTooth(
    toothId: string,
    patch: Partial<DentalAssessment["teeth"][string]>,
  ) {
    onChange({
      ...value,
      teeth: {
        ...value.teeth,
        [toothId]: { ...value.teeth[toothId], ...patch },
      },
    });
  }
  function addProcedure() {
    onChange({
      ...value,
      procedures: [
        ...value.procedures,
        {
          id: crypto.randomUUID(),
          tooth: procedureTooth,
          procedure,
          status: "planeado",
          note: procedureNote.trim(),
        },
      ],
    });
    setProcedureNote("");
  }
  function updateProcedureStatus(id: string, status: DentalProcedureStatus) {
    update(
      "procedures",
      value.procedures.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    );
  }

  const toothColor: Record<string, string> = {
    saudavel: "border-emerald-300 bg-emerald-50 text-emerald-900",
    carie: "border-red-300 bg-red-50 text-red-900",
    restaurado: "border-blue-300 bg-blue-50 text-blue-900",
    endodontia: "border-violet-300 bg-violet-50 text-violet-900",
    ausente: "border-slate-400 bg-slate-200 text-slate-700",
    extraccao: "border-orange-300 bg-orange-50 text-orange-900",
    coroa: "border-cyan-300 bg-cyan-50 text-cyan-900",
    implante: "border-indigo-300 bg-indigo-50 text-indigo-900",
    selante: "border-lime-300 bg-lime-50 text-lime-900",
  };

  function ToothRow({ teeth }: { teeth: readonly string[] }) {
    return (
      <div className="grid grid-cols-8 gap-1">
        {teeth.map((id) => {
          const condition = value.teeth[id]?.condition || "saudavel";
          return (
            <button
              key={id}
              type="button"
              aria-label={`Dente ${id}: ${TOOTH_CONDITIONS.find(([key]) => key === condition)?.[1] || "Sem alteração"}`}
              aria-pressed={selectedTooth === id}
              disabled={disabled}
              onClick={() => {
                setSelectedTooth(id);
                setProcedureTooth(id);
              }}
              className={`min-h-10 rounded border px-1 py-2 text-xs font-bold disabled:cursor-default ${toothColor[condition] || toothColor.saudavel} ${selectedTooth === id ? "ring-2 ring-teal-700 ring-offset-1" : ""}`}
            >
              {id}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <fieldset className="space-y-5 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
      <legend className="px-2 font-bold text-teal-950">
        Perfil de Medicina Dentária · Odontograma FDI
      </legend>
      <p className="text-sm text-slate-700">
        Registe a história oral, o estado de cada dente e o plano de
        procedimentos. Os dados são guardados com a evolução clínica desta
        consulta.
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          Dor dentária (0–10)
          <input
            className={fieldClass}
            type="number"
            min="0"
            max="10"
            step="1"
            value={value.painScore}
            disabled={disabled}
            onChange={(e) =>
              update(
                "painScore",
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          />
        </label>
        <label className="text-sm">
          Sensibilidade
          <select
            className={fieldClass}
            value={value.sensitivity}
            disabled={disabled}
            onChange={(e) => update("sensitivity", e.target.value)}
          >
            <option value="">Não avaliada</option>
            <option>Não refere</option>
            <option>Frio</option>
            <option>Quente</option>
            <option>Doce</option>
            <option>À mastigação</option>
            <option>Outra</option>
          </select>
        </label>
        <label className="text-sm">
          Sangramento gengival
          <select
            className={fieldClass}
            value={value.bleedingGums}
            disabled={disabled}
            onChange={(e) => update("bleedingGums", e.target.value)}
          >
            <option value="">Não avaliado</option>
            <option>Não</option>
            <option>Sim</option>
            <option>Ocasional</option>
          </select>
        </label>
        <label className="text-sm">
          Última consulta dentária
          <input
            className={fieldClass}
            type="date"
            value={value.lastVisitDate}
            disabled={disabled}
            onChange={(e) => update("lastVisitDate", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Frequência de escovagem
          <select
            className={fieldClass}
            value={value.oralHygieneFrequency}
            disabled={disabled}
            onChange={(e) => update("oralHygieneFrequency", e.target.value)}
          >
            <option value="">Não informada</option>
            <option>Menos de uma vez por dia</option>
            <option>Uma vez por dia</option>
            <option>Duas vezes por dia</option>
            <option>Após as refeições</option>
          </select>
        </label>
        <label className="text-sm">
          Uso de fio dentário
          <select
            className={fieldClass}
            value={value.flossing}
            disabled={disabled}
            onChange={(e) => update("flossing", e.target.value)}
          >
            <option value="">Não informado</option>
            <option>Diário</option>
            <option>Ocasional</option>
            <option>Não utiliza</option>
          </select>
        </label>
        <label className="text-sm">
          Bruxismo / apertamento
          <select
            className={fieldClass}
            value={value.bruxism}
            disabled={disabled}
            onChange={(e) => update("bruxism", e.target.value)}
          >
            <option value="">Não avaliado</option>
            <option>Não refere</option>
            <option>Sim</option>
            <option>Suspeita clínica</option>
          </select>
        </label>
        <label className="text-sm">
          Tabaco
          <select
            className={fieldClass}
            value={value.tobaccoUse}
            disabled={disabled}
            onChange={(e) => update("tobaccoUse", e.target.value)}
          >
            <option value="">Não informado</option>
            <option>Não utiliza</option>
            <option>Utiliza actualmente</option>
            <option>Utilizou anteriormente</option>
          </select>
        </label>
        <label className="text-sm md:col-span-3">
          História dentária e queixa principal
          <textarea
            className={fieldClass}
            rows={3}
            value={value.history}
            disabled={disabled}
            onChange={(e) => update("history", e.target.value)}
          />
        </label>
      </div>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <div>
          <h3 className="font-semibold">Odontograma de dentes permanentes</h3>
          <p className="text-xs text-slate-600">
            Seleccione um dente para registar condição, superfícies e notas.
            Numeração FDI; registe os dentes decíduos nas observações clínicas.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <h4 className="text-sm font-semibold">Maxilar superior</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-center text-xs text-slate-500">
                  Lado direito
                </p>
                <ToothRow teeth={UPPER_RIGHT_TEETH} />
              </div>
              <div className="space-y-1">
                <p className="text-center text-xs text-slate-500">
                  Lado esquerdo
                </p>
                <ToothRow teeth={UPPER_LEFT_TEETH} />
              </div>
            </div>
          </div>
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <h4 className="text-sm font-semibold">Maxilar inferior</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-center text-xs text-slate-500">
                  Lado direito
                </p>
                <ToothRow teeth={LOWER_RIGHT_TEETH} />
              </div>
              <div className="space-y-1">
                <p className="text-center text-xs text-slate-500">
                  Lado esquerdo
                </p>
                <ToothRow teeth={LOWER_LEFT_TEETH} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {TOOTH_CONDITIONS.slice(0, 6).map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className={`h-3 w-3 rounded-sm border ${toothColor[key]}`}
              />
              {label}
            </span>
          ))}
        </div>

        <div className="grid gap-4 rounded-lg border p-3 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-semibold">Dente {selectedTooth}</h4>
            <label className="block text-sm">
              Condição
              <select
                className={fieldClass}
                value={tooth?.condition || "saudavel"}
                disabled={disabled}
                onChange={(e) =>
                  updateTooth(selectedTooth, {
                    condition: e.target.value as DentalAssessment["teeth"][string]["condition"],
                  })
                }
              >
                {TOOTH_CONDITIONS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Observações do dente
              <textarea
                className={fieldClass}
                rows={2}
                value={tooth?.note || ""}
                disabled={disabled}
                onChange={(e) =>
                  updateTooth(selectedTooth, { note: e.target.value })
                }
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Superfícies afectadas</legend>
            <div className="mt-2 grid gap-2">
              {TOOTH_SURFACES.map(([code, label]) => (
                <label key={code} className="text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(tooth?.surfaces.includes(code))}
                    disabled={disabled}
                    onChange={(e) => {
                      const current = tooth?.surfaces || [];
                      updateTooth(selectedTooth, {
                        surfaces: e.target.checked
                          ? [...current, code]
                          : current.filter((item) => item !== code),
                      });
                    }}
                  />{" "}
                  {code} · {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <p className="text-xs text-slate-500">
          {PERMANENT_TEETH.length} dentes permanentes · O oclusal · M mesial · D
          distal · V vestibular · L lingual/palatina
        </p>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h3 className="font-semibold">Exame oral e periodontal</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["mucosa", "Mucosa oral"],
              ["gingiva", "Gengiva"],
              ["periodontal", "Avaliação periodontal"],
              ["occlusion", "Oclusão e articulação"],
            ] as const
          ).map(([key, label]) => (
            <label className="text-sm" key={key}>
              {label}
              <textarea
                className={fieldClass}
                rows={2}
                value={value[key]}
                disabled={disabled}
                onChange={(e) => update(key, e.target.value)}
              />
            </label>
          ))}
          <label className="text-sm md:col-span-2">
            Outras observações clínicas
            <textarea
              className={fieldClass}
              rows={3}
              value={value.generalNotes}
              disabled={disabled}
              onChange={(e) => update("generalNotes", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h3 className="font-semibold">Plano de procedimentos dentários</h3>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto]">
          <label className="text-sm">
            Procedimento
            <select
              className={fieldClass}
              value={procedure}
              disabled={disabled}
              onChange={(e) => setProcedure(e.target.value)}
            >
              {procedures.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Dente
            <select
              className={fieldClass}
              value={procedureTooth}
              disabled={disabled}
              onChange={(e) => setProcedureTooth(e.target.value)}
            >
              <option value="">Sem dente específico</option>
              {PERMANENT_TEETH.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Observação
            <input
              className={fieldClass}
              value={procedureNote}
              disabled={disabled}
              onChange={(e) => setProcedureNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="self-end rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={disabled}
            onClick={addProcedure}
          >
            Adicionar
          </button>
        </div>
        {value.procedures.length ? (
          <div className="space-y-2">
            {value.procedures.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 rounded border p-3 sm:grid-cols-[1fr_auto]"
              >
                <div className="text-sm">
                  <strong>{item.procedure}</strong>
                  <span className="ml-2 text-slate-600">
                    {item.tooth ? `Dente ${item.tooth}` : "Sem dente específico"}
                  </span>
                  {item.note && <p>{item.note}</p>}
                </div>
                <select
                  aria-label={`Estado de ${item.procedure}`}
                  className={fieldClass}
                  value={item.status}
                  disabled={disabled}
                  onChange={(e) =>
                    updateProcedureStatus(
                      item.id,
                      e.target.value as DentalProcedureStatus,
                    )
                  }
                >
                  <option value="planeado">Planeado</option>
                  <option value="em_curso">Em curso</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Ainda não há procedimentos registados.
          </p>
        )}
      </section>
    </fieldset>
  );
}

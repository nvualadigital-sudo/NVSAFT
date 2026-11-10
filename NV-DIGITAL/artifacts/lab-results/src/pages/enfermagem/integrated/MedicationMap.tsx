import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Package,
  ShieldCheck,
  X,
} from "lucide-react";
import { type ClinicalState, type Dose, doseLabels } from "./model";
import { formatStamp, formatTime, localDay } from "./clinicalSelectors";
export function MedicationMap({
  state,
  doses,
  onDose,
}: {
  state: ClinicalState;
  doses: Dose[];
  onDose: (d: Dose) => void;
}) {
  const [day, setDay] = useState(localDay()),
    [range, setRange] = useState("all");
  const orderIds = new Set(doses.map((d) => d.orderId));
  const chosen = doses.filter((d) => localDay(new Date(d.due)) === day);
  const filtered = chosen.filter((d) =>
    range === "all" || range === "done"
      ? range === "all" || d.status === "administrada"
      : ["aguarda_farmacia", "dispensada"].includes(d.status),
  );
  const rows = state.orders.filter(
    (o) => orderIds.has(o.id) && filtered.some((d) => d.orderId === o.id),
  );
  const change = (delta: number) => {
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDay(localDay(d));
  };
  return (
    <section className="op-surface op-mar-map">
      <header className="op-section-head">
        <div>
          <div className="op-overline">MAPA ELECTRÓNICO DE ADMINISTRAÇÃO</div>
          <h2>Aprazamento por paciente e medicamento</h2>
          <p>
            O horário apresentado corresponde à prescrição. Cada dose tem
            conferência própria.
          </p>
        </div>
        <div className="op-day-selector">
          <button aria-label="Dia anterior" onClick={() => change(-1)}>
            <ArrowLeft size={16} />
          </button>
          <label>
            <CalendarDays size={15} />
            <input
              type="date"
              aria-label="Data do mapa de medicação"
              value={day}
              onChange={(e) => setDay(e.target.value || localDay())}
            />
          </label>
          <button aria-label="Dia seguinte" onClick={() => change(1)}>
            <ArrowRight size={16} />
          </button>
          <button onClick={() => setDay(localDay())}>Hoje</button>
        </div>
      </header>
      <div className="op-mar-toolbar">
        <div className="op-segment">
          {[
            { id: "all", label: "Todas as doses" },
            { id: "pending", label: "Por administrar" },
            { id: "done", label: "Administradas" },
          ].map((x) => (
            <button
              key={x.id}
              className={range === x.id ? "active" : ""}
              onClick={() => setRange(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="op-map-legend">
          <span className="waiting">
            <i />
            Aguarda farmácia
          </span>
          <span className="ready">
            <i />
            Dispensada
          </span>
          <span className="done">
            <i />
            Administrada
          </span>
          <span className="omitted">
            <i />
            Omitida / suspensa
          </span>
        </div>
      </div>
      {rows.length ? (
        <div className="op-table-scroll">
          <table className="op-mar-table">
            <thead>
              <tr>
                <th>Paciente / prescrição</th>
                {["00h – 06h", "06h – 12h", "12h – 18h", "18h – 24h"].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const p = state.patients.find((p) => p.id === o.patientId)!,
                  drug = state.drugs.find((d) => d.id === o.drugId)!;
                return (
                  <tr key={o.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>{p.code}</small>
                      <b className="op-med-name">
                        {drug.name} <span>{drug.strength}</span>
                      </b>
                      <p>
                        {o.dose} · {o.route} · {o.interval}h
                      </p>
                      <small>Prescritor: {o.prescriber}</small>
                      {drug.highAlert && (
                        <span className="op-map-warning">
                          <ShieldCheck size={12} />
                          Dupla verificação
                        </span>
                      )}
                    </td>
                    {[0, 6, 12, 18].map((start) => (
                      <td key={start}>
                        <div className="op-dose-stack">
                          {filtered
                            .filter(
                              (d) =>
                                d.orderId === o.id &&
                                new Date(d.due).getHours() >= start &&
                                new Date(d.due).getHours() < start + 6,
                            )
                            .sort((a, b) => a.due.localeCompare(b.due))
                            .map((d) => (
                              <button
                                key={d.id}
                                className={`op-dose-card ${d.status} ${["dispensada", "aguarda_farmacia"].includes(d.status) && Date.parse(d.due) < Date.now() ? "late" : ""}`}
                                onClick={() => onDose(d)}
                                title={`${doseLabels[d.status]} · ${formatStamp(d.due)}${d.at ? ` · Registada ${formatStamp(d.at)} por ${d.administeredBy}` : ""}`}
                              >
                                <span>
                                  {d.status === "administrada" ? (
                                    <Check size={15} />
                                  ) : d.status === "aguarda_farmacia" ? (
                                    <Package size={15} />
                                  ) : ["omitida", "suspensa"].includes(
                                      d.status,
                                    ) ? (
                                    <X size={15} />
                                  ) : (
                                    <Clock3 size={15} />
                                  )}
                                  <b>{formatTime(d.due)}</b>
                                </span>
                                <strong>{doseLabels[d.status]}</strong>
                                {d.at && (
                                  <small>Registo: {formatTime(d.at)}</small>
                                )}
                                {d.note && <small>{d.note}</small>}
                              </button>
                            ))}
                          {!filtered.some(
                            (d) =>
                              d.orderId === o.id &&
                              new Date(d.due).getHours() >= start &&
                              new Date(d.due).getHours() < start + 6,
                          ) && <span className="op-no-dose">—</span>}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="op-empty">
          <CalendarDays size={30} />
          <h3>
            Sem doses para{" "}
            {new Date(`${day}T12:00:00`).toLocaleDateString("pt-PT")}
          </h3>
          <p>
            Seleccione outra data ou consulte o histórico em lista abaixo. As
            doses permanecem na data prescrita.
          </p>
        </div>
      )}
      <footer className="op-mar-footer">
        <span>
          {chosen.length} dose(s) prescrita(s) ·{" "}
          {new Date(`${day}T12:00:00`).toLocaleDateString("pt-PT")}
        </span>
        <span>
          {chosen.filter((d) => d.status === "administrada").length}{" "}
          administrada(s) ·{" "}
          {chosen.filter((d) => d.status === "aguarda_farmacia").length}{" "}
          aguarda(m) farmácia
        </span>
      </footer>
    </section>
  );
}

import {
  type ClinicalState,
  type Episode,
  type Observation,
  type Dose,
  type Care,
} from "./model";
export const isPendingDose = (d: Dose) =>
  d.status === "aguarda_farmacia" || d.status === "dispensada";
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function latestObservation(
  s: ClinicalState,
  patientId: string,
  kind: Observation["kind"],
) {
  return s.observations
    .filter((o) => o.patientId === patientId && o.kind === kind)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}
export function currentEpisode(
  s: ClinicalState,
  patientId: string,
): Episode | undefined {
  return s.episodes.find(
    (e) => e.patientId === patientId && e.status !== "encerrado",
  );
}
export function patientDoses(s: ClinicalState, patientId: string) {
  const ids = new Set(
    s.orders.filter((o) => o.patientId === patientId).map((o) => o.id),
  );
  return s.doses.filter((d) => ids.has(d.orderId));
}
export function fluidBalance(
  s: ClinicalState,
  patientId: string,
  now = Date.now(),
  hours = 24,
) {
  const rows = s.observations.filter(
    (o) =>
      o.patientId === patientId &&
      o.kind === "balanco" &&
      Date.parse(o.at) > now - hours * 3600000 &&
      Date.parse(o.at) <= now,
  );
  const input = rows
      .filter((o) => o.values.direction === "entrada")
      .reduce((n, o) => n + Number(o.values.ml), 0),
    output = rows
      .filter((o) => o.values.direction === "saida")
      .reduce((n, o) => n + Number(o.values.ml), 0);
  return {
    rows,
    input,
    output,
    balance: Math.round((input - output) * 1000) / 1000,
  };
}
export type AgendaItem = {
  id: string;
  patientId: string;
  due: string;
  kind: "dose" | "care" | "handover";
  title: string;
  description: string;
  late: boolean;
  dose?: Dose;
  care?: Care;
};
export function buildAgenda(
  s: ClinicalState,
  patientIds: string[],
  end: number,
  now = Date.now(),
): AgendaItem[] {
  if (!Number.isFinite(end)) return [];
  const ids = new Set(patientIds);
  const items: AgendaItem[] = [];
  for (const d of s.doses) {
    if (!isPendingDose(d) || Date.parse(d.due) > end) continue;
    const o = s.orders.find((o) => o.id === d.orderId);
    if (!o || !ids.has(o.patientId) || o.status !== "activa") continue;
    const drug = s.drugs.find((x) => x.id === o.drugId);
    items.push({
      id: d.id,
      patientId: o.patientId,
      due: d.due,
      kind: "dose",
      title: drug?.name || "Medicamento",
      description: `${o.dose} · ${o.route}`,
      late: Date.parse(d.due) < now,
      dose: d,
    });
  }
  for (const c of s.care) {
    if (
      ids.has(c.patientId) &&
      c.status === "planeado" &&
      Date.parse(c.due) <= end
    )
      items.push({
        id: c.id,
        patientId: c.patientId,
        due: c.due,
        kind: "care",
        title: c.diagnosis,
        description: c.intervention,
        late: Date.parse(c.due) < now,
        care: c,
      });
  }
  for (const patientId of patientIds) {
    const h = s.handovers
      .filter((h) => h.patientId === patientId)
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    if (h && !h.acceptedBy)
      items.push({
        id: h.id,
        patientId,
        due: h.at,
        kind: "handover",
        title: "Recepção da passagem de turno",
        description: `Enviada por ${h.author}`,
        late: false,
      });
  }
  return items.sort((a, b) => a.due.localeCompare(b.due));
}
export function periodEnd(day: string, preset: string) {
  const date = new Date(`${day}T00:00:00`);
  const hour =
    preset === "morning"
      ? 14
      : preset === "afternoon"
        ? 22
        : preset === "night"
          ? 30
          : 24;
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}
export const formatTime = (v: string) =>
  new Date(v).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
export const formatStamp = (v: string) =>
  new Date(v).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const observationLabels: Record<Observation["kind"], string> = {
  vitais: "Sinais vitais",
  balanco: "Balanço hídrico",
  evolucao: "Evolução de enfermagem",
  incidente: "Incidente assistencial",
  triagem: "Triagem clínica",
  avaliacao: "Avaliação de enfermagem",
  dispositivo: "Dispositivo clínico",
  procedimento: "Procedimento / curativo",
};
export function formatPatientAge(value: string, now = new Date()): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value),
    pt = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!iso && !pt) return "";
  const year = Number(iso ? iso[1] : pt![3]),
    month = Number(iso ? iso[2] : pt![2]) - 1,
    day = Number(iso ? iso[3] : pt![1]);
  const birth = new Date(year, month, day),
    today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month ||
    birth.getDate() !== day ||
    birth > today
  )
    return "";
  let years = today.getFullYear() - year;
  if (
    today.getMonth() < month ||
    (today.getMonth() === month && today.getDate() < day)
  )
    years--;
  if (years > 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  let months = (today.getFullYear() - year) * 12 + today.getMonth() - month;
  if (today.getDate() < day) months--;
  if (months > 0) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const days = Math.floor(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(year, month, day)) /
      86400000,
  );
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

import type { WardEvent, WardKind } from "./shared";
export const TRIAGE_LEVELS = [
  {
    id: "1",
    label: "Vermelho · Emergente",
    minutes: 0,
    color: "bg-red-700 text-white",
  },
  {
    id: "2",
    label: "Laranja · Muito urgente",
    minutes: 10,
    color: "bg-orange-600 text-white",
  },
  {
    id: "3",
    label: "Amarelo · Urgente",
    minutes: 60,
    color: "bg-yellow-200 text-slate-900",
  },
  {
    id: "4",
    label: "Verde · Pouco urgente",
    minutes: 120,
    color: "bg-green-700 text-white",
  },
  {
    id: "5",
    label: "Azul · Não urgente",
    minutes: 240,
    color: "bg-blue-700 text-white",
  },
] as const;
export const clinicalInput =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
export function clinicalRecord(
  patientId: number,
  author: string,
  kind: WardKind,
  title: string,
  note: string,
  when: string,
  values: Record<string, string>,
): WardEvent {
  if (!Number.isSafeInteger(patientId) || !author.trim())
    throw new Error("Seleccione o paciente e um utilizador identificado.");
  if (
    !when ||
    !Number.isFinite(new Date(when).getTime()) ||
    new Date(when).getTime() > Date.now() + 60000
  )
    throw new Error("Indique uma data/hora válida e sem data futura.");
  return {
    id: crypto.randomUUID(),
    patientId,
    author,
    kind,
    title,
    note,
    when,
    created: new Date().toISOString(),
    status: "concluido",
    values,
  };
}
export function lastByPatient(
  events: WardEvent[],
  kind: WardKind,
): WardEvent[] {
  const map = new Map<number, WardEvent>();
  for (const e of events
    .filter((e) => e.kind === kind)
    .sort((a, b) => a.created.localeCompare(b.created)))
    map.set(e.patientId, e);
  return [...map.values()];
}
export function triageDeadline(e: WardEvent): number {
  return (
    new Date(e.when).getTime() + Number(e.values?.targetMinutes || 0) * 60000
  );
}

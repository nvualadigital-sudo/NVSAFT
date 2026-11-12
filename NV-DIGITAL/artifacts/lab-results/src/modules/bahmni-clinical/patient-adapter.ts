import type { ClinicalOverview } from "@workspace/api-zod";

export interface FormattedPatientData {
  fullName: string;
  gender: string;
  birthDate: string | null;
  identifiers: Map<string, string | null>;
}
export function formatPatient(
  p: ClinicalOverview["patient"],
): FormattedPatientData {
  return {
    fullName: p.name,
    gender:
      ({ M: "Masculino", F: "Feminino" } as Record<string, string>)[p.sex] ||
      p.sex ||
      "Sexo não registado",
    birthDate: p.birthDate || null,
    identifiers: new Map([
      [
        "process",
        p.processNumber ? `Processo ${p.processNumber}` : `Paciente ${p.id}`,
      ],
      ["document", p.document ? `BI ${p.document}` : null],
    ]),
  };
}
export function parseClinicalDate(value: string): Date | null {
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (local) {
    const normalized = `${local[3]}-${local[2]}-${local[1]}`;
    const date = new Date(normalized + "T00:00:00Z");
    return Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === normalized
      ? date
      : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const date = new Date(value.length === 10 ? value + "T00:00:00Z" : value);
  return Number.isFinite(date.getTime()) &&
    (value.length !== 10 || date.toISOString().slice(0, 10) === value)
    ? date
    : null;
}
export function formatDateTime(
  value: string,
  _t?: (key: string) => string,
  includeTime = false,
) {
  const d = parseClinicalDate(value);
  return {
    formattedResult: d
      ? d.toLocaleString("pt-PT", {
          timeZone: "Africa/Luanda",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          ...(includeTime && value.includes("T")
            ? { hour: "2-digit", minute: "2-digit" }
            : {}),
        })
      : "Data não registada",
  };
}
export function getFormattedAge(
  birthDate: string,
  _t?: (key: string) => string,
  now = new Date(),
): string {
  const birth = parseClinicalDate(birthDate);
  if (!birth) return "";
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) =>
    Number(todayParts.find((p) => p.type === name)?.value);
  const today = new Date(
    Date.UTC(part("year"), part("month") - 1, part("day")),
  );
  if (birth > today) return "";
  const monthDiff =
    (today.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    today.getUTCMonth() -
    birth.getUTCMonth() -
    (today.getUTCDate() < birth.getUTCDate() ? 1 : 0);
  if (monthDiff >= 12) {
    const years = Math.floor(monthDiff / 12);
    return `${years} ${years === 1 ? "ano" : "anos"}`;
  }
  if (monthDiff > 0) return `${monthDiff} ${monthDiff === 1 ? "mês" : "meses"}`;
  const days = Math.floor((today.getTime() - birth.getTime()) / 86400000);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

export function dateGroupKey(value: string): string {
  const date = parseClinicalDate(value);
  if (!date) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (key: string) => p.find((v) => v.type === key)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

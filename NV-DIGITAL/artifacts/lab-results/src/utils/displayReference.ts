/** Apenas apresentação: nunca usar estes valores como chaves, em rotas ou na DB. */
export function displayReference(input: unknown): string {
  if (input === null || input === undefined || input === "") return "—";
  const raw = String(input).trim();
  if (raw.length <= 18) return raw;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw))
    return `${raw.slice(0, 8).toUpperCase()}…${raw.slice(-4).toUpperCase()}`;
  return `${raw.slice(0, 11)}…${raw.slice(-6)}`;
}

export function patientDisplayReference(patient: { processo?: unknown; id?: unknown }): string {
  const process = typeof patient.processo === "string" ? patient.processo.trim() : "";
  return process ? displayReference(process) : `#${displayReference(patient.id)}`;
}

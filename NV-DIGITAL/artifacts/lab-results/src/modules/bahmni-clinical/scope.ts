import type { ClinicalOverview } from "@workspace/api-zod";

export function overviewKey(
  empresaId: string,
  patientId: string,
  episodeId?: string,
) {
  return JSON.stringify([empresaId, patientId, episodeId || null]);
}
export function matchesOverview(
  data: ClinicalOverview,
  empresaId: string,
  patientId: string,
  episodeId?: string,
) {
  return (
    data?.empresaId === empresaId &&
    data?.patient?.id === patientId &&
    data?.episodeId === (episodeId || null)
  );
}

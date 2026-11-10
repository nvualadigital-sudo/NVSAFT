import {
  ANGOLA_GEOGRAPHY,
  COUNTRY_CODES,
  GEOGRAPHY_VERSION,
  type GeoAddress,
  type PatientGeography,
} from "@workspace/api-zod";
import { deny, value } from "./governance.js";
export function validateAddress(input: any): GeoAddress {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return deny("Endereço estruturado inválido.");
  const a: any = {};
  for (const k of [
    "country",
    "provinceId",
    "municipalityId",
    "communeId",
    "provinceName",
    "municipalityName",
    "communeName",
    "neighbourhood",
    "street",
    "house",
    "reference",
  ])
    a[k] = value(input[k], k === "reference" ? 500 : 200, true);
  if (!COUNTRY_CODES.includes(a.country)) deny("Seleccione um país válido.");
  if (a.country === "AO") {
    const p = ANGOLA_GEOGRAPHY.find((p) => p.id === a.provinceId),
      m = p?.municipalities.find((m) => m.id === a.municipalityId),
      c = m?.communes.find((c) => c.id === a.communeId);
    if ((a.provinceId && !p) || (a.municipalityId && !m) || (a.communeId && !c))
      deny(
        "A província, município e comuna não pertencem à mesma divisão administrativa.",
      );
    a.provinceName = p?.name || "";
    a.municipalityName = m?.name || "";
    a.communeName = c?.name || "";
  } else {
    a.provinceId = "";
    a.municipalityId = "";
    a.communeId = "";
  }
  return a;
}
export function validateGeography(input: any): PatientGeography {
  if (!input || !COUNTRY_CODES.includes(input.nationalityCountry))
    return deny(
      "Seleccione a nacionalidade separadamente da morada e naturalidade.",
    );
  return {
    nationalityCountry: input.nationalityCountry,
    birthplace: validateAddress(input.birthplace),
    residence: validateAddress(input.residence),
  };
}
export async function savePatientGeography(
  c: any,
  org: string,
  actor: string,
  patientId: number,
  input: any,
) {
  const data = validateGeography(input);
  await c.query(
    "INSERT INTO public.nv_patient_geography(empresa_id,patient_id,data,version,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(empresa_id,patient_id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_by=excluded.updated_by,updated_at=now()",
    [org, patientId, data, GEOGRAPHY_VERSION, actor],
  );
  return data;
}
export function localityParent(id: string) {
  for (const p of ANGOLA_GEOGRAPHY)
    for (const m of p.municipalities)
      if (m.id === id || m.communes.some((c) => c.id === id)) return true;
  return false;
}

export * from "./geography-data";
import { ANGOLA_GEOGRAPHY } from "./geography-data";
// ISO 3166-1 alpha-2 identifiers; labels follow the runtime's Portuguese locale data.
export const COUNTRY_CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
const display = new Intl.DisplayNames(["pt"], { type: "region" });
export const COUNTRIES = COUNTRY_CODES.map((code) => ({
  code,
  name: display.of(code) || code,
})).sort((a, b) => a.name.localeCompare(b.name, "pt"));
export interface GeoAddress {
  country: string;
  provinceId: string;
  municipalityId: string;
  communeId: string;
  provinceName: string;
  municipalityName: string;
  communeName: string;
  neighbourhood: string;
  street: string;
  house: string;
  reference: string;
}
export interface PatientGeography {
  nationalityCountry: string;
  birthplace: GeoAddress;
  residence: GeoAddress;
}
export const emptyAddress = (): GeoAddress => ({
  country: "AO",
  provinceId: "",
  municipalityId: "",
  communeId: "",
  provinceName: "",
  municipalityName: "",
  communeName: "",
  neighbourhood: "",
  street: "",
  house: "",
  reference: "",
});
export const emptyPatientGeography = (): PatientGeography => ({
  nationalityCountry: "AO",
  birthplace: emptyAddress(),
  residence: emptyAddress(),
});
export function addressLabel(a: GeoAddress) {
  const p = ANGOLA_GEOGRAPHY.find((p) => p.id === a.provinceId),
    m = p?.municipalities.find((m) => m.id === a.municipalityId),
    c = m?.communes.find((c) => c.id === a.communeId);
  return [
    a.street,
    a.house,
    a.neighbourhood,
    c?.name || a.communeName,
    m?.name || a.municipalityName,
    p?.name || a.provinceName,
    COUNTRIES.find((c) => c.code === a.country)?.name,
    a.reference,
  ]
    .filter(Boolean)
    .join(", ");
}

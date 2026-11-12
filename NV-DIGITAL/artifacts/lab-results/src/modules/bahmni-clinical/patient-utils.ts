/**
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/. Bahmni is also distributed under
 * the terms of the Healthcare Disclaimer located at http://openmrs.org/license.
 *
 * Copyright 2025. Thoughtworks, Inc. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */
// Adapted for NV-DIGITAL from Bahmni 12a0173eecacf49acb95c29cccf3388a98d074e9.

import {
  FormattedPatientData,
  formatDateTime,
  getFormattedAge,
} from "./patient-adapter";
interface PatientDetailsViewModel {
  fullName: string;
  gender: string;
  formattedIdentifiers: string;
  ageDetails: string;
}

function formatPatientIdentifiers(
  identifiers: Map<string, string | null>,
): string {
  if (!identifiers.size) return "";
  const joined = Array.from(identifiers.values())
    .filter((value) => value != null && value !== "")
    .join(" | ");
  return joined || "";
}

function formatAgeDetails(
  birthDate: string | null,
  t: (key: string) => string,
): string {
  if (!birthDate) return "";
  const age = getFormattedAge(birthDate, t);
  const date = formatDateTime(birthDate, t).formattedResult;
  return [age, date].filter(Boolean).join(" | ") || "";
}

export function createPatientDetailsViewModel(
  patient: FormattedPatientData,
  t: (key: string) => string,
): PatientDetailsViewModel {
  return {
    fullName: patient.fullName ?? "",
    gender: patient.gender ?? "",
    formattedIdentifiers: formatPatientIdentifiers(patient.identifiers),
    ageDetails: formatAgeDetails(patient.birthDate, t),
  };
}

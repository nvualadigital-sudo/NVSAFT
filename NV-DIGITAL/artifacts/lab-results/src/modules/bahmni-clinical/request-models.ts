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

export enum ServiceRequestStatus {
  Active = "active",
  Completed = "completed",
  Revoked = "revoked",
  Unknown = "unknown",
  Legacy = "legacy",
}

export const STATUS_TRANSLATION_MAP: Record<ServiceRequestStatus, string> = {
  [ServiceRequestStatus.Active]: "IN_PROGRESS_STATUS",
  [ServiceRequestStatus.Completed]: "COMPLETED_STATUS",
  [ServiceRequestStatus.Revoked]: "REVOKED_STATUS",
  [ServiceRequestStatus.Unknown]: "UNKNOWN_STATUS",
  [ServiceRequestStatus.Legacy]: "LEGACY_STATUS",
};

export interface ServiceRequestViewModel {
  id: string;
  testName: string;
  priority: string;
  orderedBy: string;
  orderedDate: string;
  status: string;
  replaces?: string[];
  note?: string;
  measured: string | null;
  unit: string;
  reference: string;
  version: number | null;
}

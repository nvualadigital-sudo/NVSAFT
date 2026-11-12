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

import type { ClinicalOverview } from "@workspace/api-zod";

import {
  ServiceRequestStatus,
  ServiceRequestViewModel,
} from "./request-models";

export const getStatusDotClassName = (
  status: string,
  styles: Record<string, string>,
): string => {
  switch (status) {
    case ServiceRequestStatus.Active:
      return styles.inProgressStatus;
    case ServiceRequestStatus.Completed:
      return styles.completedStatus;
    case ServiceRequestStatus.Revoked:
      return styles.revokedStatus;
    default:
      return styles.unknownStatus;
  }
};

/**
 * Priority order for service request priorities (case insensitive)
 * Index 0 = highest priority, higher index = lower priority
 * Used for sorting service requests by priority: stat → routine
 */
export const PRIORITY_ORDER = ["stat", "urgent", "routine"];

/**
 * Maps service request priority to numeric priority for sorting
 * Uses generic getPriorityByOrder function with PRIORITY_ORDER
 * @param priority - The priority of the service request
 * @returns Numeric priority (lower = higher priority)
 */
export const getServiceRequestPriority = (priority: string): number => {
  const rank = PRIORITY_ORDER.indexOf(priority.toLowerCase());
  return rank < 0 ? PRIORITY_ORDER.length : rank;
};

/**
 * Sorts service requests by priority: stat → routine
 * Maintains stable sorting (preserves original order for same priority)
 * @param requests - Array of service requests to sort
 * @returns New sorted array (does not mutate original)
 */
export const sortServiceRequestsByPriority = (
  requests: ServiceRequestViewModel[],
): ServiceRequestViewModel[] => {
  return [...requests].sort((a, b) => {
    return (
      getServiceRequestPriority(a.priority) -
      getServiceRequestPriority(b.priority)
    );
  });
};

/** Adapter: identifiers and episode association come from the NV server, never patient-name matching. */
export function mapServiceRequest(
  tests: ClinicalOverview["laboratory"],
): ServiceRequestViewModel[] {
  return tests.map((test) => ({
    id: test.id,
    testName: test.name,
    priority:
      test.priority === "emergente"
        ? "stat"
        : test.priority === "urgente"
          ? "urgent"
          : "routine",
    orderedBy: test.requestedBy || "—",
    orderedDate: test.requestedAt,
    status: test.legacy
      ? ServiceRequestStatus.Legacy
      : test.cancelled
        ? ServiceRequestStatus.Revoked
        : test.released
          ? ServiceRequestStatus.Completed
          : ServiceRequestStatus.Active,
    note: test.accession || undefined,
    measured: test.value,
    unit: test.unit,
    reference: test.reference,
    version: test.version,
  }));
}
export function groupByDate<T>(
  items: T[],
  key: (item: T) => string,
): { date: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const date = key(item);
    const rows = groups.get(date) || [];
    rows.push(item);
    groups.set(date, rows);
  }
  return Array.from(groups, ([date, items]) => ({ date, items }));
}

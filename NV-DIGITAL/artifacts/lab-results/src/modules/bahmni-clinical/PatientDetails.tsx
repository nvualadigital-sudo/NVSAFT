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

import React from "react";
import type { ClinicalOverview } from "@workspace/api-zod";
import { Icon, ICON_SIZE } from "./ui";
import { formatPatient } from "./patient-adapter";
import { patientStyles as styles } from "./styles";
import { createPatientDetailsViewModel } from "./patient-utils";

const PatientDetails: React.FC<{ patient: ClinicalOverview["patient"] }> = ({
  patient,
}) => {
  const { fullName, gender, formattedIdentifiers, ageDetails } =
    createPatientDetailsViewModel(formatPatient(patient), (key) => key);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p data-testid="patient-name" className={styles.patientName}>
          {fullName}
        </p>
        <div className={styles.details}>
          <div className={styles.identifierAndGenderWrapper}>
            <p className={styles.detailsWithIcon}>
              <Icon id="id-card" name="fa-id-card" size={ICON_SIZE.SM} />
              <span>{formattedIdentifiers}</span>
            </p>
            <p className={styles.detailsWithIcon}>
              <Icon id="gender" name="fa-mars-stroke-up" size={ICON_SIZE.SM} />
              <span>{gender}</span>
            </p>
          </div>
          <p className={styles.detailsWithIcon}>
            <Icon id="age" name="fa-cake-candles" size={ICON_SIZE.SM} />
            <span>{ageDetails}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientDetails;

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

import React, { useCallback, useMemo } from "react";
import type { ClinicalOverview } from "@workspace/api-zod";
import {
  DataTable,
  TooltipIcon,
  Accordion,
  AccordionItem,
  Tag,
  StatusTag,
} from "./ui";
import { formatDateTime, dateGroupKey } from "./patient-adapter";
import {
  ServiceRequestViewModel,
  ServiceRequestStatus,
  STATUS_TRANSLATION_MAP,
} from "./request-models";
import { requestStyles as styles } from "./styles";
import {
  groupByDate,
  mapServiceRequest,
  getStatusDotClassName,
  sortServiceRequestsByPriority,
} from "./request-utils";

const labels: Record<string, string> = {
  SERVICE_REQUEST_TEST_NAME: "Exame",
  SERVICE_REQUEST_ORDERED_BY: "Solicitado por",
  SERVICE_REQUEST_ORDERED_ON: "Data e hora",
  SERVICE_REQUEST_ORDERED_STATUS: "Estado",
  SERVICE_REQUEST_PRIORITY_URGENT: "Urgente",
  SERVICE_REQUEST_HEADING: "Pedidos e resultados laboratoriais",
  NO_SERVICE_REQUESTS: "Sem pedidos ou resultados neste período.",
  RESULT_VALUE: "Resultado",
  IN_PROGRESS_STATUS: "Em curso",
  COMPLETED_STATUS: "Disponível",
  REVOKED_STATUS: "Cancelado",
  UNKNOWN_STATUS: "Estado não registado",
  LEGACY_STATUS: "Histórico",
};
const t = (key: string) => labels[key] || key;

/** Bahmni service-request display control, adapted to the existing NV laboratory workflow. */
const GenericServiceRequestTable: React.FC<{
  requests: ClinicalOverview["laboratory"];
  loading?: boolean;
  error?: string;
}> = ({ requests, loading: isLoading = false, error }) => {
  const serviceRequests = useMemo(
    () => mapServiceRequest(requests),
    [requests],
  );
  const isError = Boolean(error);
  const headers = useMemo(
    () => [
      {
        key: "testName",
        header: t("SERVICE_REQUEST_TEST_NAME"),
        enableSorting: true,
      },
      {
        key: "orderedBy",
        header: t("SERVICE_REQUEST_ORDERED_BY"),
        enableSorting: true,
      },
      {
        key: "orderedOn",
        header: t("SERVICE_REQUEST_ORDERED_ON"),
        enableSorting: true,
      },
      { key: "result", header: t("RESULT_VALUE"), enableSorting: false },
      {
        key: "status",
        header: t("SERVICE_REQUEST_ORDERED_STATUS"),
        enableSorting: true,
      },
    ],
    [t],
  );

  const processedServiceRequests = useMemo(() => {
    const filteredRequests = serviceRequests;

    const grouped = groupByDate(
      filteredRequests,
      (request: ServiceRequestViewModel) => {
        return dateGroupKey(request.orderedDate);
      },
    );

    const sortedGroups = grouped.sort((a, b) => b.date.localeCompare(a.date));

    const groupedData = sortedGroups.map((group) => ({
      date: group.date,
      requests: group.items,
    }));

    return groupedData.map((requestsByDate) => ({
      ...requestsByDate,
      requests: sortServiceRequestsByPriority(requestsByDate.requests),
    }));
  }, [serviceRequests, t]);

  const renderCell = useCallback(
    (request: ServiceRequestViewModel, cellId: string) => {
      switch (cellId) {
        case "testName":
          return (
            <>
              <p className={styles.requestName}>
                <span>{request.testName}</span>
                {request.note && (
                  <TooltipIcon
                    iconName="fa-file-lines"
                    content={request.note}
                    ariaLabel={request.note}
                  />
                )}
              </p>
              {["stat", "urgent"].includes(request.priority) && (
                <Tag type="red">
                  {request.priority === "stat"
                    ? "Emergente"
                    : t("SERVICE_REQUEST_PRIORITY_URGENT")}
                </Tag>
              )}
            </>
          );
        case "orderedBy":
          return request.orderedBy;
        case "orderedOn":
          return request.orderedDate
            ? formatDateTime(request.orderedDate, t, true).formattedResult
            : "-";
        case "result":
          return request.measured === null ? (
            "Por lançar"
          ) : (
            <div className="bh-result">
              <strong>
                {request.measured} {request.unit}
              </strong>
              {request.reference && (
                <small>Referência: {request.reference}</small>
              )}
              {request.version !== null && (
                <small>Versão {request.version}</small>
              )}
            </div>
          );
        case "status":
          return (
            <StatusTag
              label={t(
                STATUS_TRANSLATION_MAP[request.status as ServiceRequestStatus],
              )}
              dotClassName={getStatusDotClassName(request.status, styles)}
              testId={`${request.id}-status`}
            />
          );

        default:
          return null;
      }
    },
    [t],
  );

  return (
    <div
      id="generic-service-request-table"
      data-testid="generic-service-request-table"
    >
      {isLoading || !!isError || processedServiceRequests.length === 0 ? (
        <DataTable
          columns={headers}
          ariaLabel={t("SERVICE_REQUEST_HEADING")}
          rows={[]}
          loading={isLoading}
          errorStateMessage={isError ? error : undefined}
          emptyStateMessage={t("NO_SERVICE_REQUESTS")}
          renderCell={renderCell}
          className={styles.serviceRequestTableBody}
          dataTestId="generic-service-request-table"
        />
      ) : (
        <Accordion align="start">
          {processedServiceRequests.map((requestsByDate, index) => {
            const { date, requests } = requestsByDate;

            return (
              <AccordionItem
                title={formatDateTime(date).formattedResult}
                key={date}
                className={styles.customAccordianItem}
                testId={"accordian-table-title"}
                open={index === 0}
              >
                <DataTable
                  columns={headers}
                  rows={requests}
                  ariaLabel={t("SERVICE_REQUEST_HEADING")}
                  dataTestId={`generic-service-request-table-${date}`}
                  loading={isLoading}
                  errorStateMessage={""}
                  emptyStateMessage={t("NO_SERVICE_REQUESTS")}
                  renderCell={renderCell}
                  className={styles.serviceRequestTableBody}
                />
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};

export default GenericServiceRequestTable;

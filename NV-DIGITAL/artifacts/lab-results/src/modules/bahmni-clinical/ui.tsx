import React, { useMemo, useState, type ReactNode } from "react";
import { IdCard, UserRound, CalendarDays, FileText } from "lucide-react";

export const ICON_SIZE = { SM: 16 };
export function Icon({
  id,
  size,
}: {
  id: string;
  name?: string;
  size: number;
}) {
  const C = id === "id-card" ? IdCard : id === "age" ? CalendarDays : UserRound;
  return <C size={size} aria-hidden="true" />;
}
export function Tag({ children }: { children: ReactNode; type?: string }) {
  return <span className="bh-tag">{children}</span>;
}
export function StatusTag({
  label,
  dotClassName,
  testId,
}: {
  label: string;
  dotClassName: string;
  testId: string;
}) {
  return (
    <span className="bh-status" data-testid={testId}>
      <span aria-hidden="true" className={dotClassName} />
      {label}
    </span>
  );
}
export function TooltipIcon({
  content,
}: {
  content: string;
  iconName?: string;
  ariaLabel?: string;
}) {
  return (
    <span title={content}>
      <FileText size={14} aria-label={content} />
    </span>
  );
}
export function Accordion({
  children,
}: {
  children: ReactNode;
  align?: string;
}) {
  return <div className="bh-accordion">{children}</div>;
}
export function AccordionItem({
  title,
  children,
  open,
  className,
  testId,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <details className={className} open={open}>
      <summary data-testid={testId}>{title}</summary>
      {children}
    </details>
  );
}
interface Column {
  key: string;
  header: string;
  enableSorting?: boolean;
}
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  errorStateMessage,
  emptyStateMessage,
  ariaLabel,
  renderCell,
  className,
  dataTestId,
}: {
  columns: Column[];
  rows: T[];
  loading?: boolean;
  errorStateMessage?: string;
  emptyStateMessage: string;
  ariaLabel: string;
  renderCell: (row: T, key: string) => ReactNode;
  className?: string;
  dataTestId?: string;
}) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(
    null,
  );
  const ordered = useMemo(
    () =>
      !sort
        ? rows
        : [...rows].sort(
            (a, b) =>
              String(
                (a as any)[
                  sort.key === "orderedOn" ? "orderedDate" : sort.key
                ] ?? "",
              ).localeCompare(
                String(
                  (b as any)[
                    sort.key === "orderedOn" ? "orderedDate" : sort.key
                  ] ?? "",
                ),
                "pt",
                { numeric: true },
              ) * sort.direction,
          ),
    [rows, sort],
  );
  return (
    <div className="bh-table-scroll">
      <table
        aria-label={ariaLabel}
        aria-busy={loading}
        className={className}
        data-testid={dataTestId}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sort?.key === c.key
                    ? sort.direction === 1
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                {c.enableSorting ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSort((s) => ({
                        key: c.key,
                        direction:
                          s?.key === c.key && s.direction === 1 ? -1 : 1,
                      }))
                    }
                  >
                    {c.header}
                    {sort?.key === c.key
                      ? sort.direction === 1
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading || errorStateMessage || !ordered.length ? (
            <tr>
              <td colSpan={columns.length}>
                <p role={errorStateMessage ? "alert" : "status"}>
                  {loading
                    ? "A carregar os pedidos…"
                    : errorStateMessage || emptyStateMessage}
                </p>
              </td>
            </tr>
          ) : (
            ordered.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key}>{renderCell(row, c.key)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

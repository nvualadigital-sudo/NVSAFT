import type { CSSProperties } from "react";
import { SHIFT_LEGEND, type ShiftCode } from "@workspace/api-zod";
export function rosterShiftStyle(code?: ShiftCode): CSSProperties {
  const palette = code ? SHIFT_LEGEND[code] : undefined;
  return {
    "--roster-shift-bg": palette?.bg || "#ffffff",
    "--roster-shift-fg": palette?.fg || "#475569",
    backgroundColor: palette?.bg || "#ffffff",
    color: palette?.fg || "#475569",
    borderColor: palette?.fg || "#cbd5e1",
  } as CSSProperties;
}

import { createContext, useContext } from "react";
import type { useWard } from "./useWard";
export const WardContext = createContext<ReturnType<typeof useWard> | null>(
  null,
);
export function useWardContext() {
  const value = useContext(WardContext);
  if (!value) throw new Error("Componente fora da Enfermagem");
  return value;
}

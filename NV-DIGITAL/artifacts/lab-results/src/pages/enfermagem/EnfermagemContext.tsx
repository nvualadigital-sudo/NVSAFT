import { createContext, useContext } from "react";
import type { useEnfermagem } from "./useEnfermagem";
export const EnfermagemContext = createContext<ReturnType<
  typeof useEnfermagem
> | null>(null);
export function useEnfermagemContext() {
  const value = useContext(EnfermagemContext);
  if (!value) throw new Error("Componente fora da Enfermagem");
  return value;
}

import { useCallback } from "react";
import { NursingModule } from "./integrated/NursingModule";
import type { NursingSession } from "./shared";
export default function Enfermagem({
  session,
}: { session?: NursingSession & { funcao?: string } } = {}) {
  const getAccessToken = useCallback(
    () => sessionStorage.getItem("lab_token_emp_v4") || undefined,
    [],
  );
  if (!session?.empresaId)
    return (
      <div className="p-6">
        Seleccione a instituição antes de abrir o posto clínico.
      </div>
    );
  return (
    <NursingModule
      key={session.empresaId}
      embedded
      getAccessToken={getAccessToken}
      baseUrl={`${import.meta.env.VITE_API_URL?.replace(/\/$/, "") || ""}/api/hospital/nursing-integrated`}
      initialPage={
        session.funcao === "medico"
          ? "orders"
          : session.funcao === "farmaceutico"
            ? "pharmacy"
            : "overview"
      }
    />
  );
}

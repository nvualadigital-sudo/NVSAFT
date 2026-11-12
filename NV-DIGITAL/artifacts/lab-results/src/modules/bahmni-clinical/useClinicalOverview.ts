import { useEffect, useRef, useState } from "react";
import type { ClinicalOverview } from "@workspace/api-zod";
import { hospitalApi, hospitalEvent } from "../../store/hospital";
import { matchesOverview, overviewKey } from "./scope";
export function useClinicalOverview(
  empresaId: string,
  patientId: string,
  episodeId?: string,
) {
  const key = overviewKey(empresaId, patientId, episodeId);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: ClinicalOverview;
    error: string;
    loading: boolean;
  }>({ key: "", error: "", loading: true });
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const serial = ++request.current;
      setState((old) => ({
        key,
        data: old.key === key ? old.data : undefined,
        error: "",
        loading: true,
      }));
      try {
        if (!empresaId || !patientId)
          throw new Error("Seleccione um paciente da instituição activa.");
        const path =
          "/clinical-overview/" +
          encodeURIComponent(patientId) +
          (episodeId ? "?episodeId=" + encodeURIComponent(episodeId) : "");
        const data = await hospitalApi<ClinicalOverview>("GET", path);
        if (!matchesOverview(data, empresaId, patientId, episodeId))
          throw new Error(
            "A resposta não corresponde ao paciente e atendimento seleccionados.",
          );
        if (active && serial === request.current)
          setState({ key, data, error: "", loading: false });
      } catch (error) {
        if (active && serial === request.current)
          setState({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível carregar o processo clínico.",
            loading: false,
          });
      }
    };
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(hospitalEvent, refresh);
    return () => {
      active = false;
      request.current++;
      window.clearInterval(timer);
      window.removeEventListener(hospitalEvent, refresh);
    };
  }, [key, empresaId, patientId, episodeId, version]);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : "",
    loading: state.key !== key || state.loading,
    refresh: () => setVersion((v) => v + 1),
  };
}

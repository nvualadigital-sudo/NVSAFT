import patient from "./PatientDetails.tsx?raw";
import patientUtils from "./patient-utils.ts?raw";
import requests from "./GenericServiceRequestTable.tsx?raw";
import requestUtils from "./request-utils.ts?raw";
import models from "./request-models.ts?raw";
import ui from "./ui.tsx?raw";
import styles from "./styles.ts?raw";
import adapter from "./patient-adapter.ts?raw";
import css from "./clinical-overview.css?raw";
import contract from "../../../../../lib/api-zod/src/clinical-overview.ts?raw";
import license from "./LICENSE.txt?raw";
import notice from "./NOTICE.txt?raw";

export default function SourceAttribution() {
  function download() {
    const files = {
      "PatientDetails.tsx": patient,
      "patient-utils.ts": patientUtils,
      "GenericServiceRequestTable.tsx": requests,
      "request-utils.ts": requestUtils,
      "request-models.ts": models,
      "ui.tsx": ui,
      "styles.ts": styles,
      "patient-adapter.ts": adapter,
      "clinical-overview.css": css,
      "clinical-overview.ts": contract,
      "LICENSE.txt": license,
      "NOTICE.txt": notice,
    };
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              module: "Componentes clínicos Bahmni adaptados ao NV-DIGITAL",
              files,
            },
            null,
            2,
          ),
        ],
        { type: "application/json;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "NV_DIGITAL_Componentes_Bahmni_Fontes.json";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <details className="co-attribution">
      <summary>Créditos e licenças dos componentes</summary>
      <p>
        Componentes PatientDetails e GenericServiceRequestTable do Bahmni,
        adaptados ao NV-DIGITAL. Mozilla Public License 2.0; avisos originais
        incluídos.
      </p>
      <button type="button" className="co-source-button" onClick={download}>
        Descarregar código dos componentes e licenças
      </button>
    </details>
  );
}

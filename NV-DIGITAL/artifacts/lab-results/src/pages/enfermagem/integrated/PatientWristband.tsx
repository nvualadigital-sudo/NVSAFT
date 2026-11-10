import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, X } from "lucide-react";
import { type Person } from "./model";
export function PatientWristband({
  patient,
  onClose,
}: {
  patient: Person;
  onClose: () => void;
}) {
  const [qr, setQr] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(patient.code, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
    })
      .then((src) => {
        if (active) setQr(src);
      })
      .catch(() => setError("Não foi possível gerar o código QR."));
    return () => {
      active = false;
    };
  }, [patient.code]);
  return (
    <div className="nc-modal-backdrop nc-wristband-backdrop">
      <section
        className="nc-modal nc-wristband-preview"
        role="dialog"
        aria-modal="true"
        aria-label="Pulseira do paciente"
      >
        <div className="nc-panel-heading">
          <div>
            <h2>Identificação do paciente</h2>
            <p>Pré-visualização da etiqueta · 100 × 32 mm</p>
          </div>
          <button
            className="nc-icon-btn"
            onClick={onClose}
            aria-label="Fechar pulseira"
          >
            <X size={20} />
          </button>
        </div>
        <div className="nc-wristband">
          {qr && <img src={qr} alt={`QR do processo ${patient.code}`} />}
          <div>
            <strong>{patient.name}</strong>
            <span>PROCESSO: {patient.code}</span>
            <span>NASC.: {patient.birthDate}</span>
            <b>ALERGIAS: {patient.allergies}</b>
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="nc-modal-footer">
          <span>Confirme a identidade antes de colocar a pulseira.</span>
          <button
            className="nc-btn primary"
            disabled={!qr}
            onClick={() => window.print()}
          >
            <Printer size={16} /> Imprimir pulseira
          </button>
        </div>
      </section>
    </div>
  );
}

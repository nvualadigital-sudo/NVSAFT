import { useApp } from "../../store/AppContext";
import { ClinicalSession } from "./clinica/store";
import MedicoWorkspace from "./workspace/MedicoWorkspace";
export default function Medico({
  session,
  specialty,
}: { session?: ClinicalSession; specialty?: string } = {}) {
  const { data } = useApp();
  if (!session?.empresaId)
    return (
      <div className="p-6">
        Seleccione a instituição para abrir o módulo Médico.
      </div>
    );
  return (
    <MedicoWorkspace
      key={session.empresaId}
      session={session}
      specialty={specialty}
      patients={data.pacientes}
    />
  );
}

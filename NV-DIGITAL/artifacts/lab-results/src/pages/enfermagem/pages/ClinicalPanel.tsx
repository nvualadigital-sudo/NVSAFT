import { useWardContext } from "../WardContext";
import AvaliacoesPage from "./AvaliacoesPage";
import DorPage from "./DorPage";
import PrescricoesPage from "./PrescricoesPage";
import TriagemPage from "./TriagemPage";
export default function ClinicalPanel() {
  const { tab, patientId } = useWardContext();
  return tab === "triagem" ? (
    <TriagemPage key={patientId} />
  ) : tab === "dor" ? (
    <DorPage key={patientId} />
  ) : tab === "avaliacao" ? (
    <AvaliacoesPage key={patientId} />
  ) : (
    <PrescricoesPage key={patientId} />
  );
}

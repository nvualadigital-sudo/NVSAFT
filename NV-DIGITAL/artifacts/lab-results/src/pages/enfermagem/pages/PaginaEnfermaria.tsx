import { TabsContent } from "@/components/ui/tabs";

import { useEnfermagemContext } from "../EnfermagemContext";
import WardBoard from "../WardBoard";
export default function PaginaEnfermaria() {
  const {
    session,
    scope,
    setShowNovoAtendimento,
    setShowDetalhes,
    setSelectedAtend,
    atendimentos,
  } = useEnfermagemContext();
  return (
    <TabsContent value="enfermaria">
      <WardBoard
        patients={atendimentos}
        scope={scope}
        session={session}
        onNew={() => setShowNovoAtendimento(true)}
        onOpen={(p) => {
          setSelectedAtend(p);
          setShowDetalhes(true);
        }}
      />
    </TabsContent>
  );
}

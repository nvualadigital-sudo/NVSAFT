import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Eye } from "lucide-react";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogCalendario() {
  const {
    setShowDetalhes,
    showCalendario,
    setShowCalendario,
    setSelectedAtend,
    getRiscoBadge,
    followUpsOrdenados,
  } = useEnfermagemContext();
  return (
    <Dialog open={showCalendario} onOpenChange={setShowCalendario}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" /> Calendário de
            Follow-ups
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          {followUpsOrdenados.map((atend) => (
            <div
              key={atend.idEnf}
              className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex flex-col items-center justify-center text-white">
                  <span className="text-xs font-medium">
                    {new Date(atend.followUp!).toLocaleDateString("pt-PT", {
                      month: "short",
                    })}
                  </span>
                  <span className="text-lg font-bold leading-none">
                    {new Date(atend.followUp!).getDate()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{atend.nomePaciente}</p>
                  <p className="text-sm text-slate-500">
                    Q{atend.quarto}-{atend.leito} • {atend.diagnosticoPrincipal}
                  </p>
                  <div className="mt-1">{getRiscoBadge(atend.risco)}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAtend(atend);
                  setShowCalendario(false);
                  setShowDetalhes(true);
                }}
              >
                <Eye className="w-3 h-3 mr-1" /> Ver
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

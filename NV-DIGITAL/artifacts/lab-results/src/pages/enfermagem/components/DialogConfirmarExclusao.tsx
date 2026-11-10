import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogConfirmarExclusao() {
  const {
    showConfirmarExclusao,
    setShowConfirmarExclusao,
    atendParaExcluir,
    getAnexosCount,
    handleExcluirAtendimento,
  } = useEnfermagemContext();
  return (
    <Dialog
      open={showConfirmarExclusao}
      onOpenChange={setShowConfirmarExclusao}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" /> Confirmar Exclusão
          </DialogTitle>
          <DialogDescription>
            Esta ação também removerá todos os anexos.
          </DialogDescription>
        </DialogHeader>
        {atendParaExcluir && (
          <div className="p-4 bg-slate-50 rounded-lg my-4">
            <p className="font-semibold">{atendParaExcluir.nomePaciente}</p>
            <p className="text-sm text-slate-500">
              {atendParaExcluir.diagnosticoPrincipal}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {getAnexosCount(atendParaExcluir.idEnf)} anexos serão removidos
            </p>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowConfirmarExclusao(false)}
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleExcluirAtendimento}>
            <Trash2 className="w-4 h-4 mr-2" /> Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

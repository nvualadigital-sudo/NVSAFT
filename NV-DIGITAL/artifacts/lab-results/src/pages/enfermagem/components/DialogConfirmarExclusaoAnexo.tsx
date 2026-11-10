import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, Trash2 } from "lucide-react";
import { TIPOS_ANEXO_ENF } from "../shared";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogConfirmarExclusaoAnexo() {
  const {
    showConfirmarExclusaoAnexo,
    setShowConfirmarExclusaoAnexo,
    anexoParaExcluir,
    handleExcluirAnexo,
  } = useEnfermagemContext();
  return (
    <Dialog
      open={showConfirmarExclusaoAnexo}
      onOpenChange={setShowConfirmarExclusaoAnexo}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" /> Remover Anexo
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja remover este documento?
          </DialogDescription>
        </DialogHeader>
        {anexoParaExcluir && (
          <div className="p-4 bg-slate-50 rounded-lg my-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-white",
                  TIPOS_ANEXO_ENF[anexoParaExcluir.tipo].cor,
                )}
              >
                {(() => {
                  const Icon = TIPOS_ANEXO_ENF[anexoParaExcluir.tipo].icon;
                  return <Icon className="w-5 h-5" />;
                })()}
              </div>
              <div>
                <p className="font-semibold">{anexoParaExcluir.nome}</p>
                <p className="text-xs text-slate-500">
                  {TIPOS_ANEXO_ENF[anexoParaExcluir.tipo].label} •{" "}
                  {anexoParaExcluir.tamanho}
                </p>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowConfirmarExclusaoAnexo(false)}
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleExcluirAnexo}>
            <Trash2 className="w-4 h-4 mr-2" /> Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

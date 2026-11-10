import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Edit3, Save } from "lucide-react";
import { AtendEnfermagem } from "../shared";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogEditar() {
  const {
    showEditar,
    setShowEditar,
    selectedAtend,
    setSelectedAtend,
    handleEditarAtendimento,
  } = useEnfermagemContext();
  return (
    <Dialog open={showEditar} onOpenChange={setShowEditar}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-teal-600" /> Editar Atendimento
          </DialogTitle>
        </DialogHeader>
        {selectedAtend && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Diagnóstico</Label>
                <Input
                  value={selectedAtend.diagnosticoPrincipal}
                  onChange={(e) =>
                    setSelectedAtend({
                      ...selectedAtend,
                      diagnosticoPrincipal: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Risco</Label>
                <Select
                  value={selectedAtend.risco}
                  onValueChange={(v) =>
                    setSelectedAtend({
                      ...selectedAtend,
                      risco: v as AtendEnfermagem["risco"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="moderado">Moderado</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="emergencia">Emergência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Medicações</Label>
              <Textarea
                value={selectedAtend.medicacoes}
                onChange={(e) =>
                  setSelectedAtend({
                    ...selectedAtend,
                    medicacoes: e.target.value,
                  })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Plano de Cuidados</Label>
              <Textarea
                value={selectedAtend.planoCuidados}
                onChange={(e) =>
                  setSelectedAtend({
                    ...selectedAtend,
                    planoCuidados: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={selectedAtend.observacoes || ""}
                onChange={(e) =>
                  setSelectedAtend({
                    ...selectedAtend,
                    observacoes: e.target.value,
                  })
                }
                rows={2}
              />
            </div>
          </div>
        )}
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setShowEditar(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleEditarAtendimento}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
          >
            <Save className="w-4 h-4 mr-2" /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

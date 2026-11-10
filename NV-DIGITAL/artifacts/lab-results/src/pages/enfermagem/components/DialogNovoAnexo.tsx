import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CheckCircle2, Save, Upload } from "lucide-react";
import { AnexoEnf, TIPOS_ANEXO_ENF } from "../shared";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogNovoAnexo() {
  const {
    showNovoAnexo,
    setShowNovoAnexo,
    dragOver,
    setDragOver,
    fileInputRef,
    formAnexo,
    setFormAnexo,
    handleFileSelect,
    handleDrop,
    handleSalvarAnexo,
  } = useEnfermagemContext();
  return (
    <Dialog open={showNovoAnexo} onOpenChange={setShowNovoAnexo}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-teal-600" /> Anexar Documento
            Clínico
          </DialogTitle>
          <DialogDescription>
            Prescrições, evoluções, exames ou imagens
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
              dragOver
                ? "border-teal-500 bg-teal-50"
                : "border-slate-300 hover:border-teal-400 hover:bg-teal-50/30",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <Upload
              className={cn(
                "w-12 h-12 mx-auto mb-3",
                dragOver ? "text-teal-600" : "text-slate-400",
              )}
            />
            <p className="font-semibold text-slate-700">
              {dragOver
                ? "Solte o ficheiro aqui"
                : "Arraste um ficheiro ou clique para selecionar"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              PDF, JPG, PNG, DOC, XLS até 25MB
            </p>
            {formAnexo.nome && (
              <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700 inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {formAnexo.nome}.{formAnexo.formato?.toLowerCase()} (
                {formAnexo.tamanho})
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo de Documento *</Label>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(TIPOS_ANEXO_ENF).map(([key, tipo]) => {
                const Icon = tipo.icon;
                const selected = formAnexo.tipo === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setFormAnexo({
                        ...formAnexo,
                        tipo: key as AnexoEnf["tipo"],
                      })
                    }
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-center",
                      selected
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-teal-300",
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-white mx-auto mb-1",
                        tipo.cor,
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">
                      {tipo.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formAnexo.nome || ""}
                onChange={(e) =>
                  setFormAnexo({ ...formAnexo, nome: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={formAnexo.data || ""}
                onChange={(e) =>
                  setFormAnexo({ ...formAnexo, data: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={formAnexo.descricao || ""}
              onChange={(e) =>
                setFormAnexo({ ...formAnexo, descricao: e.target.value })
              }
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Instituição</Label>
              <Input
                value={formAnexo.instituicao || ""}
                onChange={(e) =>
                  setFormAnexo({ ...formAnexo, instituicao: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Input
                value={formAnexo.profissional || ""}
                onChange={(e) =>
                  setFormAnexo({ ...formAnexo, profissional: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formAnexo.observacoes || ""}
              onChange={(e) =>
                setFormAnexo({ ...formAnexo, observacoes: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setShowNovoAnexo(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvarAnexo}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
          >
            <Save className="w-4 h-4 mr-2" /> Guardar Anexo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Download, FileText, Info, Trash2 } from "lucide-react";
import { TIPOS_ANEXO_ENF } from "../shared";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogVisualizarAnexo() {
  const {
    showVisualizarAnexo,
    setShowVisualizarAnexo,
    setShowConfirmarExclusaoAnexo,
    setAnexoParaExcluir,
    anexoVisualizado,
    atendimentos,
    formatDate,
    getRiscoBadge,
    handleDownloadAnexo,
  } = useEnfermagemContext();
  return (
    <Dialog open={showVisualizarAnexo} onOpenChange={setShowVisualizarAnexo}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {anexoVisualizado && (
              <>
                <div
                  className={cn(
                    "w-14 h-14 rounded-lg flex items-center justify-center text-white flex-shrink-0",
                    TIPOS_ANEXO_ENF[anexoVisualizado.tipo].cor,
                  )}
                >
                  {(() => {
                    const Icon = TIPOS_ANEXO_ENF[anexoVisualizado.tipo].icon;
                    return <Icon className="w-7 h-7" />;
                  })()}
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl">
                    {anexoVisualizado.nome}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {TIPOS_ANEXO_ENF[anexoVisualizado.tipo].label} •{" "}
                    {formatDate(anexoVisualizado.data)}
                  </DialogDescription>
                </div>
              </>
            )}
          </div>
        </DialogHeader>

        {anexoVisualizado &&
          (() => {
            const atend = atendimentos.find(
              (a) => a.idEnf === anexoVisualizado.idAtendimento,
            );
            return (
              <div className="space-y-4 mt-4">
                {atend && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-teal-100 text-teal-700">
                            {atend.nomePaciente
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{atend.nomePaciente}</p>
                          <p className="text-xs text-slate-500">
                            Q{atend.quarto}-{atend.leito} •{" "}
                            {atend.diagnosticoPrincipal}
                          </p>
                        </div>
                        <div className="ml-auto">
                          {getRiscoBadge(atend.risco)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500">Instituição</p>
                      <p className="font-semibold mt-1">
                        {anexoVisualizado.instituicao || "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500">Profissional</p>
                      <p className="font-semibold mt-1">
                        {anexoVisualizado.profissional || "—"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500">Formato</p>
                      <p className="font-semibold mt-1">
                        {anexoVisualizado.formato}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500">Tamanho</p>
                      <p className="font-semibold mt-1">
                        {anexoVisualizado.tamanho}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Descrição</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700">
                      {anexoVisualizado.descricao || "—"}
                    </p>
                  </CardContent>
                </Card>

                {anexoVisualizado.observacoes && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                        <Info className="w-4 h-4" /> Observações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-amber-900">
                        {anexoVisualizado.observacoes}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-slate-50 border-2 border-dashed border-slate-300">
                  <CardContent className="p-8 text-center">
                    <FileText className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                    <p className="font-semibold text-slate-700">
                      Pré-visualização do documento
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Em produção, aqui seria exibido o conteúdo do{" "}
                      {anexoVisualizado.formato}
                    </p>
                    <Button
                      className="mt-4 gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
                      onClick={() => handleDownloadAnexo(anexoVisualizado)}
                    >
                      <Download className="w-4 h-4" /> Descarregar Documento
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => setShowVisualizarAnexo(false)}
          >
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownloadAnexo(anexoVisualizado!)}
          >
            <Download className="w-4 h-4 mr-2" /> Descarregar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (anexoVisualizado) {
                setAnexoParaExcluir(anexoVisualizado);
                setShowVisualizarAnexo(false);
                setShowConfirmarExclusaoAnexo(true);
              }
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

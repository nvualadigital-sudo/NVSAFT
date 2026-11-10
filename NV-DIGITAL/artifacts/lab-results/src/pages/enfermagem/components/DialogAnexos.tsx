import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Download,
  Eye,
  FileSpreadsheet,
  Paperclip,
  Search,
  Stethoscope,
  Trash2,
  Upload,
} from "lucide-react";
import { TIPOS_ANEXO_ENF } from "../shared";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogAnexos() {
  const {
    showAnexos,
    setShowAnexos,
    setShowNovoAnexo,
    setShowVisualizarAnexo,
    setShowConfirmarExclusaoAnexo,
    selectedAtend,
    setAnexoParaExcluir,
    setAnexoVisualizado,
    filterAnexoTipo,
    setFilterAnexoTipo,
    searchAnexo,
    setSearchAnexo,
    anexosAtendimento,
    formatDate,
    handleDownloadAnexo,
  } = useEnfermagemContext();
  return (
    <Dialog open={showAnexos} onOpenChange={setShowAnexos}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-teal-100 text-teal-700 text-lg">
                  {selectedAtend?.nomePaciente
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xl font-bold">
                  {selectedAtend?.nomePaciente}
                </p>
                <p className="text-sm text-slate-500">
                  Anexos clínicos • {anexosAtendimento.length} documentos
                </p>
              </div>
            </DialogTitle>
            <Button
              onClick={() => setShowNovoAnexo(true)}
              className="gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
            >
              <Upload className="w-4 h-4" /> Anexar Documento
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Pesquisar anexos..."
              value={searchAnexo}
              onChange={(e) => setSearchAnexo(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterAnexoTipo} onValueChange={setFilterAnexoTipo}>
            <SelectTrigger className="w-full md:w-[220px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {Object.entries(TIPOS_ANEXO_ENF).map(([key, tipo]) => (
                <SelectItem key={key} value={key}>
                  {tipo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 space-y-3">
          {anexosAtendimento.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
              <Paperclip className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">
                Nenhum anexo encontrado
              </p>
              <Button
                className="mt-4 gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
                onClick={() => setShowNovoAnexo(true)}
              >
                <Upload className="w-4 h-4" /> Adicionar Primeiro Anexo
              </Button>
            </div>
          ) : (
            anexosAtendimento.map((anexo) => {
              const tipo = TIPOS_ANEXO_ENF[anexo.tipo];
              const Icon = tipo.icon;
              return (
                <div
                  key={anexo.id}
                  className={cn(
                    "group p-4 rounded-xl border-2 transition-all hover:shadow-md",
                    tipo.corLight,
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-lg flex items-center justify-center text-white flex-shrink-0",
                        tipo.cor,
                      )}
                    >
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {anexo.nome}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {tipo.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {anexo.formato}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {anexo.tamanho}
                            </span>
                            <span className="text-xs text-slate-500">
                              • {formatDate(anexo.data)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAnexoVisualizado(anexo);
                              setShowVisualizarAnexo(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadAnexo(anexo)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAnexoParaExcluir(anexo);
                              setShowConfirmarExclusaoAnexo(true);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mt-2">
                        {anexo.descricao}
                      </p>
                      {(anexo.instituicao || anexo.profissional) && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          {anexo.instituicao && (
                            <span className="flex items-center gap-1">
                              <FileSpreadsheet className="w-3 h-3" />{" "}
                              {anexo.instituicao}
                            </span>
                          )}
                          {anexo.profissional && (
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-3 h-3" />{" "}
                              {anexo.profissional}
                            </span>
                          )}
                        </div>
                      )}
                      {anexo.observacoes && (
                        <div className="mt-3 p-2 bg-white/60 rounded border border-slate-200/60">
                          <p className="text-xs text-slate-700">
                            <span className="font-semibold">Observações:</span>{" "}
                            {anexo.observacoes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

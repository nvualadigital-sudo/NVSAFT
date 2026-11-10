import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Activity,
  Calendar as CalendarIcon,
  ClipboardList,
  Edit3,
  FileText,
  HeartPulse,
  Info,
  Paperclip,
  Pill,
  Printer,
  Stethoscope,
  Syringe,
  Thermometer,
  Upload,
  Wind,
} from "lucide-react";
import { TIPOS_ANEXO_ENF } from "../shared";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogDetalhes() {
  const {
    showDetalhes,
    setShowDetalhes,
    setShowEditar,
    setShowAnexos,
    setShowNovoAnexo,
    setShowVisualizarAnexo,
    selectedAtend,
    setAnexoVisualizado,
    anexos,
    getAnexosCount,
    formatDate,
    getRiscoBadge,
    getClassificarPA,
    getClassificarSatO2,
    getClassificarTemp,
    getClassificarGlicemia,
    handleImprimir,
  } = useEnfermagemContext();
  return (
    <Dialog open={showDetalhes} onOpenChange={setShowDetalhes}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
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
                  Atendimento #{selectedAtend?.codigoAtendimento} •{" "}
                  {selectedAtend?.idade}a • Q{selectedAtend?.quarto}-
                  {selectedAtend?.leito}
                </p>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {selectedAtend && getRiscoBadge(selectedAtend.risco)}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="sinais" className="mt-4">
          <TabsList className="grid grid-cols-6">
            <TabsTrigger value="sinais" className="gap-1">
              <HeartPulse className="w-3 h-3" /> Sinais
            </TabsTrigger>
            <TabsTrigger value="clinico" className="gap-1">
              <Stethoscope className="w-3 h-3" /> Clínico
            </TabsTrigger>
            <TabsTrigger value="cuidados" className="gap-1">
              <ClipboardList className="w-3 h-3" /> Cuidados
            </TabsTrigger>
            <TabsTrigger value="plano" className="gap-1">
              <FileText className="w-3 h-3" /> Plano
            </TabsTrigger>
            <TabsTrigger value="anexos" className="gap-1">
              <Paperclip className="w-3 h-3" /> Anexos
              {selectedAtend && getAnexosCount(selectedAtend.idEnf) > 0 && (
                <Badge className="bg-teal-500 text-white ml-1 px-1.5 py-0 text-xs">
                  {getAnexosCount(selectedAtend.idEnf)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="gap-1">
              <Activity className="w-3 h-3" /> Evolução
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sinais" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <HeartPulse className="w-3 h-3" /> Pressão Arterial
                  </p>
                  <p
                    className={cn(
                      "font-bold mt-1 text-lg",
                      getClassificarPA(selectedAtend?.pressaoArterial || "")
                        .cor,
                    )}
                  >
                    {selectedAtend?.pressaoArterial}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {
                      getClassificarPA(selectedAtend?.pressaoArterial || "")
                        .label
                    }
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Frequência Cardíaca</p>
                  <p className="font-bold mt-1 text-lg text-pink-600">
                    {selectedAtend?.frequenciaCardiaca}{" "}
                    <span className="text-xs">bpm</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    Frequência Respiratória
                  </p>
                  <p className="font-bold mt-1 text-lg text-purple-600">
                    {selectedAtend?.frequenciaRespiratoria}{" "}
                    <span className="text-xs">irpm</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Thermometer className="w-3 h-3" /> Temperatura
                  </p>
                  <p
                    className={cn(
                      "font-bold mt-1 text-lg",
                      getClassificarTemp(selectedAtend?.temperatura || 0).cor,
                    )}
                  >
                    {selectedAtend?.temperatura}°C
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {getClassificarTemp(selectedAtend?.temperatura || 0).label}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Wind className="w-3 h-3" /> SatO2
                  </p>
                  <p
                    className={cn(
                      "font-bold mt-1 text-lg",
                      getClassificarSatO2(selectedAtend?.saturacaoO2 || 0).cor,
                    )}
                  >
                    {selectedAtend?.saturacaoO2}%
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {getClassificarSatO2(selectedAtend?.saturacaoO2 || 0).label}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Glicemia</p>
                  <p
                    className={cn(
                      "font-bold mt-1 text-lg",
                      getClassificarGlicemia(selectedAtend?.glicemia || 0).cor,
                    )}
                  >
                    {selectedAtend?.glicemia}{" "}
                    <span className="text-xs">mg/dL</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {getClassificarGlicemia(selectedAtend?.glicemia || 0).label}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Dor (EVA)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg",
                        (selectedAtend?.dorEVA || 0) === 0
                          ? "bg-emerald-500"
                          : (selectedAtend?.dorEVA || 0) <= 3
                            ? "bg-yellow-500"
                            : (selectedAtend?.dorEVA || 0) <= 6
                              ? "bg-orange-500"
                              : "bg-red-500",
                      )}
                    >
                      {selectedAtend?.dorEVA}
                    </div>
                    <p className="text-xs text-slate-600">
                      {selectedAtend?.dorEVA === 0
                        ? "Sem dor"
                        : (selectedAtend?.dorEVA || 0) <= 3
                          ? "Leve"
                          : (selectedAtend?.dorEVA || 0) <= 6
                            ? "Moderada"
                            : "Intensa"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Peso</p>
                  <p className="font-bold mt-1 text-lg">
                    {selectedAtend?.peso} <span className="text-xs">kg</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">IMC</p>
                  <p className="font-bold mt-1 text-lg">
                    {selectedAtend?.peso && selectedAtend?.altura
                      ? (
                          selectedAtend.peso /
                          Math.pow(selectedAtend.altura / 100, 2)
                        ).toFixed(1)
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clinico" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">
                    Diagnóstico Principal
                  </p>
                  <p className="font-semibold mt-1 text-teal-700">
                    {selectedAtend?.diagnosticoPrincipal}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Alergias</p>
                  <p
                    className={cn(
                      "font-semibold mt-1",
                      selectedAtend?.alergias === "Nenhuma conhecida"
                        ? "text-emerald-700"
                        : "text-red-700",
                    )}
                  >
                    {selectedAtend?.alergias}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Motivo do Atendimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">
                  {selectedAtend?.motivoAtendimento}
                </p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Consciência</p>
                  <p className="font-semibold mt-1 text-sm">
                    {selectedAtend?.consciencia}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Hidratação</p>
                  <p className="font-semibold mt-1 text-sm">
                    {selectedAtend?.hidratacao}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Diurese</p>
                  <p className="font-semibold mt-1 text-sm">
                    {selectedAtend?.diurese}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Débito Drenos</p>
                  <p className="font-semibold mt-1 text-sm">
                    {selectedAtend?.debitoDrenos}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cuidados" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="w-4 h-4 text-purple-600" /> Medicações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-line">
                  {selectedAtend?.medicacoes}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Syringe className="w-4 h-4 text-teal-600" /> Procedimentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-line">
                  {selectedAtend?.procedimentos}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                  <Info className="w-4 h-4" /> Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-900 whitespace-pre-line">
                  {selectedAtend?.observacoes}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plano" className="space-y-4 mt-4">
            <Card className="border-2 border-teal-200 bg-teal-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <ClipboardList className="w-12 h-12 text-teal-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">
                      Plano de Cuidados de Enfermagem
                    </p>
                    <p className="text-sm text-slate-800 mt-2 whitespace-pre-line">
                      {selectedAtend?.planoCuidados}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Enfermeiro</p>
                  <p className="font-semibold mt-1">
                    {selectedAtend?.nomeEnfermeiro}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Turno</p>
                  <p className="font-semibold mt-1">{selectedAtend?.turno}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Data/Hora</p>
                  <p className="font-semibold mt-1">
                    {formatDate(selectedAtend?.dataAtendimento || "")}{" "}
                    {selectedAtend?.horaAtendimento}
                  </p>
                </CardContent>
              </Card>
            </div>
            {selectedAtend?.followUp && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-8 h-8 text-amber-600" />
                    <div>
                      <p className="text-xs text-amber-600 font-semibold">
                        Próxima Reavaliação
                      </p>
                      <p className="font-bold text-amber-900 mt-1">
                        {formatDate(selectedAtend.followUp)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="anexos" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">
                  Documentos Clínicos
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedAtend ? getAnexosCount(selectedAtend.idEnf) : 0}{" "}
                  anexos
                </p>
              </div>
              <Button
                onClick={() => setShowNovoAnexo(true)}
                className="gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
              >
                <Upload className="w-4 h-4" /> Adicionar
              </Button>
            </div>
            {selectedAtend &&
            anexos.filter((a) => a.idAtendimento === selectedAtend.idEnf)
              .length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                <Paperclip className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">Nenhum anexo</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedAtend &&
                  anexos
                    .filter((a) => a.idAtendimento === selectedAtend.idEnf)
                    .sort(
                      (a, b) =>
                        new Date(b.data).getTime() - new Date(a.data).getTime(),
                    )
                    .map((anexo) => {
                      const tipo = TIPOS_ANEXO_ENF[anexo.tipo];
                      const Icon = tipo.icon;
                      return (
                        <div
                          key={anexo.id}
                          className={cn(
                            "p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer",
                            tipo.corLight,
                          )}
                          onClick={() => {
                            setAnexoVisualizado(anexo);
                            setShowVisualizarAnexo(true);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0",
                                tipo.cor,
                              )}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-slate-900 truncate">
                                {anexo.nome}
                              </p>
                              <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                                {anexo.descricao}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                <span>{formatDate(anexo.data)}</span>
                                <span>•</span>
                                <span>{anexo.formato}</span>
                                <span>•</span>
                                <span>{anexo.tamanho}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="evolucao" className="space-y-4 mt-4">
            <Card className="border-2 border-teal-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-600" /> Evolução
                  Temporal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-2" />
                    <div className="flex-1 pb-3 border-l-2 border-teal-200 pl-4">
                      <p className="text-xs text-slate-500">
                        {selectedAtend?.horaAtendimento} - Admissão
                      </p>
                      <p className="text-sm text-slate-700 mt-1">
                        {selectedAtend?.motivoAtendimento}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div className="flex-1 pb-3 border-l-2 border-blue-200 pl-4">
                      <p className="text-xs text-slate-500">
                        Sinais Vitais Iniciais
                      </p>
                      <p className="text-sm text-slate-700 mt-1">
                        PA: {selectedAtend?.pressaoArterial} | FC:{" "}
                        {selectedAtend?.frequenciaCardiaca} | T:{" "}
                        {selectedAtend?.temperatura}°C | SatO2:{" "}
                        {selectedAtend?.saturacaoO2}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-2" />
                    <div className="flex-1 pb-3 border-l-2 border-purple-200 pl-4">
                      <p className="text-xs text-slate-500">Intervenções</p>
                      <p className="text-sm text-slate-700 mt-1">
                        {selectedAtend?.procedimentos}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
                    <div className="pl-4">
                      <p className="text-xs text-slate-500">
                        Observações Atuais
                      </p>
                      <p className="text-sm text-slate-700 mt-1">
                        {selectedAtend?.observacoes}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 sticky bottom-0 bg-white pt-4 border-t">
          <Button variant="outline" onClick={() => setShowDetalhes(false)}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowDetalhes(false);
              setShowAnexos(true);
            }}
          >
            <Paperclip className="w-4 h-4 mr-2" /> Gerir Anexos
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowDetalhes(false);
              setShowEditar(true);
            }}
          >
            <Edit3 className="w-4 h-4 mr-2" /> Editar
          </Button>
          <Button
            onClick={handleImprimir}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
          >
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

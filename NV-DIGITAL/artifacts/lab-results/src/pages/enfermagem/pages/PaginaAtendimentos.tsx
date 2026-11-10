import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Bed,
  Edit3,
  Eye,
  Paperclip,
  Search,
  Trash2,
  Wind,
} from "lucide-react";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function PaginaAtendimentos() {
  const {
    setShowDetalhes,
    setShowEditar,
    setShowConfirmarExclusao,
    setShowAnexos,
    setSelectedAtend,
    setAtendParaExcluir,
    atendimentos,
    anexos,
    searchTerm,
    setSearchTerm,
    filterRisco,
    setFilterRisco,
    filterTurno,
    setFilterTurno,
    atendimentosFiltrados,
    getAnexosCount,
    getRiscoBadge,
    getClassificarPA,
    getClassificarSatO2,
    getClassificarTemp,
  } = useEnfermagemContext();
  return (
    <TabsContent value="atendimentos" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm font-medium">
                  Total Atendimentos
                </p>
                <p className="text-3xl font-bold mt-2">{atendimentos.length}</p>
                <p className="text-xs text-teal-100 mt-1">Turno atual</p>
              </div>
              <Bed className="w-10 h-10 text-teal-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">
                  Alto Risco / Emergência
                </p>
                <p className="text-3xl font-bold mt-2">
                  {
                    atendimentos.filter(
                      (a) => a.risco === "alto" || a.risco === "emergencia",
                    ).length
                  }
                </p>
                <p className="text-xs text-red-100 mt-1">requerem atenção</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">
                  SatO2 Crítica
                </p>
                <p className="text-3xl font-bold mt-2">
                  {atendimentos.filter((a) => a.saturacaoO2 < 94).length}
                </p>
                <p className="text-xs text-amber-100 mt-1">pacientes</p>
              </div>
              <Wind className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">
                  Anexos Clínicos
                </p>
                <p className="text-3xl font-bold mt-2">{anexos.length}</p>
                <p className="text-xs text-purple-100 mt-1">documentos</p>
              </div>
              <Paperclip className="w-10 h-10 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Pesquisar por paciente, diagnóstico ou quarto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRisco} onValueChange={setFilterRisco}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Nível de Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os riscos</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="moderado">Moderado</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="emergencia">Emergência</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTurno} onValueChange={setFilterTurno}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os turnos</SelectItem>
                <SelectItem value="Manhã">Manhã</SelectItem>
                <SelectItem value="Tarde">Tarde</SelectItem>
                <SelectItem value="Noite">Noite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Q/L</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead>Sinais Vitais</TableHead>
                <TableHead>Dor</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Enfermeiro</TableHead>
                <TableHead>Anexos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atendimentosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-12 h-12 text-slate-300" />
                      <p className="text-slate-500">
                        Nenhum atendimento encontrado
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                atendimentosFiltrados.map((atend) => {
                  const pa = getClassificarPA(atend.pressaoArterial);
                  const sat = getClassificarSatO2(atend.saturacaoO2);
                  const temp = getClassificarTemp(atend.temperatura);
                  const countAnexos = getAnexosCount(atend.idEnf);
                  return (
                    <TableRow key={atend.idEnf} className="hover:bg-teal-50/50">
                      <TableCell>
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
                            <p className="font-medium text-slate-900">
                              {atend.nomePaciente}
                            </p>
                            <p className="text-xs text-slate-500">
                              {atend.idade}a • {atend.sexo}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          Q{atend.quarto}-{atend.leito}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p
                          className="truncate text-sm"
                          title={atend.diagnosticoPrincipal}
                        >
                          {atend.diagnosticoPrincipal}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className={cn("font-mono", pa.cor)}>
                            PA: {atend.pressaoArterial}{" "}
                            <span className="text-[10px]">({pa.label})</span>
                          </span>
                          <span className="font-mono">
                            FC: {atend.frequenciaCardiaca} bpm
                          </span>
                          <span className={cn("font-mono", temp.cor)}>
                            T: {atend.temperatura}°C
                          </span>
                          <span className={cn("font-mono", sat.cor)}>
                            SatO2: {atend.saturacaoO2}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                              atend.dorEVA === 0
                                ? "bg-emerald-500"
                                : atend.dorEVA <= 3
                                  ? "bg-yellow-500"
                                  : atend.dorEVA <= 6
                                    ? "bg-orange-500"
                                    : "bg-red-500",
                            )}
                          >
                            {atend.dorEVA}
                          </div>
                          <span className="text-xs text-slate-500">EVA</span>
                        </div>
                      </TableCell>
                      <TableCell>{getRiscoBadge(atend.risco)}</TableCell>
                      <TableCell className="text-sm">
                        {atend.nomeEnfermeiro}
                      </TableCell>
                      <TableCell>
                        {countAnexos > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-teal-700 hover:bg-teal-50"
                            onClick={() => {
                              setSelectedAtend(atend);
                              setShowAnexos(true);
                            }}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {countAnexos}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedAtend(atend);
                              setShowDetalhes(true);
                            }}
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedAtend(atend);
                              setShowAnexos(true);
                            }}
                            title="Anexos"
                          >
                            <Paperclip className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedAtend({ ...atend });
                              setShowEditar(true);
                            }}
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAtendParaExcluir(atend);
                              setShowConfirmarExclusao(true);
                            }}
                            title="Excluir"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

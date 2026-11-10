import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Edit3,
  FileText,
  Flame,
  HeartPulse,
  Info,
  Paperclip,
  Save,
  Scale,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  AnexoEnf,
  AtendEnfermagem,
  TAMANHO_MAX_MB,
  TIPOS_ANEXO_ENF,
  todayLocal,
} from "../shared";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogNovoAtendimento() {
  const {
    showNovoAtendimento,
    setShowNovoAtendimento,
    dragOverNovo,
    setDragOverNovo,
    fileInputNovoRef,
    anexosNovoAtend,
    setAnexosNovoAtend,
    anexoTempEditando,
    setAnexoTempEditando,
    formNovo,
    setFormNovo,
    handleFilesNovoAtend,
    handleDropNovoAtend,
    removerAnexoTemp,
    atualizarAnexoTemp,
    handleNovoAtendimento,
    resetFormNovo,
  } = useEnfermagemContext();
  return (
    <Dialog
      open={showNovoAtendimento}
      onOpenChange={(open) => {
        setShowNovoAtendimento(open);
        if (!open) resetFormNovo();
      }}
    >
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-teal-600" />
            Novo Atendimento de Enfermagem
          </DialogTitle>
          <DialogDescription>
            Registo completo com importação de documentos clínicos
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="dados" className="gap-1.5 text-xs sm:text-sm">
              <User className="w-3.5 h-3.5" /> Dados
            </TabsTrigger>
            <TabsTrigger value="sinais" className="gap-1.5 text-xs sm:text-sm">
              <HeartPulse className="w-3.5 h-3.5" /> Sinais Vitais
            </TabsTrigger>
            <TabsTrigger
              value="cuidados"
              className="gap-1.5 text-xs sm:text-sm"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Cuidados
            </TabsTrigger>
            <TabsTrigger value="plano" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="w-3.5 h-3.5" /> Plano
            </TabsTrigger>
            <TabsTrigger
              value="anexos"
              className="gap-1.5 text-xs sm:text-sm relative"
            >
              <Paperclip className="w-3.5 h-3.5" /> Anexos
              {anexosNovoAtend.length > 0 && (
                <Badge className="bg-teal-500 text-white ml-1 px-1.5 py-0 text-[10px]">
                  {anexosNovoAtend.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 mt-4">
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4">
              <h3 className="font-semibold text-teal-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Identificação do Paciente
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Nome Completo *</Label>
                  <Input
                    value={formNovo.nomePaciente || ""}
                    onChange={(e) =>
                      setFormNovo({ ...formNovo, nomePaciente: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contacto</Label>
                  <Input
                    value={formNovo.contacto || ""}
                    onChange={(e) =>
                      setFormNovo({ ...formNovo, contacto: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Nascimento</Label>
                  <Input
                    type="date"
                    value={formNovo.dataNascimento || ""}
                    onChange={(e) => {
                      const birth = new Date(e.target.value);
                      const current = new Date();
                      let age = current.getFullYear() - birth.getFullYear();
                      if (
                        current.getMonth() < birth.getMonth() ||
                        (current.getMonth() === birth.getMonth() &&
                          current.getDate() < birth.getDate())
                      )
                        age--;
                      age = Math.max(0, age);
                      setFormNovo({
                        ...formNovo,
                        dataNascimento: e.target.value,
                        idade: age,
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Idade</Label>
                  <Input
                    type="number"
                    value={formNovo.idade || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        idade: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sexo</Label>
                  <Select
                    value={formNovo.sexo}
                    onValueChange={(v) => setFormNovo({ ...formNovo, sexo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quarto</Label>
                  <Input
                    value={formNovo.quarto || ""}
                    onChange={(e) =>
                      setFormNovo({ ...formNovo, quarto: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Leito</Label>
                  <Input
                    value={formNovo.leito || ""}
                    onChange={(e) =>
                      setFormNovo({ ...formNovo, leito: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Diagnóstico Principal *</Label>
              <Input
                value={formNovo.diagnosticoPrincipal || ""}
                onChange={(e) =>
                  setFormNovo({
                    ...formNovo,
                    diagnosticoPrincipal: e.target.value,
                  })
                }
                placeholder="Ex: Pneumonia adquirida na comunidade"
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo do Atendimento *</Label>
              <Textarea
                value={formNovo.motivoAtendimento || ""}
                onChange={(e) =>
                  setFormNovo({
                    ...formNovo,
                    motivoAtendimento: e.target.value,
                  })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Alergias</Label>
                <Input
                  value={formNovo.alergias || ""}
                  onChange={(e) =>
                    setFormNovo({ ...formNovo, alergias: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nível de Risco</Label>
                <Select
                  value={formNovo.risco}
                  onValueChange={(v) =>
                    setFormNovo({
                      ...formNovo,
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formNovo.dataAtendimento || todayLocal()}
                  onChange={(e) =>
                    setFormNovo({
                      ...formNovo,
                      dataAtendimento: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={formNovo.horaAtendimento || ""}
                  onChange={(e) =>
                    setFormNovo({
                      ...formNovo,
                      horaAtendimento: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select
                  value={formNovo.turno}
                  onValueChange={(v) => setFormNovo({ ...formNovo, turno: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manhã">Manhã</SelectItem>
                    <SelectItem value="Tarde">Tarde</SelectItem>
                    <SelectItem value="Noite">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sinais" className="space-y-4 mt-4">
            <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                <HeartPulse className="w-4 h-4" /> Sinais Vitais
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Pressão Arterial</Label>
                  <Input
                    value={formNovo.pressaoArterial || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        pressaoArterial: e.target.value,
                      })
                    }
                    placeholder="Ex: 120/80"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">FC (bpm)</Label>
                  <Input
                    type="number"
                    value={formNovo.frequenciaCardiaca || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        frequenciaCardiaca: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">FR (irpm)</Label>
                  <Input
                    type="number"
                    value={formNovo.frequenciaRespiratoria || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        frequenciaRespiratoria: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Temperatura (°C)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formNovo.temperatura || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        temperatura: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SatO2 (%)</Label>
                  <Input
                    type="number"
                    value={formNovo.saturacaoO2 || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        saturacaoO2: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4" /> Dor e Glicemia
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">EVA - Escala da Dor (0-10)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="range"
                      min="0"
                      max="10"
                      value={formNovo.dorEVA || 0}
                      onChange={(e) =>
                        setFormNovo({
                          ...formNovo,
                          dorEVA: parseInt(e.target.value),
                        })
                      }
                      className="flex-1"
                    />
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg",
                        (formNovo.dorEVA || 0) === 0
                          ? "bg-emerald-500"
                          : (formNovo.dorEVA || 0) <= 3
                            ? "bg-yellow-500"
                            : (formNovo.dorEVA || 0) <= 6
                              ? "bg-orange-500"
                              : "bg-red-500",
                      )}
                    >
                      {formNovo.dorEVA || 0}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {(formNovo.dorEVA || 0) === 0
                      ? "Sem dor"
                      : (formNovo.dorEVA || 0) <= 3
                        ? "Dor leve"
                        : (formNovo.dorEVA || 0) <= 6
                          ? "Dor moderada"
                          : "Dor intensa"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Glicemia Capilar (mg/dL)</Label>
                  <Input
                    type="number"
                    value={formNovo.glicemia || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        glicemia: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Scale className="w-4 h-4" /> Dados Antropométricos
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formNovo.peso || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        peso: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Altura (cm)</Label>
                  <Input
                    type="number"
                    value={formNovo.altura || ""}
                    onChange={(e) =>
                      setFormNovo({
                        ...formNovo,
                        altura: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              {formNovo.peso && formNovo.altura && (
                <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                  <p className="text-xs text-blue-700">
                    <strong>IMC:</strong>{" "}
                    {(
                      formNovo.peso / Math.pow(formNovo.altura / 100, 2)
                    ).toFixed(1)}{" "}
                    kg/m²{" "}
                    {formNovo.peso / Math.pow(formNovo.altura / 100, 2) < 18.5
                      ? "(Baixo peso)"
                      : formNovo.peso / Math.pow(formNovo.altura / 100, 2) < 25
                        ? "(Normal)"
                        : formNovo.peso / Math.pow(formNovo.altura / 100, 2) <
                            30
                          ? "(Excesso peso)"
                          : "(Obesidade)"}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cuidados" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Estado de Consciência</Label>
                <Select
                  value={formNovo.consciencia}
                  onValueChange={(v) =>
                    setFormNovo({ ...formNovo, consciencia: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alerta e orientado">
                      Alerta e orientado
                    </SelectItem>
                    <SelectItem value="Alerta">Alerta</SelectItem>
                    <SelectItem value="Confuso">Confuso</SelectItem>
                    <SelectItem value="Sonolento">Sonolento</SelectItem>
                    <SelectItem value="Comatoso">Comatoso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hidratação</Label>
                <Select
                  value={formNovo.hidratacao}
                  onValueChange={(v) =>
                    setFormNovo({ ...formNovo, hidratacao: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Adequada">Adequada</SelectItem>
                    <SelectItem value="Desidratação leve">
                      Desidratação leve
                    </SelectItem>
                    <SelectItem value="Desidratação moderada">
                      Desidratação moderada
                    </SelectItem>
                    <SelectItem value="Sobrecarga hídrica">
                      Sobrecarga hídrica
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Diurese</Label>
                <Input
                  value={formNovo.diurese || ""}
                  onChange={(e) =>
                    setFormNovo({ ...formNovo, diurese: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Débito de Drenos</Label>
                <Input
                  value={formNovo.debitoDrenos || ""}
                  onChange={(e) =>
                    setFormNovo({ ...formNovo, debitoDrenos: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Medicações Administradas</Label>
              <Textarea
                value={formNovo.medicacoes || ""}
                onChange={(e) =>
                  setFormNovo({ ...formNovo, medicacoes: e.target.value })
                }
                rows={3}
                placeholder="Listar medicações, doses e horários..."
              />
            </div>
            <div className="space-y-2">
              <Label>Procedimentos Realizados</Label>
              <Textarea
                value={formNovo.procedimentos || ""}
                onChange={(e) =>
                  setFormNovo({ ...formNovo, procedimentos: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações de Enfermagem</Label>
              <Textarea
                value={formNovo.observacoes || ""}
                onChange={(e) =>
                  setFormNovo({ ...formNovo, observacoes: e.target.value })
                }
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="plano" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Plano de Cuidados</Label>
              <Textarea
                value={formNovo.planoCuidados || ""}
                onChange={(e) =>
                  setFormNovo({ ...formNovo, planoCuidados: e.target.value })
                }
                rows={5}
                placeholder="Descrever o plano de cuidados de enfermagem..."
              />
            </div>
            <div className="space-y-2">
              <Label>Follow-up (data de reavaliação)</Label>
              <Input
                type="date"
                value={formNovo.followUp || ""}
                onChange={(e) =>
                  setFormNovo({ ...formNovo, followUp: e.target.value })
                }
              />
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-teal-900 text-sm">
                    Plano de Cuidados - Exemplo
                  </p>
                  <ul className="text-xs text-teal-700 mt-1 space-y-1 list-disc list-inside">
                    <li>Vigilância de sinais vitais de 4/4h</li>
                    <li>Controlo glicémico pré-prandial</li>
                    <li>Mudança de decúbito de 2/2h</li>
                    <li>Administração de terapêutica prescrita</li>
                    <li>Incentivo à deambulação precoce</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="anexos" className="space-y-4 mt-4">
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-teal-500 rounded-lg">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-teal-900">
                    Importar Documentos Clínicos
                  </h3>
                  <p className="text-xs text-teal-700 mt-1">
                    Anexe prescrições, evoluções, exames ou imagens. Os
                    documentos serão associados ao guardar.
                  </p>
                </div>
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverNovo(true);
              }}
              onDragLeave={() => setDragOverNovo(false)}
              onDrop={handleDropNovoAtend}
              onClick={() => fileInputNovoRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                dragOverNovo
                  ? "border-teal-500 bg-teal-50 scale-[1.01]"
                  : "border-slate-300 hover:border-teal-400 hover:bg-teal-50/30",
              )}
            >
              <input
                ref={fileInputNovoRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  handleFilesNovoAtend(e.target.files);
                  e.target.value = "";
                }}
              />
              <div
                className={cn(
                  "w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center transition-all",
                  dragOverNovo
                    ? "bg-teal-500 text-white scale-110"
                    : "bg-teal-100 text-teal-600",
                )}
              >
                <Upload className="w-8 h-8" />
              </div>
              <p className="font-semibold text-slate-700">
                {dragOverNovo
                  ? "Solte os ficheiros aqui!"
                  : "Arraste ficheiros ou clique para selecionar"}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                PDF, JPG, PNG, DOC, XLS até {TAMANHO_MAX_MB}MB
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {Object.entries(TIPOS_ANEXO_ENF).map(([key, tipo]) => {
                const Icon = tipo.icon;
                return (
                  <Button
                    key={key}
                    variant="outline"
                    className="gap-2 justify-start"
                    onClick={() => fileInputNovoRef.current?.click()}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{tipo.label}</span>
                  </Button>
                );
              })}
            </div>

            {anexosNovoAtend.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-teal-600" />
                    Documentos Adicionados
                    <Badge className="bg-teal-500 text-white">
                      {anexosNovoAtend.length}
                    </Badge>
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      if (confirm("Remover todos os anexos?"))
                        setAnexosNovoAtend([]);
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Limpar
                  </Button>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {anexosNovoAtend.map((anexo) => {
                    const tipo = TIPOS_ANEXO_ENF[anexo.tipo];
                    const Icon = tipo.icon;
                    const isEditing = anexoTempEditando === anexo.id;
                    const isImage = [
                      "JPG",
                      "JPEG",
                      "PNG",
                      "GIF",
                      "WEBP",
                    ].includes(anexo.formato);
                    return (
                      <div
                        key={anexo.id}
                        className={cn(
                          "rounded-xl border-2 transition-all",
                          isEditing
                            ? "border-teal-400 bg-teal-50/30 shadow-md"
                            : tipo.corLight,
                        )}
                      >
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {isImage && anexo.previewUrl ? (
                                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-white shadow-sm bg-white">
                                  <img
                                    src={anexo.previewUrl}
                                    alt={anexo.nome}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    "w-16 h-16 rounded-lg flex flex-col items-center justify-center text-white",
                                    tipo.cor,
                                  )}
                                >
                                  <Icon className="w-6 h-6" />
                                  <span className="text-[10px] font-bold mt-0.5">
                                    {anexo.formato}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="min-w-0 flex-1">
                                  <input
                                    type="text"
                                    value={anexo.nome}
                                    onChange={(e) =>
                                      atualizarAnexoTemp(anexo.id, {
                                        nome: e.target.value,
                                      })
                                    }
                                    className="font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none w-full text-sm"
                                  />
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      {tipo.label}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      {anexo.formato}
                                    </Badge>
                                    <span className="text-[10px] text-slate-500">
                                      {anexo.tamanho}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      setAnexoTempEditando(
                                        isEditing ? null : anexo.id,
                                      )
                                    }
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => removerAnexoTemp(anexo.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {isEditing && (
                                <div className="mt-3 space-y-3 pt-3 border-t border-slate-200/60">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">
                                      Tipo de Documento
                                    </Label>
                                    <div className="grid grid-cols-6 gap-1.5">
                                      {Object.entries(TIPOS_ANEXO_ENF).map(
                                        ([key, t]) => {
                                          const I = t.icon;
                                          const selected = anexo.tipo === key;
                                          return (
                                            <button
                                              key={key}
                                              type="button"
                                              onClick={() =>
                                                atualizarAnexoTemp(anexo.id, {
                                                  tipo: key as AnexoEnf["tipo"],
                                                })
                                              }
                                              className={cn(
                                                "p-2 rounded-lg border-2 transition-all text-center",
                                                selected
                                                  ? "border-teal-500 bg-teal-50"
                                                  : "border-slate-200 hover:border-teal-300",
                                              )}
                                            >
                                              <div
                                                className={cn(
                                                  "w-6 h-6 rounded flex items-center justify-center text-white mx-auto mb-0.5",
                                                  t.cor,
                                                )}
                                              >
                                                <I className="w-3 h-3" />
                                              </div>
                                              <p className="text-[9px] font-medium text-slate-700">
                                                {t.label}
                                              </p>
                                            </button>
                                          );
                                        },
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Data</Label>
                                      <Input
                                        type="date"
                                        value={anexo.data}
                                        onChange={(e) =>
                                          atualizarAnexoTemp(anexo.id, {
                                            data: e.target.value,
                                          })
                                        }
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">
                                        Instituição
                                      </Label>
                                      <Input
                                        value={anexo.instituicao}
                                        onChange={(e) =>
                                          atualizarAnexoTemp(anexo.id, {
                                            instituicao: e.target.value,
                                          })
                                        }
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">
                                      Profissional
                                    </Label>
                                    <Input
                                      value={anexo.profissional}
                                      onChange={(e) =>
                                        atualizarAnexoTemp(anexo.id, {
                                          profissional: e.target.value,
                                        })
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Descrição</Label>
                                    <Textarea
                                      value={anexo.descricao}
                                      onChange={(e) =>
                                        atualizarAnexoTemp(anexo.id, {
                                          descricao: e.target.value,
                                        })
                                      }
                                      rows={2}
                                      className="text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">
                                      Observações
                                    </Label>
                                    <Textarea
                                      value={anexo.observacoes}
                                      onChange={(e) =>
                                        atualizarAnexoTemp(anexo.id, {
                                          observacoes: e.target.value,
                                        })
                                      }
                                      rows={2}
                                      className="text-xs"
                                    />
                                  </div>
                                </div>
                              )}
                              {!isEditing &&
                                (anexo.descricao || anexo.instituicao) && (
                                  <div className="mt-2 space-y-1">
                                    {anexo.descricao && (
                                      <p className="text-xs text-slate-600 line-clamp-1">
                                        {anexo.descricao}
                                      </p>
                                    )}
                                    {anexo.instituicao && (
                                      <p className="text-[10px] text-slate-500">
                                        {anexo.instituicao}
                                      </p>
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {anexosNovoAtend.length === 0 && (
              <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <Paperclip className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 font-medium">
                  Nenhum documento adicionado
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 sticky bottom-0 bg-white pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setShowNovoAtendimento(false);
              resetFormNovo();
            }}
          >
            Cancelar
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-500 mr-auto">
            {anexosNovoAtend.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5 text-teal-600" />
                {anexosNovoAtend.length} anexo(s)
              </span>
            )}
          </div>
          <Button
            onClick={handleNovoAtendimento}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
          >
            <Save className="w-4 h-4 mr-2" /> Guardar Atendimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

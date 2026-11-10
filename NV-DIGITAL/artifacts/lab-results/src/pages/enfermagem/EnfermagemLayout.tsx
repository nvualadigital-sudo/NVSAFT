import DocumentosPage from "./pages/DocumentosPage";
import Chegadas from "../recepcao/Chegadas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bed,
  Bell,
  Building2,
  CalendarDays,
  Calendar as CalendarIcon,
  CheckCircle2,
  ClipboardList,
  FileDown,
  HeartPulse,
  Info,
  Paperclip,
  Printer,
  UserPlus,
} from "lucide-react";
import { useEnfermagemContext } from "./EnfermagemContext";
import DialogAnexos from "./components/DialogAnexos";
import DialogCalendario from "./components/DialogCalendario";
import DialogConfirmarExclusao from "./components/DialogConfirmarExclusao";
import DialogConfirmarExclusaoAnexo from "./components/DialogConfirmarExclusaoAnexo";
import DialogDetalhes from "./components/DialogDetalhes";
import DialogEditar from "./components/DialogEditar";
import DialogNotificacoes from "./components/DialogNotificacoes";
import DialogNovoAnexo from "./components/DialogNovoAnexo";
import DialogNovoAtendimento from "./components/DialogNovoAtendimento";
import DialogVisualizarAnexo from "./components/DialogVisualizarAnexo";
import PaginaAnexos from "./pages/PaginaAnexos";
import PaginaAtendimentos from "./pages/PaginaAtendimentos";
import PaginaCalendario from "./pages/PaginaCalendario";
import PaginaEnfermaria from "./pages/PaginaEnfermaria";
import PaginaEstatisticas from "./pages/PaginaEstatisticas";
export default function EnfermagemLayout() {
  const {
    activeTab,
    setActiveTab,
    setShowNovoAtendimento,
    setShowNotificacoes,
    setShowCalendario,
    storageError,
    anexos,
    toast,
    notificacoesNaoLidas,
    navegarParaInternamento,
    handleExportarCSV,
    handleImprimir,
  } = useEnfermagemContext();
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50">
      {toast && (
        <div
          className={cn(
            "fixed top-20 right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right",
            toast.type === "success" && "bg-emerald-500 text-white",
            toast.type === "error" && "bg-red-500 text-white",
            toast.type === "info" && "bg-blue-500 text-white",
          )}
        >
          {toast.type === "success" && <CheckCircle2 className="w-5 h-5" />}
          {toast.type === "error" && <AlertTriangle className="w-5 h-5" />}
          {toast.type === "info" && <Info className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <div className="px-6 py-3 text-sm bg-amber-50 border-b border-amber-200">
        Registos confirmados no servidor da instituição. A triagem alimenta o
        atendimento clínico; prescrições e administração são conferidas no posto
        de enfermagem.
        {storageError && (
          <p role="alert" className="font-bold text-red-700">
            {storageError}
          </p>
        )}
      </div>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg">
                <HeartPulse className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Cuidados de Enfermagem
                </h1>
                <p className="text-sm text-slate-500">
                  Registo clínico, sinais vitais e plano de cuidados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNotificacoes(true)}
                  className="relative"
                >
                  <Bell className="w-4 h-4" />
                  {notificacoesNaoLidas > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {notificacoesNaoLidas}
                    </span>
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowCalendario(true)}
              >
                <CalendarDays className="w-4 h-4" />
                Calendário
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleImprimir}
              >
                <Printer className="w-4 h-4" />
                Imprimir página
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleExportarCSV}
              >
                <FileDown className="w-4 h-4" />
                Exportar CSV
              </Button>
              {/* BOTÃO PARA INTERNAMENTO */}
              <Button
                variant="outline"
                className="gap-2 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800"
                onClick={navegarParaInternamento}
              >
                <Building2 className="w-4 h-4" />
                Internamento
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                onClick={() => setShowNovoAtendimento(true)}
                className="gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
              >
                <UserPlus className="w-4 h-4" />
                Novo Atendimento
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Chegadas />
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
            <TabsTrigger value="documentos">Documentos de enfermagem</TabsTrigger>
            <TabsTrigger value="enfermaria">Gestão da enfermaria</TabsTrigger>
            <TabsTrigger value="atendimentos" className="gap-2">
              <Bed className="w-4 h-4" /> Atendimentos
            </TabsTrigger>
            <TabsTrigger value="estatisticas" className="gap-2">
              <BarChart3 className="w-4 h-4" /> Estatísticas
            </TabsTrigger>
            <TabsTrigger value="calendario" className="gap-2">
              <CalendarIcon className="w-4 h-4" /> Follow-ups
            </TabsTrigger>
            <TabsTrigger value="anexos" className="gap-2">
              <Paperclip className="w-4 h-4" /> Anexos
              <Badge className="bg-teal-500 text-white ml-1 px-1.5 py-0 text-xs">
                {anexos.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ATENDIMENTOS */}
          <DocumentosPage />
          <PaginaEnfermaria />
          <PaginaAtendimentos />

          {/* ESTATÍSTICAS */}
          <PaginaEstatisticas />

          {/* FOLLOW-UPS */}
          <PaginaCalendario />

          {/* ANEXOS */}
          <PaginaAnexos />
        </Tabs>
      </div>

      {/* ============ NOVO ATENDIMENTO ============ */}
      <DialogNovoAtendimento />

      {/* EDITAR */}
      <DialogEditar />

      {/* CONFIRMAR EXCLUSÃO */}
      <DialogConfirmarExclusao />

      {/* NOTIFICAÇÕES */}
      <DialogNotificacoes />

      {/* CALENDÁRIO */}
      <DialogCalendario />

      {/* ANEXOS DO ATENDIMENTO */}
      <DialogAnexos />

      {/* NOVO ANEXO */}
      <DialogNovoAnexo />

      {/* VISUALIZAR ANEXO */}
      <DialogVisualizarAnexo />

      {/* CONFIRMAR EXCLUSÃO ANEXO */}
      <DialogConfirmarExclusaoAnexo />

      {/* DETALHES DO ATENDIMENTO */}
      <DialogDetalhes />
    </div>
  );
}

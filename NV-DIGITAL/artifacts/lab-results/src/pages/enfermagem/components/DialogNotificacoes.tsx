import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Calendar as CalendarIcon,
  Check,
  Info,
} from "lucide-react";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function DialogNotificacoes() {
  const {
    showNotificacoes,
    setShowNotificacoes,
    notificacoes,
    notificacoesNaoLidas,
    formatDate,
    handleMarcarNotificacaoLida,
  } = useEnfermagemContext();
  return (
    <Dialog open={showNotificacoes} onOpenChange={setShowNotificacoes}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-600" /> Notificações
            {notificacoesNaoLidas > 0 && (
              <Badge className="bg-red-500 ml-2">{notificacoesNaoLidas}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-4 max-h-96 overflow-y-auto">
          {notificacoes.map((n) => (
            <div
              key={n.id}
              className={cn(
                "p-3 rounded-lg border transition-all",
                n.lida
                  ? "bg-slate-50 border-slate-200"
                  : "bg-white border-teal-200 shadow-sm",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      n.tipo === "urgente" && "bg-red-100 text-red-600",
                      n.tipo === "alerta" && "bg-amber-100 text-amber-600",
                      n.tipo === "followup" && "bg-blue-100 text-blue-600",
                      n.tipo === "info" && "bg-emerald-100 text-emerald-600",
                    )}
                  >
                    {n.tipo === "urgente" && (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    {n.tipo === "alerta" && <AlertCircle className="w-4 h-4" />}
                    {n.tipo === "followup" && (
                      <CalendarIcon className="w-4 h-4" />
                    )}
                    {n.tipo === "info" && <Info className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{n.titulo}</p>
                    <p className="text-xs text-slate-600 mt-1">{n.descricao}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(n.data)}
                    </p>
                  </div>
                </div>
                {!n.lida && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarcarNotificacaoLida(n.id)}
                    className="h-6 px-2"
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

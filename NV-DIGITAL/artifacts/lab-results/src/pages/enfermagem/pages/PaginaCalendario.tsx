import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  Bed,
  Bell,
  CalendarDays,
  Calendar as CalendarIcon,
  Info,
} from "lucide-react";
import { todayLocal } from "../shared";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function PaginaCalendario() {
  const { notificacoes, formatDate, getRiscoBadge, followUpsOrdenados } =
    useEnfermagemContext();
  return (
    <TabsContent value="calendario" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" /> Próximos
              Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {followUpsOrdenados.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CalendarIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p>Nenhum follow-up agendado</p>
                </div>
              ) : (
                followUpsOrdenados.map((atend) => {
                  const diasRestantes = Math.ceil(
                    (new Date(atend.followUp!).getTime() -
                      new Date(todayLocal()).getTime()) /
                      (1000 * 60 * 60 * 24),
                  );
                  const urgente =
                    diasRestantes <= 1 ||
                    atend.risco === "emergencia" ||
                    atend.risco === "alto";
                  return (
                    <div
                      key={atend.idEnf}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md",
                        urgente
                          ? "bg-red-50 border-red-200"
                          : "bg-white border-slate-200",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-lg flex items-center justify-center",
                            urgente
                              ? "bg-red-500 text-white"
                              : "bg-blue-100 text-blue-700",
                          )}
                        >
                          <Bed className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {atend.nomePaciente}
                          </p>
                          <p className="text-sm text-slate-500">
                            Q{atend.quarto}-{atend.leito} •{" "}
                            {atend.diagnosticoPrincipal}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getRiscoBadge(atend.risco)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          {formatDate(atend.followUp!)}
                        </p>
                        <Badge
                          className={cn(
                            "mt-1",
                            diasRestantes < 0
                              ? "bg-red-100 text-red-700"
                              : urgente
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700",
                          )}
                        >
                          {diasRestantes < 0
                            ? `${Math.abs(diasRestantes)} dias atrasado`
                            : diasRestantes === 0
                              ? "Hoje"
                              : `em ${diasRestantes} dias`}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-rose-600" /> Alertas Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notificacoes.slice(0, 4).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    n.tipo === "urgente" && "bg-red-50 border-red-200",
                    n.tipo === "alerta" && "bg-amber-50 border-amber-200",
                    n.tipo === "followup" && "bg-blue-50 border-blue-200",
                    n.tipo === "info" && "bg-emerald-50 border-emerald-200",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {n.tipo === "urgente" && (
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                    )}
                    {n.tipo === "alerta" && (
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                    )}
                    {n.tipo === "followup" && (
                      <CalendarIcon className="w-4 h-4 text-blue-600 mt-0.5" />
                    )}
                    {n.tipo === "info" && (
                      <Info className="w-4 h-4 text-emerald-600 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">{n.titulo}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {n.descricao}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}

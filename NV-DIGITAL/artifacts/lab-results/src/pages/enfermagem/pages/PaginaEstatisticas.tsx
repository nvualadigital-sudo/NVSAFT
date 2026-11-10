import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Activity,
  AlertCircle,
  Clock,
  Flame,
  HeartPulse,
  Paperclip,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useEnfermagemContext } from "../EnfermagemContext";

export default function PaginaEstatisticas() {
  const {
    atendimentos,
    anexos,
    dadosRisco,
    dadosTurno,
    dadosSinaisVitais,
    dadosDor,
    dadosAnexosTipo,
    CORES,
  } = useEnfermagemContext();
  return (
    <TabsContent value="estatisticas" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" /> Distribuição por
              Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={dadosRisco}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={(entry) => `${entry.name}: ${entry.value}`}
                >
                  {dadosRisco.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CORES[index % CORES.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-500" /> Atendimentos por Turno
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosTurno}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-pink-500" /> Sinais Vitais
              Comparativos
            </CardTitle>
            <CardDescription>FC, FR e SatO2 por paciente</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosSinaisVitais}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="FC" fill="#ec4899" radius={[4, 4, 0, 0]} />
                <Bar dataKey="FR" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="SatO2" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Intensidade da Dor
              (EVA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosDor} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={120}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#f97316" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-purple-500" /> Anexos por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={dadosAnexosTipo}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={(entry) => `${entry.name}: ${entry.value}`}
                >
                  {dadosAnexosTipo.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CORES[index % CORES.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" /> Resumo Clínico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs text-red-600 font-medium">
                  Febre (≥38.5°C)
                </p>
                <p className="text-2xl font-bold text-red-700 mt-1">
                  {atendimentos.filter((a) => a.temperatura >= 38.5).length}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 font-medium">
                  Hiperglicemia
                </p>
                <p className="text-2xl font-bold text-blue-700 mt-1">
                  {atendimentos.filter((a) => a.glicemia > 180).length}
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-xs text-amber-600 font-medium">
                  HTA (≥140/90)
                </p>
                <p className="text-2xl font-bold text-amber-700 mt-1">
                  {
                    atendimentos.filter((a) => {
                      const [s, d] = a.pressaoArterial.split("/").map(Number);
                      return s >= 140 || d >= 90;
                    }).length
                  }
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-xs text-emerald-600 font-medium">
                  Total Anexos
                </p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">
                  {anexos.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}

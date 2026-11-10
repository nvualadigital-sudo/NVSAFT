import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Bed,
  ClipboardList,
  Droplet,
  FileText,
  Flame,
  FlaskConical,
  HeartPulse,
  Paperclip,
  Scale,
  Shield,
  Syringe,
  Wind,
} from "lucide-react";

export default function PaginaModelo() {
  return (
    <TabsContent value="modelo" className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-600" /> Modelo de
            Registo de Enfermagem
          </CardTitle>
          <CardDescription>
            Estrutura completa para avaliação e plano de cuidados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: HeartPulse,
                title: "Sinais Vitais",
                desc: "PA, FC, FR, Temp, SatO2",
                cor: "bg-red-500",
              },
              {
                icon: Scale,
                title: "Antropometria",
                desc: "Peso, altura, IMC",
                cor: "bg-blue-500",
              },
              {
                icon: Flame,
                title: "Avaliação da Dor",
                desc: "Escala EVA 0-10",
                cor: "bg-orange-500",
              },
              {
                icon: Droplet,
                title: "Balanço Hídrico",
                desc: "Entradas e saídas",
                cor: "bg-cyan-500",
              },
              {
                icon: Syringe,
                title: "Medicação",
                desc: "Prescrição e administração",
                cor: "bg-purple-500",
              },
              {
                icon: Bed,
                title: "Posicionamento",
                desc: "Mudanças de decúbito",
                cor: "bg-emerald-500",
              },
              {
                icon: Shield,
                title: "Prevenção UP",
                desc: "Escala de Braden",
                cor: "bg-pink-500",
              },
              {
                icon: Wind,
                title: "Vias Aéreas",
                desc: "Patência e oxigenoterapia",
                cor: "bg-teal-500",
              },
              {
                icon: FlaskConical,
                title: "Colheitas",
                desc: "Amostras biológicas",
                cor: "bg-amber-500",
              },
              {
                icon: FileText,
                title: "Evolução",
                desc: "Registo de enfermagem",
                cor: "bg-indigo-500",
              },
              {
                icon: AlertCircle,
                title: "Risco Clínico",
                desc: "Classificação e vigilância",
                cor: "bg-rose-500",
              },
              {
                icon: Paperclip,
                title: "Anexos",
                desc: "Documentos e exames",
                cor: "bg-slate-500",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-all"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                    item.cor,
                  )}
                >
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

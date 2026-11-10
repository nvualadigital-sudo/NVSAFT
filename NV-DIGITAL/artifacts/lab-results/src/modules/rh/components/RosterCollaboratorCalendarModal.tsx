import { rosterShiftStyle } from "../utils/shiftVisual";
import "../rosterColors.css";
import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  X,
  Save,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Sun,
  Moon,
  BedDouble,
  User,
  ListOrdered,
  LayoutGrid,
  ChevronRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import {
  RosterNurseRow,
  ShiftCode,
  DepartmentRosterRules,
  RosterComplianceAlert,
} from "../types";
import {
  getDaysInMonth,
  getWeekdayAbbr,
  SHIFT_LEGEND,
  calculateNurseWeeklyBreakdown,
  evaluateNurseCompliance,
  getShiftHours,
  GLOBAL_DEFAULT_ROSTER_RULES,
} from "../data/officialRosterData";

interface RosterCollaboratorCalendarModalProps {
  isOpen: boolean;
  onClose: () => void | Promise<void>;
  nurse: RosterNurseRow | null;
  year: number;
  monthIndex: number;
  departmentName?: string;
  rules?: DepartmentRosterRules;
  onSaveNurseDays: (
    nurseId: string,
    updatedDays: { [day: number]: ShiftCode },
  ) => void | Promise<void>;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_FULL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const RosterCollaboratorCalendarModal: React.FC<
  RosterCollaboratorCalendarModalProps
> = (props) => {
  if (!props.isOpen || !props.nurse) return null;
  return <RosterEditor {...props} nurse={props.nurse} />;
};
const RosterEditor: React.FC<
  RosterCollaboratorCalendarModalProps & { nurse: RosterNurseRow }
> = ({
  isOpen,
  onClose,
  nurse,
  year,
  monthIndex,
  departmentName,
  rules = GLOBAL_DEFAULT_ROSTER_RULES,
  onSaveNurseDays,
}) => {
  const daysInM = getDaysInMonth(year, monthIndex);
  const isChief =
    (nurse.roleCategory || "").toLowerCase().includes("chefe") ||
    (nurse.jobTitle || "").toLowerCase().includes("chefe");

  // Estado local dos dias da escala do colaborador
  const [localDays, setLocalDays] = useState<{ [day: number]: ShiftCode }>({});
  // Visualização: lista dia a dia com botões em frente OU calendário em grade
  const [viewType, setViewType] = useState<"list" | "grid">("list");
  // Seleção de múltiplos dias para ações em lote
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  // Alerta de feedback
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Inicializar estado local quando o modal abre ou muda de enfermeiro
  useEffect(() => {
    if (nurse) {
      const initial: { [day: number]: ShiftCode } = {};
      for (let d = 1; d <= daysInM; d++) {
        initial[d] = nurse.days[d] || "F";
      }
      setLocalDays(initial);
      setSelectedDays([]);
    }
  }, [nurse, year, monthIndex, daysInM]);

  // Colaborador virtual com dias atuais para cálculos em tempo real
  const currentVirtualNurse = useMemo<RosterNurseRow>(() => {
    return {
      ...nurse,
      days: localDays,
    };
  }, [nurse, localDays]);

  // Carga horária total calculada em tempo real
  const totalHours = useMemo(() => {
    let sum = 0;
    for (let d = 1; d <= daysInM; d++) {
      sum += getShiftHours(localDays[d], isChief, rules);
    }
    return sum;
  }, [localDays, daysInM, isChief, rules]);

  // Decomposição semanal
  const weeklyBreakdown = useMemo(() => {
    return calculateNurseWeeklyBreakdown(
      currentVirtualNurse,
      year,
      monthIndex,
      rules.maxWeeklyHours,
      rules,
    );
  }, [currentVirtualNurse, year, monthIndex, rules.maxWeeklyHours, rules]);

  // Alertas de conformidade com regras configuradas
  const complianceAlerts = useMemo<RosterComplianceAlert[]>(() => {
    return evaluateNurseCompliance(
      currentVirtualNurse,
      year,
      monthIndex,
      rules,
    );
  }, [currentVirtualNurse, year, monthIndex, rules]);

  // Contagem de cada turno
  const shiftCounts = useMemo(() => {
    const counts: Record<string, number> = {
      M: 0,
      M2: 0,
      PM: 0,
      D: 0,
      F: 0,
      FE: 0,
      BM: 0,
      L: 0,
    };
    (Object.values(localDays) as ShiftCode[]).forEach((s) => {
      const code = String(s || "")
        .trim()
        .toUpperCase();
      if (counts[code] !== undefined) {
        counts[code]++;
      } else {
        counts[code] = (counts[code] || 0) + 1;
      }
    });
    return counts;
  }, [localDays]);

  // Alterar regime de um dia individual
  const handleSetDayShift = (day: number, shift: ShiftCode) => {
    setLocalDays((prev) => ({
      ...prev,
      [day]: shift,
    }));
  };

  // Alternar seleção de dia para preenchimento em lote
  const handleToggleSelectDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSelectAllDays = () => {
    if (selectedDays.length === daysInM) {
      setSelectedDays([]);
    } else {
      const all = Array.from({ length: daysInM }, (_, i) => i + 1);
      setSelectedDays(all);
    }
  };

  // Aplicar turno aos dias selecionados
  const handleApplyShiftToSelected = (shift: ShiftCode) => {
    if (selectedDays.length === 0) {
      showToast("Selecione primeiro um ou mais dias na tabela!");
      return;
    }
    setLocalDays((prev) => {
      const updated = { ...prev };
      selectedDays.forEach((d) => {
        updated[d] = shift;
      });
      return updated;
    });
    showToast(`Regime '${shift}' aplicado a ${selectedDays.length} dia(s)!`);
    setSelectedDays([]);
  };

  // Preenchimentos automáticos padrão (Templates)
  const handleApplyPattern24x72 = () => {
    if (!rules.allow24 || !rules.legalBasis) {
      showToast(
        "Padrão 24x72 exige enquadramento institucional documentado nas Regras.",
      );
      return;
    }
    // M2 -> D -> F -> F
    setLocalDays((prev) => {
      const updated = { ...prev };
      for (let d = 1; d <= daysInM; d++) {
        const mod = (d - 1) % 4;
        if (mod === 0) updated[d] = "M2";
        else if (mod === 1) updated[d] = "D";
        else updated[d] = "F";
      }
      return updated;
    });
    showToast("Padrão de Plantão 24x72 aplicado com sucesso!");
  };

  const handleApplyPatternDiarista = () => {
    // Seg a Sex = M, Sab = D, Dom = F
    setLocalDays((prev) => {
      const updated = { ...prev };
      for (let d = 1; d <= daysInM; d++) {
        const dayOfWeek = new Date(year, monthIndex, d).getDay(); // 0 Dom, 6 Sab
        if (dayOfWeek === 0) updated[d] = "F";
        else if (dayOfWeek === 6) updated[d] = "D";
        else updated[d] = "M";
      }
      return updated;
    });
    showToast("Padrão Diarista (Seg-Sex: Manhã, Sáb: D, Dom: F) aplicado!");
  };

  const handleApplyVacation = () => {
    if (selectedDays.length > 0) {
      handleApplyShiftToSelected("FE");
    } else {
      // Aplicar mês todo de férias se nada selecionado
      if (
        window.confirm(
          "Deseja marcar o mês inteiro como Férias (FE) para este colaborador?",
        )
      ) {
        setLocalDays((prev) => {
          const updated = { ...prev };
          for (let d = 1; d <= daysInM; d++) {
            updated[d] = "FE";
          }
          return updated;
        });
        showToast("Mês completo marcado como Férias (FE)!");
      }
    }
  };

  const handleResetToAllOff = () => {
    setLocalDays((prev) => {
      const updated = { ...prev };
      for (let d = 1; d <= daysInM; d++) {
        updated[d] = "F";
      }
      return updated;
    });
    showToast("Todos os dias redefinidos para Folga (F).");
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Salvar no estado global da escala
  const handleSaveAndClose = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSaveNurseDays(nurse.id, localDays);
      onClose();
    } catch (e: any) {
      showToast(e.message || "Não foi possível guardar no servidor.");
    } finally {
      setSaving(false);
    }
  };

  // Estilo oficial do turno
  const getBadgeStyle = (shift: ShiftCode | undefined) => {
    const s = (shift || "").trim().toUpperCase();
    if (s === "M2")
      return "bg-red-700 text-white font-black border-red-800 shadow-sm";
    if (s === "FE")
      return "bg-emerald-200 text-emerald-950 font-black border-emerald-400";
    if (s === "M") return "bg-sky-100 text-sky-900 font-bold border-sky-300";
    if (s === "PM")
      return "bg-indigo-100 text-indigo-950 font-bold border-indigo-300";
    if (s === "D")
      return "bg-amber-100 text-amber-950 font-bold border-amber-300";
    if (s === "BM")
      return "bg-orange-100 text-orange-950 font-bold border-orange-300";
    return "bg-slate-100 text-slate-800 font-semibold border-slate-300";
  };

  // Construção da matriz do calendário para a visualização em grade
  const calendarMatrix = useMemo(() => {
    const matrix: Array<Array<{ day: number | null; weekday: number }>> = [];
    const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); // 0 = Dom, 1 = Seg ...
    // Ajustar para que a semana comece na Segunda-feira (índice 0 = Segunda, 6 = Domingo)
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    let currentWeek: Array<{ day: number | null; weekday: number }> = [];
    // Dias vazios antes do dia 1
    for (let i = 0; i < startOffset; i++) {
      currentWeek.push({ day: null, weekday: i });
    }

    for (let d = 1; d <= daysInM; d++) {
      const weekday = (startOffset + d - 1) % 7;
      currentWeek.push({ day: d, weekday });

      if (currentWeek.length === 7 || d === daysInM) {
        // Preencher o final da última semana com dias nulos
        while (currentWeek.length < 7) {
          currentWeek.push({ day: null, weekday: currentWeek.length });
        }
        matrix.push(currentWeek);
        currentWeek = [];
      }
    }

    return matrix;
  }, [year, monthIndex, daysInM]);

  // Turnos padrão para seleção rápida em frente ao dia
  const quickShiftOptions: Array<{
    code: ShiftCode;
    label: string;
    bg: string;
    text: string;
  }> = [
    {
      code: "F",
      label: "Folga (F)",
      bg: "hover:bg-slate-700 text-slate-300",
      text: "0h",
    },
    {
      code: "D",
      label: "Descanso (D)",
      bg: "hover:bg-amber-950 text-amber-300",
      text: "0h",
    },
    {
      code: "M2",
      label: "Plantão 24h (M2)",
      bg: "hover:bg-red-950 text-red-300",
      text: "24h",
    },
    {
      code: "PM",
      label: "Tarde/Noite (PM)",
      bg: "hover:bg-indigo-950 text-indigo-300",
      text: `${rules.hours.PM}h`,
    },
    {
      code: "M",
      label: `Manhã ${getShiftHours("M", isChief, rules)}h (M)`,
      bg: "hover:bg-cyan-950 text-cyan-300",
      text: `${getShiftHours("M", isChief, rules)}h`,
    },
    {
      code: "FE",
      label: "Férias (FE)",
      bg: "hover:bg-emerald-950 text-emerald-300",
      text: "0h",
    },
    {
      code: "BM",
      label: "Baixa Médica (BM)",
      bg: "hover:bg-orange-950 text-orange-300",
      text: "0h",
    },
    { code: "L", label: "Licença (L)", bg: "", text: "0h" },
  ];

  return (
    <div className="nv-roster-editor fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* =======================================================================
            CABEÇALHO DO MODAL: DADOS DO COLABORADOR E RESUMO DE HORAS
           ======================================================================= */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-cyan-950/60">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">
                  {nurse.name}
                </h2>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    isChief
                      ? "bg-amber-950 text-amber-300 border-amber-800"
                      : "bg-cyan-950 text-cyan-300 border-cyan-800"
                  }`}
                >
                  {nurse.roleCategory}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {nurse.jobTitle || "Enfermeiro(a) do Quadro"}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>
                  {departmentName ||
                    nurse.department ||
                    "Direcção de Enfermagem"}
                </span>
                <span>•</span>
                <strong className="text-slate-300 font-bold">
                  {MONTH_NAMES[monthIndex]} de {year}
                </strong>
                <span>•</span>
                <span className="text-slate-400">{daysInM} dias no mês</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Total de Horas Mensal em Destaque */}
            <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-800/80 text-right">
              <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider block">
                Carga Mensal Total
              </span>
              <span className="text-lg font-black text-white font-mono">
                {totalHours}
                <span className="text-xs font-bold text-emerald-400 ml-0.5">
                  h
                </span>
              </span>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              title="Fechar sem salvar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOAST DE FEEDBACK */}
        {toastMsg && (
          <div className="bg-cyan-950 border-b border-cyan-800 text-cyan-200 px-4 py-2 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* PAINEL DE ALERTAS DE REGRAS HOSPITALARES (SE HOUVER) */}
        {complianceAlerts.length > 0 && (
          <div className="bg-amber-950/40 border-b border-amber-900/60 p-3 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span className="font-extrabold text-amber-300 block">
                Observações de Conformidade ({complianceAlerts.length}):
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {complianceAlerts.map((alt, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] text-amber-200/90 flex items-center gap-1"
                  >
                    <span>•</span> {alt.message}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            BARRA DE FERRAMENTAS: ALTERNAR VISÃO E PREENCHIMENTOS EM LOTE
           ======================================================================= */}
        <div className="p-3 sm:px-5 border-b border-slate-800 bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Seletor de Modo de Exibição */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
            <button
              onClick={() => setViewType("list")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewType === "list"
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Lista de Dias & Regime</span>
            </button>
            <button
              onClick={() => setViewType("grid")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewType === "grid"
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Calendário em Grade</span>
            </button>
          </div>

          {/* Botões de Ação Rápida / Preenchimento Inteligente */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden lg:inline">
              Ações Rápidas:
            </span>
            <button
              type="button"
              onClick={handleApplyPattern24x72}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-xl font-bold border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              title="Preencher ciclo rotativo 24x72 (M2 -> D -> F -> F)"
            >
              <Clock className="w-3 h-3 text-red-400" />
              <span>Plantão 24x72</span>
            </button>
            <button
              type="button"
              onClick={handleApplyPatternDiarista}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded-xl font-bold border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              title="Preencher diarista Segunda a Sexta: Manhã (M), Sábado: D, Domingo: F"
            >
              <Sun className="w-3 h-3 text-amber-400" />
              <span>Diarista (M)</span>
            </button>
            <button
              type="button"
              onClick={handleApplyVacation}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white rounded-xl font-bold border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              title="Marcar Férias (FE) para dias selecionados ou mês completo"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Férias (FE)</span>
            </button>
            <button
              type="button"
              onClick={handleResetToAllOff}
              className="px-2 py-1.5 bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 rounded-xl font-bold border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              title="Limpar todos os dias para Folga (F)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Zerar (F)</span>
            </button>
          </div>
        </div>

        {/* BARRA DE AÇÃO EM LOTE SE HOUVER DIAS SELECIONADOS */}
        {selectedDays.length > 0 && (
          <div className="bg-cyan-950/90 border-b border-cyan-800 p-2.5 px-4 text-xs flex items-center justify-between gap-3 flex-wrap animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white">
                {selectedDays.length} dia(s) selecionado(s):
              </span>
              <button
                onClick={() => setSelectedDays([])}
                className="text-[11px] text-cyan-400 underline hover:text-cyan-200 cursor-pointer"
              >
                Desmarcar todos
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-cyan-300 font-bold uppercase mr-1">
                Aplicar aos selecionados:
              </span>
              {["F", "D", "M2", "PM", "M", "FE", "BM", "L"].map((s) => (
                <button
                  key={s}
                  data-roster-shift={s}
                  style={rosterShiftStyle(s as ShiftCode)}
                  onClick={() => handleApplyShiftToSelected(s as ShiftCode)}
                  className={`px-2 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    s === "M2"
                      ? "bg-red-600 hover:bg-red-500 text-white"
                      : s === "FE"
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* =======================================================================
            CORPO DO MODAL: VISÃO 1 (LISTA COM SELETOR FRONTAL) OU VISÃO 2 (GRADE)
           ======================================================================= */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* VISUALIZAÇÃO 1: LISTA DIA A DIA COM SELETOR EM FRENTE */}
          {viewType === "list" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-bold">
                  Clique diretamente no turno desejado em frente a cada dia para
                  alterar:
                </span>
                <button
                  onClick={handleSelectAllDays}
                  className="text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                >
                  {selectedDays.length === daysInM
                    ? "Desmarcar todos"
                    : "Selecionar todos os dias"}
                </button>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 bg-slate-950">
                {Array.from({ length: daysInM }, (_, i) => i + 1).map((d) => {
                  const dateObj = new Date(year, monthIndex, d);
                  const dayOfWeekIdx = dateObj.getDay(); // 0 = Dom, 6 = Sab
                  const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;
                  const weekdayShort = getWeekdayAbbr(year, monthIndex, d);
                  const weekdayLong = WEEKDAY_FULL[dayOfWeekIdx];
                  const currentShift = localDays[d] || "F";
                  const hours = getShiftHours(currentShift, isChief, rules);
                  const isSelected = selectedDays.includes(d);

                  // Verificar se é o último dia de uma semana (Domingo ou fim do mês) para exibir subtotal semanal
                  const weekInfo = weeklyBreakdown.find((w) => w.endDay === d);

                  return (
                    <React.Fragment key={d}>
                      <div
                        className={`p-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                          isSelected
                            ? "bg-cyan-950/50"
                            : isWeekend
                              ? "bg-slate-900/60"
                              : "bg-slate-950 hover:bg-slate-900/40"
                        }`}
                      >
                        {/* Identificação do Dia */}
                        <div className="flex items-center gap-3 min-w-[190px]">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectDay(d)}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                            title="Selecionar este dia para ação em lote"
                          />

                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                                isWeekend
                                  ? "bg-slate-800 text-amber-300 border border-slate-700"
                                  : "bg-slate-800 text-white"
                              }`}
                            >
                              {d < 10 ? `0${d}` : d}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-white block">
                                Dia {d < 10 ? `0${d}` : d} • {weekdayShort}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {weekdayLong}
                              </span>
                            </div>
                          </div>

                          {/* Badge do Regime Atual */}
                          <div className="ml-auto sm:ml-2">
                            <span
                              data-roster-shift={currentShift}
                              style={rosterShiftStyle(currentShift)}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-black border inline-flex items-center gap-1 ${getBadgeStyle(
                                currentShift,
                              )}`}
                            >
                              <span>{currentShift}</span>
                              <span className="text-[9px] opacity-75 font-normal">
                                ({hours}h)
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* BOTÕES RÁPIDOS DE REGIME EM FRENTE AO DIA */}
                        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                          {quickShiftOptions.map((opt) => {
                            const isCurrent = currentShift === opt.code;
                            return (
                              <button
                                key={opt.code}
                                data-roster-shift={opt.code}
                                data-roster-selected={isCurrent}
                                aria-pressed={isCurrent}
                                style={rosterShiftStyle(opt.code)}
                                type="button"
                                onClick={() => handleSetDayShift(d, opt.code)}
                                className={`px-2 py-1 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                                  isCurrent
                                    ? opt.code === "M2"
                                      ? "bg-red-600 text-white border-red-500 shadow-md scale-105"
                                      : opt.code === "FE"
                                        ? "bg-emerald-600 text-white border-emerald-500 shadow-md scale-105"
                                        : opt.code === "M"
                                          ? "bg-sky-600 text-white border-sky-500 shadow-md scale-105"
                                          : opt.code === "PM"
                                            ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-105"
                                            : opt.code === "D"
                                              ? "bg-amber-600 text-white border-amber-500 shadow-md scale-105"
                                              : "bg-slate-700 text-white border-slate-600 shadow-md scale-105"
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                                }`}
                                title={`Definir Dia ${d} como ${opt.label}`}
                              >
                                <span>{opt.code}</span>
                                {isCurrent && (
                                  <span className="ml-1 text-[9px] opacity-90">
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* SUB-TOTAL DA SEMANA */}
                      {weekInfo && (
                        <div className="p-2.5 px-4 bg-slate-900/90 border-t border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
                          <span className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{weekInfo.label}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-[11px]">
                              Total semanal:
                            </span>
                            <span
                              className={`font-mono font-black text-sm px-2 py-0.5 rounded-lg border ${
                                weekInfo.exceedsLimit
                                  ? "bg-amber-950 text-amber-300 border-amber-800"
                                  : "bg-slate-800 text-emerald-400 border-slate-700"
                              }`}
                            >
                              {weekInfo.hours}h / {rules.maxWeeklyHours}h máx
                            </span>
                            {weekInfo.exceedsLimit && (
                              <span className="text-[10px] text-amber-400 font-bold hidden sm:inline">
                                ⚠️ Acima do teto semanal
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* VISUALIZAÇÃO 2: CALENDÁRIO EM GRADE MENSAL */}
          {viewType === "grid" && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Clique em qualquer dia do calendário para alternar ou
                  selecionar para preenchimento:
                </span>
                <span className="font-bold text-white">
                  {MONTH_NAMES[monthIndex]} de {year}
                </span>
              </div>

              {/* Cabeçalho dos Dias da Semana */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(
                  (w, idx) => (
                    <div
                      key={w}
                      className={`py-1.5 rounded-lg ${
                        idx >= 5
                          ? "bg-slate-950/60 text-amber-400/80"
                          : "bg-slate-950 text-slate-400"
                      }`}
                    >
                      {w}
                    </div>
                  ),
                )}
              </div>

              {/* Matriz das Semanas */}
              <div className="space-y-1.5">
                {calendarMatrix.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-cols-7 gap-1.5">
                    {week.map((cell, cIdx) => {
                      if (!cell.day) {
                        return (
                          <div
                            key={`empty-${cIdx}`}
                            className="h-20 sm:h-24 rounded-xl bg-slate-950/30 border border-slate-900"
                          />
                        );
                      }

                      const day = cell.day;
                      const isWeekend = cell.weekday >= 5;
                      const shift = localDays[day] || "F";
                      const hours = getShiftHours(shift, isChief, rules);
                      const isSelected = selectedDays.includes(day);

                      return (
                        <div
                          key={`day-${day}`}
                          onClick={() => handleToggleSelectDay(day)}
                          className={`h-20 sm:h-24 p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer group ${
                            isSelected
                              ? "bg-cyan-950 border-cyan-400 shadow-md ring-1 ring-cyan-400"
                              : isWeekend
                                ? "bg-slate-950/90 border-slate-800 hover:border-slate-700"
                                : "bg-slate-950 border-slate-800 hover:border-cyan-500/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-black ${
                                isWeekend ? "text-amber-400" : "text-slate-300"
                              }`}
                            >
                              {day < 10 ? `0${day}` : day}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {hours > 0 ? `${hours}h` : ""}
                            </span>
                          </div>

                          {/* Seletor rápido de turno ao centro do dia */}
                          <div className="my-auto text-center">
                            <span
                              data-roster-shift={shift}
                              style={rosterShiftStyle(shift)}
                              className={`px-2 py-0.5 rounded-md text-xs font-black border inline-block ${getBadgeStyle(
                                shift,
                              )}`}
                            >
                              {shift}
                            </span>
                          </div>

                          {/* Botões Rápidos ao Hover */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center gap-1 opacity-90 group-hover:opacity-100"
                          >
                            <select
                              data-roster-shift={shift}
                              style={rosterShiftStyle(shift)}
                              value={shift}
                              onChange={(e) =>
                                handleSetDayShift(
                                  day,
                                  e.target.value as ShiftCode,
                                )
                              }
                              className="bg-slate-900 border border-slate-700 text-white text-[10px] font-bold rounded px-1 py-0.5 focus:outline-none cursor-pointer w-full text-center"
                            >
                              <option
                                value="F"
                                data-roster-shift="F"
                                style={rosterShiftStyle("F")}
                              >
                                F (Folga)
                              </option>
                              <option
                                value="D"
                                data-roster-shift="D"
                                style={rosterShiftStyle("D")}
                              >
                                D (Descanso)
                              </option>
                              <option
                                value="M2"
                                data-roster-shift="M2"
                                style={rosterShiftStyle("M2")}
                              >
                                M2 (Plantão 24h)
                              </option>
                              <option
                                value="PM"
                                data-roster-shift="PM"
                                style={rosterShiftStyle("PM")}
                              >
                                PM (Tarde/Noite {rules.hours.PM}h)
                              </option>
                              <option
                                value="M"
                                data-roster-shift="M"
                                style={rosterShiftStyle("M")}
                              >
                                M (Manhã{" "}
                                {getShiftHours("M", isChief, rules) + "h"})
                              </option>
                              <option
                                value="FE"
                                data-roster-shift="FE"
                                style={rosterShiftStyle("FE")}
                              >
                                FE (Férias)
                              </option>
                              <option
                                value="BM"
                                data-roster-shift="BM"
                                style={rosterShiftStyle("BM")}
                              >
                                BM (Baixa Médica)
                              </option>
                              <option
                                value="L"
                                data-roster-shift="L"
                                style={rosterShiftStyle("L")}
                              >
                                L (Licença)
                              </option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =======================================================================
              RESUMO ESTATÍSTICO DE TURNOS NO MÊS
             ======================================================================= */}
          <div className="bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Distribuição de Turnos no Mês:
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-red-400 font-bold block">
                  Plantão M2 (24h)
                </span>
                <span className="text-base font-black text-white">
                  {shiftCounts["M2"] || 0}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {(shiftCounts["M2"] || 0) * 24}h
                </span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-sky-400 font-bold block">
                  Manhã (M)
                </span>
                <span className="text-base font-black text-white">
                  {shiftCounts["M"] || 0}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {(shiftCounts["M"] || 0) * getShiftHours("M", isChief, rules)}
                  h
                </span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-indigo-400 font-bold block">
                  Tarde/Noite (PM)
                </span>
                <span className="text-base font-black text-white">
                  {shiftCounts["PM"] || 0}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {(shiftCounts["PM"] || 0) * rules.hours.PM}h
                </span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-amber-400 font-bold block">
                  Descanso (D)
                </span>
                <span className="text-base font-black text-white">
                  {shiftCounts["D"] || 0}
                </span>
                <span className="text-[10px] text-slate-400 block">dias</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-300 font-bold block">
                  Folga (F)
                </span>
                <span className="text-base font-black text-white">
                  {shiftCounts["F"] || 0}
                </span>
                <span className="text-[10px] text-slate-400 block">dias</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-emerald-400 font-bold block">
                  Férias (FE)
                </span>
                <span className="text-base font-black text-white">
                  {shiftCounts["FE"] || 0}
                </span>
                <span className="text-[10px] text-slate-400 block">dias</span>
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            RODAPÉ DE AÇÃO: SALVAR E FECHAR
           ======================================================================= */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-400">
            <span>
              Alterações serão aplicadas diretamente à grelha oficial e aos
              relatórios.
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAndClose}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black shadow-lg shadow-cyan-950 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {saving
                  ? "A guardar no servidor…"
                  : "Guardar e aplicar à escala"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

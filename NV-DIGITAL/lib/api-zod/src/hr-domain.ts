export type ShiftCode = "M" | "M2" | "PM" | "D" | "F" | "FE" | "BM" | "L";
export interface RosterNurseRow {
  id: string;
  name: string;
  department?: string;
  roleCategory?: string;
  jobTitle?: string;
  days: Record<number, ShiftCode>;
}
export interface DepartmentRosterRules {
  maxWeeklyHours: number;
  maxConsecutiveDays: number;
  minRestHours: number;
  allow24: boolean;
  legalBasis: string;
  confirmed: boolean;
  hours: Record<ShiftCode, number>;
  chiefMorningHours: number;
}
export interface RosterComplianceAlert {
  message: string;
  severity: "warning" | "error";
}
export const SHIFT_LEGEND: Record<
  ShiftCode,
  { label: string; bg: string; fg: string }
> = {
  M: { label: "Manhã", bg: "#e0f2fe", fg: "#0c4a6e" },
  M2: { label: "Plantão 24h", bg: "#b91c1c", fg: "#ffffff" },
  PM: { label: "Tarde / noite", bg: "#e0e7ff", fg: "#1e1b4b" },
  D: { label: "Descanso", bg: "#fef3c7", fg: "#451a03" },
  F: { label: "Folga", bg: "#f1f5f9", fg: "#1e293b" },
  FE: { label: "Férias", bg: "#a7f3d0", fg: "#022c22" },
  BM: { label: "Baixa médica", bg: "#ffedd5", fg: "#431407" },
  L: { label: "Licença", bg: "#f1f5f9", fg: "#1e293b" },
};
export const GLOBAL_DEFAULT_ROSTER_RULES: DepartmentRosterRules = {
  maxWeeklyHours: 44,
  maxConsecutiveDays: 6,
  minRestHours: 12,
  allow24: false,
  legalBasis: "",
  confirmed: false,
  hours: { M: 7, M2: 24, PM: 5, D: 0, F: 0, FE: 0, BM: 0, L: 0 },
  chiefMorningHours: 8,
};
export const getDaysInMonth = (y: number, m: number) =>
  new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const getWeekdayAbbr = (y: number, m: number, d: number) =>
  ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
    new Date(Date.UTC(y, m, d)).getUTCDay()
  ];
export function getShiftHours(
  s: ShiftCode | undefined,
  chief = false,
  r = GLOBAL_DEFAULT_ROSTER_RULES,
) {
  return !s ? 0 : s === "M" && chief ? r.chiefMorningHours : r.hours[s] || 0;
}
export function calculateNurseWeeklyBreakdown(
  n: RosterNurseRow,
  y: number,
  m: number,
  max = 44,
  r = GLOBAL_DEFAULT_ROSTER_RULES,
) {
  const rows: {
    label: string;
    hours: number;
    endDay: number;
    exceedsLimit: boolean;
  }[] = [];
  let hours = 0,
    start = 1;
  const chief = /chefe/i.test((n.roleCategory || "") + (n.jobTitle || ""));
  for (let d = 1; d <= getDaysInMonth(y, m); d++) {
    hours += getShiftHours(n.days[d], chief, r);
    if (
      new Date(Date.UTC(y, m, d)).getUTCDay() === 0 ||
      d === getDaysInMonth(y, m)
    ) {
      rows.push({
        label: `Dias ${start}–${d}`,
        hours,
        endDay: d,
        exceedsLimit: hours > max,
      });
      hours = 0;
      start = d + 1;
    }
  }
  return rows;
}
export function evaluateNurseCompliance(
  n: RosterNurseRow,
  y: number,
  m: number,
  r = GLOBAL_DEFAULT_ROSTER_RULES,
): RosterComplianceAlert[] {
  const alerts: RosterComplianceAlert[] = [];
  if (!r.confirmed)
    alerts.push({
      message: "Horários e enquadramento institucional por confirmar.",
      severity: "warning",
    });
  if (Object.values(n.days).includes("M2") && (!r.allow24 || !r.legalBasis))
    alerts.push({
      message:
        "Plantão de 24h exige enquadramento específico documentado; padrão não autorizado por defeito.",
      severity: "error",
    });
  if (
    Object.values(n.days).some((c) => getShiftHours(c, false, r) > 8) &&
    !r.legalBasis
  )
    alerts.push({
      message:
        "Turnos superiores a 8h precisam de enquadramento específico documentado.",
      severity: "error",
    });
  for (const w of calculateNurseWeeklyBreakdown(n, y, m, r.maxWeeklyHours, r))
    if (w.exceedsLimit)
      alerts.push({
        message: `${w.label}: ${w.hours}h acima do limite configurado de ${r.maxWeeklyHours}h.`,
        severity: w.hours > 54 && !r.allow24 ? "error" : "warning",
      });
  let consecutive = 0;
  for (let d = 1; d <= getDaysInMonth(y, m); d++) {
    const h = getShiftHours(
      n.days[d],
      /chefe/i.test((n.roleCategory || "") + (n.jobTitle || "")),
      r,
    );
    consecutive = h ? consecutive + 1 : 0;
    if (consecutive === r.maxConsecutiveDays + 1)
      alerts.push({
        message: `Mais de ${r.maxConsecutiveDays} dias consecutivos até ao dia ${d}.`,
        severity: "warning",
      });
    if (h === 24 && getShiftHours(n.days[d + 1], false, r) > 0)
      alerts.push({
        message: `Descanso após o plantão do dia ${d} insuficiente no modelo diário.`,
        severity: "error",
      });
  }
  return alerts;
}
export const HR_RULE_VERSION = "AO-GrupoA-2026-config-v2";
export const IRT_2026 = [
  { up: 150000, base: 0, rate: 0, over: 0 },
  { up: 200000, base: 12500, rate: 16, over: 150000 },
  { up: 300000, base: 31250, rate: 18, over: 200000 },
  { up: 500000, base: 49250, rate: 19, over: 300000 },
  { up: 1000000, base: 87250, rate: 20, over: 500000 },
  { up: 1500000, base: 187250, rate: 21, over: 1000000 },
  { up: 2000000, base: 292250, rate: 22, over: 1500000 },
  { up: 2500000, base: 402250, rate: 23, over: 2000000 },
  { up: 5000000, base: 517250, rate: 24, over: 2500000 },
  { up: 10000000, base: 1117250, rate: 24.5, over: 5000000 },
  { up: Infinity, base: 2342250, rate: 25, over: 10000000 },
];
export function moneyCents(value: unknown) {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    n > 1e10 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.0001
  )
    throw new Error(
      "Valor inválido. Use montantes positivos com até duas casas decimais.",
    );
  return Math.round(n * 100);
}
export const HR_SERVICE_SECTIONS = [
  {
    section: "Laboratório",
    units: [
      "Laboratório",
      "Laboratório / Colheitas",
      "Laboratório / Bioquímica",
      "Laboratório / Hematologia",
      "Laboratório / Microbiologia",
      "Laboratório / Imunologia",
    ],
  },
  {
    section: "Enfermagem",
    units: [
      "Enfermagem",
      "Enfermagem / Triagem",
      "Enfermagem / Internamento",
      "Enfermagem / Consultas externas",
      "Enfermagem / Urgência",
    ],
  },
  {
    section: "Apoio hospitalar",
    units: [
      "Apoio hospitalar / Recepção",
      "Apoio hospitalar / Higienização",
      "Apoio hospitalar / Arquivo",
      "Apoio hospitalar / Manutenção",
      "Apoio hospitalar / Segurança",
      "Apoio hospitalar / Transporte",
      "Apoio hospitalar / Outros",
    ],
  },
  {
    section: "Imagiologia",
    units: [
      "Imagiologia",
      "Imagiologia / Radiologia",
      "Imagiologia / Ecografia",
      "Imagiologia / Tomografia",
    ],
  },
  {
    section: "Outras secções",
    units: ["Medicina", "Farmácia", "Administração"],
  },
];
export function payrollOptions(p: any) {
  const input = p.payrollOptions;
  if (
    input !== undefined &&
    (!input || typeof input !== "object" || Array.isArray(input))
  )
    throw new Error("Configuração de descontos inválida.");
  const d = input || {};
  const flag = (v: any) => {
    if (v === undefined) return true;
    if (typeof v !== "boolean") throw new Error("Activação inválida.");
    return v;
  };
  const rate = (v: any, fallback: number) => {
    const n = v === undefined ? fallback : Number(v);
    if (
      typeof v === "boolean" ||
      v === null ||
      v === "" ||
      !Number.isFinite(n) ||
      n < 0 ||
      n > 100 ||
      Math.abs(n * 100 - Math.round(n * 100)) > 0.00001
    )
      throw new Error(
        "Taxa inválida: use 0 a 100%, com até duas casas decimais.",
      );
    return n;
  };
  const out = {
    inssEnabled: flag(d.inssEnabled),
    employeeRate: rate(d.employeeRate, p.retired ? 8 : 3),
    employerEnabled: flag(d.employerEnabled),
    employerRate: rate(d.employerRate, 8),
    irtEnabled: flag(d.irtEnabled),
    irtMode: d.irtMode || "table",
    irtRate: rate(d.irtRate, 0),
    reason: String(d.reason || "")
      .trim()
      .slice(0, 1000),
  };
  if (!["table", "percent"].includes(out.irtMode))
    throw new Error("Modo IRT inválido.");
  if (
    (!out.inssEnabled ||
      !out.employerEnabled ||
      !out.irtEnabled ||
      out.employeeRate !== (p.retired ? 8 : 3) ||
      out.employerRate !== 8 ||
      out.irtMode !== "table") &&
    !out.reason
  )
    throw new Error(
      "Indique o fundamento da desactivação ou alteração das taxas.",
    );
  return out;
}
export function internalDeductionRows(p: any) {
  const input = p.internalDeductions || [];
  if (!Array.isArray(input) || input.length > 30)
    throw new Error("Descontos internos inválidos (máximo 30).");
  return input.map((d: any) => {
    if (
      !d ||
      typeof d.label !== "string" ||
      !d.label.trim() ||
      d.label.length > 150 ||
      typeof d.reason !== "string" ||
      !d.reason.trim() ||
      d.reason.length > 500
    )
      throw new Error("Indique nome e fundamento de cada desconto interno.");
    if (
      typeof d.enabled !== "boolean" ||
      !["fixed", "percent"].includes(d.mode) ||
      !["basic", "gross"].includes(d.basis) ||
      !(d.period === "recorrente" || /^20\d{2}-(0[1-9]|1[0-2])$/.test(d.period))
    )
      throw new Error(
        "Período, tipo ou activação do desconto interno inválido.",
      );
    const amount = moneyCents(d.value) / 100;
    if (d.mode === "percent" && amount > 100)
      throw new Error("Percentagem do desconto interno superior a 100%.");
    return {
      label: d.label.trim(),
      reason: d.reason.trim(),
      enabled: d.enabled,
      mode: d.mode,
      basis: d.basis,
      value: amount,
      period: d.period,
    };
  });
}
export function calculatePayroll(p: any) {
  const basic = moneyCents(p.basic),
    allowances = p.allowances || [];
  if (!Array.isArray(allowances) || allowances.length > 30)
    throw new Error("Rubricas inválidas.");
  let gross = basic,
    ssBase = basic,
    taxable = basic;
  for (const a of allowances) {
    if (a.kind === "ferias" && (a.inss !== false || a.irt !== true))
      throw new Error(
        "No regime geral, confira a isenção INSS e tributação IRT do subsídio de férias.",
      );
    if (a.kind === "natal" && (a.inss !== true || a.irt !== true))
      throw new Error(
        "No regime geral, o subsídio de Natal integra as incidências configuradas INSS/IRT.",
      );
    const value = moneyCents(a.value);
    if (!a.label || typeof a.inss !== "boolean" || typeof a.irt !== "boolean")
      throw new Error("Indique a rubrica e a incidência INSS/IRT.");
    gross += value;
    if (a.inss) ssBase += value;
    if (a.irt) taxable += value;
  }
  const options = payrollOptions(p),
    employee = options.inssEnabled ? options.employeeRate : 0,
    employer = options.employerEnabled ? options.employerRate : 0,
    ssEmployee = Math.round((ssBase * employee) / 100),
    ssEmployer = Math.round((ssBase * employer) / 100);
  const taxableBase = Math.max(0, taxable - ssEmployee),
    band = IRT_2026.find((b) => taxableBase <= b.up * 100)!;
  const tax = !options.irtEnabled
    ? 0
    : options.irtMode === "percent"
      ? Math.round((taxableBase * options.irtRate) / 100)
      : Math.round(
          band.base * 100 + ((taxableBase - band.over * 100) * band.rate) / 100,
        );
  const internalDetails = internalDeductionRows(p)
    .filter((d) => d.enabled)
    .map((d) => ({
      ...d,
      amount:
        d.mode === "percent"
          ? Math.round(
              ((d.basis === "basic" ? basic : gross) * d.value) / 100,
            ) / 100
          : d.value,
    }));
  const internal = internalDetails.reduce(
      (total, d) => total + moneyCents(d.amount),
      0,
    ),
    legacyDeductions = moneyCents(p.deductions || 0),
    deductions = legacyDeductions + internal,
    net = gross - ssEmployee - tax - deductions;
  if (net < 0) throw new Error("Os descontos ultrapassam a remuneração.");
  return {
    basic: basic / 100,
    gross: gross / 100,
    ssBase: ssBase / 100,
    payrollOptions: options,
    internalDetails,
    legacyDeductions: legacyDeductions / 100,
    employeeRate: employee,
    employerRate: employer,
    inssEmployee: ssEmployee / 100,
    inssEmployer: ssEmployer / 100,
    irtBase: taxableBase / 100,
    irt: tax / 100,
    deductions: deductions / 100,
    net: net / 100,
    employerCost: (gross + ssEmployer) / 100,
    ruleVersion: HR_RULE_VERSION,
  };
}

export function payrollProfileForMonth(p: any, month: string) {
  return {
    ...p,
    internalDeductions: internalDeductionRows(p).filter(
      (d) => d.period === "recorrente" || d.period === month,
    ),
    allowances: (p.allowances || []).filter(
      (a: any) => a.period === "recorrente" || a.period === month,
    ),
    deductions: p.deductionsMonth === month ? p.deductions : 0,
    deductionReason: p.deductionsMonth === month ? p.deductionReason : "",
  };
}

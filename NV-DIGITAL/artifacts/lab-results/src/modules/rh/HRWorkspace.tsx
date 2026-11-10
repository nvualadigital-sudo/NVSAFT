import { prepareRosterLogo } from "./utils/institutionalRoster";
import { rosterShiftStyle } from "./utils/shiftVisual";
import "./rosterColors.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Users,
  Wallet,
  FileDown,
  FileSpreadsheet,
  Save,
  Plus,
  ShieldCheck,
  History,
  Settings2,
  ArrowRight,
} from "lucide-react";
import {
  GLOBAL_DEFAULT_ROSTER_RULES,
  SHIFT_LEGEND,
  getDaysInMonth,
  getShiftHours,
  evaluateNurseCompliance,
  calculatePayroll,
  HR_RULE_VERSION,
  HR_SERVICE_SECTIONS,
  payrollProfileForMonth,
} from "@workspace/api-zod";
import type { RosterNurseRow, ShiftCode, DepartmentRosterRules } from "./types";
import type { Session } from "../../store/auth";
import { reqDirect } from "../../store/api";
import { RosterCollaboratorCalendarModal } from "./components/RosterCollaboratorCalendarModal";
import {
  documentSheet,
  sheetXlsx,
  sheetPdf,
  downloadBytes,
} from "./utils/exportDocuments";
import "./HRWorkspace.css";
import LegacyFees from "./LegacyFees";
const request = <T,>(method: string, path: string, body?: any) =>
  reqDirect<T>(method, "/hospital/hr" + path, body);
const keys = new Map<string, string>();
async function command<T = any>(path: string, body: any) {
  const key = JSON.stringify([path, body]);
  let id = keys.get(key);
  if (!id) {
    id = crypto.randomUUID();
    keys.set(key, id);
  }
  const r = await request<T>("POST", path, { ...body, requestId: id });
  keys.delete(key);
  return r;
}
const money = (n: number) =>
  new Intl.NumberFormat("pt-AO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={"hr-btn" + (secondary ? " secondary" : "")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function ServiceSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const known = HR_SERVICE_SECTIONS.some((s) => s.units.includes(value));
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === "__custom") {
          const v = window.prompt(
            "Nome da secção / unidade (ex.: Apoio hospitalar / Nutrição):",
          );
          if (v?.trim() && v.trim().length <= 100) onChange(v.trim());
        } else onChange(e.target.value);
      }}
    >
      {!known && value && (
        <option value={value}>{value} (unidade existente)</option>
      )}
      {HR_SERVICE_SECTIONS.map((section) => (
        <optgroup label={section.section} key={section.section}>
          {section.units.map((unit) => (
            <option value={unit} key={unit}>
              {unit}
            </option>
          ))}
        </optgroup>
      ))}
      <option value="__custom">+ Outro serviço / unidade…</option>
    </select>
  );
}
export default function HRWorkspace({
  session,
  initialTab,
}: {
  session: Session;
  initialTab?: string;
}) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const admin = ["admin", "gestor"].includes(session.funcao || "");
  const [accessReady, setAccessReady] = useState(false),
    [caps, setCaps] = useState({
      canSchedule: admin,
      canPayroll: admin || session.funcao === "financeiro",
      canManageAccess: admin,
    });
  const canSchedule = caps.canSchedule,
    canPayroll = caps.canPayroll;
  const [tab, setTab] = useState(
    initialTab || (session.funcao === "financeiro" ? "salarios" : "escala"),
  );
  const [printSettings, setPrintSettings] = useState<any>({
    unitHeading: "Direcção de Enfermagem",
    title: "Escala Mensal de Trabalho para os Enfermeiros",
    activities: "",
    morningPeriod: "07:00h - 15:00h",
    afternoonPeriod: "15:00h - 20:00h",
    onCallPeriod: "07:00h - 07:00h",
  });
  useEffect(() => {
    let active = true;
    request<any>("GET", "/access")
      .then((c) => {
        if (!active) return;
        setCaps(c);
        setAccessReady(true);
        setTab((t) =>
          !c.canPayroll && ["salarios", "colaboradores"].includes(t)
            ? "escala"
            : !c.canSchedule && ["escala", "regras"].includes(t)
              ? "salarios"
              : t,
        );
      })
      .catch(() => {
        if (active) {
          setCaps({
            canSchedule: false,
            canPayroll: false,
            canManageAccess: false,
          });
          setAccessReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [refreshVersion]);
  const [printLayout, setPrintLayout] = useState<"a4-month" | "a3-month">(
    "a4-month",
  );
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    [department, setDepartment] = useState("Enfermagem");
  const [workers, setWorkers] = useState<any[]>([]),
    [profiles, setProfiles] = useState<any[]>([]),
    [roster, setRoster] = useState<any>(null),
    [payroll, setPayroll] = useState<any>(null);
  const [rows, setRows] = useState<RosterNurseRow[]>([]),
    [rules, setRules] = useState<DepartmentRosterRules>({
      ...GLOBAL_DEFAULT_ROSTER_RULES,
    }),
    [dirty, setDirty] = useState(false),
    [editing, setEditing] = useState<RosterNurseRow | null>(null),
    [adding, setAdding] = useState("");
  const [history, setHistory] = useState<any[]>([]),
    [legacy, setLegacy] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [reviewNote, setReviewNote] = useState("");
  const requestSeq = useRef(0),
    scope = useRef("");
  scope.current = month + "|" + department;
  useEffect(() => {
    if (!accessReady) return;
    const seq = ++requestSeq.current;
    setRoster(null);
    setRows([]);
    setPayroll(null);
    setEditing(null);
    setDirty(false);
    setError("");
    if (!canSchedule && !canPayroll) {
      setProfiles([]);
      setWorkers([]);
      return;
    }
    Promise.all([
      request<any[]>("GET", "/workers"),
      canPayroll ? request<any[]>("GET", "/profiles") : Promise.resolve([]),
      canPayroll
        ? request<any>("GET", "/payroll?month=" + month)
        : Promise.resolve(null),
      canSchedule
        ? request<any>(
            "GET",
            `/roster?month=${month}&department=${encodeURIComponent(department)}`,
          )
        : Promise.resolve(null),
    ])
      .then(([w, p, pay, r]) => {
        if (seq !== requestSeq.current) return;
        setWorkers(w);
        setProfiles(p);
        setPayroll(pay);
        if (r) {
          setRoster(r);
          setRows(r.data.rows);
          setRules(r.data.rules);
          setReviewNote(r.data.reviewNote || "");
          setPrintSettings(
            r.data.printSettings || {
              unitHeading: /enferm/i.test(department)
                ? "Direcção de " + department
                : department,
              title: /enferm/i.test(department)
                ? "Escala Mensal de Trabalho para os Enfermeiros"
                : "Escala Mensal de Trabalho",
              activities: "",
            },
          );
        }
      })
      .catch((e) => {
        if (seq === requestSeq.current) setError(e.message);
      });
  }, [month, department, canSchedule, canPayroll, accessReady, refreshVersion]);
  const action = async (
    fn: () => Promise<any>,
    success = "Operação confirmada no servidor.",
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveRoster = async (nextRows = rows, publish = false) => {
    if (!roster) throw new Error("A escala ainda não foi carregada.");
    const currentScope = scope.current;
    const result = await command("/roster", {
      month,
      department,
      revision: roster.revision,
      data: { rows: nextRows, rules, printSettings },
      publish,
      reviewNote,
    });
    if (currentScope === scope.current) {
      setRoster(result);
      setRows(result.data.rows);
      setRules(result.data.rules);
      setDirty(false);
    }
    return result;
  };
  const exportDoc = async (
    kind: "roster" | "payroll" | "slip" | "inss",
    format: "pdf" | "xlsx",
    workerId?: string,
  ) => {
    if (kind === "roster" && dirty)
      throw new Error("Guarde as alterações da escala antes de exportar.");
    const document = kind === "roster" ? roster : payroll;
    if (!document?.revision)
      throw new Error("Guarde a escala ou gere a folha antes de exportar.");
    const exported = await command("/export", {
      kind,
      month,
      department,
      revision: document.revision,
      ...(workerId ? { workerId } : {}),
    });
    const sheet = documentSheet(exported);
    if (kind === "roster") {
      sheet.printLayout = printLayout;
      if (sheet.roster) await prepareRosterLogo(sheet.roster);
    }
    const bytes = format === "pdf" ? sheetPdf(sheet) : await sheetXlsx(sheet);
    downloadBytes(
      bytes,
      `NVUALASOFT_${kind}_${month}${workerId ? "_" + workerId : ""}.${format}`,
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  };
  const [year, mon] = month.split("-").map(Number),
    days = getDaysInMonth(year, mon - 1);
  const totalHours = rows.reduce(
    (sum, row) =>
      sum +
      Object.values(row.days).reduce(
        (s, code) =>
          s +
          getShiftHours(
            code,
            /chefe/i.test((row.roleCategory || "") + (row.jobTitle || "")),
            rules,
          ),
        0,
      ),
    0,
  );
  const alerts = useMemo(
    () =>
      rows.flatMap((row) =>
        evaluateNurseCompliance(row, year, mon - 1, rules).map((a) => ({
          ...a,
          name: row.name,
        })),
      ),
    [rows, rules, year, mon],
  );
  const payrollRows = payroll?.data.rows || [],
    gross = payrollRows.reduce((s: number, r: any) => s + r.gross, 0),
    net = payrollRows.reduce((s: number, r: any) => s + r.net, 0),
    contributions = payrollRows.reduce(
      (s: number, r: any) => s + r.inssEmployee + r.inssEmployer,
      0,
    );
  const changeScope = (setter: (s: string) => void, value: string) => {
    if (
      dirty &&
      !window.confirm(
        "Existem alterações por guardar. Deseja mudar de período/serviço e descartá-las?",
      )
    )
      return;
    setter(value);
  };
  if (!accessReady)
    return (
      <div className="hr-empty">
        A carregar autorizações de Recursos humanos…
      </div>
    );
  if (!canSchedule && !canPayroll)
    return (
      <div className="hr-empty">
        Peça à administração para autorizar a sua conta em Recursos humanos →
        Acessos das chefias.
      </div>
    );
  return (
    <section className="hr-workspace" aria-busy={busy} inert={busy}>
      <header className="hr-head">
        <div>
          <div className="hr-eyebrow">NVUALASOFT · Pessoas e equipas</div>
          <h2>Escalas e remunerações</h2>
          <p>Uma equipa organizada. Informação guardada na instituição.</p>
        </div>
        <div className="hr-actions">
          <span className="hr-status">{month}</span>
          <Button
            secondary
            onClick={() =>
              void action(async () => {
                setHistory(await request<any[]>("GET", "/history"));
                if (canSchedule)
                  setLegacy(await request<any[]>("GET", "/legacy"));
                setTab("historico");
              })
            }
          >
            <History size={15} /> Histórico
          </Button>
        </div>
      </header>
      <nav className="hr-tabs" aria-label="Recursos humanos">
        {[
          ...(canSchedule ? [["escala", "Escala mensal", CalendarDays]] : []),
          ...(canPayroll
            ? [
                ["salarios", "Folha de salários", Wallet],
                ["colaboradores", "Perfis salariais", Users],
              ]
            : []),
          ...(caps.canManageAccess
            ? [["acessos", "Acessos das chefias", ShieldCheck]]
            : []),
          ...(canSchedule ? [["regras", "Regras da escala", Settings2]] : []),
        ].map(([key, label, Icon]: any) => (
          <button
            key={key}
            disabled={busy}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            <Icon size={15} className="inline mr-2" />
            {label}
          </button>
        ))}
      </nav>
      {(error || message) && (
        <div className="hr-feedback" role={error ? "alert" : "status"}>
          {error || message}
          {error && (
            <button
              className="ml-4 underline"
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm(
                    "Actualizar e descartar alterações da escala por guardar?",
                  )
                )
                  setRefreshVersion((v) => v + 1);
              }}
            >
              Actualizar dados do servidor
            </button>
          )}
        </div>
      )}
      <div className="hr-stat-grid">
        {(tab === "escala" || tab === "regras"
          ? [
              [rows.length, "Colaboradores na escala"],
              [totalHours + " h", "Horas planeadas"],
              [alerts.length, "Observações para rever"],
              [roster?.status || "A carregar", "Estado da escala"],
            ]
          : [
              [payrollRows.length, "Colaboradores na folha"],
              [money(gross), "Remuneração bruta · AOA"],
              [money(contributions), "INSS total · AOA"],
              [money(net), "Líquido a receber · AOA"],
            ]
        ).map(([n, label]) => (
          <div className="hr-stat" key={String(label)}>
            <small>{label}</small>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <div className="hr-panel">
        <div className="hr-controls">
          <label>
            Mês
            <input
              type="month"
              value={month}
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) changeScope(setMonth, e.target.value);
              }}
            />
          </label>
          {canSchedule && (tab === "escala" || tab === "regras") && (
            <label>
              Serviço / unidade
              <ServiceSelect
                value={department}
                disabled={busy}
                onChange={(v) => changeScope(setDepartment, v)}
              />
            </label>
          )}
          <span
            className={
              "hr-status " +
              ((tab === "escala" ? roster?.status : payroll?.status) !==
              "rascunho"
                ? "frozen"
                : "")
            }
          >
            {tab === "escala" || tab === "regras"
              ? roster?.status || "Sem escala"
              : payroll?.status || "Sem folha"}
          </span>
        </div>
        {tab === "escala" && (
          <>
            <div className="hr-controls">
              <select
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                aria-label="Adicionar colaborador"
              >
                <option value="">
                  Seleccionar colaborador da instituição…
                </option>
                {workers
                  .filter((w) => w.ativo && !rows.some((r) => r.id === w.id))
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nome}
                    </option>
                  ))}
              </select>
              <Button
                secondary
                disabled={busy || !adding || roster?.status === "publicada"}
                onClick={() => {
                  const worker = workers.find((w) => w.id === adding);
                  if (worker) {
                    setRows([
                      ...rows,
                      {
                        id: worker.id,
                        name: worker.nome,
                        department,
                        jobTitle: worker.position || worker.funcao,
                        roleCategory: /sub.*chefe/i.test(worker.position || "")
                          ? "Sub-Chefe"
                          : /chefe/i.test(worker.position || "")
                            ? "Enf.Chefe"
                            : "Equipa",
                        days: {},
                      },
                    ]);
                    setDirty(true);
                    setAdding("");
                  }
                }}
              >
                <Plus size={14} /> Adicionar
              </Button>
              <Button
                disabled={busy || !roster || roster.status === "publicada"}
                onClick={() => void action(() => saveRoster())}
              >
                <Save size={14} /> Guardar{dirty ? " alterações" : ""}
              </Button>
              <label>
                Impressão da escala
                <select
                  value={printLayout}
                  onChange={(e) => setPrintLayout(e.target.value as any)}
                >
                  <option value="a4-month">
                    A4 horizontal · mês completo numa folha
                  </option>
                  <option value="a3-month">A3 horizontal · mês completo</option>
                </select>
              </label>
              <Button
                secondary
                disabled={busy || !roster?.revision}
                onClick={() =>
                  void action(
                    () => exportDoc("roster", "pdf"),
                    "PDF gerado com as cores da escala.",
                  )
                }
              >
                <FileDown size={14} /> PDF
              </Button>
              <Button
                secondary
                disabled={busy || !roster?.revision}
                onClick={() =>
                  void action(
                    () => exportDoc("roster", "xlsx"),
                    "Excel gerado com as cores da escala.",
                  )
                }
              >
                <FileSpreadsheet size={14} /> Excel
              </Button>
              <Button
                secondary
                disabled={busy || !roster}
                onClick={() =>
                  void action(async () => {
                    if (roster.status === "publicada") {
                      const reason = window.prompt("Motivo da reabertura:");
                      if (!reason) return;
                      const r = await command("/roster/reopen", {
                        month,
                        department,
                        revision: roster.revision,
                        reason,
                      });
                      setRoster(r);
                    } else await saveRoster(rows, true);
                  })
                }
              >
                <ShieldCheck size={14} />{" "}
                {roster?.status === "publicada"
                  ? "Reabrir com motivo"
                  : "Rever e publicar"}
              </Button>
            </div>
            <details className="hr-print-fields">
              <summary>Cabeçalho e Formação / Actividades do modelo</summary>
              <div className="hr-grid-form">
                <label>
                  Direcção / unidade no cabeçalho
                  <input
                    maxLength={200}
                    disabled={roster?.status === "publicada"}
                    value={printSettings.unitHeading}
                    onChange={(e) => {
                      setPrintSettings({
                        ...printSettings,
                        unitHeading: e.target.value,
                      });
                      setDirty(true);
                    }}
                  />
                </label>
                <label>
                  Título da escala
                  <input
                    maxLength={200}
                    disabled={roster?.status === "publicada"}
                    value={printSettings.title}
                    onChange={(e) => {
                      setPrintSettings({
                        ...printSettings,
                        title: e.target.value,
                      });
                      setDirty(true);
                    }}
                  />
                </label>
                {[
                  [
                    "morningPeriod",
                    "Horário manhã / diarista",
                    "07:00h - 15:00h",
                  ],
                  [
                    "afternoonPeriod",
                    "Horário tarde / noite",
                    "15:00h - 20:00h",
                  ],
                  ["onCallPeriod", "Horário plantão", "07:00h - 07:00h"],
                ].map(([key, label, fallback]) => (
                  <label key={key}>
                    {label}
                    <input
                      maxLength={80}
                      disabled={roster?.status === "publicada"}
                      value={printSettings[key] || fallback}
                      onChange={(e) => {
                        setPrintSettings({
                          ...printSettings,
                          [key]: e.target.value,
                        });
                        setDirty(true);
                      }}
                    />
                  </label>
                ))}
                <label className="wide">
                  Formação / Actividades / Observações (uma linha por item)
                  <textarea
                    maxLength={3000}
                    disabled={roster?.status === "publicada"}
                    value={printSettings.activities}
                    onChange={(e) => {
                      setPrintSettings({
                        ...printSettings,
                        activities: e.target.value,
                      });
                      setDirty(true);
                    }}
                  />
                </label>
                <p className="hr-muted">
                  O logótipo e o nome vêm da configuração da empresa. D
                  significa descanso; a manhã/diarista usa M e a tarde usa PM,
                  conforme as horas configuradas.
                </p>
              </div>
            </details>
            {rows.length ? (
              <div className="hr-table-scroll">
                <table className="hr-table">
                  <thead>
                    <tr>
                      <th className="hr-name">Colaborador</th>
                      {Array.from({ length: days }, (_, i) => (
                        <th key={i}>
                          {i + 1}
                          <br />
                          <span style={{ fontWeight: 400 }}>
                            {
                              ["D", "S", "T", "Q", "Q", "S", "S"][
                                new Date(
                                  Date.UTC(year, mon - 1, i + 1),
                                ).getUTCDay()
                              ]
                            }
                          </span>
                        </th>
                      ))}
                      <th>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="hr-name">
                          <button
                            disabled={busy || roster?.status === "publicada"}
                            onClick={() => setEditing(row)}
                          >
                            {row.name}
                          </button>
                          <small>
                            {row.jobTitle} ·{" "}
                            <select
                              aria-label={"Cargo e funções: " + row.name}
                              disabled={roster?.status === "publicada"}
                              value={row.roleCategory || "Equipa"}
                              onChange={(e) => {
                                setRows(
                                  rows.map((r) =>
                                    r.id === row.id
                                      ? { ...r, roleCategory: e.target.value }
                                      : r,
                                  ),
                                );
                                setDirty(true);
                              }}
                            >
                              {!["Equipa", "Enf.Chefe", "Sub-Chefe"].includes(
                                row.roleCategory || "Equipa",
                              ) && (
                                <option value={row.roleCategory}>
                                  {row.roleCategory}
                                </option>
                              )}
                              <option value="Enf.Chefe">Enf.Chefe</option>
                              <option value="Sub-Chefe">Sub-Chefe</option>
                              <option value="Equipa">Equipa</option>
                            </select>{" "}
                            ·{" "}
                            <button
                              onClick={() => {
                                if (roster?.status === "publicada") return;
                                setRows(rows.filter((r) => r.id !== row.id));
                                setDirty(true);
                              }}
                            >
                              Retirar da escala
                            </button>
                          </small>
                        </td>
                        {Array.from({ length: days }, (_, i) => {
                          const code = row.days[i + 1],
                            s = SHIFT_LEGEND[code];
                          return (
                            <td key={i}>
                              <button
                                disabled={
                                  busy || roster?.status === "publicada"
                                }
                                title={s?.label || "Por preencher"}
                                className="hr-shift"
                                data-roster-shift={code || undefined}
                                style={rosterShiftStyle(code)}
                                onClick={() => setEditing(row)}
                              >
                                {code || "·"}
                              </button>
                            </td>
                          );
                        })}
                        <td className="hr-pay-number">
                          {Object.values(row.days).reduce(
                            (s, c) =>
                              s +
                              getShiftHours(
                                c,
                                /chefe/i.test(
                                  (row.roleCategory || "") +
                                    (row.jobTitle || ""),
                                ),
                                rules,
                              ),
                            0,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="hr-empty">
                <CalendarDays
                  size={34}
                  style={{ margin: "0 auto 12px", color: "#8ab2c4" }}
                />
                <strong>Começa pela tua equipa</strong>
                <p>
                  Adiciona colaboradores e clica no nome para editar o
                  calendário.
                </p>
              </div>
            )}
            <div className="hr-legend">
              {Object.entries(SHIFT_LEGEND).map(([k, s]) => (
                <span key={k}>
                  <b
                    className="hr-shift"
                    data-roster-shift={k}
                    style={rosterShiftStyle(k as ShiftCode)}
                  >
                    {k}
                  </b>
                  {s.label}
                </span>
              ))}
            </div>
            {alerts.length > 0 && (
              <div className="hr-alert-list mt-4">
                {alerts.slice(0, 12).map((a, i) => (
                  <div key={i}>
                    {a.name}: {a.message}
                  </div>
                ))}
                {alerts.length > 12 && (
                  <div>
                    Mais {alerts.length - 12} observações. Abra o calendário de
                    cada colaborador.
                  </div>
                )}
              </div>
            )}
            <label className="hr-muted block mt-4">
              Nota de revisão / enquadramento dos alertas
              <textarea
                className="block w-full mt-2"
                disabled={roster?.status === "publicada"}
                value={reviewNote}
                onChange={(e) => {
                  setReviewNote(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <p className="hr-snapshot">
              Selecciona vários dias no calendário do colaborador para aplicar
              um turno. A exportação usa a última versão guardada, com as mesmas
              cores. Horas planeadas não são horas extra aprovadas.
            </p>
          </>
        )}
        {tab === "regras" && (
          <>
            <h3 className="font-bold text-lg mb-2">
              Horários e regras da instituição
            </h3>
            <p className="hr-muted mb-4">
              Os tempos iniciais vêm do modelo enviado. Confirme o enquadramento
              da unidade e os horários efectivos antes de publicar. Os alertas
              não substituem a revisão dos intervalos, folgas, férias e regimes
              especiais.
            </p>
            <div className="hr-grid-form">
              <label>
                Limite semanal (h)
                <input
                  type="number"
                  value={rules.maxWeeklyHours}
                  onChange={(e) => {
                    setRules({
                      ...rules,
                      maxWeeklyHours: Number(e.target.value),
                    });
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                Máximo de dias consecutivos
                <input
                  type="number"
                  value={rules.maxConsecutiveDays}
                  onChange={(e) => {
                    setRules({
                      ...rules,
                      maxConsecutiveDays: Number(e.target.value),
                    });
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                Manhã de chefia (h)
                <input
                  type="number"
                  value={rules.chiefMorningHours}
                  onChange={(e) => {
                    setRules({
                      ...rules,
                      chiefMorningHours: Number(e.target.value),
                    });
                    setDirty(true);
                  }}
                />
              </label>
              {(["M", "PM"] as ShiftCode[]).map((k) => (
                <label key={k}>
                  {SHIFT_LEGEND[k].label} (h)
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step=".5"
                    value={rules.hours[k]}
                    onChange={(e) => {
                      setRules({
                        ...rules,
                        hours: { ...rules.hours, [k]: Number(e.target.value) },
                      });
                      setDirty(true);
                    }}
                  />
                </label>
              ))}
              <label className="wide">
                Fundamento / autorização do regime especial
                <textarea
                  value={rules.legalBasis}
                  onChange={(e) => {
                    setRules({ ...rules, legalBasis: e.target.value });
                    setDirty(true);
                  }}
                />
              </label>
              <label className="hr-toggle wide">
                <input
                  type="checkbox"
                  checked={rules.allow24}
                  onChange={(e) => {
                    setRules({ ...rules, allow24: e.target.checked });
                    setDirty(true);
                  }}
                />
                Permitir padrão de 24h apenas com enquadramento específico
                documentado
              </label>
              <label className="hr-toggle wide">
                <input
                  type="checkbox"
                  checked={rules.confirmed}
                  onChange={(e) => {
                    setRules({ ...rules, confirmed: e.target.checked });
                    setDirty(true);
                  }}
                />
                Revi os horários e o enquadramento aplicável à instituição
              </label>
            </div>
            <div className="mt-4">
              <Button
                disabled={busy || !roster || roster.status === "publicada"}
                onClick={() => void action(() => saveRoster())}
              >
                <Save size={15} /> Guardar regras nesta escala
              </Button>
            </div>
          </>
        )}
        {tab === "acessos" && caps.canManageAccess && <HRAccessPanel />}
        {tab === "colaboradores" && (
          <ProfileEditor
            key={month + "|" + refreshVersion}
            month={month}
            workers={workers.filter((w) => w.ativo)}
            profiles={profiles}
            busy={busy}
            onSave={async (workerId, data, revision) => {
              setError("");
              setBusy(true);
              try {
                const p = await command("/profiles", {
                  workerId,
                  data,
                  revision,
                });
                setProfiles([
                  ...profiles.filter((x) => x.worker_id !== workerId),
                  p,
                ]);
                setMessage("Perfil salarial confirmado no servidor.");
              } catch (e: any) {
                setError(e.message);
                throw e;
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        {tab === "salarios" && (
          <>
            <div className="hr-controls">
              <Button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    setPayroll(
                      await command("/payroll/generate", {
                        month,
                        revision: payroll?.revision || 0,
                      }),
                    );
                  })
                }
              >
                <Wallet size={14} />{" "}
                {payroll ? "Recalcular rascunho" : "Gerar folha mensal"}
              </Button>
              <Button
                secondary
                disabled={busy || !payroll}
                onClick={() => void action(() => exportDoc("payroll", "pdf"))}
              >
                <FileDown size={14} /> PDF
              </Button>
              <Button
                secondary
                disabled={busy || !payroll}
                onClick={() => void action(() => exportDoc("payroll", "xlsx"))}
              >
                <FileSpreadsheet size={14} /> Excel
              </Button>
              <Button
                secondary
                disabled={busy || !payroll}
                onClick={() => void action(() => exportDoc("inss", "xlsx"))}
              >
                Mapa INSS
              </Button>
              {caps.canManageAccess && (
                <Button
                  secondary
                  disabled={busy || payroll?.status !== "rascunho"}
                  onClick={() =>
                    void action(async () => {
                      if (
                        !window.confirm(
                          "Confirma a revisão dos perfis, incidências e valores desta folha? A aprovação bloqueia a edição e exige outro gestor.",
                        )
                      )
                        return;
                      setPayroll(
                        await command("/payroll/approve", {
                          month,
                          revision: payroll.revision,
                          confirmed: true,
                        }),
                      );
                    })
                  }
                >
                  <ShieldCheck size={14} /> Aprovar folha
                </Button>
              )}
              <Button
                secondary
                disabled={busy || payroll?.status !== "aprovada"}
                onClick={() =>
                  void action(async () => {
                    const reference = window.prompt(
                      "Referência do pagamento efectuado no banco / comprovativo:",
                    );
                    if (reference)
                      setPayroll(
                        await command("/payroll/paid", {
                          month,
                          revision: payroll.revision,
                          reference,
                        }),
                      );
                  })
                }
              >
                Registar pagamento
              </Button>
            </div>
            <p className="hr-muted mb-4">
              Valores em AOA. INSS do trabalhador e INSS entidade separados. Não
              se calculam salários a partir da escala. Subsídios, horas extra e
              descontos são rubricas validadas no perfil; o sistema não efectua
              transferências bancárias.
            </p>
            {!!payroll?.data.warnings?.length && (
              <div className="hr-alert-list mb-4">
                {payroll.data.warnings.map((w: string, i: number) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}
            {payroll ? (
              <div className="hr-table-scroll">
                <table className="hr-table">
                  <thead>
                    <tr>
                      {[
                        "Colaborador",
                        "Base",
                        "Bruto",
                        "INSS trab.",
                        "INSS entidade",
                        "IRT",
                        "Outros desc.",
                        "Líquido",
                        "Recibo",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRows.map((p: any) => (
                      <tr key={p.workerId}>
                        <td className="hr-name">
                          {p.name}
                          <small>{p.profile.department}</small>
                        </td>
                        {[
                          p.basic,
                          p.gross,
                          p.inssEmployee,
                          p.inssEmployer,
                          p.irt,
                          p.deductions,
                          p.net,
                        ].map((v, i) => (
                          <td
                            key={i}
                            className="hr-pay-number"
                            style={
                              i === 6
                                ? { background: "#d1fae5", color: "#065f46" }
                                : undefined
                            }
                          >
                            {money(v)}
                          </td>
                        ))}
                        <td>
                          <button
                            onClick={() =>
                              void action(() =>
                                exportDoc("slip", "pdf", p.workerId),
                              )
                            }
                          >
                            PDF <ArrowRight size={12} className="inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="hr-empty">
                Configura os perfis salariais e gera a folha do mês.
              </div>
            )}
            <div className="hr-snapshot">
              {payroll
                ? `Preparada por ${payroll.prepared_by}. ${payroll.approved_by ? "Aprovada por " + payroll.approved_by + "." : ""} Versão ${payroll.data.ruleVersion}.`
                : "Tabela de referência disponível: " +
                  HR_RULE_VERSION +
                  "."}{" "}
              A incidência de cada rubrica e regimes especiais precisam de
              validação do responsável financeiro.
            </div>
          </>
        )}
        {tab === "salarios" && ["admin","gestor","financeiro"].includes(session.funcao || "") && <LegacyFees/>}
        {tab === "historico" && (
          <>
            <h3 className="font-bold mb-3">Histórico de operações</h3>
            {history.map((h, i) => (
              <div key={i} className="hr-muted border-b py-2">
                {new Date(h.created_at).toLocaleString("pt-AO")} · {h.actor} ·{" "}
                {h.kind} · {h.reference}
              </div>
            ))}
            {!!legacy.length && (
              <details className="mt-5">
                <summary>
                  Registos anteriores da escala ({legacy.length})
                </summary>
                {legacy.map((l) => (
                  <div key={l.id} className="hr-muted border-b py-2">
                    {l.reference} · {l.title} · {l.status} · {l.data.start} →{" "}
                    {l.data.end}
                  </div>
                ))}
              </details>
            )}
          </>
        )}
      </div>
      <footer className="hr-footer">
        Dados da instituição · Permissões por função · Histórico no servidor ·
        Exportação de documentos guardados
      </footer>
      <RosterCollaboratorCalendarModal
        isOpen={!!editing}
        nurse={editing}
        onClose={() => setEditing(null)}
        year={year}
        monthIndex={mon - 1}
        departmentName={department}
        rules={rules}
        onSaveNurseDays={async (id, days) => {
          if (busy) throw new Error("Aguarde a operação actual.");
          setBusy(true);
          try {
            await saveRoster(
              rows.map((r) => (r.id === id ? { ...r, days } : r)),
            );
            setMessage("Calendário guardado no servidor.");
          } catch (e: any) {
            setError(e.message);
            throw e;
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
const emptyProfile = {
  department: "Enfermagem",
  nif: "",
  inssNumber: "",
  basic: 0,
  allowances: [] as any[],
  internalDeductions: [] as any[],
  payrollOptions: {
    inssEnabled: true,
    employeeRate: 3,
    employerEnabled: true,
    employerRate: 8,
    irtEnabled: true,
    irtMode: "table",
    irtRate: 0,
    reason: "",
  },
  deductions: 0,
  deductionReason: "",
  retired: false,
  regime: "geral",
  confirmed: false,
  incidenceBasis: "",
  iban: "",
};
function ProfileEditor({
  month,
  workers,
  profiles,
  busy,
  onSave,
}: {
  month: string;
  workers: any[];
  profiles: any[];
  busy: boolean;
  onSave: (workerId: string, data: any, revision: number) => Promise<void>;
}) {
  const [id, setId] = useState(""),
    [p, setP] = useState<any>({ ...emptyProfile }),
    [revision, setRevision] = useState(0),
    [dirty, setDirty] = useState(false),
    [localError, setLocalError] = useState("");
  const choose = (next: string) => {
    if (dirty && !window.confirm("Descartar alterações do perfil por guardar?"))
      return;
    const saved = profiles.find((p) => p.worker_id === next);
    setId(next);
    setP(
      saved
        ? {
            ...emptyProfile,
            ...saved.data,
            payrollOptions: {
              ...emptyProfile.payrollOptions,
              employeeRate: saved.data.retired ? 8 : 3,
              ...saved.data.payrollOptions,
            },
            internalDeductions: saved.data.internalDeductions || [],
            deductions:
              saved.data.deductionsMonth === month ? saved.data.deductions : 0,
            deductionReason:
              saved.data.deductionsMonth === month
                ? saved.data.deductionReason
                : "",
            deductionsMonth: month,
          }
        : { ...emptyProfile, allowances: [], deductionsMonth: month },
    );
    setRevision(saved?.revision || 0);
    setDirty(false);
  };
  const annual = (kind: "ferias" | "natal") => {
    const months = Number(
      window.prompt("Meses completos de serviço no ano (1 a 12):"),
    );
    if (!Number.isInteger(months) || months < 1 || months > 12) return;
    const pct = Number(
      window.prompt(
        "Percentagem do salário base prevista no contrato (mínimo legal de referência 50%):",
        "50",
      ),
    );
    if (!Number.isFinite(pct) || pct < 50 || pct > 1000) {
      setLocalError("Confirme uma percentagem válida, pelo menos 50%.");
      return;
    }
    set("allowances", [
      ...p.allowances,
      {
        kind,
        label: `Subsídio de ${kind === "ferias" ? "férias" : "Natal"} ${pct}% · ${months}/12`,
        value:
          Math.round(((((p.basic * pct) / 100) * months) / 12) * 100) / 100,
        inss: kind !== "ferias",
        irt: true,
        period: month,
      },
    ]);
  };
  const set = (key: string, v: any) => {
    setP({
      ...p,
      [key]: v,
      ...(key === "retired"
        ? { payrollOptions: { ...p.payrollOptions, employeeRate: v ? 8 : 3 } }
        : {}),
      ...(key === "deductions" ? { deductionsMonth: month } : {}),
    });
    setDirty(true);
  };
  let preview: any;
  try {
    preview = calculatePayroll(payrollProfileForMonth(p, month));
  } catch {}
  return (
    <div>
      <h3 className="font-bold text-lg">Perfis de remuneração</h3>
      <p className="hr-muted mt-2">
        Selecciona um funcionário já cadastrado. Confirma a incidência legal de
        cada rubrica. As configurações servem de base ao rascunho mensal e não
        alteram folhas já aprovadas.
      </p>
      <div className="hr-worker-list">
        {workers.map((w) => (
          <button
            className={"hr-profile-chip" + (w.id === id ? " active" : "")}
            key={w.id}
            onClick={() => choose(w.id)}
          >
            {w.nome}
            {profiles.some((p) => p.worker_id === w.id) ? " ✓" : ""}
          </button>
        ))}
      </div>
      {!id ? (
        <div className="hr-empty">
          Selecciona um colaborador para configurar o salário.
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLocalError("");
            try {
              await onSave(id, { ...p, deductionsMonth: month }, revision);
              setRevision(revision + 1);
              setDirty(false);
            } catch (e: any) {
              setLocalError(e.message);
            }
          }}
        >
          <div className="hr-grid-form">
            <label>
              Serviço / unidade
              <ServiceSelect
                value={p.department}
                onChange={(v) => set("department", v)}
              />
            </label>
            {[
              ["nif", "NIF"],
              ["inssNumber", "Número INSS"],
              ["basic", "Salário base AOA"],
              ["iban", "IBAN"],
              [
                "deductions",
                "Desconto interno anterior AOA (mês seleccionado)",
              ],
            ].map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  required={
                    k === "inssNumber"
                      ? p.payrollOptions.inssEnabled ||
                        p.payrollOptions.employerEnabled
                      : k === "nif"
                        ? p.payrollOptions.irtEnabled
                        : !["iban", "deductions"].includes(k)
                  }
                  type={["basic", "deductions"].includes(k) ? "number" : "text"}
                  min="0"
                  step="0.01"
                  value={p[k]}
                  onChange={(e) =>
                    set(
                      k,
                      ["basic", "deductions"].includes(k)
                        ? Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
              </label>
            ))}
            <label className="wide">
              Fundamento do desconto interno anterior
              <textarea
                value={p.deductionReason}
                onChange={(e) => set("deductionReason", e.target.value)}
              />
            </label>
          </div>
          <section className="hr-payroll-options">
            <h4>INSS e IRT — activar ou desactivar o cálculo</h4>
            <p className="hr-muted">
              Predefinições: INSS trabalhador 3% (reformado 8%); entidade 8%;
              IRT pela tabela de 2026. A alteração fica no perfil e na folha
              gerada. Desactivar o cálculo não constitui isenção legal.
            </p>
            <div className="hr-grid-form">
              {[
                ["inssEnabled", "employeeRate", "INSS do trabalhador"],
                [
                  "employerEnabled",
                  "employerRate",
                  "Contribuição INSS da entidade",
                ],
              ].map(([enabled, rate, label]) => (
                <div className="hr-option-card" key={enabled}>
                  <label className="hr-toggle">
                    <input
                      type="checkbox"
                      checked={p.payrollOptions[enabled]}
                      onChange={(e) =>
                        set("payrollOptions", {
                          ...p.payrollOptions,
                          [enabled]: e.target.checked,
                        })
                      }
                    />
                    {label}
                  </label>
                  <label>
                    Taxa predefinida / personalizada (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={!p.payrollOptions[enabled]}
                      value={p.payrollOptions[rate]}
                      onChange={(e) =>
                        set("payrollOptions", {
                          ...p.payrollOptions,
                          [rate]: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
              <div className="hr-option-card">
                <label className="hr-toggle">
                  <input
                    type="checkbox"
                    checked={p.payrollOptions.irtEnabled}
                    onChange={(e) =>
                      set("payrollOptions", {
                        ...p.payrollOptions,
                        irtEnabled: e.target.checked,
                      })
                    }
                  />
                  IRT do trabalhador
                </label>
                <label>
                  Cálculo
                  <select
                    disabled={!p.payrollOptions.irtEnabled}
                    value={p.payrollOptions.irtMode}
                    onChange={(e) =>
                      set("payrollOptions", {
                        ...p.payrollOptions,
                        irtMode: e.target.value,
                      })
                    }
                  >
                    <option value="table">
                      Tabela progressiva IRT 2026 (predefinido)
                    </option>
                    <option value="percent">
                      Percentagem personalizada sobre a base IRT
                    </option>
                  </select>
                </label>
                {p.payrollOptions.irtMode === "percent" && (
                  <label>
                    Percentagem personalizada (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={!p.payrollOptions.irtEnabled}
                      value={p.payrollOptions.irtRate}
                      onChange={(e) =>
                        set("payrollOptions", {
                          ...p.payrollOptions,
                          irtRate: Number(e.target.value),
                        })
                      }
                    />
                    <small>
                      Este modo não equivale à tabela progressiva oficial.
                    </small>
                  </label>
                )}
              </div>
              <label>
                Fundamento da desactivação / alteração de taxas
                <textarea
                  maxLength={1000}
                  value={p.payrollOptions.reason}
                  onChange={(e) =>
                    set("payrollOptions", {
                      ...p.payrollOptions,
                      reason: e.target.value,
                    })
                  }
                  placeholder="Enquadramento confirmado pelo responsável; autorização ou motivo aplicável"
                />
              </label>
            </div>
          </section>
          <section className="hr-payroll-options">
            <h4>Descontos internos</h4>
            <p className="hr-muted">
              Adiantamento, empréstimo, alimentação, falta ou outro desconto
              autorizado. Valor fixo ou percentagem sobre o salário base/bruto;
              aplicado após INSS e IRT, sem reduzir a base fiscal.
            </p>
            {(p.internalDeductions || []).map((d: any, i: number) => {
              const edit = (key: string, v: any) =>
                set(
                  "internalDeductions",
                  p.internalDeductions.map((x: any, j: number) =>
                    j === i ? { ...x, [key]: v } : x,
                  ),
                );
              return (
                <div className="hr-option-card" key={i}>
                  <div className="hr-grid-form">
                    <label>
                      Desconto
                      <input
                        required
                        maxLength={150}
                        value={d.label}
                        onChange={(e) => edit("label", e.target.value)}
                        placeholder="Ex.: Adiantamento"
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        value={d.mode}
                        onChange={(e) => edit("mode", e.target.value)}
                      >
                        <option value="fixed">Montante fixo AOA</option>
                        <option value="percent">Percentagem</option>
                      </select>
                    </label>
                    <label>
                      {d.mode === "percent"
                        ? "Percentagem (%)"
                        : "Montante AOA"}
                      <input
                        type="number"
                        min="0"
                        max={d.mode === "percent" ? 100 : undefined}
                        step="0.01"
                        required
                        value={d.value}
                        onChange={(e) => edit("value", Number(e.target.value))}
                      />
                    </label>
                    {d.mode === "percent" && (
                      <label>
                        Base
                        <select
                          value={d.basis}
                          onChange={(e) => edit("basis", e.target.value)}
                        >
                          <option value="basic">Salário base</option>
                          <option value="gross">Remuneração bruta</option>
                        </select>
                      </label>
                    )}
                    <label>
                      Período
                      <select
                        value={d.period}
                        onChange={(e) => edit("period", e.target.value)}
                      >
                        {!["recorrente", month].includes(d.period) && (
                          <option value={d.period}>{d.period}</option>
                        )}
                        <option value={month}>Apenas {month}</option>
                        <option value="recorrente">Mensal / recorrente</option>
                      </select>
                    </label>
                    <label>
                      Fundamento / autorização
                      <input
                        required
                        maxLength={500}
                        value={d.reason}
                        onChange={(e) => edit("reason", e.target.value)}
                      />
                    </label>
                    <label className="hr-toggle">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => edit("enabled", e.target.checked)}
                      />
                      Aplicar este desconto
                    </label>
                    <Button
                      secondary
                      onClick={() =>
                        set(
                          "internalDeductions",
                          p.internalDeductions.filter(
                            (_: any, j: number) => j !== i,
                          ),
                        )
                      }
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              secondary
              onClick={() =>
                set("internalDeductions", [
                  ...(p.internalDeductions || []),
                  {
                    label: "",
                    mode: "fixed",
                    basis: "basic",
                    value: 0,
                    period: month,
                    reason: "",
                    enabled: true,
                  },
                ])
              }
            >
              + Adicionar desconto interno
            </Button>
          </section>
          <h4 className="font-bold mt-6">Rubricas adicionais</h4>
          <div className="hr-controls mt-3">
            <Button secondary onClick={() => annual("ferias")}>
              Calcular subsídio de férias
            </Button>
            <Button secondary onClick={() => annual("natal")}>
              Calcular subsídio de Natal
            </Button>
          </div>
          <p className="hr-muted">
            Valores por período (confirma se são únicos ou mensais): subsídios,
            prémios ou horas extraordinárias aprovadas. Férias/Natal não são
            automaticamente isentos de IRT.
          </p>
          {p.allowances.map((a: any, i: number) => (
            <div className="hr-rubric" key={i}>
              <input
                placeholder="Designação / fundamento"
                required
                value={a.label}
                onChange={(e) =>
                  set(
                    "allowances",
                    p.allowances.map((r: any, j: number) =>
                      i === j ? { ...r, label: e.target.value } : r,
                    ),
                  )
                }
              />
              <input
                type="number"
                min="0"
                step=".01"
                required
                value={a.value}
                onChange={(e) =>
                  set(
                    "allowances",
                    p.allowances.map((r: any, j: number) =>
                      i === j ? { ...r, value: Number(e.target.value) } : r,
                    ),
                  )
                }
              />
              <label>
                Período
                <select
                  value={a.period || month}
                  onChange={(e) =>
                    set(
                      "allowances",
                      p.allowances.map((r: any, j: number) =>
                        i === j ? { ...r, period: e.target.value } : r,
                      ),
                    )
                  }
                >
                  <option value={month}>{month} (única vez)</option>
                  <option value="recorrente">Mensal recorrente</option>
                  {a.period &&
                    a.period !== "recorrente" &&
                    a.period !== month && (
                      <option value={a.period}>{a.period}</option>
                    )}
                </select>
              </label>
              {["inss", "irt"].map((k) => (
                <label className="hr-toggle" key={k}>
                  <input
                    type="checkbox"
                    checked={a[k]}
                    onChange={(e) =>
                      set(
                        "allowances",
                        p.allowances.map((r: any, j: number) =>
                          i === j ? { ...r, [k]: e.target.checked } : r,
                        ),
                      )
                    }
                  />
                  {k.toUpperCase()}
                </label>
              ))}
              <button
                type="button"
                onClick={() =>
                  set(
                    "allowances",
                    p.allowances.filter((_: any, j: number) => j !== i),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
          <Button
            secondary
            onClick={() =>
              set("allowances", [
                ...p.allowances,
                {
                  kind: "custom",
                  label: "",
                  value: 0,
                  inss: true,
                  irt: true,
                  period: month,
                },
              ])
            }
          >
            <Plus size={14} /> Adicionar rubrica
          </Button>
          <div className="hr-grid-form mt-5">
            <label className="hr-toggle wide">
              <input
                type="checkbox"
                checked={p.retired}
                onChange={(e) => set("retired", e.target.checked)}
              />{" "}
              Trabalhador reformado: aplicar taxa específica do trabalhador
            </label>
            <label className="wide">
              Enquadramento e fundamento das incidências
              <textarea
                required
                value={p.incidenceBasis}
                onChange={(e) => set("incidenceBasis", e.target.value)}
                placeholder="Regime geral / Grupo A; referência à revisão das rubricas, isenções, contrato e mês normal"
              />
            </label>
            <label className="hr-toggle wide">
              <input
                type="checkbox"
                checked={p.confirmed}
                onChange={(e) => set("confirmed", e.target.checked)}
              />{" "}
              Confirmei contrato, montantes, incidências e enquadramento do
              colaborador
            </label>
          </div>
          {preview && (
            <div className="hr-snapshot">
              Prévia: bruto <strong>{money(preview.gross)}</strong> · INSS
              trabalhador {money(preview.inssEmployee)} · INSS entidade{" "}
              {money(preview.inssEmployer)} · IRT {money(preview.irt)} ·
              descontos internos {money(preview.deductions)} · líquido{" "}
              <strong>{money(preview.net)} AOA</strong>
            </div>
          )}
          {localError && (
            <p role="alert" className="text-red-700 my-3">
              {localError}
            </p>
          )}
          <button className="hr-btn mt-4" disabled={busy} type="submit">
            <Save size={14} /> Guardar perfil salarial
          </button>
        </form>
      )}
    </div>
  );
}

function HRAccessPanel() {
  const [list, setList] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = () => request<any[]>("GET", "/access-admin").then(setList);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h3>Acessos das chefias de enfermagem</h3>
      <p className="hr-muted">
        A função continua Enfermeiro(a). Autorize separadamente as escalas e a
        folha salarial. A autorização salarial dá acesso às remunerações de
        todos os funcionários da instituição. A aprovação das folhas mantém-se
        reservada a outro administrador/gestor.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {list.map((w) => (
        <form
          className="hr-option-card"
          key={w.id + "|" + (w.revision || 0)}
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              await request("POST", "/access-admin", {
                workerId: w.id,
                revision: w.revision || 0,
                canSchedule: data.get("schedule") === "on",
                canPayroll: data.get("payroll") === "on",
                reason: String(data.get("reason") || ""),
              });
              await load();
              setMessage(
                "Autorizações guardadas. O utilizador pode actualizar a página.",
              );
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <strong>{w.nome}</strong>
          <p className="hr-muted">
            {w.position || w.category || w.funcao} ·{" "}
            {w.ativo ? "Activo" : "Inactivo"}
          </p>
          <label className="hr-toggle">
            <input
              type="checkbox"
              name="schedule"
              defaultChecked={w.can_schedule || false}
            />
            Criar, editar, publicar e exportar escalas da instituição
          </label>
          <label className="hr-toggle">
            <input
              type="checkbox"
              name="payroll"
              defaultChecked={w.can_payroll || false}
            />
            Consultar e preparar a folha salarial completa da instituição
          </label>
          <label>
            Fundamento da autorização ou revogação
            <textarea
              required
              name="reason"
              maxLength={1000}
              defaultValue={w.reason || ""}
            />
          </label>
          <button className="hr-btn" disabled={busy}>
            Guardar autorizações
          </button>
        </form>
      ))}
      {!list.length && (
        <p className="hr-empty">
          Cadastre a chefia em Administração → Funcionários, com função
          Enfermeiro(a) e o cargo profissional correspondente.
        </p>
      )}
    </div>
  );
}

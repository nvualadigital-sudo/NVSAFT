import { useState } from "react";
import {
  UsersRound,
  CalendarDays,
  BedDouble,
  Activity,
  FlaskConical,
  ClipboardList,
  UserPlus,
  Stethoscope,
  FileText,
  Pill,
  ArrowUpRight,
  Building2,
  RefreshCw,
  BellRing,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Session } from "../store/auth";
import { useApp } from "../store/AppContext";
import {
  Panel,
  Feedback,
  useResource,
  Empty,
  dateTime,
} from "../components/hospital/Workspace";
const palette = [
  "#2680ff",
  "#15b79e",
  "#a17aff",
  "#ffba4d",
  "#f56c8d",
  "#70a8be",
];
export default function Dashboard({
  session,
  onNav,
  allowed = [],
}: {
  session: Session;
  onNav?: (s: string) => void;
  allowed?: string[];
}) {
  const [days, setDays] = useState(7),
    { data } = useApp(),
    overview = useResource<any>("/overview?days=" + days, null),
    notifications = useResource<any>("/notifications", { items: [] }),
    v = overview.data;
  const quick = [
    { tab: "pacientes", label: "Novo paciente", icon: UserPlus },
    { tab: "agendamento", label: "Marcar consulta", icon: CalendarDays },
    { tab: "internamento", label: "Internamento", icon: BedDouble },
    { tab: "laboratorio", label: "Pedido de exame", icon: FlaskConical },
    { tab: "medico", label: "Atendimento clínico", icon: Stethoscope },
    { tab: "faturacao", label: "Emitir factura", icon: FileText },
    { tab: "farmacia", label: "Dispensa", icon: Pill },
    { tab: "biblioteca", label: "Documentos", icon: ClipboardList },
  ].filter((q) => allowed.includes(q.tab));
  const occupancy = v?.beds ? Math.round((v.admissions / v.beds) * 100) : 0;
  return (
    <div className="nv-dashboard nv-workspace">
      <section className="nv-hero">
        <div className="nv-brand-mark" aria-hidden="true">
          N
        </div>
        <div>
          <span className="nv-eyebrow">NV.DIGITAL · GESTÃO HOSPITALAR</span>
          <h1>
            {data.config.nomeClinica ||
              session.empresaNome ||
              "Centro de operações"}
          </h1>
          <p>Tecnologia que cuida. Saúde que avança.</p>
        </div>
        <div className="nv-hero-building" aria-hidden="true">
          <Building2 size={100} strokeWidth={0.8} />
          <span>+</span>
        </div>
        <div className="nv-hero-note">
          Mais controlo
          <br />
          Melhor atendimento
          <br />
          <strong>Mais vidas</strong>
        </div>
      </section>
      <Feedback error={overview.error || notifications.error} />
      {v ? (
        <>
          <div className="nv-kpi-grid">
            {[
              {
                label: "Pacientes registados",
                value: v.patientCount,
                sub: "Cadastro desta instituição",
                icon: UsersRound,
                tone: "blue",
              },
              {
                label: "Consultas hoje",
                value: v.consultationsToday,
                sub: `${v.openConsultations} consultas abertas`,
                icon: CalendarDays,
                tone: "green",
              },
              {
                label: "Internamentos activos",
                value: v.admissions,
                sub: "Admissões sem alta registada",
                icon: BedDouble,
                tone: "purple",
              },
              {
                label: "Aguardam atendimento",
                value: v.triageWaiting,
                sub: "Última triagem por paciente",
                icon: Activity,
                tone: "red",
              },
              {
                label: "Pedidos no período",
                value: v.series.reduce((s: number, x: any) => s + x.pedidos, 0),
                sub: `Últimos ${days} dias`,
                icon: ClipboardList,
                tone: "teal",
              },
              {
                label: "Resultados emitidos",
                value: v.resultCount,
                sub: "Histórico do laboratório",
                icon: FlaskConical,
                tone: "amber",
              },
            ].map(({ label, value, sub, icon: Icon, tone }) => (
              <article key={label} className={"nv-kpi nv-kpi-" + tone}>
                <div className="nv-kpi-icon">
                  <Icon size={25} />
                </div>
                <div>
                  <h2>{label}</h2>
                  <strong>{Number(value).toLocaleString("pt-AO")}</strong>
                  <p>{sub}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="nv-dashboard-top">
            <Panel
              title="Movimento assistencial"
              actions={
                <select
                  aria-label="Período do gráfico"
                  className="nv-compact-select"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
              }
            >
              <div className="nv-chart-legend">
                <span style={{ color: palette[0] }}>● Consultas</span>
                <span style={{ color: palette[1] }}>● Internamentos</span>
                <span style={{ color: palette[3] }}>● Pedidos de exame</span>
              </div>
              <div
                className="nv-area-chart"
                role="img"
                aria-label="Movimento diário de consultas, internamentos e pedidos laboratoriais"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={v.series}
                    margin={{ left: -28, right: 6, top: 12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="nvChartFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={palette[0]}
                          stopOpacity={0.34}
                        />
                        <stop
                          offset="100%"
                          stopColor={palette[0]}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--nv-line)"
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) =>
                        d.slice(8, 10) + "/" + d.slice(5, 7)
                      }
                      tick={{ fill: "var(--nv-muted)", fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "var(--nv-muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--nv-surface)",
                        border: "1px solid var(--nv-line)",
                        borderRadius: 10,
                        color: "var(--nv-text)",
                      }}
                    />
                    <Area
                      type="monotone"
                      name="Consultas"
                      dataKey="consultas"
                      stroke={palette[0]}
                      fill="url(#nvChartFill)"
                      strokeWidth={2.5}
                    />
                    <Area
                      type="monotone"
                      name="Internamentos"
                      dataKey="internamentos"
                      stroke={palette[1]}
                      fill="transparent"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      name="Pedidos de exame"
                      dataKey="pedidos"
                      stroke={palette[3]}
                      fill="transparent"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Atendimentos por especialidade">
              {v.specialties.length ? (
                <div className="nv-specialty-chart">
                  <div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={v.specialties}
                          innerRadius={52}
                          outerRadius={77}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {v.specialties.map((s: any, i: number) => (
                            <Cell
                              key={s.name}
                              fill={palette[i % palette.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "var(--nv-surface)",
                            color: "var(--nv-text)",
                            border: "1px solid var(--nv-line)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <span>
                      {v.specialties.reduce(
                        (s: number, x: any) => s + x.value,
                        0,
                      )}
                      <small>atendimentos</small>
                    </span>
                  </div>
                  <ul>
                    {v.specialties.map((s: any, i: number) => (
                      <li key={s.name}>
                        <i
                          style={{ background: palette[i % palette.length] }}
                        />
                        {s.name}
                        <strong>{s.value}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Empty>Sem consultas no período seleccionado.</Empty>
              )}
            </Panel>
            <Panel title="Acções rápidas">
              <div className="nv-quick-grid">
                {quick.slice(0, 6).map(({ tab, label, icon: Icon }) => (
                  <button key={tab} onClick={() => onNav?.(tab)}>
                    <Icon size={28} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
          <div className="nv-dashboard-bottom">
            <div className="nv-stack">
              <Panel
                title="Últimos atendimentos"
                actions={
                  allowed.includes("medico") ? (
                    <button
                      className="nv-link"
                      onClick={() => onNav?.("medico")}
                    >
                      Ver processo <ArrowUpRight size={13} />
                    </button>
                  ) : undefined
                }
              >
                <div className="nv-table-wrap">
                  <table className="nv-table">
                    <thead>
                      <tr>
                        <th>Paciente</th>
                        <th>Especialidade</th>
                        <th>Profissional</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.recent.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.patient}</strong>
                            <small>{dateTime(r.at)}</small>
                          </td>
                          <td>{r.specialty}</td>
                          <td>{r.doctor}</td>
                          <td>
                            <span className="nv-status">{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!v.recent.length && (
                  <Empty>Sem atendimentos visíveis para a sua função.</Empty>
                )}
              </Panel>
              <div className="nv-module-shortcuts">
                {quick.slice(-4).map(({ tab, label, icon: Icon }) => (
                  <button key={tab} onClick={() => onNav?.(tab)}>
                    <Icon size={25} />
                    <strong>{label}</strong>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div className="nv-stack">
              <Panel title="Leitos hospitalares">
                <div className="nv-bed-summary">
                  <div
                    className="nv-occupancy"
                    style={{
                      background: `conic-gradient(#13c5aa ${occupancy}%, var(--nv-line) 0)`,
                    }}
                  >
                    <div>
                      <strong>{occupancy}%</strong>
                      <span>ocupação</span>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>Total de leitos</dt>
                      <dd>{v.beds}</dd>
                    </div>
                    <div>
                      <dt>Ocupados</dt>
                      <dd>{v.admissions}</dd>
                    </div>
                    <div>
                      <dt>Disponíveis</dt>
                      <dd>
                        {Math.max(0, v.beds - v.admissions - v.blockedBeds)}
                      </dd>
                    </div>
                    <div>
                      <dt>Bloqueados</dt>
                      <dd>{v.blockedBeds}</dd>
                    </div>
                  </dl>
                </div>
                {v.wards.map((w: any, i: number) => (
                  <div className="nv-ward-row" key={w.name}>
                    <i style={{ background: palette[i % palette.length] }} />
                    <span>{w.name}</span>
                    <strong>
                      {w.occupied}/{w.total}
                    </strong>
                  </div>
                ))}
              </Panel>
              <Panel title="Agenda de hoje">
                {v.appointments.length ? (
                  v.appointments.map((a: any) => (
                    <div key={a.id} className="nv-agenda-row">
                      <time>
                        {new Date(a.when).toLocaleTimeString("pt-AO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      <strong>{a.service}</strong>
                      <span>{a.professional}</span>
                    </div>
                  ))
                ) : (
                  <Empty>Sem agendamentos visíveis hoje.</Empty>
                )}
              </Panel>
            </div>
            <Panel title="Alertas e tarefas" actions={<BellRing size={16} />}>
              {notifications.data.items.length ? (
                notifications.data.items.map((n: any) => (
                  <button
                    className="nv-alert-row"
                    key={n.id}
                    onClick={() => onNav?.(n.tab)}
                  >
                    <span
                      className={
                        n.priority === "alta" ? "nv-alert-critical" : ""
                      }
                    >
                      <Activity size={18} />
                    </span>
                    <div>
                      <strong>{n.title}</strong>
                      <small>
                        {n.priority === "alta"
                          ? "Requer comunicação e confirmação"
                          : "Responsabilidade atribuída à sua conta"}
                      </small>
                    </div>
                    <ArrowUpRight size={15} />
                  </button>
                ))
              ) : (
                <Empty>
                  Sem alertas ou tarefas pendentes nos registos consultados.
                </Empty>
              )}
            </Panel>
          </div>
          <footer className="nv-dashboard-footer">
            <span>
              Actualizado: {dateTime(v.updatedAt)}{" "}
              <button
                className="nv-link"
                onClick={() => {
                  void overview.load();
                  void notifications.load();
                }}
              >
                <RefreshCw size={12} />
                Actualizar
              </button>
            </span>
            <span title={v.source}>
              Origem dos indicadores: registos desta instituição
            </span>
          </footer>
        </>
      ) : (
        <Empty>A carregar os indicadores da instituição…</Empty>
      )}
    </div>
  );
}

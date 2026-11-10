import { reqDirect } from "../../store/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "../../store/auth";
import { useApp } from "../../store/AppContext";

interface Props {
  session?: Session;
  onNav?: (tab: string) => void;
}
type Status =
  | "aguardando"
  | "chamado"
  | "encaminhado"
  | "concluido"
  | "cancelado";
type Destination = "enfermagem" | "consulta" | "laboratorio";
interface Ticket {
  id: string;
  numero: number;
  pacienteId: string;
  pacienteNome: string;
  processo: string;
  destino: Destination;
  tipo: "normal" | "retorno" | "preferencial";
  estado: Status;
  chegadaEm: string;
  chamadoEm?: string;
  actualizadoEm: string;
  versao: number;
}
interface Patient {
  id: string;
  nome: string;
  processo: string;
  bi: string;
  telefone: string;
}
const STATES: Record<Status, { label: string; style: string }> = {
  aguardando: { label: "Aguardando", style: "bg-amber-100 text-amber-900" },
  chamado: { label: "Chamado", style: "bg-blue-100 text-blue-900" },
  encaminhado: { label: "Encaminhado", style: "bg-violet-100 text-violet-900" },
  concluido: {
    label: "Recepção concluída",
    style: "bg-emerald-100 text-emerald-900",
  },
  cancelado: { label: "Cancelado", style: "bg-slate-100 text-slate-700" },
};
const DESTINATIONS: Record<Destination, string> = {
  enfermagem: "Triagem / enfermagem",
  consulta: "Consulta médica",
  laboratorio: "Laboratório",
};
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600";
const secondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const primary =
  "rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40";
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function clock(value: string) {
  return new Intl.DateTimeFormat("pt-AO", {
    timeZone: "Africa/Luanda",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
const normalise = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
async function api<T>(
  path: string,
  options: RequestInit = {},
  _signal?: AbortSignal,
): Promise<T> {
  return reqDirect<T>(
    options.method || "GET",
    "/recepcao" + path,
    options.body ? JSON.parse(String(options.body)) : undefined,
  );
}

export default function Recepcao(props: Props) {
  return (
    <ReceptionWorkspace
      key={`${props.session?.empresaId || ""}:${props.session?.username || ""}`}
      {...props}
    />
  );
}
function ReceptionWorkspace({ session, onNav }: Props) {
  const app = useApp();
  const patients: Patient[] = useMemo(
    () =>
      app.data.pacientes.map((p) => ({
        id: String(p.id),
        nome: p.nome,
        processo: p.processo || "",
        bi: p.bi || "",
        telefone: p.telefone || "",
      })),
    [app.data.pacientes],
  );
  const [date, setDate] = useState(today),
    [search, setSearch] = useState(""),
    [patientSearch, setPatientSearch] = useState(""),
    [selected, setSelected] = useState("");
  const [destination, setDestination] = useState<Destination>("enfermagem"),
    [kind, setKind] = useState<Ticket["tipo"]>("normal");
  const [filter, setFilter] = useState<Status | "activos" | "todos">("activos"),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [updated, setUpdated] = useState("");
  const [action, setAction] = useState<{
      ticket: Ticket;
      estado: Status;
    } | null>(null),
    [reason, setReason] = useState("");
  const [tick, setTick] = useState(Date.now()),
    [page, setPage] = useState(1);
  const request = useRef(0),
    creating = useRef(false),
    currentDate = useRef(date),
    lastCreate = useRef<{ key: string; body: string } | null>(null);
  currentDate.current = date;
  const identified = Boolean(session?.empresaId && session?.username);
  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!identified) return;
      const generation = ++request.current;
      setLoading(true);
      try {
        const result = await api<{ items: Ticket[] }>(
          `?data=${date}`,
          {},
          signal,
        );
        if (generation !== request.current) return;
        if (!Array.isArray(result.items))
          throw new Error("Fila recebida em formato inválido.");
        setTickets(result.items);
        setLoaded(true);
        setUpdated(new Date().toISOString());
        setError("");
      } catch (e) {
        if (signal?.aborted || generation !== request.current) return;
        setError(e instanceof Error ? e.message : "Falha ao carregar a fila.");
      } finally {
        if (generation === request.current) setLoading(false);
      }
    },
    [date, identified],
  );
  useEffect(() => {
    setTickets([]);
    setLoaded(false);
    setUpdated("");
    setPage(1);
    const controller = new AbortController();
    void reload(controller.signal);
    const timer = window.setInterval(() => {
      if (!document.hidden && !creating.current) void reload(controller.signal);
    }, 30000);
    return () => {
      controller.abort();
      request.current++;
      window.clearInterval(timer);
    };
  }, [reload]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => setPage(1), [search, filter]);
  const selectedPatient = patients.find((p) => p.id === selected);
  const matches = useMemo(() => {
    const q = normalise(patientSearch);
    if (q.length < 2) return [];
    return patients
      .filter((p) =>
        normalise(`${p.nome} ${p.processo} ${p.bi} ${p.telefone}`).includes(q),
      )
      .slice(0, 20);
  }, [patients, patientSearch]);
  const rows = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (filter === "todos" ||
            (filter === "activos"
              ? ["aguardando", "chamado"].includes(t.estado)
              : t.estado === filter)) &&
          normalise(`${t.numero} ${t.pacienteNome} ${t.processo}`).includes(
            normalise(search),
          ),
      ),
    [tickets, filter, search],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  const shown = rows.slice(
    (Math.min(page, pageCount) - 1) * 20,
    Math.min(page, pageCount) * 20,
  );
  const stats = [
    { label: "Chegadas no dia", value: tickets.length },
    {
      label: "Aguardando",
      value: tickets.filter((t) => t.estado === "aguardando").length,
    },
    {
      label: "Chamados",
      value: tickets.filter((t) => t.estado === "chamado").length,
    },
    {
      label: "Encaminhados",
      value: tickets.filter((t) => t.estado === "encaminhado").length,
    },
  ];
  const navigate = (tab: string) => {
    if (onNav) onNav(tab);
    else
      setError(
        "A navegação ainda não foi ligada no App.tsx. Consulte as instruções de integração.",
      );
  };
  async function register() {
    if (creating.current || !selectedPatient) return;
    creating.current = true;
    setBusy("new");
    setError("");
    setNotice("");
    const body = JSON.stringify({
      pacienteId: selectedPatient.id,
      destino: destination,
      tipo: kind,
    });
    if (lastCreate.current?.body !== body)
      lastCreate.current = { body, key: crypto.randomUUID() };
    try {
      await api("", {
        method: "POST",
        body: JSON.stringify({
          ...JSON.parse(body),
          requestId: lastCreate.current.key,
        }),
      });
      lastCreate.current = null;
      setSelected("");
      setPatientSearch("");
      setNotice("Chegada registada e confirmada no servidor.");
      if (date === today()) await reload();
      else setDate(today());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chegada não confirmada.");
    } finally {
      creating.current = false;
      setBusy("");
    }
  }
  async function transition(ticket: Ticket, estado: Status, motivo = "") {
    if (creating.current) return;
    creating.current = true;
    const initiatedDate = date;
    setBusy(ticket.id);
    setError("");
    setNotice("");
    try {
      await api(`/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado, motivo, versao: ticket.versao }),
      });
      setAction(null);
      setReason("");
      setNotice("Alteração confirmada no servidor.");
      if (currentDate.current === initiatedDate) await reload();
    } catch (e) {
      if (currentDate.current === initiatedDate) await reload();
      setError(e instanceof Error ? e.message : "Alteração não confirmada.");
    } finally {
      creating.current = false;
      setBusy("");
    }
  }
  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
              Atendimento ao paciente
            </p>
            <h1 className="mt-1 text-2xl font-bold">Recepção</h1>
            <p className="mt-1 text-sm text-slate-600">
              Chegadas, chamadas e encaminhamentos numa única fila.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {session?.funcionarioNome ||
                session?.username ||
                "Sessão não identificada"}{" "}
              · Horários de Angola
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={secondary}
              disabled={!onNav}
              onClick={() => navigate("pacientes")}
            >
              Cadastrar paciente
            </button>
            <button
              className={secondary}
              disabled={!onNav}
              onClick={() => navigate("agendamento")}
            >
              Agendamento
            </button>
            <button
              className={primary}
              disabled={!onNav}
              onClick={() => navigate("faturacao")}
            >
              Facturação
            </button>
          </div>
        </header>
        {!identified && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          >
            Seleccione a instituição e entre com a sua conta para consultar a
            fila.
          </div>
        )}
        {!onNav && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            Os atalhos precisam de onNav no App.tsx. A página anterior também
            dependia dessa ligação.
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
          >
            <span>
              {error}{" "}
              {loaded
                ? "A lista pode estar desactualizada."
                : "A fila ainda não foi carregada."}
            </span>
            <button
              className={secondary}
              disabled={loading || !identified}
              onClick={() => void reload()}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900"
          >
            {notice}
          </p>
        )}
        <section
          aria-label="Resumo da fila"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-xs font-semibold text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {loaded ? s.value : "—"}
              </p>
            </div>
          ))}
        </section>
        <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">Registar chegada</h2>
            <p className="mt-1 text-xs text-slate-500">
              Utilize o cadastro existente para evitar duplicados.
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void register();
              }}
            >
              <label className="block text-sm font-medium">
                Pesquisar paciente
                <input
                  className={`${field} mt-1`}
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setSelected("");
                  }}
                  placeholder="Nome, processo, BI ou telefone"
                  autoComplete="off"
                />
              </label>
              {patientSearch.trim().length >= 2 && !selected && (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                  {matches.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="block w-full border-b border-slate-100 p-3 text-left hover:bg-teal-50"
                      onClick={() => {
                        setSelected(p.id);
                        setPatientSearch(p.nome);
                      }}
                    >
                      <span className="block text-sm font-semibold">
                        {p.nome}
                      </span>
                      <span className="text-xs text-slate-500">
                        Processo {p.processo || "não preenchido"}
                        {p.telefone ? ` · ${p.telefone}` : ""}
                      </span>
                    </button>
                  ))}
                  {!matches.length && (
                    <p className="p-3 text-xs text-slate-600">
                      Nenhum paciente encontrado. Consulte ou complete o
                      cadastro.
                    </p>
                  )}
                  {matches.length === 20 && (
                    <p className="p-2 text-xs text-slate-500">
                      Até 20 resultados; refine a pesquisa.
                    </p>
                  )}
                </div>
              )}
              {selectedPatient && (
                <div className="rounded-xl bg-teal-50 p-3 text-sm">
                  <strong>{selectedPatient.nome}</strong>
                  <p className="mt-1 text-xs text-teal-900">
                    Processo: {selectedPatient.processo || "não preenchido"}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold underline"
                    onClick={() => {
                      setSelected("");
                      setPatientSearch("");
                    }}
                  >
                    Trocar paciente
                  </button>
                </div>
              )}
              <label className="block text-sm font-medium">
                Destino
                <select
                  className={`${field} mt-1`}
                  value={destination}
                  onChange={(e) =>
                    setDestination(e.target.value as Destination)
                  }
                >
                  {Object.entries(DESTINATIONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Tipo de atendimento
                <select
                  className={`${field} mt-1`}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Ticket["tipo"])}
                >
                  <option value="normal">Normal</option>
                  <option value="retorno">Retorno</option>
                  <option value="preferencial">
                    Preferencial administrativo
                  </option>
                </select>
              </label>
              <p className="text-xs leading-relaxed text-slate-500">
                A prioridade clínica é definida pela enfermagem. Perante uma
                urgência, contacte imediatamente a equipa assistencial.
              </p>
              <button
                type="submit"
                className={`${primary} w-full`}
                disabled={
                  !identified ||
                  !selectedPatient ||
                  Boolean(busy) ||
                  !loaded ||
                  Boolean(error)
                }
              >
                {busy === "new" ? "A confirmar chegada…" : "Confirmar chegada"}
              </button>
            </form>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                className={secondary}
                disabled={!onNav}
                onClick={() => navigate("urgencia")}
              >
                Abrir urgência
              </button>
              <button
                className={`${secondary} ml-2`}
                disabled={!onNav}
                onClick={() => navigate("historico")}
              >
                Resultados
              </button>
            </div>
          </aside>
          <section
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
            aria-label="Fila de atendimento"
            aria-busy={loading}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <h2 className="font-bold">Fila de atendimento</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {updated
                    ? `Actualizada às ${clock(updated)}`
                    : "A aguardar ligação ao servidor"}{" "}
                  · actualização a cada 30 s
                </p>
              </div>
              <label className="text-xs font-semibold">
                Dia
                <input
                  type="date"
                  className={`${field} mt-1`}
                  value={date}
                  max={today()}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                />
              </label>
              <button
                className={secondary}
                disabled={loading || Boolean(busy) || !identified}
                onClick={() => void reload()}
              >
                {loading ? "A carregar…" : "Actualizar"}
              </button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="text-xs font-semibold">
                Procurar na fila
                <input
                  className={`${field} mt-1`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, processo ou senha"
                />
              </label>
              <label className="text-xs font-semibold">
                Estado
                <select
                  className={`${field} mt-1`}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                >
                  <option value="activos">Em espera / chamados</option>
                  <option value="todos">Todos os estados</option>
                  {Object.entries(STATES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Chegadas do dia seleccionado e respectivas acções
                  administrativas
                </caption>
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {[
                      "Paciente / senha",
                      "Destino",
                      "Chegada / espera",
                      "Estado",
                      "Acções",
                    ].map((t) => (
                      <th
                        scope="col"
                        className="px-4 py-3 font-semibold"
                        key={t}
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-4">
                        <span className="text-xs font-bold text-teal-700">
                          #{String(t.numero).padStart(3, "0")}
                        </span>
                        <p className="mt-1 font-semibold">{t.pacienteNome}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {t.processo || "Sem processo"}
                          {t.tipo !== "normal" ? ` · ${t.tipo}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {DESTINATIONS[t.destino]}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs">
                        {clock(t.chegadaEm)}
                        <p className="mt-1 text-slate-500">
                          {t.estado === "aguardando"
                            ? `${Math.max(0, Math.floor((tick - new Date(t.chegadaEm).getTime()) / 60000))} min em espera`
                            : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATES[t.estado].style}`}
                        >
                          {STATES[t.estado].label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-32 flex-wrap gap-2">
                          {t.estado === "aguardando" && (
                            <button
                              className={secondary}
                              disabled={Boolean(busy) || Boolean(error)}
                              onClick={() => void transition(t, "chamado")}
                            >
                              Chamar
                            </button>
                          )}
                          {["aguardando", "chamado"].includes(t.estado) && (
                            <>
                              <button
                                className={secondary}
                                disabled={Boolean(busy) || Boolean(error)}
                                onClick={() => {
                                  setReason("");
                                  setAction({
                                    ticket: t,
                                    estado: "encaminhado",
                                  });
                                }}
                              >
                                Encaminhar
                              </button>
                              <button
                                className="text-xs font-semibold text-red-700 underline disabled:opacity-40"
                                disabled={Boolean(busy) || Boolean(error)}
                                onClick={() => {
                                  setReason("");
                                  setAction({ ticket: t, estado: "cancelado" });
                                }}
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          {t.estado === "encaminhado" && (
                            <button
                              className={secondary}
                              disabled={Boolean(busy) || Boolean(error)}
                              onClick={() => {
                                setReason("");
                                setAction({ ticket: t, estado: "concluido" });
                              }}
                            >
                              Concluir recepção
                            </button>
                          )}
                          {["concluido", "cancelado"].includes(t.estado) && (
                            <span className="text-xs text-slate-400">
                              Registo fechado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loaded && (
              <p className="p-8 text-center text-sm text-slate-500">
                {loading
                  ? "A carregar a fila…"
                  : "Não foi possível obter a fila. Use Tentar novamente."}
              </p>
            )}
            {loaded && !rows.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                {tickets.length
                  ? "Nenhum atendimento corresponde aos filtros."
                  : "Ainda não há chegadas registadas neste dia."}
              </p>
            )}
            <footer className="flex items-center justify-between gap-2 border-t border-slate-100 p-4 text-xs text-slate-500">
              <span>
                {loaded
                  ? `${rows.length} atendimento(s) · página ${Math.min(page, pageCount)} de ${pageCount}`
                  : "Fila indisponível"}
              </span>
              <div className="flex gap-2">
                <button
                  className={secondary}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <button
                  className={secondary}
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Seguinte
                </button>
              </div>
            </footer>
          </section>
        </div>
        <p className="text-xs text-slate-500">
          Encaminhar regista o destino administrativo. Não substitui a triagem,
          a consulta nem a alta clínica.
        </p>
        {action && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="reception-dialog"
              className="w-full max-w-md rounded-2xl bg-white p-6"
              onKeyDown={(e) => {
                if (e.key === "Escape" && !busy) setAction(null);
                if (e.key === "Tab") {
                  const items = Array.from(
                    e.currentTarget.querySelectorAll<HTMLElement>(
                      "button:not(:disabled),textarea",
                    ),
                  );
                  const first = items[0],
                    last = items[items.length - 1];
                  if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                  } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                  }
                }
              }}
            >
              <h2 id="reception-dialog" className="text-lg font-bold">
                {action.estado === "cancelado"
                  ? "Cancelar chegada"
                  : action.estado === "concluido"
                    ? "Concluir a recepção"
                    : "Confirmar encaminhamento"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {action.ticket.pacienteNome} · #{action.ticket.numero}
              </p>
              <p className="mt-2 text-sm">
                {action.estado === "encaminhado"
                  ? `Destino: ${DESTINATIONS[action.ticket.destino]}. A equipa de destino deve consultar esta fila para receber o encaminhamento.`
                  : action.estado === "concluido"
                    ? "Encerra apenas o trabalho administrativo da recepção, sem dar alta ao paciente."
                    : "O registo e o motivo permanecem no histórico."}
              </p>
              {action.estado === "cancelado" && (
                <label className="mt-4 block text-sm font-medium">
                  Motivo obrigatório
                  <textarea
                    autoFocus
                    maxLength={500}
                    className={`${field} mt-1`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  autoFocus={action.estado !== "cancelado"}
                  className={secondary}
                  disabled={Boolean(busy)}
                  onClick={() => setAction(null)}
                >
                  Voltar
                </button>
                <button
                  className={primary}
                  disabled={
                    Boolean(busy) ||
                    (action.estado === "cancelado" && !reason.trim())
                  }
                  onClick={() =>
                    void transition(action.ticket, action.estado, reason)
                  }
                >
                  {busy ? "A confirmar…" : "Confirmar"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  INSURANCE_EXPORT_COLUMNS,
  type InsuranceContract,
  type InsuranceRate,
} from "@workspace/api-zod";
import { hospitalApi } from "../../store/hospital";
import { useApp } from "../../store/AppContext";
import { downloadFatura } from "../../modules/faturacao/utils/faturaGenerator";
import { billingRequest } from "../../modules/faturacao/store/AppContext";
import {
  EXPORT_LABELS,
  exportInsuranceTable,
  type ExportColumn,
} from "../../utils/insuranceExports";
const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm",
  button =
    "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50",
  primary = button + " bg-primary text-primary-foreground";
const movementNames: Record<string, string> = {
  invoice: "Facturação",
  payment: "Recebimento",
  credit: "Nota de crédito",
};
const movementLabel = (kind: string) => movementNames[kind] || kind;
const disputeNames: Record<string, string> = {
  open: "Em análise",
  contested: "Contestada",
  resolved: "Resolvida",
};
const disputeLabel = (status: string) => disputeNames[status] || status;
const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Luanda",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  currency = (n: number) =>
    Number(n || 0).toLocaleString("pt-AO", {
      style: "currency",
      currency: "AOA",
    });
const rateBlank = (): InsuranceRate => ({
  code: "",
  description: "",
  service: "",
  price: 0,
  coverage: 100,
  internalCost: null,
  maxCovered: null,
});
const contractBlank = (id: string): InsuranceContract => ({
  id: crypto.randomUUID(),
  insurerId: id,
  revision: 0,
  name: "",
  start: today(),
  end: "",
  active: true,
  requiresAuthorization: true,
  rates: [rateBlank()],
});
const filterBlank = () => ({
  environment: "production",
  from: today().slice(0, 7) + "-01",
  to: today(),
  insurerId: "",
  patientId: "",
  act: "",
  service: "",
  state: "",
});
type Props = {
  insurers: any[];
  session: { funcao?: string; empresaNome?: string };
};
export default function InsuranceFinance({ insurers, session }: Props) {
  const { data, reload } = useApp(),
    canManage = ["admin", "gestor", "financeiro"].includes(
      session.funcao || "",
    );
  const [tab, setTab] = useState("cobranca"),
    [filters, setFilters] = useState(filterBlank),
    [applied, setApplied] = useState(filterBlank),
    [report, setReport] = useState<any>(null),
    [contracts, setContracts] = useState<InsuranceContract[]>([]),
    [contract, setContract] = useState<InsuranceContract | null>(null),
    [templates, setTemplates] = useState<any[]>([]),
    [modelInsurer, setModelInsurer] = useState(insurers[0]?.id || ""),
    [modelName, setModelName] = useState(""),
    [modelColumns, setModelColumns] = useState<ExportColumn[]>([]),
    [modelRevision, setModelRevision] = useState(0),
    [useModel, setUseModel] = useState(false),
    [includeCosts, setIncludeCosts] = useState(false);
  const [partyType, setPartyType] = useState("insurer"),
    [partyId, setPartyId] = useState(""),
    [statement, setStatement] = useState<any>(null),
    [statementCriteria, setStatementCriteria] = useState<any>(null),
    [payment, setPayment] = useState<any>(null),
    [dispute, setDispute] = useState<any>(null),
    [lastReceipt, setLastReceipt] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function loadReports(criteria = applied) {
    const result = await hospitalApi(
      "GET",
      "/insurance/report?" + new URLSearchParams(criteria),
    );
    setReport(result);
    setApplied({ ...criteria });
  }
  async function loadSetup() {
    const [c, t] = await Promise.all([
      hospitalApi<InsuranceContract[]>("GET", "/insurance/contracts"),
      hospitalApi<any[]>("GET", "/insurance/templates"),
    ]);
    setContracts(c);
    setTemplates(t);
  }
  useEffect(() => {
    let live = true;
    void Promise.all([
      hospitalApi<any>(
        "GET",
        "/insurance/report?" + new URLSearchParams(applied),
      ),
      hospitalApi<InsuranceContract[]>("GET", "/insurance/contracts"),
      hospitalApi<any[]>("GET", "/insurance/templates"),
    ])
      .then(([r, c, t]) => {
        if (live) {
          setReport(r);
          setContracts(c);
          setTemplates(t);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const t = templates.find((t) => t.insurerId === modelInsurer);
    setModelName(t?.data.name || "Mapa da seguradora");
    setModelColumns(
      t?.data.columns ||
        INSURANCE_EXPORT_COLUMNS.map((key) => ({
          key,
          label: EXPORT_LABELS[key],
        })),
    );
    setModelRevision(t?.revision || 0);
  }, [modelInsurer, templates]);
  const pf = (key: keyof ReturnType<typeof filterBlank>, value: string) =>
    setFilters((s) => ({ ...s, [key]: value }));
  async function saveContract(e: FormEvent) {
    e.preventDefault();
    if (!contract) return;
    await run(async () => {
      await hospitalApi("POST", "/insurance/contracts", contract);
      setContract(null);
      await loadSetup();
      setMessage(
        "Contrato e tabela de actos guardados. Documentos anteriores conservam a sua versão.",
      );
    });
  }
  async function savePayment(e: FormEvent) {
    e.preventDefault();
    if (!payment) return;
    await run(async () => {
      const result = await billingRequest<any>(
        "POST",
        "/insurance/payments",
        payment,
      );
      setLastReceipt(result.receiptId);
      setPayment(null);
      await Promise.all([loadReports(), reload()]);
      if (statementCriteria)
        setStatement(
          await hospitalApi("POST", "/insurance/statement", statementCriteria),
        );
      setMessage(
        "Recebimento confirmado. Recibo " +
          result.receiptNumber +
          " de homologação emitido; conta corrente de ensaio e sessão de caixa actualizadas. A contabilidade real não foi alterada.",
      );
    });
  }
  async function saveDispute(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await hospitalApi("POST", "/insurance/disputes", dispute);
      setDispute(null);
      await loadReports();
      setMessage(
        "Glosa registada. O saldo só muda por recebimento ou nota de crédito.",
      );
    });
  }
  async function loadStatement() {
    await run(async () => {
      const criteria = {
        partyType,
        partyId,
        environment: filters.environment,
        from: filters.from,
        to: filters.to,
      };
      setStatement(await hospitalApi("POST", "/insurance/statement", criteria));
      setStatementCriteria(criteria);
    });
  }
  async function exportMap(
    format: "csv" | "xlsx" | "pdf",
    kind: "production" | "statement",
  ) {
    if (lock.current) return;
    const popup = format === "pdf" ? window.open("", "_blank") : null;
    await run(async () => {
      try {
        const criteria = kind === "statement" ? statementCriteria : applied;
        if (!criteria)
          throw new Error("Consulte o extracto antes de exportar.");
        const snapshot = await hospitalApi<any>("POST", "/insurance/export", {
          format,
          kind,
          filters: criteria,
        });
        let columns: ExportColumn[], rows: any[], notes: string[];
        if (kind === "statement") {
          rows = [
            {
              date: snapshot.from,
              reference: "Saldo anterior",
              balance: snapshot.opening,
            },
            ...snapshot.rows.map((row: any) => ({
              ...row,
              kind: movementLabel(row.kind),
            })),
          ];
          columns = [
            "date",
            "kind",
            "reference",
            "numero",
            "debit",
            "credit",
            "balance",
          ].map((key) => ({ key, label: EXPORT_LABELS[key] }));
          notes = [
            snapshot.party.name +
              " · " +
              (snapshot.party.type === "insurer" ? "Seguradora" : "Paciente"),
            "Período: " + snapshot.from + " a " + snapshot.to,
            "Saldo anterior: " +
              currency(snapshot.opening) +
              " · Saldo final a receber: " +
              currency(snapshot.closing),
            ...(snapshot.warnings || []),
          ];
        } else {
          const template = templates.find(
            (t) => t.insurerId === applied.insurerId,
          );
          if (useModel && !template)
            throw new Error(
              "Seleccione uma seguradora com modelo configurado.",
            );
          columns = useModel
            ? template.data.columns
            : INSURANCE_EXPORT_COLUMNS.map((key) => ({
                key,
                label: EXPORT_LABELS[key],
              }));
          if (includeCosts && canManage && !useModel)
            columns = [
              ...columns,
              { key: "custoInterno", label: EXPORT_LABELS.custoInterno },
              { key: "margem", label: EXPORT_LABELS.margem },
            ];
          rows = snapshot.acts;
          notes = [
            "Período: " + applied.from + " a " + applied.to,
            "Seguradora: " +
              (insurers.find((s) => s.id === applied.insurerId)?.nome ||
                "Todas") +
              " · Paciente: " +
              (data.pacientes.find((p) => String(p.id) === applied.patientId)
                ?.nome || "Todos"),
            "Acto: " +
              (applied.act || "Todos") +
              " · Serviço: " +
              (applied.service || "Todos") +
              " · Cobrança: " +
              (applied.state || "Todos os estados"),
            "Actos: " +
              rows.length +
              " · Facturado: " +
              currency(snapshot.summary.charged),
            useModel
              ? "Modelo: " + template.data.name
              : "Mapa de produção clínica e responsabilidades",
            includeCosts && !useModel
              ? "Uso interno — contém custos e margens"
              : "Valores facturados e contratados; não inclui custos internos.",
          ];
        }
        if (snapshot.environment === "homologacao") {
          rows = rows.map((r: any) => ({
            ...r,
            __scope: "HOMOLOGAÇÃO — SEM VALIDADE FISCAL",
          }));
          columns = [{ key: "__scope", label: "Âmbito" }, ...columns];
        }
        await exportInsuranceTable(
          format,
          rows,
          columns,
          "seguradoras-" + snapshot.environment + "-" + kind + "-" + today(),
          (session.empresaNome || data.config.nomeClinica || "Instituição") +
            " — " +
            (kind === "statement"
              ? "Extracto de conta corrente"
              : "Actos por seguradora"),
          [
            snapshot.environment === "homologacao"
              ? "HOMOLOGAÇÃO — SEM VALIDADE FISCAL — valores de ensaio"
              : "Arquivo financeiro real",
            ...notes,
          ],
          popup,
        );
      } catch (e) {
        popup?.close();
        throw e;
      }
    });
  }
  const summary = report?.summary;
  const filterBar = (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs">
          De
          <input
            className={field}
            type="date"
            value={filters.from}
            onChange={(e) => pf("from", e.target.value)}
          />
        </label>
        <label className="text-xs">
          Até
          <input
            className={field}
            type="date"
            value={filters.to}
            onChange={(e) => pf("to", e.target.value)}
          />
        </label>
        <label className="text-xs">
          Seguradora
          <select
            className={field}
            value={filters.insurerId}
            onChange={(e) => pf("insurerId", e.target.value)}
          >
            <option value="">Todas</option>
            {insurers.map((s) => (
              <option value={s.id} key={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Segurado / paciente
          <select
            className={field}
            value={filters.patientId}
            onChange={(e) => pf("patientId", e.target.value)}
          >
            <option value="">Todos</option>
            {data.pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.processo || p.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Acto / código
          <input
            className={field}
            value={filters.act}
            onChange={(e) => pf("act", e.target.value)}
          />
        </label>
        <label className="text-xs">
          Serviço
          <input
            className={field}
            value={filters.service}
            onChange={(e) => pf("service", e.target.value)}
          />
        </label>
        <label className="text-xs">
          Cobrança
          <select
            className={field}
            value={filters.state}
            onChange={(e) => pf("state", e.target.value)}
          >
            <option value="">Todos os estados</option>
            {["pendente", "parcial", "vencida", "liquidada"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          className={primary + " self-end"}
          onClick={() => void run(() => loadReports(filters))}
        >
          Aplicar filtros
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Os mapas usam os filtros aplicados e a data de realização dos actos. Os
        saldos incluem todos os movimentos dos documentos seleccionados.
        Facturas antigas sem vínculo conservado não são atribuídas
        automaticamente a uma seguradora.
      </p>
    </div>
  );
  const exportButtons = (kind: "production" | "statement") => (
    <div className="flex flex-wrap items-center gap-2">
      {(["xlsx", "pdf", "csv"] as const).map((format) => (
        <button
          type="button"
          key={format}
          disabled={busy || (kind === "statement" && !statementCriteria)}
          className={button}
          onClick={() => void exportMap(format, kind)}
        >
          Exportar {format.toUpperCase()}
        </button>
      ))}
    </div>
  );
  const printReceipt = (id: number) => {
    void downloadFatura(`<!--NVPRINT:${id}:a4-->`, "recibo");
  };
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-primary">
          Seguradoras — produção e conta corrente
        </h2>
        <p className="text-sm text-muted-foreground">
          Contratos, actos realizados, copagamentos, recebimentos parciais,
          glosas e extractos.
        </p>
      </div>
      <label className="block text-sm max-w-md">
        Âmbito dos mapas e extractos
        <select
          className={field}
          value={filters.environment}
          onChange={(e) => {
            const next = { ...filters, environment: e.target.value };
            setFilters(next);
            setStatement(null);
            setStatementCriteria(null);
            setPayment(null);
            void run(() => loadReports(next));
          }}
        >
          <option value="production">Arquivo financeiro real</option>
          <option value="homologacao">
            Homologação — documentos de ensaio
          </option>
        </select>
      </label>
      <p className="rounded border border-border p-3 text-sm" role="status">
        {applied.environment === "homologacao"
          ? "HOMOLOGAÇÃO — SEM VALIDADE FISCAL. Recebimentos exigem caixa aberta em Finanças → POS. Os ensaios ficam fora da contabilidade real."
          : "Consulta do arquivo financeiro real. A emissão e regularização fiscal de produção permanecem dependentes da activação fiscal do módulo integrado."}
      </p>
      <nav
        className="flex flex-wrap gap-2"
        aria-label="Gestão financeira de seguradoras"
      >
        {[
          ["cobranca", "Cobrança"],
          ["producao", "Actos e produção"],
          ["extrato", "Extractos"],
          ["contratos", "Contratos e preços"],
          ["modelos", "Modelos de exportação"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? primary : button}
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p
          role="alert"
          className="border border-red-200 bg-red-50 text-red-800 rounded p-3 text-sm"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="border border-green-200 bg-green-50 text-green-800 rounded p-3 text-sm"
        >
          {message}
        </p>
      )}
      {lastReceipt && (
        <button className={button} onClick={() => printReceipt(lastReceipt)}>
          Imprimir recibo do último recebimento
        </button>
      )}
      {["cobranca", "producao"].includes(tab) && (
        <>
          {filterBar}
          {summary && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ["Actos facturados", currency(summary.charged)],
                ["Responsabilidade da seguradora", currency(summary.insurer)],
                ["Recebido nos documentos", currency(summary.paid)],
                ["Saldo dos documentos", currency(summary.balance)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border border-border rounded-xl p-4 bg-card"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {tab === "cobranca" && (
        <div className="space-y-3">
          {!report ? (
            <p>A carregar cobrança…</p>
          ) : !report.claims.length ? (
            <p className="p-6 border border-border rounded-xl text-sm">
              Nenhuma factura de seguro neste período. Na facturação, seleccione
              o paciente e active o seguro do atendimento.
            </p>
          ) : (
            report.claims.map((c: any) => (
              <article
                className="border border-border bg-card rounded-xl p-4 space-y-3"
                key={c.invoiceId}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <strong>
                      {c.number} · {c.snapshot.patient.nome}
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      {c.snapshot.insurer.nome} · Cartão{" "}
                      {c.snapshot.beneficiary.cartao} · Actos em{" "}
                      {c.snapshot.serviceDate} · Vencimento {c.snapshot.dueDate}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {c.status} · {currency(c.balance)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[
                    ["insurer", "Seguradora", c.insurerBalance],
                    ["patient", "Paciente", c.patientBalance],
                  ].map(([type, label, amount]) => (
                    <div
                      key={type}
                      className="rounded border border-border p-3 text-sm"
                    >
                      <p>
                        {label}: <strong>{currency(Number(amount))}</strong>
                      </p>
                      <button
                        disabled={
                          busy ||
                          applied.environment !== "homologacao" ||
                          Number(amount) <= 0
                        }
                        className={button + " mt-2"}
                        onClick={() =>
                          setPayment({
                            requestId: crypto.randomUUID(),
                            invoiceId: c.invoiceId,
                            partyType: type,
                            amount: Number(amount),
                            date: today(),
                            method: "Transferência",
                            reference: "",
                          })
                        }
                      >
                        Registar recebimento
                      </button>
                    </div>
                  ))}
                  {canManage && (
                    <button
                      className={button + " self-start"}
                      onClick={() =>
                        setDispute({
                          id: crypto.randomUUID(),
                          invoiceId: c.invoiceId,
                          amount: Math.max(0, c.insurerBalance),
                          reason: "",
                          status: "open",
                          resolution: "",
                          creditInvoiceId: "",
                        })
                      }
                    >
                      Registar glosa / recusa
                    </button>
                  )}
                </div>
                {c.disputes.map((d: any) => (
                  <div
                    className="text-xs border-t pt-2 flex flex-wrap gap-2"
                    key={d.id}
                  >
                    <span>
                      Glosa {currency(d.amount)} · {disputeLabel(d.status)} ·{" "}
                      {d.reason}
                      {d.resolution ? " · " + d.resolution : ""}
                    </span>
                    {canManage && (
                      <button
                        className="underline"
                        onClick={() =>
                          setDispute({
                            ...d,
                            invoiceId: c.invoiceId,
                            amount: Number(d.amount),
                            creditInvoiceId: d.credit_invoice_id || "",
                          })
                        }
                      >
                        Rever glosa
                      </button>
                    )}
                  </div>
                ))}
              </article>
            ))
          )}
        </div>
      )}
      {tab === "producao" && (
        <>
          <div className="flex flex-wrap gap-4 items-center">
            {exportButtons("production")}
            <label className="text-xs flex gap-2">
              <input
                type="checkbox"
                checked={useModel}
                onChange={(e) => setUseModel(e.target.checked)}
              />
              Usar modelo da seguradora seleccionada
            </label>
            {canManage && (
              <label className="text-xs flex gap-2">
                <input
                  type="checkbox"
                  checked={includeCosts}
                  onChange={(e) => setIncludeCosts(e.target.checked)}
                />
                Incluir custos e margem no mapa interno
              </label>
            )}
          </div>
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted">
                <tr>
                  {[
                    "Data",
                    "Factura",
                    "Seguradora / paciente",
                    "Acto / serviço",
                    "Facturado",
                    "Seguradora",
                    "Paciente",
                    ...(includeCosts && canManage ? ["Custo", "Margem"] : []),
                  ].map((h) => (
                    <th className="p-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report?.acts.map((a: any, i: number) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3">{a.data}</td>
                    <td className="p-3">{a.factura}</td>
                    <td className="p-3">
                      {a.seguradora}
                      <br />
                      {a.paciente}
                    </td>
                    <td className="p-3">
                      {a.acto} · {a.descricao}
                      <br />
                      {a.servico} · {a.profissional}
                    </td>
                    <td className="p-3">{currency(a.facturado)}</td>
                    <td className="p-3">
                      {currency(a.responsabilidadeSeguradora)}
                    </td>
                    <td className="p-3">
                      {currency(a.responsabilidadePaciente)}
                    </td>
                    {includeCosts && canManage && (
                      <>
                        <td className="p-3">
                          {a.custoInterno === null
                            ? "Por apurar"
                            : currency(a.custoInterno)}
                        </td>
                        <td className="p-3">
                          {a.margem === null
                            ? "Por apurar"
                            : currency(a.margem)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "extrato" && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="text-xs">
              Conta
              <select
                className={field}
                value={partyType}
                onChange={(e) => {
                  setPartyType(e.target.value);
                  setPartyId("");
                  setStatement(null);
                  setStatementCriteria(null);
                }}
              >
                <option value="insurer">Seguradora</option>
                <option value="patient">Paciente / segurado</option>
              </select>
            </label>
            <label className="text-xs">
              Entidade
              <select
                className={field}
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {(partyType === "insurer" ? insurers : data.pacientes).map(
                  (p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-xs">
              De
              <input
                type="date"
                className={field}
                value={filters.from}
                onChange={(e) => pf("from", e.target.value)}
              />
            </label>
            <label className="text-xs">
              Até
              <input
                type="date"
                className={field}
                value={filters.to}
                onChange={(e) => pf("to", e.target.value)}
              />
            </label>
            <button
              className={primary + " self-end"}
              disabled={busy || !partyId}
              onClick={() => void loadStatement()}
            >
              Consultar extracto
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Conta a receber pela clínica. O extracto do paciente inclui facturas
            particulares e copagamentos associados ao seu ID; documentos sem
            paciente não são atribuídos pelo nome. O extracto inclui todos os
            actos da entidade no período; o saldo anterior inclui os movimentos
            anteriores. Saldo negativo representa crédito da entidade.
          </p>
          {statement && (
            <>
              {statement.warnings?.map((warning: string) => (
                <p className="text-sm text-amber-800" key={warning}>
                  {warning}
                </p>
              ))}
              <div className="flex flex-wrap justify-between gap-3">
                <strong>
                  {statement.party.name} · Saldo anterior{" "}
                  {currency(statement.opening)} · Saldo final{" "}
                  {currency(statement.closing)}
                </strong>
                {exportButtons("statement")}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border border-border">
                  <thead className="bg-muted">
                    <tr>
                      {[
                        "Data",
                        "Documento / movimento",
                        "Débito",
                        "Crédito",
                        "Saldo",
                      ].map((h) => (
                        <th className="p-3" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3">{statement.from}</td>
                      <td>Saldo anterior</td>
                      <td />
                      <td />
                      <td>{currency(statement.opening)}</td>
                    </tr>
                    {statement.rows.map((row: any) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="p-3">{row.date}</td>
                        <td className="p-3">
                          {row.reference} · {movementLabel(row.kind)} ·{" "}
                          {row.numero}
                          {row.details?.receiptId && (
                            <button
                              className="block underline text-xs"
                              onClick={() =>
                                printReceipt(row.details.receiptId)
                              }
                            >
                              Imprimir recibo
                            </button>
                          )}
                          {statement.environment === "homologacao" &&
                            statement.party.type === "patient" &&
                            row.kind === "invoice" &&
                            row.invoiceBalance > 0 && (
                              <button
                                className="block underline text-xs"
                                onClick={() =>
                                  setPayment({
                                    requestId: crypto.randomUUID(),
                                    invoiceId: row.invoice_id,
                                    partyType: "patient",
                                    amount: row.invoiceBalance,
                                    date: today(),
                                    method: "Transferência",
                                    reference: "",
                                  })
                                }
                              >
                                Registar recebimento do paciente
                              </button>
                            )}
                        </td>
                        <td className="p-3">{currency(row.debit)}</td>
                        <td className="p-3">{currency(row.credit)}</td>
                        <td className="p-3 font-semibold">
                          {currency(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      {tab === "contratos" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O preço contratado define o valor facturado. O custo interno permite
            apurar margem e é reservado à gestão financeira. Limite por unidade
            e exclusões (cobertura 0%) são aplicados por acto.
          </p>
          {canManage && (
            <button
              className={primary}
              disabled={!insurers.length}
              onClick={() => setContract(contractBlank(insurers[0]?.id))}
            >
              Novo contrato / tabela
            </button>
          )}
          {contracts.map((c) => (
            <div
              className="border border-border rounded-xl p-4 flex flex-wrap justify-between gap-3"
              key={c.id}
            >
              <div>
                <strong>{c.name}</strong>
                <p className="text-xs">
                  {insurers.find((s) => s.id === c.insurerId)?.nome} · {c.start}{" "}
                  a {c.end} · {c.rates.length} actos ·{" "}
                  {c.active ? "Activo" : "Inactivo"} · versão {c.revision}
                </p>
              </div>
              {canManage && (
                <button
                  className={button}
                  onClick={() => setContract(structuredClone(c))}
                >
                  Editar contrato
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "modelos" && (
        <form
          className="space-y-4 border border-border rounded-xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await hospitalApi("POST", "/insurance/templates", {
                insurerId: modelInsurer,
                revision: modelRevision,
                data: { name: modelName, columns: modelColumns },
              });
              await loadSetup();
              setMessage(
                "Modelo de colunas guardado. Confirme com a seguradora o formato que aceita.",
              );
            });
          }}
        >
          <p className="text-sm">
            Configure os nomes e a ordem das colunas exigidas pela seguradora.
            Não existe um formato universal: confirme a especificação da
            entidade antes de enviar o ficheiro.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs">
              Seguradora
              <select
                className={field}
                value={modelInsurer}
                onChange={(e) => setModelInsurer(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {insurers.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Nome do modelo
              <input
                className={field}
                required
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={!canManage}
              />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {INSURANCE_EXPORT_COLUMNS.map((key) => (
              <label key={key} className="flex gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={modelColumns.some((c) => c.key === key)}
                  disabled={!canManage}
                  onChange={(e) =>
                    setModelColumns((s) =>
                      e.target.checked
                        ? [...s, { key, label: EXPORT_LABELS[key] }]
                        : s.filter((c) => c.key !== key),
                    )
                  }
                />
                {EXPORT_LABELS[key]}
              </label>
            ))}
          </div>
          {modelColumns.map((c, i) => (
            <div className="flex gap-2 items-center" key={c.key}>
              <span className="text-xs w-40">
                {i + 1}. {EXPORT_LABELS[c.key]}
              </span>
              <input
                className={field}
                value={c.label}
                required
                disabled={!canManage}
                onChange={(e) =>
                  setModelColumns((s) =>
                    s.map((x) =>
                      x.key === c.key ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className={button}
                disabled={!canManage || i === 0}
                onClick={() =>
                  setModelColumns((s) => {
                    const a = [...s];
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    return a;
                  })
                }
              >
                ↑
              </button>
            </div>
          ))}
          <button
            className={primary}
            disabled={
              busy || !canManage || !modelInsurer || !modelColumns.length
            }
          >
            Guardar modelo
          </button>
        </form>
      )}
      {contract && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Contrato da seguradora"
          className="fixed inset-0 z-[100] bg-black/50 p-4 overflow-y-auto"
        >
          <form
            onSubmit={(e) => void saveContract(e)}
            className="max-w-6xl mx-auto bg-card border border-border rounded-2xl p-5 space-y-4"
          >
            <h3 className="font-bold">Contrato e tabela de actos</h3>
            {error && (
              <p role="alert" className="text-red-700 text-sm">
                {error}
              </p>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="text-xs">
                Seguradora
                <select
                  required
                  className={field}
                  value={contract.insurerId}
                  onChange={(e) =>
                    setContract({ ...contract, insurerId: e.target.value })
                  }
                >
                  {insurers.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Contrato
                <input
                  required
                  className={field}
                  value={contract.name}
                  onChange={(e) =>
                    setContract({ ...contract, name: e.target.value })
                  }
                />
              </label>
              <label className="text-xs">
                Início
                <input
                  required
                  type="date"
                  className={field}
                  value={contract.start}
                  onChange={(e) =>
                    setContract({ ...contract, start: e.target.value })
                  }
                />
              </label>
              <label className="text-xs">
                Fim
                <input
                  required
                  type="date"
                  className={field}
                  value={contract.end}
                  onChange={(e) =>
                    setContract({ ...contract, end: e.target.value })
                  }
                />
              </label>
              <label className="text-xs flex gap-2">
                <input
                  type="checkbox"
                  checked={contract.active}
                  onChange={(e) =>
                    setContract({ ...contract, active: e.target.checked })
                  }
                />
                Activo
              </label>
              <label className="text-xs flex gap-2">
                <input
                  type="checkbox"
                  checked={contract.requiresAuthorization}
                  onChange={(e) =>
                    setContract({
                      ...contract,
                      requiresAuthorization: e.target.checked,
                    })
                  }
                />
                Exige autorização
              </label>
            </div>
            {contract.rates.map((r, index) => (
              <fieldset
                key={index}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <legend className="text-xs font-bold">Acto {index + 1}</legend>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    ["code", "Código"],
                    ["description", "Descrição"],
                    ["service", "Serviço"],
                    ["price", "Preço contratado (Kz)"],
                    ["coverage", "Cobertura (%)"],
                    [
                      "internalCost",
                      "Custo interno unitário sem IVA (opcional)",
                    ],
                    ["maxCovered", "Limite coberto por unidade (opcional)"],
                  ].map(([key, label]) => (
                    <label key={key} className="text-xs">
                      {label}
                      <input
                        required={!["internalCost", "maxCovered"].includes(key)}
                        type={
                          [
                            "price",
                            "coverage",
                            "internalCost",
                            "maxCovered",
                          ].includes(key)
                            ? "number"
                            : "text"
                        }
                        min="0"
                        max={key === "coverage" ? 100 : undefined}
                        step="0.01"
                        className={field}
                        value={(r as any)[key] ?? ""}
                        onChange={(e) =>
                          setContract({
                            ...contract,
                            rates: contract.rates.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    [key]: [
                                      "price",
                                      "coverage",
                                      "internalCost",
                                      "maxCovered",
                                    ].includes(key)
                                      ? e.target.value === ""
                                        ? null
                                        : Number(e.target.value)
                                      : e.target.value,
                                  }
                                : row,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className={button}
                  disabled={contract.rates.length === 1}
                  onClick={() =>
                    setContract({
                      ...contract,
                      rates: contract.rates.filter((_, i) => i !== index),
                    })
                  }
                >
                  Retirar acto
                </button>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() =>
                  setContract({
                    ...contract,
                    rates: [...contract.rates, rateBlank()],
                  })
                }
              >
                Adicionar acto
              </button>
              <button className={primary} disabled={busy}>
                Guardar contrato
              </button>
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => setContract(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
      {payment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registar recebimento"
          className="fixed inset-0 z-[110] bg-black/50 p-4 overflow-y-auto"
        >
          <form
            onSubmit={(e) => void savePayment(e)}
            className="max-w-lg mx-auto bg-card rounded-2xl p-6 space-y-4"
          >
            {error && (
              <p role="alert" className="text-red-700 text-sm">
                {error}
              </p>
            )}
            <h3 className="font-bold">
              Recebimento da{" "}
              {payment.partyType === "insurer"
                ? "seguradora"
                : "parcela do paciente"}
            </h3>
            {[
              ["amount", "Valor (Kz)", "number"],
              ["date", "Data do recebimento", "date"],
              ["method", "Forma de pagamento", "text"],
              ["reference", "Referência bancária / comprovativo", "text"],
            ].map(([key, label, type]) => (
              <label key={key} className="block text-sm">
                {label}
                {key === "method" ? (
                  <select
                    className={field}
                    value={payment.method}
                    onChange={(e) =>
                      setPayment({ ...payment, method: e.target.value })
                    }
                  >
                    {[
                      "Numerário",
                      "Multicaixa (TPA)",
                      "Transferência",
                      "Cartão",
                      "Cheque",
                    ].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={
                      key !== "reference" || payment.method !== "Numerário"
                    }
                    readOnly={key === "date"}
                    type={type}
                    min={type === "number" ? 0.01 : undefined}
                    step="0.01"
                    max={type === "date" ? today() : undefined}
                    className={field}
                    value={payment[key]}
                    onChange={(e) =>
                      setPayment({
                        ...payment,
                        [key]:
                          type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                )}
              </label>
            ))}
            <p className="text-xs">
              Será emitido um recibo de homologação. A sessão de caixa deve
              estar aberta; o numerário entra uma única vez na sessão de ensaio.
              Pagamentos bancários exigem referência. O valor não pode exceder o
              saldo deste pagador.
            </p>
            <button className={primary} disabled={busy}>
              Confirmar recebimento
            </button>{" "}
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => setPayment(null)}
            >
              Cancelar
            </button>
          </form>
        </div>
      )}
      {dispute && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Glosa da seguradora"
          className="fixed inset-0 z-[110] bg-black/50 p-4 overflow-y-auto"
        >
          <form
            onSubmit={(e) => void saveDispute(e)}
            className="max-w-lg mx-auto bg-card rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-bold">Glosa / recusa de cobertura</h3>
            {error && (
              <p role="alert" className="text-red-700 text-sm">
                {error}
              </p>
            )}
            <label className="block text-xs">
              Valor recusado
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                className={field}
                value={dispute.amount}
                onChange={(e) =>
                  setDispute({ ...dispute, amount: Number(e.target.value) })
                }
              />
            </label>
            <label className="block text-xs">
              Motivo
              <textarea
                required
                className={field}
                value={dispute.reason}
                onChange={(e) =>
                  setDispute({ ...dispute, reason: e.target.value })
                }
              />
            </label>
            <label className="block text-xs">
              Situação
              <select
                className={field}
                value={dispute.status}
                onChange={(e) =>
                  setDispute({ ...dispute, status: e.target.value })
                }
              >
                <option value="open">Em análise</option>
                <option value="contested">Contestada</option>
                <option value="resolved">Resolvida</option>
              </select>
            </label>
            <label className="block text-xs">
              Resolução / seguimento
              <textarea
                className={field}
                required={dispute.status === "resolved"}
                value={dispute.resolution}
                onChange={(e) =>
                  setDispute({ ...dispute, resolution: e.target.value })
                }
              />
            </label>
            <label className="block text-xs">
              Nota de crédito, quando exista
              <select
                className={field}
                value={dispute.creditInvoiceId || ""}
                onChange={(e) =>
                  setDispute({ ...dispute, creditInvoiceId: e.target.value })
                }
              >
                <option value="">Sem nota de crédito</option>
                {data.faturas
                  .filter(
                    (f) =>
                      f.tipoDocumento === "nota-credito" &&
                      f.observacoes.includes(
                        "[ORIGEM:" + dispute.invoiceId + "]",
                      ),
                  )
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.numero}
                    </option>
                  ))}
              </select>
            </label>
            <p className="text-xs">
              Registar ou resolver uma glosa conserva a dívida. Uma redução
              financeira exige emitir e associar a nota de crédito na
              facturação.
            </p>
            <button className={primary} disabled={busy}>
              Guardar glosa
            </button>{" "}
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => setDispute(null)}
            >
              Cancelar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

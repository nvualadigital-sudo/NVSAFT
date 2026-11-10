import { agtQrExamplePng, agtQrPreflight } from "../utils/agtQr";
import React, { useCallback, useEffect, useState } from "react";
import JSZip from "jszip";
import { billingRequest, command, useApp } from "../store/AppContext";
const labels: Record<string, string> = {
  nao_preparado: "Por preparar",
  substituida: "Substituída em homologação",
  preparado: "Preparado; não enviado",
  a_enviar: "Envio em curso",
  envio_incerto: "Envio sem confirmação",
  recebido: "Recebido; aguarda validação",
  processando: "Em processamento",
  validado: "Validado em homologação",
  parcial: "Parte dos documentos rejeitada",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
  respondido: "Serviço respondeu",
};
const serviceLabels: Record<string, string> = {
  registarFactura: "Registo de facturas",
  solicitarSerie: "Pedido de série",
  obterEstado: "Consulta de estado",
  consultarFactura: "Consulta de factura",
  listarSeries: "Lista de séries",
  listarFacturas: "Lista de facturas",
  validarDocumento: "Confirmação do adquirente",
};
const types = [
  ["FT", "Factura"],
  ["FR", "Factura-recibo"],
  ["FG", "Factura global"],
  ["NC", "Nota de crédito"],
  ["RG", "Recibo"],
];
const operationTypes = [
  ["SS", "Serviços de saúde"],
  ["SG", "Serviços gerais"],
  ["TB", "Transmissão de bens"],
  ["SE", "Educação"],
  ["STP", "Transporte de passageiros"],
  ["SR", "Royalties"],
  ["SIF", "Intermediação financeira/seguradora"],
  ["SHS", "Hotelaria e similares"],
  ["ST", "Telecomunicações"],
  ["AS", "Arrendamento e subarrendamento"],
  ["QT", "Quotas"],
  ["RD", "Repasse de despesas"],
];
const field = "border rounded px-3 py-2 bg-white text-slate-900 w-full",
  btn =
    "rounded px-4 py-2 border bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed",
  primary = btn + " !bg-blue-700 !text-white !border-blue-700";
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function AgtHomologacao() {
  const { currentUser, produtos, kits, faturas, refresh } = useApp();
  const [data, setData] = useState<any>(null),
    [profile, setProfile] = useState<any>(null),
    [tab, setTab] = useState("perfil"),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [ids, setIds] = useState<number[]>([]),
    [clock, setClock] = useState(Date.now());
  const [correction, setCorrection] = useState<{
    invoiceId: number;
    customerName: string;
    customerNif: string;
    customerAddress: string;
    reason: string;
  } | null>(null);
  const [type, setType] = useState("FT"),
    [year, setYear] = useState(new Date().getFullYear()),
    [establishment, setEstablishment] = useState("1"),
    [number, setNumber] = useState(""),
    [start, setStart] = useState(new Date().toISOString().slice(0, 7) + "-01"),
    [end, setEnd] = useState(new Date().toISOString().slice(0, 10)),
    [newCode, setNewCode] = useState(""),
    [validationAction, setValidationAction] = useState("C"),
    [deductAllVAT, setDeductAllVAT] = useState("ND"),
    [deductLines, setDeductLines] = useState([
      { lineNo: 1, deductLineVAT: "S", applyProRata: "N" },
    ]);
  const load = useCallback(async (reset = false) => {
    const d = await billingRequest<any>("GET", "/agt/status");
    setData(d);
    if (reset) setProfile(d.profile);
  }, []);
  useEffect(() => {
    load(true).catch((e) => {
      setMessage(e.message);
      setError(true);
    });
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [load]);
  async function run(fn: () => Promise<any>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await fn();
      await load();
      setError(false);
      setMessage(result?.warning || success);
      return result;
    } catch (e: any) {
      setError(true);
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function documentCommand(path: string, body?: any) {
    const result = await command(path, body);
    await refresh();
    return result;
  }
  const service = (operation: string, input: any = {}) =>
    run(
      () => command("/agt/service", { operation, input }),
      "Pedido preparado. Reveja-o na lista antes de enviar para homologação.",
    );
  async function evidence(id: string) {
    return run(async () => {
      const j = await billingRequest<any>("GET", "/agt/jobs/" + id);
      download(
        new Blob([JSON.stringify(j, null, 2)], { type: "application/json" }),
        "AGT_HML_" + id + ".json",
      );
    }, "Pedido e resposta descarregados.");
  }
  const codes = Array.from(
    new Set(
      [
        ...produtos.map((p) => p.codigo),
        ...kits.map((k) => k.codigo),
        ...Object.keys(profile?.taxRules || {}),
      ].filter(Boolean),
    ),
  ).sort();
  const rule = (code: string, key: string, value: string) =>
    setProfile((old: any) => ({
      ...old,
      taxRules: {
        ...old.taxRules,
        [code]: { ...old.taxRules[code], [key]: value },
      },
    }));
  const candidates = faturas.filter(
    (f) =>
      f.estado !== "rascunho" &&
      f.tipoDocumento !== "pro-forma" &&
      f.agtMode === "homologacao_oficial",
  );
  const selected =
    ids.length === 1 ? candidates.find((f) => f.id === ids[0]) : undefined;
  const source =
    correction && candidates.find((f) => f.id === correction.invoiceId);
  if (currentUser.role !== "admin")
    return <p className="p-5">Área reservada à gestão da própria empresa.</p>;
  return (
    <section className="p-5 space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-semibold">
          AGT — preparação e homologação
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Facturação electrónica 2.0 e SAF-T(AO). Produção fiscal bloqueada. Os
          ensaios não têm validade fiscal.
        </p>
      </div>
      <div className="border border-amber-300 bg-amber-50 rounded p-3 text-sm">
        A aceitação de um pedido não é a validação das facturas. A certificação
        do software e as credenciais são atribuídas pela AGT. Não introduza
        números ou isenções fictícias.
      </div>
      <p
        role={error ? "alert" : "status"}
        className={error ? "text-red-700" : "text-slate-700"}
      >
        {message}
      </p>
      {!data || !profile ? (
        <p>A carregar a configuração da empresa…</p>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            {[
              [
                "Produtor",
                data.runtime.producerConfigured
                  ? "Configurado"
                  : "Por configurar",
              ],
              [
                "Registo do software",
                data.runtime.certificateConfigured
                  ? "Indicado; confirmar com AGT"
                  : "Por atribuir/indicar",
              ],
              [
                "Contribuinte",
                data.runtime.issuerConfigured
                  ? "Credenciais locais configuradas"
                  : "Por configurar",
              ],
              [
                "Envio HML",
                data.runtime.hmlEnabled ? "Ligado; envio manual" : "Desligado",
              ],
            ].map(([label, value]) => (
              <div className="bg-white border rounded p-3" key={label}>
                <strong>{label}</strong>
                <p>{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-b pb-3">
            {[
              ["perfil", "Perfil fiscal"],
              ["series", "Pedidos e séries"],
              ["documentos", "Documentos"],
              ["exportar", "SAF-T e dossier"],
            ].map(([key, label]) => (
              <button
                className={tab === key ? primary : btn}
                onClick={() => setTab(key)}
                key={key}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "perfil" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await command("/agt/profile", {
                    revision: data.revision,
                    profile,
                  });
                  await refresh();
                  await load(true);
                }, "Perfil confirmado no servidor.");
              }}
            >
              <h3 className="font-semibold">
                {data.company.name || "Configure o nome da instituição"} · NIF{" "}
                {data.company.nif || "em falta"}
              </h3>
              <p className="text-xs text-slate-600">
                Identificador da empresa para a configuração local:{" "}
                <code className="select-all">{data.companyId}</code>
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  ["companyId", "Matrícula / registo comercial"],
                  ["address", "Morada fiscal"],
                  ["city", "Município / cidade"],
                  ["postalCode", "Código postal, quando aplicável"],
                ].map(([k, label]) => (
                  <label key={k} className="text-sm">
                    {label}
                    <input
                      className={field}
                      value={profile[k] || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, [k]: e.target.value })
                      }
                      maxLength={200}
                    />
                  </label>
                ))}
              </div>
              <h3 className="font-semibold">Enquadramento por artigo</h3>
              <p className="text-sm text-slate-600">
                Seleccione a operação e o imposto aplicáveis. Uma prestação de
                saúde não é automaticamente isenta. O fundamento legal deve ser
                confirmado pela instituição.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th className="p-2">Código / artigo</th>
                      <th>Operação</th>
                      <th>Tipo</th>
                      <th>IVA</th>
                      <th>Isenção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((code) => {
                      const r = profile.taxRules[code] || {};
                      const name =
                        produtos.find((p) => p.codigo === code)?.nome ||
                        kits.find((k) => k.codigo === code)?.nome;
                      return (
                        <tr key={code} className="border-t align-top">
                          <td className="p-2">
                            {code}
                            <small className="block text-slate-500">
                              {name || "Artigo de documento anterior"}
                            </small>
                          </td>
                          <td className="p-1">
                            <select
                              aria-label={"Operação " + code}
                              className={field}
                              value={r.operationType || ""}
                              onChange={(e) =>
                                rule(code, "operationType", e.target.value)
                              }
                            >
                              <option value="">Escolher</option>
                              {operationTypes.map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1">
                            <select
                              aria-label={"Tipo " + code}
                              className={field}
                              value={r.productType || ""}
                              onChange={(e) =>
                                rule(code, "productType", e.target.value)
                              }
                            >
                              <option value="">Escolher</option>
                              <option value="S">Serviço</option>
                              <option value="P">Produto</option>
                              <option value="O">Outro</option>
                            </select>
                          </td>
                          <td className="p-1">
                            <select
                              aria-label={"Imposto " + code}
                              className={field}
                              value={r.taxCode || ""}
                              onChange={(e) =>
                                rule(code, "taxCode", e.target.value)
                              }
                            >
                              <option value="">Escolher</option>
                              {[
                                ["NOR", "Normal"],
                                ["INT", "Intermédio"],
                                ["RED", "Reduzido"],
                                ["ISE", "Isento"],
                                ["OUT", "Outro"],
                              ].map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1 min-w-[220px]">
                            {r.taxCode === "ISE" && (
                              <>
                                <input
                                  aria-label={"Código de isenção " + code}
                                  className={field}
                                  maxLength={3}
                                  placeholder="Código de isenção"
                                  value={r.exemptionCode || ""}
                                  onChange={(e) =>
                                    rule(code, "exemptionCode", e.target.value)
                                  }
                                />
                                <input
                                  aria-label={"Fundamento legal " + code}
                                  className={field + " mt-1"}
                                  maxLength={60}
                                  placeholder="Fundamento legal"
                                  value={r.exemptionReason || ""}
                                  onChange={(e) =>
                                    rule(
                                      code,
                                      "exemptionReason",
                                      e.target.value,
                                    )
                                  }
                                />
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <input
                  aria-label="Adicionar código de artigo"
                  placeholder="Código de artigo em falta"
                  className={field + " max-w-xs"}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                />
                <button
                  type="button"
                  className={btn}
                  onClick={() => {
                    if (newCode.trim()) {
                      rule(newCode.trim(), "operationType", "");
                      setNewCode("");
                    }
                  }}
                >
                  Acrescentar
                </button>
              </div>
              <h3 className="font-semibold">
                Séries confirmadas para emissão em homologação
              </h3>
              <div className="grid md:grid-cols-3 gap-3">
                {types.map(([type, label]) => (
                  <label className="text-sm" key={type}>
                    {label}
                    <select
                      className={field}
                      aria-label={"Série " + label}
                      value={profile.series[type] || ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          series: Object.fromEntries(
                            Object.entries({
                              ...profile.series,
                              [type]: e.target.value,
                            }).filter(([, value]) => value),
                          ),
                        })
                      }
                    >
                      <option value="">Sem série seleccionada</option>
                      {data.series
                        .filter((s: any) => s.tipo === type)
                        .map((s: any) => (
                          <option key={s.code} value={s.code}>
                            {s.code} · {s.year} · próximo {s.next_no}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
              <label className="flex items-start gap-2 p-3 border rounded">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={profile.enabled}
                  onChange={(e) =>
                    setProfile({ ...profile, enabled: e.target.checked })
                  }
                />
                <span>
                  Emitir os novos documentos nas séries de homologação
                  confirmadas pela AGT. Activa o cálculo FE 2.0; a formação
                  local continua disponível ao desligar. Documentos antigos
                  conservam os valores e a numeração.
                </span>
              </label>
              <button className={primary} disabled={busy}>
                Guardar perfil
              </button>
              <button
                type="button"
                className={btn + " ml-2"}
                disabled={busy}
                onClick={() => run(() => load(true), "Perfil actualizado.")}
              >
                Recarregar perfil
              </button>
            </form>
          )}
          {tab === "series" && (
            <div className="space-y-4">
              <div className="bg-white border rounded p-4 space-y-3">
                <h3 className="font-semibold">
                  Solicitar série à AGT em homologação
                </h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <label>
                    Documento
                    <select
                      className={field}
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      {types.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ano
                    <input
                      className={field}
                      type="number"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Estabelecimento
                    <input
                      className={field}
                      value={establishment}
                      onChange={(e) => setEstablishment(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  disabled={busy}
                  className={primary}
                  onClick={() =>
                    service("solicitarSerie", {
                      documentType: type,
                      seriesYear: year,
                      establishmentNumber: establishment,
                    })
                  }
                >
                  Preparar pedido de série
                </button>
                <button
                  disabled={busy}
                  className={btn + " ml-2"}
                  onClick={() => service("listarSeries")}
                >
                  Preparar consulta de séries
                </button>
              </div>
              <div className="bg-white border rounded p-4 space-y-3">
                <h3 className="font-semibold">
                  Consultar ou confirmar documento
                </h3>
                <label>
                  Número do documento
                  <input
                    className={field}
                    placeholder="FT série/número"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy}
                  className={btn}
                  onClick={() =>
                    service("consultarFactura", { documentNo: number })
                  }
                >
                  Preparar consulta
                </button>
                <div className="grid md:grid-cols-3 gap-3">
                  <label>
                    Acção do adquirente
                    <select
                      className={field}
                      value={validationAction}
                      onChange={(e) => setValidationAction(e.target.value)}
                    >
                      <option value="C">Confirmar</option>
                      <option value="R">Rejeitar</option>
                    </select>
                  </label>
                  {validationAction === "C" && (
                    <label>
                      Dedução de IVA
                      <select
                        className={field}
                        value={deductAllVAT}
                        onChange={(e) => setDeductAllVAT(e.target.value)}
                      >
                        <option value="ND">Nenhuma linha dedutível</option>
                        <option value="AD">
                          Todas as linhas, conforme cadastro AGT
                        </option>
                        <option value="LD">Especificar linhas</option>
                      </select>
                    </label>
                  )}
                </div>
                {validationAction === "C" && deductAllVAT === "LD" && (
                  <div className="space-y-2">
                    {deductLines.map((l, i) => (
                      <div key={i} className="flex flex-wrap gap-2">
                        <label>
                          Linha original
                          <input
                            className={field}
                            type="number"
                            min={1}
                            value={l.lineNo}
                            onChange={(e) =>
                              setDeductLines((old) =>
                                old.map((x, n) =>
                                  n === i
                                    ? { ...x, lineNo: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Deduzir
                          <select
                            className={field}
                            value={l.deductLineVAT}
                            onChange={(e) =>
                              setDeductLines((old) =>
                                old.map((x, n) =>
                                  n === i
                                    ? { ...x, deductLineVAT: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          >
                            <option value="S">Sim</option>
                            <option value="N">Não</option>
                          </select>
                        </label>
                        <label>
                          Aplicar pro-rata
                          <select
                            className={field}
                            value={l.applyProRata}
                            onChange={(e) =>
                              setDeductLines((old) =>
                                old.map((x, n) =>
                                  n === i
                                    ? { ...x, applyProRata: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          >
                            <option value="N">Não</option>
                            <option value="S">Sim</option>
                          </select>
                        </label>
                        <button
                          className={btn}
                          onClick={() =>
                            setDeductLines((old) =>
                              old.filter((_, n) => n !== i),
                            )
                          }
                        >
                          Remover linha
                        </button>
                      </div>
                    ))}
                    <button
                      className={btn}
                      onClick={() =>
                        setDeductLines((old) => [
                          ...old,
                          {
                            lineNo: old.length + 1,
                            deductLineVAT: "S",
                            applyProRata: "N",
                          },
                        ])
                      }
                    >
                      Adicionar linha
                    </button>
                  </div>
                )}
                <button
                  disabled={busy}
                  className={btn}
                  onClick={() =>
                    service("validarDocumento", {
                      documentNo: number,
                      action: validationAction,
                      ...(validationAction === "C"
                        ? {
                            deductAllVAT,
                            ...(deductAllVAT === "LD"
                              ? { deductibleVATLines: deductLines }
                              : {}),
                          }
                        : {}),
                    })
                  }
                >
                  Preparar confirmação / rejeição
                </button>
                <p className="text-xs text-slate-600">
                  A confirmação/rejeição é uma acção do adquirente. Reveja o
                  número e a empresa antes de enviar.
                </p>
              </div>
              <div className="flex gap-3 items-end flex-wrap">
                <label>
                  De
                  <input
                    type="date"
                    className={field}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    className={field}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy}
                  className={btn}
                  onClick={() =>
                    service("listarFacturas", {
                      queryStartDate: start,
                      queryEndDate: end,
                    })
                  }
                >
                  Preparar listagem de{" "}
                  {ids.length === 1 ? "documento" : "documentos"}
                </button>
              </div>
            </div>
          )}
          {tab === "documentos" && (
            <div className="space-y-3">
              <h3 className="font-semibold">
                Documentos emitidos em séries oficiais de homologação
              </h3>
              <p className="text-sm">
                As séries locais TEST e as pró-formas não são enviadas como
                facturas electrónicas. Seleccione até 30 documentos.
              </p>
              <div className="overflow-auto max-h-96">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Seleccionar</th>
                      <th>Documento</th>
                      <th>Cliente</th>
                      <th>Total Kz</th>
                      <th>Estado em homologação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((f) => (
                      <tr className="border-t" key={f.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={"Seleccionar " + f.numero}
                            checked={ids.includes(f.id)}
                            disabled={busy || !!f.agtReplacementNo}
                            onChange={(e) =>
                              setIds(
                                e.target.checked
                                  ? [...ids, f.id]
                                  : ids.filter((id) => id !== f.id),
                              )
                            }
                          />
                        </td>
                        <td className="p-2">{f.numero}</td>
                        <td>{f.clienteNome}</td>
                        <td>
                          {f.total.toLocaleString("pt-PT", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2">
                          <div>
                            {labels[f.agtStatus || ""] || "Por preparar"}
                          </div>
                          {f.agtReplacementNo && (
                            <div>Substituta: {f.agtReplacementNo}</div>
                          )}
                          {f.agtCorrection && (
                            <div>Corrige: {f.agtCorrection.documentNo}</div>
                          )}
                          {f.agtCanCorrect && (
                            <button
                              type="button"
                              className={btn + " mt-1"}
                              disabled={busy}
                              onClick={() =>
                                setCorrection({
                                  invoiceId: f.id,
                                  customerName: f.clienteNome,
                                  customerNif: f.clienteNif || "",
                                  customerAddress: f.clienteEndereco || "",
                                  reason: "",
                                })
                              }
                            >
                              Corrigir adquirente
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!candidates.length && (
                  <p className="p-3">
                    Ainda não há documentos emitidos numa série de homologação
                    confirmada.
                  </p>
                )}
              </div>
              {correction && source?.agtCanCorrect && (
                <form
                  className="border rounded p-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const result = await command("/agt/corrections", {
                        ...correction,
                        confirmHomologacao: true,
                      });
                      setCorrection(null);
                      setIds([result.fatura.id]);
                      await refresh();
                      return {
                        warning:
                          "Factura " +
                          result.fatura.numero +
                          " criada. Reveja-a antes de preparar o pedido.",
                      };
                    }, "Substituta criada em homologação.");
                  }}
                >
                  <h4 className="font-semibold">Substituir {source.numero}</h4>
                  <p className="text-sm">
                    Corrija os dados do adquirente neste documento. As linhas, o
                    total de{" "}
                    {source.total.toLocaleString("pt-PT", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    Kz e o vínculo do paciente são conservados. O original fica
                    no histórico. Esta acção não regista pagamento nem envia
                    documentos.
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="text-sm">
                      Nome do adquirente
                      <input
                        className={field}
                        required
                        maxLength={200}
                        value={correction.customerName}
                        onChange={(e) =>
                          setCorrection({
                            ...correction,
                            customerName: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      NIF do adquirente
                      <input
                        className={field}
                        pattern="[A-Za-z0-9]{8,15}"
                        maxLength={15}
                        value={correction.customerNif}
                        onChange={(e) =>
                          setCorrection({
                            ...correction,
                            customerNif: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Morada do adquirente
                      <input
                        className={field}
                        maxLength={300}
                        value={correction.customerAddress}
                        onChange={(e) =>
                          setCorrection({
                            ...correction,
                            customerAddress: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Motivo da correcção
                      <input
                        className={field}
                        required
                        minLength={8}
                        maxLength={300}
                        value={correction.reason}
                        onChange={(e) =>
                          setCorrection({
                            ...correction,
                            reason: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className={primary} disabled={busy}>
                      Criar substituta de homologação
                    </button>
                    <button
                      type="button"
                      className={btn}
                      disabled={busy}
                      onClick={() => setCorrection(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
              <button
                disabled={
                  busy ||
                  !ids.length ||
                  ids.length > 30 ||
                  ids.some(
                    (id) =>
                      !candidates.some(
                        (f) => f.id === id && !f.agtReplacementNo,
                      ),
                  )
                }
                className={primary}
                onClick={() =>
                  run(
                    () => documentCommand("/agt/prepare", { invoiceIds: ids }),
                    "Lote preparado e assinado. Reveja o pedido antes de enviar.",
                  )
                }
              >
                Preparar e assinar {ids.length || ""}{" "}
                {ids.length === 1 ? "documento" : "documentos"}
              </button>
              <button
                className={btn + " ml-2"}
                disabled={busy || ids.length !== 1}
                onClick={() =>
                  run(async () => {
                    const f = selected;
                    if (!f) throw Error("Seleccione um documento.");
                    const report = agtQrPreflight(
                      f.emitenteSnapshot?.nif || data.company.nif,
                      f.numero,
                    );
                    download(
                      new Blob([JSON.stringify(report, null, 2)], {
                        type: "application/json",
                      }),
                      "DIAGNOSTICO_QR_AGT.json",
                    );
                    return { warning: report.notice };
                  }, "Diagnóstico descarregado.")
                }
              >
                Verificar especificação do QR fiscal
              </button>
              <button
                className={btn + " ml-2"}
                disabled={busy || !selected}
                onClick={() =>
                  run(async () => {
                    if (!selected) return;
                    const report = await agtQrExamplePng(
                      selected.emitenteSnapshot?.nif || data.company.nif,
                      selected.numero,
                    );
                    const a = document.createElement("a");
                    a.href = report.dataUrl;
                    a.download = "QR_ENSAIO_SEM_VALIDADE_FISCAL.png";
                    a.click();
                    return { warning: report.notice };
                  }, "PNG de ensaio descarregado.")
                }
              >
                Descarregar QR de ensaio (PNG)
              </button>
              {selected?.tipoDocumento === "recibo" && (
                <button
                  className={btn + " ml-2"}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const report = await billingRequest<any>(
                        "POST",
                        "/agt/partial-receipt-preview",
                        { invoiceId: selected.id },
                      );
                      download(
                        new Blob([JSON.stringify(report, null, 2)], {
                          type: "application/json",
                        }),
                        "DIAGNOSTICO_RECIBO_PARCIAL_NAO_ENVIAR.json",
                      );
                      return { warning: report.aviso };
                    }, "Diagnóstico descarregado.")
                  }
                >
                  Diagnóstico de recibo parcial
                </button>
              )}
            </div>
          )}
          {tab === "exportar" && (
            <div className="bg-white border rounded p-4 space-y-4">
              <h3 className="font-semibold">
                SAF-T(AO) de facturação em homologação
              </h3>
              <p className="text-sm">
                XML 1.01_01 validado localmente contra o XSD. A contabilidade
                geral e o inventário ficam fora deste ficheiro. Os documentos
                antigos sem assinatura são identificados no relatório.
              </p>
              <div className="flex gap-3 flex-wrap">
                <label>
                  Início
                  <input
                    type="date"
                    className={field}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label>
                  Fim
                  <input
                    type="date"
                    className={field}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              </div>
              <button
                className={primary}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await billingRequest<any>("POST", "/agt/saft", {
                        startDate: start,
                        endDate: end,
                      }),
                      zip = new JSZip();
                    zip.file(r.fileName, r.xml);
                    zip.file(
                      "RELATORIO_VALIDACAO.json",
                      JSON.stringify({ ...r, xml: undefined }, null, 2),
                    );
                    download(
                      await zip.generateAsync({ type: "blob" }),
                      "NVUALASOFT_SAFT_Homologacao.zip",
                    );
                  }, "XML e relatório de validação descarregados.")
                }
              >
                Exportar XML validado e relatório
              </button>
              <hr />
              <h3 className="font-semibold">
                Identificação do produtor e Modelo 8
              </h3>
              <p className="text-sm">
                Gere as chaves no seu computador com{" "}
                <code>node scripts/agt/configurar.mjs</code>. Para preparar o
                requerimento e a declaração em minuta, execute{" "}
                <code>node --import tsx scripts/agt/dossier.mjs</code>. O
                formulário oficial deve ser preenchido, revisto e assinado pelo
                representante competente.
              </p>
              <button
                disabled={busy || !data.dossierAllowed}
                className={btn}
                onClick={() =>
                  run(async () => {
                    const d = await billingRequest<any>("GET", "/agt/modelo8"),
                      z = new JSZip();
                    z.file("DADOS_MODELO8.json", JSON.stringify(d, null, 2));
                    z.file("CHAVE_PUBLICA_FE.pem", d.publicKeyFE);
                    if (d.publicKeySAFT)
                      z.file("CHAVE_PUBLICA_SAFT.txt", d.publicKeySAFT);
                    download(
                      await z.generateAsync({ type: "blob" }),
                      "NVUALASOFT_Modelo8_Preparacao.zip",
                    );
                  }, "Dados de preparação e chaves públicas descarregados.")
                }
              >
                Descarregar dados e chaves públicas
              </button>
              {!data.dossierAllowed && (
                <p className="text-xs text-slate-600">
                  A identificação completa do produtor é reservada à empresa
                  proprietária. As minutas também podem ser geradas localmente
                  no servidor.
                </p>
              )}
            </div>
          )}
          <div className="border bg-white rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Pedidos desta empresa</h3>
              <button
                className={btn}
                disabled={busy}
                onClick={() => run(() => load(), "Estados actualizados.")}
              >
                Actualizar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Data / serviço</th>
                    <th>Estado</th>
                    <th>Pedido AGT</th>
                    <th>Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((j: any) => {
                    const seconds = j.next_poll_at
                      ? Math.max(
                          0,
                          Math.ceil(
                            (new Date(j.next_poll_at).getTime() - clock) / 1000,
                          ),
                        )
                      : 0;
                    return (
                      <tr className="border-t" key={j.id}>
                        <td className="py-3 pr-3">
                          <span className="block text-xs text-slate-500">
                            {new Date(j.created_at).toLocaleString("pt-PT")}
                          </span>
                          {serviceLabels[j.operation] || j.operation}
                        </td>
                        <td className="pr-3">{labels[j.status] || j.status}</td>
                        <td>{j.agt_request_id || "—"}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              disabled={busy}
                              className={btn}
                              onClick={() => evidence(j.id)}
                            >
                              Ver / descarregar
                            </button>
                            {j.status === "preparado" && (
                              <>
                                <button
                                  disabled={busy || !data.runtime.hmlEnabled}
                                  className={primary}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Enviar este pedido para a AGT no ambiente de homologação? Reveja os dados descarregados antes de confirmar.",
                                      )
                                    )
                                      run(
                                        () =>
                                          documentCommand(
                                            "/agt/jobs/" + j.id + "/send",
                                            { confirmHomologacao: true },
                                          ),
                                        "Pedido enviado para homologação. Confira o estado indicado.",
                                      );
                                  }}
                                >
                                  Enviar para homologação
                                </button>
                                <button
                                  disabled={busy}
                                  className={btn}
                                  onClick={() =>
                                    run(
                                      () =>
                                        documentCommand(
                                          "/agt/jobs/" + j.id + "/cancel",
                                        ),
                                      "Pedido não enviado cancelado.",
                                    )
                                  }
                                >
                                  Cancelar preparação
                                </button>
                              </>
                            )}
                            {[
                              "recebido",
                              "processando",
                              "envio_incerto",
                            ].includes(j.status) &&
                              j.agt_request_id && (
                                <button
                                  disabled={busy || seconds > 0}
                                  className={primary}
                                  onClick={() =>
                                    run(
                                      () =>
                                        documentCommand(
                                          "/agt/jobs/" + j.id + "/poll",
                                        ),
                                      "Consulta concluída.",
                                    )
                                  }
                                >
                                  Consultar estado{" "}
                                  {seconds > 0 ? `(${seconds}s)` : ""}
                                </button>
                              )}
                            {["a_enviar", "envio_incerto"].includes(j.status) &&
                              !j.agt_request_id &&
                              j.operation === "registarFactura" && (
                                <button
                                  disabled={busy || seconds > 0}
                                  className={btn}
                                  onClick={() =>
                                    run(
                                      () =>
                                        documentCommand(
                                          "/agt/jobs/" + j.id + "/reconcile",
                                        ),
                                      "Reconciliação concluída.",
                                    )
                                  }
                                >
                                  Reconciliar sem reenviar
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data.jobs.length && (
                <p className="py-3 text-slate-600">Sem pedidos preparados.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  FileCheck2,
  Edit3,
  Printer,
  RefreshCw,
  Search,
  History,
  CheckCircle2,
} from "lucide-react";
import { useApp, type Resultado } from "../../store/AppContext";
import { hospitalApi } from "../../store/hospital";
import { generatePDFHTML } from "../../utils/pdfGenerator";
import { RESULT_STATES, type ReportDetail, type ReportRow } from "./relatorios";
const C = {
  navy: "#0d2b3e",
  teal: "#0d7a8a",
  light: "#3bb5c4",
  green: "#005a2a",
  red: "#c0392b",
  line: "#e5e7eb",
};
const input =
  "w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#0d7a8a] focus:outline-none";
const button =
  "inline-flex items-center justify-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold disabled:opacity-40";
function time(value: string) {
  return new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  }).format(new Date(value));
}
export default function ResultadosProntos({
  selected,
  onSelect,
  onEdit,
}: {
  selected: number | null;
  onSelect: (id: number | null) => void;
  onEdit: (id: number) => void;
}) {
  const { data, reload } = useApp();
  const [items, setItems] = useState<ReportRow[]>([]),
    [total, setTotal] = useState(0),
    [canEdit, setCanEdit] = useState(false);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ReportDetail | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  const serial = useRef(0),
    locked = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      serial.current++;
    };
  }, []);
  async function load() {
    const seq = ++serial.current;
    setLoading(true);
    setError("");
    try {
      if (selected !== null) {
        const result = await hospitalApi<ReportDetail>(
          "GET",
          "/lab/reports/" + selected,
        );
        if (alive.current && seq === serial.current) {
          setDetail(result);
          setCanEdit(result.canEdit);
        }
      } else {
        const result = await hospitalApi<{
          items: ReportRow[];
          total: number;
          canEdit: boolean;
        }>(
          "GET",
          "/lab/reports?page=" +
            page +
            "&q=" +
            encodeURIComponent(query) +
            "&state=" +
            filter,
        );
        if (alive.current && seq === serial.current) {
          setItems(result.items);
          setTotal(result.total);
          setCanEdit(result.canEdit);
        }
      }
    } catch (e) {
      if (alive.current && seq === serial.current)
        setError(e instanceof Error ? e.message : "Resultados indisponíveis.");
    } finally {
      if (alive.current && seq === serial.current) setLoading(false);
    }
  }
  useEffect(() => {
    setDetail(null);
    setNote("");
    setMessage("");
    void load();
  }, [selected, page, query, filter]);
  async function validate(phase: string) {
    if (!detail || locked.current) return;
    if (!note.trim()) {
      setError("Registe a nota de revisão antes de validar.");
      return;
    }
    // Open synchronously from the authorised click so popup blockers do not
    // prevent the definitive PDF being prepared after successful release.
    const pdfWindow = phase === "release" ? window.open("", "_blank") : null;
    if (pdfWindow) {
      pdfWindow.opener = null;
      pdfWindow.document.body.textContent = "A aguardar libertação do resultado…";
    }
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await hospitalApi("POST", "/lab/reports/" + selected + "/validate", {
        phase,
        version: detail.version,
        note: note.trim(),
      });
      let pdfMessage = "";
      if (phase === "release") {
        if (pdfWindow) {
          try {
            await populatePdf(pdfWindow, detail.result.id);
          } catch {
            pdfWindow.close();
            pdfMessage = " O PDF definitivo pode ser aberto em PDF / Imprimir.";
          }
        } else pdfMessage = " Active janelas emergentes para abrir o PDF automaticamente.";
      }
      setMessage(
        phase === "release"
          ? "Resultado validado e pronto para entrega." + pdfMessage
          : "Validação técnica registada. Aguarda libertação.",
      );
      setNote("");
      await load();
      await reload().catch(() => {});
    } catch (e) {
      pdfWindow?.close();
      setError(e instanceof Error ? e.message : "Validação não confirmada.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function populatePdf(target: Window, id: number) {
    const result = await hospitalApi<{
      result: Resultado;
      trace?: { processo?: string; accession?: string; sampleCode?: string; provisional?: boolean; reviewState?: string; version?: number; technicalBy?: string; releasedBy?: string };
    }>("POST", "/result-export/" + id, { purpose: "internal" });
    if (target.closed) throw new Error("A janela de impressão foi fechada.");
    const html = generatePDFHTML(
      result.result,
      data.pacientes.find((p) => p.id === result.result.pacienteId),
      data.config,
      result.trace,
    );
    target.document.open();
    target.document.write(
      html.replace(
        "</body>",
        "<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script></body>",
      ),
    );
    target.document.close();
    target.focus();
  }
  async function print(id: number) {
    if (locked.current) return;
    const target = window.open("", "_blank");
    if (!target) {
      setError("Permita a abertura da janela de impressão.");
      return;
    }
    target.opener = null;
    target.document.body.textContent =
      "A verificar a autorização do resultado…";
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await populatePdf(target, id);
    } catch (e) {
      target.close();
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível autorizar a impressão.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const current = detail?.history[0],
    technical = Boolean(current?.technical_at),
    ready = Boolean(current?.released_at),
    isLegacy = detail && !current;
  return (
    <div
      className="min-h-screen bg-white p-6 md:p-8"
      style={{ fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif" }}
    >
      <header
        className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3"
        style={{ borderColor: C.line }}
      >
        <div className="flex items-center gap-3">
          {selected !== null && (
            <button
              className={button}
              disabled={busy}
              onClick={() => onSelect(null)}
            >
              <ArrowLeft size={14} />
              Voltar à lista
            </button>
          )}
          <h2 className="text-xl font-light text-gray-600">
            {selected !== null
              ? "Resultado #" + selected
              : "Resultados Prontos / Revisão"}
          </h2>
        </div>
        <button
          className={button}
          disabled={loading || busy}
          onClick={() => void load()}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mb-4 rounded-sm border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {message}
        </p>
      )}
      {loading && (
        <p role="status" className="mb-4 text-sm text-gray-500">
          A carregar os resultados da instituição…
        </p>
      )}
      {selected === null ? (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            {[
              ["Resultados encontrados", total, C.navy, FileCheck2],
              [
                "Prontos nesta página",
                items.filter((i) => Boolean(i.result.dataEmissao)).length,
                C.teal,
                CheckCircle2,
              ],
              [
                "Em revisão nesta página",
                items.filter((i) => !i.result.dataEmissao).length,
                C.light,
                History,
              ],
            ].map(([label, n, color, Icon]) => {
              const Mark = Icon as typeof Eye;
              return (
                <div
                  key={String(label)}
                  className="relative rounded-sm p-5 text-white"
                  style={{ background: String(color) }}
                >
                  <p className="text-sm">{String(label)}</p>
                  <strong className="mt-2 block text-3xl font-extralight">
                    {String(n)}
                  </strong>
                  <Mark
                    size={26}
                    className="absolute right-5 top-8 opacity-70"
                  />
                </div>
              );
            })}
          </div>
          <div
            className="mb-5 grid gap-3 rounded-sm border p-4 md:grid-cols-[1fr_230px]"
            style={{ borderColor: C.line }}
          >
            <label className="relative">
              <Search
                className="absolute left-3 top-3 text-gray-400"
                size={16}
              />
              <input
                className={input + " pl-10"}
                aria-label="Pesquisar resultados prontos"
                value={query}
                placeholder="Paciente, processo, pedido ou amostra…"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <select
              aria-label="Estado do resultado"
              className={input}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">Todos os resultados</option>
              <option value="ready">Prontos</option>
              <option value="pending">Aguarda validação</option>
            </select>
          </div>
          <div
            className="overflow-x-auto rounded-sm border"
            style={{ borderColor: C.line }}
          >
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f5f6f7] text-[11px] uppercase text-gray-500">
                <tr>
                  {[
                    "Referência",
                    "Paciente",
                    "Colheita / emissão",
                    "Situação",
                    "Versão",
                    "Acções",
                  ].map((h) => (
                    <th className="px-4 py-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.result.id}
                    className="border-t text-gray-700 hover:bg-[#fafbfc]"
                    style={{ borderColor: C.line }}
                  >
                    <td
                      className="px-4 py-3 font-mono"
                      style={{ color: C.teal }}
                    >
                      {item.managed?.sampleCode ||
                        item.managed?.accession ||
                        `#${item.result.id}`}
                      {item.managed?.sampleCode && item.managed.accession && (
                        <small className="block text-gray-500">
                          Pedido {item.managed.accession}
                        </small>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {item.result.pacienteNome}
                    </td>
                    <td className="px-4 py-3">
                      {item.result.data}
                      <br />
                      <span className="text-gray-400">
                        {item.result.dataEmissao || "Por emitir"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.managed
                        ? item.result.dataEmissao
                          ? "Pronto · amostra"
                          : "Revisão no circuito"
                        : RESULT_STATES[item.state]}
                    </td>
                    <td className="px-4 py-3">{item.version || "Legado"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={button}
                          onClick={() => onSelect(item.result.id)}
                        >
                          <Eye size={14} />
                          Ver / versões
                        </button>
                        {(item.state === "rascunho" || item.state === "revisao") && (
                          <button
                            className={button}
                            style={{ color: C.green, borderColor: C.green }}
                            disabled={busy}
                            onClick={() => item.managed ? onEdit(item.result.id) : onSelect(item.result.id)}
                          >
                            <CheckCircle2 size={14} />
                            {item.state === "rascunho" ? "Validar" : "Libertar"}
                          </button>
                        )}
                        {canEdit && (
                          <button
                            className={button}
                            style={{ color: C.teal, borderColor: C.teal }}
                            onClick={() => onEdit(item.result.id)}
                          >
                            <Edit3 size={14} />
                            Editar resultado
                          </button>
                        )}
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() => void print(item.result.id)}
                        >
                          <Printer size={14} />
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && !loading && (
              <p className="p-10 text-center text-sm text-gray-500">
                Nenhum resultado corresponde à pesquisa.
              </p>
            )}
          </div>
          <footer className="mt-4 flex items-center justify-end gap-3 text-xs text-gray-500">
            <span>{total} resultado(s)</span>
            <button
              className={button}
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(total / 40))}
            </span>
            <button
              className={button}
              disabled={(page + 1) * 40 >= total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Seguinte
            </button>
          </footer>
        </>
      ) : (
        detail && (
          <>
            <section
              className="mb-5 rounded-sm border"
              style={{ borderColor: C.line }}
            >
              <header
                className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#f5f6f7] px-5 py-3"
                style={{ borderColor: C.line }}
              >
                <div>
                  <h3 className="text-sm font-bold text-gray-700">
                    {detail.result.pacienteNome}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Colheita: {detail.result.data} ·{" "}
                    {detail.managed
                      ? `Amostra ${detail.managed.sampleCode || "no circuito"}`
                      : isLegacy
                        ? "Registo legado"
                        : ready
                          ? "Pronto"
                          : technical
                            ? "Aguarda libertação"
                            : "Aguarda validação técnica"}{" "}
                    · versão {detail.version || "legada"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.canEdit && (
                    <button
                      className={button + " text-white"}
                      style={{ background: C.teal, borderColor: C.teal }}
                      disabled={busy}
                      onClick={() => onEdit(detail.result.id)}
                    >
                      <Edit3 size={14} />
                      {detail.managed
                        ? "Editar no circuito"
                        : ready || isLegacy
                          ? "Editar resultado pronto"
                          : "Editar versão"}
                    </button>
                  )}
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void print(detail.result.id)}
                  >
                    <Printer size={14} />
                    {detail.result.dataEmissao ? "PDF / Imprimir" : "PDF provisório / Imprimir"}
                  </button>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase text-gray-500">
                    <tr>
                      {[
                        "Exame",
                        "Parâmetro",
                        "Resultado",
                        "Unidade",
                        "Referência",
                      ].map((v) => (
                        <th className="px-4 py-3" key={v}>
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.result.parametros.map((p, i) => (
                      <tr
                        className="border-t"
                        style={{ borderColor: C.line }}
                        key={i}
                      >
                        <td
                          className="px-4 py-3 text-xs"
                          style={{ color: C.teal }}
                        >
                          {p.exame}
                        </td>
                        <td className="px-4 py-3 text-xs">{p.parametro}</td>
                        <td className="px-4 py-3 font-semibold">
                          {p.resultado || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {p.unidade}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {p.referencia}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {detail.managed && !ready && (
              <section className="mb-5 rounded-sm border border-amber-200 bg-amber-50 p-5">
                <h3 className="mb-2 text-sm font-bold text-gray-800">
                  Validação no circuito laboratorial
                </h3>
                <p className="mb-3 text-xs text-amber-900">
                  Este resultado pertence a uma amostra rastreada. A validação
                  técnica e a libertação são feitas no circuito, onde se confirmam
                  a amostra, o controlo de qualidade e as autorizações profissionais.
                </p>
                <button className={button} disabled={busy} onClick={() => onEdit(detail.result.id)}>
                  <CheckCircle2 size={14} /> Abrir validação no circuito
                </button>
              </section>
            )}
            {!detail.managed && !current && !ready && (
              <section className="mb-5 rounded-sm border border-amber-200 bg-amber-50 p-5">
                <h3 className="mb-2 text-sm font-bold text-gray-800">Resultado antigo sem versão validável</h3>
                <p className="mb-3 text-xs text-amber-900">
                  Este registo ainda não tem uma versão com autoria e histórico de revisão.
                  Abra a edição, guarde uma versão e regresse aqui para efectuar a validação.
                </p>
                {detail.canEdit && (
                  <button className={button} disabled={busy} onClick={() => onEdit(detail.result.id)}>
                    <Edit3 size={14} /> Preparar versão para validar
                  </button>
                )}
              </section>
            )}
            {current && !ready && !detail.managed && (
              <section
                className="mb-5 rounded-sm border p-5"
                style={{ borderColor: C.line }}
              >
                <h3 className="mb-2 text-sm font-bold text-gray-700">
                  Validação da versão {detail.version}
                </h3>
                <p className="mb-3 text-xs text-gray-500">
                  A introdução, a revisão técnica e a libertação ficam
                  identificadas. São verificadas as credenciais e permissões
                  profissionais já configuradas na instituição.
                </p>
                <label className="block text-xs font-bold text-gray-500">
                  Nota de revisão
                  <textarea
                    aria-label="Nota de revisão"
                    className={input + " mt-2"}
                    value={note}
                    maxLength={1500}
                    rows={2}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!technical && (
                    <button
                      className={button + " text-white"}
                      style={{ background: C.teal }}
                      disabled={busy || !detail.canTechnical}
                      onClick={() => void validate("technical")}
                    >
                      Validar tecnicamente
                    </button>
                  )}
                  {technical && (
                    <button
                      className={button + " text-white"}
                      style={{ background: C.green }}
                      disabled={busy || !detail.canRelease}
                      onClick={() => void validate("release")}
                    >
                      Libertar resultado e abrir PDF definitivo
                    </button>
                  )}
                  {((!technical && !detail.canTechnical) ||
                    (technical && !detail.canRelease)) && (
                    <p className="text-xs text-amber-700">
                      A conta administrativa, por si só, não autoriza validação clínica.
                      Atribua a competência a um profissional habilitado em
                      Administração → Funcionários. A pessoa que lançou o resultado
                      não o pode validar como revisor independente.
                    </p>
                  )}
                </div>
              </section>
            )}
            <section
              className="rounded-sm border"
              style={{ borderColor: C.line }}
            >
              <h3 className="border-b bg-[#f5f6f7] px-5 py-3 text-xs font-bold uppercase text-gray-700">
                Histórico de versões e alterações
              </h3>
              {!detail.history.length ? (
                <p className="p-5 text-sm text-gray-500">
                  Registo anterior ao versionamento. A primeira alteração
                  preservará esta versão integralmente.
                </p>
              ) : (
                detail.history.map((v) => (
                  <article
                    key={v.id}
                    className="border-b p-5 text-xs text-gray-600"
                    style={{ borderColor: C.line }}
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <strong style={{ color: C.teal }}>
                        {v.origin === "legado"
                          ? "Arquivo do registo legado"
                          : "Versão " + v.version}
                      </strong>
                      <span>{time(v.created_at)}</span>
                    </div>
                    <p className="mt-2">{v.reason || "Introdução inicial"}</p>
                    <p className="mt-2">
                      Introdução:{" "}
                      {v.entered_by || "Autoria histórica não registada"} ·
                      Revisão técnica: {v.technical_by || "Não registada"} ·
                      Libertação: {v.released_by || "Não registada"}
                    </p>
                    {v.technical_note && (
                      <p className="mt-1">Revisão: {v.technical_note}</p>
                    )}
                    {v.release_note && (
                      <p className="mt-1">Libertação: {v.release_note}</p>
                    )}
                    <details className="mt-3">
                      <summary className="cursor-pointer font-semibold">
                        Consultar os valores desta versão (
                        {v.data.parametros.length})
                      </summary>
                      <table className="mt-2 w-full text-left">
                        <thead>
                          <tr>
                            {[
                              "Parâmetro",
                              "Resultado",
                              "Unidade",
                              "Referência",
                            ].map((h) => (
                              <th className="p-2" key={h}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {v.data.parametros.map((p, i) => (
                            <tr
                              className="border-t"
                              style={{ borderColor: C.line }}
                              key={i}
                            >
                              <td className="p-2">
                                {p.exame} · {p.parametro}
                              </td>
                              <td className="p-2">{p.resultado}</td>
                              <td className="p-2">{p.unidade}</td>
                              <td className="p-2">{p.referencia}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </article>
                ))
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}

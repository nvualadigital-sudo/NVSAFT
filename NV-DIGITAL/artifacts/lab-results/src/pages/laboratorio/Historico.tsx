import { useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Search,
  TestTube2,
  RefreshCw,
} from "lucide-react";
import { useApp, type Resultado } from "../../store/AppContext";
import { generatePDFHTML } from "../../utils/pdfGenerator";
import BibliotecaWorkspace from "../admin/biblioteca/BibliotecaWorkspace";
import { hospitalApi } from "../admin/biblioteca/api";
import { Modal, Stat } from "../admin/biblioteca/ui";

function day(value: string) {
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value || "");
  if (iso) return iso[1];
  const local = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value || "");
  return local ? local[3] + "-" + local[2] + "-" + local[1] : "";
}
function today() {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Luanda",
  }).formatToParts(new Date());
  const get = (name: string) => parts.find((p) => p.type === name)?.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
export default function Historico() {
  const { data, loading, loadError, reload } = useApp();
  const [tab, setTab] = useState<"historico" | "biblioteca">("historico");
  const [query, setQuery] = useState(""),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState("");
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null),
    [message, setMessage] = useState("");
  const locked = useRef(false),
    search = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return data.resultados
      .filter((r) => {
        const patient = data.pacientes.find((p) => p.id === r.pacienteId);
        const text = [
          r.id,
          r.pacienteNome,
          r.data,
          r.dataEmissao,
          patient?.processo,
          ...r.parametros.map((p) => p.exame + " " + p.parametro),
        ]
          .join(" ")
          .toLocaleLowerCase();
        const date = day(r.dataEmissao || r.data);
        return (
          (!q || text.includes(q)) &&
          (!from || date >= from) &&
          (!until || Boolean(date && date <= until))
        );
      })
      .sort(
        (a, b) =>
          day(b.dataEmissao || b.data).localeCompare(day(a.dataEmissao || a.data)) || b.id - a.id,
      );
  }, [data.resultados, data.pacientes, query, from, until]);
  const pages = Math.max(1, Math.ceil(results.length / 20)),
    currentPage = Math.min(page, pages - 1);
  const shown = results.slice(currentPage * 20, (currentPage + 1) * 20);
  const result = data.resultados.find((r) => r.id === selected);
  const patient =
    result && data.pacientes.find((p) => p.id === result.pacienteId);
  function filter(fn: () => void) {
    fn();
    setPage(0);
  }
  async function exportResult(r: Resultado) {
    if (locked.current) return;
    // Reserve the window during the click so the browser permits it; no clinical content until server approval.
    const target = window.open("", "_blank");
    if (!target) {
      setMessage("Permita a abertura da janela de impressão neste navegador.");
      return;
    }
    target.opener = null;
    target.document.title = "A autorizar impressão";
    target.document.body.textContent =
      "A verificar a autorização do documento…";
    locked.current = true;
    setBusy(r.id);
    setMessage("");
    try {
      // The server checks institution, role, professional permission and validation, then audits the export.
      const verified = await hospitalApi<{
        result: Resultado;
        trace?: { processo?: string; accession?: string; sampleCode?: string; provisional?: boolean; reviewState?: string; version?: number };
      }>("POST", "/result-export/" + r.id, { purpose: "internal" });
      if (target.closed)
        throw new Error(
          "A janela de impressão foi fechada. Repita a operação.",
        );
      const html = generatePDFHTML(
        verified.result,
        data.pacientes.find((p) => p.id === verified.result.pacienteId),
        data.config,
        verified.trace,
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
    } catch (e) {
      target.close();
      setMessage(
        e instanceof Error
          ? e.message
          : "Não foi possível autorizar o documento.",
      );
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }
  return (
    <section className="hd-workspace">
      <header className="hd-heading">
        <div>
          <h1>Histórico &amp; Biblioteca</h1>
          <p>Resultados laboratoriais e documentos internos da instituição</p>
        </div>
        <div
          className="hd-tabs"
          role="tablist"
          aria-label="Histórico e documentos"
        >
          <button
            type="button"
            id="tab-historico"
            role="tab"
            aria-selected={tab === "historico"}
            aria-controls="painel-historico"
            onClick={() => setTab("historico")}
          >
            <Archive size={15} />
            Histórico
          </button>
          <button
            type="button"
            id="tab-biblioteca"
            role="tab"
            aria-selected={tab === "biblioteca"}
            aria-controls="painel-biblioteca"
            onClick={() => setTab("biblioteca")}
          >
            <BookOpen size={15} />
            Arquivos / Biblioteca
          </button>
        </div>
      </header>
      {tab === "biblioteca" ? (
        <div
          id="painel-biblioteca"
          role="tabpanel"
          aria-labelledby="tab-biblioteca"
        >
          <BibliotecaWorkspace embedded />
        </div>
      ) : (
        <div
          id="painel-historico"
          role="tabpanel"
          aria-labelledby="tab-historico"
        >
          <div className="hd-stats">
            <Stat
              tone="#1a2e4a"
              label="Resultados registados"
              value={data.resultados.length}
              icon={<FileText size={24} />}
            />
            <Stat
              tone="#0d7a8a"
              label="Emitidos hoje"
              value={
                data.resultados.filter((r) => day(r.dataEmissao) === today())
                  .length
              }
              icon={<CalendarDays size={24} />}
            />
            <Stat
              tone="#168a9a"
              label="Parâmetros no histórico"
              value={data.resultados.reduce(
                (n, r) => n + r.parametros.length,
                0,
              )}
              icon={<TestTube2 size={24} />}
            />
          </div>
          {loadError && (
            <p role="alert" className="hd-notice" data-error="true">
              {loadError}
            </p>
          )}
          {message && (
            <p role="alert" className="hd-notice" data-error="true">
              {message}
            </p>
          )}
          <div className="hd-panel">
            <div className="hd-panel-head">
              <h2>Resultados laboratoriais</h2>
              <span className="hd-subtle">{results.length} resultado(s)</span>
            </div>
            <div className="hd-history-filters">
              <div className="hd-search">
                <Search size={17} />
                <input
                  ref={search}
                  className="hd-input"
                  aria-label="Pesquisar resultados"
                  placeholder="Paciente, processo, exame ou referência…"
                  value={query}
                  onChange={(e) => filter(() => setQuery(e.target.value))}
                />
              </div>
              <label className="hd-date-label">
                Emissão de
                <input
                  type="date"
                  aria-label="Emissão de"
                  className="hd-input"
                  max={until || undefined}
                  value={from}
                  onChange={(e) => filter(() => setFrom(e.target.value))}
                />
              </label>
              <label className="hd-date-label">
                Até
                <input
                  type="date"
                  aria-label="Emissão até"
                  className="hd-input"
                  min={from || undefined}
                  value={until}
                  onChange={(e) => filter(() => setUntil(e.target.value))}
                />
              </label>
              <button
                type="button"
                className="hd-button"
                onClick={() =>
                  filter(() => {
                    setQuery("");
                    setFrom("");
                    setUntil("");
                    search.current?.focus();
                  })
                }
              >
                Limpar
              </button>
              <button
                type="button"
                className="hd-button"
                disabled={loading}
                onClick={() =>
                  void reload().catch((e) =>
                    setMessage(
                      e instanceof Error ? e.message : "Falha ao actualizar.",
                    ),
                  )
                }
              >
                <RefreshCw size={14} />
                Actualizar
              </button>
            </div>
            {loading ? (
              <p role="status" className="hd-empty">
                A carregar resultados da instituição…
              </p>
            ) : shown.length ? (
              <div className="hd-table-wrap">
                <table className="hd-table hd-results-table">
                  <thead>
                    <tr>
                      {[
                        "Referência",
                        "Paciente",
                        "Processo",
                        "Colheita",
                        "Emissão",
                        "Exames / parâmetros",
                        "Acções",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id}>
                        <td>#{r.id}</td>
                        <td>
                          <strong>{r.pacienteNome}</strong>
                        </td>
                        <td>
                          {data.pacientes.find((p) => p.id === r.pacienteId)
                            ?.processo || "—"}
                        </td>
                        <td>{r.data || "—"}</td>
                        <td>{r.dataEmissao || <span className="text-amber-800">Em revisão · PDF provisório</span>}</td>
                        <td>
                          <span className="hd-result-exams">
                            {[
                              ...new Set(
                                r.parametros
                                  .map((p) => p.exame)
                                  .filter(Boolean),
                              ),
                            ].join(", ") || "Resultado laboratorial"}
                          </span>
                          <small className="hd-subtle">
                            {r.parametros.length} parâmetro(s)
                          </small>
                        </td>
                        <td>
                          <div className="hd-actions">
                            <button
                              type="button"
                              className="hd-button"
                              onClick={() => setSelected(r.id)}
                            >
                              <Eye size={14} />
                              Ver
                            </button>
                            <button
                              type="button"
                              className="hd-button hd-primary"
                              disabled={busy !== null}
                              onClick={() => void exportResult(r)}
                            >
                              <Download size={14} />
                              {busy === r.id
                                ? "A autorizar…"
                                : r.dataEmissao ? "PDF / Imprimir" : "PDF provisório"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="hd-empty">
                {data.resultados.length
                  ? "Nenhum resultado corresponde aos filtros."
                  : "Ainda não existem resultados registados nesta instituição."}
              </p>
            )}
          </div>
          <footer className="hd-pagination">
            <span>{results.length} resultado(s)</span>
            <button
              type="button"
              className="hd-button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              {currentPage + 1} / {pages}
            </span>
            <button
              type="button"
              className="hd-button"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Seguinte
            </button>
          </footer>
          <p className="hd-history-note">
            A impressão exige validação e autorização no laboratório. As
            rectificações mantêm o resultado anterior no circuito de auditoria.
          </p>
          {result && (
            <Modal
              title={"Resultado #" + result.id + " — " + result.pacienteNome}
              wide
              busy={busy !== null}
              onClose={() => setSelected(null)}
            >
              {message && (
                <p className="hd-notice" data-error="true" role="alert">
                  {message}
                </p>
              )}
              <dl className="hd-details">
                <dt>Processo</dt>
                <dd>{patient?.processo || "—"}</dd>
                <dt>Colheita</dt>
                <dd>{result.data || "—"}</dd>
                <dt>Emissão</dt>
                <dd>{result.dataEmissao || "—"}</dd>
                <dt>Técnico</dt>
                <dd>{result.tecnicoNome || "Não indicado no registo"}</dd>
              </dl>
              <div className="hd-panel hd-table-wrap" style={{ marginTop: 18 }}>
                <table className="hd-table hd-results-table">
                  <thead>
                    <tr>
                      {[
                        "Exame",
                        "Parâmetro",
                        "Resultado",
                        "Unidade",
                        "Referência",
                      ].map((v) => (
                        <th key={v}>{v}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.parametros.map((p, i) => (
                      <tr key={i}>
                        <td>{p.exame}</td>
                        <td>{p.parametro}</td>
                        <td>
                          <strong>{p.resultado}</strong>
                        </td>
                        <td>{p.unidade}</td>
                        <td>{p.referencia}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="hd-actions">
                <button
                  type="button"
                  className="hd-button hd-primary"
                  disabled={busy !== null}
                  onClick={() => void exportResult(result)}
                >
                  <Download size={15} />
                  {busy === result.id ? "A autorizar…" : "PDF / Imprimir"}
                </button>
                <button
                  type="button"
                  className="hd-button"
                  disabled={busy !== null}
                  onClick={() => setSelected(null)}
                >
                  Fechar
                </button>
              </div>
            </Modal>
          )}
        </div>
      )}
    </section>
  );
}

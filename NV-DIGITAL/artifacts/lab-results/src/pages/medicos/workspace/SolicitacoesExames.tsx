import { useCallback, useEffect, useMemo, useState } from "react";
import { EXAMES_BUILTIN } from "../../../data/exames";
import { useApp } from "../../../store/AppContext";
import { api } from "../../../store/api";
import { Session } from "../../../store/auth";

const ESTADO_CFG: Record<string, { label: string; cls: string; dot: string }> =
  {
    pendente: {
      label: "Pendente",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    },
    em_processo: {
      label: "Em Processo",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
      dot: "bg-blue-500",
    },
    concluido: {
      label: "Concluído",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
    },
    cancelado: {
      label: "Cancelado",
      cls: "bg-red-50 text-red-600 border-red-200",
      dot: "bg-red-500",
    },
  };

type View = "dashboard" | "nova_solicitacao";

export default function SolicitacoesExames({ session }: { session?: Session }) {
  const { data } = useApp();
  const [view, setView] = useState<View>("dashboard");
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccess] = useState("");

  // ── Exam catalog ────────────────────────────────────────────────────────────
  const allExames = useMemo(() => {
    const merged: Record<string, Record<string, true>> = {};
    for (const [cat, sub] of Object.entries(EXAMES_BUILTIN)) {
      merged[cat] = merged[cat] ?? {};
      for (const n of Object.keys(sub)) merged[cat][n] = true;
    }
    for (const ex of data.examesCustomRaw ?? []) {
      const cat = ex.categoria || "Outros";
      merged[cat] = merged[cat] ?? {};
      merged[cat][ex.nome] = true;
    }
    return merged;
  }, [data.examesCustomRaw]);

  // ── Load my requests ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPedidos(await api.solicitacoes.listMedico());
    } catch {
      setSuccess(
        "Não foi possível carregar os pedidos de exames. Verifique a ligação ao servidor.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      pendentes: pedidos.filter((p) => p.estado === "pendente").length,
      processo: pedidos.filter((p) => p.estado === "em_processo").length,
      concluidos: pedidos.filter((p) => p.estado === "concluido").length,
      total: pedidos.length,
      pacientes: new Set(pedidos.map((p) => p.pacienteNome)).size,
    }),
    [pedidos],
  );

  // ── Nova solicitação form state ─────────────────────────────────────────────
  const [pacSearch, setPacSearch] = useState("");
  const [selPac, setSelPac] = useState<any | null>(null);
  const [manual, setManual] = useState({
    nome: "",
    nascimento: "",
    sexo: "M",
    bi: "",
    telefone: "",
  });
  const [useManual, setUseManual] = useState(false);
  const [selExames, setSelExames] = useState<Set<string>>(new Set());
  const [exSearch, setExSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [urgente, setUrgente] = useState(false);
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");

  const filteredPacs = useMemo(() => {
    const q = pacSearch.toLowerCase().trim();
    if (!q) return data.pacientes.slice(0, 8);
    return data.pacientes
      .filter(
        (p) =>
          p.nome?.toLowerCase().includes(q) || p.bi?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [data.pacientes, pacSearch]);

  const filteredExames = useMemo(() => {
    const q = exSearch.toLowerCase().trim();
    if (!q) return allExames;
    const r: Record<string, Record<string, true>> = {};
    for (const [cat, sub] of Object.entries(allExames)) {
      const names = Object.keys(sub).filter(
        (n) => n.toLowerCase().includes(q) || cat.toLowerCase().includes(q),
      );
      if (names.length) {
        r[cat] = {};
        names.forEach((n) => (r[cat][n] = true));
      }
    }
    return r;
  }, [allExames, exSearch]);

  function toggleExame(nome: string) {
    setSelExames((prev) => {
      const n = new Set(prev);
      n.has(nome) ? n.delete(nome) : n.add(nome);
      return n;
    });
  }
  function toggleAllCat(_cat: string, names: string[]) {
    const all = names.every((n) => selExames.has(n));
    setSelExames((prev) => {
      const n = new Set(prev);
      all ? names.forEach((x) => n.delete(x)) : names.forEach((x) => n.add(x));
      return n;
    });
  }
  function resetForm() {
    setPacSearch("");
    setSelPac(null);
    setUseManual(false);
    setManual({ nome: "", nascimento: "", sexo: "M", bi: "", telefone: "" });
    setSelExames(new Set());
    setExSearch("");
    setExpandedCats(new Set());
    setUrgente(false);
    setObs("");
    setFormErr("");
  }

  async function handleSubmit() {
    const nome = useManual ? manual.nome.trim() : selPac?.nome;
    if (!nome) {
      setFormErr("Seleccione ou preencha o paciente.");
      return;
    }
    if (selExames.size === 0) {
      setFormErr("Seleccione pelo menos um exame.");
      return;
    }
    setFormErr("");
    setSubmitting(true);
    try {
      await api.solicitacoes.createInterno({
        pacienteNome: nome,
        pacienteNascimento: useManual
          ? manual.nascimento
          : (selPac?.dataNascimento ?? selPac?.nasc ?? ""),
        pacienteSexo: useManual ? manual.sexo : (selPac?.sexo ?? ""),
        pacienteTelefone: useManual
          ? manual.telefone
          : (selPac?.telefone ?? ""),
        pacienteBi: useManual ? manual.bi : (selPac?.bi ?? ""),
        examesSolicitados: [...selExames],
        urgente,
        observacoes: obs,
      });
      setSuccess(`✓ Pedido enviado para ${nome}. A equipa será notificada.`);
      resetForm();
      setView("dashboard");
      load();
    } catch (e: any) {
      setFormErr(e?.message ?? "Erro ao enviar pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  const primary = "hsl(258 70% 55%)";

  // ── NOVA SOLICITAÇÃO VIEW ───────────────────────────────────────────────────
  if (view === "nova_solicitacao") {
    const canSubmit =
      (useManual ? manual.nome.trim() : selPac?.nome) && selExames.size > 0;
    return (
      <div className="p-5 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm();
              setView("dashboard");
            }}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
          >
            ← Portal Médico
          </button>
          <h2 className="text-xl font-bold" style={{ color: primary }}>
            Nova Solicitação de Exames
          </h2>
        </div>
        {formErr && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {formErr}
          </div>
        )}

        {/* Paciente */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ background: primary }}
              >
                1
              </span>
              Paciente
            </h3>
            <button
              onClick={() => {
                setUseManual((v) => !v);
                setSelPac(null);
                setPacSearch("");
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {useManual ? "↩ Procurar no sistema" : "+ Preencher manualmente"}
            </button>
          </div>
          {!useManual ? (
            <>
              <input
                value={pacSearch}
                onChange={(e) => {
                  setPacSearch(e.target.value);
                  setSelPac(null);
                }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Procurar paciente por nome ou BI..."
              />
              {!selPac && filteredPacs.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                  {filteredPacs.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelPac(p);
                        setPacSearch(p.nome);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent/30 transition text-sm flex items-center gap-3"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: `${primary}22`, color: primary }}
                      >
                        {p.nome?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p.nome}</div>
                        {(p.dataNascimento || p.bi) && (
                          <div className="text-xs text-muted-foreground">
                            {p.dataNascimento}
                            {p.bi ? ` · BI: ${p.bi}` : ""}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selPac && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-primary shrink-0"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-sm font-semibold flex-1">
                    {selPac.nome}
                  </span>
                  <button
                    onClick={() => {
                      setSelPac(null);
                      setPacSearch("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Nome completo *
                </label>
                <input
                  value={manual.nome}
                  onChange={(e) =>
                    setManual({ ...manual, nome: e.target.value })
                  }
                  className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Nome do paciente..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Data de Nascimento
                  </label>
                  <input
                    value={manual.nascimento}
                    onChange={(e) =>
                      setManual({ ...manual, nascimento: e.target.value })
                    }
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="DD/MM/AAAA"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Sexo
                  </label>
                  <select
                    value={manual.sexo}
                    onChange={(e) =>
                      setManual({ ...manual, sexo: e.target.value })
                    }
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    BI / Identificação
                  </label>
                  <input
                    value={manual.bi}
                    onChange={(e) =>
                      setManual({ ...manual, bi: e.target.value })
                    }
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="000000000AA000"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Telefone
                  </label>
                  <input
                    value={manual.telefone}
                    onChange={(e) =>
                      setManual({ ...manual, telefone: e.target.value })
                    }
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="9XX XXX XXX"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Exames */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ background: primary }}
              >
                2
              </span>
              Exames a solicitar
            </h3>
            {selExames.size > 0 && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${primary}22`, color: primary }}
              >
                {selExames.size} seleccionado{selExames.size > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {selExames.size > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 bg-primary/5 rounded-lg border border-primary/15">
              {[...selExames].map((ex) => (
                <span
                  key={ex}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium text-white"
                  style={{ background: primary }}
                >
                  {ex}
                  <button
                    onClick={() => toggleExame(ex)}
                    className="hover:opacity-70"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            value={exSearch}
            onChange={(e) => setExSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Procurar exame..."
          />
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {Object.entries(filteredExames).map(([cat, sub]) => {
              const names = Object.keys(sub);
              const expanded = expandedCats.has(cat) || exSearch.trim() !== "";
              const allSel = names.every((n) => selExames.has(n));
              const someSel = names.some((n) => selExames.has(n));
              return (
                <div
                  key={cat}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedCats((prev) => {
                        const n = new Set(prev);
                        n.has(cat) ? n.delete(cat) : n.add(cat);
                        return n;
                      })
                    }
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold hover:bg-accent/30 transition bg-secondary/30"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allSel}
                        ref={(el) => {
                          if (el) el.indeterminate = someSel && !allSel;
                        }}
                        onChange={() => toggleAllCat(cat, names)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded accent-primary w-3.5 h-3.5"
                      />
                      <span>{cat}</span>
                      <span className="text-muted-foreground font-normal">
                        ({names.length})
                      </span>
                    </div>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {expanded && (
                    <div className="divide-y divide-border/50">
                      {names.map((nome) => (
                        <label
                          key={nome}
                          className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer text-xs hover:bg-accent/20 transition ${selExames.has(nome) ? "bg-primary/5" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={selExames.has(nome)}
                            onChange={() => toggleExame(nome)}
                            className="rounded accent-primary w-3.5 h-3.5 shrink-0"
                          />
                          <span
                            className={
                              selExames.has(nome)
                                ? "font-semibold text-primary"
                                : ""
                            }
                          >
                            {nome}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Urgente + Notas */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
              style={{ background: primary }}
            >
              3
            </span>
            Notas clínicas
          </h3>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setUrgente((v) => !v)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${urgente ? "justify-end" : "justify-start"}`}
              style={{
                background: urgente ? "hsl(0 72% 55%)" : "hsl(210 15% 80%)",
              }}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </div>
            <div>
              <div className="text-sm font-semibold">Pedido Urgente</div>
              <div className="text-xs text-muted-foreground">
                Prioridade máxima no laboratório
              </div>
            </div>
          </label>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Observações clínicas
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Ex: Suspeita de anemia, avaliar hemograma e ferro sérico..."
            />
          </div>
        </div>

        <div className="flex gap-3 pb-6">
          <button
            onClick={() => {
              resetForm();
              setView("dashboard");
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border hover:bg-secondary transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-40"
            style={{ background: primary }}
          >
            {submitting ? (
              <>
                <svg
                  className="animate-spin"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>{" "}
                A enviar...
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>{" "}
                Enviar Pedido
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── DASHBOARD VIEW ──────────────────────────────────────────────────────────
  const recentPedidos = pedidos
    .slice()
    .sort((a, b) => (b.data > a.data ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="p-5 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">Portal Médico</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bem-vindo,{" "}
            <strong>
              {session?.funcionarioNome || session?.username || "Dr."}
            </strong>
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setView("nova_solicitacao");
          }}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white hover:opacity-90 transition"
          style={{ background: primary }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Solicitar Exames
        </button>
      </div>

      {successMsg && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="mt-0.5 shrink-0 text-emerald-600"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="flex-1">{successMsg}</span>
          <button
            onClick={() => setSuccess("")}
            className="text-emerald-500 hover:text-emerald-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total de Pedidos",
            value: stats.total,
            icon: "📋",
            color: "from-violet-500 to-violet-700",
          },
          {
            label: "Pendentes",
            value: stats.pendentes,
            icon: "⏳",
            color: "from-amber-400 to-amber-600",
          },
          {
            label: "Em Processo",
            value: stats.processo,
            icon: "🔬",
            color: "from-blue-500 to-blue-700",
          },
          {
            label: "Concluídos",
            value: stats.concluidos,
            icon: "✅",
            color: "from-emerald-500 to-emerald-700",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl p-4 text-white bg-gradient-to-br ${s.color}`}
          >
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold tabular-nums">
              {loading ? "…" : s.value}
            </div>
            <div className="text-xs opacity-80 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent requests */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <span className="font-bold text-sm">Pedidos Recentes</span>
          <button
            onClick={load}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Actualizar
          </button>
        </div>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            A carregar...
          </div>
        ) : recentPedidos.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">🩺</div>
            <p className="text-sm text-muted-foreground font-medium">
              Ainda não fez nenhum pedido.
            </p>
            <button
              onClick={() => {
                resetForm();
                setView("nova_solicitacao");
              }}
              className="mt-3 text-sm font-semibold px-4 py-2 rounded-xl text-white hover:opacity-90"
              style={{ background: primary }}
            >
              Criar primeiro pedido
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentPedidos.map((ped) => {
              const cfg = ESTADO_CFG[ped.estado] ?? {
                label: ped.estado,
                cls: "bg-gray-100 text-gray-600 border-gray-200",
                dot: "bg-gray-400",
              };
              return (
                <div
                  key={ped.id}
                  className="px-5 py-3.5 flex items-start gap-3 hover:bg-accent/20 transition"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: `${primary}18`, color: primary }}
                  >
                    {ped.pacienteNome?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {ped.pacienteNome}
                      </span>
                      {ped.urgente && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                          URG
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.cls}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {ped.data}
                      {ped.hora ? ` · ${ped.hora}` : ""}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(ped.examesSolicitados ?? [])
                        .slice(0, 4)
                        .map((e: string) => (
                          <span
                            key={e}
                            className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                          >
                            {e}
                          </span>
                        ))}
                      {(ped.examesSolicitados ?? []).length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{ped.examesSolicitados.length - 4} mais
                        </span>
                      )}
                    </div>
                  </div>
                  {ped.estado === "concluido" && (
                    <span className="text-xs text-emerald-600 font-semibold shrink-0 flex items-center gap-1">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Resultado
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Patients from DB */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <span className="font-bold text-sm">Pacientes no Sistema</span>
          <span className="ml-2 text-xs text-muted-foreground">
            ({data.pacientes.length})
          </span>
        </div>
        {data.pacientes.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhum paciente registado.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-56 overflow-y-auto">
            {data.pacientes.slice(0, 20).map((p: any) => (
              <div
                key={p.id}
                className="px-5 py-3 flex items-center gap-3 hover:bg-accent/20 transition"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: `${primary}15`, color: primary }}
                >
                  {p.nome?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.dataNascimento}
                    {p.dataNascimento && p.sexo ? " · " : ""}
                    {p.sexo === "M"
                      ? "Masculino"
                      : p.sexo === "F"
                        ? "Feminino"
                        : ""}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelPac(p);
                    setPacSearch(p.nome);
                    setUseManual(false);
                    setView("nova_solicitacao");
                  }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-border hover:bg-secondary transition flex-shrink-0"
                >
                  Solicitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

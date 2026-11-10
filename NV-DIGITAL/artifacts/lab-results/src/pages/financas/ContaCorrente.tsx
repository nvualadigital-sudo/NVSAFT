import { useState, useRef } from "react";
import { useApp } from "../../store/AppContext";
import { formatCurrency } from "../../store/storage";
import { Session } from "../../store/auth";

import { inputNumber } from "../../modules/faturacao/utils/billingNumbers";
import { escapeLedgerText as esc, ledgerDate, ledgerTotals } from "../../utils/cashLedger";

export function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const CATEGORIAS_ENTRADA = [
  "Faturação",
  "Consulta",
  "Análises",
  "Subsídio",
  "Transferência",
  "Outro",
];
const CATEGORIAS_SAIDA = [
  "Salários",
  "Fornecedores",
  "Material de Consumo",
  "Rendas",
  "Electricidade/Água",
  "Telecomunicações",
  "Equipamento",
  "Manutenção",
  "Impostos / AGT",
  "Seguros",
  "Publicidade",
  "Formação",
  "Limpeza",
  "Refeições / Representação",
  "Outro",
];

export function gerarExtratoHTML(
  movimentos: any[],
  totalEntradas: number,
  totalSaidas: number,
  saldo: number,
  moeda: string,
  config: any,
  filtroDesc: string,
) {
  const now = todayStr();
  const money=(n:number)=>esc(formatCurrency(n,moeda));
  const rows = movimentos
    .map(
      (m) => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:7px 10px;font-size:12px;">${esc(m.data)}</td>
      <td style="padding:7px 10px;font-size:12px;">${esc(m.descricao)}</td>
      <td style="padding:7px 10px;font-size:12px;color:#6b7280;">${esc(m.categoria || "")}</td>
      <td style="padding:7px 10px;font-size:12px;color:#6b7280;">${esc(m.referencia || "—")}</td>
      <td style="padding:7px 10px;font-size:12px;text-align:center;">
        <span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;
          background:${m.tipo === "entrada" ? "#dcfce7" : "#fee2e2"};
          color:${m.tipo === "entrada" ? "#15803d" : "#b91c1c"};">
          ${m.tipo === "entrada" ? "Entrada" : "Saída"}
        </span>
      </td>
      <td style="padding:7px 10px;font-size:12px;text-align:right;font-weight:700;
        color:${m.tipo === "entrada" ? "#15803d" : "#b91c1c"};">
        ${m.tipo === "entrada" ? "+" : "-"}${money(m.valor)}
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8"/>
  <title>Extrato de Conta Corrente</title>
  <style>
    @media print { @page { margin: 18mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #111; background: #fff; }
    h1 { font-size: 20px; font-weight: 800; }
    h2 { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
  </style>
</head>
<body>
  <div style="max-width:800px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e5e7eb;">
      <div>
        <h1>${esc(config.nomeClinica || "Laboratório")}</h1>
        ${config.nif ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">NIF: ${esc(config.nif)}</div>` : ""}
        ${config.endereco ? `<div style="font-size:12px;color:#6b7280;">${esc(config.endereco)}</div>` : ""}
        ${config.telefone ? `<div style="font-size:12px;color:#6b7280;">Tel: ${esc(config.telefone)}</div>` : ""}
      </div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:800;color:#7c3aed;margin-bottom:4px;">EXTRATO DE CONTA CORRENTE</div>
        <div style="font-size:12px;color:#6b7280;">Emitido em: ${now}</div>
        ${filtroDesc ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">${esc(filtroDesc)}</div>` : ""}
      </div>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;">
        <div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total Entradas</div>
        <div style="font-size:20px;font-weight:800;color:#15803d;">${money(totalEntradas)}</div>
        <div style="font-size:11px;color:#16a34a;margin-top:2px;">${movimentos.filter((m) => m.tipo === "entrada").length} movimentos</div>
      </div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;">
        <div style="font-size:10px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total Saídas</div>
        <div style="font-size:20px;font-weight:800;color:#b91c1c;">${money(totalSaidas)}</div>
        <div style="font-size:11px;color:#dc2626;margin-top:2px;">${movimentos.filter((m) => m.tipo === "saida").length} movimentos</div>
      </div>
      <div style="background:${saldo >= 0 ? "#f5f3ff" : "#fef2f2"};border:1px solid ${saldo >= 0 ? "#ddd6fe" : "#fecaca"};border-radius:10px;padding:14px;">
        <div style="font-size:10px;font-weight:700;color:${saldo >= 0 ? "#7c3aed" : "#b91c1c"};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Saldo</div>
        <div style="font-size:20px;font-weight:800;color:${saldo >= 0 ? "#7c3aed" : "#b91c1c"};">${money(saldo)}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">${saldo >= 0 ? "Saldo positivo" : "Saldo negativo"}</div>
      </div>
    </div>

    <!-- Movements table -->
    <h2>Movimentos (${movimentos.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="width:90px;">Data</th>
          <th>Descrição</th>
          <th style="width:120px;">Categoria</th>
          <th style="width:100px;">Referência</th>
          <th style="width:70px;text-align:center;">Tipo</th>
          <th style="width:110px;text-align:right;">Valor</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#9ca3af;">Nenhum movimento</td></tr>'}</tbody>
      <tfoot>
        <tr style="background:#f9fafb;border-top:2px solid #e5e7eb;">
          <td colspan="4" style="padding:10px;font-size:12px;font-weight:700;">Totais do extrato</td>
          <td style="padding:10px;text-align:center;font-size:12px;"></td>
          <td style="padding:10px;text-align:right;font-size:13px;font-weight:800;color:${saldo >= 0 ? "#7c3aed" : "#b91c1c"};">
            Saldo: ${money(saldo)}
          </td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;">
      ${esc(config.nomeClinica || "")} · Conta Corrente · Gerado em ${now}
    </div>
  </div>
</body>
</html>`;
}

export default function ContaCorrente({ session }: { session: Session }) {
  const { data, addMovimento, removeMovimento, loadError } = useApp();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const submission=useRef<{fingerprint:string;id:string}|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "entrada" | "saida">(
    "todos",
  );
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const moeda = data.config.moeda || "AOA";
  const hoje = todayStr();

  const [form, setForm] = useState({
    data: hoje,
    descricao: "",
    tipo: "entrada" as "entrada" | "saida",
    valor: "",
    categoria: "",
    referencia: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim()) {
      alert("A descrição é obrigatória.");
      return;
    }
    const v = inputNumber(form.valor);
    if (!Number.isFinite(v) || v <= 0 || Math.abs(v*100-Math.round(v*100))>0.0001 || !ledgerDate(form.data)) {
      alert("Insira um valor válido.");
      return;
    }
    if(lock.current)return;
    lock.current=true;setBusy(true);setError("");
    const fingerprint=JSON.stringify({...form,valor:v});
    if(submission.current?.fingerprint!==fingerprint) submission.current={fingerprint,id:crypto.randomUUID()};
    try {
    await addMovimento({
      requestId: submission.current.id,
      data: form.data,
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      valor: v,
      categoria: form.categoria.trim() || "Geral",
      referencia: form.referencia.trim(),
      registadoPor: session.funcionarioNome || session.username,
    });
    setForm({
      data: hoje,
      descricao: "",
      tipo: "entrada",
      valor: "",
      categoria: "",
      referencia: "",
    });
    setShowForm(false);
    submission.current=null;
    } catch(e){setError(e instanceof Error ? e.message : "O servidor não confirmou o movimento.");}
    finally{lock.current=false;setBusy(false);}
  }

  const {incoming:totalEntradas,outgoing:totalSaidas,balance:saldo}=ledgerTotals(data.movimentosCC);

  const allCategorias = [
    ...new Set(data.movimentosCC.map((m) => m.categoria).filter(Boolean)),
  ].sort();

  const filtered = [...data.movimentosCC].sort((a,b)=>ledgerDate(b.data).localeCompare(ledgerDate(a.data))||b.id-a.id).filter((m) => {
    const matchSearch =
      !search ||
      String(m.descricao || "").toLowerCase().includes(search.toLowerCase()) ||
      String(m.referencia || "").toLowerCase().includes(search.toLowerCase()) ||
      String(m.categoria || "").toLowerCase().includes(search.toLowerCase());
    const matchTipo = filtroTipo === "todos" || m.tipo === filtroTipo;
    const matchCat = !filtroCategoria || m.categoria === filtroCategoria;
    return matchSearch && matchTipo && matchCat;
  });

  const {incoming:filtEntradas,outgoing:filtSaidas,balance:filtSaldo}=ledgerTotals(filtered);

  function handleImprimir() {
    const parts: string[] = [];
    if (filtroTipo !== "todos")
      parts.push(
        filtroTipo === "entrada" ? "Apenas Entradas" : "Apenas Saídas",
      );
    if (filtroCategoria) parts.push(`Categoria: ${filtroCategoria}`);
    if (search) parts.push(`Pesquisa: "${search}"`);
    const filtroDesc =
      parts.length > 0 ? `Filtros activos: ${parts.join(" · ")}` : "";

    const html = gerarExtratoHTML(
      filtered,
      filtEntradas,
      filtSaidas,
      filtSaldo,
      moeda,
      data.config,
      filtroDesc,
    );
    const w = window.open("", "_blank");
    if (!w) {setError("Permita a janela de impressão.");return;}
    w.opener=null;
    w.onload = () => { w.print(); };
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="p-5 space-y-5">
      {(error || loadError) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error || loadError}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-primary">Conta Corrente</h2>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Imprimir Extrato
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            {showForm ? "Fechar" : "+ Novo Movimento"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
            Total Entradas
          </div>
          <div className="text-2xl font-bold text-green-700">
            {formatCurrency(totalEntradas, moeda)}
          </div>
          <div className="text-xs text-green-600 mt-1">
            {data.movimentosCC.filter((m) => m.tipo === "entrada").length}{" "}
            movimentos
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
            Total Saídas
          </div>
          <div className="text-2xl font-bold text-red-700">
            {formatCurrency(totalSaidas, moeda)}
          </div>
          <div className="text-xs text-red-600 mt-1">
            {data.movimentosCC.filter((m) => m.tipo === "saida").length}{" "}
            movimentos
          </div>
        </div>
        <div
          className={`border rounded-xl p-5 ${saldo >= 0 ? "bg-primary/5 border-primary/20" : "bg-red-50 border-red-200"}`}
        >
          <div
            className={`text-xs font-semibold uppercase tracking-wide mb-1 ${saldo >= 0 ? "text-primary" : "text-red-700"}`}
          >
            Saldo
          </div>
          <div
            className={`text-2xl font-bold ${saldo >= 0 ? "text-primary" : "text-red-700"}`}
          >
            {formatCurrency(saldo, moeda)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.movimentosCC.length} movimentos no total
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-4">
            Registar Movimento
          </h3>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo *
              </label>
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, tipo: "entrada", categoria: "" })
                  }
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${form.tipo === "entrada" ? "bg-green-600 text-white" : "bg-white text-muted-foreground hover:bg-accent"}`}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, tipo: "saida", categoria: "" })
                  }
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${form.tipo === "saida" ? "bg-red-600 text-white" : "bg-white text-muted-foreground hover:bg-accent"}`}
                >
                  Saída
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Data
              </label>
              <input
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="DD/MM/AAAA"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Valor ({moeda}) *
              </label>
              <input
                type="number"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="0.00"
                min={0}
                step="0.01"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Descrição *
              </label>
              <input
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Descrição do movimento"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Categoria
              </label>
              <select
                value={form.categoria}
                onChange={(e) =>
                  setForm({ ...form, categoria: e.target.value })
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Seleccionar...</option>
                {(form.tipo === "entrada"
                  ? CATEGORIAS_ENTRADA
                  : CATEGORIAS_SAIDA
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Referência
              </label>
              <input
                value={form.referencia}
                onChange={(e) =>
                  setForm({ ...form, referencia: e.target.value })
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ex: FAT-001, Cheque #..."
              />
            </div>
            <div className="sm:col-span-3 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
              >
                Registar Movimento
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex rounded-lg overflow-hidden border border-border text-xs">
            {(["todos", "entrada", "saida"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 font-semibold transition-colors ${
                  filtroTipo === t
                    ? t === "entrada"
                      ? "bg-green-600 text-white"
                      : t === "saida"
                        ? "bg-red-600 text-white"
                        : "bg-primary text-white"
                    : "bg-white text-muted-foreground hover:bg-accent"
                }`}
              >
                {t === "todos"
                  ? "Todos"
                  : t === "entrada"
                    ? "Entradas"
                    : "Saídas"}
              </button>
            ))}
          </div>
          {allCategorias.length > 0 && (
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"
            >
              <option value="">Todas as categorias</option>
              {allCategorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar..."
            className="ml-auto border border-border rounded-lg px-3 py-1.5 text-xs w-44 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold">Movimentos ({filtered.length})</h3>
          {filtered.length > 0 && (
            <button
              onClick={handleImprimir}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Imprimir ({filtered.length})
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">
                  Data
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">
                  Descrição
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">
                  Categoria
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs">
                  Referência
                </th>
                <th className="text-center px-4 py-2.5 font-semibold text-xs">
                  Tipo
                </th>
                <th className="text-right px-4 py-2.5 font-semibold text-xs">
                  Valor
                </th>
                <th className="px-4 py-2.5 text-xs"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-muted-foreground text-sm"
                  >
                    Nenhum movimento encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-border hover:bg-accent/20 transition-colors"
                >
                  <td className="px-4 py-2.5 text-xs">{m.data}</td>
                  <td className="px-4 py-2.5 text-xs font-medium">
                    {m.descricao}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {m.categoria}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                    {m.referencia || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.tipo === "entrada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {m.tipo === "entrada" ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-2.5 text-xs text-right font-bold ${m.tipo === "entrada" ? "text-green-700" : "text-red-700"}`}
                  >
                    {m.tipo === "entrada" ? "+" : "-"}
                    {formatCurrency(m.valor, moeda)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      disabled={busy || Boolean(m.faturaId)}
                      title={m.faturaId ? "Recebimento vinculado: rectificar pela conta do pagador" : "Eliminar movimento manual"}
                      onClick={async () => {
                        if(lock.current || !window.confirm("Eliminar este movimento manual? O registo é conservado na auditoria."))return;
                        lock.current=true;setBusy(true);setError("");
                        try{await removeMovimento(m.id);}catch(e){setError(e instanceof Error ? e.message : "Eliminação não confirmada.");}
                        finally{lock.current=false;setBusy(false);}
                      }}
                      className="bg-red-500 text-white text-xs px-2.5 py-1 rounded font-semibold hover:bg-red-600 transition"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 bg-secondary/50 border-t border-border flex justify-end gap-6 text-xs font-semibold">
            <span className="text-green-700">
              Entradas: {formatCurrency(filtEntradas, moeda)}
            </span>
            <span className="text-red-700">
              Saídas: {formatCurrency(filtSaidas, moeda)}
            </span>
            <span className={filtSaldo >= 0 ? "text-primary" : "text-red-700"}>
              Saldo: {formatCurrency(filtSaldo, moeda)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

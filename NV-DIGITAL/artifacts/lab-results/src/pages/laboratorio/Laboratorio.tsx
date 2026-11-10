import { useState } from "react";
import {
  ClipboardList,
  FlaskConical,
  FileCheck2,
  Settings2,
  ScanLine,
  ArrowLeft,
} from "lucide-react";
import type { Session } from "../../store/auth";
import { hospitalApi } from "../../store/hospital";
import LancarResultados from "./LancarResultados";
import CadastrarExames from "./CadastrarExames";
import CircuitoLaboratorial from "./CircuitoLaboratorial";
import ResultadosProntos from "./ResultadosProntos";
import type { ReportDetail } from "./relatorios";
import "./laboratorio.css";

export default function Laboratorio({
  session,
  initialPatientId,
  initialEpisodeId,
}: {
  session: Session;
  initialPatientId?: number;
  initialEpisodeId?: string;
}) {
  const canWrite = ["admin", "gestor", "tecnico"].includes(
    session.funcao || "",
  );
  const [tab, setTab] = useState(
    initialPatientId || !canWrite ? "circuito" : "lancamento",
  );
  const [editing, setEditing] = useState<ReportDetail | null>(null),
    [selected, setSelected] = useState<number | null>(null);
  const [order, setOrder] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  function navigate(key: string) {
    if (editing && !confirm("Sair da edição sem guardar as alterações?"))
      return;
    setEditing(null);
    setError("");
    setTab(key);
  }
  async function edit(id: number) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const detail = await hospitalApi<ReportDetail>(
        "GET",
        "/lab/reports/" + id,
      );
      if (detail.managed) {
        setOrder(detail.managed.orderId);
        setTab("circuito");
        return;
      }
      if (!detail.canEdit)
        throw new Error("A sua função não pode editar resultados.");
      setEditing(detail);
      setTab("lancamento");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível abrir o resultado.",
      );
    } finally {
      setLoading(false);
    }
  }
  const tabs = [
    ...(canWrite
      ? [{ id: "lancamento", label: "Lançar Resultados", Icon: ClipboardList }]
      : []),
    { id: "prontos", label: "Resultados Prontos / Revisão", Icon: FileCheck2 },
    ...(canWrite
      ? [{ id: "exames", label: "Cadastrar Exames", Icon: Settings2 }]
      : []),
    {
      id: "circuito",
      label: "Amostras, qualidade e catálogo técnico",
      Icon: ScanLine,
    },
  ];
  return (
    <section
      className="lab-workspace"
      style={{
        fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
        minWidth: 0,
      }}
    >
      <header
        className="lab-module-header border-b bg-white px-6 pt-5"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="rounded-sm p-3 text-white"
              style={{ background: "#0d7a8a" }}
            >
              <FlaskConical size={24} />
            </div>
            <div>
              <h1 className="text-xl font-light text-gray-600">Laboratório</h1>
              <p className="mt-1 text-xs text-gray-500">
                {session.empresaNome || "Instituição"} · Resultados, exames e
                configurações
              </p>
            </div>
          </div>
          {editing && (
            <button
              className="flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold"
              onClick={() => navigate("prontos")}
            >
              <ArrowLeft size={14} />
              Voltar aos resultados
            </button>
          )}
        </div>
        <nav
          aria-label="Módulos do laboratório"
          className="lab-module-tabs flex flex-wrap gap-1"
        >
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? "page" : undefined}
              disabled={loading}
              className="flex items-center gap-2 rounded-t-sm border px-4 py-3 text-xs font-semibold"
              style={{
                background: tab === id ? "#1e3a3a" : "#f5f6f7",
                color: tab === id ? "#fff" : "#0d7a8a",
                borderColor: "#e5e7eb",
              }}
              onClick={() => navigate(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </header>
      {error && (
        <p
          role="alert"
          className="m-5 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="px-6 pt-3 text-sm text-gray-500">
          A abrir o resultado da instituição…
        </p>
      )}
      {tab === "lancamento" && (
        <LancarResultados
          key={editing ? editing.result.id + ":" + editing.version : "novo"}
          session={session}
          initialReport={editing || undefined}
          onSaved={(id) => {
            setSelected(id);
            setEditing(null);
            setTab("prontos");
          }}
          onOpenReport={(id) => {
            setSelected(id);
            setTab("prontos");
          }}
          onCancel={() => {
            setEditing(null);
            setTab("prontos");
          }}
        />
      )}
      {tab === "exames" && <CadastrarExames />}
      {tab === "prontos" && (
        <ResultadosProntos
          selected={selected}
          onSelect={setSelected}
          onEdit={(id) => void edit(id)}
        />
      )}
      {tab === "circuito" && (
        <CircuitoLaboratorial
          key={order || "circuito"}
          session={session}
          initialPatientId={initialPatientId}
          initialEpisodeId={initialEpisodeId}
          initialOrderId={order || undefined}
        />
      )}
    </section>
  );
}

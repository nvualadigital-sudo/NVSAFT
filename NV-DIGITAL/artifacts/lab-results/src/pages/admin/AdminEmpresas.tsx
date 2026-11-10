import AdminFuncionarios from "./AdminFuncionarios";
import { loadSession } from "../../store/auth";
import { useState, useEffect, useCallback } from "react";
import { api } from "../../store/api";

const MODULOS_OPTIONS = [
  {
    key: "laboratorial",
    label: "Laboratório de Análises Clínicas",
    icon: "🧪",
    color: "#0ea5e9",
  },
  {
    key: "hospitalar",
    label: "Gestão Hospitalar",
    icon: "🏥",
    color: "#10b981",
  },
  { key: "escolar", label: "Gestão Escolar", icon: "🎓", color: "#8b5cf6" },
];

const emptyEmpForm = {
  nome: "",
  nif: "",
  username: "",
  password: "",
  ativo: true,
  modulos: ["laboratorial"] as string[],
};
const emptyParForm = {
  nome: "",
  instituicao: "",
  username: "",
  password: "",
  email: "",
  telefone: "",
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`text-xs px-2 py-1 rounded font-semibold transition flex-shrink-0 ${copied ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
    >
      {copied ? "✓ Copiado" : "Copiar"}
    </button>
  );
}

function UrlBox({
  label,
  url,
  color,
}: {
  label: string;
  url: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <span className="text-xs font-semibold text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-xs bg-gray-50 border border-border rounded-lg px-3 py-2 font-mono break-all select-all text-gray-700 truncate">
          {url}
        </div>
        <CopyButton value={url} />
      </div>
    </div>
  );
}

const inp =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white";

export default function AdminEmpresas({ onLogout }: { onLogout: () => void }) {
  const origin = window.location.origin;

  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empForm, setEmpForm] = useState(emptyEmpForm);
  const [editEmpId, setEditEmpId] = useState<string | null>(null);
  const [showEmpPass, setShowEmpPass] = useState(false);
  const [empMsg, setEmpMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [loadingEmps, setLoadingEmps] = useState(true);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(
    null,
  );
  const [empTab, setEmpTab] = useState<"funcionarios" | "parceiros">(
    "funcionarios",
  );

  // Funcionários
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  // Parceiros
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [parForm, setParForm] = useState(emptyParForm);
  const [editParId, setEditParId] = useState<string | null>(null);
  const [showParPass, setShowParPass] = useState(false);
  const [parMsg, setParMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const loadEmpresas = useCallback(async () => {
    setLoadingEmps(true);
    try {
      const list = await api.empresas.list();
      setEmpresas(list);
    } finally {
      setLoadingEmps(false);
    }
  }, []);

  useEffect(() => {
    loadEmpresas();
  }, [loadEmpresas]);

  async function handleEmpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !empForm.nome.trim() ||
      !empForm.username.trim() ||
      (!editEmpId && !empForm.password.trim())
    ) {
      setEmpMsg({ text: "Preencha todos os campos obrigatórios.", ok: false });
      return;
    }
    if (empForm.modulos.length === 0) {
      setEmpMsg({ text: "Seleccione pelo menos um módulo.", ok: false });
      return;
    }
    try {
      if (editEmpId) {
        await api.empresas.update(editEmpId, empForm);
        setEmpMsg({ text: "Empresa actualizada.", ok: true });
      } else {
        await api.empresas.create(empForm);
        setEmpMsg({ text: `Empresa "${empForm.nome}" criada.`, ok: true });
      }
      setEmpForm(emptyEmpForm);
      setEditEmpId(null);
      await loadEmpresas();
    } catch (err: any) {
      setEmpMsg({ text: err.message || "Erro ao guardar empresa.", ok: false });
    }
  }

  async function openEmpresa(empresa: any) {
    setSelectedEmpresaId(empresa.id);
    setEmpTab("funcionarios");
    setParForm(emptyParForm);
    setEditParId(null);
    setParMsg(null);
    const [fncs, pars] = await Promise.all([
      api.empresas.listFuncionarios(empresa.id),
      api.empresas.listParceiros(empresa.id),
    ]);
    setFuncionarios(fncs);
    setParceiros(pars);
  }

  async function handleParSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !parForm.nome.trim() ||
      !parForm.username.trim() ||
      (!editParId && !parForm.password.trim())
    ) {
      setParMsg({
        text: "Nome, utilizador e palavra-passe são obrigatórios.",
        ok: false,
      });
      return;
    }
    try {
      if (editParId) {
        await api.empresas.updateParceiro(
          selectedEmpresaId!,
          editParId,
          parForm,
        );
        setParMsg({ text: "Parceiro actualizado.", ok: true });
      } else {
        await api.empresas.createParceiro(selectedEmpresaId!, parForm);
        setParMsg({
          text: `Parceiro "${parForm.nome}" criado. Link: ${origin}/parceiro`,
          ok: true,
        });
      }
      setParForm(emptyParForm);
      setEditParId(null);
      setParceiros(await api.empresas.listParceiros(selectedEmpresaId!));
    } catch (err: any) {
      setParMsg({ text: err.message || "Erro.", ok: false });
    }
  }

  async function toggleEmpresa(emp: any) {
    await api.empresas.update(emp.id, { ...emp, ativo: !emp.ativo });
    await loadEmpresas();
  }

  async function deleteEmpresa(id: string) {
    if (!window.confirm("Eliminar empresa e todos os seus dados?")) return;
    await api.empresas.delete(id);
    if (selectedEmpresaId === id) setSelectedEmpresaId(null);
    await loadEmpresas();
  }

  async function toggleParceiro(p: any) {
    await api.empresas.updateParceiro(selectedEmpresaId!, p.id, {
      ...p,
      ativo: !p.ativo,
    });
    setParceiros(await api.empresas.listParceiros(selectedEmpresaId!));
  }
  async function deleteParceiro(pid: string) {
    if (!window.confirm("Eliminar parceiro?")) return;
    await api.empresas.deleteParceiro(selectedEmpresaId!, pid);
    setParceiros(await api.empresas.listParceiros(selectedEmpresaId!));
  }

  const selectedEmpresa = empresas.find((e) => e.id === selectedEmpresaId);

  return (
    <div className="min-h-screen bg-background">
      <header
        className="flex items-center gap-4 px-6 py-4 shadow-sm"
        style={{ background: "hsl(220 70% 25%)" }}
      >
        <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
          </svg>
        </div>
        <div>
          <div className="text-white font-bold text-base">
            Painel do Desenvolvedor
          </div>
          <div className="text-white/70 text-xs">
            Gestão de Empresas / Laboratórios
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a
            href="/"
            className="text-white/70 hover:text-white text-xs font-semibold transition"
          >
            Portal Empresas
          </a>
          <a
            href="/parceiro"
            className="text-white/70 hover:text-white text-xs font-semibold transition"
          >
            Portal Parceiros
          </a>
          <button
            onClick={onLogout}
            className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-primary">
              {empresas.length}
            </div>
            <div className="text-xs text-muted-foreground">
              Empresas Registadas
            </div>
          </div>
          <div className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {empresas.filter((e) => e.ativo).length}
            </div>
            <div className="text-xs text-muted-foreground">Activas</div>
          </div>
          <div className="bg-white border border-border rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-400">
              {empresas.filter((e) => !e.ativo).length}
            </div>
            <div className="text-xs text-muted-foreground">Inactivas</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Create empresa form */}
          <div className="lg:col-span-2 bg-white border border-border rounded-xl shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-primary uppercase tracking-wide mb-4">
                {editEmpId ? "Editar Empresa" : "Nova Empresa / Laboratório"}
              </h2>
              <form onSubmit={handleEmpSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Nome da Empresa *
                  </label>
                  <input
                    value={empForm.nome}
                    onChange={(e) =>
                      setEmpForm({ ...empForm, nome: e.target.value })
                    }
                    className={inp}
                    placeholder="Ex: Laboratório Central"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    NIF da Empresa
                  </label>
                  <input
                    value={empForm.nif}
                    onChange={(e) =>
                      setEmpForm({ ...empForm, nif: e.target.value })
                    }
                    className={inp}
                    placeholder="NIF para faturação AGT"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Utilizador (login admin) *
                  </label>
                  <input
                    value={empForm.username}
                    onChange={(e) =>
                      setEmpForm({ ...empForm, username: e.target.value })
                    }
                    className={inp}
                    placeholder="Ex: labcentral"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Palavra-passe {editEmpId ? "" : "*"}
                  </label>
                  <div className="relative">
                    <input
                      type={showEmpPass ? "text" : "password"}
                      value={empForm.password}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, password: e.target.value })
                      }
                      className={inp + " pr-9"}
                      placeholder={
                        editEmpId
                          ? "Deixar em branco para manter a actual"
                          : "Palavra-passe segura"
                      }
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmpPass(!showEmpPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
                    >
                      {showEmpPass ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                {/* Módulos */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Módulos Activos *
                  </label>
                  <div className="space-y-2">
                    {MODULOS_OPTIONS.map((m) => {
                      const checked = empForm.modulos.includes(m.key);
                      return (
                        <label
                          key={m.key}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all select-none ${checked ? "border-primary/40 bg-primary/5" : "border-border bg-gray-50 hover:bg-gray-100"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(ev) => {
                              const next = ev.target.checked
                                ? [...empForm.modulos, m.key]
                                : empForm.modulos.filter((x) => x !== m.key);
                              setEmpForm({ ...empForm, modulos: next });
                            }}
                            style={{ accentColor: m.color }}
                            className="w-4 h-4 flex-shrink-0"
                          />
                          <span className="text-lg leading-none">{m.icon}</span>
                          <span
                            className={`text-xs font-semibold ${checked ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {m.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {editEmpId && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={empForm.ativo}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, ativo: e.target.checked })
                      }
                      style={{ accentColor: "hsl(var(--primary))" }}
                    />
                    Conta activa
                  </label>
                )}
                {empMsg && (
                  <div
                    className={`text-xs rounded-lg px-3 py-2 ${empMsg.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}
                  >
                    {empMsg.text}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
                  >
                    {editEmpId ? "Guardar" : "Criar Empresa"}
                  </button>
                  {editEmpId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpForm(emptyEmpForm);
                        setEditEmpId(null);
                        setEmpMsg(null);
                      }}
                      className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* URLs to share */}
            <div className="border-t border-border pt-5 space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Links para Partilhar
              </h3>
              <UrlBox
                label="Portal das Empresas (partilhe com o laboratório)"
                url={`${origin}/`}
                color="hsl(162 60% 38%)"
              />
              <UrlBox
                label="Portal de Parceiros (clínicas / médicos)"
                url={`${origin}/parceiro`}
                color="hsl(258 70% 55%)"
              />
              <UrlBox
                label="Painel do Desenvolvedor (uso interno)"
                url={`${origin}/admin`}
                color="hsl(215 80% 50%)"
              />
            </div>
          </div>

          {/* Empresa list */}
          <div className="lg:col-span-3 bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-bold">
                Empresas Registadas ({empresas.length})
              </h2>
            </div>
            {loadingEmps ? (
              <div className="py-14 text-center text-muted-foreground text-sm">
                A carregar...
              </div>
            ) : empresas.length === 0 ? (
              <div className="py-14 text-center text-muted-foreground text-sm">
                Nenhuma empresa registada. Crie a primeira ao lado.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {empresas.map((emp) => (
                  <div
                    key={emp.id}
                    className={`flex items-center gap-3 px-5 py-4 hover:bg-accent/20 transition-colors ${selectedEmpresaId === emp.id ? "bg-primary/5 border-l-4 border-primary" : ""}`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{
                        background: emp.ativo
                          ? "hsl(var(--primary))"
                          : "#9ca3af",
                      }}
                    >
                      {emp.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {emp.nome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{emp.username} {emp.nif ? `· NIF: ${emp.nif}` : ""}
                      </div>
                      {Array.isArray(emp.modulos) && emp.modulos.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {emp.modulos.map((mk: string) => {
                            const m = MODULOS_OPTIONS.find((o) => o.key === mk);
                            if (!m) return null;
                            return (
                              <span
                                key={mk}
                                className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                style={{
                                  background: m.color + "20",
                                  color: m.color,
                                }}
                              >
                                {m.icon} {m.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${emp.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {emp.ativo ? "Activa" : "Inactiva"}
                    </span>
                    <div className="flex gap-1.5 text-xs flex-shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => openEmpresa(emp)}
                        className="bg-primary text-primary-foreground px-2.5 py-1 rounded font-semibold hover:opacity-90 transition"
                      >
                        Gerir
                      </button>
                      <button
                        onClick={() => {
                          setEmpForm({
                            nome: emp.nome,
                            nif: emp.nif || "",
                            username: emp.username,
                            password: emp.password,
                            ativo: emp.ativo,
                            modulos: Array.isArray(emp.modulos)
                              ? emp.modulos
                              : ["laboratorial"],
                          });
                          setEditEmpId(emp.id);
                          setEmpMsg(null);
                        }}
                        className="bg-blue-500 text-white px-2.5 py-1 rounded font-semibold hover:bg-blue-600 transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleEmpresa(emp)}
                        className={`px-2.5 py-1 rounded font-semibold transition text-white ${emp.ativo ? "bg-amber-500 hover:bg-amber-600" : "bg-green-500 hover:bg-green-600"}`}
                      >
                        {emp.ativo ? "Desact." : "Activar"}
                      </button>
                      <button
                        onClick={() => deleteEmpresa(emp.id)}
                        className="bg-red-500 text-white px-2.5 py-1 rounded font-semibold hover:bg-red-600 transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Empresa detail panel */}
        {selectedEmpresa && (
          <div className="bg-white border border-primary/30 rounded-xl shadow-sm overflow-hidden">
            <div
              className="px-5 py-4 border-b border-border flex items-center gap-3"
              style={{ background: "hsl(var(--primary) / 0.06)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: "hsl(var(--primary))" }}
              >
                {selectedEmpresa.nome.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-primary">
                  {selectedEmpresa.nome}
                </div>
                <div className="text-xs text-muted-foreground">
                  {funcionarios.length} funcionário(s) · {parceiros.length}{" "}
                  parceiro(s)
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedEmpresaId(null);
                  setParMsg(null);
                }}
                className="text-xs text-muted-foreground hover:text-destructive font-semibold"
              >
                ✕ Fechar
              </button>
            </div>

            {/* Tab selector */}
            <div className="flex border-b border-border">
              {[
                {
                  id: "funcionarios" as const,
                  label: `Funcionários (${funcionarios.length})`,
                },
                {
                  id: "parceiros" as const,
                  label: `Parceiros / Clínicas (${parceiros.length})`,
                },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEmpTab(t.id)}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${empTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Cadastro profissional partilhado com o painel institucional. */}
            {empTab === "funcionarios" && selectedEmpresaId && <AdminFuncionarios key={selectedEmpresaId} onLoaded={setFuncionarios} session={{ role:"developer", username:loadSession()?.username || "desenvolvedor", empresaId:selectedEmpresaId }} />}
            {/* Parceiros tab */}
            {empTab === "parceiros" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-x divide-border">
                <div className="p-5">
                  <h3
                    className="text-sm font-bold mb-1"
                    style={{ color: "hsl(258 70% 55%)" }}
                  >
                    {editParId ? "Editar Parceiro" : "Novo Parceiro"}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Os parceiros acedem ao sistema em <strong>/parceiro</strong>
                  </p>
                  <form onSubmit={handleParSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Nome do Médico / Responsável *
                      </label>
                      <input
                        value={parForm.nome}
                        onChange={(e) =>
                          setParForm({ ...parForm, nome: e.target.value })
                        }
                        className={inp}
                        placeholder="Dr. João Silva"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Clínica / Instituição
                      </label>
                      <input
                        value={parForm.instituicao}
                        onChange={(e) =>
                          setParForm({
                            ...parForm,
                            instituicao: e.target.value,
                          })
                        }
                        className={inp}
                        placeholder="Ex: Clínica Saúde Viva"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Utilizador (login) *
                      </label>
                      <input
                        value={parForm.username}
                        onChange={(e) =>
                          setParForm({ ...parForm, username: e.target.value })
                        }
                        className={inp}
                        placeholder="Ex: djoaosilva"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Palavra-passe {editParId ? "" : "*"}
                      </label>
                      <div className="relative">
                        <input
                          type={showParPass ? "text" : "password"}
                          value={parForm.password}
                          onChange={(e) =>
                            setParForm({ ...parForm, password: e.target.value })
                          }
                          className={inp + " pr-9"}
                          placeholder={
                            editParId
                              ? "Deixar em branco para manter a actual"
                              : ""
                          }
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowParPass(!showParPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
                        >
                          {showParPass ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Email
                      </label>
                      <input
                        type="email"
                        value={parForm.email}
                        onChange={(e) =>
                          setParForm({ ...parForm, email: e.target.value })
                        }
                        className={inp}
                        placeholder="email@clinica.ao"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Telefone
                      </label>
                      <input
                        value={parForm.telefone}
                        onChange={(e) =>
                          setParForm({ ...parForm, telefone: e.target.value })
                        }
                        className={inp}
                        placeholder="9XX XXX XXX"
                      />
                    </div>
                    {parMsg && (
                      <div
                        className={`text-xs rounded-lg px-3 py-2 ${parMsg.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}
                      >
                        {parMsg.text}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
                        style={{ background: "hsl(258 70% 55%)" }}
                      >
                        {editParId ? "Guardar" : "Criar Parceiro"}
                      </button>
                      {editParId && (
                        <button
                          type="button"
                          onClick={() => {
                            setParForm(emptyParForm);
                            setEditParId(null);
                            setParMsg(null);
                          }}
                          className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>
                <div className="lg:col-span-2 divide-y divide-border">
                  {parceiros.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="text-muted-foreground text-sm mb-2">
                        Nenhum parceiro registado.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Crie parceiros (clínicas, médicos) que podem solicitar
                        exames ao laboratório.
                      </div>
                      <div className="mt-2 text-xs font-mono bg-muted rounded px-3 py-1.5 inline-block">
                        Link: {window.location.origin}/parceiro
                      </div>
                    </div>
                  ) : (
                    parceiros.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/10"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{
                            background: p.ativo
                              ? "hsl(258 70% 55%)"
                              : "#9ca3af",
                          }}
                        >
                          {p.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{p.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            @{p.username}
                            {p.instituicao ? ` · ${p.instituicao}` : ""}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${p.ativo ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {p.ativo ? "Activo" : "Inactivo"}
                        </span>
                        <div className="flex gap-1.5 text-xs flex-shrink-0">
                          <button
                            onClick={() => {
                              setParForm({
                                nome: p.nome,
                                instituicao: p.instituicao || "",
                                username: p.username,
                                password: p.password,
                                email: p.email || "",
                                telefone: p.telefone || "",
                              });
                              setEditParId(p.id);
                              setParMsg(null);
                            }}
                            className="bg-blue-500 text-white px-2.5 py-1 rounded font-semibold hover:bg-blue-600 transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => toggleParceiro(p)}
                            className={`px-2.5 py-1 rounded font-semibold transition text-white ${p.ativo ? "bg-amber-500 hover:bg-amber-600" : "bg-green-500 hover:bg-green-600"}`}
                          >
                            {p.ativo ? "Desact." : "Activar"}
                          </button>
                          <button
                            onClick={() => deleteParceiro(p.id)}
                            className="bg-red-500 text-white px-2.5 py-1 rounded font-semibold hover:bg-red-600 transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

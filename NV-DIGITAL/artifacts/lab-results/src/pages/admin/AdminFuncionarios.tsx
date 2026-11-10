import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../store/api";
import { hospitalApi } from "../../store/hospital";
import { Session, FuncaoFuncionario, FUNCAO_LABELS } from "../../store/auth";
import {
  emptyProfessional,
  LAB_STAFF_DELEGATIONS,
  MEDICAL_SPECIALTIES,
  PROFESSIONAL_CATEGORIES,
  STAFF_ACCESS_ROLES,
  type ProfessionalDetails,
} from "@workspace/api-zod";
import { prepareSignatureImage } from "../../utils/signatureImage";

const input =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-slate-900";
const button =
  "rounded-lg px-3 py-2 text-sm font-semibold border border-border disabled:opacity-50";
const labDelegationLabels: Record<string, string> = {
  "lab.validate.technical": "Validar tecnicamente",
  "lab.validate.release": "Libertar resultados finais",
  "lab.critical.release": "Autorizar resultados críticos",
  "lab.validate.solo": "Substituto técnico autorizado (máximo 90 dias)",
};
const descriptions: Record<FuncaoFuncionario, string> = {
  admin: "Administração da instituição e gestão de acessos.",
  gestor:
    "Gestão administrativa e operacional conforme os acessos institucionais.",
  tecnico:
    "Laboratório, resultados e histórico; validação depende de credenciais e autorizações próprias.",
  rececionista: "Recepção, pacientes, agendamento e facturação.",
  financeiro: "Facturação, movimentos e relatórios financeiros.",
  medico: "Atendimento clínico, prescrições e documentos médicos.",
  enfermeiro: "Triagem, enfermaria, cuidados e documentos de enfermagem.",
  farmaceutico: "Farmácia, stock e dispensa conforme prescrições.",
};
const blank = () => ({
  nome: "",
  username: "",
  password: "",
  funcao: "tecnico" as FuncaoFuncionario,
  ativo: true,
  professional: emptyProfessional(),
  professionalRevision: 0,
});
export default function AdminFuncionarios({
  session,
  onLoaded,
}: {
  session: Session;
  onLoaded?: (rows: any[]) => void;
}) {
  const org = session.empresaId!;
  const [rows, setRows] = useState<any[]>([]),
    [form, setForm] = useState(blank),
    [edit, setEdit] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [showPassword, setShowPassword] = useState(false);
  const [grants, setGrants] = useState<any[]>([]),
    [accessError, setAccessError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = generation.current;
    setLoading(true);
    try {
      const result = await api.empresas.listFuncionarios(org);
      if (current === generation.current) {
        setRows(result);
        onLoaded?.(result);
      }
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os funcionários.",
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [org, onLoaded]);
  const loadGrants = useCallback(async () => {
    try {
      const access = await hospitalApi<{ grants: any[] }>("GET", "/access");
      setGrants(access.grants);
      setAccessError("");
    } catch {
      setGrants([]);
      setAccessError("Não foi possível consultar as autorizações vigentes.");
    }
  }, [org]);
  useEffect(() => {
    generation.current++;
    setRows([]);
    void load();
    void loadGrants();
    return () => {
      generation.current++;
    };
  }, [load, loadGrants]);
  const reset = () => {
    setForm(blank());
    setEdit(null);
    setShowPassword(false);
  };
  const p = (key: keyof ProfessionalDetails, value: string) =>
    setForm((s) => ({
      ...s,
      professional: { ...s.professional, [key]: value },
    }));
  const requested = form.professional.requestedLabPermissions || [];
  const activeGrant = (permission: string) =>
    grants.find(
      (g) =>
        g.actor === form.username &&
        g.permission === permission &&
        !g.revoked_at &&
        new Date(g.expires_at).getTime() > Date.now(),
    );
  const verified =
    form.ativo &&
    form.professional.status === "activo" &&
    Boolean(form.professional.verifiedBy) &&
    new Date(form.professional.validUntil).getTime() > Date.now();
  const eligibleLabRole = ["tecnico", "medico"].includes(form.funcao);
  const canEnterLabResults = ["tecnico", "admin", "gestor"].includes(form.funcao);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !form.nome.trim() ||
        !form.username.trim() ||
        (!edit && !form.password)
      )
        throw new Error("Preencha nome, utilizador e palavra-passe inicial.");
      if (form.password && form.password.length < 8)
        throw new Error("Use pelo menos oito caracteres na palavra-passe.");
      if (!form.professional.category.trim())
        throw new Error("Seleccione a categoria profissional.");
      if (edit && accessError && eligibleLabRole)
        throw new Error("Não foi possível confirmar as permissões existentes. Actualize e tente novamente para não substituir autorizações sem as consultar.");
      const body = {
        ...form,
        password: form.password || undefined,
        syncLabPermissions: eligibleLabRole,
      };
      const result = edit
        ? await api.empresas.updateFuncionario(org, edit, body)
        : await api.empresas.createFuncionario(org, body);
      reset();
      const permissions = result.labPermissions;
      setMessage(permissions?.pending?.length
        ? "Funcionário guardado. As permissões seleccionadas serão activadas assim que outro responsável verificar a habilitação profissional."
        : permissions?.active?.length
          ? "Funcionário guardado. Permissões laboratoriais activas e registadas com auditoria."
          : "Funcionário guardado. As permissões desmarcadas foram revogadas quando aplicável.");
      await load();
      await loadGrants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gravação não confirmada.");
    } finally {
      setBusy(false);
    }
  }
  async function editRow(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const row = await api.empresas.getFuncionario(org, id);
      const access = await hospitalApi<{ grants: any[] }>("GET", "/access");
      setGrants(access.grants);
      setAccessError("");
      const existing = access.grants
        .filter((grant) =>
          grant.actor === row.username &&
          (LAB_STAFF_DELEGATIONS as readonly string[]).includes(grant.permission) &&
          !grant.revoked_at &&
          new Date(grant.expires_at).getTime() > Date.now(),
        )
        .map((grant) => grant.permission as string);
      setEdit(id);
      setForm({
        nome: row.nome,
        username: row.username,
        password: "",
        funcao: row.funcao,
        ativo: row.ativo,
        professional: {
          ...emptyProfessional(),
          ...row.professional,
          requestedLabPermissions: [...new Set([
            ...(row.professional?.requestedLabPermissions || []),
            ...existing,
          ])],
          validUntil: row.professional?.validUntil?.slice(0, 10) || "",
        },
        professionalRevision: row.professionalRevision,
      });
      setShowPassword(false);
      setMessage("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível abrir a ficha.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle(row: any) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.empresas.updateFuncionario(org, row.id, { ativo: !row.ativo });
      await load();
      setMessage(
        row.ativo
          ? "Conta desactivada; histórico profissional conservado."
          : "Conta activada. Credenciais e competências continuam sujeitas à sua validade.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operação não confirmada.");
    } finally {
      setBusy(false);
    }
  }
  async function image(key: "signatureData" | "stampData", file?: File) {
    if (!file) return;
    try {
      p(key, await prepareSignatureImage(file));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar a imagem.");
    }
  }
  const visible = rows.filter((r) =>
    [
      r.nome,
      r.username,
      r.professional?.employeeCode,
      r.professional?.category,
      r.professional?.specialties,
      r.professional?.service,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const field = (
    key: keyof ProfessionalDetails,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label className="space-y-1 text-sm" key={key}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className={input}
        type={type}
        required={required}
        value={String(form.professional[key] || "")}
        onChange={(e) => p(key, e.target.value)}
      />
    </label>
  );
  return (
    <div className="p-5 space-y-5">
      <header>
        <h2 className="text-xl font-bold text-primary">
          Gestão de Funcionários
        </h2>
        <p className="text-sm text-muted-foreground">
          Conta de acesso, ficha profissional e identificação nos documentos da
          instituição.
        </p>
      </header>
      {(message || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`p-3 rounded-lg border ${error ? "border-red-300 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
        >
          {error || message}
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white border border-border rounded-xl p-5">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h3 className="font-bold text-primary">
              {edit ? "Editar Funcionário" : "Cadastro de Funcionário"}
            </h3>
            <span className="rounded-full bg-green-100 px-3 py-1 text-[11px] font-medium text-green-800">
              Permissões NV-DIGITAL
            </span>
          </div>
          <form onSubmit={save} className="space-y-5">
            <fieldset disabled={busy} className="space-y-4">
              <legend className="font-semibold mb-3">Conta e acesso</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  Nome completo *
                  <input
                    required
                    className={input}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  Utilizador *
                  <input
                    required
                    autoComplete="off"
                    className={input}
                    readOnly={Boolean(edit)}
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  {edit
                    ? "Nova palavra-passe (opcional)"
                    : "Palavra-passe inicial *"}
                  <input
                    required={!edit}
                    minLength={8}
                    autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                    className={input}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  Perfil de acesso *
                  <select
                    className={input}
                    value={form.funcao}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        funcao: e.target.value as FuncaoFuncionario,
                        professional: {
                          ...s.professional,
                          requestedLabPermissions: ["tecnico", "medico"].includes(e.target.value)
                            ? s.professional.requestedLabPermissions
                            : [],
                          category:
                            s.professional.category ||
                            (e.target.value === "medico"
                              ? "Médico"
                              : e.target.value === "enfermeiro"
                                ? "Enfermeiro"
                                : ""),
                          specialties:
                            s.professional.specialties ||
                            (e.target.value === "medico"
                              ? "Clínica Geral"
                              : ""),
                        },
                      }))
                    }
                  >
                    {STAFF_ACCESS_ROLES.map((role) => (
                      <option
                        key={role}
                        value={role}
                        disabled={
                          role === "admin" &&
                          session.funcao !== "admin" &&
                          session.role !== "developer"
                        }
                      >
                        {FUNCAO_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="text-sm flex gap-2">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Mostrar palavra-passe introduzida
              </label>
              <p className="text-xs text-muted-foreground">
                {descriptions[form.funcao]} Categoria, especialidade e cargo
                descrevem o profissional; o perfil acima determina o acesso.
              </p>
              <label className="text-sm flex gap-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) =>
                    setForm({ ...form, ativo: e.target.checked })
                  }
                />
                Conta activa
              </label>
            </fieldset>
            <fieldset disabled={busy} className="space-y-3 border-t pt-4">
              <legend className="font-semibold px-1">Ficha profissional</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  Categoria profissional *
                  <input
                    list="nv-professional-categories"
                    required
                    className={input}
                    value={form.professional.category}
                    onChange={(e) => p("category", e.target.value)}
                  />
                  <datalist id="nv-professional-categories">
                    {PROFESSIONAL_CATEGORIES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </label>
                {field("employeeCode", "Código interno")}
                {field("qualification", "Qualificação / formação")}
                {field("position", "Cargo / chefia")}
                {field("service", "Serviço / unidade")}
                {field("contract", "Vínculo / contrato")}
                {field("credential", "N.º de cédula / registo profissional")}
                {field("credentialAuthority", "Entidade emissora do registo")}
                {field("validUntil", "Validade da credencial", "date")}
                {field("phone", "Contacto", "tel")}
                {field("email", "Email", "email")}
              </div>
              <label className="block text-sm">
                Especialidades / competências
                <input
                  className={input}
                  list="nv-medical-specialties"
                  value={form.professional.specialties}
                  onChange={(e) => p("specialties", e.target.value)}
                  placeholder="Ex.: Clínica Geral; Medicina Interna"
                />
                <datalist id="nv-medical-specialties">
                  {MEDICAL_SPECIALTIES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <p className="text-xs text-muted-foreground">
                Separe várias especialidades por ponto e vírgula. A direcção
                clínica e a direcção do laboratório são cargos próprios; um
                médico não recebe automaticamente esses cargos.
              </p>
            </fieldset>
            {eligibleLabRole && (
              <fieldset disabled={busy} className="border-t pt-4 space-y-3">
                <legend className="font-semibold px-1">
                  Permissões laboratoriais
                </legend>
                <p className="text-xs text-muted-foreground">
                  Marque as competências e guarde a ficha. Com habilitação profissional
                  verificada, ficam activas imediatamente. Se ainda não tiver sido
                  verificada, serão activadas na verificação por outro responsável.
                  Desmarcar uma competência e guardar revoga a autorização existente.
                </p>
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={canEnterLabResults} disabled readOnly />
                    <span>Lançar e editar resultados</span>
                    <span className="text-[11px] text-slate-500">(incluído no perfil de laboratório)</span>
                  </label>
                  {LAB_STAFF_DELEGATIONS.filter((p) => p !== "lab.critical.release").map((permission) => (
                    <label key={permission} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-emerald-700"
                        checked={requested.includes(permission)}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            professional: {
                              ...s.professional,
                              requestedLabPermissions: e.target.checked
                                ? [...(s.professional.requestedLabPermissions || []), permission]
                                : (s.professional.requestedLabPermissions || []).filter((p) => p !== permission),
                            },
                          }))
                        }
                      />
                      <span>{labDelegationLabels[permission]}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={requested.includes("lab.validate.release")} disabled readOnly />
                    <span>Gerar PDF definitivo</span>
                    <span className="text-[11px] text-slate-500">(após libertação efectiva)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-emerald-700"
                      checked={requested.includes("lab.critical.release")}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          professional: {
                            ...s.professional,
                            requestedLabPermissions: e.target.checked
                              ? [...(s.professional.requestedLabPermissions || []), "lab.critical.release"]
                              : (s.professional.requestedLabPermissions || []).filter((p) => p !== "lab.critical.release"),
                          },
                        }))
                      }
                    />
                    <span>{labDelegationLabels["lab.critical.release"]}</span>
                  </label>
                </div>
                <div className={`rounded-lg border p-3 text-sm ${verified ? "border-emerald-100 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <p className={`font-semibold ${verified ? "text-emerald-800" : "text-amber-800"}`}>
                    {verified ? "✓ Habilitação verificada" : "Habilitação por verificar"}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {verified
                      ? "Ao guardar, as permissões seleccionadas passam a estar activas, com registo do responsável e prazo limitado à validade da credencial."
                      : "Pode guardar as opções agora. A autorização só terá efeito após a verificação independente da credencial."}
                    {" "}A libertação continua sujeita às regras de validação e independência.
                  </p>
                </div>
                {LAB_STAFF_DELEGATIONS.filter((permission) => requested.includes(permission) || activeGrant(permission)).map((permission) => {
                  const grant = activeGrant(permission);
                  return (
                    <div key={permission} className="flex flex-wrap items-center justify-between gap-2 text-xs rounded-lg bg-slate-50 px-3 py-2">
                      <span>{labDelegationLabels[permission]}</span>
                      <span className={grant && verified ? "text-green-800" : "text-amber-700"}>
                        {grant && verified
                          ? "Activa até " + new Date(grant.expires_at).toLocaleDateString("pt-PT")
                          : verified
                            ? "Fica activa ao guardar"
                            : "Aguarda verificação"}
                      </span>
                    </div>
                  );
                })}
                {accessError && <p role="alert" className="text-xs text-red-700">{accessError}</p>}
              </fieldset>
            )}
            <fieldset disabled={busy} className="border-t pt-4 space-y-3">
              <legend className="font-semibold px-1">
                Identificação gráfica nos documentos
              </legend>
              <div className="grid sm:grid-cols-2 gap-4">
                {(
                  [
                    ["signatureData", "Assinatura gráfica"],
                    ["stampData", "Carimbo profissional"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <label className="block text-sm">
                      {label}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                        className="block w-full text-xs mt-1"
                        onChange={(e) => {
                          void image(key, e.target.files?.[0]);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {form.professional[key] && (
                      <>
                        <img
                          className="max-h-24 max-w-full border rounded p-2"
                          src={form.professional[key]}
                          alt={label}
                        />
                        <button
                          type="button"
                          className={button}
                          onClick={() => p(key, "")}
                        >
                          Retirar imagem
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG/JPEG/WebP com preparação segura por imagem. A emissão guarda a identificação
                do autor. As imagens são reproduções gráficas; a verificação da
                credencial é feita por outro responsável em Instituição e
                acessos.
              </p>
            </fieldset>
            <div className="flex gap-2">
              <button
                disabled={busy}
                className={`${button} bg-primary text-primary-foreground flex-1`}
              >
                {busy
                  ? "A guardar…"
                  : edit
                    ? "Guardar alterações"
                    : "Criar funcionário"}
              </button>
              {edit && (
                <button
                  type="button"
                  disabled={busy}
                  className={button}
                  onClick={reset}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </section>
        <section className="bg-white border border-border rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <h3 className="font-bold">Funcionários ({visible.length})</h3>
            <button
              className={button}
              disabled={busy || loading}
              onClick={() => void load()}
            >
              Actualizar
            </button>
          </div>
          <input
            aria-label="Pesquisar funcionários"
            className={input}
            placeholder="Nome, utilizador, código, categoria, especialidade ou serviço"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? (
            <p>A carregar funcionários…</p>
          ) : !visible.length ? (
            <p className="text-sm text-muted-foreground">
              {rows.length
                ? "Nenhum resultado encontrado."
                : "Nenhum funcionário registado."}
            </p>
          ) : (
            <div className="divide-y">
              {visible.map((row) => (
                <article key={row.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{row.nome}</strong>
                    <span className="text-xs">
                      {row.ativo ? "Conta activa" : "Conta inactiva"}
                    </span>
                  </div>
                  <p className="text-sm">
                    {FUNCAO_LABELS[row.funcao as FuncaoFuncionario] ||
                      row.funcao}{" "}
                    · @{row.username}
                  </p>
                  <p className="text-xs text-slate-600">
                    {[
                      row.professional?.category,
                      row.professional?.specialties,
                      row.professional?.service,
                      row.professional?.position,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Ficha profissional por completar"}
                  </p>
                  <p className="text-xs">
                    Credencial:{" "}
                    {row.professional?.credential || "Não registada"} ·{" "}
                    {row.professional?.status === "activo"
                      ? "Verificação registada"
                      : row.professional?.status || "Por verificar"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() => void editRow(row.id)}
                    >
                      Editar ficha
                    </button>
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() => void toggle(row)}
                    >
                      {row.ativo ? "Desactivar conta" : "Activar conta"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground border-t pt-3">
            A desactivação conserva o histórico e encerra sessões e
            autorizações. Credenciais novas/alteradas exigem verificação em
            Instituição e acessos antes da emissão profissional.
          </p>
        </section>
      </div>
    </div>
  );
}

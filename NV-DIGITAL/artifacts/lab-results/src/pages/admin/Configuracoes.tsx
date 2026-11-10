import { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "../../store/AppContext";
import { api } from "../../store/api";
import DocumentSignatures from "./DocumentSignatures";

function ImageUploadBox({
  label,
  hint,
  preview,
  onSelect,
  onRemove,
  icon,
}: {
  label: string;
  hint: string;
  preview: string;
  onSelect: (dataUrl: string) => void;
  onRemove: () => void;
  icon: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSelect(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-5">
      <div
        className="w-32 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors bg-gray-50"
        onClick={() => fileRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="max-h-full max-w-full object-contain p-1"
          />
        ) : (
          <div className="text-center text-muted-foreground text-xs">
            <div className="text-2xl mb-1">{icon}</div>
            <div>Clique para carregar</div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="block bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition"
        >
          Seleccionar {label}
        </button>
        {preview && (
          <button
            type="button"
            onClick={onRemove}
            className="block text-destructive text-sm hover:underline font-medium"
          >
            Remover
          </button>
        )}
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

interface Sucursal {
  id: string;
  nome: string;
  username: string;
  ativo: boolean;
  parentEmpresaId: string;
}

const LIMITE_SUCURSAIS = 100;

export default function Configuracoes() {
  const { data, updateConfig } = useApp();
  const [form, setForm] = useState({ ...data.config });
  const [saved, setSaved] = useState(false);
  const [savingConfig,setSavingConfig]=useState(false);
  const [configError,setConfigError]=useState("");
  const [activeSection, setActiveSection] = useState<
    "empresa" | "faturacao" | "sucursais" | "assinaturas"
  >("empresa");

  // ── Sucursais ─────────────────────────────────────────────────────────────
  const [sucursais, setSucursais] = useState<Sucursal[]>([]);
  const [loadingSuc, setLoadingSuc] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [sForm, setSForm] = useState({
    nome: "",
    username: "",
    password: "",
    confirmar: "",
  });
  const [sErr, setSErr] = useState("");
  const [sLoading, setSLoading] = useState(false);
  const [sMsg, setSMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Sucursal | null>(null);

  const loadSucursais = useCallback(async () => {
    setLoadingSuc(true);
    try {
      const rows = await api.sucursais.list();
      setSucursais(rows);
    } catch {
      // ignored — empresa pode não ter sucursais ainda
    } finally {
      setLoadingSuc(false);
    }
  }, []);

  useEffect(() => {
    loadSucursais();
  }, [loadSucursais]);

  async function handleCriarSucursal(e: React.FormEvent) {
    e.preventDefault();
    setSErr("");
    if (!sForm.nome.trim()) {
      setSErr("O nome da sucursal é obrigatório.");
      return;
    }
    if (!sForm.username.trim()) {
      setSErr("O nome de utilizador é obrigatório.");
      return;
    }
    if (sForm.password.length < 4) {
      setSErr("A senha deve ter pelo menos 4 caracteres.");
      return;
    }
    if (sForm.password !== sForm.confirmar) {
      setSErr("As senhas não coincidem.");
      return;
    }
    if (sucursais.length >= LIMITE_SUCURSAIS) {
      setSErr(`Limite de ${LIMITE_SUCURSAIS} sucursais atingido.`);
      return;
    }
    setSLoading(true);
    try {
      await api.sucursais.create({
        nome: sForm.nome.trim(),
        username: sForm.username.trim(),
        password: sForm.password,
      });
      setSMsg(
        `Sucursal "${sForm.nome}" criada com sucesso! Aceda em / com o utilizador "${sForm.username}".`,
      );
      setSForm({ nome: "", username: "", password: "", confirmar: "" });
      setShowModal(false);
      await loadSucursais();
    } catch (err: any) {
      setSErr(err.message || "Erro ao criar sucursal.");
    } finally {
      setSLoading(false);
    }
  }

  async function handleEliminarSucursal(s: Sucursal) {
    try {
      await api.sucursais.delete(s.id);
      setConfirmDelete(null);
      setSMsg(`Sucursal "${s.nome}" eliminada.`);
      await loadSucursais();
    } catch (err: any) {
      alert(err.message || "Erro ao eliminar sucursal.");
    }
  }

  // ── Config ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if(savingConfig)return;
    setSavingConfig(true);setConfigError("");setSaved(false);
    try{await updateConfig(form);setSaved(true);setTimeout(()=>setSaved(false),3000);}
    catch(e){setConfigError(e instanceof Error?e.message:"O servidor não confirmou a configuração.");}
    finally{setSavingConfig(false);}
  }

  function field(
    label: string,
    key: keyof typeof form,
    placeholder?: string,
    type: string = "text",
  ) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <input
          type={type}
          value={String(form[key] ?? "")}
          onChange={(e) =>
            setForm({
              ...form,
              [key]:
                type === "number" ? Number(e.target.value) : e.target.value,
            })
          }
          className="w-full border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 max-w-5xl">
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Empresa &amp; Facturação
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              Configurações da Empresa
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Organize os dados fiscais, documentos e unidades do laboratório
              num só lugar.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
            <span className="text-base">🏢</span>
            <span>
              <strong>{form.nomeClinica || "Laboratório"}</strong>
              <br />
              Perfil operacional
            </span>
          </div>
        </div>
        <div
          className="mt-5 flex gap-1 overflow-x-auto border-b border-border"
          role="tablist"
          aria-label="Secções de configuração"
        >
          {(
            [
              ["empresa", "🏢", "Dados da empresa"],
              ["faturacao", "🧾", "Facturação AGT"],
              ["sucursais", "🏬", "Sucursais / polos"],
              ["assinaturas", "✍️", "Assinaturas clínicas"],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeSection === key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 transition ${
                activeSection === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {configError&&<p role="alert" className="rounded bg-red-50 p-3 text-red-800">{configError}</p>}
      {activeSection==="assinaturas"&&<DocumentSignatures/>}
      <form onSubmit={handleSubmit} className={activeSection==="assinaturas"?"hidden":"space-y-6"}>
        {/* Images */}
        <div className={activeSection === "empresa" ? "space-y-5" : "hidden"}>
          <div className="bg-white border border-border rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wide border-b border-border pb-2">
              Imagens
            </h3>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Logo da Empresa
              </div>
              <ImageUploadBox
                label="Logo"
                hint="PNG, JPG — aparece no cabeçalho do PDF e na aplicação"
                preview={form.logoData}
                icon="🏥"
                onSelect={(url) =>
                  setForm((prev) => ({ ...prev, logoData: url }))
                }
                onRemove={() => setForm((prev) => ({ ...prev, logoData: "" }))}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Assinatura do Director(a) Técnico(a) do laboratório
              </div>
              <ImageUploadBox
                label="Assinatura"
                hint="PNG com fundo transparente — aparece no rodapé dos PDFs"
                preview={form.assinaturaData}
                icon="✍️"
                onSelect={(url) =>
                  setForm((prev) => ({ ...prev, assinaturaData: url }))
                }
                onRemove={() =>
                  setForm((prev) => ({ ...prev, assinaturaData: "" }))
                }
              />
            </div>
          </div>

          {/* Identity */}
          <div className="bg-white border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wide border-b border-border pb-2">
              Dados da Empresa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field(
                "Nome da Empresa / Laboratório *",
                "nomeClinica",
                "Nome que aparece nos documentos",
              )}
              {field(
                "NIF (Número de Identificação Fiscal)",
                "nif",
                "Ex: 5000000001LD",
              )}
              {field("Endereço", "endereco", "Morada completa")}
              {field("Telefone", "telefone", "Ex: 923 000 000")}
              {field("E-mail", "email", "email@laboratorio.ao")}
              {field("Website", "website", "www.laboratorio.ao")}
              {field(
                "Nome do Director(a) Técnico(a) do laboratório",
                "directorTecnico",
                "Nome que assina os PDFs",
              )}
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className={activeSection === "faturacao" ? "space-y-5" : "hidden"}>
          <div className="bg-white border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wide border-b border-border pb-2">
              Configurações de Faturação (AGT)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {field("Série de Faturas", "serie", "Ex: A")}
              {field("Taxa IVA (%)", "ivaTaxa", "14", "number")}
              {field("Moeda", "moeda", "AOA")}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
              <strong>Atenção:</strong> A série de faturas e o número sequencial
              não devem ser alterados após a emissão de faturas, de acordo com a
              legislação da AGT Angola. O próximo número de fatura é{" "}
              <strong>{form.proximoNumeroFatura}</strong>.
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <span className="text-xl">🛡️</span>
              <div>
                <h3 className="text-sm font-bold text-blue-900">
                  Perfil fiscal preparado para o POS
                </h3>
                <p className="text-xs text-blue-700 mt-1">
                  A série, moeda e IVA definidos aqui são usados pelo fluxo de
                  venda, recibos e documentos emitidos no módulo de facturação.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="bg-primary text-primary-foreground px-8 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            Guardar Configurações
          </button>
          {saved && (
            <span className="text-green-600 text-sm font-semibold">
              ✓ Guardado com sucesso
            </span>
          )}
        </div>
      </form>

      {/* Preview */}
      <div
        className={
          activeSection === "empresa"
            ? "bg-white border border-border rounded-xl p-5"
            : "hidden"
        }
      >
        <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wide">
          Pré-visualização do Cabeçalho PDF
        </h3>
        <div className="border border-border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center gap-4 mb-2">
            {form.logoData ? (
              <img
                src={form.logoData}
                alt="Logo"
                className="max-h-14 max-w-28 object-contain"
              />
            ) : (
              <div className="w-14 h-14 bg-green-100 rounded flex items-center justify-center text-xs text-green-700 font-bold">
                LOGO
              </div>
            )}
            <div>
              <div className="font-bold text-base text-green-800">
                {form.nomeClinica}
              </div>
              {form.nif && (
                <div className="text-xs text-gray-500">NIF: {form.nif}</div>
              )}
              <div className="text-xs text-gray-500">
                {form.telefone} | {form.email}
              </div>
              <div className="text-xs text-gray-500">{form.endereco}</div>
            </div>
          </div>
          <div className="border-t border-green-300 pt-2 text-center text-sm font-bold tracking-widest text-green-800">
            RELATÓRIO DE RESULTADOS DE ANÁLISES CLÍNICAS
          </div>
        </div>
      </div>

      {/* ── Sucursais / Polos ──────────────────────────────────────────────── */}
      <div
        className={
          activeSection === "sucursais"
            ? "bg-white border border-border rounded-xl overflow-hidden"
            : "hidden"
        }
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-primary uppercase tracking-wide">
              Sucursais / Polos
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada sucursal é uma unidade independente com a sua própria base de
              dados e acesso. Pode criar até {LIMITE_SUCURSAIS} polos.
            </p>
          </div>
          <button
            onClick={() => {
              setShowModal(true);
              setSErr("");
              setSForm({ nome: "", username: "", password: "", confirmar: "" });
            }}
            disabled={sucursais.length >= LIMITE_SUCURSAIS}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm whitespace-nowrap disabled:opacity-50"
          >
            🏢 Criar Sucursal
          </button>
        </div>

        {/* Mensagem de sucesso */}
        {sMsg && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span className="text-green-500 text-base mt-0.5">✓</span>
              <p className="text-sm text-green-800">{sMsg}</p>
            </div>
            <button
              onClick={() => setSMsg("")}
              className="text-green-400 hover:text-green-600 text-sm flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Lista */}
        <div className="p-6">
          {loadingSuc ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              A carregar…
            </div>
          ) : sucursais.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-4xl mb-2">🏢</div>
              <p className="text-sm text-muted-foreground">
                Nenhuma sucursal criada.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Crie a primeira sucursal / polo acima.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sucursais.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 bg-gray-50 border border-border rounded-xl px-4 py-3 hover:bg-blue-50/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-black text-sm">
                        {i + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">
                        {s.nome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Utilizador:{" "}
                        <span className="font-mono">{s.username}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                    >
                      {s.ativo ? "Activa" : "Inactiva"}
                    </span>
                    <button
                      onClick={() => setConfirmDelete(s)}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline font-semibold transition px-2 py-1"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1 text-right">
                {sucursais.length} / {LIMITE_SUCURSAIS} sucursais criadas
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Criar Sucursal ──────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Nova Sucursal / Polo
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A sucursal terá a sua própria base de dados independente.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarSucursal} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  Nome da Sucursal *
                </label>
                <input
                  value={sForm.nome}
                  onChange={(e) =>
                    setSForm((f) => ({ ...f, nome: e.target.value }))
                  }
                  placeholder="Ex: Polo Norte, Loja 2, Filial Viana"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
                <strong>Credenciais de acesso</strong> — estas credenciais serão
                usadas para entrar no portal{" "}
                <code className="bg-blue-100 px-1 rounded">/</code> como a
                sucursal.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  Utilizador (login) *
                </label>
                <input
                  value={sForm.username}
                  onChange={(e) =>
                    setSForm((f) => ({
                      ...f,
                      username: e.target.value.replace(/\s/g, "").toLowerCase(),
                    }))
                  }
                  placeholder="Ex: polo_norte, loja2"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">
                    Senha *
                  </label>
                  <input
                    type="password"
                    value={sForm.password}
                    onChange={(e) =>
                      setSForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="Mínimo 4 caracteres"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">
                    Confirmar Senha *
                  </label>
                  <input
                    type="password"
                    value={sForm.confirmar}
                    onChange={(e) =>
                      setSForm((f) => ({ ...f, confirmar: e.target.value }))
                    }
                    placeholder="Repetir senha"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${sForm.confirmar && sForm.confirmar !== sForm.password ? "border-red-300" : "border-border"}`}
                  />
                </div>
              </div>

              {sErr && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  {sErr}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={sLoading}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-60"
                >
                  {sLoading ? "A criar…" : "✅ Criar Sucursal"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Eliminação ─────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <h3 className="text-base font-bold text-gray-900">
                Eliminar Sucursal?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Vai eliminar <strong>"{confirmDelete.nome}"</strong> e{" "}
                <strong>todos os seus dados</strong> permanentemente. Esta acção
                não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleEliminarSucursal(confirmDelete)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold transition"
              >
                Sim, eliminar
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-border rounded-lg text-sm text-gray-500 hover:bg-gray-50 py-2.5 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { api } from "../../store/api";
import { Session } from "../../store/auth";

const emptyForm = {
  nome: "",
  username: "",
  password: "",
  instituicao: "",
  telefone: "",
  email: "",
  ativo: true,
};

export default function GestaParceiros({ session }: { session: Session }) {
  const empresaId = session.empresaId!;
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await api.empresas.listParceiros(empresaId);
      setParceiros(list);
    } catch {}
  }, [empresaId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.username.trim() || !form.password.trim()) {
      setMsg({ text: "Preencha nome, utilizador e palavra-passe.", ok: false });
      return;
    }
    try {
      if (editId) {
        await api.empresas.updateParceiro(empresaId, editId, form);
        setMsg({ text: "Parceiro actualizado com sucesso.", ok: true });
      } else {
        await api.empresas.createParceiro(empresaId, form);
        setMsg({
          text: `Parceiro "${form.nome}" criado com sucesso.`,
          ok: true,
        });
      }
      setForm(emptyForm);
      setEditId(null);
      await load();
    } catch (err: any) {
      setMsg({ text: err.message || "Erro ao guardar parceiro.", ok: false });
    }
  }

  async function handleToggle(p: any) {
    await api.empresas.updateParceiro(empresaId, p.id, {
      ...p,
      ativo: !p.ativo,
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Eliminar este parceiro? Esta acção é irreversível."))
      return;
    await api.empresas.deleteParceiro(empresaId, id);
    await load();
  }

  const filtered = parceiros.filter(
    (p) =>
      !search ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.instituicao || "").toLowerCase().includes(search.toLowerCase()) ||
      p.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-5 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-primary">Gestão de Parceiros</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Clínicas, médicos e outras entidades que submetem pedidos ao
          laboratório via portal /parceiro
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-4">
            {editId ? "Editar Parceiro" : "Novo Parceiro"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nome Completo *
              </label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ex: Dr. João Silva"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Instituição / Clínica
              </label>
              <input
                value={form.instituicao}
                onChange={(e) =>
                  setForm({ ...form, instituicao: e.target.value })
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ex: Clínica São Lucas"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Utilizador (login) *
              </label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ex: parceiro01"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Palavra-passe *
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Palavra-passe"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Telefone
                </label>
                <input
                  value={form.telefone}
                  onChange={(e) =>
                    setForm({ ...form, telefone: e.target.value })
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="9XX XXX XXX"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="email@clinica.ao"
                />
              </div>
            </div>
            {editId && (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) =>
                    setForm({ ...form, ativo: e.target.checked })
                  }
                  style={{ accentColor: "hsl(var(--primary))" }}
                />
                Conta activa
              </label>
            )}
            {msg && (
              <div
                className={`text-xs rounded-lg px-3 py-2 ${msg.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}
              >
                {msg.text}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
              >
                {editId ? "Guardar" : "Criar Parceiro"}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm);
                    setEditId(null);
                    setMsg(null);
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
          <div className="mt-5 pt-4 border-t border-border">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Acesso ao portal
            </div>
            <p className="text-xs text-muted-foreground">
              Os parceiros entram em <strong>/parceiro</strong> com o utilizador
              e palavra-passe aqui definidos. Podem submeter pedidos de exames e
              consultar resultados prontos.
            </p>
          </div>
        </div>
        {/* List */}
        <div className="lg:col-span-2 bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <h3 className="text-sm font-bold">Parceiros ({filtered.length})</h3>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="ml-auto border border-border rounded-lg px-3 py-1.5 text-xs w-44 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {parceiros.length === 0 ? (
                <>
                  <div className="text-3xl mb-3">🏥</div>
                  <div>Nenhum parceiro criado ainda.</div>
                  <div className="text-xs mt-1">
                    Use o formulário ao lado para adicionar clínicas e médicos
                    parceiros.
                  </div>
                </>
              ) : (
                "Nenhum resultado encontrado."
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/20 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{
                      background: p.ativo ? "hsl(258 70% 55%)" : "#9ca3af",
                    }}
                  >
                    {p.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{p.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      @{p.username}
                      {p.instituicao ? ` · ${p.instituicao}` : ""}
                      {p.telefone ? ` · ${p.telefone}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {p.ativo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className="flex gap-1.5 text-xs flex-shrink-0">
                    <button
                      onClick={() => {
                        setForm({
                          nome: p.nome,
                          username: p.username,
                          password: p.password || "",
                          instituicao: p.instituicao || "",
                          telefone: p.telefone || "",
                          email: p.email || "",
                          ativo: p.ativo,
                        });
                        setEditId(p.id);
                        setMsg(null);
                      }}
                      className="bg-blue-500 text-white px-2.5 py-1 rounded font-semibold hover:bg-blue-600 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggle(p)}
                      className={`px-2.5 py-1 rounded font-semibold transition text-white ${p.ativo ? "bg-amber-500 hover:bg-amber-600" : "bg-green-500 hover:bg-green-600"}`}
                    >
                      {p.ativo ? "Desact." : "Activar"}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
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
    </div>
  );
}

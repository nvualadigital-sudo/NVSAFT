import { useState } from "react";
import { api } from "../../store/api";
import { Session } from "../../store/auth";

interface Props {
  onLogin: (session: Session) => void;
  mode?: "admin" | "parceiro" | "empresa";
}

const MODES = {
  admin: {
    title: "Developer App",
    formTitle: "Acesso de Administrador",
    formSub: "Credenciais restritas ao desenvolvedor",
    color: "hsl(215 80% 50%)",
    bgLeft: "hsl(222 44% 10%)",
    bg: "hsl(222 44% 8%)",
    features: [
      "Gestão multi-empresa",
      "Controlo de acesso por perfil",
      "Base de dados PostgreSQL",
    ],
    desc: "Plataforma de administração para gestão de empresas, laboratórios e funcionários.",
    footerLink: { href: "/", label: "Voltar ao portal das empresas" },
    roleRequired: "developer" as const,
    icon: "briefcase",
  },
  parceiro: {
    title: "Portal de Parceiros",
    formTitle: "Acesso de Parceiro",
    formSub: "Entre com as credenciais de parceiro fornecidas pelo laboratório",
    color: "hsl(258 70% 55%)",
    bgLeft: "hsl(258 40% 10%)",
    bg: "hsl(258 40% 8%)",
    features: [
      "Solicitar exames ao laboratório",
      "Cadastrar pacientes",
      "Acompanhar estado dos pedidos",
    ],
    desc: "Portal exclusivo para clínicas e médicos parceiros do laboratório.",
    footerLink: { href: "/", label: "Voltar ao portal das empresas" },
    roleRequired: "parceiro" as const,
    icon: "link",
  },
  empresa: {
    title: "Gestão Laboratorial",
    formTitle: "Iniciar Sessão",
    formSub: "Entre com as credenciais fornecidas pelo administrador",
    color: "hsl(var(--primary))",
    bgLeft: "hsl(162 40% 10%)",
    bg: "hsl(var(--sidebar))",
    features: [
      "Resultados clínicos em tempo real",
      "Faturação AGT Angola (IVA)",
      "Histórico de pacientes e PDF",
    ],
    desc: "Sistema integrado para laboratórios de análises clínicas — pacientes, resultados, faturação e muito mais.",
    footerLink: { href: "/admin", label: "Painel de administração" },
    roleRequired: null,
    icon: "flask",
  },
};

function PortalIcon({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center"
      style={{ background: color }}
    >
      {name === "briefcase" && (
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
      )}
      {name === "link" && (
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
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      )}
      {name === "flask" && (
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
          <path d="M9 3v11a6 6 0 006-6V3" />
          <line x1="6" y1="3" x2="18" y2="3" />
          <path d="M5 21h14" />
        </svg>
      )}
    </div>
  );
}

export default function Login({ onLogin, mode = "empresa" }: Props) {
  const cfg = MODES[mode];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.auth.login(username.trim(), password);
      api.setToken(result.token);

      if (cfg.roleRequired && result.role !== cfg.roleRequired) {
        const msgs: Record<string, string> = {
          developer: "Esta área é apenas para o desenvolvedor.",
          parceiro:
            "Esta área é exclusiva para parceiros. Utilize o portal da empresa em /.",
        };
        setError(msgs[cfg.roleRequired] || "Acesso não autorizado.");
        api.setToken(null);
        setLoading(false);
        return;
      }
      if (mode === "empresa" && result.role === "developer") {
        setError(
          "Use o painel do desenvolvedor (/admin) para entrar com esta conta.",
        );
        api.setToken(null);
        setLoading(false);
        return;
      }
      if (mode === "empresa" && result.role === "parceiro") {
        setError(
          "Esta conta é de parceiro. Use o portal de parceiros (/parceiro).",
        );
        api.setToken(null);
        setLoading(false);
        return;
      }

      onLogin({
        role: result.role as any,
        empresaId: result.empresaId,
        empresaNome: result.empresaNome,
        username: result.username,
        funcao: result.funcao as any,
        funcionarioId: result.funcionarioId,
        funcionarioNome: result.funcionarioNome,
        parceiroId: result.parceiroId,
        parceiroNome: result.parceiroNome,
        parceiroInstituicao: result.parceiroInstituicao,
        modulos: (result as any).modulos,
      });
    } catch (err: any) {
      setError(err.message || "Erro ao iniciar sessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: cfg.bg }}>
      {/* Left branding panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10"
        style={{ background: cfg.bgLeft }}
      >
        <div className="flex items-center gap-3">
          <PortalIcon name={cfg.icon} color={cfg.color} />
          <span className="text-white font-bold text-sm">{cfg.title}</span>
        </div>
        <div>
          <div
            className="text-4xl font-bold text-white leading-tight mb-4"
            dangerouslySetInnerHTML={{
              __html:
                mode === "empresa"
                  ? "Gestão<br/>Laboratorial"
                  : mode === "parceiro"
                    ? "Portal de<br/>Parceiros"
                    : cfg.title,
            }}
          />
          <p className="text-white/40 text-sm leading-relaxed">{cfg.desc}</p>
        </div>
        <div className="space-y-3">
          {cfg.features.map((f) => (
            <div
              key={f}
              className="flex items-center gap-2.5 text-sm"
              style={{ color: "hsl(var(--sidebar-foreground))" }}
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${cfg.color.replace(")", " / 0.25)").replace("hsl(", "hsl(")}`,
                }}
              >
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              </div>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <PortalIcon name={cfg.icon} color={cfg.color} />
            <span className="text-white font-bold">{cfg.title}</span>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-7 py-6 border-b border-border">
              <h1 className="text-xl font-bold text-foreground">
                {cfg.formTitle}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {cfg.formSub}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Utilizador
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    className="form-input pl-9"
                    placeholder="Nome de utilizador"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Palavra-passe
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </div>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="form-input pl-9 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPass ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <div className="flex items-start gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 flex-shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-red-700 text-xs font-medium">{error}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-white"
                style={{ background: cfg.color }}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeOpacity="0.25"
                      />
                      <path d="M21 12a9 9 0 00-9-9" />
                    </svg>
                    A entrar...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>

            <div className="px-7 pb-5 text-center">
              {mode !== "empresa" ? (
                <a
                  href={cfg.footerLink.href}
                  className="text-xs text-muted-foreground hover:text-primary transition flex items-center justify-center gap-1.5"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  {cfg.footerLink.label}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Precisa de acesso?{" "}
                  <a
                    href="/admin"
                    className="text-primary hover:underline font-semibold"
                  >
                    Painel de administração
                  </a>
                </p>
              )}
            </div>
          </div>

          <p
            className="text-center text-xs mt-5"
            style={{ color: "hsl(var(--sidebar-foreground))" }}
          >
            SistemaNV · Gestão Hospitalar
          </p>
        </div>
      </div>
    </div>
  );
}

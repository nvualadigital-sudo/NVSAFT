import { useState, type FormEvent } from "react";
import { api } from "../../store/api";
import type { Session } from "../../store/auth";
import "./login-modern.css";

interface Props {
  onLogin: (session: Session) => void;
  mode?: "admin" | "parceiro" | "empresa";
}

const MODES = {
  empresa: {
    headline: "Bem-vindo de volta",
    subheading: "Entre na sua conta NV-DIGITAL",
    description: "Gestão integrada para a sua instituição.",
    roleRequired: null,
    footer: "Precisa de acesso? Fale com o administrador da sua instituição.",
  },
  admin: {
    headline: "Acesso de administrador",
    subheading: "Entre com as credenciais de desenvolvimento autorizadas.",
    description: "Gestão segura da plataforma e das instituições.",
    roleRequired: "developer",
    footer: "Acesso exclusivo ao desenvolvedor.",
  },
  parceiro: {
    headline: "Portal de parceiros",
    subheading: "Entre com as credenciais fornecidas pelo laboratório.",
    description: "Colaboração clínica entre instituições.",
    roleRequired: "parceiro",
    footer: "Acesso exclusivo a parceiros autorizados.",
  },
} as const;

function ShieldIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 3.8 5.2v6.2c0 5.1 3.2 8.8 8.2 10.6 5-1.8 8.2-5.5 8.2-10.6V5.2L12 2Z" />
      <path d="m8.5 12 2.3 2.3 4.8-5.1" />
    </svg>
  );
}

function FeatureIcon({ type }: { type: "lab" | "pharmacy" | "admin" }) {
  if (type === "lab") return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3h8M14 3v11L5 27a2 2 0 0 0 1.7 3h18.6A2 2 0 0 0 27 27l-9-13V3" />
      <path d="M10 23h12" />
    </svg>
  );
  if (type === "pharmacy") return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10" width="22" height="12" rx="6" transform="rotate(-45 16 16)" />
      <path d="m11.8 20.2 8.4-8.4" />
    </svg>
  );
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 3 12 6-12 6L4 9l12-6ZM4 16l12 6 12-6M4 23l12 6 12-6" />
    </svg>
  );
}

export default function LoginModern({ onLogin, mode = "empresa" }: Props) {
  const cfg = MODES[mode];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await api.auth.login(username.trim(), password);
      api.setToken(result.token);

      if (cfg.roleRequired && result.role !== cfg.roleRequired) {
        const messages: Record<string, string> = {
          developer: "Esta área é apenas para o desenvolvedor.",
          parceiro: "Esta área é exclusiva para parceiros. Utilize o portal da empresa em /.",
        };
        setError(messages[cfg.roleRequired] || "Acesso não autorizado.");
        api.setToken(null);
        return;
      }
      if (mode === "empresa" && result.role === "developer") {
        setError("Use o painel do desenvolvedor (/admin) para entrar com esta conta.");
        api.setToken(null);
        return;
      }
      if (mode === "empresa" && result.role === "parceiro") {
        setError("Esta conta é de parceiro. Use o portal de parceiros (/parceiro).");
        api.setToken(null);
        return;
      }

      onLogin({
        role: result.role as Session["role"],
        empresaId: result.empresaId,
        empresaNome: result.empresaNome,
        username: result.username,
        funcao: result.funcao as Session["funcao"],
        funcionarioId: result.funcionarioId,
        funcionarioNome: result.funcionarioNome,
        parceiroId: result.parceiroId,
        parceiroNome: result.parceiroNome,
        parceiroInstituicao: result.parceiroInstituicao,
        modulos: (result as any).modulos,
      });
    } catch (err: any) {
      setError(err?.message || "Erro ao iniciar sessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nv-login" data-mode={mode}>
      <header className="nv-login__header">
        <a href="/" className="nv-login__brand" aria-label="NV-DIGITAL — página inicial">
          <img src="/brand/nv-digital-logo.png" alt="NV-DIGITAL" />
        </a>
        <span className="nv-login__security"><ShieldIcon /> Acesso seguro</span>
      </header>

      <main className="nv-login__main">
        <section className="nv-login__entry" aria-labelledby="nv-login-title">
          <div className="nv-login__content">
            <div className="nv-login__intro">
              <span className="nv-login__eyebrow">SISTEMA DE GESTÃO INTEGRADA</span>
              <h1 id="nv-login-title">{cfg.headline}</h1>
              <p>{cfg.subheading}</p>
            </div>

            <form onSubmit={handleSubmit} className="nv-login__form">
              <div className="nv-login__field">
                <label htmlFor="nv-login-username">Utilizador ou e-mail</label>
                <div className="nv-login__input-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
                  <input id="nv-login-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="O seu utilizador ou e-mail" required />
                </div>
              </div>

              <div className="nv-login__field">
                <label htmlFor="nv-login-password">Palavra-passe</label>
                <div className="nv-login__input-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                  <input id="nv-login-password" name="password" type={showPass ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Introduza a sua palavra-passe" required />
                  <button type="button" className="nv-login__reveal" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Ocultar palavra-passe" : "Mostrar palavra-passe"} aria-pressed={showPass}>
                    {showPass ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <p className="nv-login__help">Esqueceu-se da palavra-passe? <span>Contacte o administrador.</span></p>
              {error && <div className="nv-login__error" role="alert">{error}</div>}
              <button className="nv-login__submit" type="submit" disabled={loading} aria-busy={loading}>
                {loading ? "A entrar…" : "Entrar"}
                {!loading && <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>}
              </button>
            </form>

            <div className="nv-login__footer-note">
              <span className="nv-login__footer-rule" />
              <span className="nv-login__footer-secure"><ShieldIcon size={17} /> {typeof window !== "undefined" && window.location.protocol === "https:" ? "Ligação HTTPS protegida" : "Autenticação institucional"}</span>
              <span className="nv-login__footer-rule" />
            </div>
            <p className="nv-login__subfooter">{cfg.footer}</p>
            {mode !== "empresa" && <a className="nv-login__back" href="/">← Voltar ao portal das empresas</a>}
          </div>
        </section>

        <aside className="nv-login__showcase" aria-label="Módulos integrados NV-DIGITAL">
          <div className="nv-login__showcase-sheen" aria-hidden="true" />
          <div className="nv-login__flow nv-login__flow--lab" aria-hidden="true" />
          <div className="nv-login__flow nv-login__flow--pharmacy" aria-hidden="true" />
          <div className="nv-login__flow nv-login__flow--admin" aria-hidden="true" />
          <div className="nv-login__module nv-login__module--lab"><span className="nv-login__module-icon"><FeatureIcon type="lab" /></span> Laboratório</div>
          <div className="nv-login__module nv-login__module--pharmacy"><span className="nv-login__module-icon"><FeatureIcon type="pharmacy" /></span> Farmácia</div>
          <div className="nv-login__hero-mark"><span className="nv-login__hero-glow" aria-hidden="true" /><img src="/brand/nv-icon-512.png" alt="Símbolo NV-DIGITAL" /></div>
          <div className="nv-login__module nv-login__module--admin"><span className="nv-login__module-icon"><FeatureIcon type="admin" /></span> Administração</div>
          <p className="nv-login__showcase-caption">Tecnologia que liga todos os serviços de saúde.</p>
        </aside>
      </main>

      <footer className="nv-login__site-footer">{cfg.description} <span>© NV-DIGITAL</span></footer>
    </div>
  );
}

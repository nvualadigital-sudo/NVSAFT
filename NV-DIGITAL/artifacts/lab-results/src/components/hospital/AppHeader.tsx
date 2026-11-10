import { useState, useEffect } from "react";
import {
  Search,
  CalendarDays,
  ChevronUp,
  ChevronDown,
  UserRound,
  Wifi,
  WifiOff,
  Menu,
} from "lucide-react";
import type { Session } from "../../store/auth";
import { useApp } from "../../store/AppContext";
import { NotificationBell } from "../NotificationBell";
import { patientDisplayReference } from "../../utils/displayReference";
const themes = [
  { id: "navy", label: "Azul escuro", color: "#176add" },
  { id: "blue", label: "Azul", color: "#2563eb" },
  { id: "teal", label: "Teal", color: "#0f766e" },
  { id: "green", label: "Verde", color: "#15803d" },
  { id: "purple", label: "Roxo", color: "#7c3aed" },
  { id: "amber", label: "Âmbar", color: "#b45309" },
  { id: "light", label: "Claro", color: "#e2e8f0" },
];
export default function AppHeader({
  session,
  onNav,
  openSidebar,
  allowed,
}: {
  session: Session;
  onNav: (s: string) => void;
  openSidebar: () => void;
  allowed: string[];
}) {
  const { data, isOnline } = useApp(),
    [query, setQuery] = useState(""),
    [theme, setTheme] = useState("navy"),
    [clock, setClock] = useState(new Date());
  useEffect(() => {
    let saved = "navy";
    try {
      saved =
        localStorage.getItem(
          `nv:theme:${session.empresaId}:${session.username}`,
        ) || "navy";
    } catch {}
    setTheme(themes.some((t) => t.id === saved) ? saved : "navy");
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, [session.empresaId, session.username]);
  useEffect(() => {
    document.documentElement.dataset.nvTheme = theme;
  }, [theme]);
  function change(id: string) {
    setTheme(id);
    try {
      localStorage.setItem(
        `nv:theme:${session.empresaId}:${session.username}`,
        id,
      );
    } catch {}
  }
  const matches =
    query.trim().length > 1
      ? data.pacientes
          .filter((p) =>
            `${p.nome} ${p.processo} ${p.id}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .slice(0, 6)
      : [];
  return (
    <header className="nv-app-header">
      <button
        className="nv-icon-button nv-mobile-only"
        aria-label="Abrir menu"
        onClick={openSidebar}
      >
        <Menu size={20} />
      </button>
      <div className="nv-global-search">
        <Search size={18} />
        <input
          aria-label="Pesquisar paciente ou número de processo"
          placeholder="Pesquisar paciente ou número de processo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.length > 1 && (
          <div className="nv-search-results">
            {matches.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setQuery("");
                  onNav(allowed.includes("pacientes") ? "pacientes" : "medico");
                }}
              >
                <strong>{p.nome}</strong>
                <span>
                  Processo {patientDisplayReference(p)}
                </span>
              </button>
            ))}
            {!matches.length && <p>Nenhum paciente encontrado.</p>}
          </div>
        )}
      </div>
      <NotificationBell onTabChange={onNav} />
      <div className="nv-header-date">
        <CalendarDays size={22} />
        <div>
          {clock.toLocaleDateString("pt-AO", {
            timeZone: "Africa/Luanda",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
          <small>
            {clock.toLocaleDateString("pt-AO", {
              timeZone: "Africa/Luanda",
              weekday: "long",
            })}
          </small>
        </div>
        <strong>
          {clock.toLocaleTimeString("pt-AO", {
            timeZone: "Africa/Luanda",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </strong>
      </div>
      <div className="nv-header-user">
        <span>
          <UserRound size={20} />
        </span>
        <div>
          {session.funcionarioNome || session.username}
          <small>{session.empresaNome || "Instituição"}</small>
        </div>
      </div>
      <div className="nv-theme-picker">
        <div>
          <span>Tema da aplicação</span>
          <button
            aria-label="Tema anterior"
            onClick={() =>
              change(
                themes[
                  (themes.findIndex((t) => t.id === theme) +
                    themes.length -
                    1) %
                    themes.length
                ].id,
              )
            }
          >
            <ChevronUp size={14} />
          </button>
          <button
            aria-label="Tema seguinte"
            onClick={() =>
              change(
                themes[
                  (themes.findIndex((t) => t.id === theme) + 1) % themes.length
                ].id,
              )
            }
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <div>
          {themes.map((t) => (
            <button
              title={t.label}
              aria-label={`Tema ${t.label}`}
              aria-pressed={theme === t.id}
              key={t.id}
              style={{ background: t.color }}
              onClick={() => change(t.id)}
            />
          ))}
        </div>
      </div>
      <span
        className="nv-connection"
        title={isOnline ? "Ligação de rede disponível" : "Sem ligação de rede"}
      >
        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
      </span>
    </header>
  );
}

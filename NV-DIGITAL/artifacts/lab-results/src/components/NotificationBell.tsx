import { useState, useEffect, useRef } from "react";
import {
  Bell,
  AlertTriangle,
  CheckCheck,
  ChevronRight,
  RefreshCw,
  Volume2,
  Check,
} from "lucide-react";
import {
  useNotificationFeed,
  enableGeneralAlerts,
} from "../store/notificationFeed";
import "./NotificationBell.css";
const labels: Record<string, string> = {
  resultados: "Resultados",
  criticos: "Críticos",
  pedidos: "Pedidos",
  tarefas: "Tarefas",
  stock: "Stock",
  mensagens: "Mensagens",
  chamadas: "Chamadas",
};
export function NotificationBell({
  onTabChange,
}: {
  onTabChange?: (s: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [filter, setFilter] = useState("todas"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const panel = useRef<HTMLDivElement>(null),
    feed = useNotificationFeed();
  useEffect(() => {
    const show = () => {
      setOpen(true);
      void feed.reload();
    };
    window.addEventListener("nv:notifications-open", show);
    return () => window.removeEventListener("nv:notifications-open", show);
  }, [feed.reload]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const list = feed.items.filter(
    (x) =>
      filter === "todas" ||
      (filter === "novas" && !x.read) ||
      x.category === filter,
  );
  const categories = [...new Set(feed.items.map((x) => x.category))];
  async function read(ids: string[]) {
    if (busy || !ids.length) return;
    setBusy(true);
    setError("");
    try {
      await feed.read(ids);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível guardar a leitura.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="nv-notifications" ref={panel}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void feed.reload();
        }}
        className="nv-icon-button relative"
        aria-label={`Notificações, ${feed.unread} não lidas`}
        aria-expanded={open}
      >
        <Bell size={19} />
        {feed.unread > 0 && (
          <span className="nv-notification-badge">
            {feed.unread > 99 ? "99+" : feed.unread}
          </span>
        )}
      </button>
      {open && (
        <section
          className="nv-notification-panel"
          aria-label="Centro de notificações"
        >
          <header>
            <div>
              <strong>Notificações</strong>
              <small>{feed.unread} não lida(s)</small>
            </div>
            <button
              type="button"
              title="Actualizar"
              onClick={() => void feed.reload()}
            >
              <RefreshCw size={17} />
            </button>
          </header>
          <div className="nv-notification-tools">
            <select
              aria-label="Filtrar notificações"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="novas">Não lidas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {labels[c] || c}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !feed.unread}
              onClick={() =>
                void read(feed.items.filter((x) => !x.read).map((x) => x.id))
              }
            >
              <CheckCheck size={14} />
              Marcar lidas
            </button>
          </div>
          {(feed.error || error) && (
            <div className="nv-notification-error" role="alert">
              {error || feed.error}
            </div>
          )}
          <div className="nv-notification-list">
            {feed.loading && !feed.items.length ? (
              <p>A carregar alertas…</p>
            ) : !list.length ? (
              <p>Sem notificações neste filtro.</p>
            ) : (
              list.map((item) => (
                <article
                  key={item.id}
                  className={
                    (item.read ? "is-read" : "is-unread") +
                    (item.priority === "alta" ? " is-urgent" : "")
                  }
                >
                  <button
                    type="button"
                    className="nv-notification-open"
                    onClick={() => {
                      if (!item.read) void read([item.id]);
                      setOpen(false);
                      onTabChange?.(item.tab);
                    }}
                  >
                    <span className="nv-notification-symbol">
                      {item.priority === "alta" ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <Bell size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                      <span className="nv-notification-meta">
                        {labels[item.category] || item.category}
                        {item.at
                          ? " · " + new Date(item.at).toLocaleString("pt-PT")
                          : ""}
                        {item.requiresAction ? " · Acção pendente" : ""}
                      </span>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  {!item.read && (
                    <button
                      type="button"
                      className="nv-notification-read"
                      disabled={busy}
                      onClick={() => void read([item.id])}
                    >
                      <Check size={12} />
                      Marcar como lida
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
          <footer>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event("nv:alerts-settings"));
                void enableGeneralAlerts()
                  .then(setInfo)
                  .catch(() =>
                    setInfo(
                      "Abra o software num novo separador e permita som e notificações.",
                    ),
                  );
              }}
            >
              <Volume2 size={14} />
              Activar som e notificações
            </button>
            {info && <small role="status">{info}</small>}
            <small>
              Ler um alerta não conclui a tarefa nem confirma uma comunicação
              clínica.
            </small>
          </footer>
        </section>
      )}
    </div>
  );
}

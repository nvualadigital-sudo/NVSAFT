import { useMemo, useSyncExternalStore } from "react";
import { api } from "./api";
import { hospitalApi } from "./hospital";
import { CallSounds } from "../pages/comunicacao/callSounds";
const generalSound = new CallSounds();
generalSound.setVolume(0.25);
export async function enableGeneralAlerts() {
  const sound = generalSound.unlock();
  const permission =
    typeof Notification === "undefined"
      ? Promise.resolve("unsupported")
      : Notification.permission === "default"
        ? Notification.requestPermission()
        : Promise.resolve(Notification.permission);
  const [ready, allowed] = await Promise.all([sound, permission]);
  if (ready) generalSound.chime();
  return (
    (ready ? "Som activado. " : "Som bloqueado pelo navegador. ") +
    (allowed === "granted"
      ? "Notificações permitidas."
      : allowed === "denied"
        ? "Permita notificações nas definições deste site."
        : "Avisos disponíveis dentro do software.")
  );
}
export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  tab: string;
  priority: string;
  at: string | null;
  requiresAction?: boolean;
  read: boolean;
};
type Snapshot = {
  items: NotificationItem[];
  unread: number;
  loading: boolean;
  error: string;
};
type Controller = {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => Snapshot;
  load: () => Promise<void>;
  read: (ids: string[]) => Promise<void>;
};
const controllers = new Map<string, Controller>();
function getController(key: string): Controller {
  const prior = controllers.get(key);
  if (prior) return prior;
  let state: Snapshot = { items: [], unread: 0, loading: true, error: "" },
    listeners = new Set<() => void>();
  let disposeTimer: ReturnType<typeof setTimeout> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined,
    sequence = 0,
    busy = false,
    baseline = false;
  const seen = new Set<string>(),
    shown = new Set<string>();
  const publish = (patch: Partial<Snapshot>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  async function load() {
    if (busy || !key || api.getToken() !== key) return;
    busy = true;
    const version = sequence;
    try {
      const feed = await hospitalApi<{
        items: NotificationItem[];
        unread: number;
      }>("GET", "/notifications-v2");
      if (version !== sequence || api.getToken() !== key) return;
      const fresh = baseline
        ? feed.items.filter((x) => !x.read && !seen.has(x.id))
        : [];
      feed.items.forEach((x) => seen.add(x.id));
      baseline = true;
      publish({ ...feed, loading: false, error: "" });
      if (fresh.length) {
        const alert = new CustomEvent("nv:notification:new", {
          detail: { count: fresh.length },
          cancelable: true,
        });
        window.dispatchEvent(alert);
        if (!alert.defaultPrevented) generalSound.chime();
        if (
          (document.hidden || !document.hasFocus()) &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          for (const item of fresh.slice(0, 3))
            if (!shown.has(item.id))
              try {
                const n = new Notification(
                  item.category === "resultados"
                    ? "Resultado disponível"
                    : "Nova notificação da instituição",
                  {
                    body: "Abra o software para consultar os alertas autorizados.",
                    tag: "nv-general:" + item.id,
                    silent: true,
                  },
                );
                shown.add(item.id);
                n.onclick = () => {
                  window.focus();
                  n.close();
                  window.dispatchEvent(new Event("nv:notifications-open"));
                };
              } catch {}
        }
      }
    } catch (e) {
      if (version === sequence && api.getToken() === key)
        publish({
          loading: false,
          error:
            e instanceof Error ? e.message : "Falha ao carregar notificações.",
        });
    } finally {
      busy = false;
    }
  }
  const wake = () => {
    void load();
  };
  const result: Controller = {
    getSnapshot: () => state,
    subscribe(fn) {
      if (disposeTimer !== undefined) clearTimeout(disposeTimer);
      listeners.add(fn);
      if (listeners.size === 1) {
        void load();
        timer = setInterval(() => {
          void load();
        }, 5000);
        window.addEventListener("focus", wake);
        window.addEventListener("online", wake);
        document.addEventListener("visibilitychange", wake);
      }
      return () => {
        listeners.delete(fn);
        if (!listeners.size) {
          if (timer) clearInterval(timer);
          window.removeEventListener("focus", wake);
          window.removeEventListener("online", wake);
          document.removeEventListener("visibilitychange", wake);
          disposeTimer = setTimeout(() => {
            if (!listeners.size) {
              sequence++;
              controllers.delete(key);
              seen.clear();
              shown.clear();
              state = { items: [], unread: 0, loading: true, error: "" };
            }
          }, 0);
        }
      };
    },
    load,
    async read(ids) {
      if (api.getToken() !== key)
        throw new Error("A sessão mudou. Volte a abrir os alertas.");
      await hospitalApi("POST", "/notifications-v2/read", { ids });
      await load();
    },
  };
  controllers.set(key, result);
  return result;
}
export function useNotificationFeed() {
  const key = api.getToken() || "",
    controller = useMemo(() => getController(key), [key]);
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { ...snapshot, reload: controller.load, read: controller.read };
}

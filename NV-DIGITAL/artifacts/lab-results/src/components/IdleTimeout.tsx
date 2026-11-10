import { useEffect, useRef, useState, useCallback } from "react";

const IDLE_MS = 15 * 60 * 1000;
const WARN_MS = 60 * 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function IdleTimeout({ onLogout }: { onLogout: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warnRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const [showWarn, setShowWarn] = useState(false);
  const [secsLeft, setSecsLeft] = useState(WARN_MS / 1000);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);
    clearInterval(countRef.current);
    setShowWarn(false);

    warnRef.current = setTimeout(() => {
      setSecsLeft(WARN_MS / 1000);
      setShowWarn(true);
      countRef.current = setInterval(() => {
        setSecsLeft((s) => {
          if (s <= 1) {
            clearInterval(countRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }, IDLE_MS - WARN_MS);

    timerRef.current = setTimeout(onLogout, IDLE_MS);
  }, [onLogout]);

  useEffect(() => {
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "scroll",
      "click",
      "wheel",
    ];
    const handler = () => reset();
    events.forEach((e) =>
      window.addEventListener(e, handler, { passive: true }),
    );
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      clearInterval(countRef.current);
    };
  }, [reset]);

  if (!showWarn) return null;

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full text-center">
        <div className="text-5xl mb-3">⏱️</div>
        <h3 className="font-bold text-lg mb-1">Sessão prestes a expirar</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Por inactividade, a sessão será encerrada em{" "}
          <span className="font-bold text-foreground tabular-nums">
            {mins > 0 ? `${mins}m ` : ""}
            {pad(secs)}s
          </span>
          .
        </p>
        <button
          onClick={reset}
          className="w-full py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition"
          style={{ background: "hsl(258 70% 55%)" }}
        >
          Manter sessão activa
        </button>
        <button
          onClick={onLogout}
          className="mt-2 w-full py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground transition font-medium"
        >
          Terminar sessão agora
        </button>
      </div>
    </div>
  );
}

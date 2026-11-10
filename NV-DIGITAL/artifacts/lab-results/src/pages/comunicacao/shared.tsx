import { useCallback, useEffect, useRef, useState } from "react";
import { hospitalApi } from "../../store/hospital";
export { hospitalApi };
export const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
export const button =
  "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
export function useResource<T>(path: string, initial: T, interval = 20000) {
  const [data, setData] = useState(initial),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const value = await hospitalApi<T>("GET", path);
      if (id === seq.current) {
        setData(value);
        setError("");
      }
    } catch (e) {
      if (id === seq.current)
        setError(e instanceof Error ? e.message : "Falha na ligação.");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, interval);
    return () => {
      seq.current++;
      clearInterval(timer);
    };
  }, [load, interval]);
  return { data, error, loading, load };
}
export function Notice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return error || message ? (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-teal-200 bg-teal-50 text-teal-900"}`}
    >
      {error || message}
    </p>
  ) : null;
}

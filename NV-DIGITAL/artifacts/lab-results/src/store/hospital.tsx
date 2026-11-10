import { useEffect, useState, type ReactNode } from "react";
import { reqDirect } from "./api";
const cache = new Map<string, { data: any; revision: number }>();
let company = "";
let pending = false;
let epoch = 0;
export const hospitalEvent = "hospital:remote-change";
export const hospitalApi = <T = any,>(
  method: string,
  path: string,
  body?: unknown,
) => reqDirect<T>(method, "/hospital" + path, body);
export function documentKey(key: string) {
  if (company && key === `hospital:clinical:v1:${encodeURIComponent(company)}`)
    return "clinical";
  if (
    company &&
    key === `hospital:enfermagem:v2:${encodeURIComponent(company)}:atendimentos`
  )
    return "nursing-patients";
  if (
    company &&
    key === `hospital:enfermagem:v2:${encodeURIComponent(company)}:operacao`
  )
    return "nursing-operation";
  if (key === "appointments") return key;
  throw new Error("Área não pertence à instituição activa.");
}
export function readRemote<T>(key: string, initial: T): T {
  const name = documentKey(key),
    found = cache.get(name);
  if (!found) throw new Error("Dados ainda não carregados do servidor.");
  return structuredClone(found.data ?? initial);
}
export async function updateRemote<T>(
  key: string,
  initial: T,
  fn: (s: T) => T,
): Promise<T> {
  if (pending) throw new Error("Aguarde a confirmação da gravação anterior.");
  const writeCompany = company,
    writeEpoch = epoch;
  const name = documentKey(key),
    old = cache.get(name);
  if (!old) throw new Error("Dados não carregados.");
  const next = fn(readRemote(key, initial));
  pending = true;
  try {
    const result = await hospitalApi<{ data: T; revision: number }>(
      "PUT",
      "/workspace/" + name,
      { data: next, revision: old.revision },
    );
    if (writeCompany !== company || writeEpoch !== epoch)
      throw new Error("A sessão mudou durante a gravação.");
    cache.set(name, result);
    window.dispatchEvent(new Event(hospitalEvent));
    window.dispatchEvent(new Event("hospital:clinical-change"));
    return result.data;
  } catch (e) {
    if (writeEpoch === epoch) await refreshRemote().catch(() => {});
    throw e;
  } finally {
    pending = false;
  }
}
export async function refreshRemote() {
  const org = company,
    readEpoch = epoch;
  if (!org) return;
  const rows = await hospitalApi<any[]>("GET", "/workspace");
  if (company !== org || readEpoch !== epoch) return;
  for (const key of [
    "clinical",
    "nursing-patients",
    "nursing-operation",
    "appointments",
  ]) {
    const next = rows.find((x) => x.namespace === key) || {
      data: null,
      revision: 0,
    };
    if (next.revision >= (cache.get(key)?.revision || 0)) cache.set(key, next);
  }
  window.dispatchEvent(new Event(hospitalEvent));
  window.dispatchEvent(new Event("hospital:clinical-change"));
}
export function HospitalProvider({
  org,
  children,
}: {
  org: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [held, setHeld] = useState(0);
  useEffect(() => {
    epoch++;
    company = org;
    cache.clear();
    let active = true;
    const load = () =>
      refreshRemote()
        .then(() => {
          if (active) {
            setReady(true);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void load();
    void hospitalApi<{ held: number }>("GET", "/integrity")
      .then((x) => {
        if (active) setHeld(x.held);
      })
      .catch(() => {});
    const timer = window.setInterval(() => {
      if (!document.hidden && !pending) void load();
    }, 20000);
    return () => {
      active = false;
      clearInterval(timer);
      epoch++;
      cache.clear();
      company = "";
    };
  }, [org]);
  if (!ready)
    return (
      <div className="p-6" role="status">
        {error || "A carregar os dados da instituição…"}
        {error && (
          <button className="ml-3 underline" onClick={() => location.reload()}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  return (
    <>
      {held > 0 && (
        <p role="status" className="bg-amber-50 p-3 text-sm text-amber-900">
          {held} registo(s) anterior(es) retido(s) para verificar a associação
          ao paciente. Consulte a revisão de dados com o administrador.
        </p>
      )}
      {error && (
        <p role="alert" className="bg-red-50 p-3 text-red-800">
          Ligação interrompida: {error}
        </p>
      )}
      {children}
    </>
  );
}

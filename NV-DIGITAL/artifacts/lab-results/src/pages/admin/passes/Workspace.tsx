import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "../../../store/auth";
import { FUNCAO_LABELS } from "../../../store/auth";
import { api } from "../../../store/api";
import { useApp } from "../../../store/AppContext";
import { passDocument } from "./document";
import { renderPassImage } from "./render";
type Staff = {
  id: string;
  nome: string;
  funcao: keyof typeof FUNCAO_LABELS;
  ativo: boolean;
  professional?: {
    category?: string;
    position?: string;
    service?: string;
    employeeCode?: string;
    phone?: string;
    email?: string;
  };
};
export default function PassWorkspace({ session }: { session?: Session }) {
  const { data } = useApp();
  const [people, setPeople] = useState<Staff[]>([]),
    [id, setId] = useState(""),
    [error, setError] = useState("");
  const [reset, setReset] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const renderQueue = useRef(Promise.resolve());
  const renderCount = useRef(0);
  const scope = useMemo(
    () => crypto.randomUUID(),
    [session?.empresaId, id, reset],
  );
  const company = session?.empresaId || "";
  const person = people.find((p) => p.id === id);
  const preferenceKey = `nv:${company}:passes:layout:v2`;
  useEffect(() => {
    let active = true;
    setPeople([]);
    setId("");
    setError("");
    if (company)
      void api.empresas
        .listFuncionarios(company)
        .then((rows) => {
          if (active) setPeople(rows.filter((r: any) => r.ativo));
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [company]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null" ||
        event.data?.scope !== scope ||
        !["nv-pass-preference", "nv-pass-reset", "nv-pass-render"].includes(
          event.data?.type,
        )
      )
        return;
      if (event.data.type === "nv-pass-render") {
        const target = event.source as Window,
          requestId = event.data.requestId;
        if (typeof requestId !== "string" || requestId.length > 80) return;
        const reply = (patch: Record<string, unknown>) => {
          if (target !== frame.current?.contentWindow) return;
          try {
            target.postMessage(
              { type: "nv-pass-rendered", scope, requestId, ...patch },
              "*",
            );
          } catch {
            /* The selected employee or institution changed during rendering. */
          }
        };
        if (renderCount.current >= 4) {
          reply({ error: "Aguarde a exportação em curso." });
          return;
        }
        renderCount.current++;
        const task = renderQueue.current.then(() =>
          renderPassImage(event.data),
        );
        renderQueue.current = task
          .then(
            (image) => {
              reply({ image });
            },
            (e) => {
              reply({
                error:
                  e instanceof Error
                    ? e.message
                    : "Não foi possível exportar o passe.",
              });
            },
          )
          .finally(() => {
            renderCount.current--;
          });
        return;
      }
      if (event.data.type === "nv-pass-reset") {
        try {
          localStorage.removeItem(preferenceKey);
          setReset((n) => n + 1);
        } catch {
          setError("Não foi possível repor as preferências.");
        }
        return;
      }
      const value = event.data.value;
      if (
        value !== null &&
        (typeof value !== "string" || value.length > 500000)
      )
        return;
      try {
        if (value === null) localStorage.removeItem(preferenceKey);
        else {
          JSON.parse(value);
          localStorage.setItem(preferenceKey, value);
        }
      } catch {
        setError(
          "Não foi possível guardar as preferências do passe neste navegador.",
        );
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [scope, preferenceKey]);
  const document = useMemo(() => {
    if (!person || !company) return "";
    let preferences: string | null = null;
    try {
      preferences = localStorage.getItem(preferenceKey);
    } catch {}
    return passDocument(
      {
        companyId: company,
        website: data.config.website || "",
        scope,
        parentOrigin: window.location.origin,
        preferences,
        logo: data.config.logoData || "",
        fields: {
          companyName: data.config.nomeClinica || session?.empresaNome || "",
          subtitle: "Passe de Funcionário",
          phone: data.config.telefone || "",
          companyEmail: data.config.email || "",
          address: data.config.endereco || "",
          employeeName: person.nome,
          employeeRole:
            person.professional?.position ||
            person.professional?.category ||
            FUNCAO_LABELS[person.funcao],
          department: person.professional?.service || "",
          employeeId: person.professional?.employeeCode || person.id,
          employeePhone: person.professional?.phone || "",
          employeeEmail: person.professional?.email || "",
          bloodType: "",
          birthDate: "",
          issueDate: new Date().toISOString().slice(0, 10),
          expiryDate: "",
        },
      },
      new URL(
        (import.meta.env.BASE_URL || "/") + "vendor/passes-runtime.js",
        window.location.origin,
      ).href,
    );
  }, [
    person,
    company,
    scope,
    preferenceKey,
    data.config,
    session?.empresaNome,
  ]);
  return (
    <section className="flex h-full min-h-screen flex-col gap-3 p-3">
      <header className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-white p-4">
        <div>
          <h1 className="text-xl font-bold">Criador de Passes</h1>
          <p className="text-sm text-slate-600">
            80 modelos originais · Frente e verso · PNG, PDF, impressão e
            geração em lote
          </p>
        </div>
        <label className="text-sm">
          Funcionário da empresa
          <select
            className="ml-2 rounded border p-2"
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">Seleccionar funcionário activo</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </header>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {person ? (
        <iframe
          key={company + ":" + person.id + ":" + reset}
          ref={frame}
          srcDoc={document}
          title="Criador de Passes — modelos originais"
          className="min-h-[900px] flex-1 rounded-xl border"
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
        />
      ) : (
        <p className="p-6 text-slate-600">
          Seleccione um funcionário para abrir os modelos com os dados da
          instituição.
        </p>
      )}
      <p className="text-xs text-slate-500">
        As preferências são guardadas apenas para esta empresa neste navegador.
        O QR do passe é uma identificação e não concede acesso ao sistema.
      </p>
    </section>
  );
}

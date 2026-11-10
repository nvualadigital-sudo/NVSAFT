import { useState, type ReactNode, type FormEvent } from "react";
export { hospitalApi, useResource } from "../../pages/comunicacao/shared";
export const dateTime = (s: string) =>
  s ? new Date(s).toLocaleString("pt-AO", { timeZone: "Africa/Luanda" }) : "—";
export function Panel({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="nv-panel">
      <div className="nv-panel-head">
        <h2>{title}</h2>
        {actions}
      </div>
      <div className="nv-panel-body">{children}</div>
    </section>
  );
}
export function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  children,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  children?: ReactNode;
  [key: string]: any;
}) {
  return (
    <label className="nv-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {children ||
        (type === "textarea" ? (
          <textarea
            name={name}
            required={required}
            defaultValue={defaultValue}
            rows={3}
            {...rest}
          />
        ) : (
          <input
            name={name}
            type={type}
            required={required}
            defaultValue={defaultValue}
            {...rest}
          />
        ))}
    </label>
  );
}
export function Status({ children }: { children: ReactNode }) {
  return <span className="nv-status">{children}</span>;
}
export function Feedback({
  message,
  error,
}: {
  message?: string;
  error?: string;
}) {
  return error || message ? (
    <p
      className={"nv-feedback " + (error ? "nv-feedback-error" : "")}
      role={error ? "alert" : "status"}
    >
      {error || message}
    </p>
  ) : null;
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(
    action: () => Promise<any>,
    success = "Operação confirmada.",
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível confirmar a operação.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, message, run };
}
export function dataForm(e: FormEvent<HTMLFormElement>): Record<string, any> {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="nv-empty">{children}</div>;
}
export function Pagination({
  page,
  setPage,
  length,
  size = 50,
}: {
  page: number;
  setPage: (n: number) => void;
  length: number;
  size?: number;
}) {
  return (
    <div className="nv-actions">
      <button
        className="nv-btn nv-btn-secondary"
        disabled={!page}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </button>
      <span>Página {page + 1}</span>
      <button
        className="nv-btn nv-btn-secondary"
        disabled={length < size}
        onClick={() => setPage(page + 1)}
      >
        Seguinte
      </button>
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from "react";
import { X, Folder, FileText, Image, FileSpreadsheet } from "lucide-react";
import type { LibraryItem } from "./api";
import "./workspace.css";
export function FileIcon({
  item,
  size = 24,
}: {
  item: LibraryItem;
  size?: number;
}) {
  if (item.type === "folder")
    return <Folder size={size} color="#d29a31" fill="#f5ce7670" />;
  if (item.mime.startsWith("image/"))
    return <Image size={size} color="#16825d" />;
  if (/spreadsheet|csv/.test(item.mime))
    return <FileSpreadsheet size={size} color="#16825d" />;
  return (
    <FileText
      size={size}
      color={item.mime === "application/pdf" ? "#b83232" : "#23779e"}
    />
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ busy, onClose });
  state.current = { busy, onClose };
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>("input,textarea,select,button")
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !state.current.busy) state.current.onClose();
      if (e.key === "Tab") {
        const controls = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
          ) || []),
        ];
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <div
      className="hd-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"hd-modal" + (wide ? " hd-modal-wide" : "")}
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="hd-modal-content">{children}</div>
      </div>
    </div>
  );
}
export function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="hd-stat" style={{ background: tone }}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <i>{icon}</i>
    </div>
  );
}

import { api } from "../../../store/api";
import { hospitalApi } from "../../../store/hospital";
export interface LibraryItem {
  id: string;
  type: "file" | "folder";
  name: string;
  parentId: string | null;
  mime: string;
  size: number;
  createdBy: string;
  createdAt: string;
  modifiedAt: string;
  deletedAt: string | null;
  favorite: boolean;
  description: string;
  tags: string[];
  revision: number;
  sha256?: string;
}
export interface LibraryTag {
  id: string;
  name: string;
  color: string;
}
export interface LibraryData {
  items: LibraryItem[];
  tags: LibraryTag[];
  activity: {
    id: string;
    actor: string;
    action: string;
    reference: string;
    name: string;
    created_at: string;
  }[];
  quota: { used: number; limit: number; maxFile: number };
  canPurge: boolean;
}
export const EMPTY: LibraryData = {
  items: [],
  tags: [],
  activity: [],
  quota: { used: 0, limit: 500 * 1024 * 1024, maxFile: 10 * 1024 * 1024 },
  canPurge: false,
};
export { hospitalApi };
export function kind(item: LibraryItem) {
  if (item.type === "folder") return "folder";
  if (item.mime.startsWith("image/")) return "image";
  if (item.mime === "application/pdf") return "pdf";
  if (/spreadsheet|csv/.test(item.mime)) return "sheet";
  if (/wordprocessing/.test(item.mime)) return "doc";
  return "text";
}
export function bytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 ** 2) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 ** 2).toFixed(1) + " MB";
}
export function date(value: string) {
  return new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  }).format(new Date(value));
}
export function descendants(all: LibraryItem[], parent: string) {
  const ids = new Set([parent]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const i of all)
      if (i.parentId && ids.has(i.parentId) && !ids.has(i.id)) {
        ids.add(i.id);
        changed = true;
      }
  }
  return all.filter((i) => ids.has(i.id));
}
export function base64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
    r.readAsDataURL(file);
  });
}
export function mime(file: File) {
  const extensions: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    txt: "text/plain",
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return extensions[file.name.split(".").pop()?.toLowerCase() || ""] || "";
}
export async function content(item: LibraryItem) {
  const response = await fetch(
    (import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "") +
      "/api/hospital/library/files/" +
      encodeURIComponent(item.id),
    {
      headers: { Authorization: "Bearer " + api.getToken() },
      cache: "no-store",
    },
  );
  if (response.status === 401)
    window.dispatchEvent(new Event("lab:unauthenticated"));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Documento indisponível nesta instituição.");
  }
  return response.blob();
}
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

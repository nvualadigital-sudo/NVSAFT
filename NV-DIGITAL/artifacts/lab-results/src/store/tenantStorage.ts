import { loadSession } from "./auth";
function key(name: string) {
  const session = loadSession();
  if (!session?.username) throw new Error("Sessão ausente.");
  return `nvualasoft:${encodeURIComponent(session.empresaId || "developer")}:${encodeURIComponent(session.username)}:${name}`;
}
export const tenantStorage = {
  getItem(name: string) {
    try {
      return localStorage.getItem(key(name));
    } catch {
      return null;
    }
  },
  setItem(name: string, value: string) {
    localStorage.setItem(key(name), value);
  },
  removeItem(name: string) {
    localStorage.removeItem(key(name));
  },
};

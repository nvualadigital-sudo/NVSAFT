// ─── Re-exports (keep all existing consumers working) ────────────────────────
export { defaultConfig } from "./defaults";
export type {
  Paciente,
  Resultado,
  LinhaFatura,
  Fatura,
  MovimentoCC,
  Config,
  Produto,
  ExamesCustom,
  AppData,
} from "./AppContext";

export interface ParametroResult {
  exame: string;
  parametro: string;
  resultado: string;
  unidade: string;
  referencia: string;
}

export function formatCurrency(valor: number, moeda: string = "AOA"): string {
  return `${moeda} ${valor.toLocaleString("pt-AO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── IndexedDB ────────────────────────────────────────────────────────────────
// Single "cache" store  : { key: string, data: unknown, updatedAt: number }
// "pending_ops" store   : { id, timestamp, method, path, body }

const DB_NAME = "biocare-offline-v2";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("pending_ops")) {
        db.createObjectStore("pending_ops", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db!);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Cache API ────────────────────────────────────────────────────────────────

/** Write any value into the offline cache under `key`. Never throws. */
export async function cacheWrite(key: string, data: unknown): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("cache", "readwrite");
      tx.objectStore("cache").put({ key, data, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* cache is best-effort */
  }
}

/** Read a previously cached value. Returns null if not found or IDB unavailable. */
export async function cacheRead<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const record = await new Promise<
      { key: string; data: T; updatedAt: number } | undefined
    >((resolve, reject) => {
      const tx = db.transaction("cache", "readonly");
      const req = tx.objectStore("cache").get(key);
      req.onsuccess = () => resolve(req.result as any);
      req.onerror = () => reject(req.error);
    });
    return record?.data ?? null;
  } catch {
    return null;
  }
}

// ─── Pending operations queue ──────────────────────────────────────────────

export interface PendingOp {
  id: string;
  timestamp: number;
  method: "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
}

const LS_KEY = "biocare_pending_ops";

function lsGetOps(): PendingOp[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function lsSaveOps(ops: PendingOp[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ops));
  } catch {
    /* ignore */
  }
}

/** Queue a write operation for later replay when the server is reachable. */
export async function queuePendingOp(
  op: Omit<PendingOp, "id" | "timestamp">,
): Promise<PendingOp> {
  const entry: PendingOp = {
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  };
  let saved = false;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("pending_ops", "readwrite");
      tx.objectStore("pending_ops").put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    saved = true;
  } catch {
    /* fall through to localStorage */
  }
  if (!saved) {
    const list = lsGetOps();
    list.push(entry);
    lsSaveOps(list);
  }
  return entry;
}

/** Return all queued operations sorted by creation time. */
export async function getPendingOps(): Promise<PendingOp[]> {
  try {
    const db = await openDB();
    const list = await new Promise<PendingOp[]>((resolve, reject) => {
      const tx = db.transaction("pending_ops", "readonly");
      const req = tx.objectStore("pending_ops").getAll();
      req.onsuccess = () => resolve(req.result as PendingOp[]);
      req.onerror = () => reject(req.error);
    });
    return list.sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return lsGetOps();
  }
}

/** Remove a single operation from the queue after it has been replayed. */
export async function removePendingOp(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("pending_ops", "readwrite");
      tx.objectStore("pending_ops").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
  // Also clean localStorage fallback
  lsSaveOps(lsGetOps().filter((o) => o.id !== id));
}

/** Clear all queued operations (e.g. after a full resync). */
export async function clearAllPendingOps(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("pending_ops", "readwrite");
      tx.objectStore("pending_ops").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
  localStorage.removeItem(LS_KEY);
}

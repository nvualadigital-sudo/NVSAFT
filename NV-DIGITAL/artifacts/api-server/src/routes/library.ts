import { Router } from "express";
import type { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { getUser, requireEmpresa, type TokenPayload } from "../lib/auth.js";
import {
  apiErrors,
  deny,
  event,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";

const LIMIT = 500 * 1024 * 1024,
  MAX_FILE = 10 * 1024 * 1024;
const MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const DEFAULT_TAGS = [
  { id: "important", name: "Importante", color: "#dc2626" },
  { id: "work", name: "Trabalho", color: "#2563eb" },
  { id: "urgent", name: "Urgente", color: "#d97706" },
  { id: "archive", name: "Arquivo", color: "#7c3aed" },
];
type Entry = {
  description?: string;
  tags?: string[];
  modifiedAt?: string;
  deletedAt?: string | null;
  trashBatch?: string | null;
  revision?: number;
};
type State = {
  entries: Record<string, Entry>;
  tags: typeof DEFAULT_TAGS;
  receipts: Record<string, { id: string; hash: string }>;
};
type Item = {
  id: string;
  type: "folder" | "file";
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
};
const initial = (): State => ({
  entries: {},
  tags: DEFAULT_TAGS.map((t) => ({ ...t })),
  receipts: {},
});
function name(x: unknown, max = 200) {
  const n = value(x, max).replace(/[\r\n/\\\u0000-\u001f]/g, "_");
  if ([".", ".."].includes(n)) deny("Nome inválido.");
  return n;
}
async function record(c: any, org: string, key: string) {
  return (
    await c.query(
      "SELECT data FROM public.hospital_library_meta WHERE empresa_id=$1 AND namespace=$2",
      [org, key],
    )
  ).rows[0]?.data;
}
async function save(c: any, org: string, key: string, data: unknown) {
  await c.query(
    "INSERT INTO public.hospital_library_meta(empresa_id,namespace,data) VALUES($1,$2,$3) ON CONFLICT(empresa_id,namespace) DO UPDATE SET data=EXCLUDED.data,revision=hospital_library_meta.revision+1,updated_at=now()",
    [org, key, JSON.stringify(data)],
  );
}
async function graph(c: any, u: TokenPayload) {
  const [fr, dr, saved, favorites] = await Promise.all([
    c.query(
      "SELECT id,parent_id,name,created_by,created_at FROM public.hospital_folders WHERE empresa_id=$1",
      [u.empresaId],
    ),
    c.query(
      "SELECT id,folder_id,name,mime,size_bytes,created_by,created_at,deleted_at,sha256 FROM public.hospital_files WHERE empresa_id=$1",
      [u.empresaId],
    ),
    record(c, u.empresaId!, "index"),
    record(c, u.empresaId!, "favorites:" + u.username),
  ]);
  const state: State = saved ? { ...initial(), ...saved } : initial();
  const stars = new Set<string>(favorites?.ids || []);
  const items: Item[] = [
    ...fr.rows.map((f: any) => ({
      ...f,
      type: "folder",
      parent: f.parent_id,
      size: 0,
      mime: "",
    })),
    ...dr.rows.map((f: any) => ({
      ...f,
      type: "file",
      parent: f.folder_id,
      size: Number(f.size_bytes),
    })),
  ].map((f) => {
    const m = state.entries[f.id] || {};
    return {
      id: f.id,
      type: f.type as Item["type"],
      name: f.name,
      parentId: f.parent || null,
      mime: f.mime,
      size: f.size,
      createdBy: f.created_by,
      createdAt: new Date(f.created_at).toISOString(),
      modifiedAt: m.modifiedAt || new Date(f.created_at).toISOString(),
      deletedAt: f.deleted_at
        ? new Date(f.deleted_at).toISOString()
        : f.type === "folder"
          ? m.deletedAt || null
          : null,
      favorite: stars.has(f.id),
      description: m.description || "",
      tags: m.tags || [],
      revision: m.revision || 0,
      sha256: f.sha256,
    };
  });
  return { state, stars, items, folders: fr.rows, files: dr.rows };
}
function find(items: Item[], id: unknown, type?: Item["type"]) {
  const item = items.find(
    (i) => i.id === uuid(id) && (!type || i.type === type),
  );
  return item || deny("Documento ou pasta não encontrado.", 404);
}
function children(items: Item[], id: string) {
  const ids = new Set<string>([id]);
  for (let change = true; change; ) {
    change = false;
    for (const i of items)
      if (i.parentId && ids.has(i.parentId) && !ids.has(i.id)) {
        ids.add(i.id);
        change = true;
      }
  }
  return items.filter((i) => ids.has(i.id));
}
function active(items: Item[], item: Item) {
  if (item.deletedAt) return false;
  const seen = new Set<string>([item.id]);
  let parent = item.parentId;
  while (parent) {
    if (seen.has(parent)) return false;
    seen.add(parent);
    const p = items.find((i) => i.id === parent && i.type === "folder");
    if (!p || p.deletedAt) return false;
    parent = p.parentId;
  }
  return true;
}
function destination(items: Item[], id: unknown) {
  if (!id) return null;
  const folder = items.find((i) => i.id === uuid(id) && i.type === "folder");
  if (!folder || !active(items, folder))
    return deny("Pasta de destino indisponível nesta instituição.", 403);
  return folder.id;
}
function unique(
  items: Item[],
  requested: string,
  parent: string | null,
  skip = "",
) {
  const names = new Set(
    items
      .filter((i) => i.parentId === parent && i.id !== skip)
      .map((i) => i.name.toLocaleLowerCase()),
  );
  if (!names.has(requested.toLocaleLowerCase())) return requested;
  const dot = requested.lastIndexOf("."),
    stem = dot > 0 ? requested.slice(0, dot) : requested,
    ext = dot > 0 ? requested.slice(dot) : "";
  for (let n = 2; n < 10000; n++) {
    const candidate = stem.slice(0, 160) + " (" + n + ")" + ext;
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return deny("Existem demasiados documentos com esse nome.", 409);
}
function bump(state: State, item: Item, patch: Partial<Entry> = {}) {
  const m = state.entries[item.id] || {};
  state.entries[item.id] = {
    ...m,
    ...patch,
    revision: (m.revision || 0) + 1,
    modifiedAt: new Date().toISOString(),
  };
}
async function audit(
  c: any,
  u: TokenPayload,
  action: string,
  id: string,
  details: any = {},
) {
  await c.query(
    "INSERT INTO public.hospital_audit(id,empresa_id,actor,action,reference) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), u.empresaId, u.username, "library." + action, id],
  );
  await event(c, u, "library." + action, id, details);
}
const canPurge = (u: TokenPayload) =>
  ["admin", "gestor"].includes(u.funcao || "");

export function createLibraryRouter(pool: Pool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use("/library", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  r.get("/library", async (req, res) => {
    const u = getUser(req),
      g = await graph(pool, u);
    const activity = await pool.query(
      "SELECT id,actor,action,reference,created_at FROM public.hospital_audit WHERE empresa_id=$1 AND action LIKE 'library.%' ORDER BY created_at DESC,id DESC LIMIT 100",
      [u.empresaId],
    );
    res.json({
      folders: g.folders,
      files: g.files,
      items: g.items,
      tags: g.state.tags,
      activity: activity.rows.map((a: any) => ({
        ...a,
        name: g.items.find((i) => i.id === a.reference)?.name || a.reference,
      })),
      quota: {
        used: g.items.reduce((s, i) => s + i.size, 0),
        limit: LIMIT,
        maxFile: MAX_FILE,
      },
      canPurge: canPurge(u),
    });
  });
  r.post("/library/folders", async (req, res) => {
    const u = getUser(req);
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const g = await graph(c, u),
        parent = destination(g.items, req.body.parentId),
        id = randomUUID();
      const folderName = unique(g.items, name(req.body.name, 120), parent);
      await c.query(
        "INSERT INTO public.hospital_folders(id,empresa_id,parent_id,name,created_by) VALUES($1,$2,$3,$4,$5)",
        [id, u.empresaId, parent, folderName, u.username],
      );
      await audit(c, u, "folder.create", id);
      return { id, name: folderName };
    });
    res.status(201).json(result);
  });
  r.post("/library/files", async (req, res) => {
    const u = getUser(req),
      b = req.body;
    if (
      !MIME.includes(b.mime) ||
      typeof b.base64 !== "string" ||
      b.base64.length > 14_000_000 ||
      !/^[a-zA-Z0-9+/]*={0,2}$/.test(b.base64)
    )
      deny("Formato ou tamanho não permitido.");
    const content = Buffer.from(b.base64, "base64");
    if (!content.length || content.length > MAX_FILE)
      deny("Ficheiro vazio ou superior a 10 MB.");
    if (
      b.mime === "application/pdf" &&
      content.subarray(0, 5).toString() !== "%PDF-"
    )
      deny("PDF inválido.");
    if (
      b.mime === "image/png" &&
      content.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    )
      deny("PNG inválido.");
    if (
      b.mime === "image/jpeg" &&
      content.subarray(0, 3).toString("hex") !== "ffd8ff"
    )
      deny("JPEG inválido.");
    const digest = createHash("sha256").update(content).digest("hex");
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const g = await graph(c, u),
        parent = destination(g.items, b.folderId);
      const requestKey = b.requestId
        ? u.username + ":" + uuid(b.requestId)
        : "";
      const requestHash = createHash("sha256")
        .update(JSON.stringify([digest, b.name, b.mime, parent]))
        .digest("hex");
      if (requestKey && g.state.receipts[requestKey]) {
        const prior = g.state.receipts[requestKey];
        if (
          prior.hash !== requestHash ||
          !g.items.some((i) => i.id === prior.id)
        )
          deny("Este pedido de carregamento já foi utilizado.", 409);
        return { id: prior.id, replayed: true };
      }
      if (g.items.reduce((s, i) => s + i.size, 0) + content.length > LIMIT)
        deny("Limite de 500 MB da biblioteca atingido.", 409);
      const id = randomUUID(),
        filename = unique(g.items, name(b.name), parent);
      await c.query(
        "INSERT INTO public.hospital_files(id,empresa_id,folder_id,name,mime,size_bytes,content,sha256,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          id,
          u.empresaId,
          parent,
          filename,
          b.mime,
          content.length,
          content,
          digest,
          u.username,
        ],
      );
      if (requestKey) {
        g.state.receipts[requestKey] = { id, hash: requestHash };
        const keys = Object.keys(g.state.receipts);
        for (const key of keys.slice(0, Math.max(0, keys.length - 2000)))
          delete g.state.receipts[key];
        await save(c, u.empresaId!, "index", g.state);
      }
      await audit(c, u, "upload", id, { bytes: content.length });
      return { id, name: filename };
    });
    res.status(201).json(result);
  });
  r.get("/library/files/:id", async (req, res) => {
    const u = getUser(req);
    const f = await transaction(pool, u.empresaId!, async (c) => {
      const g = await graph(c, u),
        item = find(g.items, req.params.id, "file");
      if (!active(g.items, item)) deny("Documento não encontrado.", 404);
      const row = (
        await c.query(
          "SELECT name,mime,content FROM public.hospital_files WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, item.id],
        )
      ).rows[0];
      await audit(c, u, "download", item.id);
      return row;
    });
    res.setHeader("Content-Type", f.mime);
    res.setHeader(
      "Content-Disposition",
      "attachment; filename*=UTF-8''" + encodeURIComponent(f.name),
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(f.content);
  });
  async function mutate(u: TokenPayload, b: any, refs: any[]) {
    if (!refs.length || refs.length > 100)
      deny("Seleccione entre 1 e 100 itens.");
    if (
      ![
        "rename",
        "move",
        "copy",
        "trash",
        "restore",
        "purge",
        "favorite",
        "describe",
        "tag",
      ].includes(b.action)
    )
      deny("Acção inválida.");
    if (b.action === "purge" && !canPurge(u))
      deny("A eliminação definitiva exige administração ou gestão.", 403);
    return transaction(pool, u.empresaId!, async (c) => {
      const g = await graph(c, u),
        chosen: Item[] = [];
      for (const ref of refs) {
        if (!ref || !["file", "folder"].includes(ref.type))
          deny("Selecção inválida.");
        const item = find(g.items, ref.id, ref.type);
        if (ref.revision !== undefined && ref.revision !== item.revision)
          deny(
            "O item foi alterado noutro posto. Actualize antes de repetir.",
            409,
          );
        if (!chosen.some((i) => i.id === item.id)) chosen.push(item);
      }
      const roots = chosen.filter(
        (i) =>
          !["move", "copy", "trash", "purge"].includes(b.action) ||
          !chosen.some(
            (p) =>
              p.id !== i.id &&
              p.type === "folder" &&
              children(g.items, p.id).some((x) => x.id === i.id),
          ),
      );
      // Restore explicitly selected children too, after their selected parent.
      if (b.action === "restore") {
        const parents = new Map(g.items.map((i) => [i.id, i.parentId]));
        const depth = (item: Item) => {
          const seen = new Set<string>();
          let parent = item.parentId;
          while (parent && !seen.has(parent)) {
            seen.add(parent);
            parent = parents.get(parent) || null;
          }
          return seen.size;
        };
        roots.sort((a, b) => depth(a) - depth(b));
      }
      let dest: string | null = null;
      if (b.action === "move" || b.action === "copy")
        dest = destination(g.items, b.folderId);
      const created: string[] = [];
      for (const item of roots) {
        const descendants =
          item.type === "folder" ? children(g.items, item.id) : [item];
        if (
          ["rename", "move", "copy", "describe", "tag"].includes(b.action) &&
          !active(g.items, item)
        )
          deny("Restaure o item antes de o alterar.", 409);
        if (
          ["move", "copy"].includes(b.action) &&
          dest &&
          descendants.some((x) => x.id === dest)
        )
          deny("Uma pasta não pode ser colocada dentro de si própria.", 409);
        if (b.action === "favorite") {
          if (g.stars.has(item.id)) g.stars.delete(item.id);
          else g.stars.add(item.id);
          continue;
        }
        if (b.action === "rename") {
          const next = name(b.name, item.type === "folder" ? 120 : 200);
          if (unique(g.items, next, item.parentId, item.id) !== next)
            deny("Já existe um item com esse nome nesta pasta.", 409);
          await c.query(
            "UPDATE public." +
              (item.type === "file" ? "hospital_files" : "hospital_folders") +
              " SET name=$3 WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, item.id, next],
          );
          item.name = next;
          bump(g.state, item);
        } else if (b.action === "move") {
          if (unique(g.items, item.name, dest, item.id) !== item.name)
            deny("O destino já contém um item com esse nome.", 409);
          await c.query(
            "UPDATE public." +
              (item.type === "file"
                ? "hospital_files SET folder_id"
                : "hospital_folders SET parent_id") +
              "=$3 WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, item.id, dest],
          );
          item.parentId = dest;
          bump(g.state, item);
        } else if (b.action === "describe") {
          if (typeof b.description !== "string" || b.description.length > 2000)
            deny("Descrição inválida.");
          bump(g.state, item, { description: b.description.trim() });
        } else if (b.action === "tag") {
          if (
            !Array.isArray(b.tags) ||
            b.tags.length > 15 ||
            b.tags.some((id: unknown) => !g.state.tags.some((t) => t.id === id))
          )
            deny("Etiquetas inválidas.");
          bump(g.state, item, { tags: [...new Set<string>(b.tags)] });
        } else if (b.action === "trash") {
          const batch = randomUUID(),
            at = new Date().toISOString();
          for (const child of descendants.filter((i) => !i.deletedAt)) {
            if (child.type === "file")
              await c.query(
                "UPDATE public.hospital_files SET deleted_at=$3 WHERE empresa_id=$1 AND id=$2",
                [u.empresaId, child.id, at],
              );
            bump(g.state, child, { deletedAt: at, trashBatch: batch });
            child.deletedAt = at;
          }
        } else if (b.action === "restore") {
          if (
            item.parentId &&
            !active(g.items, find(g.items, item.parentId, "folder"))
          )
            deny("Restaure primeiro a pasta superior.", 409);
          const batch = g.state.entries[item.id]?.trashBatch;
          for (const child of descendants.filter(
            (i) =>
              i.id === item.id ||
              (batch && g.state.entries[i.id]?.trashBatch === batch),
          )) {
            if (child.type === "file")
              await c.query(
                "UPDATE public.hospital_files SET deleted_at=NULL WHERE empresa_id=$1 AND id=$2",
                [u.empresaId, child.id],
              );
            bump(g.state, child, { deletedAt: null, trashBatch: null });
            child.deletedAt = null;
          }
        } else if (b.action === "purge") {
          if (descendants.some((i) => !i.deletedAt))
            deny("A eliminação definitiva só está disponível na lixeira.", 409);
          const files = descendants
              .filter((i) => i.type === "file")
              .map((i) => i.id),
            folders = descendants
              .filter((i) => i.type === "folder")
              .map((i) => i.id);
          if (files.length)
            await c.query(
              "DELETE FROM public.hospital_files WHERE empresa_id=$1 AND id=ANY($2::uuid[])",
              [u.empresaId, files],
            );
          if (folders.length)
            await c.query(
              "DELETE FROM public.hospital_folders WHERE empresa_id=$1 AND id=ANY($2::uuid[])",
              [u.empresaId, folders],
            );
          for (const child of descendants) delete g.state.entries[child.id];
          g.items = g.items.filter(
            (i) => !descendants.some((d) => d.id === i.id),
          );
        } else if (b.action === "copy") {
          const copied = descendants.filter((i) => active(g.items, i));
          if (
            g.items.reduce((sum, i) => sum + i.size, 0) +
              copied.reduce((sum, i) => sum + i.size, 0) >
            LIMIT
          )
            deny("Espaço insuficiente para a cópia.", 409);
          const mapping = new Map<string, string>();
          const ordered = [...copied];
          ordered.sort((a, d) =>
            a.type === d.type ? 0 : a.type === "folder" ? -1 : 1,
          );
          for (const child of ordered) mapping.set(child.id, randomUUID());
          // Folders precede files; a topological pass preserves every original parent.
          const remaining = [...ordered];
          while (remaining.length) {
            const ready = remaining.findIndex(
              (i) =>
                i.id === item.id || !remaining.some((p) => p.id === i.parentId),
            );
            if (ready < 0) deny("Estrutura de pastas inválida.", 409);
            const child = remaining.splice(ready, 1)[0],
              id = mapping.get(child.id)!;
            const parent =
              child.id === item.id ? dest : mapping.get(child.parentId!)!;
            const requested =
              child.id === item.id
                ? name(
                    b.name || child.name,
                    child.type === "folder" ? 120 : 200,
                  )
                : child.name;
            const filename = unique(g.items, requested, parent);
            if (child.type === "folder")
              await c.query(
                "INSERT INTO public.hospital_folders(id,empresa_id,parent_id,name,created_by) VALUES($1,$2,$3,$4,$5)",
                [id, u.empresaId, parent, filename, u.username],
              );
            else
              await c.query(
                "INSERT INTO public.hospital_files(id,empresa_id,folder_id,name,mime,size_bytes,content,sha256,created_by) SELECT $1,empresa_id,$3,$4,mime,size_bytes,content,sha256,$5 FROM public.hospital_files WHERE empresa_id=$2 AND id=$6",
                [id, u.empresaId, parent, filename, u.username, child.id],
              );
            const next = {
              ...child,
              id,
              parentId: parent,
              name: filename,
              revision: 0,
              createdBy: u.username,
              createdAt: new Date().toISOString(),
              favorite: false,
            };
            g.items.push(next);
            g.state.entries[id] = {
              description: child.description,
              tags: child.tags,
              modifiedAt: next.createdAt,
              revision: 0,
            };
            created.push(id);
          }
        }
        await audit(c, u, b.action, item.id, {
          type: item.type,
          count: descendants.length,
        });
      }
      if (b.action === "favorite")
        await save(c, u.empresaId!, "favorites:" + u.username, {
          ids: [...g.stars],
        });
      else await save(c, u.empresaId!, "index", g.state);
      return { ok: true, created };
    });
  }
  for (const type of ["file", "folder"] as const) {
    r.patch(
      "/library/" + (type === "file" ? "files" : "folders") + "/:id",
      async (req, res) => {
        res.json(
          await mutate(getUser(req), req.body, [
            { id: req.params.id, type, revision: req.body.revision },
          ]),
        );
      },
    );
  }
  r.post("/library/batch", async (req, res) => {
    if (!Array.isArray(req.body.items)) deny("Selecção inválida.");
    res.json(await mutate(getUser(req), req.body, req.body.items));
  });
  r.post("/library/tags", async (req, res) => {
    const u = getUser(req);
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const g = await graph(c, u),
        b = req.body;
      if (!/^#[0-9a-f]{6}$/i.test(b.color || "")) deny("Cor inválida.");
      const tag = { id: randomUUID(), name: value(b.name, 40), color: b.color };
      if (
        g.state.tags.length >= 40 ||
        g.state.tags.some(
          (t) => t.name.toLowerCase() === tag.name.toLowerCase(),
        )
      )
        deny("Etiqueta repetida ou limite de 40 etiquetas atingido.", 409);
      g.state.tags.push(tag);
      await save(c, u.empresaId!, "index", g.state);
      await audit(c, u, "tag.create", tag.id);
      return tag;
    });
    res.status(201).json(result);
  });
  r.delete("/library/tags/:id", async (req, res) => {
    const u = getUser(req);
    await transaction(pool, u.empresaId!, async (c) => {
      const g = await graph(c, u),
        id = String(req.params.id);
      if (!g.state.tags.some((t) => t.id === id))
        deny("Etiqueta não encontrada.", 404);
      g.state.tags = g.state.tags.filter((t) => t.id !== id);
      for (const item of g.items)
        if (item.tags.includes(id))
          bump(g.state, item, { tags: item.tags.filter((t) => t !== id) });
      await save(c, u.empresaId!, "index", g.state);
      await audit(c, u, "tag.delete", id);
    });
    res.json({ ok: true });
  });
  r.use(apiErrors);
  return r;
}

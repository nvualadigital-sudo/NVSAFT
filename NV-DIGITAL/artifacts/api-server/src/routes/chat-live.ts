import { Router } from "express";
import { randomUUID, createHash } from "node:crypto";
import type { Pool } from "pg";
import { pool as productionPool } from "@workspace/db";
import { getUser, requireEmpresa, type TokenPayload } from "../lib/auth.js";
import {
  apiErrors,
  deny,
  event,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";

type User = TokenPayload;
type Conversation = { id: string; peer: string | null; group: string | null };
export function createChatLive(pool: Pool = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  async function conversation(
    c: any,
    u: User,
    id: unknown,
  ): Promise<Conversation> {
    const key = value(id, 240);
    if (key === "team") return { id: key, peer: null, group: null };
    if (key.startsWith("d:")) {
      const peer = key.slice(2);
      const q = await c.query(
        "SELECT 1 FROM public.funcionarios WHERE empresa_id=$1 AND username=$2 AND ativo UNION ALL SELECT 1 FROM public.empresas WHERE id=$1 AND username=$2 AND ativo",
        [u.empresaId, peer],
      );
      if (!q.rowCount || peer === u.username)
        deny("Contacto indisponível.", 403);
      return { id: key, peer, group: null };
    }
    if (key.startsWith("g:")) {
      const group = uuid(key.slice(2));
      const q = await c.query(
        "SELECT 1 FROM public.nv_chat_groups WHERE empresa_id=$1 AND id=$2 AND members ? $3",
        [u.empresaId, group, u.username],
      );
      if (!q.rowCount) deny("Sem acesso a este grupo.", 403);
      return { id: key, peer: "@group:" + group, group };
    }
    return deny("Conversa inválida.");
  }
  async function message(c: any, u: User, id: unknown) {
    const row = (
      await c.query(
        "SELECT * FROM public.hospital_messages WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, uuid(id)],
      )
    ).rows[0];
    if (!row) return deny("Mensagem indisponível.", 404);
    const key = row.group_id
      ? "g:" + row.group_id
      : row.recipient === null
        ? "team"
        : "d:" + (row.sender === u.username ? row.recipient : row.sender);
    if (
      row.recipient !== null &&
      !row.group_id &&
      row.sender !== u.username &&
      row.recipient !== u.username
    )
      deny("Sem acesso à mensagem.", 403);
    await conversation(c, u, key);
    return { ...row, key };
  }
  r.get("/state", async (req, res) => {
    const u = getUser(req);
    const contacts = (
      await pool.query(
        "SELECT username,nome FROM public.funcionarios WHERE empresa_id=$1 AND ativo UNION SELECT username,nome FROM public.empresas WHERE id=$1 AND ativo",
        [u.empresaId],
      )
    ).rows.filter((x: any) => x.username !== u.username);
    const groups = (
      await pool.query(
        "SELECT * FROM public.nv_chat_groups WHERE empresa_id=$1 AND members ? $2 ORDER BY created_at",
        [u.empresaId, u.username],
      )
    ).rows;
    const prefs = (
      await pool.query(
        "SELECT conversation,data FROM public.nv_chat_preferences WHERE empresa_id=$1 AND actor=$2",
        [u.empresaId, u.username],
      )
    ).rows;
    const settings =
      prefs.find((x: any) => x.conversation === "settings")?.data || {};
    const options: Record<string, any> = Object.fromEntries(
      prefs.map((x: any) => [x.conversation, x.data]),
    );
    const chats = [
      {
        id: "team",
        name: "Equipa · canal interno",
        type: "group",
        participants: contacts.map((x: any) => "d:" + x.username),
      },
      ...contacts.map((x: any) => ({
        id: "d:" + x.username,
        name: x.nome,
        type: "individual",
        phone: x.username,
      })),
      ...groups.map((x: any) => ({
        id: "g:" + x.id,
        name: x.name,
        creator: x.creator,
        type: "group",
        participants: x.members
          .filter((m: string) => m !== u.username)
          .map((m: string) => "d:" + m),
        createdAt: new Date(x.created_at).getTime(),
      })),
    ];
    // One tenant-scoped query for previews and unread counts, rather than one query per contact.
    const summaries = (
      await pool.query(
        `WITH visible AS (
      SELECT m.*, CASE WHEN m.group_id IS NOT NULL THEN 'g:'||m.group_id::text
        WHEN m.recipient IS NULL THEN 'team'
        WHEN m.sender=$2 THEN 'd:'||m.recipient ELSE 'd:'||m.sender END AS key
      FROM public.hospital_messages m WHERE m.empresa_id=$1 AND
        ((m.group_id IS NULL AND (m.recipient IS NULL OR m.sender=$2 OR m.recipient=$2)) OR
         EXISTS(SELECT 1 FROM public.nv_chat_groups g WHERE g.id=m.group_id AND g.empresa_id=$1 AND g.members ? $2))
    ), ranked AS (
      SELECT v.*, row_number() OVER(PARTITION BY key ORDER BY created_at DESC,id DESC) AS rn,
      sum(CASE WHEN sender<>$2 AND created_at>coalesce(rr.read_at,'epoch'::timestamptz)
        AND created_at>coalesce((p.data->>'cutoff')::timestamptz,'epoch'::timestamptz) THEN 1 ELSE 0 END)
        OVER(PARTITION BY key) AS unread
      FROM visible v LEFT JOIN public.hospital_read_receipts rr ON rr.empresa_id=$1 AND rr.actor=$2 AND rr.conversation=v.key
      LEFT JOIN public.nv_chat_preferences p ON p.empresa_id=$1 AND p.actor=$2 AND p.conversation=v.key
    ) SELECT key,body,deleted_at,created_at,unread FROM ranked WHERE rn=1`,
        [u.empresaId, u.username],
      )
    ).rows;
    res.json({
      settings,
      chats: chats.map((x: any, i) => {
        const s = summaries.find((m: any) => m.key === x.id),
          p = options[x.id] || {};
        const afterCutoff =
          s && (!p.cutoff || new Date(s.created_at) > new Date(p.cutoff));
        return {
          ...x,
          ...p,
          av: (i % 10) + 1,
          unread: Number(s?.unread || 0),
          hidden: !!p.hidden && !afterCutoff,
          preview: afterCutoff
            ? s.deleted_at
              ? "Mensagem eliminada"
              : s.body
            : "",
          time: afterCutoff ? new Date(s.created_at).toISOString() : "",
        };
      }),
    });
  });
  r.get("/messages", async (req, res) => {
    const u = getUser(req),
      conv = await conversation(pool, u, req.query.conversation);
    const offset = Math.min(
      100000,
      Math.max(0, Math.floor(Number(req.query.offset) || 0)),
    );
    const rows = (
      await pool.query(
        `SELECT m.*,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size_bytes)) FROM public.nv_chat_attachments a WHERE a.empresa_id=m.empresa_id AND a.message_id=m.id),'[]') AS attachments,
      coalesce((SELECT jsonb_agg(jsonb_build_object('emoji',rx.emoji,'actor',rx.actor)) FROM public.nv_chat_reactions rx WHERE rx.empresa_id=m.empresa_id AND rx.message_id=m.id),'[]') AS reactions,
      (SELECT max(rr.read_at) FROM public.hospital_read_receipts rr WHERE rr.empresa_id=m.empresa_id AND rr.actor=m.recipient AND rr.conversation='d:'||m.sender AND rr.read_at>=m.created_at) AS read_at
      FROM public.hospital_messages m WHERE m.empresa_id=$1 AND
      (($3::uuid IS NOT NULL AND m.group_id=$3) OR ($3::uuid IS NULL AND m.group_id IS NULL AND
        (($4::text IS NULL AND m.recipient IS NULL) OR (m.sender=$2 AND m.recipient=$4) OR (m.sender=$4 AND m.recipient=$2))))
      AND m.created_at>coalesce((SELECT (p.data->>'cutoff')::timestamptz FROM public.nv_chat_preferences p WHERE p.empresa_id=$1 AND p.actor=$2 AND p.conversation=$5),'epoch'::timestamptz)
      ORDER BY m.created_at DESC,m.id DESC LIMIT 100 OFFSET $6`,
        [u.empresaId, u.username, conv.group, conv.peer, conv.id, offset],
      )
    ).rows;
    res.json({
      messages: rows.reverse().map((m: any) => ({
        id: m.id,
        text: m.deleted_at ? "Mensagem eliminada" : m.body,
        senderName: m.sender_name,
        type: m.sender === u.username ? "sent" : "received",
        timestamp: new Date(m.created_at).getTime(),
        replyTo: m.reply_to,
        edited: !!m.edited_at,
        deleted: !!m.deleted_at,
        read: !!m.read_at,
        attachments: m.deleted_at ? [] : m.attachments,
        reactions: m.deleted_at
          ? {}
          : m.reactions.reduce(
              (all: any, rx: any) => ({
                ...all,
                [rx.emoji]: [...(all[rx.emoji] || []), rx.actor],
              }),
              {},
            ),
      })),
      hasMore: rows.length === 100,
    });
  });
  r.post("/read", async (req, res) => {
    const u = getUser(req),
      conv = await conversation(pool, u, req.body.conversation);
    // Mark only the last message actually displayed; a later arrival stays unread.
    const m = await message(pool, u, req.body.lastId);
    if (m.key !== conv.id) deny("Mensagem de outra conversa.");
    await pool.query(
      "INSERT INTO public.hospital_read_receipts(empresa_id,actor,conversation,read_at) VALUES($1,$2,$3,$4) ON CONFLICT(empresa_id,actor,conversation) DO UPDATE SET read_at=greatest(hospital_read_receipts.read_at,excluded.read_at)",
      [u.empresaId, u.username, conv.id, m.created_at],
    );
    res.json({ ok: true });
  });
  r.post("/groups", async (req, res) => {
    const u = getUser(req),
      name = value(req.body.name, 120),
      requestId = uuid(req.body.requestId);
    if (
      !Array.isArray(req.body.participants) ||
      req.body.participants.length < 1 ||
      req.body.participants.length > 100
    )
      deny("Seleccione entre 1 e 100 participantes.");
    const members = [
      ...new Set([
        u.username,
        ...req.body.participants.map((x: unknown) => value(x, 200)),
      ]),
    ];
    const result = await transaction(pool, u.empresaId!, async (c) => {
      for (const member of members)
        if (member !== u.username) await conversation(c, u, "d:" + member);
      const prior = (
        await c.query(
          "SELECT id,name,members FROM public.nv_chat_groups WHERE empresa_id=$1 AND creator=$2 AND request_id=$3",
          [u.empresaId, u.username, requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.name !== name ||
          JSON.stringify(prior.members) !== JSON.stringify(members)
        )
          deny("Pedido reutilizado com outro grupo.", 409);
        return { id: "g:" + prior.id };
      }
      const id = randomUUID();
      await c.query(
        "INSERT INTO public.nv_chat_groups(id,empresa_id,name,creator,members,request_id) VALUES($1,$2,$3,$4,$5,$6)",
        [id, u.empresaId, name, u.username, JSON.stringify(members), requestId],
      );
      await event(c, u, "chat.group.create", id, { members: members.length });
      return { id: "g:" + id };
    });
    res.status(201).json(result);
  });
  r.patch("/preferences", async (req, res) => {
    const u = getUser(req),
      key = req.body.conversation;
    if (key !== "settings") await conversation(pool, u, key);
    const patch: Record<string, any> = {},
      b = req.body.data || {};
    if (key === "settings") {
      if (typeof b.dark === "boolean") patch.dark = b.dark;
      if (["pt", "en", "fr"].includes(b.language)) patch.language = b.language;
      if (["default", "green", "mint", "blue", "purple", "rose", "orange", "slate", "cream"].includes(b.bubbleColor))
        patch.bubbleColor = b.bubbleColor;
    } else {
      for (const k of ["muted", "blocked", "pinned", "hidden"])
        if (typeof b[k] === "boolean") patch[k] = b[k];
      if (typeof b.mutedUntil === "number" && Number.isFinite(b.mutedUntil))
        patch.mutedUntil = b.mutedUntil;
      if (
        typeof b.wallpaper === "string" &&
        b.wallpaper.length <= 750000 &&
        (/^[a-z0-9-]*$/i.test(b.wallpaper) ||
          /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(b.wallpaper))
      )
        patch.wallpaper = b.wallpaper;
      if (["default", "green", "mint", "blue", "purple", "rose", "orange", "slate", "cream"].includes(b.bubbleColor))
        patch.bubbleColor = b.bubbleColor;
      if (b.clear === true) patch.cutoff = new Date().toISOString();
    }
    await pool.query(
      "INSERT INTO public.nv_chat_preferences(empresa_id,actor,conversation,data) VALUES($1,$2,$3,$4) ON CONFLICT(empresa_id,actor,conversation) DO UPDATE SET data=nv_chat_preferences.data || excluded.data",
      [u.empresaId, u.username, key, JSON.stringify(patch)],
    );
    res.json({ ok: true });
  });
  r.post("/send", async (req, res) => {
    const u = getUser(req),
      b = req.body,
      requestId = uuid(b.requestId);
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const conv = await conversation(c, u, b.conversation),
        body = value(b.text, 4000, true) || (b.attachment ? "Anexo" : "");
      if (!body) deny("Escreva uma mensagem ou seleccione um anexo.");
      let file: {
        name: string;
        mime: string;
        bytes: Buffer;
        hash: string;
      } | null = null;
      if (b.attachment) {
        const a = b.attachment,
          name = value(a.name, 180).replace(/[\x00-\x1f/\\]/g, "_"),
          mime = value(a.mime, 80);
        if (
          typeof a.base64 !== "string" ||
          a.base64.length > 7000000 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64)
        )
          deny("Anexo inválido.");
        const bytes = Buffer.from(a.base64, "base64");
        if (!bytes.length || bytes.length > 5242880)
          deny("Limite de 5 MB por anexo.");
        const hex = bytes.subarray(0, 8).toString("hex");
        const valid =
          mime === "image/png"
            ? hex === "89504e470d0a1a0a"
            : mime === "image/jpeg"
              ? hex.startsWith("ffd8ff")
              : mime === "application/pdf"
                ? bytes.subarray(0, 5).toString() === "%PDF-"
                : mime === "text/plain"
                  ? !bytes.includes(0)
                  : ["audio/webm", "video/webm"].includes(mime)
                    ? hex.startsWith("1a45dfa3")
                    : mime === "audio/ogg"
                      ? bytes.subarray(0, 4).toString() === "OggS"
                      : mime === "audio/mp4"
                        ? bytes.subarray(4, 8).toString() === "ftyp"
                        : false;
        if (!valid)
          deny(
            "Tipo não aceite. Utilize PDF, PNG, JPEG, TXT ou áudio WebM/OGG/MP4.",
          );
        file = {
          name,
          mime,
          bytes,
          hash: createHash("sha256").update(bytes).digest("hex"),
        };
      }
      const prior = (
        await c.query(
          "SELECT m.*,coalesce((SELECT a.sha256 FROM public.nv_chat_attachments a WHERE a.empresa_id=m.empresa_id AND a.message_id=m.id LIMIT 1),'') AS hash FROM public.hospital_messages m WHERE m.empresa_id=$1 AND m.sender=$2 AND m.request_id=$3",
          [u.empresaId, u.username, requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.body !== body ||
          prior.recipient !== conv.peer ||
          prior.group_id !== conv.group ||
          prior.reply_to !== (b.replyTo || null) ||
          prior.hash !== (file?.hash || "")
        )
          deny("Pedido reutilizado com outro conteúdo.", 409);
        return { id: prior.id, repeated: true };
      }
      const blocked = await c.query(
        "SELECT 1 FROM public.nv_chat_preferences WHERE empresa_id=$1 AND ((actor=$2 AND conversation=$3) OR (actor=$4 AND conversation=$5)) AND data->>'blocked'='true'",
        [u.empresaId, u.username, conv.id, conv.peer || "", "d:" + u.username],
      );
      if (blocked.rowCount) deny("Contacto bloqueado.", 403);
      if (b.replyTo) {
        const parent = await message(c, u, b.replyTo);
        if (parent.key !== conv.id) deny("Resposta de outra conversa.");
      }
      const id = randomUUID();
      await c.query(
        "INSERT INTO public.hospital_messages(id,empresa_id,sender,sender_name,recipient,body,request_id,group_id,reply_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          id,
          u.empresaId,
          u.username,
          u.funcionarioNome || u.username,
          conv.peer,
          body,
          requestId,
          conv.group,
          b.replyTo || null,
        ],
      );
      if (file)
        await c.query(
          "INSERT INTO public.nv_chat_attachments(id,empresa_id,message_id,name,mime,content,size_bytes,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            randomUUID(),
            u.empresaId,
            id,
            file.name,
            file.mime,
            file.bytes,
            file.bytes.length,
            file.hash,
          ],
        );
      await event(c, u, "chat.send", id, {
        group: !!conv.group,
        attachment: !!file,
      });
      return { id };
    });
    res.status(201).json(result);
  });
  r.patch("/messages/:id", async (req, res) => {
    const u = getUser(req),
      text = value(req.body.text, 4000);
    await transaction(pool, u.empresaId!, async (c) => {
      const m = await message(c, u, req.params.id);
      if (m.sender !== u.username || m.deleted_at)
        deny("Só pode editar as suas mensagens activas.", 403);
      await c.query(
        "UPDATE public.hospital_messages SET body=$3,edited_at=now() WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, m.id, text],
      );
      await event(c, u, "chat.edit", m.id);
    });
    res.json({ ok: true });
  });
  r.delete("/messages/:id", async (req, res) => {
    const u = getUser(req);
    await transaction(pool, u.empresaId!, async (c) => {
      const m = await message(c, u, req.params.id);
      if (m.sender !== u.username)
        deny("Só pode eliminar as suas mensagens.", 403);
      await c.query(
        "UPDATE public.hospital_messages SET deleted_at=coalesce(deleted_at,now()) WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, m.id],
      );
      await event(c, u, "chat.delete", m.id);
    });
    res.json({ ok: true });
  });
  r.post("/messages/:id/reactions", async (req, res) => {
    const u = getUser(req),
      emoji = value(req.body.emoji, 32);
    await transaction(pool, u.empresaId!, async (c) => {
      const m = await message(c, u, req.params.id);
      if (m.deleted_at) deny("Mensagem eliminada.");
      const removed = await c.query(
        "DELETE FROM public.nv_chat_reactions WHERE empresa_id=$1 AND message_id=$2 AND actor=$3 AND emoji=$4 RETURNING actor",
        [u.empresaId, m.id, u.username, emoji],
      );
      if (!removed.rowCount)
        await c.query(
          "INSERT INTO public.nv_chat_reactions(empresa_id,message_id,actor,emoji) VALUES($1,$2,$3,$4)",
          [u.empresaId, m.id, u.username, emoji],
        );
    });
    res.json({ ok: true });
  });
  r.get("/attachments/:id", async (req, res) => {
    const u = getUser(req),
      id = uuid(req.params.id);
    const a = (
      await pool.query(
        "SELECT * FROM public.nv_chat_attachments WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, id],
      )
    ).rows[0];
    if (!a) deny("Anexo indisponível.", 404);
    const m = await message(pool, u, a.message_id);
    if (m.deleted_at) deny("Mensagem eliminada.", 404);
    res.setHeader("Content-Type", a.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
    );
    res.send(Buffer.from(a.content));
  });
  r.use(apiErrors);
  return r;
}
export default createChatLive();

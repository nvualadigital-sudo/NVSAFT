import { Router } from "express";
import { randomUUID } from "node:crypto";
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

export function createChatSocial(pool: Pool = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  async function space(
    c: any,
    u: TokenPayload,
    id: unknown,
    readPosts = false,
  ) {
    const row = (
      await c.query(
        "SELECT s.*,EXISTS(SELECT 1 FROM public.nv_chat_space_members m WHERE m.empresa_id=s.empresa_id AND m.space_id=s.id AND m.actor=$3) AS joined FROM public.nv_chat_spaces s WHERE s.empresa_id=$1 AND s.id=$2",
        [u.empresaId, uuid(id), u.username],
      )
    ).rows[0];
    if (!row) return deny("Espaço indisponível.", 404);
    if (readPosts && row.kind === "community" && !row.joined)
      deny("Adira à comunidade para consultar as publicações.", 403);
    return row;
  }
  r.get("/status", async (req, res) => {
    const u = getUser(req);
    const rows = (
      await pool.query(
        "SELECT id,author,author_name,body,created_at,expires_at FROM public.nv_chat_posts WHERE empresa_id=$1 AND space_id IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 100",
        [u.empresaId],
      )
    ).rows;
    res.json(rows);
  });
  r.get("/spaces", async (req, res) => {
    const u = getUser(req),
      kind = req.query.kind;
    if (!["channel", "community"].includes(String(kind)))
      deny("Tipo inválido.");
    const rows = (
      await pool.query(
        "SELECT s.id,s.kind,s.name,s.description,s.creator,s.created_at,EXISTS(SELECT 1 FROM public.nv_chat_space_members m WHERE m.empresa_id=s.empresa_id AND m.space_id=s.id AND m.actor=$3) AS joined,(SELECT count(*)::int FROM public.nv_chat_space_members m WHERE m.empresa_id=s.empresa_id AND m.space_id=s.id) AS member_count FROM public.nv_chat_spaces s WHERE s.empresa_id=$1 AND s.kind=$2 ORDER BY s.created_at DESC LIMIT 100",
        [u.empresaId, kind, u.username],
      )
    ).rows;
    res.json(rows);
  });
  r.post("/spaces", async (req, res) => {
    const u = getUser(req),
      b = req.body,
      kind = b.kind,
      name = value(b.name, 120),
      description = value(b.description, 500, true),
      requestId = uuid(b.requestId);
    if (!["channel", "community"].includes(kind)) deny("Tipo inválido.");
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const prior = (
        await c.query(
          "SELECT * FROM public.nv_chat_spaces WHERE empresa_id=$1 AND creator=$2 AND request_id=$3",
          [u.empresaId, u.username, requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.kind !== kind ||
          prior.name !== name ||
          prior.description !== description
        )
          deny("Pedido reutilizado com outro espaço.", 409);
        return { id: prior.id };
      }
      const id = randomUUID();
      await c.query(
        "INSERT INTO public.nv_chat_spaces(id,empresa_id,kind,name,description,creator,request_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, u.empresaId, kind, name, description, u.username, requestId],
      );
      await c.query(
        "INSERT INTO public.nv_chat_space_members(empresa_id,space_id,actor) VALUES($1,$2,$3)",
        [u.empresaId, id, u.username],
      );
      await event(c, u, "chat.space.create", id, { kind });
      return { id };
    });
    res.status(201).json(result);
  });
  r.post("/spaces/:id/membership", async (req, res) => {
    const u = getUser(req),
      join = req.body.join;
    if (typeof join !== "boolean") deny("Indique a adesão.");
    await transaction(pool, u.empresaId!, async (c) => {
      const row = await space(c, u, req.params.id);
      if (!join && row.creator === u.username)
        deny("O criador deve permanecer no espaço.");
      if (join)
        await c.query(
          "INSERT INTO public.nv_chat_space_members(empresa_id,space_id,actor) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [u.empresaId, row.id, u.username],
        );
      else
        await c.query(
          "DELETE FROM public.nv_chat_space_members WHERE empresa_id=$1 AND space_id=$2 AND actor=$3",
          [u.empresaId, row.id, u.username],
        );
      await event(c, u, join ? "chat.space.join" : "chat.space.leave", row.id);
    });
    res.json({ ok: true });
  });
  r.get("/spaces/:id/posts", async (req, res) => {
    const u = getUser(req);
    await space(pool, u, req.params.id, true);
    const offset = Math.min(
      100000,
      Math.max(0, Math.floor(Number(req.query.offset) || 0)),
    );
    const rows = (
      await pool.query(
        "SELECT id,author,author_name,body,created_at FROM public.nv_chat_posts WHERE empresa_id=$1 AND space_id=$2 ORDER BY created_at DESC,id DESC LIMIT 100 OFFSET $3",
        [u.empresaId, req.params.id, offset],
      )
    ).rows;
    res.json(rows.reverse());
  });
  r.post("/posts", async (req, res) => {
    const u = getUser(req),
      body = value(req.body.body, 4000),
      requestId = uuid(req.body.requestId),
      id = req.body.spaceId ? uuid(req.body.spaceId) : null;
    const result = await transaction(pool, u.empresaId!, async (c) => {
      if (id) {
        const row = await space(c, u, id, true);
        if (row.kind === "channel" && row.creator !== u.username)
          deny("Só o criador pode publicar neste canal.", 403);
      }
      const prior = (
        await c.query(
          "SELECT * FROM public.nv_chat_posts WHERE empresa_id=$1 AND author=$2 AND request_id=$3",
          [u.empresaId, u.username, requestId],
        )
      ).rows[0];
      if (prior) {
        if (prior.body !== body || prior.space_id !== id)
          deny("Pedido reutilizado com outra publicação.", 409);
        return { id: prior.id };
      }
      const post = randomUUID();
      await c.query(
        "INSERT INTO public.nv_chat_posts(id,empresa_id,space_id,author,author_name,body,request_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $3::uuid IS NULL THEN now()+interval '24 hours' ELSE NULL END)",
        [
          post,
          u.empresaId,
          id,
          u.username,
          u.funcionarioNome || u.username,
          body,
          requestId,
        ],
      );
      await event(c, u, id ? "chat.space.post" : "chat.status.post", post);
      return { id: post };
    });
    res.status(201).json(result);
  });
  r.delete("/posts/:id", async (req, res) => {
    const u = getUser(req);
    await transaction(pool, u.empresaId!, async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM public.nv_chat_posts WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, uuid(req.params.id)],
        )
      ).rows[0];
      if (!row) deny("Publicação indisponível.", 404);
      if (row.author !== u.username)
        deny("Só pode remover as suas publicações.", 403);
      await c.query(
        "DELETE FROM public.nv_chat_posts WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, row.id],
      );
      await event(c, u, "chat.post.delete", row.id);
    });
    res.json({ ok: true });
  });
  r.use(apiErrors);
  return r;
}
export default createChatSocial();

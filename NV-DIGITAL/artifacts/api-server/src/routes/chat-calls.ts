import { Router } from "express";
import { createHmac, randomUUID } from "node:crypto";
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

export function createChatCalls(pool: Pool = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  async function expire(c: any, org: string) {
    await c.query(
      "UPDATE public.nv_chat_calls SET status=CASE WHEN status='ringing' THEN 'missed' ELSE 'ended' END,ended_at=now() WHERE empresa_id=$1 AND ((status='ringing' AND created_at<now()-interval '60 seconds') OR (status='accepted' AND (caller_seen<now()-interval '90 seconds' OR callee_seen<now()-interval '90 seconds')))",
      [org],
    );
    // Only temporary connection metadata; no voice or video is saved here.
    await c.query(
      "DELETE FROM public.nv_chat_call_signals s USING public.nv_chat_calls c WHERE s.call_id=c.id AND s.empresa_id=c.empresa_id AND c.empresa_id=$1 AND c.ended_at<now()-interval '5 minutes'",
      [org],
    );
  }
  async function call(c: any, u: TokenPayload, id: unknown) {
    const row = (
      await c.query(
        "SELECT * FROM public.nv_chat_calls WHERE empresa_id=$1 AND id=$2 AND (caller=$3 OR callee=$3)",
        [u.empresaId, uuid(id), u.username],
      )
    ).rows[0];
    if (!row) return deny("Chamada indisponível.", 404);
    // Recheck both participants: disabling a colleague also revokes call access.
    const q = await c.query(
      "SELECT username FROM public.funcionarios WHERE empresa_id=$1 AND ativo AND username=ANY($2::text[]) UNION SELECT username FROM public.empresas WHERE id=$1 AND ativo AND username=ANY($2::text[])",
      [u.empresaId, [row.caller, row.callee]],
    );
    if (q.rows.length !== 2)
      deny("Um dos participantes deixou de estar activo.", 403);
    return row;
  }
  r.get("/config", (req, res) => {
    const u = getUser(req),
      iceServers: any[] = [];
    const stun = (process.env.CHAT_STUN_URLS || "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^stuns?:[^\s]+$/.test(x));
    if (stun.length) iceServers.push({ urls: stun });
    const urls = (process.env.CHAT_TURN_URLS || "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^turns?:[^\s]+$/.test(x));
    if (urls.length && process.env.CHAT_TURN_SECRET) {
      const username = `${Math.floor(Date.now() / 1000) + 7200}:${createHmac(
        "sha256",
        process.env.CHAT_TURN_SECRET,
      )
        .update(u.empresaId + ":" + u.username)
        .digest("hex")
        .slice(0, 16)}`;
      iceServers.push({
        urls,
        username,
        credential: createHmac("sha1", process.env.CHAT_TURN_SECRET)
          .update(username)
          .digest("base64"),
      });
    }
    res.json({
      iceServers,
      relayConfigured: iceServers.some((x) => x.credential),
      ringSeconds: 60,
    });
  });
  r.get("/inbox", async (req, res) => {
    const u = getUser(req);
    await expire(pool, u.empresaId!);
    const calls = (
      await pool.query(
        "SELECT c.*,coalesce(f.nome,e.nome,c.caller) AS caller_name FROM public.nv_chat_calls c LEFT JOIN public.funcionarios f ON f.empresa_id=c.empresa_id AND f.username=c.caller LEFT JOIN public.empresas e ON e.id=c.empresa_id AND e.username=c.caller WHERE c.empresa_id=$1 AND c.callee=$2 AND c.status='ringing' ORDER BY c.created_at DESC LIMIT 1",
        [u.empresaId, u.username],
      )
    ).rows;
    res.json(calls);
  });
  r.get("/history", async (req, res) => {
    const u = getUser(req);
    await expire(pool, u.empresaId!);
    const rows = (
      await pool.query(
        "SELECT c.id,c.caller,c.callee,c.kind,c.status,c.created_at,c.accepted_at,c.ended_at,coalesce(f.nome,e.nome,CASE WHEN c.caller=$2 THEN c.callee ELSE c.caller END) AS peer_name FROM public.nv_chat_calls c LEFT JOIN public.funcionarios f ON f.empresa_id=c.empresa_id AND f.username=CASE WHEN c.caller=$2 THEN c.callee ELSE c.caller END LEFT JOIN public.empresas e ON e.id=c.empresa_id AND e.username=CASE WHEN c.caller=$2 THEN c.callee ELSE c.caller END WHERE c.empresa_id=$1 AND (c.caller=$2 OR c.callee=$2) ORDER BY c.created_at DESC LIMIT 100",
        [u.empresaId, u.username],
      )
    ).rows;
    res.json(rows);
  });
  r.post("/", async (req, res) => {
    const u = getUser(req),
      peer = value(req.body.peer, 200),
      id = uuid(req.body.requestId),
      kind = req.body.kind;
    if (!["voice", "video"].includes(kind) || peer === u.username)
      deny("Seleccione um colega e um tipo de chamada válido.");
    const result = await transaction(pool, u.empresaId!, async (c) => {
      await expire(c, u.empresaId!);
      const prior = (
        await c.query(
          "SELECT * FROM public.nv_chat_calls WHERE empresa_id=$1 AND caller=$2 AND request_id=$3",
          [u.empresaId, u.username, id],
        )
      ).rows[0];
      if (prior) {
        if (prior.callee !== peer || prior.kind !== kind)
          deny("Pedido reutilizado com outra chamada.", 409);
        return prior;
      }
      const found = await c.query(
        "SELECT 1 FROM public.funcionarios WHERE empresa_id=$1 AND ativo AND username=$2 UNION ALL SELECT 1 FROM public.empresas WHERE id=$1 AND ativo AND username=$2",
        [u.empresaId, peer],
      );
      if (!found.rowCount)
        deny("Contacto não pertence à sua instituição.", 403);
      const blocked = await c.query(
        "SELECT 1 FROM public.nv_chat_preferences WHERE empresa_id=$1 AND ((actor=$2 AND conversation=$3) OR (actor=$4 AND conversation=$5)) AND data->>'blocked'='true'",
        [u.empresaId, u.username, "d:" + peer, peer, "d:" + u.username],
      );
      if (blocked.rowCount) deny("Contacto bloqueado.", 403);
      const busy = await c.query(
        "SELECT 1 FROM public.nv_chat_calls WHERE empresa_id=$1 AND status IN ('ringing','accepted') AND (caller=ANY($2::text[]) OR callee=ANY($2::text[]))",
        [u.empresaId, [u.username, peer]],
      );
      if (busy.rowCount)
        deny("Um dos participantes já está noutra chamada.", 409);
      const row = (
        await c.query(
          "INSERT INTO public.nv_chat_calls(id,empresa_id,caller,callee,kind,request_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [randomUUID(), u.empresaId, u.username, peer, kind, id],
        )
      ).rows[0];
      await event(c, u, "chat.call.invite", row.id, { kind });
      return row;
    });
    res.status(201).json(result);
  });
  r.get("/:id", async (req, res) => {
    const u = getUser(req);
    await expire(pool, u.empresaId!);
    const row = await call(pool, u, req.params.id);
    const after = String(req.query.after || "0");
    if (!/^\d{1,18}$/.test(after)) deny("Cursor inválido.");
    const signals = (
      await pool.query(
        "SELECT id::text,kind,payload FROM public.nv_chat_call_signals WHERE empresa_id=$1 AND call_id=$2 AND actor<>$3 AND id>$4::bigint ORDER BY id LIMIT 200",
        [u.empresaId, row.id, u.username, after],
      )
    ).rows;
    res.json({ call: row, signals });
  });
  r.post("/:id/action", async (req, res) => {
    const u = getUser(req),
      action = req.body.action;
    if (!["accept", "reject", "end", "heartbeat"].includes(action))
      deny("Acção inválida.");
    const result = await transaction(pool, u.empresaId!, async (c) => {
      await expire(c, u.empresaId!);
      const row = await call(c, u, req.params.id);
      if (action === "accept" || action === "reject") {
        if (row.callee !== u.username)
          deny("Só o destinatário pode atender ou recusar.", 403);
        if (row.status !== "ringing") {
          if (action === "accept" && row.status === "accepted") return row;
          return deny("Chamada já terminada.", 409);
        }
        await c.query(
          "UPDATE public.nv_chat_calls SET status=$3,accepted_at=CASE WHEN $3='accepted' THEN now() ELSE accepted_at END,ended_at=CASE WHEN $3='rejected' THEN now() ELSE ended_at END,callee_seen=now(),caller_seen=now() WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, row.id, action === "accept" ? "accepted" : "rejected"],
        );
      } else if (action === "end") {
        await c.query(
          "UPDATE public.nv_chat_calls SET status=CASE WHEN status IN ('ringing','accepted') THEN 'ended' ELSE status END,ended_at=coalesce(ended_at,now()) WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, row.id],
        );
      } else {
        const column =
          row.caller === u.username ? "caller_seen" : "callee_seen";
        await c.query(
          `UPDATE public.nv_chat_calls SET ${column}=now() WHERE empresa_id=$1 AND id=$2 AND status IN ('ringing','accepted')`,
          [u.empresaId, row.id],
        );
      }
      if (action !== "heartbeat")
        await event(c, u, "chat.call." + action, row.id);
      return (
        await c.query(
          "SELECT * FROM public.nv_chat_calls WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, row.id],
        )
      ).rows[0];
    });
    res.json(result);
  });
  r.post("/:id/signals", async (req, res) => {
    const u = getUser(req),
      b = req.body,
      id = uuid(b.requestId);
    if (
      !["offer", "answer", "ice"].includes(b.kind) ||
      !b.payload ||
      typeof b.payload !== "object" ||
      Array.isArray(b.payload) ||
      JSON.stringify(b.payload).length > 65536
    )
      deny("Sinal de chamada inválido.");
    if (
      ["offer", "answer"].includes(b.kind) &&
      (b.payload.type !== b.kind ||
        typeof b.payload.sdp !== "string" ||
        !b.payload.sdp.startsWith("v=0"))
    )
      deny("Descrição de ligação inválida.");
    if (
      b.kind === "ice" &&
      (typeof b.payload.candidate !== "string" ||
        b.payload.candidate.length > 4096)
    )
      deny("Candidato de ligação inválido.");
    await transaction(pool, u.empresaId!, async (c) => {
      await expire(c, u.empresaId!);
      const row = await call(c, u, req.params.id);
      if (!["ringing", "accepted"].includes(row.status))
        deny("Chamada terminada.", 409);
      if (
        (b.kind === "offer" && row.caller !== u.username) ||
        (b.kind === "answer" &&
          (row.callee !== u.username || row.status !== "accepted"))
      )
        deny("Sinal não autorizado.", 403);
      const prior = (
        await c.query(
          "SELECT kind,payload=$5::jsonb AS same FROM public.nv_chat_call_signals WHERE empresa_id=$1 AND call_id=$2 AND actor=$3 AND request_id=$4",
          [u.empresaId, row.id, u.username, id, JSON.stringify(b.payload)],
        )
      ).rows[0];
      if (prior) {
        if (prior.kind !== b.kind || !prior.same)
          deny("Pedido reutilizado com outro sinal.", 409);
        return;
      }
      const count = (
        await c.query(
          "SELECT count(*)::int AS n FROM public.nv_chat_call_signals WHERE empresa_id=$1 AND call_id=$2 AND actor=$3",
          [u.empresaId, row.id, u.username],
        )
      ).rows[0].n;
      if (count >= 600) deny("Limite de sinais por chamada excedido.", 429);
      await c.query(
        "INSERT INTO public.nv_chat_call_signals(empresa_id,call_id,actor,kind,payload,request_id) VALUES($1,$2,$3,$4,$5,$6)",
        [
          u.empresaId,
          row.id,
          u.username,
          b.kind,
          JSON.stringify(b.payload),
          id,
        ],
      );
    });
    res.status(201).json({ ok: true });
  });
  r.use(apiErrors);
  return r;
}
export default createChatCalls();

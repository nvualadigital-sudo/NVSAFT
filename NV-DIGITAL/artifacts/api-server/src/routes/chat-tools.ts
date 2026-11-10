import { Router } from "express";
import { randomUUID, createHash } from "node:crypto";
import type { Pool } from "pg";
import { pool as productionPool } from "@workspace/db";
import { getUser, requireEmpresa } from "../lib/auth.js";
import {
  apiErrors,
  deny,
  event,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";
export function createChatTools(pool: Pool = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.post("/chat/read", async (req, res) => {
    const u = getUser(req),
      conversation = value(req.body.peer, 200, true);
    await pool.query(
      "INSERT INTO public.hospital_read_receipts(empresa_id,actor,conversation) VALUES($1,$2,$3) ON CONFLICT(empresa_id,actor,conversation) DO UPDATE SET read_at=now()",
      [u.empresaId, u.username, conversation],
    );
    res.json({ ok: true });
  });
  r.post("/chat/send", async (req, res) => {
    const u = getUser(req),
      d = req.body,
      requestId = uuid(d.requestId);
    res.status(201).json(
      await transaction(pool, u.empresaId!, async (c) => {
        const prior = (
          await c.query(
            "SELECT id,body,recipient FROM public.hospital_messages WHERE empresa_id=$1 AND sender=$2 AND request_id=$3",
            [u.empresaId, u.username, requestId],
          )
        ).rows[0];
        if (prior) {
          const attachmentHash =
            (
              await c.query(
                "SELECT sha256 FROM public.nv_chat_attachments WHERE empresa_id=$1 AND message_id=$2",
                [u.empresaId, prior.id],
              )
            ).rows[0]?.sha256 || "";
          const suppliedHash =
            d.attachment &&
            typeof d.attachment.base64 === "string" &&
            d.attachment.base64.length <= 7_000_000
              ? createHash("sha256")
                  .update(Buffer.from(d.attachment.base64, "base64"))
                  .digest("hex")
              : "";
          if (
            attachmentHash !== suppliedHash ||
            prior.body !== (d.body?.trim() || "Anexo") ||
            prior.recipient !== (d.recipient || null)
          )
            deny("Reenvio de outra mensagem.", 409);
          return { id: prior.id, repeated: true };
        }
        const peer = value(d.recipient, 200, true) || null;
        if (
          peer &&
          !(
            await c.query(
              "SELECT 1 FROM public.funcionarios WHERE empresa_id=$1 AND username=$2 AND ativo UNION ALL SELECT 1 FROM public.empresas WHERE id=$1 AND username=$2 AND ativo",
              [u.empresaId, peer],
            )
          ).rowCount
        )
          deny("Destinatário não autorizado.", 403);
        const body = value(d.body, 4000, true);
        if (!body && !d.attachment)
          deny("Escreva uma mensagem ou seleccione um anexo.");
        let attachment: any = null;
        if (d.attachment) {
          const a = d.attachment,
            name = value(a.name, 180).replace(/[\x00-\x1f/\\]/g, "_"),
            mime = value(a.mime, 80);
          if (
            typeof a.base64 !== "string" ||
            a.base64.length > 7_000_000 ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64)
          )
            deny("Anexo inválido.");
          const bytes = Buffer.from(a.base64, "base64");
          if (!bytes.length || bytes.length > 5242880)
            deny("Limite de 5 MB por anexo.");
          const valid =
            mime === "application/pdf"
              ? bytes.subarray(0, 5).toString() === "%PDF-"
              : mime === "image/png"
                ? bytes
                    .subarray(0, 8)
                    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                : mime === "image/jpeg"
                  ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
                  : mime === "text/plain"
                    ? !bytes.includes(0)
                    : false;
          if (!valid)
            deny(
              "Tipo ou conteúdo não aceite. Utilize PDF, PNG, JPEG ou texto simples.",
            );
          attachment = { id: randomUUID(), name, mime, bytes };
        }
        const id = randomUUID();
        await c.query(
          "INSERT INTO public.hospital_messages(id,empresa_id,sender,sender_name,recipient,body,request_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            u.empresaId,
            u.username,
            u.funcionarioNome || u.username,
            peer,
            body || "Anexo",
            requestId,
          ],
        );
        if (attachment)
          await c.query(
            "INSERT INTO public.nv_chat_attachments(id,empresa_id,message_id,name,mime,content,size_bytes,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              attachment.id,
              u.empresaId,
              id,
              attachment.name,
              attachment.mime,
              attachment.bytes,
              attachment.bytes.length,
              createHash("sha256").update(attachment.bytes).digest("hex"),
            ],
          );
        await event(c, u, "chat.send", id, {
          direct: !!peer,
          attachment: !!attachment,
        });
        return { id };
      }),
    );
  });
  r.get("/chat/attachments/:id", async (req, res) => {
    const u = getUser(req);
    const row =
      (
        await pool.query(
          "SELECT a.* FROM public.nv_chat_attachments a JOIN public.hospital_messages m ON m.id=a.message_id AND m.empresa_id=a.empresa_id WHERE a.empresa_id=$1 AND a.id=$2 AND (m.recipient IS NULL OR m.sender=$3 OR m.recipient=$3)",
          [u.empresaId, uuid(req.params.id), u.username],
        )
      ).rows[0] || deny("Anexo indisponível.", 404);
    await transaction(pool, u.empresaId!, async (c) =>
      event(c, u, "chat.attachment.download", row.id),
    );
    res.setHeader("Content-Type", row.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    );
    res.send(Buffer.from(row.content));
  });
  r.use(apiErrors);
  return r;
}
export default createChatTools();

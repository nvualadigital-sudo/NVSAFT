import { Router } from "express";
import { isDeepStrictEqual } from "node:util";
import { pool as productionPool } from "@workspace/db";
import { NURSING_DOCUMENT_KINDS } from "@workspace/api-zod";
import { getUser, requireEmpresa } from "../lib/auth.js";
import {
  allowed,
  apiErrors,
  deny,
  event,
  patient,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";
import {
  issuerFor,
  professionalFor,
  verifiedProfessional,
  institutionFor,
} from "../lib/professionals.js";

export function createProfessionalDocuments(pool: any = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.get("/professionals/me", async (req, res) => {
    const u = getUser(req),
      who = await professionalFor(pool, u);
    res.json({
      name: who?.nome || u.funcionarioNome || u.username,
      funcionarioId: who?.id || null,
      profile: who?.data || {},
      revision: who?.revision || 0,
      verified: Boolean(who?.ativo && verifiedProfessional(who?.data)),
      canIssue: Boolean(
        who?.ativo &&
        ["medico", "enfermeiro"].includes(who.funcao) &&
        verifiedProfessional(who.data),
      ),
    });
  });
  const readAccess = (u: any) =>
    allowed(u, ["admin", "gestor", "medico", "enfermeiro"]);
  r.get("/professional-documents/nursing", async (req, res) => {
    const u = getUser(req);
    readAccess(u);
    const rows = (
      await pool.query(
        "SELECT id,patient_id,payload,state,revision,created_by,created_at,issued_at,voided_at,void_reason,issuer-'signatureData'-'stampData' AS issuer FROM public.nv_professional_documents WHERE empresa_id=$1 AND source_kind='nursing' AND (state<>'draft' OR created_by=$2) ORDER BY created_at DESC LIMIT 200",
        [u.empresaId, u.username],
      )
    ).rows;
    res.json(rows);
  });
  r.post("/professional-documents/nursing", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["enfermeiro"]);
    const b = req.body,
      id = uuid(b.id);
    if (typeof b.finalize !== "boolean")
      deny("Indique se pretende guardar rascunho ou emitir.");
    const payload = {
      kind: value(b.kind, 120),
      title: value(b.title, 200),
      text: value(b.text, 20000),
      from: value(b.from, 10, true),
      to: value(b.to, 10, true),
    };
    if (!(NURSING_DOCUMENT_KINDS as readonly string[]).includes(payload.kind))
      deny("Modelo de enfermagem desconhecido.");
    const date = (s: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(new Date(s).getTime()) &&
      new Date(s).toISOString().slice(0, 10) === s;
    if (
      (payload.from || payload.to) &&
      (!date(payload.from) || !date(payload.to) || payload.from > payload.to)
    )
      deny("Período do documento inválido.");
    if (b.finalize && b.reviewed !== true)
      deny("Confirme a revisão do conteúdo antes de emitir.");
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const p = await patient(c, u.empresaId!, b.patientId);
        const old = (
          await c.query(
            "SELECT * FROM public.nv_professional_documents WHERE empresa_id=$1 AND source_kind='nursing' AND id=$2 FOR UPDATE",
            [u.empresaId, id],
          )
        ).rows[0];
        if (old && old.created_by !== u.username)
          deny("Só o autor pode alterar este documento.", 403);
        if (old && old.patient_id !== p.id)
          deny(
            "O paciente de um documento guardado não pode ser trocado.",
            409,
          );
        const data = {
          ...payload,
          patient: {
            id: p.id,
            nome: p.nome,
            processo: p.processo,
            nasc: p.nasc,
          },
        };
        if (
          old?.state === "issued" &&
          b.finalize &&
          isDeepStrictEqual(old.payload, data)
        )
          return { id, state: old.state, revision: old.revision };
        if (
          old?.state === "draft" &&
          !b.finalize &&
          isDeepStrictEqual(old.payload, data)
        )
          return { id, state: old.state, revision: old.revision };
        if (old && old.state !== "draft")
          deny(
            "Documento emitido/anulado é imutável. Crie uma rectificação.",
            409,
          );
        if ((old?.revision || 0) !== (b.revision || 0))
          deny("O documento foi alterado noutro posto. Actualize.", 409);
        const issuer = b.finalize ? await issuerFor(c, u, "enfermeiro") : {};
        const institution = b.finalize ? await institutionFor(c, u) : {};
        const row = (
          await c.query(
            "INSERT INTO public.nv_professional_documents(empresa_id,id,source_kind,patient_id,payload,issuer,institution,state,created_by,issued_at) VALUES($1,$2,'nursing',$3,$4,$5,$6,$7,$8,CASE WHEN $7='issued' THEN now() ELSE NULL END) ON CONFLICT(empresa_id,source_kind,id) DO UPDATE SET payload=excluded.payload,issuer=excluded.issuer,institution=excluded.institution,state=excluded.state,issued_at=excluded.issued_at,revision=nv_professional_documents.revision+1 RETURNING id,state,revision",
            [
              u.empresaId,
              id,
              p.id,
              data,
              issuer,
              institution,
              b.finalize ? "issued" : "draft",
              u.username,
            ],
          )
        ).rows[0];
        await event(
          c,
          u,
          b.finalize ? "nursing.document.issue" : "nursing.document.draft",
          id,
          { patientId: p.id },
        );
        return row;
      }),
    );
  });
  r.post("/professional-documents/nursing/:id/void", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["enfermeiro"]);
    const id = uuid(req.params.id),
      reason = value(req.body.reason, 1500);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const old = (
          await c.query(
            "SELECT * FROM public.nv_professional_documents WHERE empresa_id=$1 AND source_kind='nursing' AND id=$2 FOR UPDATE",
            [u.empresaId, id],
          )
        ).rows[0];
        if (!old) deny("Documento indisponível.", 404);
        if (old.created_by !== u.username)
          deny("Só o autor pode anular este documento.", 403);
        if (old.state !== "issued")
          deny("Só documentos emitidos podem ser anulados.", 409);
        await c.query(
          "UPDATE public.nv_professional_documents SET state='voided',voided_at=now(),void_reason=$3,revision=revision+1 WHERE empresa_id=$1 AND source_kind='nursing' AND id=$2",
          [u.empresaId, id, reason],
        );
        await event(c, u, "nursing.document.void", id);
        return { ok: true };
      }),
    );
  });
  r.post("/professional-documents/:kind/:id/export", async (req, res) => {
    const u = getUser(req);
    readAccess(u);
    const kind = String(req.params.kind),
      id = uuid(req.params.id);
    if (!["medical", "prescription", "nursing"].includes(kind))
      deny("Documento desconhecido.", 404);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const registry = (
          await c.query(
            "SELECT * FROM public.nv_professional_documents WHERE empresa_id=$1 AND source_kind=$2 AND id=$3",
            [u.empresaId, kind, id],
          )
        ).rows[0];
        let document: any,
          state: string,
          issuer = registry?.issuer || null;
        if (kind === "nursing") {
          if (
            !registry ||
            (registry.state === "draft" && registry.created_by !== u.username)
          )
            deny("Documento indisponível.", 404);
          document = {
            ...registry.payload,
            id,
            created: registry.created_at,
            finalized: registry.issued_at,
            voidReason: registry.void_reason,
          };
          state = registry.state;
        } else {
          const clinical = (
            await c.query(
              "SELECT data FROM public.hospital_state WHERE empresa_id=$1 AND namespace='clinical'",
              [u.empresaId],
            )
          ).rows[0]?.data;
          document = clinical?.[
            kind === "medical" ? "documents" : "prescriptions"
          ]?.find((d: any) => d.id === id);
          if (!document) deny("Documento indisponível.", 404);
          if (
            kind === "medical" &&
            !document.finalized &&
            !document.voided &&
            !clinical.visits?.some(
              (v: any) => v.id === document.visitId && v.owner === u.username,
            )
          )
            deny("Rascunho reservado ao médico responsável.", 403);
          state =
            document.voided || document.cancelled
              ? "voided"
              : kind === "prescription" || document.finalized
                ? "issued"
                : "draft";
        }
        if (state === "draft") issuer = null;
        const config =
          registry?.state !== "draft" && registry?.institution?.name
            ? registry.institution
            : await institutionFor(c, u);
        await event(c, u, "professional.document.export", id, {
          kind,
          state,
          identifiedIssuer: Boolean(issuer?.name),
        });
        return {
          document,
          issuer,
          institution: config,
          state,
          legacy: kind !== "nursing" && !registry,
        };
      }),
    );
  });
  r.use(apiErrors);
  return r;
}

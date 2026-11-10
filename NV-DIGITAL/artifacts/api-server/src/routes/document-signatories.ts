import { Router } from "express";
import { pool as productionPool } from "@workspace/db";
import { getUser, requireEmpresa } from "../lib/auth.js";
import {
  allowed,
  apiErrors,
  deny,
  event,
  transaction,
  uuid,
} from "../lib/governance.js";
import {
  imageData,
  professionalData,
  verifiedProfessional,
} from "../lib/professionals.js";
import {
  SIGNATORY_ROLES,
  institutionSignatories,
} from "../lib/document-signatories.js";
export function createDocumentSignatories(pool: any = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.get("/document-signatories", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const people = (
      await pool.query(
        "SELECT f.id,f.nome,f.funcao,f.ativo,p.data,p.revision FROM public.funcionarios f LEFT JOIN public.nv_professionals p ON p.empresa_id=f.empresa_id AND p.funcionario_id=f.id WHERE f.empresa_id=$1 AND f.funcao IN ('medico','enfermeiro') ORDER BY f.nome",
        [u.empresaId],
      )
    ).rows;
    const assignments = (
      await pool.query(
        "SELECT kind,funcionario_id,revision FROM public.nv_document_signatories WHERE empresa_id=$1",
        [u.empresaId],
      )
    ).rows;
    res.json({
      people: people.map((p: any) => ({
        id: p.id,
        name: p.nome,
        role: p.funcao,
        active: p.ativo,
        verified: verifiedProfessional(p.data),
        profileRevision: p.revision || 0,
        credential: p.data?.credential || "",
      })),
      assignments,
      signatures: await institutionSignatories(pool, u.empresaId!),
    });
  });
  // Imagens podem ser preparadas antes da verificação da cédula, mas não são
  // usadas em documentos nem libertam a assinatura institucional nessa fase.
  r.get("/document-signatories/professional/:id/images", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const id = uuid(req.params.id);
    const who = (
      await pool.query(
        "SELECT f.id,p.data,p.revision FROM public.funcionarios f LEFT JOIN public.nv_professionals p ON p.empresa_id=f.empresa_id AND p.funcionario_id=f.id WHERE f.empresa_id=$1 AND f.id=$2 AND f.funcao IN ('medico','enfermeiro')",
        [u.empresaId, id],
      )
    ).rows[0];
    if (!who) deny("Profissional indisponível nesta instituição.", 404);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      profileRevision: who.revision || 0,
      signatureData: imageData(who.data?.signatureData),
      stampData: imageData(who.data?.stampData),
    });
  });
  r.put("/document-signatories/:kind/draft-images", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const kind = String(req.params.kind) as keyof typeof SIGNATORY_ROLES;
    if (!Object.hasOwn(SIGNATORY_ROLES, kind)) deny("Tipo de assinatura desconhecido.");
    const b = req.body || {};
    if (b.confirmIdentity !== true) deny("Confirme a identidade do titular das imagens.");
    const patch: Record<string, string> = {};
    for (const key of ["signatureData", "stampData"])
      if (Object.hasOwn(b, key)) patch[key] = b[key];
    if (!Object.keys(patch).length) deny("Escolha uma assinatura ou carimbo para guardar.");
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const fid = uuid(b.funcionarioId);
        const who = (
          await c.query(
            "SELECT id FROM public.funcionarios WHERE empresa_id=$1 AND id=$2 AND ativo=true AND funcao=$3",
            [u.empresaId, fid, SIGNATORY_ROLES[kind]],
          )
        ).rows[0];
        if (!who) deny("Seleccione um profissional activo da especialidade correspondente.", 409);
        const old = (
          await c.query(
            "SELECT data,revision FROM public.nv_professionals WHERE empresa_id=$1 AND funcionario_id=$2 FOR UPDATE",
            [u.empresaId, fid],
          )
        ).rows[0];
        if ((old?.revision || 0) !== b.profileRevision)
          deny("Ficha profissional alterada noutro posto. Actualize antes de guardar.", 409);
        const next = professionalData(patch, old?.data || {});
        const row = (
          await c.query(
            "INSERT INTO public.nv_professionals(empresa_id,funcionario_id,data,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(empresa_id,funcionario_id) DO UPDATE SET data=excluded.data,revision=nv_professionals.revision+1,updated_by=excluded.updated_by,updated_at=now() RETURNING revision",
            [u.empresaId, fid, next, u.username],
          )
        ).rows[0];
        await event(c, u, "institution.signatory.image.draft", fid, { kind, imagesUpdated: Object.keys(patch) });
        return { ok: true, profileRevision: row.revision, verified: verifiedProfessional(next) };
      }),
    );
  });
  r.put("/document-signatories/:kind", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const kind = String(req.params.kind) as keyof typeof SIGNATORY_ROLES;
    if (!Object.hasOwn(SIGNATORY_ROLES, kind))
      deny("Tipo de assinatura desconhecido.");
    const b = req.body || {};
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const old = (
          await c.query(
            "SELECT * FROM public.nv_document_signatories WHERE empresa_id=$1 AND kind=$2 FOR UPDATE",
            [u.empresaId, kind],
          )
        ).rows[0];
        if ((old?.revision || 0) !== b.revision)
          deny(
            "A assinatura institucional foi alterada. Actualize antes de guardar.",
            409,
          );
        const fid = uuid(b.funcionarioId);
        const who = (
          await c.query(
            "SELECT f.id,f.nome,f.funcao,f.ativo,p.data,p.revision FROM public.funcionarios f LEFT JOIN public.nv_professionals p ON p.empresa_id=f.empresa_id AND p.funcionario_id=f.id WHERE f.empresa_id=$1 AND f.id=$2",
            [u.empresaId, fid],
          )
        ).rows[0];
        if (
          !who ||
          !who.ativo ||
          who.funcao !== SIGNATORY_ROLES[kind] ||
          !verifiedProfessional(who.data)
        )
          deny(
            "Seleccione um profissional activo, da função correspondente, com credencial verificada em Funcionários.",
            409,
          );
        const patch: any = {};
        for (const key of ["signatureData", "stampData"])
          if (Object.hasOwn(b, key)) patch[key] = b[key];
        if (Object.keys(patch).length) {
          if (b.confirmIdentity !== true)
            deny(
              "Confirme que a assinatura e o carimbo pertencem ao profissional seleccionado.",
            );
          if (who.revision !== b.profileRevision)
            deny(
              "A ficha profissional foi alterada. Actualize antes de guardar.",
              409,
            );
          const data = professionalData(patch, who.data);
          await c.query(
            "UPDATE public.nv_professionals SET data=$3,revision=revision+1 WHERE empresa_id=$1 AND funcionario_id=$2",
            [u.empresaId, fid, data],
          );
        }
        const row = (
          await c.query(
            "INSERT INTO public.nv_document_signatories(empresa_id,kind,funcionario_id,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(empresa_id,kind) DO UPDATE SET funcionario_id=excluded.funcionario_id,revision=nv_document_signatories.revision+1,updated_by=excluded.updated_by,updated_at=now() RETURNING revision",
            [u.empresaId, kind, fid, u.username],
          )
        ).rows[0];
        await event(c, u, "institution.signatory.configure", fid, {
          kind,
          revision: row.revision,
          imagesUpdated: Object.keys(patch),
        });
        return { ok: true, revision: row.revision };
      }),
    );
  });
  r.use(apiErrors);
  return r;
}

import { Router } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { pool as productionPool } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth.js";
import {
  apiErrors,
  deny,
  event,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";
import {
  accessRole,
  professionalData,
  invalidateProfessional,
  syncLabStaffPermissions,
} from "../lib/professionals.js";

export function createStaffRouter(providedPool?: any) {
  const r = Router();
  const scope = (req: any) => {
    const u = getUser(req),
      org = uuid(req.params.id);
    if (
      u.role !== "developer" &&
      (u.empresaId !== org || !["admin", "gestor"].includes(u.funcao || ""))
    )
      deny("Acesso negado à gestão desta instituição.", 403);
    return { ...u, empresaId: org };
  };
  const present = (row: any, images = false) => {
    const d = { ...(row.professional || {}) };
    const signatureAvailable = Boolean(d.signatureData),
      stampAvailable = Boolean(d.stampData);
    if (!images) {
      delete d.signatureData;
      delete d.stampData;
    }
    return {
      id: row.id,
      nome: row.nome,
      username: row.username,
      funcao: row.funcao,
      ativo: row.ativo,
      professional: d,
      professionalRevision: row.professional_revision || 0,
      signatureAvailable,
      stampAvailable,
    };
  };
  const select =
    "SELECT f.id,f.nome,f.username,f.funcao,f.ativo,p.data AS professional,p.revision AS professional_revision FROM public.funcionarios f LEFT JOIN public.nv_professionals p ON p.empresa_id=f.empresa_id AND p.funcionario_id=f.id WHERE f.empresa_id=$1";
  r.get("/empresas/:id/funcionarios", requireAuth, async (req, res) => {
    const u = scope(req),
      pool = providedPool || productionPool;
    res.json(
      (await pool.query(select + " ORDER BY f.nome", [u.empresaId])).rows.map(
        (row: any) => present(row),
      ),
    );
  });
  r.get("/empresas/:id/funcionarios/:fid", requireAuth, async (req, res) => {
    const u = scope(req),
      pool = providedPool || productionPool;
    const row = (
      await pool.query(select + " AND f.id=$2", [
        u.empresaId,
        uuid(req.params.fid),
      ])
    ).rows[0];
    if (!row) deny("Funcionário não encontrado.", 404);
    res.json(present(row, true));
  });
  async function save(req: any, creating: boolean) {
    const u = scope(req),
      b = req.body,
      pool = providedPool || productionPool;
    if (
      !b ||
      typeof b !== "object" ||
      (typeof b.ativo !== "undefined" && typeof b.ativo !== "boolean")
    )
      deny("Dados do funcionário inválidos.");
    const id = creating ? randomUUID() : uuid(req.params.fid);
    const password = b.password;
    if (creating && (!password || typeof password !== "string"))
      deny("Defina a palavra-passe inicial.");
    if (
      password &&
      (typeof password !== "string" ||
        password.length < 8 ||
        password.length > 200)
    )
      deny("A palavra-passe deve ter entre 8 e 200 caracteres.");
    const hashed = password ? await bcrypt.hash(password, 12) : null;
    return transaction(pool, u.empresaId!, async (c) => {
      const old = creating
        ? null
        : (
            await c.query(
              "SELECT * FROM public.funcionarios WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
              [u.empresaId, id],
            )
          ).rows[0];
      if (!creating && !old) deny("Funcionário não encontrado.", 404);
      const nome = Object.hasOwn(b, "nome") ? value(b.nome, 160) : old?.nome;
      const username = Object.hasOwn(b, "username")
        ? value(b.username, 100)
        : old?.username;
      if (!nome || !username || !/^[A-Za-z0-9_.@-]{3,100}$/.test(username))
        deny(
          "Indique nome e utilizador válido, sem espaços, com pelo menos 3 caracteres.",
        );
      if (old && username !== old.username)
        deny(
          "O utilizador é permanente para conservar a autoria e o histórico. Desactive a conta e crie outra, se necessário.",
          409,
        );
      const role = accessRole(
        b.funcao === undefined ? old?.funcao || "tecnico" : b.funcao,
      );
      if (
        u.role !== "developer" &&
        u.funcao !== "admin" &&
        (role === "admin" || old?.funcao === "admin")
      )
        deny("Só a administração pode gerir contas administrativas.", 403);
      const active = b.ativo === undefined ? (old?.ativo ?? true) : b.ativo;
      if (
        old?.username === u.username &&
        (!active || username !== old.username || role !== old.funcao)
      )
        deny(
          "A alteração do seu acesso deve ser feita por outro administrador.",
          409,
        );
      const prior = (
        await c.query(
          "SELECT data,revision FROM public.nv_professionals WHERE empresa_id=$1 AND funcionario_id=$2 FOR UPDATE",
          [u.empresaId, id],
        )
      ).rows[0];
      let profile = prior?.data;
      const supplied = Object.hasOwn(b, "professional");
      if (b.syncLabPermissions !== undefined && typeof b.syncLabPermissions !== "boolean")
        deny("Sincronização de permissões inválida.");
      if (b.syncLabPermissions && !supplied)
        deny("Envie a ficha profissional para alterar as permissões.");
      if (supplied) {
        if ((b.professionalRevision ?? 0) !== (prior?.revision || 0))
          deny(
            "A ficha profissional foi alterada noutro posto. Actualize.",
            409,
          );
        profile = professionalData(b.professional, prior?.data);
        if (!profile.category) deny("Seleccione a categoria profissional.");
      }
      const identityChanged = Boolean(
        old &&
        (nome !== old.nome || username !== old.username || role !== old.funcao),
      );
      const profileChanged = Boolean(
        profile &&
        (JSON.stringify(profile) !== JSON.stringify(prior?.data) ||
          identityChanged),
      );
      const reviewRequired = Boolean(
        profile &&
        (identityChanged ||
          [
            "category",
            "specialties",
            "credential",
            "service",
            "contract",
            "qualification",
            "position",
            "credentialAuthority",
            "validUntil",
            "signatureData",
            "stampData",
          ].some(
            (key) =>
              String(profile[key] || "") !== String(prior?.data?.[key] || ""),
          )),
      );
      if (creating)
        await c.query(
          "INSERT INTO public.funcionarios(id,empresa_id,nome,username,password,funcao,ativo) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [id, u.empresaId, nome, username, hashed, role, active],
        );
      else
        await c.query(
          "UPDATE public.funcionarios SET nome=$3,username=$4,password=coalesce($5,password),funcao=$6,ativo=$7 WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, id, nome, username, hashed, role, active],
        );
      if (profileChanged || (creating && profile)) {
        if (reviewRequired || !prior)
          profile = {
            ...profile,
            status: "pendente",
            verifiedBy: "",
            verifiedAt: "",
            verification: "",
          };
        await c.query(
          "INSERT INTO public.nv_professionals(empresa_id,funcionario_id,data,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(empresa_id,funcionario_id) DO UPDATE SET data=excluded.data,revision=nv_professionals.revision+1,updated_by=excluded.updated_by,updated_at=now()",
          [u.empresaId, id, profile, u.username],
        );
      }
      if (old && (identityChanged || reviewRequired || hashed || !active))
        await invalidateProfessional(c, u.empresaId!, old.username);
      const labPermissions = b.syncLabPermissions
        ? await syncLabStaffPermissions(c, u, {
            username,
            role,
            active,
            profile,
          })
        : undefined;
      await event(c, u, creating ? "staff.create" : "staff.update", id, {
        role,
        active,
        credentialReviewRequired: reviewRequired,
        labPermissionSync: Boolean(b.syncLabPermissions),
      });
      return {
        ...present(
          (await c.query(select + " AND f.id=$2", [u.empresaId, id])).rows[0],
          true,
        ),
        ...(labPermissions ? { labPermissions } : {}),
      };
    });
  }
  r.post("/empresas/:id/funcionarios", requireAuth, async (req, res) => {
    res.status(201).json(await save(req, true));
  });
  r.put("/empresas/:id/funcionarios/:fid", requireAuth, async (req, res) => {
    res.json(await save(req, false));
  });
  r.delete("/empresas/:id/funcionarios/:fid", requireAuth, async (req, res) => {
    const u = scope(req),
      id = uuid(req.params.fid),
      pool = providedPool || productionPool;
    await transaction(pool, u.empresaId!, async (c) => {
      const who = (
        await c.query(
          "SELECT username,funcao FROM public.funcionarios WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
          [u.empresaId, id],
        )
      ).rows[0];
      if (!who) deny("Funcionário não encontrado.", 404);
      if (who.username === u.username)
        deny("Outro administrador deve suspender a sua conta.", 409);
      if (
        who.funcao === "admin" &&
        u.role !== "developer" &&
        u.funcao !== "admin"
      )
        deny("Acesso administrativo necessário.", 403);
      await c.query(
        "UPDATE public.funcionarios SET ativo=false WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, id],
      );
      await invalidateProfessional(c, u.empresaId!, who.username);
      await event(c, u, "staff.deactivate", id);
    });
    res.sendStatus(204);
  });
  r.use(apiErrors);
  return r;
}

import { createStaffRouter } from "./staff.js";
import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import {
  empresasTable,
  funcionariosTable,
  parceirosTable,
  configTable,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import {
  requireDeveloper,
  requireAuth,
  requireEmpresa,
  getUser,
} from "../lib/auth.js";

const SALT_ROUNDS = 12;
const ALLOWED_COMPANY_MODULES = new Set([
  "laboratorial", "hospitalar", "escolar",
  "comercial", "faturacao", "farmacia", "laboratorio",
]);
function validateCompanyModules(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.some((x) => typeof x !== "string" || !ALLOWED_COMPANY_MODULES.has(x))) return null;
  return [...new Set(value)];
}


const router = Router();
router.use(
  /^\/empresas\/[^/]+\/(funcionarios|parceiros)(\/|$)/,
  requireAuth,
  (req, res, next) => {
    const u = getUser(req);
    if (
      u.role !== "developer" &&
      !["admin", "gestor"].includes(u.funcao || "")
    ) {
      res
        .status(403)
        .json({
          error: "A gestão de contas exige autorização administrativa.",
        });
      return;
    }
    next();
  },
);
router.use("/sucursais", requireAuth, (req, res, next) => {
  const u = getUser(req);
  if (!["admin", "gestor"].includes(u.funcao || "")) {
    res
      .status(403)
      .json({
        error: "A gestão de unidades exige autorização administrativa.",
      });
    return;
  }
  next();
});

/** Strip the password hash before sending any user/entity to the client */
function omitPassword<T extends { password: string }>(
  row: T,
): Omit<T, "password"> {
  const { password: _pw, ...rest } = row;
  return rest;
}

// --- Empresas (developer only) ---
router.get("/empresas", requireDeveloper, async (_req, res): Promise<void> => {
  const rows = await db.select().from(empresasTable);
  res.json(rows.map(omitPassword));
});

router.post("/empresas", requireDeveloper, async (req, res): Promise<void> => {
  const { nome, nif, username, password, ativo, modulos } = req.body;
  if (!nome || !username || !password) {
    res.status(400).json({ error: "nome, username e password obrigatórios" });
    return;
  }
  const modulosArr = validateCompanyModules(modulos ?? ["laboratorial"]);
  if (!modulosArr) {
    res.status(400).json({ error: "Seleccione módulos válidos para a empresa." });
    return;
  }
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const [row] = await db
    .insert(empresasTable)
    .values({
      nome,
      nif: nif || "",
      username,
      password: hashed,
      ativo: ativo !== false,
      modulos: modulosArr,
    })
    .returning();

  // Create default config for the new empresa
  await db
    .insert(configTable)
    .values({ empresaId: row.id })
    .onConflictDoNothing();

  res.status(201).json(omitPassword(row));
});

router.put(
  "/empresas/:id",
  requireDeveloper,
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { nome, nif, username, password, ativo, modulos } = req.body;
    const updateData: Record<string, any> = {};
    if (nome !== undefined) updateData.nome = nome;
    if (nif !== undefined) updateData.nif = nif;
    if (username !== undefined) updateData.username = username;
    if (password !== undefined && password !== "")
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    if (ativo !== undefined) updateData.ativo = ativo;
    if (modulos !== undefined) {
      const validModules = validateCompanyModules(modulos);
      if (!validModules) {
        res.status(400).json({ error: "Módulos inválidos ou lista vazia." });
        return;
      }
      updateData.modulos = validModules;
    }
    const [row] = await db
      .update(empresasTable)
      .set(updateData)
      .where(eq(empresasTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Empresa não encontrada" });
      return;
    }
    res.json(omitPassword(row));
  },
);

router.delete(
  "/empresas/:id",
  requireDeveloper,
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await db.delete(empresasTable).where(eq(empresasTable.id, id));
    res.sendStatus(204);
  },
);

// Staff accounts and professional details share a transaction and preserve document authorship.
router.use(createStaffRouter());

// --- Parceiros ---
router.get(
  "/empresas/:id/parceiros",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = getUser(req);
    if (user.role !== "developer" && user.empresaId !== id) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const rows = await db
      .select()
      .from(parceirosTable)
      .where(eq(parceirosTable.empresaId, id));
    res.json(rows.map(omitPassword));
  },
);

router.post(
  "/empresas/:id/parceiros",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = getUser(req);
    if (user.role !== "developer" && user.empresaId !== id) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { nome, instituicao, username, password, email, telefone, ativo } =
      req.body;
    if (!nome || !username || !password) {
      res.status(400).json({ error: "nome, username e password obrigatórios" });
      return;
    }
    const hashedParceiro = await bcrypt.hash(password, SALT_ROUNDS);
    const [row] = await db
      .insert(parceirosTable)
      .values({
        empresaId: id,
        nome,
        instituicao: instituicao || "",
        username,
        password: hashedParceiro,
        email: email || "",
        telefone: telefone || "",
        ativo: ativo !== false,
      })
      .returning();
    res.status(201).json(omitPassword(row));
  },
);

router.put(
  "/empresas/:id/parceiros/:pid",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const pid = Array.isArray(req.params.pid)
      ? req.params.pid[0]
      : req.params.pid;
    const user = getUser(req);
    if (user.role !== "developer" && user.empresaId !== id) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { nome, instituicao, username, password, email, telefone, ativo } =
      req.body;
    const u: Record<string, any> = {};
    if (nome !== undefined) u.nome = nome;
    if (instituicao !== undefined) u.instituicao = instituicao;
    if (username !== undefined) u.username = username;
    if (password !== undefined && password !== "")
      u.password = await bcrypt.hash(password, SALT_ROUNDS);
    if (email !== undefined) u.email = email;
    if (telefone !== undefined) u.telefone = telefone;
    if (ativo !== undefined) u.ativo = ativo;
    const [row] = await db
      .update(parceirosTable)
      .set(u)
      .where(and(eq(parceirosTable.id, pid), eq(parceirosTable.empresaId, id)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Parceiro não encontrado" });
      return;
    }
    res.json(omitPassword(row));
  },
);

router.delete(
  "/empresas/:id/parceiros/:pid",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const pid = Array.isArray(req.params.pid)
      ? req.params.pid[0]
      : req.params.pid;
    const user = getUser(req);
    if (user.role !== "developer" && user.empresaId !== id) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    await db
      .delete(parceirosTable)
      .where(and(eq(parceirosTable.id, pid), eq(parceirosTable.empresaId, id)));
    res.sendStatus(204);
  },
);

// --- Global parceiros list (developer) ---
router.get("/parceiros", requireDeveloper, async (_req, res): Promise<void> => {
  const rows = await db.select().from(parceirosTable);
  res.json(rows.map(omitPassword));
});

// --- Sucursais (empresa only) ---

router.get("/sucursais", requireEmpresa, async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user.empresaId) {
    res.status(400).json({ error: "empresaId ausente" });
    return;
  }
  const rows = await db
    .select()
    .from(empresasTable)
    .where(eq(empresasTable.parentEmpresaId, user.empresaId));
  res.json(rows.map(omitPassword));
});

router.post("/sucursais", requireEmpresa, async (req, res): Promise<void> => {
  const user = getUser(req);
  if (!user.empresaId) {
    res.status(400).json({ error: "empresaId ausente" });
    return;
  }

  const { nome, username, password } = req.body;
  if (!nome || !username || !password) {
    res
      .status(400)
      .json({ error: "nome, username e password são obrigatórios" });
    return;
  }

  // Check limit
  const existing = await db
    .select({ id: empresasTable.id })
    .from(empresasTable)
    .where(eq(empresasTable.parentEmpresaId, user.empresaId));
  if (existing.length >= 100) {
    res.status(400).json({ error: "Limite de 100 sucursais atingido" });
    return;
  }

  // Get parent empresa for NIF
  const [parent] = await db
    .select()
    .from(empresasTable)
    .where(eq(empresasTable.id, user.empresaId));

  const hashedSucursal = await bcrypt.hash(password, SALT_ROUNDS);
  const [newEmpresa] = await db
    .insert(empresasTable)
    .values({
      nome,
      nif: parent?.nif || "",
      username,
      password: hashedSucursal,
      ativo: true,
      parentEmpresaId: user.empresaId,
    })
    .returning();

  // Copy parent config (but reset serie sequencing)
  const [parentConfig] = await db
    .select()
    .from(configTable)
    .where(eq(configTable.empresaId, user.empresaId));

  await db
    .insert(configTable)
    .values({
      empresaId: newEmpresa.id,
      nomeClinica: parentConfig?.nomeClinica
        ? `${parentConfig.nomeClinica} — ${nome}`
        : nome,
      nif: parentConfig?.nif || parent?.nif || "",
      endereco: parentConfig?.endereco || "",
      telefone: parentConfig?.telefone || "",
      email: parentConfig?.email || "",
      directorTecnico: parentConfig?.directorTecnico || "",
      logoData: parentConfig?.logoData || "",
      assinaturaData: parentConfig?.assinaturaData || "",
      serie: parentConfig?.serie || "A",
      proximoNumeroFatura: 1,
      ivaTaxa: parentConfig?.ivaTaxa ?? 14,
      moeda: parentConfig?.moeda || "AOA",
      website: parentConfig?.website || "",
    })
    .onConflictDoNothing();

  res.status(201).json(omitPassword(newEmpresa));
});

router.delete(
  "/sucursais/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const user = getUser(req);
    if (!user.empresaId) {
      res.status(400).json({ error: "empresaId ausente" });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Verify ownership — only the parent can delete its sucursal
    const [row] = await db
      .select({ id: empresasTable.id })
      .from(empresasTable)
      .where(
        and(
          eq(empresasTable.id, id),
          eq(empresasTable.parentEmpresaId, user.empresaId),
        ),
      );

    if (!row) {
      res
        .status(404)
        .json({ error: "Sucursal não encontrada ou acesso negado" });
      return;
    }

    await db.delete(empresasTable).where(eq(empresasTable.id, id));
    res.sendStatus(204);
  },
);

export default router;

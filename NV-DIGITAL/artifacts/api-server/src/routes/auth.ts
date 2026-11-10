import { Router } from "express";
import bcrypt from "bcrypt";
import { db, pool } from "@workspace/db";
import {
  empresasTable,
  funcionariosTable,
  parceirosTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, getUser } from "../lib/auth.js";

const router = Router();

const SALT_ROUNDS = 12;

async function checkPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

async function migratePassword(
  plain: string,
  table:
    | typeof funcionariosTable
    | typeof parceirosTable
    | typeof empresasTable,
  id: string,
): Promise<void> {
  try {
    const hashed = await bcrypt.hash(plain, SALT_ROUNDS);
    await db
      .update(table as typeof funcionariosTable)
      .set({ password: hashed } as any)
      .where(eq((table as typeof funcionariosTable).id as any, id));
  } catch {}
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as {
    username: string;
    password: string;
  };
  if (!username || !password) {
    res.status(400).json({ error: "Username e password obrigatórios" });
    return;
  }

  const DEV_USER = process.env.DEV_USERNAME;
  const DEV_PASS = process.env.DEV_PASSWORD;
  if (DEV_USER && DEV_PASS && username === DEV_USER && password === DEV_PASS) {
    const token = await signToken({ role: "developer", username });
    res.json({ token, role: "developer", username });
    return;
  }

  const [parceiro] = await db
    .select()
    .from(parceirosTable)
    .where(eq(parceirosTable.username, username));
  if (parceiro) {
    const ok = await checkPassword(password, parceiro.password);
    if (ok) {
      if (!parceiro.ativo) {
        res.status(401).json({ error: "Conta desactivada" });
        return;
      }
      if (!parceiro.password.startsWith("$2"))
        migratePassword(password, parceirosTable, parceiro.id);
      const [empresa] = await db
        .select()
        .from(empresasTable)
        .where(eq(empresasTable.id, parceiro.empresaId));
      const token = await signToken({
        role: "parceiro",
        username,
        parceiroId: parceiro.id,
        parceiroNome: parceiro.nome,
        parceiroInstituicao: parceiro.instituicao,
        empresaId: parceiro.empresaId,
        empresaNome: empresa?.nome,
      });
      res.json({
        token,
        role: "parceiro",
        username,
        parceiroId: parceiro.id,
        parceiroNome: parceiro.nome,
        parceiroInstituicao: parceiro.instituicao,
        empresaId: parceiro.empresaId,
        empresaNome: empresa?.nome,
      });
      return;
    }
  }

  const [func] = await db
    .select()
    .from(funcionariosTable)
    .where(eq(funcionariosTable.username, username));
  if (func) {
    const ok = await checkPassword(password, func.password);
    if (ok) {
      if (!func.ativo) {
        res.status(401).json({ error: "Conta desactivada" });
        return;
      }
      const [empresa] = await db
        .select()
        .from(empresasTable)
        .where(eq(empresasTable.id, func.empresaId));
      if (!empresa || !empresa.ativo) {
        res.status(401).json({ error: "Empresa inactiva" });
        return;
      }
      if (!func.password.startsWith("$2"))
        migratePassword(password, funcionariosTable, func.id);
      const token = await signToken({
        role: "empresa",
        username,
        empresaId: func.empresaId,
        empresaNome: empresa.nome,
        funcao: func.funcao,
        funcionarioId: func.id,
        funcionarioNome: func.nome,
        modulos: empresa.modulos,
      });
      res.json({
        token,
        role: "empresa",
        username,
        empresaId: func.empresaId,
        empresaNome: empresa.nome,
        funcao: func.funcao,
        funcionarioId: func.id,
        funcionarioNome: func.nome,
        modulos: empresa.modulos,
      });
      return;
    }
  }

  const [empresa] = await db
    .select()
    .from(empresasTable)
    .where(eq(empresasTable.username, username));
  if (empresa) {
    const ok = await checkPassword(password, empresa.password);
    if (ok) {
      if (!empresa.ativo) {
        res.status(401).json({ error: "Empresa inactiva" });
        return;
      }
      if (!empresa.password.startsWith("$2"))
        migratePassword(password, empresasTable, empresa.id);
      const token = await signToken({
        role: "empresa",
        username,
        empresaId: empresa.id,
        empresaNome: empresa.nome,
        funcao: "admin",
        funcionarioNome: empresa.nome,
        modulos: empresa.modulos,
      });
      res.json({
        token,
        role: "empresa",
        username,
        empresaId: empresa.id,
        empresaNome: empresa.nome,
        funcao: "admin",
        funcionarioNome: empresa.nome,
        modulos: empresa.modulos,
      });
      return;
    }
  }

  res.status(401).json({ error: "Credenciais inválidas" });
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  await pool.query(
    "UPDATE public.auth_sessions SET revoked_at=now() WHERE id=$1",
    [getUser(req).jti],
  );
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = getUser(req);
  res.json(user);
});

export default router;

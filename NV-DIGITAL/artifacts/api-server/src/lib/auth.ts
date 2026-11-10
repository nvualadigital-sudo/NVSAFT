import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32)
  throw new Error(
    "SESSION_SECRET deve ter pelo menos 32 caracteres. Não existe chave implícita.",
  );
export interface TokenPayload {
  role: "developer" | "empresa" | "parceiro";
  empresaId?: string;
  empresaNome?: string;
  username: string;
  funcao?: string;
  funcionarioId?: string;
  funcionarioNome?: string;
  parceiroId?: string;
  parceiroNome?: string;
  parceiroInstituicao?: string;
  modulos?: string[];
  jti?: string;
}
export async function signToken(payload: TokenPayload) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO public.auth_sessions(id,actor,empresa_id,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
    [id, payload.username, payload.empresaId || null],
  );
  return jwt.sign(payload, JWT_SECRET!, {
    expiresIn: "12h",
    jwtid: id,
    algorithm: "HS256",
  });
}
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET!, {
    algorithms: ["HS256"],
  }) as TokenPayload;
}
export async function validateSession(payload: TokenPayload) {
  if (!payload.jti) return false;
  const found = await pool.query(
    "SELECT 1 FROM public.auth_sessions WHERE id=$1 AND actor=$2 AND revoked_at IS NULL AND expires_at>now() AND empresa_id IS NOT DISTINCT FROM $3::uuid",
    [payload.jti, payload.username, payload.empresaId || null],
  );
  if (!found.rowCount) return false;
  if (payload.role === "developer") return true;
  if (!payload.empresaId) return false;
  const company = await pool.query(
    "SELECT ativo,modulos FROM public.empresas WHERE id=$1",
    [payload.empresaId],
  );
  if (!company.rows[0]?.ativo) return false;
  payload.modulos = company.rows[0].modulos;
  if (payload.funcionarioId) {
    const result = await pool.query(
      "SELECT ativo,funcao FROM public.funcionarios WHERE id=$1 AND empresa_id=$2 AND username=$3",
      [payload.funcionarioId, payload.empresaId, payload.username],
    );
    if (!result.rows[0]?.ativo) return false;
    payload.funcao = result.rows[0].funcao;
  } else if (payload.role === "parceiro") {
    const result = await pool.query(
      "SELECT ativo FROM public.parceiros WHERE id=$1 AND empresa_id=$2 AND username=$3",
      [payload.parceiroId, payload.empresaId, payload.username],
    );
    if (!result.rows[0]?.ativo) return false;
  }
  return true;
}
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if ((req as any).user) {
    next();
    return;
  }
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const user = verifyToken(auth.slice(7));
    if (!(await validateSession(user))) throw new Error("Sessão revogada");
    (req as any).user = user;
    next();
  } catch {
    res
      .status(401)
      .json({ error: "Sessão inválida ou expirada. Entre novamente." });
  }
}
export function requireDeveloper(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  void requireAuth(req, res, () => {
    if (getUser(req).role !== "developer") {
      res.status(403).json({ error: "Acesso restrito ao desenvolvedor" });
      return;
    }
    next();
  });
}
export function requireEmpresa(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  void requireAuth(req, res, () => {
    const u = getUser(req);
    if (u.role !== "empresa" || !u.empresaId) {
      res.status(403).json({ error: "É necessária uma sessão institucional." });
      return;
    }
    next();
  });
}
export function getUser(req: Request): TokenPayload {
  return (req as any).user;
}

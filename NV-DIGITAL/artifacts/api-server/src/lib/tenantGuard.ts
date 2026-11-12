import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { getUser } from "./auth.js";
const roles: Record<string, string[]> = {
  empresas: ["admin"],
  config: ["admin"],
  funcionarios: ["admin"],
  parceiros: ["admin"],
  sucursais: ["admin"],
  pacientes: [
    "admin",
    "gestor",
    "rececionista",
    "medico",
    "tecnico",
    "enfermeiro",
  ],
  resultados: ["admin", "gestor", "tecnico", "medico"],
  faturas: ["admin", "gestor", "financeiro", "rececionista"],
  movimentos: ["admin", "gestor", "financeiro"],
  produtos: ["admin", "gestor", "financeiro"],
  reagentes: ["admin", "gestor", "tecnico"],
  "stock-movimentos": ["admin", "gestor", "tecnico"],
  "exames-custom": ["admin", "gestor", "tecnico"],
};
export async function tenantGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const u = getUser(req);
  if (u.role === "developer") {
    if (!/^\/(empresas|auth)(\/|$)/.test(req.path)) {
      res
        .status(403)
        .json({
          error: "A gestão técnica não concede acesso aos registos clínicos.",
        });
      return;
    }
    next();
    return;
  }
  if (!u.empresaId) {
    res.status(403).json({ error: "Instituição não identificada." });
    return;
  }
  // Licenças já configuradas bloqueiam novas operações quando suspensas ou expiradas.
  // Empresas antigas sem registo de licença mantêm acesso, evitando migração destrutiva.
  if (!["GET", "HEAD"].includes(req.method)) {
    try {
      const result = await pool.query(
        "SELECT estado, inicio, fim FROM public.nv_licencas WHERE empresa_id=$1",
        [u.empresaId],
      );
      const license = result.rows[0];
      if (license) {
        const status = await pool.query(
          "SELECT ($1::date <= CURRENT_DATE AND ($2::date IS NULL OR $2::date >= CURRENT_DATE)) AS dentro_periodo",
          [license.inicio, license.fim],
        );
        if (license.estado !== "activo" || !status.rows[0]?.dentro_periodo) {
          res.status(403).json({ error: "Licença suspensa, expirada ou ainda não iniciada. Contacte a NV-DIGITAL." });
          return;
        }
      }
    } catch {
      res.status(503).json({ error: "Não foi possível validar a licença. Verifique a migração da base de dados." });
      return;
    }
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    const area = req.path.split("/")[1];
    if (roles[area] && !roles[area].includes(u.funcao || "")) {
      res.status(403).json({ error: "Sem permissão para alterar esta área." });
      return;
    }
    if (req.body && typeof req.body === "object") {
      delete req.body.empresaId;
      delete req.body.empresa_id;
      for (const [key, table] of [
        ["pacienteId", "pacientes"],
        ["resultadoId", "resultados"],
        ["faturaId", "faturas"],
        ["reagenteId", "reagentes"],
        ["solicitacaoId", "solicitacoes"],
      ] as const) {
        const id = req.body[key];
        if (id !== undefined && id !== null && id !== "") {
          try {
            const q = await pool.query(
              `SELECT 1 FROM public.${table} WHERE id=$1 AND empresa_id=$2`,
              [id, u.empresaId],
            );
            if (!q.rowCount) {
              res
                .status(403)
                .json({
                  error: "Referência de outra instituição ou inexistente.",
                });
              return;
            }
          } catch {
            res.status(400).json({ error: "Identificador inválido." });
            return;
          }
        }
      }
    }
  }
  next();
}

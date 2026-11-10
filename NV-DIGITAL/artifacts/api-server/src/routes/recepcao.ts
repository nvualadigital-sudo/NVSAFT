import { pool } from "@workspace/db";
import { createReceptionRouter } from "./reception-base.js";
import { getUser } from "../lib/auth.js";
export default createReceptionRouter({
  pool,
  getAccess: (req) => {
    const u = getUser(req);
    return u?.role === "empresa" && u.empresaId
      ? {
          empresaId: u.empresaId,
          actor: u.username,
          canRead: true,
          canWrite: [
            "admin",
            "gestor",
            "rececionista",
            "medico",
            "enfermeiro",
          ].includes(u.funcao || ""),
        }
      : null;
  },
  getPatient: async (empresaId, id) => {
    const q = await pool.query(
      "SELECT id,nome,processo FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
      [empresaId, Number(id) || 0],
    );
    return q.rows[0] || null;
  },
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .concat(
      (process.env.REPLIT_DOMAINS || "").split(",").map((x) => "https://" + x),
    )
    .concat(
      [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
        .filter(Boolean)
        .map((x) => "https://" + x),
    )
    .filter(Boolean),
});

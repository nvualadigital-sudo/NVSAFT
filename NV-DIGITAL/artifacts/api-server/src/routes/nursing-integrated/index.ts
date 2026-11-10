import { Router } from "express";
import { pool } from "@workspace/db";
import { getUser, requireEmpresa } from "../../lib/auth.js";
import {
  professionalFor,
  verifiedProfessional,
} from "../../lib/professionals.js";
import { createNursingRouter } from "./server/nursingRouter.js";
import { HostPostgresStore } from "./server/hostPostgresStore.js";
import type { Actor, Role } from "./src/integrated/model.js";
const r = Router();
r.use(requireEmpresa);
r.use(
  createNursingRouter({
    store: new HostPostgresStore(pool),
    resolveSession: async (req) => {
      const u = getUser(req);
      const profiles: Record<string, Role[]> = {
        medico: ["medico"],
        enfermeiro: ["enfermeiro"],
        farmaceutico: ["farmaceutico"],
        admin: ["admin"],
        gestor: ["auditor"],
      };
      if (!u.empresaId || !profiles[u.funcao || ""]) return null;
      const professional = await professionalFor(pool, u);
      const verified = professional && verifiedProfessional(professional.data);
      return {
        id: u.funcionarioId || u.username,
        name: u.funcionarioNome || u.username,
        tenantId: u.empresaId,
        tenantName: u.empresaNome || "Unidade",
        roles: profiles[u.funcao!],
        registration: verified ? professional.data.credential : undefined,
      } satisfies Actor;
    },
  }),
);
export default r;

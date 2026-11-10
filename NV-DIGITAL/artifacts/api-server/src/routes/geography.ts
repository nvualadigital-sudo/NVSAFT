import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool as productionPool } from "@workspace/db";
import {
  ANGOLA_GEOGRAPHY,
  COUNTRIES,
  GEOGRAPHY_VERSION,
} from "@workspace/api-zod";
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
import { localityParent } from "../lib/geography.js";
export function createGeographyRouter(pool: any = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  const care = [
    "admin",
    "gestor",
    "rececionista",
    "medico",
    "enfermeiro",
    "tecnico",
    "financeiro",
  ];
  r.get("/geography/catalogue", (_req, res) =>
    res.json({
      version: GEOGRAPHY_VERSION,
      countries: COUNTRIES,
      provinces: ANGOLA_GEOGRAPHY,
      source: "Lei 14/24, de 5 de Setembro — quadros anexos",
      codes:
        "Identificadores internos; não são códigos administrativos oficiais.",
    }),
  );
  r.get("/geography/patients/:id", async (req, res) => {
    const u = getUser(req);
    allowed(u, care);
    await patient(pool, u.empresaId!, Number(req.params.id));
    res.json(
      (
        await pool.query(
          "SELECT data,version,updated_at FROM public.nv_patient_geography WHERE empresa_id=$1 AND patient_id=$2",
          [u.empresaId, Number(req.params.id)],
        )
      ).rows[0] || null,
    );
  });
  r.get("/geography/localities", async (req, res) => {
    const u = getUser(req);
    allowed(u, care);
    const parent = value(req.query.parent, 200);
    if (!localityParent(parent))
      deny("Seleccione um município ou comuna do catálogo.");
    res.json(
      (
        await pool.query(
          "SELECT id,parent_id,name,status FROM public.nv_localities WHERE empresa_id=$1 AND parent_id=$2 ORDER BY name",
          [u.empresaId, parent],
        )
      ).rows,
    );
  });
  r.post("/geography/localities", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor", "rececionista"]);
    const parent = value(req.body.parentId, 200),
      name = value(req.body.name, 200);
    if (!localityParent(parent)) deny("Município/comuna inválido.");
    res.status(201).json(
      await transaction(pool, u.empresaId!, async (c) => {
        const row = (
          await c.query(
            "INSERT INTO public.nv_localities(empresa_id,id,parent_id,name,status,created_by) VALUES($1,$2,$3,$4,'pending',$5) ON CONFLICT(empresa_id,parent_id,name) DO UPDATE SET name=excluded.name RETURNING id,parent_id,name,status",
            [u.empresaId, randomUUID(), parent, name, u.username],
          )
        ).rows[0];
        await event(c, u, "geography.locality.propose", row.id);
        return row;
      }),
    );
  });
  r.post("/geography/localities/:id/approve", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const id = uuid(req.params.id);
    await transaction(pool, u.empresaId!, async (c) => {
      const q = await c.query(
        "UPDATE public.nv_localities SET status='approved',approved_by=$3 WHERE empresa_id=$1 AND id=$2 RETURNING id",
        [u.empresaId, id, u.username],
      );
      if (!q.rowCount) deny("Localidade indisponível.", 404);
      await event(c, u, "geography.locality.approve", id);
    });
    res.json({ ok: true });
  });
  r.use(apiErrors);
  return r;
}

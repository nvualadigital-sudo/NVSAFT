import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import release from "../../../../nv-release.json" with { type: "json" };

type Queryable = {
  query(
    text: string,
    params: string[][],
  ): Promise<{ rows: { name: string; sha256: string }[] }>;
};

export function createHealthRouter(db: Queryable = pool): IRouter {
  const router: IRouter = Router();
  router.get("/healthz", (_req, res) => {
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  });
  router.get("/readyz", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    let ready = false;
    try {
      const expected = Object.entries(release.migrations);
      const { rows } = await db.query(
        "SELECT name,sha256 FROM public.hospital_migrations WHERE name=ANY($1::text[])",
        [expected.map(([name]) => name)],
      );
      const applied = new Map(rows.map((row) => [row.name, row.sha256]));
      ready = expected.every(([name, hash]) => applied.get(name) === hash);
    } catch {
      /* Sem exposição do host, nomes internos ou erros do Postgres. */
    }
    res.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "indisponivel",
      version: release.version,
    });
  });
  return router;
}

export default createHealthRouter();

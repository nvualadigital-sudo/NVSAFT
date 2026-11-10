import express, { type Request } from "express";
import { type Actor, type ClinicalState } from "../src/integrated/model";
import { execute, DomainError } from "./domain";
export interface ClinicalStore {
  read(tenantId: string): ClinicalState | Promise<ClinicalState>;
  command(
    tenantId: string,
    requestId: string,
    revision: number,
    run: (s: ClinicalState) => ClinicalState,
  ): ClinicalState | Promise<ClinicalState>;
}
export type SessionResolver = (
  req: Request,
) => Promise<Actor | null> | Actor | null;
export function createNursingRouter({
  resolveSession,
  store,
}: {
  resolveSession: SessionResolver;
  store: ClinicalStore;
}) {
  const router = express.Router();
  router.use(express.json({ limit: "256kb" }));
  router.use(async (req, res, next): Promise<void> => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const a = await resolveSession(req);
      if (
        !a ||
        !a.id ||
        !a.name ||
        !a.tenantId ||
        !Array.isArray(a.roles) ||
        !a.roles.some((r) =>
          [
            "admin",
            "medico",
            "enfermeiro",
            "chefe_enfermagem",
            "farmaceutico",
            "auditor",
          ].includes(r),
        )
      ) {
        res.status(401).json({
          error:
            "Use a sessão activa do sistema principal. O servidor deve validar o utilizador, a empresa e as permissões.",
        });
        return;
      }
      res.locals.actor = a;
      if (req.method !== "GET") {
        if (req.get("X-Nursing-Request") !== "1") {
          res.status(403).json({ error: "Pedido inválido." });
          return;
        }
        const origin = req.get("origin");
        const expected =
          process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
        const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
          .split(",")
          .map((value) => value.trim());
        if (origin && origin !== expected && !configuredOrigins.includes(origin)) {
          res.status(403).json({ error: "Origem não autorizada." });
          return;
        }
      }
      next();
    } catch {
      res.status(503).json({
        error: "Não foi possível validar a sessão no sistema principal.",
      });
    }
  });
  const result = (a: Actor, s: ClinicalState) => ({ actor: a, state: s });
  router.get("/bootstrap", async (_req, res) => {
    try {
      res.json(
        result(res.locals.actor, await store.read(res.locals.actor.tenantId)),
      );
    } catch {
      res
        .status(503)
        .json({ error: "Não foi possível ler o processo clínico." });
    }
  });
  router.post("/commands", async (req, res) => {
    try {
      const { type, payload, revision, requestId } = req.body || {};
      if (
        typeof type !== "string" ||
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        !Number.isInteger(revision) ||
        typeof requestId !== "string" ||
        !/^[a-zA-Z0-9-]{8,100}$/.test(requestId)
      )
        throw new DomainError("Pedido inválido.", 400);
      const a = res.locals.actor as Actor;
      if (
        req.body.expectedTenantId !== a.tenantId ||
        req.body.expectedActorId !== a.id
      )
        throw new DomainError(
          "A sessão mudou. Actualize o módulo antes de continuar.",
          409,
        );
      const state = await store.command(a.tenantId, requestId, revision, (s) =>
        execute(s, a, type, payload),
      );
      res.json(result(a, state));
    } catch (e) {
      res.status(e instanceof DomainError ? e.status : 500).json({
        error:
          e instanceof DomainError
            ? e.message
            : "Não foi possível guardar. Nenhuma alteração foi confirmada.",
      });
    }
  });
  return router;
}
/** Host endpoint must validate its own cookie/token; browser role/company headers are never trusted. */
export function introspectionResolver(
  url: string | undefined,
): SessionResolver {
  return async (req) => {
    if (!url) return null;
    const headers: Record<string, string> = {};
    if (req.get("authorization"))
      headers.Authorization = req.get("authorization")!;
    if (req.get("cookie")) headers.Cookie = req.get("cookie")!;
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { actor?: Actor };
    return data.actor || null;
  };
}

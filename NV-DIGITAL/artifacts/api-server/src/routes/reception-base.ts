import { Router, type Request } from "express";
import type { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";
export interface ReceptionAccess {
  empresaId: string;
  actor: string;
  canRead: boolean;
  canWrite: boolean;
}
export interface ReceptionPatient {
  id: string | number;
  nome: string;
  processo?: string;
}
interface Options {
  pool: Pool;
  /** Deve verificar a sessão no servidor e a pertença à instituição. Nunca ler empresaId do body. */
  getAccess: (
    req: Request,
  ) => Promise<ReceptionAccess | null> | ReceptionAccess | null;
  /** Consultar o cadastro real, filtrando SEMPRE pela empresa autorizada. */
  getPatient: (
    empresaId: string,
    id: string,
  ) => Promise<ReceptionPatient | null>;
  /** Origens reais permitidas. Pedido de escrita do browser sem origem é recusado. */
  allowedOrigins: string[];
}
const destinations = ["enfermagem", "consulta", "laboratorio"],
  kinds = ["normal", "retorno", "preferencial"];
const transitions: Record<string, string[]> = {
  aguardando: ["chamado", "encaminhado", "cancelado"],
  chamado: ["encaminhado", "cancelado"],
  encaminhado: ["concluido"],
  concluido: [],
  cancelado: [],
};
const uuid = (x: unknown) =>
  typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x,
  );
function validDay(x: unknown): x is string {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(x + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}
function ticket(r: any) {
  return {
    id: r.id,
    numero: r.numero,
    pacienteId: r.paciente_id,
    pacienteNome: r.paciente_nome,
    processo: r.processo,
    destino: r.destino,
    tipo: r.tipo,
    estado: r.estado,
    chegadaEm: new Date(r.chegada_em).toISOString(),
    chamadoEm: r.chamado_em ? new Date(r.chamado_em).toISOString() : undefined,
    actualizadoEm: new Date(r.actualizado_em).toISOString(),
    versao: r.versao,
  };
}
export function createReceptionRouter(options: Options) {
  const router = Router();
  router.use(async (req, res, next) => {
    try {
      const access = await options.getAccess(req);
      if (!access?.empresaId || !access.actor || !access.canRead) {
        res
          .status(401)
          .json({ error: "Sessão ou instituição não autorizada." });
        return;
      }
      if (req.method !== "GET") {
        if (!access.canWrite) {
          res
            .status(403)
            .json({ error: "Sem permissão para gerir a recepção." });
          return;
        }
        if (
          !req.headers.origin ||
          !options.allowedOrigins.includes(req.headers.origin)
        ) {
          res.status(403).json({ error: "Origem não autorizada." });
          return;
        }
      }
      res.locals.receptionAccess = access;
      res.setHeader("Cache-Control", "no-store");
      next();
    } catch {
      res.status(401).json({ error: "Não foi possível validar a sessão." });
    }
  });
  router.get("/", async (req, res, next) => {
    try {
      if (!validDay(req.query.data)) {
        res.status(400).json({ error: "Dia inválido." });
        return;
      }
      const access = res.locals.receptionAccess as ReceptionAccess;
      const result = await options.pool.query(
        "SELECT * FROM reception_visits WHERE empresa_id=$1 AND dia=$2 ORDER BY chegada_em,numero",
        [access.empresaId, req.query.data],
      );
      res.json({ items: result.rows.map(ticket) });
    } catch (e) {
      next(e);
    }
  });
  router.post("/", async (req, res, next) => {
    const access = res.locals.receptionAccess as ReceptionAccess,
      b = req.body || {};
    if (
      !uuid(b.requestId) ||
      typeof b.pacienteId !== "string" ||
      !b.pacienteId.trim() ||
      b.pacienteId.length > 100 ||
      !destinations.includes(b.destino) ||
      !kinds.includes(b.tipo)
    ) {
      res
        .status(400)
        .json({
          error: "Paciente, destino, tipo ou chave de pedido inválidos.",
        });
      return;
    }
    const hash = createHash("sha256")
      .update(JSON.stringify([b.pacienteId, b.destino, b.tipo]))
      .digest("hex");
    let client;
    try {
      const patient = await options.getPatient(access.empresaId, b.pacienteId);
      if (!patient || String(patient.id) !== b.pacienteId || !patient.nome) {
        res
          .status(404)
          .json({ error: "Paciente não encontrado nesta instituição." });
        return;
      }
      client = await options.pool.connect();
      await client.query("BEGIN");
      // Serializa numeração/check-in apenas dentro da instituição. Não há locks entre instituições.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        ["recepcao:" + access.empresaId],
      );
      const old = await client.query(
        "SELECT * FROM reception_visits WHERE empresa_id=$1 AND request_id=$2",
        [access.empresaId, b.requestId],
      );
      if (old.rows[0]) {
        await client.query("COMMIT");
        if (old.rows[0].request_hash !== hash) {
          res
            .status(409)
            .json({ error: "Chave de pedido reutilizada para outra chegada." });
          return;
        }
        res.json({ item: ticket(old.rows[0]), repetido: true });
        return;
      }
      const result = await client.query(
        `INSERT INTO reception_visits(id,empresa_id,dia,numero,paciente_id,paciente_nome,processo,destino,tipo,request_id,request_hash,criado_por)
    SELECT $1,$2,(now() AT TIME ZONE 'Africa/Luanda')::date,COALESCE(MAX(numero),0)+1,$3,$4,$5,$6,$7,$8,$9,$10 FROM reception_visits WHERE empresa_id=$2 AND dia=(now() AT TIME ZONE 'Africa/Luanda')::date RETURNING *`,
        [
          randomUUID(),
          access.empresaId,
          b.pacienteId,
          patient.nome,
          patient.processo || "",
          b.destino,
          b.tipo,
          b.requestId,
          hash,
          access.actor,
        ],
      );
      const row = result.rows[0];
      await client.query(
        "INSERT INTO reception_audit(id,visita_id,empresa_id,actor,estado_novo) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), row.id, access.empresaId, access.actor, "aguardando"],
      );
      await client.query("COMMIT");
      res.status(201).json({ item: ticket(row) });
    } catch (e: any) {
      if (client) await client.query("ROLLBACK");
      if (e.code === "23505") {
        res
          .status(409)
          .json({
            error:
              "Este paciente já tem uma chegada activa hoje. Consulte a fila antes de repetir.",
          });
        return;
      }
      next(e);
    } finally {
      client?.release();
    }
  });
  router.patch("/:id", async (req, res, next) => {
    const access = res.locals.receptionAccess as ReceptionAccess,
      b = req.body || {};
    if (
      !uuid(req.params.id) ||
      typeof b.estado !== "string" ||
      !Object.hasOwn(transitions, b.estado) ||
      !Number.isInteger(b.versao) ||
      b.versao < 1 ||
      typeof (b.motivo ?? "") !== "string" ||
      (b.motivo?.length || 0) > 500 ||
      (b.estado === "cancelado" && !b.motivo?.trim())
    ) {
      res.status(400).json({ error: "Estado, versão ou motivo inválido." });
      return;
    }
    let client;
    try {
      client = await options.pool.connect();
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT * FROM reception_visits WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
        [access.empresaId, req.params.id],
      );
      const old = found.rows[0];
      if (!old) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Chegada não encontrada." });
        return;
      }
      if (
        old.versao !== b.versao ||
        !transitions[old.estado].includes(b.estado)
      ) {
        await client.query("ROLLBACK");
        res
          .status(409)
          .json({
            error:
              "A fila mudou noutro posto ou a transição não é permitida. Actualize antes de continuar.",
          });
        return;
      }
      const result = await client.query(
        "UPDATE reception_visits SET estado=$1,versao=versao+1,actualizado_em=now(),chamado_em=CASE WHEN $1='chamado' THEN now() ELSE chamado_em END WHERE id=$2 AND empresa_id=$3 RETURNING *",
        [b.estado, old.id, access.empresaId],
      );
      await client.query(
        "INSERT INTO reception_audit(id,visita_id,empresa_id,actor,estado_anterior,estado_novo,motivo) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          old.id,
          access.empresaId,
          access.actor,
          old.estado,
          b.estado,
          b.motivo?.trim() || "",
        ],
      );
      await client.query("COMMIT");
      res.json({ item: ticket(result.rows[0]) });
    } catch (e) {
      if (client) await client.query("ROLLBACK");
      next(e);
    } finally {
      client?.release();
    }
  });
  router.use((error: any, _req: any, res: any, _next: any) => {
    console.error("Falha na recepção:", error?.code || "API_ERROR");
    res
      .status(500)
      .json({
        error:
          "O servidor não confirmou a operação. Actualize a fila antes de repetir.",
      });
  });
  return router;
}

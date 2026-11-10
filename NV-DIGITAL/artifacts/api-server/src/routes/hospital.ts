import { syncRegistrationInsurance } from "../lib/insurance.js";
import { savePatientGeography } from "../lib/geography.js";
import { DomainError } from "../lib/governance.js";
import { createLibraryRouter } from "./library.js";
import { Router } from "express";
import { captureClinicalIssuers } from "../lib/professionals.js";
import { pool as productionPool } from "@workspace/db";
import { getUser, requireEmpresa } from "../lib/auth.js";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
const uid = (x: any) =>
  typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x,
  );
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (s: string, status = 400): never => {
  throw new HttpError(status, s);
};
const text = (x: any, max = 4000) => {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    fail("Texto obrigatório ou demasiado longo.");
  return x.trim();
};
const n = (x: any, min = 0) => {
  const v = Number(x);
  if (!Number.isFinite(v) || v < min || v > 1e10)
    fail("Valor numérico inválido.");
  return v;
};
const medicineKey = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    : "";
const roles: Record<string, string[]> = {
  clinical: ["admin", "gestor", "medico"],
  "nursing-patients": ["admin", "gestor", "enfermeiro", "medico"],
  "nursing-operation": ["admin", "gestor", "enfermeiro", "medico"],
  appointments: ["admin", "gestor", "rececionista", "medico"],
  billing: ["admin", "gestor", "financeiro", "farmaceutico"],
};
async function audit(
  client: any,
  org: string,
  actor: string,
  action: string,
  reference = "",
) {
  await client.query(
    "INSERT INTO public.hospital_audit(id,empresa_id,actor,action,reference) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), org, actor, action, reference],
  );
}
export function createHospitalRouter(pool: Pool = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.get("/integrity", async (req, res) => {
    const u = getUser(req);
    if (!["admin", "gestor"].includes(u.funcao || "")) {
      res.json({ held: 0 });
      return;
    }
    const q = await pool.query(
      `SELECT (SELECT count(*) FROM public.resultados r WHERE r.empresa_id=$1 AND r.paciente_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=r.paciente_id AND p.empresa_id=r.empresa_id))+(SELECT count(*) FROM public.faturas f WHERE f.empresa_id=$1 AND f.paciente_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=f.paciente_id AND p.empresa_id=f.empresa_id)) AS held`,
      [u.empresaId],
    );
    res.json({ held: Number(q.rows[0].held) });
  });
  r.get("/workspace", async (req, res) => {
    const u = getUser(req);
    const q = await pool.query(
      "SELECT namespace,data,revision FROM public.hospital_state WHERE empresa_id=$1",
      [u.empresaId],
    );
    const clinicalRoles = ["admin", "gestor", "medico", "enfermeiro"];
    const rows = q.rows.filter((x: any) =>
      x.namespace === "appointments"
        ? [...clinicalRoles, "rececionista"].includes(u.funcao || "")
        : x.namespace === "clinical"
          ? [...clinicalRoles, "farmaceutico"].includes(u.funcao || "")
          : x.namespace.startsWith("nursing-") &&
            clinicalRoles.includes(u.funcao || ""),
    );
    for (const x of rows)
      if (x.namespace === "clinical" && u.funcao === "farmaceutico" && x.data) {
        x.data = { ...x.data, visits: [], documents: [], audit: [] };
      }
    await audit(pool, u.empresaId!, u.username, "workspace.read");
    res.json(rows);
  });
  r.put("/workspace/:namespace", async (req, res) => {
    const u = getUser(req),
      key = String(req.params.namespace),
      { revision, data } = req.body || {};
    if (!Object.hasOwn(roles, key) || !roles[key].includes(u.funcao || ""))
      fail("Sem permissão para alterar esta área.", 403);
    if (
      !Number.isInteger(revision) ||
      revision < 0 ||
      data === null ||
      typeof data !== "object" ||
      JSON.stringify(data).length > 8_000_000
    )
      fail("Estado inválido.");
    if (key === "billing")
      fail("Use as operações transaccionais de facturação.", 403);
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["nv:" + u.empresaId]);
      await c.query(
        "INSERT INTO public.hospital_state(empresa_id,namespace) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [u.empresaId, key],
      );
      const found = await c.query(
        "SELECT * FROM public.hospital_state WHERE empresa_id=$1 AND namespace=$2 FOR UPDATE",
        [u.empresaId, key],
      );
      const old = found.rows[0];
      if (old.revision !== revision)
        fail(
          "Outro posto alterou estes dados. Actualize antes de repetir.",
          409,
        );
      if (key === "clinical") {
        for (const k of [
          "visits",
          "prescriptions",
          "deliveries",
          "documents",
          "audit",
        ])
          if (!Array.isArray(data[k])) fail("Registo clínico inválido.");
        const previous = old.data || {
          visits: [],
          prescriptions: [],
          deliveries: [],
          documents: [],
          audit: [],
        };
        if (
          JSON.stringify(previous.deliveries) !==
          JSON.stringify(data.deliveries)
        )
          fail("A dispensa exige a operação da farmácia.", 403);
        for (const collection of ["visits", "prescriptions", "documents"]) {
          const seen = new Set();
          for (const row of data[collection]) {
            if (!uid(row.id) || seen.has(row.id))
              fail("Identificador clínico inválido/duplicado.");
            seen.add(row.id);
            const prior = previous[collection].find(
              (x: any) => x.id === row.id,
            );
            if (prior && JSON.stringify(prior) === JSON.stringify(row))
              continue;
            if (
              prior &&
              collection === "visits" &&
              (prior.owner !== u.username ||
                prior.owner !== row.owner ||
                String(prior.patient?.id) !== String(row.patient?.id))
            )
              fail("Não pode mudar o titular/paciente do episódio.", 403);
            if (prior && collection === "prescriptions") {
              if (
                !row.cancelled ||
                !row.cancelReason ||
                JSON.stringify({
                  ...row,
                  cancelled: undefined,
                  cancelReason: undefined,
                }) !==
                  JSON.stringify({
                    ...prior,
                    cancelled: undefined,
                    cancelReason: undefined,
                  })
              )
                fail("Prescrição emitida é imutável; suspenda e crie outra.");
            }
            const visit =
              collection === "visits"
                ? row
                : data.visits.find((v: any) => v.id === row.visitId);
            if (!visit || visit.owner !== u.username)
              fail("Apenas o médico responsável pode alterar o episódio.", 403);
            if (
              prior &&
              (prior.closed ||
                prior.finalized ||
                prior.voided ||
                prior.cancelled)
            ) {
              const permitted =
                collection === "documents" &&
                !prior.voided &&
                row.voided &&
                row.voidReason &&
                JSON.stringify({
                  ...row,
                  voided: undefined,
                  voidReason: undefined,
                }) ===
                  JSON.stringify({
                    ...prior,
                    voided: undefined,
                    voidReason: undefined,
                  });
              if (!permitted) fail("Registo finalizado é imutável.");
            }
            if (!prior && collection === "visits") {
              const p = await c.query(
                "SELECT 1 FROM public.pacientes WHERE id=$1 AND empresa_id=$2",
                [Number(row.patient?.id) || 0, u.empresaId],
              );
              if (!p.rowCount)
                fail("Paciente não pertence à instituição.", 403);
            }
            if (
              collection === "prescriptions" &&
              (!Array.isArray(row.items) ||
                !row.items.length ||
                row.items.some(
                  (m: any) =>
                    !m.name ||
                    !m.dose ||
                    !m.route ||
                    !Number.isFinite(m.quantity) ||
                    m.quantity <= 0,
                ))
            )
              fail("Prescrição incompleta.");
          }
          for (const prior of previous[collection])
            if (!data[collection].some((x: any) => x.id === prior.id))
              fail("Não é permitido apagar o histórico clínico.");
        }
        await captureClinicalIssuers(c, u, previous, data);
        data.audit = [
          ...previous.audit,
          {
            id: randomUUID(),
            when: new Date().toISOString(),
            actor: u.username,
            action: "Actualização clínica confirmada",
            ref: "",
          },
        ];
      }
      if (key === "nursing-patients") {
        if (
          !Array.isArray(data) ||
          data.some(
            (p: any) => !Number.isSafeInteger(p.idEnf) || !p.nomePaciente,
          ) ||
          new Set(data.map((p: any) => p.idEnf)).size !== data.length
        )
          fail("Lista de enfermagem inválida.");
        for (const oldPatient of old.data || [])
          if (!data.some((p: any) => p.idEnf === oldPatient.idEnf))
            fail("Não apague o histórico de enfermagem.");
      }
      if (key === "nursing-operation") {
        if (
          !Array.isArray(data.events) ||
          !Array.isArray(data.beds) ||
          !Array.isArray(data.stays)
        )
          fail("Registos de enfermagem inválidos.");
        const active = data.stays.filter((s: any) => !s.closed);
        if (
          new Set(active.map((s: any) => s.bedId)).size !== active.length ||
          new Set(active.map((s: any) => s.patientId)).size !== active.length
        )
          fail("Leito ou paciente com ocupação duplicada.", 409);
        for (const event of old.data?.events || []) {
          const current = data.events.find((x: any) => x.id === event.id);
          if (!current) fail("Não apague registos assistenciais.");
          if (
            event.status !== "pendente" &&
            JSON.stringify(current) !== JSON.stringify(event)
          )
            fail("Registo assistencial concluído é imutável.");
        }
      }
      if (key === "appointments") {
        if (!Array.isArray(data) || data.length > 20000)
          fail("Agenda inválida.");
        const ids = new Set<string>();
        for (const a of data) {
          if (
            !uid(a.id) ||
            ids.has(a.id) ||
            !Number.isSafeInteger(a.patientId) ||
            !a.professional?.trim() ||
            !a.service?.trim() ||
            !["marcado", "confirmado", "cancelado"].includes(a.status) ||
            !Number.isFinite(Date.parse(a.when))
          )
            fail("Marcação incompleta ou inválida.");
          ids.add(a.id);
          const prior = (old.data || []).find((x: any) => x.id === a.id);
          if (prior && prior.patientId !== a.patientId)
            fail("O paciente de uma marcação não pode ser trocado.", 409);
          if (
            prior?.status === "cancelado" &&
            JSON.stringify(prior) !== JSON.stringify(a)
          )
            fail("Uma marcação cancelada conserva o histórico.", 409);
          if (
            a.status === "cancelado" &&
            prior?.status !== "cancelado" &&
            !a.cancelReason?.trim()
          )
            fail("Indique o motivo do cancelamento.");
          if (!prior) {
            const p = await c.query(
              "SELECT 1 FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
              [u.empresaId, a.patientId],
            );
            if (!p.rowCount)
              fail("Paciente indisponível nesta instituição.", 403);
          }
          const duration = Number(a.durationMinutes ?? 30);
          if (!Number.isInteger(duration) || duration < 5 || duration > 480)
            fail("A duração deve ficar entre 5 e 480 minutos.");
        }
        for (const p of old.data || [])
          if (!ids.has(p.id))
            fail("Cancele a marcação com motivo em vez de apagar o histórico.");
        const groups = new Map<string, any[]>();
        for (const a of data.filter((a: any) => a.status !== "cancelado"))
          for (const resource of [
            "professional:" + a.professional.trim().toLowerCase(),
            a.room?.trim() ? "room:" + a.room.trim().toLowerCase() : null,
          ].filter(Boolean)) {
            const rows = groups.get(resource!) || [];
            rows.push(a);
            groups.set(resource!, rows);
          }
        for (const rows of groups.values()) {
          rows.sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
          let lastEnd = -Infinity;
          for (const a of rows) {
            const start = Date.parse(a.when);
            if (start < lastEnd)
              fail("Conflito de horário do profissional ou sala.", 409);
            lastEnd = Math.max(
              lastEnd,
              start + Number(a.durationMinutes ?? 30) * 60000,
            );
          }
        }
      }
      const result = await c.query(
        "UPDATE public.hospital_state SET data=$3,revision=revision+1,updated_at=now() WHERE empresa_id=$1 AND namespace=$2 RETURNING data,revision",
        [u.empresaId, key, JSON.stringify(data)],
      );
      await audit(c, u.empresaId!, u.username, "workspace." + key);
      await c.query("COMMIT");
      res.json(result.rows[0]);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });
  r.use(createLibraryRouter(pool));
  r.get("/chat/contacts", async (req, res) => {
    const u = getUser(req);
    const q = await pool.query(
      "SELECT username,nome FROM public.funcionarios WHERE empresa_id=$1 AND ativo=true UNION SELECT username,nome FROM public.empresas WHERE id=$1",
      [u.empresaId],
    );
    res.json(q.rows.filter((p: any) => p.username !== u.username));
  });
  r.get("/chat", async (req, res) => {
    const u = getUser(req),
      peer = typeof req.query.peer === "string" ? req.query.peer : "";
    const q = await pool.query(
      "SELECT m.id,m.sender,m.sender_name,m.recipient,m.body,m.created_at,(SELECT rr.read_at FROM public.hospital_read_receipts rr WHERE rr.empresa_id=m.empresa_id AND rr.actor=m.recipient AND rr.conversation=m.sender AND rr.read_at>=m.created_at) AS read_at,coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size_bytes)) FROM public.nv_chat_attachments a WHERE a.empresa_id=m.empresa_id AND a.message_id=m.id),'[]') AS attachments FROM public.hospital_messages m WHERE m.empresa_id=$1 AND (($3='' AND m.recipient IS NULL) OR ($3<>'' AND ((m.sender=$2 AND m.recipient=$3) OR (m.sender=$3 AND m.recipient=$2)))) AND ($4='' OR m.body ILIKE '%'||$4||'%') ORDER BY m.created_at DESC LIMIT 100 OFFSET $5",
      [
        u.empresaId,
        u.username,
        peer,
        String(req.query.q || "").slice(0, 200),
        Math.max(0, Number(req.query.page) || 0) * 100,
      ],
    );
    res.json(q.rows.reverse());
  });
  r.post("/chat", async (req, res) => {
    const u = getUser(req),
      b = req.body,
      peer = b.recipient || null;
    if (!uid(b.requestId)) fail("Chave de pedido inválida.");
    if (peer) {
      const found = await pool.query(
        "SELECT username FROM public.funcionarios WHERE empresa_id=$1 AND username=$2 AND ativo=true UNION SELECT username FROM public.empresas WHERE id=$1 AND username=$2 AND ativo=true",
        [u.empresaId, peer],
      );
      if (!found.rowCount)
        fail("Destinatário não pertence à instituição.", 403);
    }
    const result = await pool.query(
      "INSERT INTO public.hospital_messages(id,empresa_id,sender,sender_name,recipient,body,request_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(empresa_id,sender,request_id) DO UPDATE SET request_id=excluded.request_id RETURNING id",
      [
        randomUUID(),
        u.empresaId,
        u.username,
        u.funcionarioNome || u.username,
        peer,
        text(b.body),
        b.requestId,
      ],
    );
    res.status(201).json(result.rows[0]);
  });
  r.get("/medlink/directory", async (_req, res) => {
    const q = await pool.query(
      "SELECT id,nome FROM public.empresas WHERE ativo=true ORDER BY nome",
    );
    res.json(q.rows);
  });
  r.get("/medlink", async (req, res) => {
    const u = getUser(req);
    if (!["admin", "gestor", "medico"].includes(u.funcao || ""))
      fail("Partilha clínica restrita a profissionais autorizados.", 403);
    const q = await pool.query(
      "SELECT s.id,s.source_empresa_id,s.target_empresa_id,s.subject,s.request_type,s.status,s.created_at,s.revoked_at,s.read_at,a.nome AS source_name,b.nome AS target_name FROM public.hospital_shares s JOIN public.empresas a ON a.id=s.source_empresa_id JOIN public.empresas b ON b.id=s.target_empresa_id WHERE source_empresa_id=$1 OR target_empresa_id=$1 ORDER BY s.created_at DESC",
      [u.empresaId],
    );
    res.json(q.rows);
  });
  r.post("/medlink", async (req, res) => {
    const u = getUser(req),
      b = req.body;
    if (!["admin", "gestor", "medico"].includes(u.funcao || ""))
      fail("Partilha exige médico ou gestor.", 403);
    if (
      !uid(b.targetId) ||
      b.targetId === u.empresaId ||
      !Number.isSafeInteger(b.patientId)
    )
      fail("Destino ou paciente inválido.");
    const requestType = b.requestType || "partilha";
    if (!["partilha", "exame", "consulta"].includes(requestType))
      fail("Tipo de pedido MedLink inválido.");
    if (b.requestId != null && !uid(b.requestId)) fail("Chave de pedido inválida.");
    const subject = text(b.subject, 200),
      body = text(b.body, 30000),
      basis = text(b.basis, 1000);
    const requestId = b.requestId || null;
    const prior = requestId ? await pool.query(
      "SELECT id,request_type,status,patient_id,target_empresa_id,subject,body,basis FROM public.hospital_shares WHERE source_empresa_id=$1 AND created_by=$2 AND request_id=$3",
      [u.empresaId, u.username, requestId],
    ) : { rows: [], rowCount: 0 };
    const existing = prior.rows[0];
    if (existing) {
      if (existing.target_empresa_id !== b.targetId || Number(existing.patient_id) !== b.patientId || existing.request_type !== requestType || existing.subject !== subject || existing.body !== body || existing.basis !== basis)
        fail("Pedido reutilizado com outro conteúdo.", 409);
      res.json({ id: existing.id, status: existing.status, request_type: existing.request_type });
      return;
    }
    const result = await pool.query(
      "INSERT INTO public.hospital_shares(id,source_empresa_id,target_empresa_id,patient_id,subject,body,basis,created_by,request_type,status,request_id) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11 WHERE EXISTS(SELECT 1 FROM public.pacientes WHERE id=$4 AND empresa_id=$2) AND EXISTS(SELECT 1 FROM public.empresas WHERE id=$3 AND ativo=true) ON CONFLICT (source_empresa_id,created_by,request_id) WHERE request_id IS NOT NULL DO NOTHING RETURNING id,status,request_type",
      [
        randomUUID(),
        u.empresaId,
        b.targetId,
        b.patientId,
        subject,
        body,
        basis,
        u.username,
        requestType,
        requestType === "partilha" ? "partilhado" : "pendente",
        requestId,
      ],
    );
    if (!result.rowCount) {
      if (requestId) {
        const replay = await pool.query(
          "SELECT id,request_type,status,patient_id,target_empresa_id,subject,body,basis FROM public.hospital_shares WHERE source_empresa_id=$1 AND created_by=$2 AND request_id=$3",
          [u.empresaId, u.username, requestId],
        );
        const row = replay.rows[0];
        if (row && row.target_empresa_id === b.targetId && Number(row.patient_id) === b.patientId && row.request_type === requestType && row.subject === subject && row.body === body && row.basis === basis) {
          res.json({ id: row.id, status: row.status, request_type: row.request_type });
          return;
        }
      }
      fail("Paciente ou instituição não autorizado, ou pedido reutilizado com outros dados.", 403);
    }
    await audit(
      pool,
      u.empresaId!,
      u.username,
      "medlink.share",
      result.rows[0].id,
    );
    res.status(201).json(result.rows[0]);
  });
  r.get("/medlink/:id", async (req, res) => {
    const u = getUser(req);
    if (!["admin", "gestor", "medico"].includes(u.funcao || ""))
      fail("Partilha clínica restrita a profissionais autorizados.", 403);
    if (!uid(req.params.id)) fail("Identificador inválido.");
    const q = await pool.query(
      "SELECT s.*,a.nome AS source_name,b.nome AS target_name FROM public.hospital_shares s JOIN public.empresas a ON a.id=s.source_empresa_id JOIN public.empresas b ON b.id=s.target_empresa_id WHERE s.id=$1 AND (s.source_empresa_id=$2 OR (s.target_empresa_id=$2 AND s.revoked_at IS NULL))",
      [req.params.id, u.empresaId],
    );
    const row = q.rows[0];
    if (!row) fail("Partilha indisponível.", 404);
    await pool.query(
      "UPDATE public.hospital_shares SET read_at=coalesce(read_at,now()) WHERE id=$1 AND target_empresa_id=$2",
      [row.id, u.empresaId],
    );
    await audit(pool, u.empresaId!, u.username, "medlink.read", row.id);
    res.json(row);
  });
  r.delete("/medlink/:id", async (req, res) => {
    const u = getUser(req);
    if (!uid(req.params.id)) fail("Identificador inválido.");
    if (!["admin", "gestor", "medico"].includes(u.funcao || ""))
      fail("Sem permissão.", 403);
    const q = await pool.query(
      "UPDATE public.hospital_shares SET revoked_at=now() WHERE id=$1 AND source_empresa_id=$2 RETURNING id",
      [req.params.id, u.empresaId],
    );
    if (!q.rowCount) fail("Partilha não encontrada.", 404);
    await audit(
      pool,
      u.empresaId!,
      u.username,
      "medlink.revoke",
      String(req.params.id),
    );
    res.json({ ok: true });
  });
  // Mensagens são restritas aos participantes de uma partilha identificada;
  // o Chat interno continua isolado a colaboradores da própria instituição.
  r.get("/medlink/:id/messages", async (req, res) => {
    const u = getUser(req);
    if (!["admin", "gestor", "medico"].includes(u.funcao || ""))
      fail("A conversa MedLink requer autorização clínica.", 403);
    if (!uid(req.params.id)) fail("Partilha inválida.");
    const share = await pool.query(
      "SELECT id FROM public.hospital_shares WHERE id=$1 AND revoked_at IS NULL AND (source_empresa_id=$2 OR target_empresa_id=$2)",
      [req.params.id, u.empresaId],
    );
    if (!share.rowCount) fail("Conversa indisponível.", 404);
    const messages = await pool.query(
      "SELECT * FROM (SELECT id,sender_empresa_id,sender,sender_name,body,created_at FROM public.hospital_share_messages WHERE share_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200) recent ORDER BY created_at ASC,id ASC",
      [req.params.id],
    );
    res.json(messages.rows);
  });
  r.post("/medlink/:id/messages", async (req, res) => {
    const u = getUser(req), b = req.body || {};
    if (!["admin", "gestor", "medico"].includes(u.funcao || ""))
      fail("A conversa MedLink requer autorização clínica.", 403);
    if (!uid(req.params.id) || !uid(b.requestId)) fail("Referência inválida.");
    const body = text(b.body, 4000);
    const share = await pool.query(
      "SELECT id FROM public.hospital_shares WHERE id=$1 AND revoked_at IS NULL AND (source_empresa_id=$2 OR target_empresa_id=$2)",
      [req.params.id, u.empresaId],
    );
    if (!share.rowCount) fail("Conversa indisponível.", 404);
    const existing = await pool.query(
      "SELECT id,body FROM public.hospital_share_messages WHERE share_id=$1 AND sender_empresa_id=$2 AND sender=$3 AND request_id=$4",
      [req.params.id, u.empresaId, u.username, b.requestId],
    );
    if (existing.rowCount) {
      if (existing.rows[0].body !== body) fail("Pedido reutilizado com outra mensagem.", 409);
      res.status(200).json({ id: existing.rows[0].id });
      return;
    }
    const inserted = await pool.query(
      "INSERT INTO public.hospital_share_messages(id,share_id,sender_empresa_id,sender,sender_name,body,request_id) SELECT $1,s.id,$3,$4,$5,$6,$7 FROM public.hospital_shares s WHERE s.id=$2 AND s.revoked_at IS NULL AND (s.source_empresa_id=$3 OR s.target_empresa_id=$3) ON CONFLICT (share_id,sender_empresa_id,sender,request_id) DO NOTHING RETURNING id",
      [randomUUID(), req.params.id, u.empresaId, u.username, (u.funcionarioNome || u.username).slice(0, 200), body, b.requestId],
    );
    if (!inserted.rowCount) {
      const prior = await pool.query(
        "SELECT id,body FROM public.hospital_share_messages WHERE share_id=$1 AND sender_empresa_id=$2 AND sender=$3 AND request_id=$4",
        [req.params.id, u.empresaId, u.username, b.requestId],
      );
      if (!prior.rowCount || prior.rows[0].body !== body) fail("A mensagem não foi aceite.", 409);
      res.json({ id: prior.rows[0].id });
      return;
    }
    await audit(pool, u.empresaId!, u.username, "medlink.message", String(req.params.id));
    res.status(201).json(inserted.rows[0]);
  });
  r.post("/medlink/:id/status", async (req, res) => {
    const u = getUser(req);
    if (!["admin", "gestor", "medico"].includes(u.funcao || ""))
      fail("Sem permissão para responder ao pedido.", 403);
    if (!uid(req.params.id)) fail("Partilha inválida.");
    const next = String(req.body?.status || "");
    const q = await pool.query(
      "SELECT id,request_type,status,source_empresa_id,target_empresa_id,revoked_at FROM public.hospital_shares WHERE id=$1 AND (source_empresa_id=$2 OR target_empresa_id=$2)",
      [req.params.id, u.empresaId],
    );
    const share = q.rows[0];
    if (!share || share.revoked_at) fail("Pedido indisponível.", 404);
    if (share.request_type === "partilha") fail("Esta operação é uma partilha, não um pedido.", 409);
    const isTarget = share.target_empresa_id === u.empresaId;
    const transitions: Record<string, string[]> = isTarget
      ? { pendente: ["aceite", "recusado"], aceite: ["em_execucao", "concluido"], em_execucao: ["concluido"] }
      : { pendente: ["cancelado"], aceite: ["cancelado"], em_execucao: ["cancelado"] };
    if (next === share.status) {
      res.json({ status: share.status });
      return;
    }
    if (!transitions[share.status]?.includes(next)) fail("Transição de estado não autorizada.", 403);
    const updated = await pool.query(
      "UPDATE public.hospital_shares SET status=$3 WHERE id=$1 AND (source_empresa_id=$2 OR target_empresa_id=$2) AND status=$4 AND revoked_at IS NULL RETURNING status",
      [share.id, u.empresaId, next, share.status],
    );
    if (!updated.rowCount) fail("O pedido foi alterado. Actualize a página.", 409);
    await audit(pool, u.empresaId!, u.username, "medlink.status." + next, String(share.id));
    res.json(updated.rows[0]);
  });
  r.get("/pharmacy", async (req, res) => {
    const u = getUser(req);
    const [p, m] = await Promise.all([
      pool.query(
        "SELECT * FROM public.hospital_pharmacy WHERE empresa_id=$1 ORDER BY name,expiry",
        [u.empresaId],
      ),
      pool.query(
        "SELECT * FROM public.hospital_pharmacy_moves WHERE empresa_id=$1 ORDER BY created_at DESC LIMIT 500",
        [u.empresaId],
      ),
    ]);
    res.json({ products: p.rows, movements: m.rows });
  });
  r.post("/pharmacy", async (req, res) => {
    const u = getUser(req),
      b = req.body;
    if (!["admin", "gestor", "farmaceutico"].includes(u.funcao || ""))
      fail("Sem permissão de farmácia.", 403);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.expiry || "")) fail("Validade inválida.");
    const q = await pool.query(
      "INSERT INTO public.hospital_pharmacy(id,empresa_id,code,name,lot,expiry,stock,minimum,price) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
      [
        randomUUID(),
        u.empresaId,
        text(b.code, 80),
        text(b.name, 200),
        text(b.lot, 100),
        b.expiry,
        n(b.stock),
        n(b.minimum),
        n(b.price),
      ],
    );
    await audit(
      pool,
      u.empresaId!,
      u.username,
      "pharmacy.create",
      q.rows[0].id,
    );
    res.status(201).json(q.rows[0]);
  });
  r.post("/pharmacy/move", async (req, res) => {
    const u = getUser(req),
      b = req.body;
    if (!["admin", "gestor", "farmaceutico"].includes(u.funcao || ""))
      fail("Sem permissão de farmácia.", 403);
    if (
      !uid(b.productId) ||
      !uid(b.requestId) ||
      !Number.isFinite(b.quantity) ||
      b.quantity === 0 ||
      Math.abs(b.quantity) > 1e8
    )
      fail("Movimento inválido.");
    const reason = text(b.reason, 1000),
      c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        u.empresaId,
      ]);
      const old = await c.query(
        "SELECT id FROM public.hospital_pharmacy_moves WHERE empresa_id=$1 AND request_id=$2",
        [u.empresaId, b.requestId],
      );
      if (old.rowCount) {
        await c.query("COMMIT");
        res.json({ ok: true, repetido: true });
        return;
      }
      const q = await c.query(
        "SELECT * FROM public.hospital_pharmacy WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
        [u.empresaId, b.productId],
      );
      const p = q.rows[0];
      if (!p || !p.active) fail("Produto indisponível.");
      if (Number(p.stock) + b.quantity < 0) fail("Stock insuficiente.", 409);
      if (
        b.quantity < 0 &&
        new Date(p.expiry).toISOString().slice(0, 10) <
          new Date().toISOString().slice(0, 10)
      )
        fail("Lote expirado.", 409);
      if (b.prescriptionId) {
        if (b.quantity >= 0) fail("Dispensa requer saída de stock.");
        const q = await c.query(
          "SELECT data,revision FROM public.hospital_state WHERE empresa_id=$1 AND namespace='clinical' FOR UPDATE",
          [u.empresaId],
        );
        const state = q.rows[0]?.data,
          rx = state?.prescriptions.find((x: any) => x.id === b.prescriptionId),
          item = rx?.items.find((x: any) => x.id === b.itemId);
        if (
          !rx ||
          !item ||
          rx.cancelled ||
          new Date(rx.validUntil) < new Date()
        )
          fail("Prescrição indisponível.", 409);
        if (!medicineKey(item.name) || medicineKey(item.name) !== medicineKey(p.name))
          fail("O produto seleccionado não corresponde ao medicamento prescrito.", 409);
        const used = state.deliveries
          .filter(
            (x: any) => x.prescriptionId === rx.id && x.itemId === item.id,
          )
          .reduce((sum: number, x: any) => sum + Number(x.quantity), 0);
        if (used - b.quantity > item.quantity)
          fail("Quantidade superior ao prescrito.", 409);
        state.deliveries.push({
          id: randomUUID(),
          prescriptionId: rx.id,
          itemId: item.id,
          quantity: -b.quantity,
          lot: p.lot,
          expiry: new Date(p.expiry).toISOString().slice(0, 10),
          author: u.username,
          created: new Date().toISOString(),
          note: reason,
        });
        await c.query(
          "UPDATE public.hospital_state SET data=$2,revision=revision+1,updated_at=now() WHERE empresa_id=$1 AND namespace='clinical'",
          [u.empresaId, JSON.stringify(state)],
        );
      }
      await c.query(
        "UPDATE public.hospital_pharmacy SET stock=stock+$3 WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, b.productId, b.quantity],
      );
      await c.query(
        "INSERT INTO public.hospital_pharmacy_moves(id,empresa_id,product_id,quantity,reason,prescription_id,item_id,actor,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          randomUUID(),
          u.empresaId,
          p.id,
          b.quantity,
          reason,
          b.prescriptionId || null,
          b.itemId || null,
          u.username,
          b.requestId,
        ],
      );
      await audit(c, u.empresaId!, u.username, "pharmacy.move", p.id);
      await c.query("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });
  r.post("/patient-registration", async (req, res) => {
    const u = getUser(req),
      b = req.body || {},
      p = b.patient || {},
      a = b.administration;
    if (
      ![
        "admin",
        "gestor",
        "rececionista",
        "medico",
        "tecnico",
        "enfermeiro",
      ].includes(u.funcao || "")
    )
      fail("Sem permissão para cadastrar pacientes.", 403);
    if (
      !p.nome ||
      typeof p.nome !== "string" ||
      !a ||
      ![
        "particular",
        "assegurado",
        "empresa",
        "convenio",
        "funcionario",
        "isento",
      ].includes(a.tipo) ||
      Object.values(a).some((v) => typeof v !== "string" || v.length > 5000)
    )
      fail("Cadastro inválido.");
    if (
      !Number.isFinite(Number(a.cobertura)) ||
      Number(a.cobertura) < 0 ||
      Number(a.cobertura) > 100
    )
      fail("Cobertura inválida.");
    const allowed = [
      "nome",
      "nasc",
      "sexo",
      "idade",
      "bi",
      "nif",
      "nacionalidade",
      "estadoCivil",
      "profissao",
      "telefone",
      "telefone2",
      "email",
      "endereco",
      "grupoSanguineo",
      "fatorRh",
      "alergias",
      "patologiasCronicas",
      "medicacaoHabitual",
      "contactoEmergenciaNome",
      "contactoEmergenciaTel",
      "empresa",
      "medico",
      "recolha",
      "passaporte",
      "observacoes",
    ];
    const entries = allowed
      .filter((k) => p[k] !== undefined)
      .map((k) => [k, String(p[k])]);
    if (entries.some(([, v]) => v.length > 5000))
      fail("Campo demasiado longo.");
    const columns = entries.map(([k]) =>
      k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()),
    );
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        "patient:" + u.empresaId,
      ]);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["billing:"+u.empresaId]);
      const duplicate = await c.query(
        "SELECT id FROM public.pacientes WHERE empresa_id=$1 AND id<>$2 AND $3<>'' AND upper(regexp_replace(bi,'[[:space:]]','','g'))=upper(regexp_replace($3,'[[:space:]]','','g'))",
        [u.empresaId, b.id || 0, p.bi || ""],
      );
      if (duplicate.rowCount)
        fail("Documento já cadastrado nesta instituição.", 409);
      let patient;
      if (b.id) {
        if (!Number.isSafeInteger(b.id)) fail("Paciente inválido.");
        const q = await c.query(
          `UPDATE public.pacientes SET ${columns.map((col, i) => '"' + col + '"=$' + (i + 3)).join(",")} WHERE id=$1 AND empresa_id=$2 RETURNING *`,
          [b.id, u.empresaId, ...entries.map(([, v]) => v)],
        );
        patient = q.rows[0];
        if (!patient) fail("Paciente não encontrado nesta instituição.", 404);
      } else {
        const q = await c.query(
          `INSERT INTO public.pacientes(empresa_id,${columns.map((col) => '"' + col + '"').join(",")}) VALUES($1,${entries.map((_, i) => "$" + (i + 2)).join(",")}) RETURNING *`,
          [u.empresaId, ...entries.map(([, v]) => v)],
        );
        patient = q.rows[0];
      }
      const old = await c.query(
        "SELECT id,revision FROM public.hospital_records WHERE empresa_id=$1 AND kind='patient-admin' AND data->>'patientId'=$2 FOR UPDATE",
        [u.empresaId, String(patient.id)],
      );
      const row = old.rows[0];
      if ((row?.revision || 0) !== (b.adminRevision || 0))
        fail(
          "A classificação foi alterada noutro posto. Reabra o paciente antes de guardar.",
          409,
        );
      await syncRegistrationInsurance(c,u.empresaId!,u.username,patient,a);
      if (b.geography !== undefined) await savePatientGeography(c,u.empresaId!,u.username,patient.id,b.geography);
      const recordId = row?.id || randomUUID();
      const q = await c.query(
        "INSERT INTO public.hospital_records(id,empresa_id,kind,data,created_by) VALUES($1,$2,'patient-admin',$3,$4) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=hospital_records.revision+1,updated_at=now() RETURNING revision",
        [
          recordId,
          u.empresaId,
          JSON.stringify({
            patientId: patient.id,
            processo: patient.processo,
            administration: a,
          }),
          u.username,
        ],
      );
      await audit(
        c,
        u.empresaId!,
        u.username,
        "patient.registration",
        String(patient.id),
      );
      await c.query("COMMIT");
      res.json({ patient, adminRevision: q.rows[0].revision });
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });

  const recordRoles: Record<string, string[]> = {
    "patient-admin": [
      "admin",
      "gestor",
      "rececionista",
      "medico",
      "tecnico",
      "enfermeiro",
    ],
    payroll: ["admin", "gestor", "financeiro"],
    fees: ["admin", "gestor", "financeiro"],
    purchases: ["admin", "gestor"],
    insurance: ["admin", "gestor", "financeiro", "rececionista"],
    imaging: ["admin", "gestor", "medico", "tecnico"],
  };
  r.get("/records/:kind", async (req, res) => {
    const u = getUser(req),
      kind = String(req.params.kind);
    const readRoles =
      kind === "insurance"
        ? [
            "admin",
            "gestor",
            "rececionista",
            "financeiro",
            "medico",
            "tecnico",
            "enfermeiro",
          ]
        : recordRoles[kind];
    if (
      !Object.hasOwn(recordRoles, kind) ||
      !readRoles.includes(u.funcao || "")
    )
      fail("Sem permissão.", 403);
    const q = await pool.query(
      "SELECT id,data,revision,created_at,updated_at FROM public.hospital_records WHERE empresa_id=$1 AND kind=$2 ORDER BY created_at DESC",
      [u.empresaId, kind],
    );
    res.json(q.rows);
  });
  r.post("/records/:kind", async (req, res) => {
    const u = getUser(req),
      kind = String(req.params.kind),
      b = req.body;
    if (["payroll","fees"].includes(kind)) fail("Utilize Serviços hospitalares → Recursos humanos → Folha de salários. Os registos antigos permanecem disponíveis para consulta.",409);
    if (kind === "patient-admin")
      fail("Utilize o cadastro transaccional.", 403);
    if (
      !Object.hasOwn(recordRoles, kind) ||
      !recordRoles[kind].includes(u.funcao || "")
    )
      fail("Sem permissão.", 403);
    if (
      !uid(b.id) ||
      !b.data ||
      typeof b.data !== "object" ||
      JSON.stringify(b.data).length > 1000000
    )
      fail("Registo inválido.");
    for (const [k, v] of Object.entries(b.data))
      if (
        ["amount", "base", "extras", "deductions", "quantity", "cost"].includes(
          k,
        ) &&
        (!Number.isFinite(Number(v)) || Number(v) < 0)
      )
        fail("Valor numérico inválido.");
    if (b.data.patientId) {
      const q = await pool.query(
        "SELECT 1 FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, Number(b.data.patientId)],
      );
      if (!q.rowCount) fail("Paciente de outra instituição.", 403);
    }
    const q = await pool.query(
      "INSERT INTO public.hospital_records(id,empresa_id,kind,data,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=hospital_records.revision+1,updated_at=now() WHERE hospital_records.empresa_id=$2 AND hospital_records.kind=$3 AND hospital_records.revision=$6 RETURNING id,data,revision",
      [
        b.id,
        u.empresaId,
        kind,
        JSON.stringify(b.data),
        u.username,
        b.revision || 0,
      ],
    );
    if (!q.rowCount) fail("O registo mudou noutro posto.", 409);
    await audit(pool, u.empresaId!, u.username, "records." + kind, b.id);
    res.json(q.rows[0]);
  });

  r.use((e: any, _req: any, res: any, _next: any) => {
    const status =
      (e instanceof HttpError || e instanceof DomainError)
        ? e.status
        : e.code === "23503"
          ? 403
          : e.code === "23505"
            ? 409
            : 500;
    res.status(status).json({
      error:
        status === 500
          ? "Falha no servidor; a operação não foi confirmada."
          : (e instanceof HttpError || e instanceof DomainError)
            ? e.message
            : status === 409
              ? "Registo já existente."
              : "Referência não pertence à instituição.",
    });
  });
  return r;
}
export default createHospitalRouter();

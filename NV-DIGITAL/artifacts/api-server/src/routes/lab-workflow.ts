import { Router } from "express";
import { createLabReportsRouter } from "./lab-reports.js";
import { randomUUID, createHash } from "node:crypto";
import { pool as productionPool } from "@workspace/db";
import { getUser, requireEmpresa } from "../lib/auth.js";
import {
  allowed,
  apiErrors,
  deny,
  episode,
  event,
  granted,
  patient,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";
import type { Pool } from "pg";
const LAB = ["admin", "gestor", "tecnico"];
const CARE = [...LAB, "medico", "enfermeiro"];
const clean = (s: string) => s.trim().normalize("NFKC").toLocaleLowerCase("pt");
function catalogData(d: any) {
  if (!d || typeof d !== "object") deny("Ficha do catálogo inválida.");
  const out: any = {};
  for (const field of [
    "name",
    "sector",
    "material",
    "container",
    "preparation",
    "transport",
    "stability",
    "method",
    "unit",
    "reference",
    "rejection",
    "protocol",
  ])
    out[field] = value(d[field], field === "reference" ? 3000 : 1500);
  for (const field of ["minVolume", "tatHours", "retentionDays"]) {
    out[field] = Number(d[field]);
    if (!Number.isFinite(out[field]) || out[field] < 0 || out[field] > 100000)
      deny("Volume, prazo ou retenção inválidos.");
  }
  for (const field of ["criticalLow", "criticalHigh"]) {
    out[field] = d[field] === "" || d[field] == null ? null : Number(d[field]);
    if (out[field] !== null && !Number.isFinite(out[field]))
      deny("Limite crítico inválido.");
  }
  if (
    out.criticalLow !== null &&
    out.criticalHigh !== null &&
    out.criticalLow >= out.criticalHigh
  )
    deny("Limites críticos incompatíveis.");
  out.qcRequired = d.qcRequired === true;
  out.requiresClinical = d.requiresClinical !== false;
  return out;
}
async function identification(c: any, org: string, order: any, d: any) {
  await patient(c, org, order.patient_id);
  const p = order.patient_snapshot;
  if (
    clean(value(d.identity1, 200)) !== clean(p.nome) ||
    ![String(p.id), p.processo, p.nasc]
      .filter(Boolean)
      .some((x: string) => clean(x) === clean(value(d.identity2, 100)))
  )
    deny(
      "Identificação divergente. Confirme nome e segundo identificador do paciente.",
      409,
    );
  return p;
}
export function createLabWorkflow(pool: Pool = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use(createLabReportsRouter(pool));
  r.get("/numbering", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    const row = (
      await pool.query(
        "SELECT coalesce(n.prefix,public.nv_lab_default_prefix(e.nome)) AS prefix FROM public.empresas e LEFT JOIN public.nv_lab_numbering n ON n.empresa_id=e.id WHERE e.id=$1",
        [u.empresaId],
      )
    ).rows[0];
    if (!row) deny("Instituição indisponível.", 404);
    res.json({
      prefix: row.prefix,
      canEdit: ["admin", "gestor"].includes(u.funcao || ""),
    });
  });
  r.put("/numbering", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const prefix = value(req.body.prefix, 10).toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(prefix))
      deny("Use 2 a 10 letras ou números, começando por uma letra.");
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const old = (
        await c.query(
          "SELECT prefix FROM public.nv_lab_numbering WHERE empresa_id=$1 FOR UPDATE",
          [u.empresaId],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO public.nv_lab_numbering(empresa_id,prefix) VALUES($1,$2) ON CONFLICT(empresa_id) DO UPDATE SET prefix=excluded.prefix",
        [u.empresaId, prefix],
      );
      if (old?.prefix !== prefix)
        await event(c, u, "lab.numbering", u.empresaId!, { prefix });
      return { prefix, canEdit: true };
    });
    res.json(result);
  });
  r.get("/catalog", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    res.json(
      (
        await pool.query(
          "SELECT * FROM public.nv_lab_catalog WHERE empresa_id=$1 ORDER BY code,version DESC",
          [u.empresaId],
        )
      ).rows,
    );
  });
  r.post("/catalog", async (req, res) => {
    const u = getUser(req);
    allowed(u, LAB);
    const d = req.body;
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const localCode = value(d.code, 40).toUpperCase();
      if (!/^[A-Z0-9_.-]+$/.test(localCode))
        deny(
          "Use um código sem espaços, apenas letras, números, ponto, hífen ou sublinhado.",
        );
      const version = Number(
        (
          await c.query(
            "SELECT coalesce(max(version),0)+1 AS v FROM public.nv_lab_catalog WHERE empresa_id=$1 AND code=$2",
            [u.empresaId, localCode],
          )
        ).rows[0].v,
      );
      const row = (
        await c.query(
          "INSERT INTO public.nv_lab_catalog(id,empresa_id,code,version,data,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [
            randomUUID(),
            u.empresaId,
            localCode,
            version,
            catalogData(d.data),
            u.username,
          ],
        )
      ).rows[0];
      await event(c, u, "catalog.draft", row.id, { code: localCode, version });
      return row;
    });
    res.status(201).json(result);
  });
  r.post("/catalog/:id/approve", async (req, res) => {
    const u = getUser(req);
    allowed(u, LAB);
    const result = await transaction(pool, u.empresaId!, async (c) => {
      await granted(c, u, "lab.catalog.approve");
      const row =
        (
          await c.query(
            "SELECT * FROM public.nv_lab_catalog WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
            [u.empresaId, uuid(req.params.id)],
          )
        ).rows[0] || deny("Teste inexistente.", 404);
      if (row.created_by === u.username)
        deny("O autor do catálogo não pode aprovar a própria versão.", 403);
      const settings = (
        await c.query(
          "SELECT data FROM public.nv_settings WHERE empresa_id=$1",
          [u.empresaId],
        )
      ).rows[0]?.data;
      if (!settings?.labSectors?.includes(row.data.sector))
        deny(
          "Active este sector na configuração institucional antes de aprovar o catálogo.",
          409,
        );
      if (row.approved_at || row.retired_at)
        deny("A versão já foi aprovada ou retirada.", 409);
      value(req.body.reason, 1000);
      await c.query(
        "UPDATE public.nv_lab_catalog SET retired_at=now() WHERE empresa_id=$1 AND code=$2 AND approved_at IS NOT NULL AND retired_at IS NULL",
        [u.empresaId, row.code],
      );
      await c.query(
        "UPDATE public.nv_lab_catalog SET approved_by=$3,approved_at=now() WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, row.id, u.username],
      );
      await event(c, u, "catalog.approve", row.id, { version: row.version });
      return { ok: true };
    });
    res.json(result);
  });
  r.get("/orders", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    const page = Math.max(0, Math.min(100000, Number(req.query.page) || 0)),
      search = String(req.query.q || "")
        .trim()
        .slice(0, 200);
    if (!Number.isInteger(page)) deny("Página inválida.");
    const rows = (
      await pool.query(
        `SELECT o.*,o.patient_snapshot->>'nome' AS patient_name,o.patient_snapshot->>'processo' AS processo,o.patient_snapshot->>'nasc' AS nasc,(SELECT count(*) FROM public.nv_lab_containers s WHERE s.empresa_id=o.empresa_id AND s.order_id=o.id) AS containers FROM public.nv_lab_orders o JOIN public.pacientes p ON p.empresa_id=o.empresa_id AND p.id=o.patient_id WHERE o.empresa_id=$1 AND ($2='' OR p.nome ILIKE '%'||$2||'%' OR p.processo ILIKE '%'||$2||'%' OR o.patient_snapshot->>'processo' ILIKE '%'||$2||'%' OR o.accession ILIKE '%'||$2||'%' OR EXISTS(SELECT 1 FROM public.nv_lab_containers s WHERE s.empresa_id=o.empresa_id AND s.order_id=o.id AND s.code ILIKE '%'||$2||'%')) ORDER BY o.created_at DESC LIMIT 50 OFFSET $3`,
        [u.empresaId, search, page * 50],
      )
    ).rows;
    res.json(rows);
  });
  r.post("/orders", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor", "medico", "enfermeiro"]);
    const d = req.body,
      requestId = uuid(d.requestId);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          Number(d.patientId),
          d.episodeId || null,
          [...(d.tests || [])].sort(),
          d.priority,
          d.origin,
          d.indication,
        ]),
      )
      .digest("hex");
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const prior = (
        await c.query(
          "SELECT * FROM public.nv_lab_orders WHERE empresa_id=$1 AND created_by=$2 AND request_id=$3",
          [u.empresaId, u.username, requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.patient_id !== Number(d.patientId) ||
          prior.request_hash !== fingerprint
        )
          deny("O identificador de reenvio pertence a outro pedido.", 409);
        return prior;
      }
      const patientSnapshot = await patient(c, u.empresaId!, d.patientId);
      const ep = await episode(
        c,
        u.empresaId!,
        d.episodeId,
        Number(d.patientId),
      );
      const ids = Array.isArray(d.tests) ? [...new Set(d.tests.map(uuid))] : [];
      if (!ids.length || ids.length > 30)
        deny("Seleccione entre 1 e 30 análises aprovadas.");
      const catalog = (
        await c.query(
          "SELECT * FROM public.nv_lab_catalog WHERE empresa_id=$1 AND id=ANY($2::uuid[]) AND approved_at IS NOT NULL AND retired_at IS NULL",
          [u.empresaId, ids],
        )
      ).rows;
      if (catalog.length !== ids.length)
        deny(
          "Uma análise não pertence ao catálogo aprovado da instituição.",
          409,
        );
      const priority = value(d.priority, 20);
      if (!["rotina", "urgente", "emergente"].includes(priority))
        deny("Prioridade inválida.");
      const id = randomUUID();
      const order = (
        await c.query(
          "INSERT INTO public.nv_lab_orders(id,empresa_id,patient_id,episode_id,accession,priority,indication,origin,created_by,request_id,patient_snapshot,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
          [
            id,
            u.empresaId,
            Number(d.patientId),
            ep,
            "", // allocated by the database for this company
            priority,
            value(d.indication),
            value(d.origin, 200),
            u.username,
            requestId,
            patientSnapshot,
            fingerprint,
          ],
        )
      ).rows[0];
      // One physical container per test. Combining tests is never assumed from cap colour alone.
      for (const t of catalog) {
        const testId = randomUUID(),
          containerId = randomUUID();
        await c.query(
          "INSERT INTO public.nv_lab_tests(id,empresa_id,order_id,catalog_id,snapshot) VALUES($1,$2,$3,$4,$5)",
          [
            testId,
            u.empresaId,
            id,
            t.id,
            { ...t.data, code: t.code, version: t.version },
          ],
        );
        await c.query(
          "INSERT INTO public.nv_lab_containers(id,empresa_id,order_id,sample_id,code,material,container,location) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            containerId,
            u.empresaId,
            id,
            randomUUID(),
            "", // allocated by the database for this company
            t.data.material,
            t.data.container,
            order.origin,
          ],
        );
        await c.query(
          "INSERT INTO public.nv_lab_container_tests(empresa_id,container_id,test_id) VALUES($1,$2,$3)",
          [u.empresaId, containerId, testId],
        );
      }
      await event(c, u, "lab.order", id, {
        patientId: order.patient_id,
        count: catalog.length,
      });
      return order;
    });
    res.status(201).json(result);
  });
  r.get("/orders/:id", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    const id = uuid(req.params.id);
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const order =
        (
          await c.query(
            "SELECT o.*,o.patient_snapshot->>'nome' AS patient_name,o.patient_snapshot->>'processo' AS processo,o.patient_snapshot->>'nasc' AS nasc FROM public.nv_lab_orders o JOIN public.pacientes p ON p.id=o.patient_id AND p.empresa_id=o.empresa_id WHERE o.empresa_id=$1 AND o.id=$2",
            [u.empresaId, id],
          )
        ).rows[0] || deny("Pedido não disponível.", 404);
      const containers = (
        await c.query(
          "SELECT s.*,coalesce((SELECT jsonb_agg(ct.test_id) FROM public.nv_lab_container_tests ct WHERE ct.empresa_id=s.empresa_id AND ct.container_id=s.id),'[]') AS test_ids FROM public.nv_lab_containers s WHERE s.empresa_id=$1 AND s.order_id=$2 ORDER BY s.created_at",
          [u.empresaId, id],
        )
      ).rows;
      const tests = (
        await c.query(
          "SELECT * FROM public.nv_lab_tests WHERE empresa_id=$1 AND order_id=$2",
          [u.empresaId, id],
        )
      ).rows;
      const values = (
        await c.query(
          "SELECT v.* FROM public.nv_lab_values v JOIN public.nv_lab_tests t ON t.id=v.test_id AND t.empresa_id=v.empresa_id WHERE v.empresa_id=$1 AND t.order_id=$2 ORDER BY version DESC",
          [u.empresaId, id],
        )
      ).rows;
      const events = (
        await c.query(
          "SELECT e.* FROM public.nv_lab_events e JOIN public.nv_lab_containers s ON s.id=e.container_id AND s.empresa_id=e.empresa_id WHERE e.empresa_id=$1 AND s.order_id=$2 ORDER BY e.created_at",
          [u.empresaId, id],
        )
      ).rows;
      const communications = (
        await c.query(
          "SELECT cm.* FROM public.nv_lab_communications cm JOIN public.nv_lab_values v ON v.id=cm.value_id AND v.empresa_id=cm.empresa_id JOIN public.nv_lab_tests t ON t.id=v.test_id AND t.empresa_id=v.empresa_id WHERE cm.empresa_id=$1 AND t.order_id=$2 ORDER BY cm.created_at",
          [u.empresaId, id],
        )
      ).rows;
      await event(c, u, "lab.read", id);
      return { order, containers, tests, values, events, communications };
    });
    res.json(result);
  });
  r.get(["/scan", "/scan/:code", "/scan/:prefix/:number"], async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    const code =
      req.params.code ||
      (req.params.prefix && req.params.number
        ? `${req.params.prefix}/${req.params.number}`
        : req.query.code);
    const row =
      (
        await pool.query(
          "SELECT id,order_id,code,status,revision FROM public.nv_lab_containers WHERE empresa_id=$1 AND code=$2",
          [u.empresaId, value(code, 80)],
        )
      ).rows[0] || deny("Código não encontrado nesta instituição.", 404);
    res.json(row);
  });
  r.post("/orders/:id/cancel", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor", "medico"]);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const id = uuid(req.params.id),
          reason = value(req.body.reason);
        const o =
          (
            await c.query(
              "SELECT * FROM public.nv_lab_orders WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
              [u.empresaId, id],
            )
          ).rows[0] || deny("Pedido inexistente.", 404);
        if (o.cancelled_at) return { ok: true };
        const collected = await c.query(
          "SELECT 1 FROM public.nv_lab_containers WHERE empresa_id=$1 AND order_id=$2 AND collected_at IS NOT NULL",
          [u.empresaId, id],
        );
        if (collected.rowCount)
          deny(
            "Há recipientes colhidos. Registe a decisão e o destino de cada amostra.",
            409,
          );
        await c.query(
          "UPDATE public.nv_lab_orders SET cancelled_at=now(),cancel_reason=$3 WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, id, reason],
        );
        await event(c, u, "lab.cancel", id);
        return { ok: true };
      }),
    );
  });
  r.post("/containers/:id/action", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    const d = req.body,
      action = value(d.action, 40),
      requestId = uuid(d.requestId);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const id = uuid(req.params.id),
          prior = (
            await c.query(
              "SELECT * FROM public.nv_lab_events WHERE empresa_id=$1 AND request_id=$2",
              [u.empresaId, requestId],
            )
          ).rows[0];
        if (prior) {
          if (prior.container_id !== id || prior.action !== action)
            deny("Identificador de reenvio já utilizado.", 409);
          return {
            ok: true,
            repeated: true,
            derivedId: prior.details?.derivedId,
          };
        }
        const s =
          (
            await c.query(
              "SELECT * FROM public.nv_lab_containers WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
              [u.empresaId, id],
            )
          ).rows[0] || deny("Recipiente não disponível.", 404);
        if (s.revision !== d.revision)
          deny("O recipiente foi alterado noutro posto. Actualize.", 409);
        const o = (
          await c.query(
            "SELECT * FROM public.nv_lab_orders WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
            [u.empresaId, s.order_id],
          )
        ).rows[0];
        if (o.cancelled_at) deny("Pedido cancelado.", 409);
        if (
          ![
            "colher",
            "imprimir",
            "etiquetar",
            "transportar",
            "receber",
          ].includes(action)
        )
          allowed(u, LAB);
        const details: any = {
          note: value(d.note, 2000, true),
          location: value(d.location, 200, true),
        };
        let state = s.status,
          derivedId: string | undefined;
        if (["colher", "imprimir", "etiquetar", "receber"].includes(action))
          await identification(c, u.empresaId!, o, d);
        if (action === "colher") {
          if (s.status !== "por_colher")
            deny("Esta amostra já foi colhida ou encerrada.", 409);
          details.location = value(d.location, 200);
          details.site = value(d.site, 300);
          state = "colhida";
          await c.query(
            "UPDATE public.nv_lab_containers SET collected_at=now(),collected_by=$3 WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, id, u.username],
          );
        } else if (action === "imprimir") {
          if (!s.collected_at || ["rejeitada", "descartada"].includes(s.status))
            deny("Imprima junto do paciente após registar a colheita.", 409);
          details.printer = value(d.printer, 200);
          details.copy = s.print_count + 1;
          if (s.print_count > 0) {
            details.note = value(d.note);
            if (d.destroyPrevious !== true)
              deny("Confirme a inutilização da etiqueta anterior.");
          }
          await c.query(
            "UPDATE public.nv_lab_containers SET print_count=print_count+1 WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, id],
          );
        } else if (action === "etiquetar") {
          if (s.status !== "colhida" || s.print_count < 1 || d.scan !== s.code)
            deny("Leia a etiqueta correcta após o pedido de impressão.", 409);
          state = "etiquetada";
        } else if (action === "transportar") {
          if (
            !["etiquetada", "aceite", "aceite_ressalva", "armazenada"].includes(
              state,
            )
          )
            deny("A amostra não pode sair deste estado.", 409);
          details.destination = value(d.destination, 200);
          details.conditions = value(d.conditions);
          details.location = value(d.location, 200);
          state = "em_transporte";
        } else if (action === "receber") {
          if (
            !["etiquetada", "em_transporte"].includes(state) ||
            d.scan !== s.code
          )
            deny(
              "Leitura divergente, recipiente já recebido ou estado incompatível.",
              409,
            );
          details.location = value(d.location, 200);
          details.conditions = value(d.conditions);
          details.temperature = value(d.temperature, 100);
          state = "recebida";
          await c.query(
            "UPDATE public.nv_lab_containers SET received_at=now() WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, id],
          );
        } else if (
          ["aceitar", "aceitar_ressalva", "rejeitar"].includes(action)
        ) {
          if (!["recebida", "quarentena"].includes(state))
            deny("A amostra tem de ser recebida e conferida.", 409);
          details.volume = Number(d.volume);
          if (!Number.isFinite(details.volume) || details.volume < 0)
            deny("Registe o volume conferido.");
          const tests = (
            await c.query(
              "SELECT t.snapshot FROM public.nv_lab_tests t JOIN public.nv_lab_container_tests ct ON ct.test_id=t.id AND ct.empresa_id=t.empresa_id WHERE ct.empresa_id=$1 AND ct.container_id=$2",
              [u.empresaId, id],
            )
          ).rows;
          const inadequate = tests.some(
            (t: any) => details.volume < t.snapshot.minVolume,
          );
          if (
            action === "aceitar" &&
            (inadequate ||
              d.containerConfirmed !== true ||
              d.conditionsConfirmed !== true)
          )
            deny(
              "Requisitos de volume, recipiente ou transporte não confirmados. Use rejeição ou ressalva autorizada.",
              409,
            );
          if (action !== "aceitar") details.note = value(d.note);
          if (action === "aceitar_ressalva")
            await granted(c, u, "lab.exception");
          details.serviceNotified = value(
            d.serviceNotified,
            200,
            action === "aceitar",
          );
          state =
            action === "rejeitar"
              ? "rejeitada"
              : action === "aceitar"
                ? "aceite"
                : "aceite_ressalva";
        } else if (action === "processar") {
          if (!["aceite", "aceite_ressalva"].includes(state))
            deny("A amostra precisa de aceitação antes da análise.", 409);
          details.equipment = value(d.equipment, 200);
          details.reagentLot = value(d.reagentLot, 200);
          state = "em_processamento";
        } else if (action === "quarentena") {
          if (["por_colher", "descartada", "rejeitada"].includes(state))
            deny("Estado incompatível.", 409);
          details.note = value(d.note);
          state = "quarentena";
        } else if (action === "recolher" || action === "aliquota") {
          if (action === "recolher" && state !== "rejeitada")
            deny("Nova colheita exige a rejeição da amostra anterior.", 409);
          if (
            action === "aliquota" &&
            ![
              "aceite",
              "aceite_ressalva",
              "em_processamento",
              "armazenada",
            ].includes(state)
          )
            deny("Amostra-mãe não está apta para derivação.", 409);
          details.note = value(d.note);
          derivedId = randomUUID();
          details.derivedId = derivedId;
          const child = await c.query(
            "INSERT INTO public.nv_lab_containers(id,empresa_id,order_id,sample_id,parent_id,code,material,container,location,status,collected_at,collected_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING code",
            [
              derivedId,
              u.empresaId,
              o.id,
              action === "aliquota" ? s.sample_id : randomUUID(),
              id,
              "",
              s.material,
              action === "aliquota" ? value(d.container, 200) : s.container,
              value(d.location, 200),
              action === "aliquota" ? "colhida" : "por_colher",
              action === "aliquota" ? s.collected_at : null,
              action === "aliquota" ? s.collected_by : null,
            ],
          );
          details.code = child.rows[0].code;
          await c.query(
            "INSERT INTO public.nv_lab_container_tests(empresa_id,container_id,test_id) SELECT empresa_id,$3,test_id FROM public.nv_lab_container_tests WHERE empresa_id=$1 AND container_id=$2",
            [u.empresaId, id, derivedId],
          );
        } else if (action === "armazenar") {
          if (state !== "em_processamento")
            deny("Armazenamento exige processamento concluído.", 409);
          const pending = await c.query(
            "SELECT 1 FROM public.nv_lab_container_tests ct WHERE ct.empresa_id=$1 AND ct.container_id=$2 AND NOT EXISTS(SELECT 1 FROM public.nv_lab_values v WHERE v.empresa_id=ct.empresa_id AND v.test_id=ct.test_id AND v.released_at IS NOT NULL AND v.version=(SELECT max(v2.version) FROM public.nv_lab_values v2 WHERE v2.empresa_id=v.empresa_id AND v2.test_id=v.test_id))",
            [u.empresaId, id],
          );
          if (pending.rowCount)
            deny("Há análises sem versão final validada.", 409);
          details.location = value(d.location, 200);
          state = "armazenada";
        } else if (action === "descartar") {
          if (!["armazenada", "rejeitada"].includes(state))
            deny("Só pode descartar amostras armazenadas ou rejeitadas.", 409);
          const retention = (
            await c.query(
              "SELECT max((t.snapshot->>'retentionDays')::numeric) AS days FROM public.nv_lab_tests t JOIN public.nv_lab_container_tests ct ON ct.test_id=t.id AND ct.empresa_id=t.empresa_id WHERE ct.empresa_id=$1 AND ct.container_id=$2",
              [u.empresaId, id],
            )
          ).rows[0].days;
          if (
            state !== "rejeitada" &&
            Date.now() <
              new Date(s.collected_at).getTime() + Number(retention) * 86400000
          )
            deny("Prazo de retenção do catálogo ainda não cumprido.", 409);
          details.note = value(d.note);
          details.destination = value(d.destination, 200);
          state = "descartada";
        } else deny("Acção não reconhecida.");
        await c.query(
          "UPDATE public.nv_lab_containers SET status=$3,revision=revision+1,location=CASE WHEN $4='' THEN location ELSE $4 END WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, id, state, details.location || ""],
        );
        await c.query(
          "INSERT INTO public.nv_lab_events(id,empresa_id,container_id,actor,action,details,request_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            randomUUID(),
            u.empresaId,
            id,
            u.username,
            action,
            { ...details, from: s.status, to: state },
            requestId,
          ],
        );
        await event(c, u, "lab." + action, id, { from: s.status, to: state });
        return { ok: true, derivedId };
      }),
    );
  });
  r.get("/quality", async (req, res) => {
    const u = getUser(req);
    allowed(u, LAB);
    res.json(
      (
        await pool.query(
          "SELECT * FROM public.nv_quality WHERE empresa_id=$1 ORDER BY created_at DESC LIMIT 200",
          [u.empresaId],
        )
      ).rows,
    );
  });
  r.post("/quality", async (req, res) => {
    const u = getUser(req);
    allowed(u, LAB);
    const d = req.body;
    res.status(201).json(
      await transaction(pool, u.empresaId!, async (c) => {
        await granted(c, u, "lab.quality");
        const until = new Date(d.validUntil);
        if (!Number.isFinite(until.getTime()) || until.getTime() <= Date.now())
          deny("Indique a validade futura deste controlo.");
        if (!["aprovado", "reprovado", "bloqueado"].includes(d.outcome))
          deny("Estado inválido.");
        const row = (
          await c.query(
            "INSERT INTO public.nv_quality(id,empresa_id,sector,equipment,reagent_lot,outcome,note,valid_until,actor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
            [
              randomUUID(),
              u.empresaId,
              value(d.sector, 200),
              value(d.equipment, 200),
              value(d.reagentLot, 200),
              d.outcome,
              value(d.note),
              until.toISOString(),
              u.username,
            ],
          )
        ).rows[0];
        await event(c, u, "lab.quality", row.id, { outcome: d.outcome });
        return row;
      }),
    );
  });
  r.post("/tests/:id/values", async (req, res) => {
    const u = getUser(req);
    allowed(u, LAB);
    const d = req.body;
    res.status(201).json(
      await transaction(pool, u.empresaId!, async (c) => {
        const testId = uuid(req.params.id),
          requestId = uuid(d.requestId);
        const prior = (
          await c.query(
            "SELECT * FROM public.nv_lab_values WHERE empresa_id=$1 AND request_id=$2",
            [u.empresaId, requestId],
          )
        ).rows[0];
        if (prior) {
          if (
            prior.test_id !== testId ||
            prior.container_id !== d.containerId ||
            prior.data.measured !== d.measured?.trim() ||
            prior.reason !== (d.reason?.trim() || "")
          )
            deny("Reenvio de outra análise ou conteúdo.", 409);
          return prior;
        }
        const t =
          (
            await c.query(
              "SELECT t.*,o.cancelled_at FROM public.nv_lab_tests t JOIN public.nv_lab_orders o ON o.id=t.order_id AND o.empresa_id=t.empresa_id WHERE t.empresa_id=$1 AND t.id=$2 FOR UPDATE",
              [u.empresaId, testId],
            )
          ).rows[0] || deny("Análise inexistente.", 404);
        if (t.cancelled_at) deny("Pedido cancelado.", 409);
        const s = (
          await c.query(
            "SELECT s.* FROM public.nv_lab_containers s JOIN public.nv_lab_container_tests ct ON ct.container_id=s.id AND ct.empresa_id=s.empresa_id WHERE s.empresa_id=$1 AND s.id=$2 AND ct.test_id=$3",
            [u.empresaId, uuid(d.containerId), testId],
          )
        ).rows[0];
        if (!s || s.status !== "em_processamento")
          deny("Recipiente não está em processamento para esta análise.", 409);
        const last = (
          await c.query(
            "SELECT * FROM public.nv_lab_values WHERE empresa_id=$1 AND test_id=$2 ORDER BY version DESC LIMIT 1",
            [u.empresaId, testId],
          )
        ).rows[0];
        if ((last?.version || 0) !== d.previousVersion)
          deny("Já existe uma versão mais recente. Actualize.", 409);
        const measured = value(d.measured, 4000),
          numeric = Number(measured.replace(",", "."));
        const critical =
          d.critical === true ||
          (measured.trim() !== "" &&
            Number.isFinite(numeric) &&
            ((t.snapshot.criticalLow !== null &&
              numeric < t.snapshot.criticalLow) ||
              (t.snapshot.criticalHigh !== null &&
                numeric > t.snapshot.criticalHigh)));
        const data = {
          measured,
          unit: t.snapshot.unit,
          reference: t.snapshot.reference,
          method: t.snapshot.method,
          comment: value(d.comment, 3000, true),
        };
        const reason = value(d.reason, 2000, !last);
        const row = (
          await c.query(
            "INSERT INTO public.nv_lab_values(id,empresa_id,test_id,container_id,version,data,reason,entered_by,critical,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
            [
              randomUUID(),
              u.empresaId,
              testId,
              s.id,
              (last?.version || 0) + 1,
              data,
              reason,
              u.username,
              critical,
              requestId,
            ],
          )
        ).rows[0];
        // Make the first entered value visible to staff history before independent review.
        // Public channels still require the latest version to be released.
        if (!t.result_id) {
          const p = await patient(c,u.empresaId!,t.patient_id || (await c.query(
            "SELECT patient_id FROM public.nv_lab_orders WHERE empresa_id=$1 AND id=$2",[u.empresaId,t.order_id]
          )).rows[0].patient_id);
          const created = (await c.query(
            "INSERT INTO public.resultados(empresa_id,paciente_id,paciente_nome,data,data_emissao,parametros,tecnico_nome) VALUES($1,$2,$3,$4,'',$5,$6) RETURNING id",
            [u.empresaId,p.id,p.nome,new Date().toLocaleDateString("pt-PT",{timeZone:"Africa/Luanda"}),
              JSON.stringify([{exame:t.snapshot.name,parametro:t.snapshot.name,resultado:measured,unidade:data.unit || "",referencia:data.reference || ""}]),
              u.funcionarioNome || u.username],
          )).rows[0];
          await c.query("UPDATE public.nv_lab_tests SET result_id=$3 WHERE empresa_id=$1 AND id=$2",[u.empresaId,testId,created.id]);
        }
        // A correction remains provisional until the new version is independently validated.
        if (t.result_id)
          await c.query(
            "UPDATE public.resultados SET data_emissao='' WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, t.result_id],
          );
        await event(c, u, "lab.result.enter", row.id, {
          version: row.version,
          critical,
        });
        return row;
      }),
    );
  });
  r.post("/values/:id/validate", async (req, res) => {
    const u = getUser(req);
    allowed(u, [...LAB, "medico"]);
    const phase = value(req.body.phase, 20);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        if (!["technical", "release", "solo_release"].includes(phase))
          deny("Etapa de validação inválida.");
        const solo = phase === "solo_release";
        await granted(
          c,
          u,
          phase === "technical"
            ? "lab.validate.technical"
            : solo ? "lab.validate.solo" : "lab.validate.release",
        );
        if (solo && u.funcao !== "tecnico")
          deny("Esta nomeação excepcional exige um técnico de laboratório.", 403);
        const v =
          (
            await c.query(
              "SELECT v.*,t.snapshot,t.order_id,t.result_id,o.patient_id,o.accession,o.cancelled_at FROM public.nv_lab_values v JOIN public.nv_lab_tests t ON t.id=v.test_id AND t.empresa_id=v.empresa_id JOIN public.nv_lab_orders o ON o.id=t.order_id AND o.empresa_id=t.empresa_id WHERE v.empresa_id=$1 AND v.id=$2 FOR UPDATE",
              [u.empresaId, uuid(req.params.id)],
            )
          ).rows[0] || deny("Resultado inexistente.", 404);
        const last = Number(
          (
            await c.query(
              "SELECT max(version) AS v FROM public.nv_lab_values WHERE empresa_id=$1 AND test_id=$2",
              [u.empresaId, v.test_id],
            )
          ).rows[0].v,
        );
        if (v.cancelled_at || v.version !== last)
          deny("Pedido cancelado ou versão ultrapassada.", 409);
        if (!solo && v.entered_by === u.username)
          deny(
            "O profissional que introduziu o resultado não pode validá-lo.",
            403,
          );
        if (solo && v.entered_by !== u.username)
          deny("A modalidade de técnico único só pode ser utilizada pelo autor do lançamento.", 403);
        if (v.released_at)
          deny("Resultado já libertado; uma alteração exige nova versão.", 409);
        if (solo && (v.technical_at || v.critical || v.snapshot.requiresClinical))
          deny("A revisão excepcional não é permitida para exames críticos, de validação clínica obrigatória ou já revistos.", 403);
        if (phase === "release" && v.critical)
          await granted(c, u, "lab.critical.release");
        const soloReason = solo ? value(req.body.note, 1500) : "";
        if (solo && (soloReason.length < 25 || req.body.confirmNonCritical !== true))
          deny("Documente a circunstância excepcional e confirme a avaliação de risco do exame (mínimo 25 caracteres).");
        if (phase === "technical" && v.technical_at)
          deny("Resultado já validado tecnicamente.", 409);
        if (phase === "release" && !v.technical_at)
          deny("Falta validação técnica independente.", 409);
        if (
          phase === "release" &&
          v.snapshot.requiresClinical &&
          v.technical_by === u.username
        )
          deny(
            "Esta análise exige outro profissional para libertação clínica.",
            403,
          );
        const s = (
          await c.query(
            "SELECT * FROM public.nv_lab_containers WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, v.container_id],
          )
        ).rows[0];
        if (s?.status !== "em_processamento")
          deny("Amostra bloqueada ou fora do processamento.", 409);
        if (v.snapshot.qcRequired) {
          const processing = (
            await c.query(
              "SELECT details FROM public.nv_lab_events WHERE empresa_id=$1 AND container_id=$2 AND action='processar' ORDER BY created_at DESC LIMIT 1",
              [u.empresaId, v.container_id],
            )
          ).rows[0]?.details;
          const qc = (
            await c.query(
              "SELECT * FROM public.nv_quality WHERE empresa_id=$1 AND sector=$2 AND equipment=$3 AND reagent_lot=$4 ORDER BY created_at DESC LIMIT 1",
              [
                u.empresaId,
                v.snapshot.sector,
                processing?.equipment || "",
                processing?.reagentLot || "",
              ],
            )
          ).rows[0];
          if (
            !qc ||
            qc.outcome !== "aprovado" ||
            new Date(qc.valid_until).getTime() <= Date.now()
          )
            deny(
              "Controlo de qualidade/equipamento/lote sem aprovação vigente.",
              409,
            );
        }
        if (phase === "technical")
          await c.query(
            "UPDATE public.nv_lab_values SET technical_by=$3,technical_at=now() WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, v.id, u.username],
          );
        else {
          if (solo) await c.query(
            "UPDATE public.nv_lab_values SET technical_by=$3,technical_at=now() WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, v.id, u.username],
          );
          const p = await patient(c, u.empresaId!, v.patient_id);
          const parameters = [
            {
              exame: v.snapshot.name,
              parametro: v.snapshot.name,
              resultado: v.data.measured,
              unidade: v.data.unit,
              referencia: v.data.reference,
            },
          ];
          const date = new Date().toLocaleDateString("pt-PT", {
            timeZone: "Africa/Luanda",
          });
          let resultId = v.result_id;
          if (resultId)
            await c.query(
              "UPDATE public.resultados SET parametros=$3,data_emissao=$4,tecnico_nome=$5 WHERE empresa_id=$1 AND id=$2",
              [
                u.empresaId,
                resultId,
                JSON.stringify(parameters),
                date,
                u.funcionarioNome || u.username,
              ],
            );
          else {
            resultId = (
              await c.query(
                "INSERT INTO public.resultados(empresa_id,paciente_id,paciente_nome,data,data_emissao,parametros,tecnico_nome) VALUES($1,$2,$3,$4,$4,$5,$6) RETURNING id",
                [
                  u.empresaId,
                  p.id,
                  p.nome,
                  date,
                  JSON.stringify(parameters),
                  u.funcionarioNome || u.username,
                ],
              )
            ).rows[0].id;
            await c.query(
              "UPDATE public.nv_lab_tests SET result_id=$3 WHERE empresa_id=$1 AND id=$2",
              [u.empresaId, v.test_id, resultId],
            );
          }
          await c.query(
            "UPDATE public.nv_lab_values SET released_by=$3,released_at=now() WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, v.id, u.username],
          );
        }
        await event(c, u, "lab.validate." + phase, v.id, {
          version: v.version,
          ...(solo ? { exceptional: true, reason: soloReason } : {}),
        });
        return { ok: true };
      }),
    );
  });
  r.post("/values/:id/communication", async (req, res) => {
    const u = getUser(req);
    allowed(u, [...LAB, "medico"]);
    const d = req.body;
    res.status(201).json(
      await transaction(pool, u.empresaId!, async (c) => {
        const id = uuid(req.params.id),
          requestId = uuid(d.requestId);
        const existing = (
          await c.query(
            "SELECT * FROM public.nv_lab_communications WHERE empresa_id=$1 AND request_id=$2",
            [u.empresaId, requestId],
          )
        ).rows[0];
        if (existing) {
          if (existing.value_id !== id)
            deny("Reenvio de outra comunicação.", 409);
          return existing;
        }
        const v =
          (
            await c.query(
              "SELECT * FROM public.nv_lab_values WHERE empresa_id=$1 AND id=$2",
              [u.empresaId, id],
            )
          ).rows[0] || deny("Resultado inexistente.", 404);
        if (!v.critical)
          deny("O resultado não está assinalado como crítico.", 409);
        const row = (
          await c.query(
            "INSERT INTO public.nv_lab_communications(id,empresa_id,value_id,actor,recipient,channel,note,acknowledged,readback,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
            [
              randomUUID(),
              u.empresaId,
              id,
              u.username,
              value(d.recipient, 200),
              value(d.channel, 100),
              value(d.note),
              d.acknowledged === true,
              value(d.readback, 1000, d.acknowledged !== true),
              requestId,
            ],
          )
        ).rows[0];
        await event(c, u, "lab.critical.communication", id, {
          acknowledged: row.acknowledged,
        });
        return row;
      }),
    );
  });
  r.get("/indicators", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    const q = (
      await pool.query(
        `SELECT count(*)::int AS total,count(*) FILTER(WHERE status='rejeitada')::int AS rejected,count(*) FILTER(WHERE status='por_colher')::int AS awaiting,count(*) FILTER(WHERE status='em_processamento')::int AS processing,coalesce(sum(greatest(print_count-1,0)),0)::int AS reprints,round(avg(extract(epoch FROM(received_at-collected_at))/60)::numeric,1) AS transport_minutes FROM public.nv_lab_containers WHERE empresa_id=$1`,
        [u.empresaId],
      )
    ).rows[0];
    const critical = Number(
      (
        await pool.query(
          "SELECT count(*) AS n FROM public.nv_lab_values v WHERE v.empresa_id=$1 AND critical AND NOT EXISTS(SELECT 1 FROM public.nv_lab_communications cm WHERE cm.empresa_id=v.empresa_id AND cm.value_id=v.id AND cm.acknowledged)",
          [u.empresaId],
        )
      ).rows[0].n,
    );
    res.json({
      ...q,
      criticalUnacknowledged: critical,
      updatedAt: new Date().toISOString(),
      source: "nv_lab_containers / nv_lab_values / nv_lab_communications",
    });
  });
  r.use(apiErrors);
  return r;
}
export default createLabWorkflow();

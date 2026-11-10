import { Router } from "express";
import type { Pool } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { getUser, requireEmpresa, type TokenPayload } from "../lib/auth.js";
import {
  allowed,
  apiErrors,
  deny,
  event,
  granted,
  patient,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";
import {
  STAFF_REPORT_SQL,
  staffReport,
  readStaffReport,
} from "../lib/lab-publication.js";
const LAB = ["admin", "gestor", "tecnico"],
  CARE = [...LAB, "medico", "enfermeiro"];
function positive(x: unknown) {
  const n = Number(x);
  if (!Number.isSafeInteger(n) || n <= 0)
    return deny("Identificador inválido.");
  return n;
}
function collectionDate(x: unknown) {
  const s = value(x, 10),
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s),
    iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? s
      : m
        ? m[3] + "-" + m[2] + "-" + m[1]
        : "";
  const d = new Date(iso + "T12:00:00Z");
  if (!iso || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso)
    return deny("Data de colheita inválida.");
  return iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
}
function rows(x: unknown) {
  if (!Array.isArray(x) || !x.length || x.length > 300)
    return deny("Indique entre 1 e 300 parâmetros.");
  const seen = new Set<string>();
  const result = x.map((p: any) => {
    if (!p || typeof p !== "object") return deny("Parâmetro inválido.");
    const row = {
      exame: value(p.exame, 200),
      parametro: value(p.parametro, 200),
      resultado: value(p.resultado, 4000, true),
      unidade: value(p.unidade, 120, true),
      referencia: value(p.referencia, 2000, true),
    };
    const key = row.exame.toLowerCase() + "|" + row.parametro.toLowerCase();
    if (seen.has(key)) deny("Parâmetro repetido no mesmo exame.");
    seen.add(key);
    return row;
  });
  if (!result.some((p) => p.resultado))
    deny("Preencha pelo menos um resultado.");
  return result;
}
function report(r: any) {
  return {
    id: r.id,
    pacienteId: r.paciente_id,
    pacienteNome: r.paciente_nome,
    data: r.data,
    dataEmissao: r.data_emissao,
    parametros: r.parametros,
    tecnicoNome: r.tecnico_nome,
    solicitacaoId: r.solicitacao_id,
  };
}
async function owned(c: any, org: string, id: number) {
  return (
    (
      await c.query(
        "SELECT r.* FROM public.resultados r WHERE r.empresa_id=$1 AND r.id=$2 AND (r.paciente_id IS NULL OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.empresa_id=r.empresa_id AND p.id=r.paciente_id))",
        [org, id],
      )
    ).rows[0] || deny("Resultado indisponível nesta instituição.", 404)
  );
}
async function managed(c: any, org: string, id: number) {
  return (
    await c.query(
      `SELECT lt.id,lt.order_id,o.accession,(
         SELECT s.code FROM public.nv_lab_values v
         JOIN public.nv_lab_containers s ON s.empresa_id=v.empresa_id AND s.id=v.container_id
         WHERE v.empresa_id=lt.empresa_id AND v.test_id=lt.id AND v.released_at IS NOT NULL
         ORDER BY v.version DESC LIMIT 1
       ) AS sample_code
       FROM public.nv_lab_tests lt
       JOIN public.nv_lab_orders o ON o.empresa_id=lt.empresa_id AND o.id=lt.order_id
       WHERE lt.empresa_id=$1 AND lt.result_id=$2`,
      [org, id],
    )
  ).rows[0];
}
async function capability(c: any, u: TokenPayload, permission: string) {
  if (![...LAB, "medico"].includes(u.funcao || "")) return false;
  try {
    await granted(c, u, permission);
    return true;
  } catch (e: any) {
    if (e.status === 403) return false;
    throw e;
  }
}
export async function assertManualReportPublished(
  c: any,
  org: string,
  id: number,
) {
  const last = (
    await c.query(
      "SELECT released_at,version FROM public.nv_lab_report_versions WHERE empresa_id=$1 AND resultado_id=$2 ORDER BY version DESC LIMIT 1",
      [org, id],
    )
  ).rows[0];
  if (last && !last.released_at)
    deny(
      "A versão corrigida aguarda validação. Não pode ser entregue como resultado pronto.",
      409,
    );
  return last;
}
export function createLabReportsRouter(pool: Pool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use(["/reports", "/report-capabilities", "/launch-queue"], (_q, s, n) => {
    s.setHeader("Cache-Control", "no-store");
    n();
  });
  async function capabilities(u: TokenPayload) {
    return {
      canEdit: LAB.includes(u.funcao || ""),
      canTechnical: await capability(pool, u, "lab.validate.technical"),
      canRelease: await capability(pool, u, "lab.validate.release"),
      canSolo: u.funcao === "tecnico" && await capability(pool, u, "lab.validate.solo"),
      canCritical: await capability(pool, u, "lab.critical.release"),
    };
  }
  r.get("/report-capabilities", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    res.json(await capabilities(u));
  });
  r.get("/launch-queue", async (req, res) => {
    const u = getUser(req);
    allowed(u, LAB);
    const q = await pool.query(
      "SELECT f.id,f.numero,f.data,f.estado,f.paciente_id,f.cliente_nome,f.linhas,coalesce((SELECT max(v.resultado_id) FROM public.nv_lab_report_versions v WHERE v.empresa_id=f.empresa_id AND v.data->>'faturaId'=f.id::text AND v.version>0),(SELECT rr.id FROM public.resultados rr WHERE rr.empresa_id=f.empresa_id AND rr.id=f.resultado_id AND rr.paciente_id=f.paciente_id)) AS report_id FROM public.faturas f JOIN public.pacientes p ON p.id=f.paciente_id AND p.empresa_id=f.empresa_id WHERE f.empresa_id=$1 AND f.estado IN ('emitida','paga') AND regexp_replace(lower(coalesce(f.tipo_documento,'factura')),'[-_ ]','','g') NOT IN ('recibo','proforma','notacredito') AND coalesce(f.billing_meta->>'pharmacyPosTraining','false')<>'true' ORDER BY f.id DESC LIMIT 200",
      [u.empresaId],
    );
    // No balances, prices, NIFs or accounting movements are returned to the laboratory.
    res.json(
      q.rows.map((f: any) => ({
        id: f.id,
        numero: f.numero,
        data: f.data,
        estado: f.estado,
        pacienteId: f.paciente_id,
        clienteNome: f.cliente_nome,
        linhas: (f.linhas || []).map((l: any) => ({ descricao: l.descricao })),
        reportId: f.report_id,
      })),
    );
  });
  r.get("/reports", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    const page = Math.max(0, Math.min(100000, Number(req.query.page) || 0)),
      q = String(req.query.q || "")
        .trim()
        .slice(0, 200);
    if (!Number.isInteger(page)) deny("Página inválida.");
    const state = String(req.query.state || "all");
    if (!["all", "ready", "pending"].includes(state)) deny("Filtro inválido.");
    const where = `r.empresa_id=$1 AND (r.paciente_id IS NULL OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.empresa_id=r.empresa_id AND p.id=r.paciente_id)) AND ($2='' OR r.paciente_nome ILIKE '%'||$2||'%' OR r.id::text=$2 OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.empresa_id=r.empresa_id AND p.id=r.paciente_id AND p.processo ILIKE '%'||$2||'%') OR EXISTS(
        SELECT 1 FROM public.nv_lab_tests lt
        JOIN public.nv_lab_orders o ON o.empresa_id=lt.empresa_id AND o.id=lt.order_id
        WHERE lt.empresa_id=r.empresa_id AND lt.result_id=r.id AND (
          o.accession ILIKE '%'||$2||'%' OR o.patient_snapshot->>'processo' ILIKE '%'||$2||'%' OR EXISTS(
            SELECT 1 FROM public.nv_lab_values lv
            JOIN public.nv_lab_containers sc ON sc.empresa_id=lv.empresa_id AND sc.id=lv.container_id
            WHERE lv.empresa_id=lt.empresa_id AND lv.test_id=lt.id AND sc.code ILIKE '%'||$2||'%'
          )
        )
      )) AND ($3='all' OR ($3='ready' AND r.data_emissao<>'') OR ($3='pending' AND r.data_emissao=''))`;
    const out = await pool.query(
      STAFF_REPORT_SQL +
        " WHERE " +
        where +
        " ORDER BY r.id DESC LIMIT 40 OFFSET $4",
      [u.empresaId, q, state, page * 40],
    );
    const total = Number(
      (
        await pool.query(
          "SELECT count(*) AS n FROM public.resultados r WHERE " + where,
          [u.empresaId, q, state],
        )
      ).rows[0].n,
    );
    res.json({
      items: out.rows.map(staffReport),
      total,
      ...(await capabilities(u)),
    });
  });
  r.get("/reports/:id", async (req, res) => {
    const u = getUser(req);
    allowed(u, CARE);
    const id = positive(req.params.id);
    const out = await transaction(pool, u.empresaId!, async (c) => {
      const row = await owned(c, u.empresaId!, id),
        trace = await managed(c, u.empresaId!, id);
      const history = (
        await c.query(
          "SELECT * FROM public.nv_lab_report_versions WHERE empresa_id=$1 AND resultado_id=$2 ORDER BY version DESC",
          [u.empresaId, id],
        )
      ).rows;
      await event(c, u, "lab.report.read", String(id));
      const current = await readStaffReport(c, u.empresaId!, id);
      return { ...current, published: report(row), history };
    });
    res.json({ ...out, ...(await capabilities(u)) });
  });
  async function saveDraft(u: TokenPayload, d: any, id?: number) {
    allowed(u, LAB);
    const editing = id !== undefined;
    const requestId = uuid(d.requestId),
      parameters = rows(d.parametros),
      date = collectionDate(d.data);
    const reason = value(d.reason, 2000, !id),
      previous = Number(d.previousVersion ?? 0);
    if (!Number.isSafeInteger(previous) || previous < 0)
      deny("Versão inválida.");
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          id: id ?? null,
          patientId: d.pacienteId ?? null,
          request: d.solicitacaoId ?? null,
          invoice: d.faturaId ?? null,
          date,
          parameters,
          reason,
          previous,
        }),
      )
      .digest("hex");
    return transaction(pool, u.empresaId!, async (c) => {
      const retry = (
        await c.query(
          "SELECT * FROM public.nv_lab_report_versions WHERE empresa_id=$1 AND request_id=$2",
          [u.empresaId, requestId],
        )
      ).rows[0];
      if (retry) {
        if (retry.payload_hash !== hash || retry.entered_by !== u.username)
          deny("Este pedido já foi usado com outro conteúdo.", 409);
        return {
          id: retry.resultado_id,
          version: retry.version,
          replayed: true,
        };
      }
      let row: any,
        sol: any,
        faturaId: number | null = null;
      if (id) {
        row = await owned(c, u.empresaId!, id);
        const trace = await managed(c, u.empresaId!, id);
        if (trace)
          deny(
            "Resultado ligado a uma amostra: use a rectificação no circuito de rastreabilidade.",
            409,
          );
        if (d.pacienteId != null && Number(d.pacienteId) !== row.paciente_id)
          deny("A rectificação não pode trocar o paciente.", 409);
        if (row.solicitacao_id)
          sol =
            (
              await c.query(
                "SELECT * FROM public.solicitacoes WHERE empresa_id=$1 AND id=$2",
                [u.empresaId, uuid(row.solicitacao_id)],
              )
            ).rows[0] || deny("Pedido externo indisponível.", 409);
        else {
          // Older imports stored the association only on the request itself.
          const links = (
            await c.query(
              "SELECT * FROM public.solicitacoes WHERE empresa_id=$1 AND resultado_id=$2 LIMIT 2",
              [u.empresaId, String(id)],
            )
          ).rows;
          if (links.length > 1)
            deny(
              "Há vários pedidos ligados a este resultado. Confirme a associação antes de rectificar.",
              409,
            );
          sol = links[0];
          if (
            sol &&
            String(sol.paciente_nome).trim().normalize("NFKC").toLowerCase() !==
              String(row.paciente_nome).trim().normalize("NFKC").toLowerCase()
          )
            deny(
              "A identificação do pedido e do resultado precisa de conferência.",
              409,
            );
        }
        if (
          d.solicitacaoId != null &&
          String(d.solicitacaoId) !== (row.solicitacao_id || sol?.id)
        )
          deny("A rectificação não pode trocar o pedido.", 409);
        if (sol?.resultado_id && String(sol.resultado_id) !== String(id))
          deny(
            "O pedido já está associado a outro resultado. Actualize antes de alterar.",
            409,
          );
        if (sol?.estado.startsWith("cancel"))
          deny("Pedido externo cancelado.", 409);
      } else {
        if (d.solicitacaoId) {
          sol =
            (
              await c.query(
                "SELECT * FROM public.solicitacoes WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
                [u.empresaId, uuid(d.solicitacaoId)],
              )
            ).rows[0] || deny("Pedido externo não encontrado.", 404);
          if (sol.estado.startsWith("cancel"))
            deny("Pedido externo cancelado.", 409);
          if (sol.resultado_id)
            deny("Este pedido já tem um resultado. Abra-o para editar.", 409);
        }
        const p = d.pacienteId
          ? await patient(c, u.empresaId!, positive(d.pacienteId))
          : null;
        if (!p && !sol)
          deny("Seleccione o paciente ou um pedido externo da instituição.");
        if (p && sol) deny("Seleccione apenas uma origem para o resultado.");
        if (d.faturaId) {
          faturaId = positive(d.faturaId);
          const f = (
            await c.query(
              "SELECT paciente_id,estado,resultado_id FROM public.faturas WHERE empresa_id=$1 AND id=$2",
              [u.empresaId, faturaId],
            )
          ).rows[0];
          if (
            !f ||
            f.paciente_id !== p?.id ||
            !["paga", "emitida"].includes(f.estado)
          )
            deny("Factura indisponível para este paciente.", 403);
          if (f.resultado_id)
            deny(
              "Esta factura já está associada a um resultado. Abra-o para editar.",
              409,
            );
          if (
            (
              await c.query(
                "SELECT 1 FROM public.nv_lab_report_versions WHERE empresa_id=$1 AND data->>'faturaId'=$2 LIMIT 1",
                [u.empresaId, String(faturaId)],
              )
            ).rowCount
          )
            deny(
              "Esta factura já tem lançamento; abra o resultado para editar.",
              409,
            );
        }
        row = (
          await c.query(
            "INSERT INTO public.resultados(empresa_id,paciente_id,paciente_nome,data,data_emissao,parametros,tecnico_nome,solicitacao_id) VALUES($1,$2,$3,$4,'',$5,$6,$7) RETURNING *",
            [
              u.empresaId,
              p?.id ?? null,
              p?.nome || sol.paciente_nome,
              date,
              JSON.stringify(parameters),
              u.funcionarioNome || u.username,
              sol?.id ?? null,
            ],
          )
        ).rows[0];
        id = row.id;
      }
      const latest = (
        await c.query(
          "SELECT * FROM public.nv_lab_report_versions WHERE empresa_id=$1 AND resultado_id=$2 ORDER BY version DESC LIMIT 1",
          [u.empresaId, id],
        )
      ).rows[0];
      if (previous !== (latest?.version || 0))
        deny(
          "Outro posto alterou este resultado. Actualize antes de guardar.",
          409,
        );
      if (!latest && editing) {
        await c.query(
          "INSERT INTO public.nv_lab_report_versions(id,empresa_id,resultado_id,version,data,reason,origin) VALUES($1,$2,$3,0,$4,'Registo existente antes do versionamento; autoria e validação históricas não certificadas.','legado')",
          [randomUUID(), u.empresaId, id, JSON.stringify(report(row))],
        );
      }
      const snapshot = {
        ...report(row),
        solicitacaoId: row.solicitacao_id || sol?.id || null,
        data: date,
        dataEmissao: "",
        parametros: parameters,
        tecnicoNome: u.funcionarioNome || u.username,
        faturaId: latest?.data?.faturaId || faturaId,
      };
      const version = (latest?.version || 0) + 1;
      await c.query(
        "INSERT INTO public.nv_lab_report_versions(id,empresa_id,resultado_id,version,data,reason,origin,entered_by,request_id,payload_hash) VALUES($1,$2,$3,$4,$5,$6,'manual',$7,$8,$9)",
        [
          randomUUID(),
          u.empresaId,
          id,
          version,
          JSON.stringify(snapshot),
          reason,
          u.username,
          requestId,
          hash,
        ],
      );
      await c.query(
        "UPDATE public.resultados SET data_emissao='',solicitacao_id=coalesce(solicitacao_id,$3) WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, id, snapshot.solicitacaoId],
      );
      if (sol)
        await c.query(
          "UPDATE public.solicitacoes SET resultado_id=$3,estado='em_processo' WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, sol.id, String(id)],
        );
      await event(
        c,
        u,
        editing ? "lab.report.correct" : "lab.report.enter",
        String(id),
        { version, previousVersion: previous, parameters: parameters.length },
      );
      return { id, version };
    });
  }
  r.post("/reports", async (req, res) => {
    res.status(201).json(await saveDraft(getUser(req), req.body || {}));
  });
  r.post("/reports/:id/drafts", async (req, res) => {
    res
      .status(201)
      .json(
        await saveDraft(getUser(req), req.body || {}, positive(req.params.id)),
      );
  });
  r.post("/reports/:id/validate", async (req, res) => {
    const u = getUser(req);
    allowed(u, [...LAB, "medico"]);
    const id = positive(req.params.id),
      d = req.body || {};
    if (!["technical", "release", "solo_release"].includes(d.phase))
      deny("Etapa de validação inválida.");
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        await owned(c, u.empresaId!, id);
        if (await managed(c, u.empresaId!, id))
          deny("Valide este resultado no circuito de rastreabilidade.", 409);
        await granted(
          c,
          u,
          d.phase === "technical" ? "lab.validate.technical" :
            d.phase === "solo_release" ? "lab.validate.solo" : "lab.validate.release",
        );
        const solo = d.phase === "solo_release";
        if (solo && u.funcao !== "tecnico")
          deny("Esta nomeação excepcional exige um técnico de laboratório.", 403);
        const v =
          (
            await c.query(
              "SELECT * FROM public.nv_lab_report_versions WHERE empresa_id=$1 AND resultado_id=$2 ORDER BY version DESC LIMIT 1",
              [u.empresaId, id],
            )
          ).rows[0] || deny("Não existe versão para validar.", 409);
        if (v.version !== d.version)
          deny("A versão mudou. Actualize antes de validar.", 409);
        if (!solo && v.entered_by === u.username)
          deny("A revisão exige outro profissional.", 403);
        if (solo && v.entered_by !== u.username)
          deny("A modalidade de técnico único só pode ser utilizada pelo autor do lançamento.", 403);
        if (v.released_at)
          deny(
            "Esta versão já está pronta; uma alteração exige rectificação.",
            409,
          );
        const note = value(d.note, 1500);
        if (solo && (note.length < 25 || d.confirmNonCritical !== true))
          deny("Documente a circunstância excepcional e confirme a avaliação de risco do exame (mínimo 25 caracteres).");
        if (v.data.parametros.some((p: any) => !p.resultado?.trim()))
          deny(
            "Existem parâmetros por preencher. Complete-os ou registe explicitamente a não realização antes de validar.",
            409,
          );
        if (d.phase === "technical") {
          if (v.technical_at) deny("Já existe validação técnica.", 409);
          await c.query(
            "UPDATE public.nv_lab_report_versions SET technical_by=$3,technical_at=now(),technical_note=$4 WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, v.id, u.username, note],
          );
        } else {
          if (!solo && !v.technical_at) deny("Falta validação técnica.", 409);
          if (!solo && v.technical_by === u.username)
            deny(
              "A libertação exige outro profissional que não o revisor técnico.",
              403,
            );
          const snapshot = v.data;
          if (snapshot.pacienteId)
            await patient(c, u.empresaId!, snapshot.pacienteId);
          if (snapshot.solicitacaoId) {
            const sol = (
              await c.query(
                "SELECT estado FROM public.solicitacoes WHERE empresa_id=$1 AND id=$2",
                [u.empresaId, uuid(snapshot.solicitacaoId)],
              )
            ).rows[0];
            if (!sol || sol.estado.startsWith("cancel"))
              deny("Pedido externo cancelado ou indisponível.", 409);
          }
          const date = new Date().toLocaleDateString("pt-PT", {
            timeZone: "Africa/Luanda",
          });
          snapshot.dataEmissao = date;
          if (solo) await c.query(
            "UPDATE public.nv_lab_report_versions SET technical_by=$3,technical_at=now(),technical_note=$4 WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, v.id, u.username, "Revisão excepcional — técnico único: " + note],
          );
          await c.query(
            "UPDATE public.nv_lab_report_versions SET data=$3,released_by=$4,released_at=now(),release_note=$5 WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, v.id, JSON.stringify(snapshot), u.username, note],
          );
          await c.query(
            "UPDATE public.resultados SET data=$3,data_emissao=$4,parametros=$5,tecnico_nome=$6 WHERE empresa_id=$1 AND id=$2",
            [
              u.empresaId,
              id,
              snapshot.data,
              date,
              JSON.stringify(snapshot.parametros),
              snapshot.tecnicoNome,
            ],
          );
          if (snapshot.solicitacaoId)
            await c.query(
              "UPDATE public.solicitacoes SET estado='concluido',resultado_id=$3 WHERE empresa_id=$1 AND id=$2",
              [u.empresaId, snapshot.solicitacaoId, String(id)],
            );
        }
        await event(c, u, "lab.report.validate." + d.phase, String(id), {
          version: v.version,
          ...(solo ? { exceptional: true, reason: note } : {}),
        });
        return { ok: true, version: v.version };
      }),
    );
  });
  r.use(apiErrors);
  return r;
}

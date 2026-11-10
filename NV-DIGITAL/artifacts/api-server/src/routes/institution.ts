import { Router } from "express";
import { professionalData, syncLabStaffPermissions } from "../lib/professionals.js";
import { assertManualReportPublished } from "./lab-reports.js";
import { readStaffReport } from "../lib/lab-publication.js";
import { randomUUID, createHash } from "node:crypto";
import type { Pool } from "pg";
import { pool as productionPool } from "@workspace/db";
import { DELEGATED_PERMISSIONS, SERVICE_DEFINITIONS } from "@workspace/api-zod";
import { getUser, requireEmpresa } from "../lib/auth.js";
import {
  allowed,
  apiErrors,
  auditDigest,
  deny,
  episode,
  event,
  granted,
  patient,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";
export function createInstitutionRouter(pool: Pool = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.get("/institution", async (req, res) => {
    const u = getUser(req);
    const row = (
      await pool.query(
        "SELECT data,revision,updated_at FROM public.nv_settings WHERE empresa_id=$1",
        [u.empresaId],
      )
    ).rows[0] || {
      data: {
        profile: "geral",
        services: [],
        labSectors: [],
        specialties: [
          "Clínica Geral",
          "Ginecologia",
          "Nutrição",
          "Cardiologia",
        ],
      },
      revision: 0,
    };
    const permissions = (
      await pool.query(
        "SELECT permission,expires_at FROM public.nv_grants WHERE empresa_id=$1 AND actor=$2 AND revoked_at IS NULL AND expires_at>now()",
        [u.empresaId, u.username],
      )
    ).rows;
    res.json({ ...row, permissions });
  });
  r.put("/institution", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const d = req.body;
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const old = (
          await c.query(
            "SELECT * FROM public.nv_settings WHERE empresa_id=$1 FOR UPDATE",
            [u.empresaId],
          )
        ).rows[0];
        if ((old?.revision || 0) !== d.revision)
          deny("A configuração foi alterada. Actualize.", 409);
        if (!["geral", "queimados", "cetep"].includes(d.data?.profile))
          deny("Perfil institucional inválido.");
        const services = Array.isArray(d.data.services)
          ? [...new Set(d.data.services.map((s: any) => value(s, 40)))]
          : [];
        if (
          services.some((s) => !Object.hasOwn(SERVICE_DEFINITIONS, s as string))
        )
          deny("Serviço não implementado.");
        const strings = (v: any, max: number) => {
          if (!Array.isArray(v) || v.length > 50)
            deny("Lista de serviços inválida.");
          return [...new Set(v.map((x: any) => value(x, max)))];
        };
        const data = {
          profile: d.data.profile,
          services,
          labSectors: strings(d.data.labSectors, 100),
          specialties: strings(d.data.specialties, 100),
          protocolReference: value(d.data.protocolReference, 1500, true),
        };
        const row = (
          await c.query(
            "INSERT INTO public.nv_settings(empresa_id,data,revision,updated_by) VALUES($1,$2,1,$3) ON CONFLICT(empresa_id) DO UPDATE SET data=excluded.data,revision=nv_settings.revision+1,updated_by=excluded.updated_by,updated_at=now() RETURNING data,revision,updated_at",
            [u.empresaId, data, u.username],
          )
        ).rows[0];
        await event(c, u, "institution.configure", u.empresaId!, {
          revision: row.revision,
        });
        return row;
      }),
    );
  });
  r.get("/access", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const users = (
      await pool.query(
        "SELECT id,nome,username,funcao,ativo FROM public.funcionarios WHERE empresa_id=$1 ORDER BY nome",
        [u.empresaId],
      )
    ).rows;
    const grants = (
      await pool.query(
        "SELECT * FROM public.nv_grants WHERE empresa_id=$1 ORDER BY created_at DESC LIMIT 500",
        [u.empresaId],
      )
    ).rows;
    const sessions = (
      await pool.query(
        "SELECT id,actor,expires_at,revoked_at FROM public.auth_sessions WHERE empresa_id=$1 AND expires_at>now() ORDER BY expires_at DESC LIMIT 200",
        [u.empresaId],
      )
    ).rows;
    const professionals = (
      await pool.query(
        "SELECT * FROM public.nv_professionals WHERE empresa_id=$1",
        [u.empresaId],
      )
    ).rows;
    res.json({
      users,
      grants,
      sessions,
      professionals,
      permissions: DELEGATED_PERMISSIONS,
    });
  });
  r.post("/access/grants", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const d = req.body;
    res.status(201).json(
      await transaction(pool, u.empresaId!, async (c) => {
        const target = value(d.actor, 200),
          permission = value(d.permission, 100),
          reason = value(d.reason);
        if (target === u.username)
          deny("Não pode conceder uma autorização a si próprio.", 403);
        if (!(DELEGATED_PERMISSIONS as readonly string[]).includes(permission))
          deny("Autorização desconhecida.");
        if (permission === "lab.validate.solo" && reason.length < 25)
          deny("Justifique a nomeação excepcional, o serviço e a referência da decisão (mínimo 25 caracteres).");
        const who = (
          await c.query(
            "SELECT id,funcao FROM public.funcionarios WHERE empresa_id=$1 AND username=$2 AND ativo",
            [u.empresaId, target],
          )
        ).rows[0];
        if (!who)
          deny(
            "Seleccione uma conta individual activa desta instituição.",
            404,
          );
        if (permission === "lab.validate.solo" && who.funcao !== "tecnico")
          deny("A nomeação excepcional destina-se a um técnico de laboratório activo.", 403);
        const until = new Date(d.expiresAt);
        if (
          !Number.isFinite(until.getTime()) ||
          until.getTime() <= Date.now() ||
          until.getTime() > Date.now() + 366 * 86400000
        )
          deny("A autorização deve expirar num prazo até 366 dias.");
        if (permission === "lab.validate.solo" && until.getTime() > Date.now() + 90 * 86400000)
          deny("A substituição excepcional tem validade máxima de 90 dias.");
        const credential = (
          await c.query(
            "SELECT data FROM public.nv_professionals WHERE empresa_id=$1 AND funcionario_id=$2",
            [u.empresaId, who.id],
          )
        ).rows[0]?.data;
        if (
          permission.startsWith("lab.") &&
          (!credential?.credential ||
            !credential?.verifiedBy ||
            credential.status !== "activo" ||
            new Date(credential.validUntil).getTime() <= Date.now())
        )
          deny(
            "Registe e verifique uma credencial profissional vigente antes de delegar esta competência.",
            409,
          );
        const row = (
          await c.query(
            "INSERT INTO public.nv_grants(id,empresa_id,actor,permission,reason,granted_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            [
              randomUUID(),
              u.empresaId,
              target,
              permission,
              reason,
              u.username,
              until.toISOString(),
            ],
          )
        ).rows[0];
        await event(c, u, "access.grant", row.id, {
          actor: target,
          permission,
          ...(permission === "lab.validate.solo" ? { exceptional: true, reason } : {}),
        });
        return row;
      }),
    );
  });
  r.post("/access/grants/:id/revoke", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const reason = value(req.body.reason);
        const q = await c.query(
          "UPDATE public.nv_grants SET revoked_at=now() WHERE empresa_id=$1 AND id=$2 AND revoked_at IS NULL RETURNING id",
          [u.empresaId, uuid(req.params.id)],
        );
        if (!q.rowCount) deny("Autorização indisponível.", 404);
        await event(c, u, "access.revoke", q.rows[0].id, { reason });
        return { ok: true };
      }),
    );
  });
  r.post("/access/sessions/:id/revoke", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        value(req.body.reason);
        const q = await c.query(
          "UPDATE public.auth_sessions SET revoked_at=now() WHERE empresa_id=$1 AND id=$2 RETURNING id",
          [u.empresaId, uuid(req.params.id)],
        );
        if (!q.rowCount) deny("Sessão indisponível.", 404);
        await event(c, u, "session.revoke", q.rows[0].id);
        return { ok: true };
      }),
    );
  });
  r.put("/professionals/:id", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const d = req.body;
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const id = uuid(req.params.id),
          who =
            (
              await c.query(
                "SELECT * FROM public.funcionarios WHERE empresa_id=$1 AND id=$2",
                [u.empresaId, id],
              )
            ).rows[0] || deny("Profissional não encontrado.", 404);
        const old = (
          await c.query(
            "SELECT data,revision FROM public.nv_professionals WHERE empresa_id=$1 AND funcionario_id=$2 FOR UPDATE",
            [u.empresaId, id],
          )
        ).rows[0];
        if ((old?.revision || 0) !== d.revision)
          deny("Ficha profissional alterada noutro posto.", 409);
        if (!["activo", "suspenso", "desligado"].includes(d.data?.status))
          deny("Situação profissional inválida.");
        if (who.username === u.username)
          deny("A verificação da sua ficha exige outro responsável.", 403);
        const updatedProfile = professionalData(d.data, old?.data);
        const until = new Date(updatedProfile.validUntil);
        if (!Number.isFinite(until.getTime()))
          deny("Validade de credencial inválida.");
        const data = {
          ...updatedProfile,
          category: value(d.data.category, 150),
          specialties: value(d.data.specialties, 500),
          credential: value(d.data.credential, 200),
          service: value(d.data.service, 200),
          contract: value(d.data.contract, 200),
          status: d.data.status,
          validUntil: until.toISOString(),
          verification: value(d.data.verification, 1500),
          verifiedBy: u.username,
          verifiedAt: new Date().toISOString(),
        };
        const row = (
          await c.query(
            "INSERT INTO public.nv_professionals(empresa_id,funcionario_id,data,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(empresa_id,funcionario_id) DO UPDATE SET data=excluded.data,revision=nv_professionals.revision+1,updated_by=excluded.updated_by,updated_at=now() RETURNING *",
            [u.empresaId, id, data, u.username],
          )
        ).rows[0];
        if (data.status !== "activo") {
          await c.query(
            "UPDATE public.funcionarios SET ativo=false WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, id],
          );
          await c.query(
            "UPDATE public.auth_sessions SET revoked_at=now() WHERE empresa_id=$1 AND actor=$2",
            [u.empresaId, who.username],
          );
          await c.query(
            "UPDATE public.nv_grants SET revoked_at=now() WHERE empresa_id=$1 AND actor=$2 AND revoked_at IS NULL",
            [u.empresaId, who.username],
          );
        } else if (Array.isArray(data.requestedLabPermissions)) {
          await syncLabStaffPermissions(c, u, {
            username: who.username,
            role: who.funcao,
            active: who.ativo,
            profile: data,
          });
        }
        await event(c, u, "professional.update", id, { status: data.status });
        return row;
      }),
    );
  });
  r.get("/audit", async (req, res) => {
    const u = getUser(req);
    if (!["admin", "gestor"].includes(u.funcao || ""))
      await granted(pool, u, "audit.read");
    const after = Math.max(0, Number(req.query.after) || 0);
    res.json(
      (
        await pool.query(
          "SELECT * FROM public.nv_audit WHERE empresa_id=$1 AND id>$2 ORDER BY id LIMIT 100",
          [u.empresaId, after],
        )
      ).rows,
    );
  });
  r.get("/audit/verify", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor"]);
    const rows = (
      await pool.query(
        "SELECT * FROM public.nv_audit WHERE empresa_id=$1 ORDER BY id",
        [u.empresaId],
      )
    ).rows;
    let previous = "",
      valid = true;
    for (const row of rows) {
      const hash = auditDigest(
        previous,
        u.empresaId!,
        row.actor,
        row.action,
        row.reference,
        new Date(row.at).toISOString(),
        row.details,
      );
      if (row.previous_hash !== previous || row.hash !== hash) {
        valid = false;
        break;
      }
      previous = row.hash;
    }
    res.json({
      valid,
      count: rows.length,
      lastHash: previous,
      checkedAt: new Date().toISOString(),
    });
  });
  async function serviceAccess(c: any, u: any, kind: string) {
    const spec =
      (Object.hasOwn(SERVICE_DEFINITIONS, kind)
        ? SERVICE_DEFINITIONS[kind]
        : null) || deny("Serviço desconhecido.", 404);
    allowed(u, spec.roles);
    const cfg = (
      await c.query("SELECT data FROM public.nv_settings WHERE empresa_id=$1", [
        u.empresaId,
      ])
    ).rows[0]?.data;
    if (!cfg?.services?.includes(kind))
      deny("Serviço não activado para esta instituição.", 403);
    if (spec.permission) await granted(c, u, spec.permission);
    return spec;
  }
  r.get("/services/:kind", async (req, res) => {
    const u = getUser(req),
      kind = String(req.params.kind);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        await serviceAccess(c, u, kind);
        const rows = (
          await c.query(
            "SELECT cs.*,p.nome AS patient_name FROM public.nv_cases cs LEFT JOIN public.pacientes p ON p.empresa_id=cs.empresa_id AND p.id=cs.patient_id WHERE cs.empresa_id=$1 AND cs.kind=$2 ORDER BY cs.updated_at DESC LIMIT 100 OFFSET $3",
            [u.empresaId, kind, Math.max(0, Number(req.query.page) || 0) * 100],
          )
        ).rows;
        await event(c, u, "service.read", kind);
        return rows;
      }),
    );
  });
  r.get("/services/:kind/:id/history", async (req, res) => {
    const u = getUser(req),
      kind = String(req.params.kind);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        await serviceAccess(c, u, kind);
        const id = uuid(req.params.id);
        if (
          !(
            await c.query(
              "SELECT 1 FROM public.nv_cases WHERE empresa_id=$1 AND kind=$2 AND id=$3",
              [u.empresaId, kind, id],
            )
          ).rowCount
        )
          deny("Registo indisponível.", 404);
        await event(c, u, "service.history.read", id);
        return (
          await c.query(
            "SELECT * FROM public.nv_case_events WHERE empresa_id=$1 AND case_id=$2 ORDER BY created_at",
            [u.empresaId, id],
          )
        ).rows;
      }),
    );
  });
  r.put("/services/:kind/:id", async (req, res) => {
    const u = getUser(req),
      kind = String(req.params.kind),
      d = req.body;
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const spec = await serviceAccess(c, u, kind),
          id = uuid(req.params.id),
          reason = value(d.reason, 2000),
          old = (
            await c.query(
              "SELECT * FROM public.nv_cases WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
              [u.empresaId, id],
            )
          ).rows[0];
        if (old && old.kind !== kind) deny("Referência de outro serviço.", 409);
        if ((old?.revision || 0) !== d.revision)
          deny("Registo alterado por outro profissional.", 409);
        if (old && ["concluido", "cancelado"].includes(old.status))
          deny(
            "Registo encerrado é imutável. Crie uma adenda ligada à referência original.",
            409,
          );
        if (
          !["aberto", "em_curso", "concluido", "cancelado"].includes(d.status)
        )
          deny("Estado inválido.");
        let patientId: number | null = null;
        if (spec.patient) {
          await patient(c, u.empresaId!, d.patientId);
          patientId = Number(d.patientId);
        } else if (d.patientId)
          deny("Este registo operacional não aceita dados de paciente.");
        const ep = patientId
          ? await episode(c, u.empresaId!, d.episodeId, patientId)
          : null;
        if (old && (old.patient_id !== patientId || old.episode_id !== ep))
          deny(
            "Não é possível mudar o paciente/episódio de um registo existente.",
            409,
          );
        const data: any = {};
        for (const f of spec.fields) {
          data[f.key] = value(
            d.data?.[f.key],
            f.type === "textarea" ? 5000 : 1000,
            !f.required,
          );
          if (
            data[f.key] &&
            f.type === "number" &&
            !Number.isFinite(Number(data[f.key]))
          )
            deny("Valor numérico inválido: " + f.label);
          if (
            data[f.key] &&
            ["date", "datetime-local"].includes(f.type || "") &&
            !Number.isFinite(Date.parse(data[f.key]))
          )
            deny("Data inválida: " + f.label);
        }
        if (
          kind === "queimados" &&
          (Number(data.extent) < 0 || Number(data.extent) > 100)
        )
          deny("A extensão registada deve ficar entre 0 e 100%.");
        if (kind === "maternidade" && data.newbornPatientId) {
          await patient(c, u.empresaId!, data.newbornPatientId);
          if (Number(data.newbornPatientId) === patientId)
            deny("A mãe e o recém-nascido têm processos distintos.", 409);
        }
        if (data.start && data.end) {
          if (new Date(data.end) <= new Date(data.start))
            deny("O fim deve ser posterior ao início.");
          const conflicts = await c.query(
            "SELECT 1 FROM public.nv_cases WHERE empresa_id=$1 AND kind=$2 AND id<>$3 AND status IN ('aberto','em_curso') AND data->>'resource'=$4 AND (data->>'start')::timestamptz<$6::timestamptz AND (data->>'end')::timestamptz>$5::timestamptz",
            [u.empresaId, kind, id, data.resource, data.start, data.end],
          );
          if (conflicts.rowCount && d.status !== "cancelado")
            deny("O recurso já está reservado nesse intervalo.", 409);
        }
        if (
          kind === "escalas" &&
          !(
            await c.query(
              "SELECT 1 FROM public.funcionarios WHERE empresa_id=$1 AND id=$2 AND ativo",
              [u.empresaId, uuid(data.workerId)],
            )
          ).rowCount
        )
          deny("Funcionário não activo nesta instituição.", 409);
        if (d.status === "concluido") {
          if (
            kind === "cirurgia" &&
            ["signIn", "timeOut", "signOut", "recovery"].some((k) => !data[k])
          )
            deny("Falta completar checklist e recuperação.", 409);
          if (kind === "transporte" && !data.handover)
            deny("Registe quem recebeu o paciente e a hora.", 409);
          if (kind === "esterilizacao") {
            await granted(c, u, "operations.approve");
            if ((old?.created_by || u.username) === u.username)
              deny("A libertação do ciclo exige outro profissional.", 403);
            if (data.outcome.toLowerCase() !== "aprovado")
              deny("Ciclo reprovado não pode ser libertado.", 409);
          }
        }
        const assigned = value(d.assignedTo, 200);
        if (
          assigned !== u.username &&
          !(
            await c.query(
              "SELECT 1 FROM public.funcionarios WHERE empresa_id=$1 AND username=$2 AND ativo UNION ALL SELECT 1 FROM public.empresas WHERE id=$1 AND username=$2",
              [u.empresaId, assigned],
            )
          ).rowCount
        )
          deny("Responsável inválido.", 404);
        const title = value(d.title, 250),
          reference =
            old?.reference || "NV-" + randomUUID().slice(0, 12).toUpperCase();
        const row = (
          await c.query(
            "INSERT INTO public.nv_cases(id,empresa_id,kind,patient_id,episode_id,reference,title,status,data,created_by,assigned_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,data=excluded.data,assigned_to=excluded.assigned_to,revision=nv_cases.revision+1,updated_at=now() WHERE nv_cases.empresa_id=excluded.empresa_id RETURNING *",
            [
              id,
              u.empresaId,
              kind,
              patientId,
              ep,
              reference,
              title,
              d.status,
              data,
              u.username,
              assigned,
            ],
          )
        ).rows[0];
        if (!row) deny("Referência indisponível.", 409);
        await c.query(
          "INSERT INTO public.nv_case_events(id,empresa_id,case_id,actor,action,note,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            randomUUID(),
            u.empresaId,
            id,
            u.username,
            old ? "update" : "create",
            reason,
            {
              revision: row.revision,
              status: row.status,
              data,
              assignedTo: assigned,
            },
          ],
        );
        await event(c, u, "service." + (old ? "update" : "create"), id, {
          kind,
          revision: row.revision,
        });
        return row;
      }),
    );
  });
  r.get("/notifications", async (req, res) => {
    const u = getUser(req),
      clinical = [
        "admin",
        "gestor",
        "medico",
        "tecnico",
        "enfermeiro",
      ].includes(u.funcao || "");
    const items: any[] = [];
    if (clinical) {
      const n = Number(
        (
          await pool.query(
            "SELECT count(*) AS n FROM public.nv_lab_values v WHERE v.empresa_id=$1 AND v.critical AND NOT EXISTS(SELECT 1 FROM public.nv_lab_communications cm WHERE cm.empresa_id=v.empresa_id AND cm.value_id=v.id AND cm.acknowledged)",
            [u.empresaId],
          )
        ).rows[0].n,
      );
      if (n)
        items.push({
          id: "lab-critical",
          title: `${n} resultado(s) crítico(s) sem confirmação`,
          priority: "alta",
          tab: "laboratorio",
        });
    }
    const owned = (
      await pool.query(
        "SELECT id,kind,reference FROM public.nv_cases WHERE empresa_id=$1 AND assigned_to=$2 AND status IN ('aberto','em_curso') ORDER BY updated_at LIMIT 100",
        [u.empresaId, u.username],
      )
    ).rows;
    for (const cs of owned) {
      const spec = SERVICE_DEFINITIONS[cs.kind];
      if (spec?.permission) {
        try {
          await granted(pool, u, spec.permission);
        } catch {
          continue;
        }
      }
      items.push({
        id: cs.id,
        title: `${spec?.label || cs.kind} · ${cs.reference}`,
        priority: "normal",
        tab: "servicos",
      });
    }
    res.json({ items, updatedAt: new Date().toISOString() });
  });
  r.get("/overview", async (req, res) => {
    const u = getUser(req),
      span = [7, 30, 90].includes(Number(req.query.days))
        ? Number(req.query.days)
        : 7;
    const states = (
      await pool.query(
        "SELECT namespace,data FROM public.hospital_state WHERE empresa_id=$1 AND namespace IN ('clinical','nursing-operation','appointments')",
        [u.empresaId],
      )
    ).rows;
    const state = (key: string) =>
      states.find((x: any) => x.namespace === key)?.data;
    const visits = state("clinical")?.visits || [],
      ward = state("nursing-operation") || {},
      appointments = state("appointments") || [];
    const day = (date: any) => {
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Luanda",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(date));
      } catch {
        return "";
      }
    };
    const today = day(Date.now()),
      cutoff = day(Date.now() - (span - 1) * 86400000),
      activeStays = (ward.stays || []).filter((s: any) => !s.closed);
    const resultCount = Number(
      (
        await pool.query(
          "SELECT count(*) AS n FROM public.resultados r WHERE empresa_id=$1 AND data_emissao<>'' AND (paciente_id IS NULL OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.empresa_id=r.empresa_id AND p.id=r.paciente_id))",
          [u.empresaId],
        )
      ).rows[0].n,
    );
    const patientCount = Number(
      (
        await pool.query(
          "SELECT count(*) AS n FROM public.pacientes WHERE empresa_id=$1",
          [u.empresaId],
        )
      ).rows[0].n,
    );
    const labOrders = (
      await pool.query(
        "SELECT created_at FROM public.nv_lab_orders WHERE empresa_id=$1 AND created_at>=now()-($2::int*interval '1 day')",
        [u.empresaId, span],
      )
    ).rows;
    const series = Array.from({ length: span }, (_, i) => {
      const date = day(Date.now() - (span - 1 - i) * 86400000);
      return {
        date,
        consultas: visits.filter((v: any) => day(v.started) === date).length,
        internamentos: (ward.stays || []).filter(
          (s: any) => day(s.started || s.admitted) === date,
        ).length,
        pedidos: labOrders.filter((o: any) => day(o.created_at) === date)
          .length,
      };
    });
    const specialties: Record<string, number> = {};
    for (const v of visits)
      if (day(v.started) >= cutoff) {
        const name = v.specialty || "Não classificada";
        specialties[name] = (specialties[name] || 0) + 1;
      }
    const latestTriage = new Map<number, any>();
    for (const e of [...(ward.events || [])]
      .filter((e: any) => e.kind === "triagem")
      .sort((a: any, b: any) => String(a.created).localeCompare(b.created)))
      latestTriage.set(e.patientId, e);
    const care = ["admin", "gestor", "medico", "enfermeiro"].includes(
      u.funcao || "",
    );
    res.json({
      patientCount,
      resultCount,
      consultationsToday: visits.filter((v: any) => day(v.started) === today)
        .length,
      openConsultations: visits.filter((v: any) => !v.closed).length,
      admissions: activeStays.length,
      beds: (ward.beds || []).length,
      blockedBeds: (ward.beds || []).filter((b: any) => b.blocked).length,
      wards: [...new Set((ward.beds || []).map((b: any) => b.ward))].map(
        (name) => {
          const beds = (ward.beds || []).filter((b: any) => b.ward === name);
          return {
            name,
            total: beds.length,
            occupied: activeStays.filter((s: any) =>
              beds.some((b: any) => b.id === s.bedId),
            ).length,
          };
        },
      ),
      triageWaiting: [...latestTriage.values()].filter(
        (e) => e.values?.estado !== "Atendimento iniciado",
      ).length,
      series,
      specialties: Object.entries(specialties).map(([name, value]) => ({
        name,
        value,
      })),
      recent: care
        ? [...visits]
            .sort((a: any, b: any) =>
              String(b.started).localeCompare(a.started),
            )
            .slice(0, 6)
            .map((v: any) => ({
              id: v.id,
              patient: v.patient?.nome,
              specialty: v.specialty || "Clínica Geral",
              doctor: v.doctor,
              at: v.started,
              status: v.closed ? "Concluída" : "Em atendimento",
            }))
        : [],
      appointments: care
        ? appointments
            .filter(
              (a: any) => a.status !== "cancelado" && day(a.when) === today,
            )
            .slice(0, 6)
            .map((a: any) => ({
              id: a.id,
              when: a.when,
              service: a.service,
              professional: a.professional,
            }))
        : [],
      updatedAt: new Date().toISOString(),
      period: { from: cutoff, to: today, days: span },
      source:
        "Cadastro central; episódios clínicos; operação de enfermagem; pedidos laboratoriais; resultados emitidos.",
    });
  });
  r.post("/result-export/:id", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor", "medico", "tecnico", "enfermeiro"]);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0)
          deny("Identificador inválido.");
        if (req.body?.purpose === "internal") {
          const current = await readStaffReport(c,u.empresaId!,id);
          await event(c,u,"result.export.internal",String(id),{
            version: current.version, state: current.state, provisional: current.trace.provisional,
          });
          return { result: current.result, trace: current.trace };
        }
        const row =
          (
            await c.query(
              "SELECT r.* FROM public.resultados r WHERE r.empresa_id=$1 AND r.id=$2 AND (r.paciente_id IS NULL OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.empresa_id=r.empresa_id AND p.id=r.paciente_id))",
              [u.empresaId, id],
            )
          ).rows[0] || deny("Resultado indisponível.", 404);
        const managed = (
          await c.query(
            "SELECT t.id,t.order_id,o.accession,o.patient_snapshot->>'processo' AS processo FROM public.nv_lab_tests t JOIN public.nv_lab_orders o ON o.empresa_id=t.empresa_id AND o.id=t.order_id WHERE t.empresa_id=$1 AND t.result_id=$2",
            [u.empresaId, id],
          )
        ).rows[0];
        const manual = await assertManualReportPublished(c, u.empresaId!, id);
        let trace: any = manual
          ? { version: manual.version, source: "manual" }
          : null;
        if (managed) {
          const version = (
            await c.query(
              "SELECT v.*,s.code AS sample_code FROM public.nv_lab_values v JOIN public.nv_lab_containers s ON s.empresa_id=v.empresa_id AND s.id=v.container_id WHERE v.empresa_id=$1 AND v.test_id=$2 ORDER BY v.version DESC LIMIT 1",
              [u.empresaId, managed.id],
            )
          ).rows[0];
          if (!version?.released_at)
            deny("A versão mais recente aguarda validação.", 409);
          trace = {
            orderId: managed.order_id,
            accession: managed.accession,
            processo: managed.processo,
            sampleCode: version.sample_code,
            version: version.version,
            technicalBy: version.technical_by,
            releasedBy: version.released_by,
          };
        }
        await event(
          c,
          u,
          "result.export.requested",
          String(id),
          trace || { legacy: true },
        );
        return {
          result: {
            id: row.id,
            pacienteId: row.paciente_id,
            pacienteNome: row.paciente_nome,
            data: row.data,
            dataEmissao: row.data_emissao,
            parametros: row.parametros,
            tecnicoNome: row.tecnico_nome,
          },
          trace,
        };
      }),
    );
  });
  r.post("/finance-export", async (req, res) => {
    const u = getUser(req);
    allowed(u, ["admin", "gestor", "financeiro"]);
    res.json(
      await transaction(pool, u.empresaId!, async (c) => {
        const faturas = (
          await c.query(
            "SELECT * FROM public.faturas WHERE empresa_id=$1 AND coalesce(billing_meta->>'ambiente','')<>'homologacao' ORDER BY id",
            [u.empresaId],
          )
        ).rows;
        const produtos = (
          await c.query(
            "SELECT * FROM public.produtos WHERE empresa_id=$1 ORDER BY id",
            [u.empresaId],
          )
        ).rows;
        const pacientes = (
          await c.query(
            "SELECT id,nome,nif,endereco,telefone FROM public.pacientes WHERE empresa_id=$1 ORDER BY id",
            [u.empresaId],
          )
        ).rows;
        await event(c, u, "finance.export.requested", u.empresaId!, {
          invoices: faturas.length,
          products: produtos.length,
        });
        return {
          exportedAt: new Date().toISOString(),
          type: "exportacao-financeira",
          empresaId: u.empresaId,
          faturas,
          produtos,
          pacientes,
        };
      }),
    );
  });
  r.use(apiErrors);
  return r;
}
export default createInstitutionRouter();

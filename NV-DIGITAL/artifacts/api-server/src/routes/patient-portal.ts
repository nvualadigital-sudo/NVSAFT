import { Router, type Request, type Response } from "express";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { pool as defaultPool } from "@workspace/db";
import { requireEmpresa, getUser } from "../lib/auth.js";
import {
  allowed,
  deny,
  value,
  uuid,
  patient,
  transaction,
  apiErrors,
} from "../lib/governance.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const secret = () => randomBytes(32).toString("hex");
const endpoint = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res)).catch(next);
const json = (v: any) => JSON.stringify(v);
const username = (v: any) => {
  const s = value(v, 120).toLowerCase();
  if (!/^[a-z0-9][a-z0-9@._+-]{3,119}$/.test(s))
    deny("Utilizador: mínimo 4 caracteres, sem espaços ou acentos.");
  return s;
};
const password = (v: any) => {
  if (typeof v !== "string" || v.length < 12 || Buffer.byteLength(v) > 72)
    deny("Use uma palavra-passe de 12 a 72 bytes.");
  return v;
};
const date = (v: any) => {
  const s = value(v, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s ||
    s > new Date().toISOString().slice(0, 10)
  )
    deny("Data de nascimento inválida.");
  return s;
};
const cleanIdentity = (d: any) => ({
  name: value(d.name, 200),
  birth: date(d.birth),
  document: value(d.document, 80),
  phone: value(d.phone, 80),
  address: value(d.address, 300, true),
  email: value(d.email, 120, true),
});
function cookie(req: Request, res: Response, token: string, maxAge: number) {
  res.cookie("nv_patient_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/patient-portal",
    maxAge,
  });
}
function origin(req: Request) {
  if (req.headers["sec-fetch-site"] === "cross-site")
    deny("Origem não autorizada.", 403);
  const o = req.get("origin");
  if (process.env.NODE_ENV === "production" && !process.env.PORTAL_ORIGIN)
    deny("Configure PORTAL_ORIGIN no servidor.", 503);
  if (o) {
    let host = "";
    try {
      host = new URL(o).host;
    } catch {
      deny("Origem inválida.", 403);
    }
    if (
      process.env.PORTAL_ORIGIN
        ? o !== process.env.PORTAL_ORIGIN.replace(/\/$/, "")
        : host !== req.get("host")
    )
      deny("Origem não autorizada.", 403);
  }
}
export function createPatientPortal(pool: any = defaultPool) {
  const r = Router();
  r.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  r.use((req, _res, next) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) origin(req);
      next();
    } catch (e) {
      next(e);
    }
  });
  const limited = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    message: { error: "Muitas tentativas. Aguarde 15 minutos." },
  });
  const audit = async (
    c: any,
    org: any,
    actor: string,
    action: string,
    ref: string,
  ) =>
    c.query(
      "INSERT INTO nv_portal_audit(empresa_id,actor,action,reference) VALUES($1,$2,$3,$4)",
      [org, actor, action, ref],
    );
  const unit = async (c: any, id: any) => {
    const row = (
      await c.query(
        "SELECT p.*,e.nome FROM nv_portal_units p JOIN empresas e ON e.id=p.empresa_id WHERE p.empresa_id=$1 AND p.enabled AND e.ativo",
        [uuid(id)],
      )
    ).rows[0];
    return row || deny("Unidade indisponível.", 404);
  };
  async function session(req: any, res: any, accountId: string) {
    const token = secret(),
      csrf = secret();
    await pool.query(
      "INSERT INTO nv_portal_sessions(token_hash,account_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",
      [hash(token), accountId, csrf],
    );
    cookie(req, res, token, 8 * 3600 * 1000);
    return csrf;
  }
  // Dedicated implementation avoids coupling to staff bearer sessions.
  const requirePatient = (req: any, res: any, next: any) => {
    (async () => {
      const raw = String(req.headers.cookie || "")
        .split(";")
        .map((s: string) => s.trim())
        .find((s: string) => s.startsWith("nv_patient_session="))
        ?.slice("nv_patient_session=".length);
      if (!raw || !/^[a-f0-9]{64}$/.test(raw))
        deny("Entre no portal para continuar.", 401);
      const s = (
        await pool.query(
          "SELECT s.*,a.display_name,a.username FROM nv_portal_sessions s JOIN nv_portal_accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND a.active AND s.revoked_at IS NULL AND s.expires_at>now() AND s.last_seen>now()-interval '30 minutes'",
          [hash(raw!)],
        )
      ).rows[0];
      if (!s) deny("Sessão expirada. Entre novamente.", 401);
      if (
        !["GET", "HEAD"].includes(req.method) &&
        req.get("X-CSRF-Token") !== s.csrf
      )
        deny("Actualize a sessão antes de continuar.", 403);
      req.portal = s;
      await pool.query(
        "UPDATE nv_portal_sessions SET last_seen=now() WHERE token_hash=$1",
        [s.token_hash],
      );
      next();
    })().catch(next);
  };
  const membership = async (c: any, req: any, org: any) => {
    await unit(c, org);
    return (
      (
        await c.query(
          "SELECT * FROM nv_portal_links WHERE account_id=$1 AND empresa_id=$2 AND active",
          [req.portal.account_id, org],
        )
      ).rows[0] ||
      deny("A associação a esta unidade ainda não foi confirmada.", 403)
    );
  };
  r.get(
    "/units",
    endpoint(async (_req: any, res: any) =>
      res.json(
        (
          await pool.query(
            "SELECT p.empresa_id AS id,p.slug,p.public_name AS name,p.phone,p.address FROM nv_portal_units p JOIN empresas e ON e.id=p.empresa_id WHERE p.enabled AND e.ativo ORDER BY p.public_name",
          )
        ).rows,
      ),
    ),
  );
  r.post(
    "/register",
    limited,
    endpoint(async (req: any, res: any) => {
      const d = req.body,
        identity = cleanIdentity(d),
        user = username(d.username),
        pw = await bcrypt.hash(password(d.password), 12),
        org = uuid(d.unitId);
      const account = await transaction(pool, org, async (c: any) => {
        await unit(c, org);
        const id = randomUUID();
        await c.query(
          "INSERT INTO nv_portal_accounts(id,username,password_hash,display_name) VALUES($1,$2,$3,$4)",
          [id, user, pw, identity.name],
        );
        await c.query(
          "INSERT INTO nv_portal_requests(id,account_id,empresa_id,kind,data) VALUES($1,$2,$3,'cadastro',$4)",
          [randomUUID(), id, org, json(identity)],
        );
        await audit(c, org, id, "account.register", id);
        return id;
      });
      const csrf = await session(req, res, account);
      res.status(201).json({
        csrf,
        message:
          "Registo recebido. A unidade confirmará a identidade e a associação ao processo.",
      });
    }),
  );
  r.post(
    "/login",
    limited,
    endpoint(async (req: any, res: any) => {
      const name = username(req.body.username),
        pw = value(req.body.password, 100);
      const a = (
        await pool.query("SELECT * FROM nv_portal_accounts WHERE username=$1", [
          name,
        ])
      ).rows[0];
      // Fixed bcrypt work for unknown names; failures persist across server restarts.
      const ok = await bcrypt.compare(
        pw,
        a?.password_hash ||
          "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
      );
      if (
        !a ||
        !a.active ||
        (a.locked_until && new Date(a.locked_until).getTime() > Date.now()) ||
        !ok
      ) {
        if (a)
          await pool.query(
            "UPDATE nv_portal_accounts SET failures=failures+1,locked_until=CASE WHEN failures+1>=10 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1",
            [a.id],
          );
        deny("Credenciais inválidas ou acesso temporariamente bloqueado.", 401);
      }
      await pool.query(
        "UPDATE nv_portal_accounts SET failures=0,locked_until=NULL WHERE id=$1",
        [a.id],
      );
      res.json({ csrf: await session(req, res, a.id) });
    }),
  );
  r.post(
    "/recovery",
    limited,
    endpoint(async (req: any, res: any) => {
      const org = uuid(req.body.unitId);
      await unit(pool, org);
      await pool.query(
        "INSERT INTO nv_portal_resets(id,empresa_id,username,contact) VALUES($1,$2,$3,$4)",
        [
          randomUUID(),
          org,
          username(req.body.username),
          value(req.body.contact, 150),
        ],
      );
      res.json({
        message:
          "Pedido recebido. A unidade verificará a identidade antes de repor o acesso.",
      });
    }),
  );
  r.post(
    "/reset",
    limited,
    endpoint(async (req: any, res: any) => {
      const token = value(req.body.token, 80),
        pw = await bcrypt.hash(password(req.body.password), 12);
      await transaction(pool, "portal-reset:" + hash(token), async (c: any) => {
        const t =
          (
            await c.query(
              "SELECT * FROM nv_portal_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE",
              [hash(token)],
            )
          ).rows[0] || deny("Código inválido ou expirado.", 400);
        await c.query(
          "UPDATE nv_portal_tokens SET used_at=now() WHERE token_hash=$1",
          [hash(token)],
        );
        await c.query(
          "UPDATE nv_portal_accounts SET password_hash=$2,failures=0,locked_until=NULL WHERE id=$1",
          [t.account_id, pw],
        );
        await c.query(
          "UPDATE nv_portal_sessions SET revoked_at=now() WHERE account_id=$1",
          [t.account_id],
        );
        await audit(c, null, t.account_id, "account.reset", t.account_id);
      });
      res.json({ message: "Palavra-passe alterada. Entre novamente." });
    }),
  );
  r.use(requirePatient);
  r.get(
    "/session",
    endpoint(async (req: any, res: any) =>
      res.json({
        csrf: req.portal.csrf,
        name: req.portal.display_name,
        username: req.portal.username,
        links: (
          await pool.query(
            "SELECT l.empresa_id AS id,p.public_name AS name,l.active FROM nv_portal_links l JOIN nv_portal_units p ON p.empresa_id=l.empresa_id JOIN empresas e ON e.id=l.empresa_id WHERE l.account_id=$1 AND l.active AND p.enabled AND e.ativo",
            [req.portal.account_id],
          )
        ).rows,
        requests: (
          await pool.query(
            "SELECT id,empresa_id,kind,status,response,created_at FROM nv_portal_requests WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100",
            [req.portal.account_id],
          )
        ).rows,
      }),
    ),
  );
  r.post(
    "/logout",
    endpoint(async (req: any, res: any) => {
      await pool.query(
        "UPDATE nv_portal_sessions SET revoked_at=now() WHERE token_hash=$1",
        [req.portal.token_hash],
      );
      cookie(req, res, "", 0);
      res.json({ ok: true });
    }),
  );
  r.post(
    "/password",
    limited,
    endpoint(async (req: any, res: any) => {
      const a = (
        await pool.query(
          "SELECT password_hash FROM nv_portal_accounts WHERE id=$1",
          [req.portal.account_id],
        )
      ).rows[0];
      if (
        !(await bcrypt.compare(
          value(req.body.currentPassword, 100),
          a.password_hash,
        ))
      )
        deny("Palavra-passe actual incorrecta.", 403);
      const pw = await bcrypt.hash(password(req.body.password), 12);
      await transaction(pool, req.portal.account_id, async (c: any) => {
        await c.query(
          "UPDATE nv_portal_accounts SET password_hash=$2 WHERE id=$1",
          [req.portal.account_id, pw],
        );
        await c.query(
          "UPDATE nv_portal_sessions SET revoked_at=now() WHERE account_id=$1",
          [req.portal.account_id],
        );
        await audit(
          c,
          null,
          req.portal.account_id,
          "account.password",
          req.portal.account_id,
        );
      });
      cookie(req, res, "", 0);
      res.json({ message: "Palavra-passe alterada. Entre novamente." });
    }),
  );
  r.post(
    "/requests",
    limited,
    endpoint(async (req: any, res: any) => {
      const d = req.body,
        org = uuid(d.unitId),
        kind = d.kind;
      if (!["cadastro", "contacto", "seguro"].includes(kind))
        deny("Tipo de pedido inválido.");
      const data =
        kind === "cadastro"
          ? cleanIdentity(d)
          : { message: value(d.message, 2000) };
      await transaction(pool, org, async (c: any) => {
        await unit(c, org);
        if (kind !== "cadastro") await membership(c, req, org);
        await c.query(
          "INSERT INTO nv_portal_requests(id,account_id,empresa_id,kind,data) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), req.portal.account_id, org, kind, json(data)],
        );
        await audit(c, org, req.portal.account_id, "request.create", kind);
      });
      res.status(201).json({ message: "Pedido enviado à unidade." });
    }),
  );
  r.get(
    "/units/:org/data",
    endpoint(async (req: any, res: any) => {
      const org = uuid(req.params.org);
      const data = await transaction(pool, org, async (c: any) => {
        const l = await membership(c, req, org),
          p = l.patient_id;
        const profile = (
          await c.query(
            "SELECT nome,nasc,sexo,processo,telefone,email,endereco FROM pacientes WHERE empresa_id=$1 AND id=$2",
            [org, p],
          )
        ).rows[0];
        const appointments = (
          await c.query(
            "SELECT a.id,a.status,s.specialty,s.location,s.starts_at,s.ends_at,f.nome AS clinician FROM nv_portal_appointments a JOIN nv_portal_slots s ON s.empresa_id=a.empresa_id AND s.id=a.slot_id JOIN funcionarios f ON f.id=s.clinician_id AND f.empresa_id=s.empresa_id WHERE a.empresa_id=$1 AND a.account_id=$2 AND a.patient_id=$3 ORDER BY s.starts_at DESC LIMIT 200",
            [org, req.portal.account_id, p],
          )
        ).rows;
        const results = (
          await c.query(
            "SELECT v.id,v.version,v.released_at,v.released_by,t.snapshot->>'name' AS title,v.data->>'measured' AS measured,v.data->>'unit' AS unit,v.data->>'reference' AS reference,v.data->>'method' AS method,v.data->>'comment' AS comment FROM nv_lab_values v JOIN nv_lab_tests t ON t.empresa_id=v.empresa_id AND t.id=v.test_id JOIN nv_lab_orders o ON o.empresa_id=t.empresa_id AND o.id=t.order_id WHERE o.empresa_id=$1 AND o.patient_id=$2 AND o.cancelled_at IS NULL AND v.released_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nv_lab_values n WHERE n.empresa_id=v.empresa_id AND n.test_id=v.test_id AND n.version>v.version) ORDER BY v.released_at DESC LIMIT 200",
            [org, p],
          )
        ).rows;
        const documents = (
          await c.query(
            "SELECT id,kind,title,body,author_name,created_at FROM nv_portal_documents WHERE empresa_id=$1 AND patient_id=$2 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 200",
            [org, p],
          )
        ).rows;
        const invoices = (
          await c.query(
            "SELECT id,numero,serie,data,total,estado,tipo_documento,forma_pagamento FROM faturas WHERE empresa_id=$1 AND paciente_id=$2 AND (billing_meta IS NULL OR coalesce(billing_meta->>'ambiente',billing_meta->>'environment','') NOT IN ('homologacao','homologação','training','test')) AND estado<>'rascunho' AND coalesce(billing_meta->>'training','false')<>'true' ORDER BY id DESC LIMIT 200",
            [org, p],
          )
        ).rows;
        await audit(c, org, req.portal.account_id, "patient.read", String(p));
        return { profile, appointments, results, documents, invoices };
      });
      res.json(data);
    }),
  );
  r.get(
    "/units/:org/slots",
    endpoint(async (req: any, res: any) => {
      const org = uuid(req.params.org);
      await membership(pool, req, org);
      res.json(
        (
          await pool.query(
            "SELECT s.id,s.specialty,s.location,s.starts_at,s.ends_at,f.nome AS clinician FROM nv_portal_slots s JOIN funcionarios f ON f.id=s.clinician_id AND f.empresa_id=s.empresa_id WHERE s.empresa_id=$1 AND s.active AND f.ativo AND f.funcao='medico' AND s.starts_at>now() AND s.starts_at<now()+interval '180 days' AND NOT EXISTS(SELECT 1 FROM nv_portal_appointments a WHERE a.slot_id=s.id AND a.status<>'cancelada') ORDER BY s.starts_at LIMIT 400",
            [org],
          )
        ).rows,
      );
    }),
  );
  r.post(
    "/appointments",
    endpoint(async (req: any, res: any) => {
      const org = uuid(req.body.unitId),
        slot = uuid(req.body.slotId),
        requestId = uuid(req.body.requestId);
      const data = await transaction(pool, org, async (c: any) => {
        const l = await membership(c, req, org);
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          "portal-account:" + req.portal.account_id,
        ]);
        const old = (
          await c.query(
            "SELECT id,slot_id,empresa_id,status FROM nv_portal_appointments WHERE account_id=$1 AND request_id=$2",
            [req.portal.account_id, requestId],
          )
        ).rows[0];
        if (old) {
          if (old.slot_id !== slot || old.empresa_id !== org)
            deny("Chave reutilizada.", 409);
          return old;
        }
        const s =
          (
            await c.query(
              "SELECT s.* FROM nv_portal_slots s JOIN funcionarios f ON f.id=s.clinician_id AND f.empresa_id=s.empresa_id WHERE s.id=$1 AND s.empresa_id=$2 AND s.active AND f.ativo AND f.funcao='medico' AND s.starts_at>now() FOR UPDATE",
              [slot, org],
            )
          ).rows[0] || deny("Horário indisponível.", 409);
        if (
          (
            await c.query(
              "SELECT 1 FROM nv_portal_appointments a JOIN nv_portal_slots s ON s.id=a.slot_id WHERE a.account_id=$1 AND a.status='marcada' AND s.starts_at<$3 AND s.ends_at>$2",
              [req.portal.account_id, s.starts_at, s.ends_at],
            )
          ).rowCount
        )
          deny("Já tem uma consulta nesse período.", 409);
        const id = randomUUID();
        await c.query(
          "INSERT INTO nv_portal_appointments(id,empresa_id,slot_id,account_id,patient_id,request_id) VALUES($1,$2,$3,$4,$5,$6)",
          [id, org, slot, req.portal.account_id, l.patient_id, requestId],
        );
        await audit(c, org, req.portal.account_id, "appointment.book", id);
        return { id, status: "marcada" };
      });
      res.status(201).json(data);
    }),
  );
  r.post(
    "/appointments/:id/cancel",
    endpoint(async (req: any, res: any) => {
      const org = uuid(req.body.unitId);
      await transaction(pool, org, async (c: any) => {
        await membership(c, req, org);
        const a =
          (
            await c.query(
              "UPDATE nv_portal_appointments a SET status='cancelada',updated_at=now() FROM nv_portal_slots s WHERE a.slot_id=s.id AND a.empresa_id=$1 AND a.account_id=$2 AND a.id=$3 AND a.status='marcada' AND s.starts_at>now() RETURNING a.id",
              [org, req.portal.account_id, uuid(req.params.id)],
            )
          ).rows[0] ||
          deny("Só pode cancelar uma consulta futura e marcada.", 409);
        await audit(c, org, req.portal.account_id, "appointment.cancel", a.id);
      });
      res.json({ ok: true });
    }),
  );
  r.use(apiErrors);
  return r;
}
export function createPatientPortalStaff(pool: any = defaultPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use((req, res, next) => {
    try {
      allowed(getUser(req), [
        "admin",
        "gestor",
        "rececionista",
        "medico",
        "tecnico",
      ]);
      res.set("Cache-Control", "no-store");
      next();
    } catch (e) {
      next(e);
    }
  });
  const audit = async (c: any, u: any, action: string, ref: string) =>
    c.query(
      "INSERT INTO nv_portal_audit(empresa_id,actor,action,reference) VALUES($1,$2,$3,$4)",
      [u.empresaId, u.username, action, ref],
    );
  const front = (u: any) => allowed(u, ["admin", "gestor", "rececionista"]);
  r.get(
    "/overview",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req),
        org = u.empresaId;
      res.json({
        role: u.funcao,
        unit:
          (
            await pool.query(
              "SELECT * FROM nv_portal_units WHERE empresa_id=$1",
              [org],
            )
          ).rows[0] || null,
        workers: (
          await pool.query(
            "SELECT id,nome,funcao FROM funcionarios WHERE empresa_id=$1 AND ativo AND funcao='medico' ORDER BY nome",
            [org],
          )
        ).rows,
        requests: ["admin", "gestor", "rececionista"].includes(u.funcao || "")
          ? (
              await pool.query(
                "SELECT r.*,a.username,a.display_name FROM nv_portal_requests r JOIN nv_portal_accounts a ON a.id=r.account_id WHERE r.empresa_id=$1 ORDER BY r.created_at DESC LIMIT 100",
                [org],
              )
            ).rows
          : [],
        recovery: ["admin", "gestor", "rececionista"].includes(u.funcao || "")
          ? (
              await pool.query(
                "SELECT id,username,contact,created_at FROM nv_portal_resets WHERE empresa_id=$1 AND status='pendente' ORDER BY created_at DESC LIMIT 100",
                [org],
              )
            ).rows
          : [],
        slots: (
          await pool.query(
            "SELECT s.*,f.nome AS clinician FROM nv_portal_slots s JOIN funcionarios f ON f.id=s.clinician_id AND f.empresa_id=s.empresa_id WHERE s.empresa_id=$1 AND s.starts_at>now()-interval '7 days' ORDER BY s.starts_at LIMIT 400",
            [org],
          )
        ).rows,
        appointments:
          u.funcao === "tecnico"
            ? []
            : (
                await pool.query(
                  "SELECT a.id,a.status,a.patient_id,p.nome,s.specialty,s.starts_at,s.ends_at,f.nome AS clinician FROM nv_portal_appointments a JOIN pacientes p ON p.id=a.patient_id AND p.empresa_id=a.empresa_id JOIN nv_portal_slots s ON s.id=a.slot_id JOIN funcionarios f ON f.id=s.clinician_id WHERE a.empresa_id=$1 ORDER BY s.starts_at DESC LIMIT 200",
                  [org],
                )
              ).rows,
      });
    }),
  );
  r.post(
    "/settings",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      allowed(u, ["admin", "gestor"]);
      const d = req.body,
        slug = value(d.slug, 50).toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug))
        deny("Endereço da unidade: 3–50 letras minúsculas, números e hífen.");
      await transaction(pool, u.empresaId!, async (c: any) => {
        await c.query(
          "INSERT INTO nv_portal_units(empresa_id,slug,enabled,public_name,phone,address,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(empresa_id) DO UPDATE SET slug=$2,enabled=$3,public_name=$4,phone=$5,address=$6,updated_by=$7,updated_at=now()",
          [
            u.empresaId,
            slug,
            d.enabled === true,
            value(d.name, 150),
            value(d.phone, 80, true),
            value(d.address, 300, true),
            u.username,
          ],
        );
        await audit(c, u, "unit.configure", slug);
      });
      res.json({ ok: true });
    }),
  );
  r.get(
    "/patients",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      allowed(u, ["admin", "gestor", "rececionista", "medico"]);
      const search = value(req.query.q, 100);
      if (search.length < 2) deny("Escreva pelo menos 2 caracteres.");
      res.json(
        (
          await pool.query(
            "SELECT id,nome,nasc,processo,bi FROM pacientes WHERE empresa_id=$1 AND (nome ILIKE $2 OR processo ILIKE $2 OR bi ILIKE $2) ORDER BY nome LIMIT 30",
            [u.empresaId, "%" + search + "%"],
          )
        ).rows,
      );
    }),
  );
  r.post(
    "/requests/:id/review",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      front(u);
      await transaction(pool, u.empresaId!, async (c: any) => {
        const q =
          (
            await c.query(
              "SELECT * FROM nv_portal_requests WHERE id=$1 AND empresa_id=$2 AND status='pendente' FOR UPDATE",
              [uuid(req.params.id), u.empresaId],
            )
          ).rows[0] || deny("Pedido já tratado ou inexistente.", 409);
        const note = value(req.body.response, 1000),
          approve = req.body.approve === true;
        if (approve && q.kind === "cadastro") {
          if (req.body.identityVerified !== true)
            deny(
              "Confirme presencialmente ou por canal institucional a identidade do titular.",
              400,
            );
          const p = await patient(c, u.empresaId!, req.body.patientId);
          await c.query(
            "INSERT INTO nv_portal_links(account_id,empresa_id,patient_id,verified_by,verification_note) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,empresa_id) DO UPDATE SET active=true,verified_by=$4,verification_note=$5 WHERE nv_portal_links.patient_id=$3",
            [q.account_id, u.empresaId, p.id, u.username, note],
          );
          const link = (
            await c.query(
              "SELECT patient_id FROM nv_portal_links WHERE account_id=$1 AND empresa_id=$2",
              [q.account_id, u.empresaId],
            )
          ).rows[0];
          if (link?.patient_id !== p.id)
            deny(
              "Esta conta já corresponde a outro processo. Revogue e investigue a associação.",
              409,
            );
        }
        await c.query(
          "UPDATE nv_portal_requests SET status=$3,response=$4,reviewed_by=$5,reviewed_at=now() WHERE id=$1 AND empresa_id=$2",
          [
            q.id,
            u.empresaId,
            approve ? "aprovado" : "recusado",
            note,
            u.username,
          ],
        );
        await audit(c, u, "request.review", q.id);
      });
      res.json({ ok: true });
    }),
  );
  r.post(
    "/requests/:id/create-patient",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      front(u);
      if (
        req.body.identityVerified !== true ||
        req.body.newPatientConfirmed !== true
      )
        deny(
          "Verifique a identidade e confirme que não existe processo anterior.",
        );
      const note = value(req.body.response, 1000);
      const out = await transaction(pool, u.empresaId!, async (c: any) => {
        const q =
          (
            await c.query(
              "SELECT * FROM nv_portal_requests WHERE empresa_id=$1 AND id=$2 AND kind='cadastro' AND status='pendente' FOR UPDATE",
              [u.empresaId, uuid(req.params.id)],
            )
          ).rows[0] || deny("Pedido já tratado ou inexistente.", 409);
        const d = cleanIdentity(q.data);
        if (
          (
            await c.query(
              "SELECT 1 FROM pacientes WHERE empresa_id=$1 AND (lower(trim(bi))=lower($2) OR lower(trim(passaporte))=lower($2))",
              [u.empresaId, d.document],
            )
          ).rowCount
        )
          deny(
            "Já existe um processo com este documento. Pesquise e associe o processo existente.",
            409,
          );
        if (
          (
            await c.query(
              "SELECT 1 FROM nv_portal_links WHERE empresa_id=$1 AND account_id=$2",
              [u.empresaId, q.account_id],
            )
          ).rowCount
        )
          deny("Esta conta já tem uma associação nesta unidade.", 409);
        const p = (
          await c.query(
            "INSERT INTO pacientes(empresa_id,nome,nasc,bi,telefone,email,endereco) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,processo",
            [
              u.empresaId,
              d.name,
              d.birth,
              d.document,
              d.phone,
              d.email,
              d.address,
            ],
          )
        ).rows[0];
        await c.query(
          "INSERT INTO nv_portal_links(account_id,empresa_id,patient_id,verified_by,verification_note) VALUES($1,$2,$3,$4,$5)",
          [q.account_id, u.empresaId, p.id, u.username, note],
        );
        await c.query(
          "UPDATE nv_portal_requests SET status='aprovado',response=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$1",
          [q.id, note, u.username],
        );
        await audit(c, u, "patient.create-link", String(p.id));
        return p;
      });
      res.status(201).json(out);
    }),
  );
  r.get(
    "/links",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      front(u);
      res.json(
        (
          await pool.query(
            "SELECT l.account_id,l.patient_id,l.active,l.verified_by,l.created_at,p.nome,p.processo,a.username FROM nv_portal_links l JOIN pacientes p ON p.id=l.patient_id AND p.empresa_id=l.empresa_id JOIN nv_portal_accounts a ON a.id=l.account_id WHERE l.empresa_id=$1 ORDER BY l.created_at DESC LIMIT 200",
            [u.empresaId],
          )
        ).rows,
      );
    }),
  );
  r.get(
    "/documents",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      allowed(u, ["medico"]);
      res.json(
        (
          await pool.query(
            "SELECT d.id,d.patient_id,d.kind,d.title,d.created_at,d.revoked_at,p.nome FROM nv_portal_documents d JOIN pacientes p ON p.id=d.patient_id AND p.empresa_id=d.empresa_id WHERE d.empresa_id=$1 AND d.author_id=$2 ORDER BY d.created_at DESC LIMIT 100",
            [u.empresaId, u.funcionarioId],
          )
        ).rows,
      );
    }),
  );
  r.post(
    "/links/revoke",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      allowed(u, ["admin", "gestor"]);
      await transaction(pool, u.empresaId!, async (c: any) => {
        const reason = value(req.body.reason, 1000);
        const row =
          (
            await c.query(
              "UPDATE nv_portal_links SET active=false,verification_note=$3 WHERE account_id=$1 AND empresa_id=$2 RETURNING account_id",
              [uuid(req.body.accountId), u.empresaId, reason],
            )
          ).rows[0] || deny("Associação inexistente.", 404);
        await audit(c, u, "link.revoke", row.account_id);
      });
      res.json({ ok: true });
    }),
  );
  r.post(
    "/recovery/:id/token",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      front(u);
      if (req.body.identityVerified !== true)
        deny("Confirme a identidade antes de repor o acesso.");
      value(req.body.reason, 1000);
      const token = secret();
      await transaction(pool, u.empresaId!, async (c: any) => {
        const q =
          (
            await c.query(
              "SELECT * FROM nv_portal_resets WHERE id=$1 AND empresa_id=$2 AND status='pendente' FOR UPDATE",
              [uuid(req.params.id), u.empresaId],
            )
          ).rows[0] || deny("Pedido inexistente.", 404);
        const a =
          (
            await c.query(
              "SELECT a.id FROM nv_portal_accounts a JOIN nv_portal_links l ON l.account_id=a.id WHERE a.username=$1 AND l.empresa_id=$2 AND l.active",
              [q.username, u.empresaId],
            )
          ).rows[0] || deny("Conta sem associação activa nesta unidade.", 404);
        await c.query(
          "UPDATE nv_portal_tokens SET used_at=now() WHERE account_id=$1 AND used_at IS NULL",
          [a.id],
        );
        await c.query(
          "INSERT INTO nv_portal_tokens(token_hash,account_id,created_by,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
          [hash(token), a.id, u.username],
        );
        await c.query(
          "UPDATE nv_portal_resets SET status='tratado' WHERE id=$1",
          [q.id],
        );
        await audit(c, u, "account.recovery", a.id);
      });
      res.json({
        token,
        message:
          "Entregue este código ao titular por canal confirmado. Válido por 30 minutos; utilização única.",
      });
    }),
  );
  r.post(
    "/slots",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      front(u);
      const d = req.body,
        id = randomUUID(),
        clinician = uuid(d.clinicianId),
        start = new Date(d.start),
        end = new Date(d.end);
      if (
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        start.getTime() <= Date.now() ||
        end.getTime() <= start.getTime() ||
        end.getTime() - start.getTime() > 4 * 3600000
      )
        deny("Escolha um horário futuro com duração de até 4 horas.");
      await transaction(pool, u.empresaId!, async (c: any) => {
        const f =
          (
            await c.query(
              "SELECT id FROM funcionarios WHERE id=$1 AND empresa_id=$2 AND ativo AND funcao='medico'",
              [clinician, u.empresaId],
            )
          ).rows[0] || deny("Seleccione um médico activo desta unidade.");
        void f;
        if (
          (
            await c.query(
              "SELECT 1 FROM nv_portal_slots WHERE empresa_id=$1 AND clinician_id=$2 AND active AND starts_at<$4 AND ends_at>$3",
              [u.empresaId, clinician, start, end],
            )
          ).rowCount
        )
          deny("Já existe um horário sobreposto para este médico.", 409);
        await c.query(
          "INSERT INTO nv_portal_slots(id,empresa_id,clinician_id,specialty,location,starts_at,ends_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            id,
            u.empresaId,
            clinician,
            value(d.specialty, 120),
            value(d.location, 200),
            start,
            end,
            u.username,
          ],
        );
        await audit(c, u, "slot.create", id);
      });
      res.status(201).json({ id });
    }),
  );
  r.post(
    "/slots/:id/close",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      front(u);
      await transaction(pool, u.empresaId!, async (c: any) => {
        const id = uuid(req.params.id);
        if (
          (
            await c.query(
              "SELECT 1 FROM nv_portal_appointments WHERE empresa_id=$1 AND slot_id=$2 AND status<>'cancelada'",
              [u.empresaId, id],
            )
          ).rowCount
        )
          deny("Cancele a consulta antes de retirar o horário.", 409);
        if (
          !(
            await c.query(
              "UPDATE nv_portal_slots SET active=false WHERE empresa_id=$1 AND id=$2 RETURNING id",
              [u.empresaId, id],
            )
          ).rowCount
        )
          deny("Horário inexistente.", 404);
        await audit(c, u, "slot.close", id);
      });
      res.json({ ok: true });
    }),
  );
  r.post(
    "/appointments/:id/status",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      front(u);
      const s = req.body.status;
      if (!["cancelada", "realizada", "faltou"].includes(s))
        deny("Estado inválido.");
      const reason = value(req.body.reason, 1000);
      await transaction(pool, u.empresaId!, async (c: any) => {
        const a =
          (
            await c.query(
              "SELECT a.id,s.ends_at FROM nv_portal_appointments a JOIN nv_portal_slots s ON s.id=a.slot_id WHERE a.id=$1 AND a.empresa_id=$2 AND a.status='marcada' FOR UPDATE",
              [uuid(req.params.id), u.empresaId],
            )
          ).rows[0] || deny("Consulta já encerrada ou inexistente.", 409);
        if (s !== "cancelada" && new Date(a.ends_at).getTime() > Date.now())
          deny("O horário da consulta ainda não terminou.", 409);
        await c.query(
          "UPDATE nv_portal_appointments SET status=$2,status_note=$3,updated_by=$4,updated_at=now() WHERE id=$1",
          [a.id, s, reason, u.username],
        );
        await audit(c, u, "appointment." + s, a.id);
      });
      res.json({ ok: true });
    }),
  );
  r.post(
    "/documents",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      allowed(u, ["medico"]);
      if (!u.funcionarioId)
        deny("É necessária uma conta profissional individual.", 403);
      const d = req.body;
      if (!["resumo", "receita"].includes(d.kind))
        deny("Tipo de documento inválido.");
      const id = randomUUID();
      await transaction(pool, u.empresaId!, async (c: any) => {
        const cred = (
          await c.query(
            "SELECT data FROM nv_professionals WHERE empresa_id=$1 AND funcionario_id=$2",
            [u.empresaId, u.funcionarioId],
          )
        ).rows[0]?.data;
        if (
          !cred ||
          cred.status !== "activo" ||
          !cred.verifiedBy ||
          !cred.validUntil ||
          !Number.isFinite(new Date(cred.validUntil).getTime()) ||
          new Date(cred.validUntil).getTime() <= Date.now()
        )
          deny("Credencial profissional não verificada ou expirada.", 403);
        const p = await patient(c, u.empresaId!, d.patientId);
        await c.query(
          "INSERT INTO nv_portal_documents(id,empresa_id,patient_id,kind,title,body,author_id,author_name,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            id,
            u.empresaId,
            p.id,
            d.kind,
            value(d.title, 200),
            value(d.body, 10000),
            u.funcionarioId,
            u.funcionarioNome || u.username,
            u.username,
          ],
        );
        await audit(c, u, "document.publish", id);
      });
      res.status(201).json({ id });
    }),
  );
  r.post(
    "/documents/:id/revoke",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      allowed(u, ["medico"]);
      const q = await pool.query(
        "UPDATE nv_portal_documents SET revoked_at=now(),revoke_reason=$4 WHERE empresa_id=$1 AND id=$2 AND author_id=$3 AND revoked_at IS NULL RETURNING id",
        [
          u.empresaId,
          uuid(req.params.id),
          u.funcionarioId,
          value(req.body.reason, 1000),
        ],
      );
      if (!q.rowCount) deny("Documento indisponível para este autor.", 404);
      await audit(pool, u, "document.revoke", String(req.params.id));
      res.json({ ok: true });
    }),
  );
  r.get(
    "/audit",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      allowed(u, ["admin", "gestor"]);
      res.json(
        (
          await pool.query(
            "SELECT actor,action,reference,created_at FROM nv_portal_audit WHERE empresa_id=$1 ORDER BY id DESC LIMIT 100",
            [u.empresaId],
          )
        ).rows,
      );
    }),
  );
  r.use(apiErrors);
  return r;
}
export default createPatientPortal();
export const patientPortalStaff = createPatientPortalStaff();

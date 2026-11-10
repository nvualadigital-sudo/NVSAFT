import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import {
  createPatientPortal,
  createPatientPortalStaff,
} from "../artifacts/api-server/src/routes/patient-portal";
const pg = new PGlite();
let queue = Promise.resolve();
const pool: any = {
  query: (q: string, p?: any[]) => pg.query(q, p),
  connect: async () => {
    const prior = queue;
    let release!: () => void;
    queue = new Promise((r) => (release = r));
    await prior;
    return { query: (q: string, p?: any[]) => pg.query(q, p), release };
  },
};
const A = randomUUID(),
  B = randomUUID(),
  doctor = randomUUID(),
  otherDoctor = randomUUID();
let patientA: number,
  patientB: number,
  accountA: string,
  accountB: string,
  registration: string,
  slot: string,
  booking: string,
  documentId: string;
const actors: any = {
  admin: { role: "empresa", funcao: "admin", empresaId: A, username: "admin" },
  reception: {
    role: "empresa",
    funcao: "rececionista",
    empresaId: A,
    username: "recepcao",
  },
  tech: { role: "empresa", funcao: "tecnico", empresaId: A, username: "tech" },
  med: {
    role: "empresa",
    funcao: "medico",
    empresaId: A,
    username: "doctor",
    funcionarioId: doctor,
    funcionarioNome: "Médico A",
  },
  foreign: {
    role: "empresa",
    funcao: "admin",
    empresaId: B,
    username: "foreign",
  },
  finance: {
    role: "empresa",
    funcao: "financeiro",
    empresaId: A,
    username: "finance",
  },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).user = actors[String(req.headers["x-actor"])];
  next();
});
app.use("/public", createPatientPortal(pool));
app.use("/staff", createPatientPortalStaff(pool));
const get = (p: string, actor = "admin") =>
  request(app)
    .get("/staff" + p)
    .set("x-actor", actor);
const post = (p: string, d: any, actor = "admin") =>
  request(app)
    .post("/staff" + p)
    .set("x-actor", actor)
    .send(d);
const pass = "Safe-test-password-2026!";
let cookieA = "",
  csrfA = "",
  cookieB = "",
  csrfB = "";
const publicPost = (p: string, d: any, asB = false) =>
  request(app)
    .post("/public" + p)
    .set("Cookie", asB ? cookieB : cookieA)
    .set("X-CSRF-Token", asB ? csrfB : csrfA)
    .send(d);
const publicGet = (p: string, asB = false) =>
  request(app)
    .get("/public" + p)
    .set("Cookie", asB ? cookieB : cookieA);
function saveSession(r: any, asB = false) {
  const cookie = r.headers["set-cookie"][0].split(";")[0];
  if (asB) {
    cookieB = cookie;
    csrfB = r.body.csrf;
  } else {
    cookieA = cookie;
    csrfA = r.body.csrf;
  }
  assert.match(cookie, /nv_patient_session=/);
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  assert.match(r.headers["set-cookie"][0], /SameSite=Strict/);
}
before(async () => {
  await applyMigrations(pg, "migrations", () => {});
  for (const [id, name] of [
    [A, "Clínica A"],
    [B, "Clínica B"],
  ])
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$2,'not-exposed')",
      [id, name],
    );
  for (const [id, org, name] of [
    [doctor, A, "Médico A"],
    [otherDoctor, B, "Médico B"],
  ])
    await pg.query(
      "INSERT INTO funcionarios(id,empresa_id,nome,username,password,funcao) VALUES($1,$2,$3,$3,'not-exposed','medico')",
      [id, org, name],
    );
  patientA = (
    await pg.query<any>(
      "INSERT INTO pacientes(empresa_id,nome,nasc,bi,processo,observacoes) VALUES($1,'Paciente A','1990-01-01','BI-A','PROC-A','internal-confidential-note') RETURNING id",
      [A],
    )
  ).rows[0].id;
  patientB = (
    await pg.query<any>(
      "INSERT INTO pacientes(empresa_id,nome,nasc,bi,processo) VALUES($1,'Paciente B','1985-01-01','BI-B','PROC-B') RETURNING id",
      [B],
    )
  ).rows[0].id;
});
after(async () => pg.close());
test("unit publication is opt-in, institutional and role scoped", async () => {
  assert.equal((await request(app).get("/public/units")).body.length, 0);
  assert.equal((await get("/overview", "none")).status, 401);
  assert.equal((await get("/overview", "finance")).status, 403);
  assert.equal(
    (
      await post(
        "/settings",
        { slug: "clinic-a", name: "Clínica A", enabled: true },
        "reception",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post("/settings", {
        slug: "clinic-a",
        name: "Clínica A",
        enabled: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        "/settings",
        { slug: "clinic-b", name: "Clínica B", enabled: true },
        "foreign",
      )
    ).status,
    200,
  );
  const units = await request(app).get("/public/units");
  assert.equal(units.body.length, 2);
  assert.ok(!units.text.includes("password"));
});
test("registration never matches medical records by document alone and stores only password hashes", async () => {
  const d = {
    unitId: A,
    name: "Paciente A",
    birth: "1990-01-01",
    document: "BI-A",
    phone: "900000001",
    username: "patient-a",
    password: pass,
  };
  assert.equal(
    (await publicPost("/register", { ...d, password: "Silva" })).status,
    400,
  );
  assert.equal(
    (await publicPost("/register", { ...d, birth: "2026-02-31" })).status,
    400,
  );
  const r = await publicPost("/register", d);
  assert.equal(r.status, 201, r.text);
  saveSession(r);
  const s = await publicGet("/session");
  accountA = (
    await pg.query<any>(
      "SELECT id,password_hash FROM nv_portal_accounts WHERE username='patient-a'",
    )
  ).rows[0].id;
  assert.equal(s.body.links.length, 0);
  assert.equal((await publicGet(`/units/${A}/data`)).status, 403);
  registration = s.body.requests[0].id;
  const a = (
    await pg.query<any>(
      "SELECT password_hash FROM nv_portal_accounts WHERE id=$1",
      [accountA],
    )
  ).rows[0];
  assert.match(a.password_hash, /^\$2/);
  assert.ok(!r.text.includes("password"));
});
test("staff cannot approve foreign processes or link before identity verification", async () => {
  assert.equal(
    (
      await post(
        `/requests/${registration}/review`,
        { approve: true, patientId: patientA, response: "Identity confirmed" },
        "tech",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        `/requests/${registration}/review`,
        { approve: true, patientId: patientA, response: "Identity confirmed" },
        "foreign",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await post(`/requests/${registration}/review`, {
        approve: true,
        patientId: patientA,
        response: "Identity confirmed",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(`/requests/${registration}/review`, {
        approve: true,
        patientId: patientB,
        response: "Identity confirmed",
        identityVerified: true,
      })
    ).status,
    404,
  );
  const r = await post(
    `/requests/${registration}/review`,
    {
      approve: true,
      patientId: patientA,
      response: "Titular verificado presencialmente.",
      identityVerified: true,
    },
    "reception",
  );
  assert.equal(r.status, 200, r.text);
  assert.equal((await publicGet("/session")).body.links[0].id, A);
  const data = await publicGet(`/units/${A}/data`);
  assert.equal(data.body.profile.nome, "Paciente A");
  assert.ok(!data.text.includes("internal-confidential-note"));
  assert.equal((await publicGet(`/units/${B}/data`)).status, 403);
});
test("patient sessions resist missing CSRF, cross-site writes, and staff-token confusion", async () => {
  assert.equal(
    (
      await request(app)
        .post("/public/requests")
        .set("Cookie", cookieA)
        .send({ unitId: A, kind: "contacto", message: "New phone" })
    ).status,
    403,
  );
  assert.equal(
    (
      await publicPost("/requests", {
        unitId: A,
        kind: "contacto",
        message: "Novo telefone: 900000099",
      }).set("Origin", "https://evil.example")
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .get("/public/session")
        .set("Authorization", "Bearer fake-staff-token")
    ).status,
    401,
  );
  assert.equal(
    (
      await publicPost("/requests", {
        unitId: A,
        kind: "contacto",
        message: "Novo telefone: 900000099",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await publicPost("/requests", {
        unitId: B,
        kind: "contacto",
        message: "Foreign",
      })
    ).status,
    403,
  );
});
test("slots validate clinician tenant, prevent overlap and reserve exactly once", async () => {
  const start = new Date(Date.now() + 86400000),
    end = new Date(start.getTime() + 1800000),
    d = {
      clinicianId: doctor,
      start: start.toISOString(),
      end: end.toISOString(),
      specialty: "Cardiologia",
      location: "Gabinete 1",
    };
  assert.equal(
    (await post("/slots", { ...d, clinicianId: otherDoctor })).status,
    400,
  );
  assert.equal((await post("/slots", d, "tech")).status, 403);
  const r = await post("/slots", d, "reception");
  assert.equal(r.status, 201, r.text);
  slot = r.body.id;
  assert.equal((await post("/slots", d)).status, 409);
  assert.equal((await publicGet(`/units/${A}/slots`)).body[0].id, slot);
  const reqId = randomUUID();
  const book = await publicPost("/appointments", {
    unitId: A,
    slotId: slot,
    requestId: reqId,
  });
  assert.equal(book.status, 201, book.text);
  booking = book.body.id;
  const retry = await publicPost("/appointments", {
    unitId: A,
    slotId: slot,
    requestId: reqId,
  });
  assert.equal(retry.body.id, booking);
  assert.equal(
    (
      await publicPost("/appointments", {
        unitId: B,
        slotId: slot,
        requestId: reqId,
      })
    ).status,
    403,
  );
  assert.equal((await publicGet(`/units/${A}/slots`)).body.length, 0);
  assert.equal((await post(`/slots/${slot}/close`, {})).status, 409);
  assert.equal(
    (
      await post(`/appointments/${booking}/status`, {
        status: "realizada",
        reason: "Attempt premature",
      })
    ).status,
    409,
  );
});
test("another account sees no patient data and cannot occupy an already booked slot", async () => {
  const r = await publicPost("/register", {
    unitId: A,
    name: "Outro paciente",
    birth: "1995-04-01",
    document: "BI-C",
    phone: "900000003",
    username: "patient-c",
    password: pass,
  });
  assert.equal(r.status, 201);
  saveSession(r, true);
  accountB = (
    await pg.query<any>(
      "SELECT id FROM nv_portal_accounts WHERE username='patient-c'",
    )
  ).rows[0].id;
  const reg = (await publicGet("/session", true)).body.requests[0].id;
  assert.equal(
    (
      await post(`/requests/${reg}/review`, {
        approve: true,
        patientId: patientA,
        response: "Attempt duplicate",
        identityVerified: true,
      })
    ).status,
    409,
  );
  const r2 = await post(
    `/requests/${reg}/create-patient`,
    {
      identityVerified: true,
      newPatientConfirmed: true,
      response: "Novo titular verificado. Sem processo anterior.",
    },
    "reception",
  );
  assert.equal(r2.status, 201, r2.text);
  const book = await publicPost(
    "/appointments",
    { unitId: A, slotId: slot, requestId: randomUUID() },
    true,
  );
  assert.equal(book.status, 409, book.text);
  const data = await publicGet(`/units/${A}/data`, true);
  assert.equal(data.body.profile.nome, "Outro paciente");
  assert.equal(data.body.appointments.length, 0);
  assert.equal(
    (await publicPost(`/appointments/${booking}/cancel`, { unitId: A }, true))
      .status,
    409,
  );
});
test("portal displays only released latest laboratory versions and excludes financial drafts/training", async () => {
  const catalog = randomUUID(),
    order = randomUUID(),
    t = randomUUID(),
    container = randomUUID(),
    v = randomUUID();
  await pg.query(
    "INSERT INTO nv_lab_catalog(id,empresa_id,code,version,data,created_by) VALUES($1,$2,'GLI',1,'{}','doctor')",
    [catalog, A],
  );
  await pg.query(
    "INSERT INTO nv_lab_orders(id,empresa_id,patient_id,accession,patient_snapshot,request_hash,priority,indication,origin,created_by,request_id) VALUES($1,$2,$3,'PORTAL-TEST','{}','abc','rotina','indication','internal','doctor',$4)",
    [order, A, patientA, randomUUID()],
  );
  await pg.query(
    'INSERT INTO nv_lab_tests(id,empresa_id,order_id,catalog_id,snapshot) VALUES($1,$2,$3,$4,\'{"name":"Glicose"}\')',
    [t, A, order, catalog],
  );
  await pg.query(
    "INSERT INTO nv_lab_containers(id,empresa_id,order_id,sample_id,code,material,container,location) VALUES($1,$2,$3,$4,'CONT-PORTAL','sangue','tubo','lab')",
    [container, A, order, randomUUID()],
  );
  await pg.query(
    'INSERT INTO nv_lab_values(id,empresa_id,test_id,container_id,version,data,entered_by,request_id) VALUES($1,$2,$3,$4,1,\'{"measured":"99","unit":"mg/dL","secret":"hidden-field"}\',\'tech\',$5)',
    [v, A, t, container, randomUUID()],
  );
  assert.equal((await publicGet(`/units/${A}/data`)).body.results.length, 0);
  await pg.query(
    "UPDATE nv_lab_values SET released_at=now(),released_by='doctor' WHERE id=$1",
    [v],
  );
  let data = await publicGet(`/units/${A}/data`);
  assert.equal(data.body.results[0].measured, "99");
  assert.ok(!data.text.includes("hidden-field"));
  await pg.query(
    "INSERT INTO nv_lab_values(id,empresa_id,test_id,container_id,version,data,entered_by,request_id) VALUES($1,$2,$3,$4,2,'{\"measured\":\"100\"}','tech',$5)",
    [randomUUID(), A, t, container, randomUUID()],
  );
  assert.equal((await publicGet(`/units/${A}/data`)).body.results.length, 0);
  for (const [number, status, meta, pid] of [
    ["REAL-1", "emitida", "{}", patientA],
    ["TEST-1", "emitida", '{"ambiente":"homologacao"}', patientA],
    ["DRAFT-1", "rascunho", "{}", patientA],
    ["OTHER-1", "emitida", "{}", patientB],
  ]) {
    const org = pid === patientB ? B : A;
    await pg.query(
      "INSERT INTO faturas(empresa_id,paciente_id,numero,estado,billing_meta) VALUES($1,$2,$3,$4,$5)",
      [org, pid, number, status, meta],
    );
  }
  data = await publicGet(`/units/${A}/data`);
  assert.deepEqual(
    data.body.invoices.map((f: any) => f.numero),
    ["REAL-1"],
  );
  assert.equal(
    (await publicGet(`/units/${A}/data`, true)).body.results.length,
    0,
  );
});
test("clinical documents require a verified individual doctor and remain patient scoped", async () => {
  const d = {
    patientId: patientA,
    kind: "resumo",
    title: "Resumo de consulta",
    body: "Documento revisto pelo médico.",
  };
  assert.equal((await post("/documents", d)).status, 403);
  assert.equal((await post("/documents", d, "med")).status, 403);
  await pg.query(
    "INSERT INTO nv_professionals(empresa_id,funcionario_id,data,updated_by) VALUES($1,$2,$3,'admin')",
    [
      A,
      doctor,
      JSON.stringify({
        status: "activo",
        verifiedBy: "admin",
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      }),
    ],
  );
  assert.equal(
    (await post("/documents", { ...d, patientId: patientB }, "med")).status,
    404,
  );
  const r = await post("/documents", d, "med");
  assert.equal(r.status, 201, r.text);
  documentId = r.body.id;
  assert.equal(
    (await publicGet(`/units/${A}/data`)).body.documents[0].id,
    documentId,
  );
  assert.equal(
    (await publicGet(`/units/${A}/data`, true)).body.documents.length,
    0,
  );
  assert.equal(
    (
      await post(
        `/documents/${documentId}/revoke`,
        { reason: "Correcção clínica" },
        "med",
      )
    ).status,
    200,
  );
  assert.equal((await publicGet(`/units/${A}/data`)).body.documents.length, 0);
});
test("recovery requires verified unit membership, is single use and revokes old sessions", async () => {
  const q = await publicPost("/recovery", {
    unitId: A,
    username: "patient-a",
    contact: "unverified phone",
  });
  assert.equal(q.status, 200);
  const rec = (await get("/overview")).body.recovery[0];
  assert.equal(
    (await post(`/recovery/${rec.id}/token`, { reason: "Unchecked" })).status,
    400,
  );
  assert.equal(
    (
      await post(
        `/recovery/${rec.id}/token`,
        { identityVerified: true, reason: "foreign" },
        "foreign",
      )
    ).status,
    404,
  );
  const r = await post(
    `/recovery/${rec.id}/token`,
    { identityVerified: true, reason: "Titular confirmado no balcão." },
    "reception",
  );
  assert.equal(r.status, 200, r.text);
  const raw = r.body.token;
  const reset = await publicPost("/reset", {
    token: raw,
    password: pass + "2",
  });
  assert.equal(reset.status, 200, reset.text);
  assert.equal((await publicGet("/session")).status, 401);
  assert.equal(
    (await publicPost("/reset", { token: raw, password: pass + "3" })).status,
    400,
  );
  const login = await publicPost("/login", {
    username: "patient-a",
    password: pass + "2",
  });
  assert.equal(login.status, 200);
  saveSession(login);
});
test("patient and staff cancellations, link revocation and audit are enforced", async () => {
  assert.equal(
    (await publicPost(`/appointments/${booking}/cancel`, { unitId: A })).status,
    200,
  );
  assert.equal((await publicGet(`/units/${A}/slots`)).body.length, 1);
  assert.equal(
    (
      await post(
        "/links/revoke",
        { accountId: accountA, reason: "Revogação solicitada" },
        "reception",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post("/links/revoke", {
        accountId: accountA,
        reason: "Revogação solicitada",
      })
    ).status,
    200,
  );
  assert.equal((await publicGet(`/units/${A}/data`)).status, 403);
  const log = await get("/audit");
  assert.ok(log.body.some((l: any) => l.action === "patient.read"));
  assert.ok(log.body.some((l: any) => l.action === "link.revoke"));
  assert.ok(!log.text.includes("Documento revisto"));
});
test("session idle expiry and persistent brute-force lockout are honoured", async () => {
  await pg.query(
    "UPDATE nv_portal_sessions SET last_seen=now()-interval '31 minutes' WHERE account_id=$1",
    [accountB],
  );
  assert.equal((await publicGet("/session", true)).status, 401);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await publicPost("/login", {
          username: "patient-c",
          password: "wrong-password",
        })
      ).status,
      401,
    );
  assert.equal(
    (await publicPost("/login", { username: "patient-c", password: pass }))
      .status,
    401,
  );
  const a = (
    await pg.query<any>(
      "SELECT failures,locked_until FROM nv_portal_accounts WHERE id=$1",
      [accountB],
    )
  ).rows[0];
  assert.ok(a.failures >= 10 && a.locked_until);
});

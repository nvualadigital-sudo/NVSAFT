import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../lib/db/src/schema/index";
import { setDatabaseForTests } from "../lib/db/src/index";
import { signToken } from "../artifacts/api-server/src/lib/auth";
import { createStaffRouter } from "../artifacts/api-server/src/routes/staff";
import { createProfessionalDocuments } from "../artifacts/api-server/src/routes/professional-documents";
import { createInstitutionRouter } from "../artifacts/api-server/src/routes/institution";
import { createHospitalRouter } from "../artifacts/api-server/src/routes/hospital";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
const db = new PGlite(),
  A = randomUUID(),
  B = randomUUID();
const pool: any = {
  query: (sql: string, params?: any[]) => db.query(sql, params),
  connect: async () => ({
    query: (sql: string, params?: any[]) => db.query(sql, params),
    release() {},
  }),
};
const tokens: Record<string, string> = {},
  users: Record<string, any> = {};
let app: ReturnType<typeof express>,
  patient: number,
  foreignPatient: number,
  medicalId: string,
  nursingId: string,
  prescriptionId: string;
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1EAAAAASUVORK5CYII=";
const png2 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
function call(method: string, url: string, who = "admin", body?: any) {
  const q = (request(app) as any)
    [method]("/api" + url)
    .set("Authorization", "Bearer " + tokens[who]);
  return body === undefined ? q : q.send(body);
}
const profile = (category: string) => ({
  category,
  specialties: category.includes("Médico")
    ? "Clínica Geral"
    : "Enfermagem geral",
  credential: "REG-TESTE",
  credentialAuthority: "Entidade profissional de teste",
  service: "Serviço de teste",
  contract: "Contrato de teste",
  validUntil: "2099-12-31",
  employeeCode: "INT-1",
  phone: "900000001",
  email: "professional@example.invalid",
  qualification: "Qualificação de teste",
  position: category.includes("Médico") ? "Médico clínico geral" : "Enfermeiro",
  signatureData: png,
  stampData: png2,
});
async function tokenFor(key: string) {
  const who = users[key];
  tokens[key] = await signToken({
    role: "empresa",
    empresaId: A,
    username: who.username,
    funcao: who.funcao,
    funcionarioId: who.id,
  });
}
async function detail(key: string) {
  const q = await call("get", `/empresas/${A}/funcionarios/${users[key].id}`);
  assert.equal(q.status, 200, JSON.stringify(q.body));
  return q.body;
}
async function verify(key: string) {
  const current = await detail(key);
  const q = await call(
    "put",
    "/hospital/professionals/" + current.id,
    "admin",
    {
      revision: current.professionalRevision,
      data: {
        ...current.professional,
        status: "activo",
        verification: "Verificado exclusivamente em ensaio local",
      },
    },
  );
  assert.equal(q.status, 200, JSON.stringify(q.body));
  return q.body;
}
before(async () => {
  await applyMigrations(db, "migrations", () => {});
  setDatabaseForTests(drizzle(db, { schema }) as any, pool);
  for (const [org, name] of [
    [A, "A"],
    [B, "B"],
  ]) {
    await db.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$3,'test')",
      [org, name, "owner-" + name],
    );
    tokens[name === "A" ? "admin" : "foreign"] = await signToken({
      role: "empresa",
      empresaId: org,
      username: "owner-" + name,
      funcao: "admin",
    });
  }
  await db.query(
    "INSERT INTO config(empresa_id,nome_clinica,director_tecnico,assinatura_data) VALUES($1,'Instituição original','Director exclusivo do laboratório',$2)",
    [A, png2],
  );
  patient = (
    await db.query<any>(
      "INSERT INTO pacientes(empresa_id,nome,processo) VALUES($1,'Paciente fictício','PROC-1') RETURNING id",
      [A],
    )
  ).rows[0].id;
  foreignPatient = (
    await db.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Paciente de outra instituição') RETURNING id",
      [B],
    )
  ).rows[0].id;
  app = express();
  app.use(express.json({ limit: "20mb" }));
  app.use("/api", createStaffRouter(pool));
  app.use("/api/hospital", createProfessionalDocuments(pool));
  app.use("/api/hospital", createInstitutionRouter(pool));
  app.use("/api/hospital", createHospitalRouter(pool));
  for (const [key, role, category] of [
    ["doctor", "medico", "Médico clínico geral"],
    ["nurse", "enfermeiro", "Enfermeiro"],
    ["otherNurse", "enfermeiro", "Técnico de enfermagem"],
    ["manager", "gestor", "Gestor"],
  ]) {
    const q = await call("post", `/empresas/${A}/funcionarios`, "admin", {
      nome: "Profissional " + key,
      username: "staff-" + key,
      password: "private-test-password",
      funcao: role,
      professional: profile(category),
      professionalRevision: 0,
    });
    assert.equal(q.status, 201, JSON.stringify(q.body));
    users[key] = q.body;
    await tokenFor(key);
    if (role !== "gestor") await verify(key);
  }
});
after(() => db.close());
test("laboratory permissions activate on credential verification and synchronise atomically with staff save", async () => {
  const requestedLabPermissions = [
    "lab.validate.technical",
    "lab.validate.release",
    "lab.critical.release",
  ];
  const created = await call("post", `/empresas/${A}/funcionarios`, "admin", {
    nome: "Técnico delegado",
    username: "staff-lab-delegate",
    password: "private-test-password",
    funcao: "tecnico",
    professional: {
      ...profile("Técnico de análises clínicas"),
      requestedLabPermissions,
    },
    professionalRevision: 0,
    syncLabPermissions: true,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  users.labDelegate = created.body;
  await tokenFor("labDelegate");
  assert.deepEqual(created.body.professional.requestedLabPermissions, requestedLabPermissions);
  assert.equal(created.body.professional.status, "pendente");
  assert.deepEqual(created.body.labPermissions.pending, requestedLabPermissions);
  const deniedGrant = await call("post", "/hospital/access/grants", "admin", {
    actor: "staff-lab-delegate",
    permission: "lab.validate.release",
    reason: "Nomeação profissional de teste",
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  assert.equal(deniedGrant.status, 409, JSON.stringify(deniedGrant.body));
  await verify("labDelegate");
  const institution = await call("get", "/hospital/institution", "labDelegate");
  assert.equal(institution.status, 200);
  assert.deepEqual(new Set(institution.body.permissions.map((g: any) => g.permission)), new Set(requestedLabPermissions));
  let current = await detail("labDelegate");
  const changed = await call("put", `/empresas/${A}/funcionarios/${current.id}`, "admin", {
    professionalRevision: current.professionalRevision,
    professional: {
      ...current.professional,
      requestedLabPermissions: ["lab.validate.technical", "lab.validate.release"],
    },
    syncLabPermissions: true,
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.professional.status, "activo");
  assert.ok(changed.body.labPermissions.revoked.includes("lab.critical.release"));
  let after = await call("get", "/hospital/institution", "labDelegate");
  assert.equal(after.body.permissions.some((g: any) => g.permission === "lab.critical.release"), false);
  current = await detail("labDelegate");
  const reactivated = await call("put", `/empresas/${A}/funcionarios/${current.id}`, "admin", {
    professionalRevision: current.professionalRevision,
    professional: {
      ...current.professional,
      requestedLabPermissions,
    },
    syncLabPermissions: true,
  });
  assert.equal(reactivated.status, 200, JSON.stringify(reactivated.body));
  assert.ok(reactivated.body.labPermissions.active.includes("lab.critical.release"));
  after = await call("get", "/hospital/institution", "labDelegate");
  assert.deepEqual(new Set(after.body.permissions.map((g: any) => g.permission)), new Set(requestedLabPermissions));
  const invalid = await call("post", `/empresas/${A}/funcionarios`, "admin", {
    nome: "Conta inválida",
    username: "staff-lab-invalid",
    password: "private-test-password",
    funcao: "tecnico",
    professional: {
      ...profile("Técnico de análises clínicas"),
      requestedLabPermissions: ["lab.validate.release", "admin.superuser"],
    },
    professionalRevision: 0,
  });
  assert.equal(invalid.status, 400, JSON.stringify(invalid.body));
});
test("staff registration stores categories and clinical-general credentials without exposing passwords or images in listings", async () => {
  const result = await detail("doctor");
  assert.equal(result.professional.category, "Médico clínico geral");
  assert.equal(result.professional.specialties, "Clínica Geral");
  assert.equal(result.professional.position, "Médico clínico geral");
  assert.equal(result.professional.signatureData, png);
  assert.equal(result.professional.stampData, png2);
  assert.equal(result.professional.verifiedBy, "owner-A");
  assert.equal(result.password, undefined);
  const list = await call("get", `/empresas/${A}/funcionarios`);
  assert.equal(list.status, 200);
  assert.ok(!JSON.stringify(list.body).includes("private-test-password"));
  assert.ok(!JSON.stringify(list.body).includes("data:image"));
  assert.equal(
    list.body.find((x: any) => x.id === result.id).signatureAvailable,
    true,
  );
  await call(
    "get",
    `/empresas/${A}/funcionarios/${result.id}`,
    "foreign",
  ).expect(403);
});
test("staff access rejects unknown roles, foreign writes and manager escalation; blank edit password preserves the hash", async () => {
  await call("post", `/empresas/${A}/funcionarios`, "admin", {
    nome: "Conta inválida",
    username: "bad-role",
    password: "private-test-password",
    funcao: "superadmin",
  }).expect(400);
  await call(
    "put",
    `/empresas/${A}/funcionarios/${users.doctor.id}`,
    "foreign",
    { nome: "Troca indevida" },
  ).expect(403);
  await call("post", `/empresas/${A}/funcionarios`, "manager", {
    nome: "Conta indevida",
    username: "bad-escalation",
    password: "private-test-password",
    funcao: "admin",
  }).expect(403);
  const prior = (
    await db.query<any>("SELECT password FROM funcionarios WHERE id=$1", [
      users.doctor.id,
    ])
  ).rows[0].password;
  const current = await detail("doctor");
  const updated = await call(
    "put",
    `/empresas/${A}/funcionarios/${current.id}`,
    "admin",
    {
      password: "",
      professionalRevision: current.professionalRevision,
      professional: {
        ...current.professional,
        validUntil: "2099-12-31",
        phone: "900000002",
      },
    },
  );
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.professional.status, "activo");
  assert.equal(updated.body.professional.verifiedBy, "owner-A");
  assert.equal(
    (
      await db.query<any>("SELECT password FROM funcionarios WHERE id=$1", [
        current.id,
      ])
    ).rows[0].password,
    prior,
  );
  await call("put", `/empresas/${A}/funcionarios/${current.id}`, "admin", {
    professionalRevision: current.professionalRevision,
    professional: { category: "Alteração concorrente" },
  }).expect(409);
});
test("credential changes require review, revoke the old session and reject executable or oversized signature images", async () => {
  for (const date of ["2026-02-31", "2026-13-01"]) {
    const current = await detail("doctor");
    await call("put", `/empresas/${A}/funcionarios/${current.id}`, "admin", {
      professionalRevision: current.professionalRevision,
      professional: { validUntil: date },
    }).expect(400);
  }
  let current = await detail("doctor");
  await call("put", `/empresas/${A}/funcionarios/${current.id}`, "admin", {
    professionalRevision: current.professionalRevision,
    professional: { stampData: "data:image/svg+xml;base64,PHN2Zz4=" },
  }).expect(400);
  await call("put", `/empresas/${A}/funcionarios/${current.id}`, "admin", {
    professionalRevision: current.professionalRevision,
    professional: {
      signatureData: "data:image/png;base64," + "A".repeat(300000),
    },
  }).expect(400);
  const updated = await call(
    "put",
    `/empresas/${A}/funcionarios/${current.id}`,
    "admin",
    {
      professionalRevision: current.professionalRevision,
      professional: { credential: "REG-REVISTO" },
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.body.professional.status, "pendente");
  assert.equal(updated.body.professional.verifiedBy, "");
  await call("get", "/hospital/professionals/me", "doctor").expect(401);
  await tokenFor("doctor");
  const me = await call("get", "/hospital/professionals/me", "doctor");
  assert.equal(me.body.canIssue, false);
  await verify("doctor");
  assert.equal(
    (await call("get", "/hospital/professionals/me", "doctor")).body.canIssue,
    true,
  );
});
test("medical documents and prescriptions freeze the verified issuer and institution, ignoring client-supplied author names", async () => {
  const visitId = randomUUID();
  medicalId = randomUUID();
  prescriptionId = randomUUID();
  const state = {
    version: 1,
    revision: 0,
    visits: [
      {
        id: visitId,
        owner: users.doctor.username,
        patient: { id: patient, nome: "Paciente fictício", processo: "PROC-1" },
        doctor: "Nome enviado pelo cliente",
        registration: "FALSO",
      },
    ],
    prescriptions: [
      {
        id: prescriptionId,
        visitId,
        patient: { id: patient, nome: "Paciente fictício" },
        doctor: "Nome enviado pelo cliente",
        registration: "FALSO",
        created: new Date().toISOString(),
        validUntil: "2099-12-31",
        items: [
          {
            id: randomUUID(),
            name: "Medicamento de ensaio",
            dose: "Dose de ensaio",
            route: "Via de ensaio",
            quantity: 1,
          },
        ],
      },
    ],
    documents: [
      {
        id: medicalId,
        visitId,
        patient: { id: patient, nome: "Paciente fictício" },
        kind: "Relatório médico",
        title: "Documento fictício",
        text: "Conteúdo sintético de ensaio",
        doctor: "Outro autor",
        registration: "FALSO",
        created: new Date().toISOString(),
        finalized: new Date().toISOString(),
      },
    ],
    deliveries: [],
    audit: [],
  };
  const q = await call("put", "/hospital/workspace/clinical", "doctor", {
    revision: 0,
    data: state,
  });
  assert.equal(q.status, 200, JSON.stringify(q.body));
  assert.equal(q.body.data.documents[0].doctor, "Profissional doctor");
  assert.equal(q.body.data.prescriptions[0].registration, "REG-REVISTO");
  let result = await call(
    "post",
    `/hospital/professional-documents/medical/${medicalId}/export`,
    "doctor",
  );
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.issuer.name, "Profissional doctor");
  assert.equal(result.body.issuer.signatureData, png);
  assert.equal(result.body.institution.name, "Instituição original");
  assert.ok(
    !JSON.stringify(result.body).includes("Director exclusivo do laboratório"),
  );
  let current = await detail("doctor");
  await call("put", `/empresas/${A}/funcionarios/${current.id}`, "admin", {
    nome: "Nome futuro",
    professionalRevision: current.professionalRevision,
    professional: { signatureData: png2 },
  }).expect(200);
  await db.query(
    "UPDATE config SET nome_clinica='Instituição futura' WHERE empresa_id=$1",
    [A],
  );
  result = await call(
    "post",
    `/hospital/professional-documents/medical/${medicalId}/export`,
  );
  assert.equal(result.body.issuer.name, "Profissional doctor");
  assert.equal(result.body.issuer.signatureData, png);
  assert.equal(result.body.institution.name, "Instituição original");
  await call(
    "post",
    `/hospital/professional-documents/medical/${medicalId}/export`,
    "foreign",
  ).expect(404);
  const rx = await call(
    "post",
    `/hospital/professional-documents/prescription/${prescriptionId}/export`,
  );
  assert.equal(rx.body.issuer.credential, "REG-REVISTO");
});
test("nursing reports use their author's credential, preserve drafts, retry safely and cannot become medical certificates", async () => {
  nursingId = randomUUID();
  const body = {
    id: nursingId,
    patientId: patient,
    kind: "Relatório de enfermagem",
    title: "Cuidados de ensaio",
    text: "Informação fictícia de cuidados",
    from: "2026-10-01",
    to: "2026-10-02",
    finalize: false,
    revision: 0,
    issuer: { name: "Nome forjado" },
  };
  await call("post", "/hospital/professional-documents/nursing", "nurse", {
    ...body,
    patientId: foreignPatient,
  }).expect(404);
  const draft = await call(
    "post",
    "/hospital/professional-documents/nursing",
    "nurse",
    body,
  );
  assert.equal(draft.status, 200, JSON.stringify(draft.body));
  const repeated = await call(
    "post",
    "/hospital/professional-documents/nursing",
    "nurse",
    body,
  );
  assert.equal(repeated.body.revision, draft.body.revision);
  await call("post", "/hospital/professional-documents/nursing", "nurse", {
    ...body,
    kind: "Atestado médico",
  }).expect(400);
  await call("post", "/hospital/professional-documents/nursing", "nurse", {
    ...body,
    from: "2026-02-31",
  }).expect(400);
  await call(
    "post",
    "/hospital/professional-documents/nursing",
    "manager",
    body,
  ).expect(403);
  const issued = await call(
    "post",
    "/hospital/professional-documents/nursing",
    "nurse",
    { ...body, finalize: true, reviewed: true, revision: draft.body.revision },
  );
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.equal(issued.body.state, "issued");
  await call("post", "/hospital/professional-documents/nursing", "nurse", {
    ...body,
    finalize: true,
    reviewed: true,
    revision: draft.body.revision,
  }).expect(200);
  const result = await call(
    "post",
    `/hospital/professional-documents/nursing/${nursingId}/export`,
    "nurse",
  );
  assert.equal(result.body.issuer.name, "Profissional nurse");
  assert.equal(result.body.issuer.category, "Enfermeiro");
  assert.equal(result.body.issuer.signatureData, png);
  await call("post", "/hospital/professional-documents/nursing", "nurse", {
    ...body,
    text: "Texto alterado",
    revision: issued.body.revision,
  }).expect(409);
  await call(
    "post",
    `/hospital/professional-documents/nursing/${nursingId}/void`,
    "otherNurse",
    { reason: "Anulação indevida" },
  ).expect(403);
  await call(
    "post",
    `/hospital/professional-documents/nursing/${nursingId}/export`,
    "foreign",
  ).expect(404);
});
test("deactivation preserves historic authorship while revoking the nurse's access; voiding retains issued content", async () => {
  const voided = await call(
    "post",
    `/hospital/professional-documents/nursing/${nursingId}/void`,
    "nurse",
    { reason: "Rectificação de ensaio" },
  );
  assert.equal(voided.status, 200);
  await call("delete", `/empresas/${A}/funcionarios/${users.nurse.id}`).expect(
    204,
  );
  assert.equal(
    (
      await db.query<any>(
        "SELECT count(*) AS n FROM funcionarios WHERE id=$1",
        [users.nurse.id],
      )
    ).rows[0].n,
    1,
  );
  await call("get", "/hospital/professionals/me", "nurse").expect(401);
  const result = await call(
    "post",
    `/hospital/professional-documents/nursing/${nursingId}/export`,
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.state, "voided");
  assert.equal(result.body.issuer.name, "Profissional nurse");
  assert.equal(result.body.document.text, "Informação fictícia de cuidados");
  const integrity = await call("get", "/hospital/audit/verify");
  assert.equal(integrity.body.valid, true, JSON.stringify(integrity.body));
});

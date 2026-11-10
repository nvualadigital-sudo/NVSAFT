import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createCashLedgerRouter } from "../artifacts/api-server/src/routes/cash-ledger";
import { createDocumentSignatories } from "../artifacts/api-server/src/routes/document-signatories";
import { createProfessionalDocuments } from "../artifacts/api-server/src/routes/professional-documents";
import { createInstitutionRouter } from "../artifacts/api-server/src/routes/institution";
import { createLabWorkflow } from "../artifacts/api-server/src/routes/lab-workflow";
import { createIntegratedBilling } from "../artifacts/api-server/src/routes/billing-integrated";
import { issuerFor } from "../artifacts/api-server/src/lib/professionals";
import { generatePDFHTML } from "../artifacts/lab-results/src/utils/pdfGenerator";
import { staffReport } from "../artifacts/api-server/src/lib/lab-publication";
import {
  ledgerDate,
  ledgerTotals,
  escapeLedgerText,
} from "../artifacts/lab-results/src/utils/cashLedger";
import { NURSING_DOCUMENT_KINDS } from "../lib/api-zod/src/professionals";
const pg = new PGlite(),
  A = randomUUID(),
  B = randomUUID(),
  doctor = randomUUID(),
  nurse = randomUUID(),
  other = randomUUID();
const db: any = {
  query: (q: string, p?: any[]) => pg.query(q, p),
  connect: async () => ({ query: db.query, release() {} }),
};
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, _res, next) => {
  const role = req.get("x-role") || "admin";
  (req as any).user = {
    role: "empresa",
    empresaId: req.get("x-company") === "B" ? B : A,
    funcao: role,
    username:
      role === "medico" ? "doctor" : role === "enfermeiro" ? "nurse" : role,
    funcionarioNome: role,
  };
  next();
});
app.use(createCashLedgerRouter(db));
app.use(createDocumentSignatories(db));
app.use(createProfessionalDocuments(db));
app.use(createInstitutionRouter(db));
app.use("/lab", createLabWorkflow(db));
const call = (
  method: "get" | "post" | "put" | "delete",
  url: string,
  role = "admin",
  company = "A",
) => request(app)[method](url).set("x-role", role).set("x-company", company);
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1EAAAAASUVORK5CYII=";
let patient: number;
before(async () => {
  await applyMigrations(pg, "migrations", () => {});
  for (const org of [A, B])
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,'Ensaio de auditoria',$2,'fixture')",
      [org, org],
    );
  for (const [fid, org, role, name] of [
    [doctor, A, "medico", "doctor"],
    [nurse, A, "enfermeiro", "nurse"],
    [other, B, "medico", "other"],
  ]) {
    await pg.query(
      "INSERT INTO funcionarios(id,empresa_id,nome,username,password,funcao) VALUES($1,$2,$3,$3,'fixture',$4)",
      [fid, org, name, role],
    );
    await pg.query(
      "INSERT INTO nv_professionals(empresa_id,funcionario_id,data,revision,updated_by) VALUES($1,$2,$3,1,'fixture')",
      [
        org,
        fid,
        {
          category: role,
          credential: "REG-ENSAIO",
          validUntil: "2099-12-31",
          status: "activo",
          verifiedBy: "independent",
          verifiedAt: new Date().toISOString(),
        },
      ],
    );
  }
  patient = (
    await pg.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Paciente fictício de ensaio') RETURNING id",
      [A],
    )
  ).rows[0].id;
});
after(() => pg.close());

test("a database with the five observed pending migrations reports the update and starts billing and pharmacy after migration", async () => {
  const old = new PGlite(),
    dir = mkdtempSync(join(tmpdir(), "nv-audit-schema-"));
  const pending = new Set([
    "20261029_agt_homologacao.sql",
    "20261029_rh_chefias_modelo.sql",
    "20261103_agt_replacement.sql",
    "20261103_lab_referencias_institucionais.sql",
    "20261103_pos_farmacia_formacao.sql",
    "20261105_fluxos_financeiros_assinaturas.sql",
  ]);
  try {
    cpSync("migrations", dir, {
      recursive: true,
      filter: (p) => !pending.has(basename(p)),
    });
    await applyMigrations(old, dir, () => {});
    const org = randomUUID();
    await old.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,'Schema ensaio',$2,'fixture')",
      [org, org],
    );
    const backend = express();
    backend.use((req, _res, next) => {
      (req as any).user = {
        role: "empresa",
        empresaId: org,
        funcao: "admin",
        username: "tester",
      };
      next();
    });
    backend.use(
      createIntegratedBilling(
        { query: (q: string, p?: any[]) => old.query(q, p) } as any,
        {
          request: async () => {
            throw Error("Sem chamadas externas em ensaio");
          },
        },
      ),
    );
    for (const route of ["/state", "/pharmacy-pos"]) {
      const r = await request(backend).get(route).expect(503);
      assert.equal(r.body.code, "database_update_required");
      assert.match(r.body.error, /pnpm db:migrate/);
    }
    await applyMigrations(old, "migrations", () => {});
    await request(backend).get("/state").expect(200);
    await request(backend).get("/pharmacy-pos").expect(200);
  } finally {
    await old.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("manual treasury amounts are validated, retried once, audited and confined to their institution", async () => {
  const body = {
    requestId: randomUUID(),
    data: "05/11/2026",
    descricao: "Entrada manual de ensaio",
    tipo: "entrada",
    valor: 1234.56,
    categoria: "Outro",
    referencia: "TEST",
    registadoPor: "Nome falsificado",
  };
  await call("post", "/movimentos", "rececionista").send(body).expect(403);
  for (const patch of [
    { valor: -1 },
    { valor: 0 },
    { valor: "123,45" },
    { valor: 1.001 },
    { data: "31/02/2026" },
    { tipo: "transfer" },
  ])
    await call("post", "/movimentos")
      .send({ ...body, ...patch })
      .expect(400);
  const first = await call("post", "/movimentos").send(body).expect(201);
  assert.equal(first.body.registadoPor, "admin");
  const retry = await call("post", "/movimentos").send(body).expect(201);
  assert.equal(first.body.id, retry.body.id);
  await call("post", "/movimentos")
    .send({ ...body, valor: 90 })
    .expect(409);
  assert.equal((await call("get", "/movimentos").expect(200)).body.length, 1);
  assert.equal(
    (await call("get", "/movimentos", "admin", "B").expect(200)).body.length,
    0,
  );
  await call("delete", "/movimentos/" + first.body.id, "admin", "B").expect(
    204,
  );
  assert.equal((await call("get", "/movimentos").expect(200)).body.length, 1);
  await call("delete", "/movimentos/" + first.body.id).expect(204);
  const history = await pg.query<any>(
    "SELECT details FROM nv_audit WHERE empresa_id=$1 AND action='finance.movement.delete'",
    [A],
  );
  assert.equal(history.rows[0].details.original.referencia, "TEST");
  assert.deepEqual(
    ledgerTotals([
      { tipo: "entrada", valor: 0.1 },
      { tipo: "entrada", valor: 0.2 },
      { tipo: "saida", valor: 0.1 },
    ]),
    { incoming: 0.3, outgoing: 0.1, balance: 0.2 },
  );
  assert.equal(ledgerDate("31/02/2026"), "");
  assert.equal(ledgerDate("05/11/2026"), "2026-11-05");
  assert.equal(escapeLedgerText('<script>"'), "&lt;script&gt;&quot;");
});

test("staff history and internal PDF include the latest unreviewed result without enabling final publication or another company", async () => {
  const body = {
    requestId: randomUUID(),
    pacienteId: patient,
    data: "05/11/2026",
    previousVersion: 0,
    parametros: [
      {
        exame: "Exame fictício",
        parametro: "Parâmetro de ensaio",
        resultado: "123",
        unidade: "",
        referencia: "",
      },
    ],
  };
  const saved = await call("post", "/lab/reports", "tecnico")
      .send(body)
      .expect(201),
    id = saved.body.id;
  const internal = await call("post", "/result-export/" + id, "tecnico")
    .send({ purpose: "internal" })
    .expect(200);
  assert.equal(internal.body.result.parametros[0].resultado, "123");
  assert.equal(internal.body.trace.provisional, true);
  await call("post", "/result-export/" + id, "tecnico")
    .send({})
    .expect(409);
  await call("post", "/result-export/" + id, "financeiro")
    .send({ purpose: "internal" })
    .expect(403);
  await call("post", "/result-export/" + id, "tecnico", "B")
    .send({ purpose: "internal" })
    .expect(404);
  const html = generatePDFHTML(
    internal.body.result,
    { nome: "Paciente fictício" } as any,
    {
      nomeClinica: "Ensaio",
      assinaturaData: png,
      directorTecnico: "Director fictício",
    } as any,
    internal.body.trace,
  );
  assert.match(html, /EM REVISÃO — DOCUMENTO PROVISÓRIO/);
  assert.ok(!html.includes(png));
  assert.ok(!html.includes("Director fictício"));
  const rows = await call("get", "/lab/reports", "tecnico").expect(200);
  assert.equal(
    rows.body.items.find((r: any) => r.result.id === id).state,
    "rascunho",
  );
});

test("the final laboratory PDF identifies the actual delegated releaser without trusting HTML in the actor name", () => {
  const projection = staffReport({
    id: 31,
    paciente_id: patient,
    paciente_nome: "Paciente fictício",
    data: "05/11/2026",
    data_emissao: "05/11/2026",
    parametros: [{ exame: "Ensaio", parametro: "Valor", resultado: "3", unidade: "", referencia: "" }],
    tecnico_nome: "Técnico A",
    manual_version: 1,
    manual_released_at: "2026-11-05T10:00:00Z",
    manual_released_by: "substituto<&>",
    manual_technical_by: "supervisor",
  });
  assert.equal(projection.trace.releasedBy, "substituto<&>");
  assert.equal(projection.trace.provisional, false);
  const html = generatePDFHTML(
    projection.result,
    { nome: "Paciente fictício" } as any,
    { nomeClinica: "Ensaio", directorTecnico: "Director Técnico" } as any,
    projection.trace,
  );
  assert.match(html, /Libertação autorizada no sistema por:/);
  assert.ok(html.includes("substituto&lt;&amp;&gt;"));
  assert.ok(!html.includes("substituto<&>"));
  assert.ok(!html.includes("DOCUMENTO PROVISÓRIO"));
});

test("clinical and nursing signatures require the matching verified staff member and issued author signatures stay frozen", async () => {
  const assign = {
    funcionarioId: doctor,
    revision: 0,
    profileRevision: 1,
    signatureData: png,
    confirmIdentity: true,
  };
  await call("put", "/document-signatories/clinical", "tecnico")
    .send(assign)
    .expect(403);
  await call("put", "/document-signatories/clinical")
    .send({ ...assign, funcionarioId: other })
    .expect(409);
  await call("put", "/document-signatories/clinical")
    .send({ ...assign, funcionarioId: nurse })
    .expect(409);
  await call("put", "/document-signatories/clinical")
    .send({ ...assign, signatureData: "data:image/svg+xml;base64,PHN2Zz4=" })
    .expect(400);
  await call("put", "/document-signatories/clinical").send(assign).expect(200);
  await call("put", "/document-signatories/nursing")
    .send({ ...assign, funcionarioId: nurse })
    .expect(200);
  const config = (await call("get", "/document-signatories").expect(200)).body;
  assert.equal(config.signatures.clinical.name, "doctor");
  assert.equal(config.signatures.nursing.name, "nurse");
  const foreign = (
    await call("get", "/document-signatories", "admin", "B").expect(200)
  ).body;
  assert.equal(foreign.assignments.length, 0);
  assert.ok(!JSON.stringify(foreign).includes(png));
  const author = await issuerFor(
    db,
    {
      empresaId: A,
      funcao: "medico",
      username: "doctor",
      role: "empresa",
    } as any,
    "medico",
  );
  assert.equal(author.signatureData, png);
  assert.equal(author.name, "doctor");
  const documentId = randomUUID();
  await call("post", "/professional-documents/nursing", "enfermeiro")
    .send({
      id: documentId,
      patientId: patient,
      kind: NURSING_DOCUMENT_KINDS[0],
      title: "Relatório de ensaio",
      text: "Conteúdo fictício",
      finalize: true,
      reviewed: true,
      revision: 0,
    })
    .expect(200);
  await call("put", "/document-signatories/nursing")
    .send({
      funcionarioId: nurse,
      revision: 1,
      profileRevision: 2,
      signatureData: "",
      confirmIdentity: true,
    })
    .expect(200);
  const exported = (
    await call(
      "post",
      "/professional-documents/nursing/" + documentId + "/export",
      "enfermeiro",
    )
      .send({})
      .expect(200)
  ).body;
  assert.equal(exported.issuer.name, "nurse");
  assert.equal(exported.issuer.signatureData, png);
});

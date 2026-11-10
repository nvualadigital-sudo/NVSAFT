import empresasRouter from "../artifacts/api-server/src/routes/empresas";
import { createLabWorkflow } from "../artifacts/api-server/src/routes/lab-workflow";
import { createInstitutionRouter } from "../artifacts/api-server/src/routes/institution";
import { createChatTools } from "../artifacts/api-server/src/routes/chat-tools";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import * as schema from "../lib/db/src/schema/index";
import { drizzle } from "drizzle-orm/pglite";
import { setDatabaseForTests } from "../lib/db/src/index";
import { createHospitalRouter } from "../artifacts/api-server/src/routes/hospital";
import billingRouter from "../artifacts/api-server/src/routes/billing";
import { signToken, requireAuth } from "../artifacts/api-server/src/lib/auth";
import solicitacoesRouter from "../artifacts/api-server/src/routes/solicitacoes";
import laboratorioRouter from "../artifacts/api-server/src/routes/laboratorio";
import authRouter from "../artifacts/api-server/src/routes/auth";
import { createReceptionRouter } from "../artifacts/api-server/src/routes/reception-base";
import { getUser } from "../artifacts/api-server/src/lib/auth";
const pg = new PGlite(),
  dialect = new PgDialect();
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002",
  C = "10000000-0000-4000-8000-000000000003";
let app: ReturnType<typeof express>,
  tokens: Record<string, string> = {};
let patient = 0;
const pool: any = {
  query: (text: string, values?: any[]) => pg.query(text, values),
  connect: async () => ({
    query: (text: string, values?: any[]) => pg.query(text, values),
    release() {},
  }),
};
before(async () => {
  for (const table of Object.values(schema)) {
    const cfg = getTableConfig(table as any);
    const cols = cfg.columns.map((c) => {
      let d = "";
      if (c.default !== undefined) {
        const def = c.default;
        d =
          " DEFAULT " +
          (def instanceof SQL ||
          (def && typeof def === "object" && "queryChunks" in def)
            ? dialect.sqlToQuery(def as any).sql
            : typeof def === "string"
              ? "'" + def.replace(/'/g, "''") + "'"
              : typeof def === "object"
                ? "'" + JSON.stringify(def) + "'::jsonb"
                : String(def));
      }
      return `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}${c.notNull ? " NOT NULL" : ""}${d}${c.isUnique ? " UNIQUE" : ""}`;
    });
    await pg.exec(`CREATE TABLE "${cfg.name}" (${cols.join(",")})`);
  }
  await pg.query(
    "INSERT INTO resultados(empresa_id,paciente_id,paciente_nome) VALUES($1,$2,$3)",
    [A, 999999, "Legado fictício por validar"],
  );
  await pg.exec(
    await readFile(
      new URL("../migrations/20261021_hospital_integrado.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      new URL("../migrations/20261021_recepcao.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      new URL("../migrations/20261027_emitente_snapshot.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      new URL(
        "../migrations/20261027_rastreabilidade_institucional.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      new URL(
        "../migrations/20261027_biblioteca_organizada.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      new URL(
        "../migrations/20261027_laboratorio_resultados.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pg.exec(await readFile(new URL("../migrations/20261028_profissionais_documentos.sql", import.meta.url), "utf8"));
  await pg.exec(await readFile("migrations/20261028_geografia.sql", "utf8"));
  await pg.exec(await readFile("migrations/20261028_seguradoras_financeiro.sql", "utf8"));
  await pg.exec(await readFile("migrations/20261103_lab_referencias_institucionais.sql", "utf8"));
  await pg.exec(await readFile("migrations/20261105_fluxos_financeiros_assinaturas.sql", "utf8"));
  await pg.exec(await readFile("migrations/20261105_medlink_pedidos_mensagens.sql", "utf8"));
  setDatabaseForTests(drizzle(pg, { schema }) as any, pool);
  for (const [id, name] of [
    [A, "A"],
    [B, "B"],
    [C, "C"],
  ]) {
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$3,$4)",
      [id, name, "owner-" + name, "test"],
    );
    tokens[name] = await signToken({
      role: "empresa",
      empresaId: id,
      username: "owner-" + name,
      funcao: "admin",
    });
  }
  const doctorStaffId=randomUUID();
  await pg.query("INSERT INTO funcionarios(id,empresa_id,nome,username,password,funcao) VALUES($1,$2,'Médico de teste','doctor-A','test','medico')",[doctorStaffId,A]);
  await pg.query("INSERT INTO nv_professionals(empresa_id,funcionario_id,data,updated_by) VALUES($1,$2,$3,'owner-A')",[A,doctorStaffId,{category:"Médico clínico geral",specialties:"Clínica Geral",credential:"TEST-MD",service:"Consulta",contract:"Teste",status:"activo",validUntil:"2099-12-31T23:59:59Z",verifiedBy:"owner-A"}]);
  tokens.doctor = await signToken({
    role: "empresa",
    empresaId: A,
    username: "doctor-A",
    funcao: "medico",
  });
  tokens.finance = await signToken({
    role: "empresa",
    empresaId: A,
    username: "finance-A",
    funcao: "financeiro",
  });
  await pg.query("INSERT INTO pacientes(empresa_id,nome) VALUES($1,$2)", [
    A,
    "Paciente de teste A",
  ]);
  patient = Number(
    (await pg.query<any>("SELECT id FROM pacientes WHERE empresa_id=$1", [A]))
      .rows[0].id,
  );
  app = express();
  app.use(express.json({ limit: "20mb" }));
  app.use("/api/auth", (_req, _res, next) => next());
  app.use("/api", authRouter);
  app.use("/api", empresasRouter);
  app.use("/api", billingRouter);
  app.use("/api", solicitacoesRouter);
  app.use("/api", laboratorioRouter);
  app.use("/api/hospital/lab", createLabWorkflow(pool));
  app.use("/api/hospital", createInstitutionRouter(pool));
  app.use("/api/hospital", createChatTools(pool));
  app.use("/api/hospital", createHospitalRouter(pool));
  app.use(
    "/api/recepcao",
    requireAuth,
    createReceptionRouter({
      pool,
      getAccess: (req) => {
        const u = getUser(req);
        return {
          empresaId: u.empresaId!,
          actor: u.username,
          canRead: true,
          canWrite: true,
        };
      },
      getPatient: async (org, id) =>
        (
          await pg.query<any>(
            "SELECT id,nome,processo FROM pacientes WHERE empresa_id=$1 AND id=$2",
            [org, Number(id)],
          )
        ).rows[0] || null,
      allowedOrigins: ["https://clinic.example"],
    }),
  );
});
after(async () => {
  await pg.close();
});
function call(
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  who = "A",
  body?: any,
) {
  const q = request(app)
    [method]("/api/hospital" + path)
    .set("Authorization", "Bearer " + tokens[who]);
  return body ? q.send(body) : q;
}
test("authentication and tenant isolation for workspace, library and pharmacy", async () => {
  await request(app).get("/api/hospital/workspace").expect(401);
  const saved = await call("put", "/workspace/nursing-patients", "A", {
    revision: 0,
    data: [{ idEnf: 1, nomePaciente: "Enfermagem A" }],
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal((await call("get", "/workspace", "B")).body.length, 0);
  assert.equal((await call("get", "/library", "B")).body.files.length, 0);
  assert.equal((await call("get", "/pharmacy", "B")).body.products.length, 0);
});
test("concurrent-terminal stale version and unauthorized profession cannot overwrite clinical data", async () => {
  await call("put", "/workspace/nursing-patients", "A", {
    revision: 0,
    data: [],
  }).expect(409);
  await call("put", "/workspace/nursing-patients", "finance", {
    revision: 1,
    data: [],
  }).expect(403);
});
test("library ownership is enforced on folders, content, rename and trash", async () => {
  const folder = (
    await call("post", "/library/folders", "A", { name: "Internos" })
  ).body.id;
  const file = await call("post", "/library/files", "A", {
    name: "teste.txt",
    mime: "text/plain",
    base64: Buffer.from("Documento interno A").toString("base64"),
    folderId: folder,
  });
  assert.equal(file.status, 201, JSON.stringify(file.body));
  const id = file.body.id;
  await call("get", "/library/files/" + id, "B").expect(404);
  await call("patch", "/library/files/" + id, "B", {
    action: "rename",
    name: "Copiado",
  }).expect(404);
  await call("post", "/library/files", "B", {
    name: "teste.txt",
    mime: "text/plain",
    base64: "dGVzdGU=",
    folderId: folder,
  }).expect(403);
  const own = await call("get", "/library/files/" + id, "A");
  assert.equal(own.status, 200);
  assert(own.text.includes("Documento interno A"));
  await call("patch", "/library/files/" + id, "A", { action: "trash" }).expect(
    200,
  );
  await call("get", "/library/files/" + id, "A").expect(404);
  await call("patch", "/library/files/" + id, "A", {
    action: "restore",
  }).expect(200);
});
test("chat only reaches colleagues in the same institution and direct messages stay private", async () => {
  await call("post", "/chat", "A", {
    body: "Mensagem de teste",
    recipient: "owner-B",
    requestId: randomUUID(),
  }).expect(403);
  const id = randomUUID();
  await call("post", "/chat", "A", { body: "Canal A", requestId: id }).expect(
    201,
  );
  await call("post", "/chat", "A", { body: "Canal A", requestId: id }).expect(
    201,
  );
  assert.equal((await call("get", "/chat", "A")).body.length, 1);
  assert.equal((await call("get", "/chat", "B")).body.length, 0);
  await call("post", "/chat", "doctor", {
    body: "Mensagem privada",
    recipient: "owner-A",
    requestId: randomUUID(),
  }).expect(201);
  assert.equal((await call("get", "/chat?peer=doctor-A", "A")).body.length, 1);
  assert.equal(
    (await call("get", "/chat?peer=doctor-A", "finance")).body.length,
    0,
  );
});
test("MEDLIK only exposes authorized shared text and revocation blocks future reading", async () => {
  const made = await call("post", "/medlink", "A", {
    patientId: patient,
    targetId: B,
    subject: "Encaminhamento teste",
    body: "Conteúdo seleccionado",
    basis: "Autorização de teste",
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const id = made.body.id;
  assert.equal(
    (await call("get", "/medlink/" + id, "B")).body.body,
    "Conteúdo seleccionado",
  );
  await call("get", "/medlink/" + id, "C").expect(404);
  await call("delete", "/medlink/" + id, "B").expect(404);
  await call("delete", "/medlink/" + id, "A").expect(200);
  await call("get", "/medlink/" + id, "B").expect(404);
});
test("MEDLIK exam request, status and messages are authorised, ordered and tenant-isolated", async () => {
  const requestId = randomUUID();
  const payload = {
    patientId: patient, targetId: B, requestType: "exame",
    subject: "Hemograma para parceiro", body: "Solicitar hemograma e confirmar disponibilidade.",
    basis: "Autorização do paciente registada na unidade de origem", requestId,
  };
  const created = await call("post", "/medlink", "A", payload).expect(201);
  assert.equal(created.body.status, "pendente");
  const id = created.body.id;
  const replay = await call("post", "/medlink", "A", payload).expect(200);
  assert.equal(replay.body.id, id);
  await call("post", "/medlink", "A", { ...payload, subject: "Outro exame" }).expect(409);
  await call("get", `/medlink/${id}/messages`, "C").expect(404);
  await call("post", `/medlink/${id}/status`, "A", { status: "aceite" }).expect(403);
  await call("post", `/medlink/${id}/status`, "B", { status: "concluido" }).expect(403);
  await call("post", `/medlink/${id}/status`, "B", { status: "aceite" }).expect(200);
  const mid = randomUUID();
  await call("post", `/medlink/${id}/messages`, "A", { requestId: mid, body: "Podem receber amanhã?" }).expect(201);
  await call("post", `/medlink/${id}/messages`, "A", { requestId: mid, body: "Podem receber amanhã?" }).expect(200);
  await call("post", `/medlink/${id}/messages`, "A", { requestId: mid, body: "Texto diferente" }).expect(409);
  await call("post", `/medlink/${id}/messages`, "B", { requestId: randomUUID(), body: "Sim, está aceite." }).expect(201);
  const messages = await call("get", `/medlink/${id}/messages`, "B").expect(200);
  assert.equal(messages.body.length, 2);
  assert.equal(messages.body[0].body, "Podem receber amanhã?");
  assert.equal(messages.body[1].body, "Sim, está aceite.");
  await call("post", `/medlink/${id}/status`, "B", { status: "em_execucao" }).expect(200);
  await call("post", `/medlink/${id}/status`, "B", { status: "concluido" }).expect(200);
  await call("post", `/medlink/${id}/status`, "A", { status: "cancelado" }).expect(403);
  await call("delete", `/medlink/${id}`, "A").expect(200);
  await call("get", `/medlink/${id}/messages`, "B").expect(404);
  await call("post", `/medlink/${id}/messages`, "B", { requestId: randomUUID(), body: "Não permitido" }).expect(404);
});
test("database foreign key rejects a result associated with another company patient", async () => {
  await assert.rejects(
    () =>
      pg.query("INSERT INTO resultados(empresa_id,paciente_id) VALUES($1,$2)", [
        B,
        patient,
      ]),
    /foreign key/,
  );
});
test("pharmacy dispenses with prescription balance and stock in one transaction; retry cannot duplicate", async () => {
  const now = new Date(),
    visitId = randomUUID(),
    rxId = randomUUID(),
    itemId = randomUUID();
  const state = {
    version: 1,
    revision: 0,
    visits: [
      {
        id: visitId,
        owner: "doctor-A",
        patient: { id: patient, nome: "Paciente de teste A" },
      },
    ],
    prescriptions: [
      {
        id: rxId,
        visitId,
        patient: { id: patient, nome: "Paciente de teste A" },
        created: now.toISOString(),
        validUntil: "2099-12-31T23:59:59Z",
        items: [
          {
            id: itemId,
            name: "Medicamento de teste",
            dose: "Conforme ordem de teste",
            route: "Teste",
            quantity: 2,
          },
        ],
      },
    ],
    deliveries: [],
    documents: [],
    audit: [],
  };
  const saved = await call("put", "/workspace/clinical", "doctor", {
    revision: 0,
    data: state,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const product = await call("post", "/pharmacy", "A", {
    code: "T1",
    name: "Medicamento de teste",
    lot: "L1",
    expiry: "2099-12-31",
    stock: 3,
    minimum: 1,
    price: 100,
  });
  assert.equal(product.status, 201);
  const move = {
    productId: product.body.id,
    quantity: -2,
    prescriptionId: rxId,
    itemId,
    reason: "Dispensa teste",
    requestId: randomUUID(),
  };
  await call("post", "/pharmacy/move", "A", move).expect(200);
  await call("post", "/pharmacy/move", "A", move).expect(200);
  const current = await call("get", "/pharmacy", "A");
  assert.equal(Number(current.body.products[0].stock), 1);
  const otherProduct = await call("post", "/pharmacy", "A", {
    code: "T2",
    name: "Medicamento diferente",
    lot: "L2",
    expiry: "2099-12-31",
    stock: 3,
    minimum: 1,
    price: 100,
  });
  assert.equal(otherProduct.status, 201);
  await call("post", "/pharmacy/move", "A", {
    ...move,
    productId: otherProduct.body.id,
    quantity: -1,
    requestId: randomUUID(),
  }).expect(409);
  const unchanged = await call("get", "/pharmacy", "A");
  assert.equal(
    Number(unchanged.body.products.find((product: any) => product.id === otherProduct.body.id).stock),
    3,
  );
  await call("post", "/pharmacy/move", "A", {
    ...move,
    quantity: -1,
    requestId: randomUUID(),
  }).expect(409);
  assert.equal(
    Number((await call("get", "/pharmacy", "A")).body.products[0].stock),
    1,
  );
  await call("post", "/pharmacy/move", "B", {
    ...move,
    requestId: randomUUID(),
  }).expect(400);
});
test("reception checks patient institution and persists one arrival per request", async () => {
  const body = {
    pacienteId: String(patient),
    destino: "enfermagem",
    tipo: "normal",
    requestId: randomUUID(),
  };
  const post = (who: string) =>
    request(app)
      .post("/api/recepcao")
      .set("Authorization", "Bearer " + tokens[who])
      .set("Origin", "https://clinic.example")
      .send(body);
  await post("B").expect(404);
  const first = await post("A");
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const again = await post("A");
  assert.equal(again.status, 200);
  assert.equal(again.body.item.id, first.body.item.id);
});
test("logout revokes a real JWT session on the server", async () => {
  const token = await signToken({
    role: "empresa",
    empresaId: C,
    username: "owner-C",
    funcao: "admin",
  });
  await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer " + token)
    .expect(200);
  await request(app)
    .post("/api/auth/logout")
    .set("Authorization", "Bearer " + token)
    .expect(200);
  await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer " + token)
    .expect(401);
});

test("billing assigns unique numbers, recalculates totals and does not duplicate a retried paid invoice", async () => {
  await pg.query("INSERT INTO config(empresa_id,nif) VALUES($1,$2)", [
    A,
    "5417082910",
  ]);
  const body = {
    requestId: randomUUID(),
    tipoDocumento: "factura",
    estado: "paga",
    formaPagamento: "Numerário",
    serie: "A",
    data: "21/10/2026",
    clienteNome: "Cliente teste",
    linhas: [
      {
        descricao: "Serviço teste",
        quantidade: 1,
        precoUnitario: 100,
        ivaIsento: true,
      },
    ],
    subtotalSemIva: 100,
    totalIva: 0,
    ivaTaxa: 0,
    total: 100,
  };
  const post = (b: any) =>
    request(app)
      .post("/api/faturas")
      .set("Authorization", "Bearer " + tokens.A)
      .send(b);
  const first = await post(body);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const retry = await post(body);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.id, first.body.id);
  const second = await post({ ...body, requestId: randomUUID() });
  assert.equal(second.status, 201);
  assert.notEqual(second.body.numero, first.body.numero);
  const movements = await pg.query(
    "SELECT id FROM movimentos WHERE empresa_id=$1",
    [A],
  );
  assert.equal(movements.rows.length, 2);
  await post({ ...body, requestId: randomUUID(), total: 1 }).expect(400);
});

test("a partner cannot read a result from another institution or assign a result to its request", async () => {
  const partnerId = randomUUID(),
    requestId = randomUUID();
  await pg.query(
    "INSERT INTO parceiros(id,empresa_id,nome,username,password) VALUES($1,$2,$3,$4,$5)",
    [partnerId, A, "Parceiro teste", "partner-A", "test"],
  );
  const token = await signToken({
    role: "parceiro",
    empresaId: A,
    username: "partner-A",
    parceiroId: partnerId,
  });
  const foreign = await pg.query<any>(
    "INSERT INTO resultados(empresa_id,paciente_nome) VALUES($1,$2) RETURNING id",
    [B, "Resultado privado B"],
  );
  await pg.query(
    "INSERT INTO solicitacoes(id,empresa_id,parceiro_id,resultado_id) VALUES($1,$2,$3,$4)",
    [requestId, A, partnerId, String(foreign.rows[0].id)],
  );
  await request(app)
    .get("/api/solicitacoes/" + requestId + "/resultado")
    .set("Authorization", "Bearer " + token)
    .expect(404);
  await request(app)
    .put("/api/solicitacoes/" + requestId)
    .set("Authorization", "Bearer " + token)
    .send({ resultadoId: foreign.rows[0].id })
    .expect(403);
});

test("legacy results with a missing patient are retained in the database and withheld from the clinical list", async () => {
  const response = await request(app)
    .get("/api/resultados")
    .set("Authorization", "Bearer " + tokens.A)
    .expect(200);
  assert(
    !response.body.some(
      (x: any) => x.pacienteNome === "Legado fictício por validar",
    ),
  );
  const raw = await pg.query(
    "SELECT id FROM resultados WHERE empresa_id=$1 AND paciente_id=$2",
    [A, 999999],
  );
  assert.equal(raw.rows.length, 1);
  const notice = await call("get", "/integrity", "A");
  assert.equal(notice.body.held, 1);
});

test("patient and administrative classification commit together and reject another institution or a stale revision", async () => {
  const administration = {
    tipo: "particular",
    entidade: "",
    seguradoraId: "",
    apolice: "",
    cartao: "",
    plano: "",
    inicio: "",
    fim: "",
    cobertura: "100",
    autorizacao: "",
    observacoes: "",
  };
  const patient = {
    nome: "Cadastro transaccional teste",
    processo: "P-REG",
    bi: "TESTE-REG",
  };
  const first = await call("post", "/patient-registration", "A", {
    patient,
    administration,
    adminRevision: 0,
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const id = first.body.patient.id;
  assert.match(first.body.patient.processo, /^LAB\/\d{3,}$/);
  assert.notEqual(first.body.patient.processo, patient.processo);
  assert.equal(first.body.adminRevision, 1);
  await call("post", "/patient-registration", "B", {
    id,
    patient,
    administration,
    adminRevision: 1,
  }).expect(404);
  await call("post", "/patient-registration", "A", {
    id,
    patient: { ...patient, nome: "Alteração obsoleta" },
    administration,
    adminRevision: 0,
  }).expect(409);
  const raw = await pg.query<any>("SELECT nome FROM pacientes WHERE id=$1", [
    id,
  ]);
  assert.equal(raw.rows[0].nome, patient.nome);
  assert.equal(
    (await call("get", "/records/patient-admin", "A")).body.length,
    1,
  );
  assert.equal(
    (await call("get", "/records/patient-admin", "B")).body.length,
    0,
  );
});

test("laboratory stock does not silently clamp overselling and a rejected movement leaves no trace", async () => {
  const product = await pg.query<any>(
    "INSERT INTO reagentes(empresa_id,nome,quantidade_atual) VALUES($1,$2,$3) RETURNING id",
    [A, "Reagente teste", 2],
  );
  const post = (quantity: number, who = "A") =>
    request(app)
      .post("/api/stock-movimentos")
      .set("Authorization", "Bearer " + tokens[who])
      .send({
        reagenteId: product.rows[0].id,
        tipo: "saida",
        quantidade: quantity,
        motivo: "Consumo teste",
      });
  await post(3).expect(409);
  await post(1, "B").expect(404);
  await post(1).expect(201);
  assert.equal(
    Number(
      (
        await pg.query<any>(
          "SELECT quantidade_atual FROM reagentes WHERE id=$1",
          [product.rows[0].id],
        )
      ).rows[0].quantidade_atual,
    ),
    1,
  );
  assert.equal(
    (
      await pg.query("SELECT id FROM stock_movimentos WHERE reagente_id=$1", [
        product.rows[0].id,
      ])
    ).rows.length,
    1,
  );
});

test("a receipt cannot mark a larger invoice paid and the original issuer is snapshotted", async () => {
  const post = (b: any) =>
    request(app)
      .post("/api/faturas")
      .set("Authorization", "Bearer " + tokens.A)
      .send(b);
  const original = {
    requestId: randomUUID(),
    tipoDocumento: "factura",
    estado: "emitida",
    data: "27/10/2026",
    clienteNome: "Cliente teste",
    linhas: [
      {
        descricao: "Serviço teste",
        quantidade: 1,
        precoUnitario: 100,
        ivaIsento: true,
      },
    ],
    subtotalSemIva: 100,
    totalIva: 0,
    ivaTaxa: 0,
    total: 100,
  };
  const made = await post(original);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.emitenteSnapshot.nif, "5417082910");
  const invalid = await post({
    ...original,
    requestId: randomUUID(),
    tipoDocumento: "recibo",
    estado: "paga",
    formaPagamento: "Numerário",
    faturaOrigemId: made.body.id,
    linhas: [{ ...original.linhas[0], precoUnitario: 50 }],
    subtotalSemIva: 50,
    total: 50,
  });
  assert.equal(invalid.status, 409);
  const invoice = await pg.query<any>(
    "SELECT estado FROM faturas WHERE id=$1",
    [made.body.id],
  );
  assert.equal(invoice.rows[0].estado, "emitida");
});

let labCatalog: any, labOrder: any, labContainer: any, labValue: any;
const future = () => new Date(Date.now() + 30 * 86400000).toISOString();
const labData = {
  name: "Análise local para teste",
  sector: "Sector fictício de teste",
  material: "Sangue de teste",
  container: "Recipiente de teste",
  minVolume: 2,
  preparation: "Preparação aprovada para teste",
  transport: "Condições aprovadas para teste",
  stability: "Estabilidade de teste",
  tatHours: 12,
  retentionDays: 7,
  method: "Método de teste",
  unit: "u.teste",
  reference: "Intervalo aprovado exclusivamente para teste",
  criticalLow: 1,
  criticalHigh: 10,
  rejection: "Critérios do laboratório de teste",
  protocol: "Protocolo de teste v1",
  qcRequired: true,
  requiresClinical: true,
};
async function seedProfessional(name: string, role = "tecnico") {
  const id = randomUUID();
  await pg.query(
    "INSERT INTO funcionarios(id,empresa_id,nome,username,password,funcao) VALUES($1,$2,$3,$3,'test',$4)",
    [id, A, name, role],
  );
  tokens[name] = await signToken({
    role: "empresa",
    empresaId: A,
    username: name,
    funcao: role,
    funcionarioId: id,
  });
  const result = await call("put", "/professionals/" + id, "A", {
    revision: 0,
    data: {
      category: "Profissional de teste",
      specialties: "Competência de teste",
      credential: "Cédula de teste",
      service: "Sector de teste",
      contract: "Contrato de teste",
      status: "activo",
      validUntil: future(),
      verification: "Verificação fictícia em ambiente local",
    },
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return id;
}
async function grant(actor: string, permission: string) {
  const response = await call("post", "/access/grants", "A", {
    actor,
    permission,
    reason: "Autorização exclusivamente para teste local",
    expiresAt: future(),
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}
async function currentLab() {
  const response = await call("get", "/lab/orders/" + labOrder.id);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  labContainer =
    response.body.containers.find((c: any) => c.id === labContainer?.id) ||
    response.body.containers[0];
  return response.body;
}
async function stage(action: string, extra: any = {}, who = "lab-entry") {
  await currentLab();
  return call("post", `/lab/containers/${labContainer.id}/action`, who, {
    action,
    revision: labContainer.revision,
    requestId: randomUUID(),
    identity1: "Paciente de teste A",
    identity2: String(patient),
    location: "Local de teste",
    ...extra,
  });
}
test("institutional grants require independent verified credentials and cannot cross tenants", async () => {
  await seedProfessional("lab-entry");
  await seedProfessional("lab-technical");
  await seedProfessional("lab-release");
  await call("post", "/access/grants", "A", {
    actor: "owner-A",
    permission: "lab.quality",
    reason: "Teste",
    expiresAt: future(),
  }).expect(403);
  await call("post", "/access/grants", "B", {
    actor: "lab-entry",
    permission: "lab.quality",
    reason: "Teste",
    expiresAt: future(),
  }).expect(404);
  await call("post", "/access/grants", "A", {
    actor: "lab-entry",
    permission: "lab.quality",
    reason: "Teste",
    expiresAt: "2020-01-01",
  }).expect(400);
  await grant("lab-entry", "lab.quality");
  await grant("lab-entry", "lab.validate.technical");
  await grant("lab-technical", "lab.validate.technical");
  await grant("lab-release", "lab.validate.release");
  await grant("lab-entry", "lab.catalog.approve");
  await grant("lab-technical", "lab.catalog.approve");
  await call("put", "/institution", "A", {
    revision: 0,
    data: {
      profile: "queimados",
      services: [
        "queimados",
        "epidemiologia",
        "cirurgia",
        "maternidade",
        "esterilizacao",
        "equipamentos",
        "escalas",
        "transporte",
      ],
      labSectors: [labData.sector],
      specialties: ["Clínica Geral", "Queimados"],
      protocolReference: "Aprovação institucional de teste",
    },
  }).expect(200);
  assert.equal(
    (await call("get", "/institution", "B")).body.data.profile,
    "geral",
  );
  await call("put", "/institution", "finance", {
    revision: 1,
    data: {},
  }).expect(403);
});
test("laboratory catalog requires approval by another accredited professional and snapshots its version", async () => {
  const response = await call("post", "/lab/catalog", "lab-entry", {
    code: "TEST-A",
    data: labData,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  labCatalog = response.body;
  await call("post", "/lab/orders", "doctor", {
    patientId: patient,
    tests: [labCatalog.id],
    priority: "rotina",
    origin: "Teste",
    indication: "Indicação de teste",
    requestId: randomUUID(),
  }).expect(409);
  await call("post", `/lab/catalog/${labCatalog.id}/approve`, "lab-entry", {
    reason: "Teste",
  }).expect(403);
  await call("post", `/lab/catalog/${labCatalog.id}/approve`, "lab-technical", {
    reason: "Revisão independente de teste",
  }).expect(200);
  const requestId = randomUUID(),
    body = {
      patientId: patient,
      tests: [labCatalog.id],
      priority: "urgente",
      origin: "Origem de teste",
      indication: "Indicação de teste",
      requestId,
    };
  const order = await call("post", "/lab/orders", "doctor", body);
  assert.equal(order.status, 201, JSON.stringify(order.body));
  labOrder = order.body;
  assert.equal(
    (await call("post", "/lab/orders", "doctor", body)).body.id,
    labOrder.id,
  );
  await call("get", "/lab/orders/" + labOrder.id, "B").expect(404);
  await call("post", "/lab/orders", "B", {
    ...body,
    requestId: randomUUID(),
  }).expect(404);
  const detail = await currentLab();
  assert.equal(detail.containers.length, 1);
  assert.equal(detail.tests[0].snapshot.version, 1);
  assert.notEqual(labContainer.sample_id, labContainer.id);
  assert.ok(!labContainer.code.includes("Paciente"));
  await call("get", "/lab/catalog", "finance").expect(403);
});
test("sample identity, print/reprint and receipt transitions enforce patient matching and idempotency", async () => {
  await stage("imprimir", { printer: "Impressora fictícia" }).then((q) =>
    assert.equal(q.status, 409),
  );
  await stage("colher", {
    identity1: "Outro paciente",
    site: "Local anatómico de teste",
  }).then((q) => assert.equal(q.status, 409));
  await stage("colher", { site: "Local anatómico de teste" }).then((q) =>
    assert.equal(q.status, 200, JSON.stringify(q.body)),
  );
  await stage("receber", {
    scan: labContainer.code,
    conditions: "Teste",
    temperature: "Teste",
  }).then((q) => assert.equal(q.status, 409));
  const requestId = randomUUID();
  await currentLab();
  const body = {
    action: "imprimir",
    revision: labContainer.revision,
    requestId,
    identity1: "Paciente de teste A",
    identity2: String(patient),
    printer: "Impressora de teste",
  };
  await call(
    "post",
    `/lab/containers/${labContainer.id}/action`,
    "lab-entry",
    body,
  ).expect(200);
  await call(
    "post",
    `/lab/containers/${labContainer.id}/action`,
    "lab-entry",
    body,
  ).expect(200);
  await currentLab();
  assert.equal(labContainer.print_count, 1);
  await stage("imprimir", { printer: "Impressora de teste" }).then((q) =>
    assert.equal(q.status, 400),
  );
  await stage("imprimir", {
    printer: "Impressora de teste",
    note: "Etiquetagem ilegível de teste",
    destroyPrevious: true,
  }).then((q) => assert.equal(q.status, 200));
  await stage("etiquetar", { scan: "NV-ERRADO" }).then((q) =>
    assert.equal(q.status, 409),
  );
  await stage("etiquetar", { scan: labContainer.code }).then((q) =>
    assert.equal(q.status, 200),
  );
  await stage("transportar", {
    destination: "Laboratório de teste",
    conditions: "Transporte de teste",
  }).then((q) => assert.equal(q.status, 200));
  await stage("receber", {
    scan: labContainer.code,
    conditions: "Embalagem conferida",
    temperature: "Temperatura de teste",
  }).then((q) => assert.equal(q.status, 200));
  await stage("receber", {
    scan: labContainer.code,
    conditions: "Teste",
    temperature: "Teste",
  }).then((q) => assert.equal(q.status, 409));
  await call("get", "/lab/scan/" + labContainer.code, "B").expect(404);
});
test("sample acceptance prevents insufficient volume, tracks aliquots and preserves rejected recollections", async () => {
  await stage("aceitar", {
    volume: 1,
    containerConfirmed: true,
    conditionsConfirmed: true,
  }).then((q) => assert.equal(q.status, 409));
  await stage("aceitar", {
    volume: 3,
    containerConfirmed: true,
    conditionsConfirmed: true,
  }).then((q) => assert.equal(q.status, 200));
  const aliquot = await stage("aliquota", {
    note: "Derivação de teste",
    container: "Criotubo de teste",
  });
  assert.equal(aliquot.status, 200, JSON.stringify(aliquot.body));
  const detail = await currentLab(),
    child = detail.containers.find((c: any) => c.id === aliquot.body.derivedId);
  assert.equal(child.parent_id, labContainer.id);
  assert.equal(child.sample_id, labContainer.sample_id);
  assert.notEqual(child.code, labContainer.code);
  assert.match(child.code, /^LAB\/\d{3,}$/);
  assert.match(labContainer.code, /^LAB\/\d{3,}$/);
  await stage("processar", {
    equipment: "Equipamento de teste",
    reagentLot: "LOTE-TESTE",
  }).then((q) => assert.equal(q.status, 200));
  await stage("colher", { site: "Teste" }).then((q) =>
    assert.equal(q.status, 409),
  );
  const retryOrder = await call("post", "/lab/orders", "doctor", {
    patientId: patient,
    tests: [labCatalog.id],
    priority: "rotina",
    origin: "Teste",
    indication: "Nova colheita de teste",
    requestId: randomUUID(),
  });
  const other = (await call("get", "/lab/orders/" + retryOrder.body.id)).body
    .containers[0];
  await pg.query(
    "UPDATE nv_lab_containers SET status='recebida',collected_at=now() WHERE id=$1",
    [other.id],
  );
  let response = await call(
    "post",
    `/lab/containers/${other.id}/action`,
    "lab-entry",
    {
      action: "rejeitar",
      revision: 1,
      requestId: randomUUID(),
      volume: 0,
      note: "Volume insuficiente de teste",
      serviceNotified: "Serviço de teste",
    },
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  response = await call(
    "post",
    `/lab/containers/${other.id}/action`,
    "lab-entry",
    {
      action: "recolher",
      revision: 2,
      requestId: randomUUID(),
      note: "Nova colheita autorizada de teste",
      location: "Local de teste",
    },
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const rows = (await call("get", "/lab/orders/" + retryOrder.body.id)).body
    .containers;
  const newSample = rows.find((s: any) => s.id === response.body.derivedId);
  assert.notEqual(newSample.sample_id, other.sample_id);
  assert.equal(rows.find((s: any) => s.id === other.id).status, "rejeitada");
});
test("lab results require current quality control and independent technical and clinical validators", async () => {
  const detail = await currentLab(),
    testId = detail.tests[0].id,
    body = {
      containerId: labContainer.id,
      previousVersion: 0,
      measured: "15",
      comment: "Introdução manual de teste",
      requestId: randomUUID(),
    };
  const response = await call(
    "post",
    `/lab/tests/${testId}/values`,
    "lab-entry",
    body,
  );
  assert.equal(response.status, 201, JSON.stringify(response.body));
  labValue = response.body;
  assert.equal(labValue.critical, true);
  await grant("lab-entry", "lab.validate.solo");
  await call("post", `/lab/values/${labValue.id}/validate`, "lab-entry", {
    phase: "solo_release",
    note: "Nomeação de técnico único para testes não críticos, com risco revisto.",
    confirmNonCritical: true,
  }).expect(403);
  await call("post", `/lab/values/${labValue.id}/validate`, "lab-entry", {
    phase: "technical",
  }).expect(403);
  await call("post", `/lab/values/${labValue.id}/validate`, "lab-technical", {
    phase: "technical",
  }).expect(409);
  const qc = {
    sector: labData.sector,
    equipment: "Equipamento de teste",
    reagentLot: "LOTE-TESTE",
    outcome: "reprovado",
    note: "CQ de teste reprovado",
    validUntil: future(),
  };
  await call("post", "/lab/quality", "lab-entry", qc).expect(201);
  await call("post", `/lab/values/${labValue.id}/validate`, "lab-technical", {
    phase: "technical",
  }).expect(409);
  await call("post", "/lab/quality", "lab-entry", {
    ...qc,
    outcome: "aprovado",
    note: "CQ de teste aprovado após correcção",
  }).expect(201);
  await call("post", `/lab/values/${labValue.id}/validate`, "lab-technical", {
    phase: "technical",
  }).expect(200);
  const beforeCriticalGrant = await call("get", "/lab/report-capabilities", "lab-release").expect(200);
  assert.equal(beforeCriticalGrant.body.canRelease, true);
  assert.equal(beforeCriticalGrant.body.canCritical, false);
  await call("post", `/lab/values/${labValue.id}/validate`, "lab-release", {
    phase: "release",
  }).expect(403);
  await grant("lab-release", "lab.critical.release");
  assert.equal((await call("get", "/lab/report-capabilities", "lab-release")).body.canCritical, true);
  await call("post", `/lab/values/${labValue.id}/validate`, "lab-release", {
    phase: "release",
  }).expect(200);
  const latest = await currentLab();
  assert.ok(latest.values[0].released_at);
  const resultId = latest.tests[0].result_id;
  assert.ok(resultId);
  const ready = await call("get", "/lab/reports?state=ready&q=" + encodeURIComponent(labContainer.code), "lab-release").expect(200);
  assert.equal(ready.body.items.find((x:any) => x.result.id === resultId).managed.sampleCode, labContainer.code);
  const exported = await call("post", "/result-export/" + resultId, "A", {}).expect(200);
  assert.equal(exported.body.trace.sampleCode, labContainer.code);
  assert.equal(exported.body.trace.accession, labOrder.accession);

  await request(app)
    .put(`/api/resultados/${resultId}`)
    .set("Authorization", "Bearer " + tokens.A)
    .send({ parametros: [] })
    .expect(409);
  await call("post", `/lab/values/${labValue.id}/validate`, "lab-release", {
    phase: "release",
  }).expect(409);
  await call("post", `/lab/tests/${testId}/values`, "lab-entry", {
    ...body,
    requestId: randomUUID(),
    previousVersion: 1,
    measured: "16",
  }).expect(400);
  const corrected = await call(
    "post",
    `/lab/tests/${testId}/values`,
    "lab-entry",
    {
      ...body,
      requestId: randomUUID(),
      previousVersion: 1,
      measured: "16",
      reason: "Retificação justificada de teste",
    },
  );
  assert.equal(corrected.status, 201, JSON.stringify(corrected.body));
  const visible = await request(app)
    .get("/api/resultados")
    .set("Authorization", "Bearer " + tokens.A);
  const provisional=visible.body.find((r:any)=>r.id===resultId);
  assert.equal(provisional.reviewState,"rascunho");
  assert.equal(provisional.parametros[0].resultado,"16");
  const internal=await call("post","/result-export/"+resultId,"A",{purpose:"internal"}).expect(200);
  assert.equal(internal.body.trace.provisional,true);
  assert.equal(internal.body.result.parametros[0].resultado,"16");
  await call("post","/result-export/"+resultId,"A",{}).expect(409);
  assert.equal((await currentLab()).values.length, 2);
});
test("critical communication requires readback and does not equate notification with acknowledgement", async () => {
  const before = await call("get", "/lab/indicators");
  assert.ok(before.body.criticalUnacknowledged >= 1);
  await call("post", `/lab/values/${labValue.id}/communication`, "lab-entry", {
    recipient: "Médico de teste",
    channel: "Telefone",
    note: "Tentativa de teste",
    acknowledged: true,
    requestId: randomUUID(),
  }).expect(400);
  await call("post", `/lab/values/${labValue.id}/communication`, "lab-entry", {
    recipient: "Médico de teste",
    channel: "Telefone",
    note: "Sem resposta de teste",
    acknowledged: false,
    requestId: randomUUID(),
  }).expect(201);
  const requestId = randomUUID(),
    body = {
      recipient: "Médico de teste",
      channel: "Telefone",
      note: "Recepção de teste",
      acknowledged: true,
      readback: "Destinatário repetiu o valor de teste",
      requestId,
    };
  const a = await call(
      "post",
      `/lab/values/${labValue.id}/communication`,
      "lab-entry",
      body,
    ),
    b = await call(
      "post",
      `/lab/values/${labValue.id}/communication`,
      "lab-entry",
      body,
    );
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.id, b.body.id);
  await call("post", `/lab/values/${labValue.id}/communication`, "B", {
    ...body,
    requestId: randomUUID(),
  }).expect(404);
  assert.equal(
    (await call("get", "/lab/indicators")).body.criticalUnacknowledged,
    before.body.criticalUnacknowledged - 1,
  );
});
test("specialised services are opt-in, restrict epidemiology and preserve immutable completed versions", async () => {
  await call("get", "/services/queimados", "B").expect(403);
  await call("get", "/services/epidemiologia", "doctor").expect(403);
  const body = {
    revision: 0,
    title: "Avaliação de queimadura fictícia",
    status: "aberto",
    patientId: patient,
    assignedTo: "doctor-A",
    reason: "Avaliação de teste",
    data: {
      mechanism: "Térmica de teste",
      incidentAt: "2026-01-10T10:00",
      extent: "20",
      depth: "Avaliação profissional de teste",
      site: "Braço de teste",
      inhalation: "Avaliação de teste",
      wound: "Penso de teste",
      plan: "Plano registado de teste",
      protocol: "Protocolo institucional de teste",
      followup: "Reabilitação de teste",
    },
  };
  const id = randomUUID();
  await call("put", "/services/queimados/" + id, "doctor", {
    ...body,
    data: { ...body.data, extent: "110" },
  }).expect(400);
  const created = await call(
    "put",
    "/services/queimados/" + id,
    "doctor",
    body,
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  await call("put", "/services/queimados/" + id, "doctor", body).expect(409);
  await call("put", "/services/queimados/" + id, "doctor", {
    ...body,
    revision: 1,
    status: "concluido",
    reason: "Conclusão de teste",
  }).expect(200);
  await call("put", "/services/queimados/" + id, "doctor", {
    ...body,
    revision: 2,
  }).expect(409);
  assert.equal(
    (await call("get", "/services/queimados/" + id + "/history", "doctor")).body
      .length,
    2,
  );
  await call("get", "/services/queimados/" + id + "/history", "B").expect(403);
  const peri = {
    ...body,
    title: "Cirurgia fictícia",
    status: "aberto",
    data: {
      resource: "Sala de teste",
      start: "2027-01-01T10:00",
      end: "2027-01-01T12:00",
      procedure: "Procedimento de teste",
      team: "Equipa de teste",
      consent: "Consentimento de teste",
      protocol: "Checklist de teste",
      signIn: "",
      timeOut: "",
      signOut: "",
      recovery: "",
    },
  };
  await call(
    "put",
    "/services/cirurgia/" + randomUUID(),
    "doctor",
    peri,
  ).expect(200);
  await call(
    "put",
    "/services/cirurgia/" + randomUUID(),
    "doctor",
    peri,
  ).expect(409);
  await call("put", "/services/cirurgia/" + randomUUID(), "doctor", {
    ...peri,
    data: { ...peri.data, resource: "Outra sala" },
    status: "concluido",
  }).expect(409);
  await call("put", "/services/maternidade/" + randomUUID(), "doctor", {
    ...body,
    data: {
      assessment: "Teste",
      protocol: "Teste",
      plan: "Teste",
      newbornPatientId: String(patient),
    },
  }).expect(409);
});
test("private chat attachments cannot be downloaded by third parties or another institution", async () => {
  const body = {
    recipient: "lab-technical",
    body: "Mensagem privada de teste",
    requestId: randomUUID(),
    attachment: {
      name: "teste.txt",
      mime: "text/plain",
      base64: Buffer.from("Anexo fictício privado").toString("base64"),
    },
  };
  const response = await call("post", "/chat/send", "lab-entry", body);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(
    (await call("post", "/chat/send", "lab-entry", body)).body.id,
    response.body.id,
  );
  const list = await call("get", "/chat?peer=lab-entry", "lab-technical"),
    message = list.body.find((m: any) => m.id === response.body.id),
    attachment = message.attachments[0];
  assert.ok(attachment.id);
  await call("get", "/chat/attachments/" + attachment.id, "lab-release").expect(
    404,
  );
  await call("get", "/chat/attachments/" + attachment.id, "B").expect(404);
  await call(
    "get",
    "/chat/attachments/" + attachment.id,
    "lab-technical",
  ).expect(200);
  await call("post", "/chat/read", "lab-technical", {
    peer: "lab-entry",
  }).expect(200);
  assert.ok(
    (await call("get", "/chat?peer=lab-technical", "lab-entry")).body.find(
      (m: any) => m.id === response.body.id,
    ).read_at,
  );
  await call("post", "/chat/send", "lab-entry", {
    ...body,
    requestId: randomUUID(),
    attachment: { ...body.attachment, mime: "application/pdf" },
  }).expect(400);
});
test("audit chain detects tampering and never returns another institution's events", async () => {
  const verified = await call("get", "/audit/verify");
  assert.equal(verified.status, 200);
  assert.equal(verified.body.valid, true);
  assert.ok(verified.body.count > 10);
  const other = (await call("get", "/audit", "B")).body;
  assert.ok(other.every((e: any) => e.empresa_id === B));
  const first = Number(
    (
      await pg.query<any>(
        "SELECT min(id) AS id FROM nv_audit WHERE empresa_id=$1",
        [A],
      )
    ).rows[0].id,
  );
  await pg.query("UPDATE nv_audit SET action='tampered-test' WHERE id=$1", [
    first,
  ]);
  assert.equal((await call("get", "/audit/verify")).body.valid, false);
});
test("server-side scheduling rejects overlap, foreign patients and deletion without cancellation", async () => {
  const id = randomUUID(),
    when = "2027-02-01T10:00",
    record = {
      id,
      patientId: patient,
      patientName: "Paciente de teste A",
      when,
      service: "Consulta de teste",
      professional: "Profissional de teste",
      durationMinutes: 60,
      room: "Sala teste",
      status: "marcado",
    };
  await call("put", "/workspace/appointments", "A", {
    revision: 0,
    data: [record],
  }).expect(200);
  await call("put", "/workspace/appointments", "A", {
    revision: 1,
    data: [
      record,
      {
        ...record,
        id: randomUUID(),
        when: "2027-02-01T10:30",
        professional: "Outro profissional",
      },
    ],
  }).expect(409);
  await call("put", "/workspace/appointments", "A", {
    revision: 1,
    data: [],
  }).expect(400);
  await call("put", "/workspace/appointments", "A", {
    revision: 1,
    data: [{ ...record, status: "cancelado" }],
  }).expect(400);
  await call("put", "/workspace/appointments", "A", {
    revision: 1,
    data: [
      { ...record, status: "cancelado", cancelReason: "Cancelamento de teste" },
    ],
  }).expect(200);
  await call("put", "/workspace/appointments", "B", {
    revision: 0,
    data: [record],
  }).expect(403);
});
test("sensitive workspace and reports are minimised by profession and export checks the current result version", async () => {
  const rows = (await call("get", "/workspace", "finance")).body;
  assert.ok(
    !rows.some(
      (r: any) =>
        r.namespace === "clinical" || r.namespace.startsWith("nursing-"),
    ),
  );
  const results = await request(app)
    .get("/api/resultados")
    .set("Authorization", "Bearer " + tokens.finance);
  assert.equal(results.body.length, 0);
  const latest = await currentLab(),
    id = latest.tests[0].result_id;
  await call("post", "/result-export/" + id, "finance", {}).expect(403);
  await call("post", "/result-export/" + id, "B", {}).expect(404);
  await call("post", "/result-export/" + id, "A", {}).expect(409);
});
test("administrative account listings never expose branch passwords to staff or administrators", async () => {
  const branch = randomUUID();
  await pg.query(
    "INSERT INTO empresas(id,nome,username,password,parent_empresa_id) VALUES($1,'Sucursal fictícia','branch-test','private-test-hash',$2)",
    [branch, A],
  );
  const response = await request(app)
    .get("/api/sucursais")
    .set("Authorization", "Bearer " + tokens.A);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body.length);
  assert.ok(response.body.every((r: any) => !("password" in r)));
  await request(app)
    .get("/api/sucursais")
    .set("Authorization", "Bearer " + tokens.finance)
    .expect(403);
  await request(app)
    .get("/api/empresas/" + A + "/funcionarios")
    .set("Authorization", "Bearer " + tokens.finance)
    .expect(403);
  await request(app)
    .get("/api/solicitacoes")
    .set("Authorization", "Bearer " + tokens.finance)
    .expect(403);
});
test("financial exports are tenant-scoped, minimised and audited on the server", async () => {
  const response = await call("post", "/finance-export", "finance", {});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.empresaId, A);
  assert.ok(response.body.faturas.every((f: any) => f.empresa_id === A));
  assert.ok(
    response.body.pacientes.every(
      (p: any) => !("alergias" in p) && !("medicacao_habitual" in p),
    ),
  );
  await call("post", "/finance-export", "doctor", {}).expect(403);
  const other = (await call("post", "/finance-export", "B", {})).body;
  assert.equal(other.empresaId, B);
  assert.ok(other.faturas.every((f: any) => f.empresa_id === B));
});
test("professional suspension revokes active sessions and delegated permissions immediately", async () => {
  const found = (
      await pg.query<any>(
        "SELECT funcionario_id,revision,data FROM nv_professionals WHERE empresa_id=$1 AND data->>'credential'='Cédula de teste' ORDER BY updated_at LIMIT 1",
        [A],
      )
    ).rows[0],
    who = (
      await pg.query<any>("SELECT username FROM funcionarios WHERE id=$1", [
        found.funcionario_id,
      ])
    ).rows[0].username;
  await call("put", "/professionals/" + found.funcionario_id, "A", {
    revision: found.revision,
    data: { ...found.data, status: "suspenso" },
  }).expect(200);
  await call("get", "/lab/catalog", who).expect(401);
  const live = await pg.query(
    "SELECT 1 FROM nv_grants WHERE empresa_id=$1 AND actor=$2 AND revoked_at IS NULL",
    [A, who],
  );
  assert.equal(live.rows.length, 0);
});

async function libraryItems(who = "A") {
  const response = await call("get", "/library", who).expect(200);
  return response.body.items as any[];
}
async function libraryFolder(
  name: string,
  parentId: string | null = null,
  who = "A",
) {
  return (
    await call("post", "/library/folders", who, {
      name: name + "-" + randomUUID().slice(0, 8),
      parentId,
    }).expect(201)
  ).body.id as string;
}
async function libraryUpload(
  folderId: string | null,
  name = "interno.txt",
  who = "A",
) {
  return (
    await call("post", "/library/files", who, {
      name,
      folderId,
      mime: "text/plain",
      base64: Buffer.from("Documento institucional real para teste").toString(
        "base64",
      ),
    }).expect(201)
  ).body.id as string;
}
async function libraryChange(
  action: string,
  id: string,
  extra: any = {},
  who = "A",
) {
  const item = (await libraryItems(who)).find((i) => i.id === id);
  assert(item);
  return call("post", "/library/batch", who, {
    action,
    items: [{ id, type: item.type, revision: item.revision }],
    ...extra,
  });
}
test("library metadata stays institutional, favorites stay personal and stale writes are rejected", async () => {
  const id = await libraryUpload(null, "Metadados-" + randomUUID() + ".txt");
  const old = (await libraryItems()).find((i) => i.id === id);
  await libraryChange("describe", id, {
    description: "Documento interno da empresa A",
  }).then((r) => assert.equal(r.status, 200));
  await call("post", "/library/batch", "A", {
    action: "rename",
    name: "Alteração antiga",
    items: [{ id, type: "file", revision: old.revision }],
  }).expect(409);
  await libraryChange("tag", id, { tags: ["important", "work"] }).then((r) =>
    assert.equal(r.status, 200),
  );
  await libraryChange("favorite", id).then((r) => assert.equal(r.status, 200));
  const own = (await libraryItems()).find((i) => i.id === id);
  assert.equal(own.description, "Documento interno da empresa A");
  assert.deepEqual(own.tags, ["important", "work"]);
  assert.equal(own.favorite, true);
  const colleague = (await libraryItems("doctor")).find((i) => i.id === id);
  assert.equal(colleague.favorite, false);
  assert.equal(colleague.description, own.description);
  assert.equal(
    (await libraryItems("B")).some((i) => i.id === id),
    false,
  );
  await call("post", "/library/batch", "B", {
    action: "describe",
    description: "foreign",
    items: [{ id, type: "file" }],
  }).expect(404);
  await call("post", "/library/batch", "A", {
    action: "rename",
    name: "no",
    items: [null],
  }).expect(400);
});
test("library upload retries return one confirmed file and reject a changed request body", async () => {
  const requestId = randomUUID(),
    body = {
      name: "repetir.txt",
      mime: "text/plain",
      folderId: null,
      requestId,
      base64: Buffer.from("conteúdo").toString("base64"),
    };
  const first = await call("post", "/library/files", "A", body).expect(201);
  const second = await call("post", "/library/files", "A", body).expect(201);
  assert.equal(first.body.id, second.body.id);
  assert.equal(second.body.replayed, true);
  await call("post", "/library/files", "A", {
    ...body,
    base64: Buffer.from("diferente").toString("base64"),
  }).expect(409);
  assert.equal(
    (await libraryItems()).filter((i) => i.id === first.body.id).length,
    1,
  );
  await call("post", "/library/files", "A", {
    ...body,
    requestId: randomUUID(),
    mime: "application/pdf",
  }).expect(400);
  const downloaded = await call(
    "get",
    "/library/files/" + first.body.id,
  ).expect(200);
  assert.equal(downloaded.text, "conteúdo");
  assert.equal(downloaded.headers["cache-control"], "no-store");
  assert.equal(downloaded.headers["x-content-type-options"], "nosniff");
});
test("nested copies keep every parent and file byte, and moves reject cycles or foreign folders", async () => {
  const top = await libraryFolder("Origem"),
    nested = await libraryFolder("Subpasta", top),
    target = await libraryFolder("Destino");
  const id = await libraryUpload(nested, "manual.txt"),
    foreign = await libraryFolder("Outra", null, "B");
  await libraryChange("move", top, { folderId: nested }).then((r) =>
    assert.equal(r.status, 409),
  );
  await libraryChange("move", id, { folderId: foreign }).then((r) =>
    assert.equal(r.status, 403),
  );
  const copied = await libraryChange("copy", top, {
    folderId: target,
    name: "Cópia integral",
  });
  assert.equal(copied.status, 200, JSON.stringify(copied.body));
  assert.equal(copied.body.created.length, 3);
  const items = await libraryItems(),
    root = items.find((i) => i.parentId === target);
  assert.equal(root.name, "Cópia integral");
  const child = items.find((i) => i.parentId === root.id),
    file = items.find((i) => i.parentId === child.id);
  assert.equal(file.name, "manual.txt");
  assert.equal(file.sha256, items.find((i) => i.id === id).sha256);
  assert.equal(
    (await call("get", "/library/files/" + file.id).expect(200)).text,
    "Documento institucional real para teste",
  );
  await libraryChange("move", id, { folderId: target }).then((r) =>
    assert.equal(r.status, 200),
  );
  assert.equal(
    (await libraryItems()).find((i) => i.id === id).parentId,
    target,
  );
});
test("folder restore preserves earlier trash and permanent deletion requires institutional administration", async () => {
  const top = await libraryFolder("Restauro"),
    nested = await libraryFolder("Nível", top);
  const active = await libraryUpload(nested, "activo.txt"),
    earlier = await libraryUpload(nested, "eliminado-antes.txt");
  await libraryChange("trash", earlier).then((r) =>
    assert.equal(r.status, 200),
  );
  await libraryChange("trash", top).then((r) => assert.equal(r.status, 200));
  await call("get", "/library/files/" + active).expect(404);
  await libraryChange("restore", active).then((r) =>
    assert.equal(r.status, 409),
  );
  await libraryChange("restore", top).then((r) => assert.equal(r.status, 200));
  const items = await libraryItems();
  assert.equal(items.find((i) => i.id === active).deletedAt, null);
  assert(items.find((i) => i.id === earlier).deletedAt);
  await call("get", "/library/files/" + active).expect(200);
  await call("get", "/library/files/" + earlier).expect(404);
  await libraryChange("purge", earlier, {}, "doctor").then((r) =>
    assert.equal(r.status, 403),
  );
  await libraryChange("purge", active).then((r) => assert.equal(r.status, 409));
  await libraryChange("trash", top).then((r) => assert.equal(r.status, 200));
  const batchItems = await libraryItems();
  await call("post", "/library/batch", "A", {
    action: "restore",
    items: [earlier, top].map((id) => {
      const row = batchItems.find((i) => i.id === id);
      return { id, type: row.type, revision: row.revision };
    }),
  }).expect(200);
  assert.equal(
    (await libraryItems()).find((i) => i.id === earlier).deletedAt,
    null,
  );
  await libraryChange("trash", top).then((r) => assert.equal(r.status, 200));
  await call("post", "/library/batch", "B", {
    action: "purge",
    items: [{ id: top, type: "folder" }],
  }).expect(404);
  await libraryChange("purge", top).then((r) =>
    assert.equal(r.status, 200, JSON.stringify(r.body)),
  );
  const remaining = await libraryItems();
  for (const id of [top, nested, active, earlier])
    assert.equal(
      remaining.some((i) => i.id === id),
      false,
    );
});
test("tags persist and deletion only removes matching institutional assignments", async () => {
  const id = await libraryUpload(null, "etiqueta-" + randomUUID() + ".txt");
  const tag = (
    await call("post", "/library/tags", "A", {
      name: "Interno-" + randomUUID().slice(0, 6),
      color: "#127a82",
    }).expect(201)
  ).body;
  await libraryChange("tag", id, { tags: [tag.id] }).then((r) =>
    assert.equal(r.status, 200),
  );
  await call("delete", "/library/tags/" + tag.id, "B").expect(404);
  assert.deepEqual((await libraryItems()).find((i) => i.id === id).tags, [
    tag.id,
  ]);
  await call("delete", "/library/tags/" + tag.id).expect(200);
  assert.deepEqual((await libraryItems()).find((i) => i.id === id).tags, []);
  const state = (await call("get", "/library").expect(200)).body;
  assert.equal(
    state.quota.used,
    state.items.reduce((s: number, i: any) => s + i.size, 0),
  );
  assert(
    state.activity.some(
      (a: any) => a.action === "library.tag.delete" && a.actor === "owner-A",
    ),
  );
  assert.equal(
    (await call("get", "/library", "B").expect(200)).body.activity.some(
      (a: any) => a.reference === tag.id,
    ),
    false,
  );
});
test("quota includes trash bytes and rejects upload or copy without partial writes", async () => {
  const ids: string[] = [];
  for (let n = 0; n < 50; n++) ids.push(randomUUID());
  await pg.query(
    "INSERT INTO hospital_files(id,empresa_id,name,mime,size_bytes,content,sha256,created_by,deleted_at) SELECT unnest($1::uuid[]),$2,'quota.txt','text/plain',10485760,decode('61','hex'),'test-size','owner-C',now()",
    [ids, C],
  );
  const state = (await call("get", "/library", "C").expect(200)).body;
  assert.equal(state.quota.used, state.quota.limit);
  await call("post", "/library/files", "C", {
    name: "novo.txt",
    mime: "text/plain",
    base64: "YQ==",
  }).expect(409);
  assert.equal((await libraryItems("C")).length, 50);
  // A selected folder-copy must also roll back if there is no space.
  await libraryChange("restore", ids[0], {}, "C").then((r) =>
    assert.equal(r.status, 200),
  );
  await libraryChange("copy", ids[0], { folderId: null }, "C").then((r) =>
    assert.equal(r.status, 409),
  );
  assert.equal((await libraryItems("C")).length, 50);
  await pg.query(
    "DELETE FROM hospital_files WHERE empresa_id=$1 AND id=ANY($2::uuid[])",
    [C, ids],
  );
});

// NV-LAB-REPORTS-20261028
let manualReportId = 0;
const manualParameters = [
  {
    exame: "Exame de teste",
    parametro: "Parâmetro de teste",
    resultado: "100",
    unidade: "unidade de teste",
    referencia: "Referência configurada de teste",
  },
];
async function manualActors() {
  for (const name of ["manual-entry", "manual-technical", "manual-release"])
    await seedProfessional(name);
  await grant("manual-entry", "lab.validate.technical");
  await grant("manual-entry", "lab.validate.release");
  await grant("manual-technical", "lab.validate.technical");
  await grant("manual-technical", "lab.validate.release");
  await grant("manual-release", "lab.validate.release");
}
test("laboratory can open a ready legacy result, preserve its original snapshot and save a tenant-scoped correction", async () => {
  await manualActors();
  manualReportId = (
    await pg.query<any>(
      "INSERT INTO resultados(empresa_id,paciente_id,paciente_nome,data,data_emissao,parametros,tecnico_nome) VALUES($1,$2,'Paciente manual teste','27/10/2026','27/10/2026',$3,'Autor legado de teste') RETURNING id",
      [A, patient, JSON.stringify(manualParameters)],
    )
  ).rows[0].id;
  const original = (
    await call("get", "/lab/reports/" + manualReportId, "manual-entry").expect(
      200,
    )
  ).body;
  assert.equal(original.result.parametros[0].resultado, "100");
  assert.equal(original.history.length, 0);
  assert.equal(original.canEdit, true);
  await call("get", "/lab/reports/" + manualReportId, "B").expect(404);
  await call("get", "/lab/reports/" + manualReportId, "finance").expect(403);
  const reader = (
    await call("get", "/lab/reports/" + manualReportId, "doctor").expect(200)
  ).body;
  assert.equal(reader.canEdit, false);
  const payload = {
    pacienteId: patient,
    data: "28/10/2026",
    parametros: manualParameters.map((p) => ({ ...p, resultado: "95" })),
    tecnicoNome: "Autor forjado",
    previousVersion: 0,
    reason: "Correcção documentada em teste",
    requestId: randomUUID(),
  };
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "finance",
    payload,
  ).expect(403);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "doctor",
    payload,
  ).expect(403);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "B",
    payload,
  ).expect(404);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "manual-entry",
    { ...payload, reason: "" },
  ).expect(400);
  const first = await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "manual-entry",
    payload,
  ).expect(201);
  const repeated = await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "manual-entry",
    payload,
  ).expect(201);
  assert.equal(first.body.version, 1);
  assert.equal(repeated.body.replayed, true);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "manual-entry",
    { ...payload, parametros: manualParameters },
  ).expect(409);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "manual-entry",
    { ...payload, requestId: randomUUID() },
  ).expect(409);
  const detail = (
    await call("get", "/lab/reports/" + manualReportId, "manual-entry").expect(
      200,
    )
  ).body;
  assert.equal(detail.history.length, 2);
  assert.equal(detail.history[1].origin, "legado");
  assert.equal(
    (
      await pg.query<any>(
        "SELECT action FROM nv_audit WHERE empresa_id=$1 AND reference=$2 AND action='lab.report.correct'",
        [A, String(manualReportId)],
      )
    ).rows.length,
    1,
  );
  assert.equal(detail.history[1].data.parametros[0].resultado, "100");
  assert.equal(detail.result.parametros[0].resultado, "95");
  assert.equal(detail.result.tecnicoNome, "manual-entry");
  const pending = (
    await pg.query<any>(
      "SELECT parametros,data_emissao FROM resultados WHERE id=$1",
      [manualReportId],
    )
  ).rows[0];
  assert.equal(pending.parametros[0].resultado, "100");
  assert.equal(pending.data_emissao, "");
  const internalList=(await request(app).get("/api/resultados").set("Authorization","Bearer "+tokens.A).expect(200)).body;
  const current=internalList.find((r:any)=>r.id===manualReportId);
  assert.equal(current.parametros[0].resultado,"95");
  assert.equal(current.reviewState,"rascunho");
  const pdf=await call("post","/result-export/"+manualReportId,"A",{purpose:"internal"}).expect(200);
  assert.equal(pdf.body.trace.provisional,true);
  assert.equal(pdf.body.result.parametros[0].resultado,"95");
  await call("post", "/result-export/" + manualReportId, "A", {}).expect(409);
});
test("corrected results require independent current professional grants and only the released latest version can be exported", async () => {
  const body = {
    phase: "technical",
    version: 1,
    note: "Revisão de teste confirmada",
  };
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/validate",
    "B",
    body,
  ).expect(404);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/validate",
    "manual-entry",
    body,
  ).expect(403);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/validate",
    "manual-release",
    { ...body, phase: "release" },
  ).expect(409);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/validate",
    "manual-technical",
    { ...body, version: 0 },
  ).expect(409);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/validate",
    "manual-technical",
    body,
  ).expect(200);
  const sameReviewer = await call(
    "post",
    "/lab/reports/" + manualReportId + "/validate",
    "manual-technical",
    { ...body, phase: "release" },
  ).expect(403);
  assert(sameReviewer.body.error.includes("revisor técnico"));
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/validate",
    "manual-release",
    { ...body, phase: "release" },
  ).expect(200);
  const verified = (
    await call("post", "/result-export/" + manualReportId, "A", {}).expect(200)
  ).body;
  assert.equal(verified.result.parametros[0].resultado, "95");
  assert.equal(verified.trace.version, 1);
  assert(verified.result.dataEmissao);
  const visible = (
    await request(app)
      .get("/api/resultados")
      .set("Authorization", "Bearer " + tokens.A)
      .expect(200)
  ).body;
  assert(visible.some((r: any) => r.id === manualReportId));
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/validate",
    "manual-release",
    { ...body, phase: "release" },
  ).expect(409);
  const draft = {
    pacienteId: patient,
    data: "28/10/2026",
    parametros: manualParameters.map((p) => ({ ...p, resultado: "96" })),
    previousVersion: 1,
    reason: "Nova correcção de teste",
    requestId: randomUUID(),
  };
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "manual-entry",
    draft,
  ).expect(201);
  await call("post", "/result-export/" + manualReportId, "A", {}).expect(409);
  const versions = (
    await call("get", "/lab/reports/" + manualReportId, "manual-entry").expect(
      200,
    )
  ).body.history;
  assert.equal(versions.length, 3);
  assert.equal(versions[1].data.parametros[0].resultado, "95");
  assert(versions[1].released_at);
  assert.equal(versions[2].data.parametros[0].resultado, "100");
});
test("an explicitly appointed single technician can release a complete manual result with a recorded exception", async () => {
  const draft = await call("post", "/lab/reports", "manual-entry", {
    pacienteId: patient,
    data: "05/11/2026",
    parametros: manualParameters,
    previousVersion: 0,
    requestId: randomUUID(),
  }).expect(201);
  const path = `/lab/reports/${draft.body.id}/validate`;
  const exception = {
    phase: "solo_release",
    version: 1,
    note: "Unidade com um só técnico de serviço, exame não crítico e decisão registada.",
    confirmNonCritical: true,
  };
  await call("post", path, "manual-entry", exception).expect(403);
  await call("post", "/access/grants", "A", {
    actor: "manual-entry",
    permission: "lab.validate.solo",
    reason: "Nomeação de substituto com termo institucional e validação de risco do laboratório.",
    expiresAt: new Date(Date.now() + 95 * 86400000).toISOString(),
  }).expect(400);
  const appointment = await grant("manual-entry", "lab.validate.solo");
  await call("post", path, "manual-entry", { ...exception, confirmNonCritical: false }).expect(400);
  await call("post", path, "manual-entry", { ...exception, note: "Curta" }).expect(400);
  await call("post", path, "manual-entry", exception).expect(200);
  const result = (await call("post", `/result-export/${draft.body.id}`, "A", {}).expect(200)).body;
  assert.notEqual(result.trace.provisional, true);
  const history = (await call("get", `/lab/reports/${draft.body.id}`, "manual-entry").expect(200)).body.history;
  assert.equal(history[0].technical_by, "manual-entry");
  assert.equal(history[0].released_by, "manual-entry");
  const audit = await pg.query<any>(
    "SELECT details FROM nv_audit WHERE empresa_id=$1 AND action='lab.report.validate.solo_release' AND reference=$2",
    [A, String(draft.body.id)],
  );
  assert.equal(audit.rows[0].details.exceptional, true);
  await call("post", `/access/grants/${appointment.id}/revoke`, "A", {
    reason: "Fim da nomeação excepcional de teste",
  }).expect(200);
  const permissions = (await call("get", "/lab/report-capabilities", "manual-entry").expect(200)).body;
  assert.equal(permissions.canSolo, false);
});
test("manual drafts validate identity, dates, incomplete parameters and retries without weakening the sample workflow", async () => {
  const base = {
    pacienteId: patient,
    data: "28/10/2026",
    parametros: manualParameters,
    previousVersion: 0,
    requestId: randomUUID(),
  };
  await call("post", "/lab/reports", "manual-entry", {
    ...base,
    data: "31/02/2026",
  }).expect(400);
  const foreign = (
    await pg.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Paciente empresa B teste') RETURNING id",
      [B],
    )
  ).rows[0].id;
  await call("post", "/lab/reports", "manual-entry", {
    ...base,
    pacienteId: foreign,
  }).expect(404);
  await call(
    "post",
    "/lab/reports/" + manualReportId + "/drafts",
    "manual-entry",
    {
      ...base,
      pacienteId: foreign,
      previousVersion: 2,
      reason: "Tentativa de troca",
    },
  ).expect(409);
  const made = await call("post", "/lab/reports", "manual-entry", base).expect(
    201,
  );
  const duplicate = await call(
    "post",
    "/lab/reports",
    "manual-entry",
    base,
  ).expect(201);
  assert.equal(made.body.id, duplicate.body.id);
  const invalid = {
    ...base,
    requestId: randomUUID(),
    parametros: [
      ...manualParameters,
      {
        exame: "Outro exame",
        parametro: "Por preencher",
        resultado: "",
        unidade: "",
        referencia: "",
      },
    ],
  };
  const pending = await call(
    "post",
    "/lab/reports",
    "manual-entry",
    invalid,
  ).expect(201);
  await call(
    "post",
    "/lab/reports/" + pending.body.id + "/validate",
    "manual-technical",
    { phase: "technical", version: 1, note: "Revisão de teste" },
  ).expect(409);
  const managed = (
    await pg.query<any>(
      "SELECT result_id FROM nv_lab_tests WHERE empresa_id=$1 AND result_id IS NOT NULL LIMIT 1",
      [A],
    )
  ).rows[0].result_id;
  const linked = (
    await call("get", "/lab/reports/" + managed, "manual-entry").expect(200)
  ).body;
  assert(linked.managed.orderId);
  await call("post", "/lab/reports/" + managed + "/drafts", "manual-entry", {
    ...base,
    requestId: randomUUID(),
    reason: "Tentativa fora do circuito",
  }).expect(409);
  await call(
    "post",
    "/lab/reports/" + managed + "/validate",
    "manual-technical",
    { phase: "technical", version: 1, note: "Teste" },
  ).expect(409);
  await assert.rejects(() =>
    pg.query(
      "INSERT INTO nv_lab_report_versions(id,empresa_id,resultado_id,version,data,reason,origin) VALUES($1,$2,$3,77,'{}','Teste','manual')",
      [randomUUID(), B, manualReportId],
    ),
  );
});
test("external requests remain in progress until release and a completed request is corrected through the same report", async () => {
  const sol = randomUUID(),
    foreign = randomUUID();
  await pg.query(
    "INSERT INTO solicitacoes(id,empresa_id,paciente_nome,estado,exames_solicitados) VALUES($1,$2,'Paciente externo teste','pendente','[]')",
    [sol, A],
  );
  await pg.query(
    "INSERT INTO solicitacoes(id,empresa_id,paciente_nome,estado,exames_solicitados) VALUES($1,$2,'Externo empresa B','pendente','[]')",
    [foreign, B],
  );
  const body = {
    solicitacaoId: sol,
    data: "28/10/2026",
    parametros: manualParameters,
    requestId: randomUUID(),
  };
  await call("post", "/lab/reports", "manual-entry", {
    ...body,
    solicitacaoId: foreign,
  }).expect(404);
  const created = await call(
    "post",
    "/lab/reports",
    "manual-entry",
    body,
  ).expect(201);
  const id = created.body.id;
  let state = (
    await pg.query<any>(
      "SELECT estado,resultado_id FROM solicitacoes WHERE id=$1",
      [sol],
    )
  ).rows[0];
  assert.equal(state.estado, "em_processo");
  assert.equal(state.resultado_id, String(id));
  await request(app)
    .get("/api/solicitacoes/" + sol + "/resultado")
    .set("Authorization", "Bearer " + tokens.A)
    .expect(409);
  for (const [actor, phase] of [
    ["manual-technical", "technical"],
    ["manual-release", "release"],
  ])
    await call("post", "/lab/reports/" + id + "/validate", actor, {
      phase,
      version: 1,
      note: "Revisão externa de teste",
    }).expect(200);
  state = (
    await pg.query<any>(
      "SELECT estado,resultado_id FROM solicitacoes WHERE id=$1",
      [sol],
    )
  ).rows[0];
  assert.equal(state.estado, "concluido");
  await call("post", "/lab/reports", "manual-entry", {
    ...body,
    requestId: randomUUID(),
  }).expect(409);
  const edit = {
    solicitacaoId: sol,
    data: "28/10/2026",
    parametros: manualParameters.map((p) => ({ ...p, resultado: "101" })),
    previousVersion: 1,
    reason: "Correcção externa documentada",
    requestId: randomUUID(),
  };
  await call(
    "post",
    "/lab/reports/" + id + "/drafts",
    "manual-entry",
    edit,
  ).expect(201);
  state = (
    await pg.query<any>(
      "SELECT estado,resultado_id FROM solicitacoes WHERE id=$1",
      [sol],
    )
  ).rows[0];
  assert.equal(state.estado, "em_processo");
  assert.equal(state.resultado_id, String(id));
  await request(app)
    .get("/api/solicitacoes/" + sol + "/resultado")
    .set("Authorization", "Bearer " + tokens.A)
    .expect(409);
  await pg.query("UPDATE solicitacoes SET estado='cancelado' WHERE id=$1", [
    sol,
  ]);
  await call("post", "/lab/reports/" + id + "/drafts", "manual-entry", {
    ...edit,
    previousVersion: 2,
    requestId: randomUUID(),
  }).expect(409);
  assert.equal(
    (await pg.query<any>("SELECT estado FROM solicitacoes WHERE id=$1", [sol]))
      .rows[0].estado,
    "cancelado",
  );
});
test("ready-result search and invoice queue are institution-scoped, and exam configuration rejects financial writers", async () => {
  // Imported requests sometimes have the association only in solicitacoes.resultado_id.
  const legacyRequest = randomUUID();
  const legacyResult = (
    await pg.query<any>(
      "INSERT INTO resultados(empresa_id,paciente_nome,data,data_emissao,parametros) VALUES($1,'Externo histórico de teste','27/10/2026','27/10/2026',$2) RETURNING id",
      [A, JSON.stringify(manualParameters)],
    )
  ).rows[0].id;
  await pg.query(
    "INSERT INTO solicitacoes(id,empresa_id,paciente_nome,estado,resultado_id) VALUES($1,$2,'Externo histórico de teste','concluido',$3)",
    [legacyRequest, A, String(legacyResult)],
  );
  await call(
    "post",
    "/lab/reports/" + legacyResult + "/drafts",
    "manual-entry",
    {
      data: "28/10/2026",
      parametros: manualParameters,
      previousVersion: 0,
      reason: "Correcção do arquivo importado",
      requestId: randomUUID(),
    },
  ).expect(201);
  assert.equal(
    (
      await pg.query<any>("SELECT estado FROM solicitacoes WHERE id=$1", [
        legacyRequest,
      ])
    ).rows[0].estado,
    "em_processo",
  );
  const legacyHistory = (
    await call("get", "/lab/reports/" + legacyResult, "manual-entry").expect(
      200,
    )
  ).body.history;
  assert.equal(legacyHistory[0].data.solicitacaoId, legacyRequest);
  assert.equal(legacyHistory[1].data.solicitacaoId, null);
  const other = (
    await pg.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Privado B') RETURNING id",
      [B],
    )
  ).rows[0].id;
  const invoice = (
    await pg.query<any>(
      "INSERT INTO faturas(empresa_id,paciente_id,numero,cliente_nome,data,estado,linhas,cliente_nif,total) VALUES($1,$2,'LAB-FILA','Paciente de teste','28/10/2026','paga',$3,'NIF PRIVADO',1000) RETURNING id",
      [
        A,
        patient,
        JSON.stringify([
          { descricao: "Exame de teste", quantidade: 1, precoUnitario: 1000 },
        ]),
      ],
    )
  ).rows[0].id;
  await pg.query(
    "INSERT INTO faturas(empresa_id,paciente_id,numero,cliente_nome,estado) VALUES($1,$2,'LAB-B-PRIVADO','Privado B','paga')",
    [B, other],
  );
  const queue = (
    await call("get", "/lab/launch-queue", "manual-entry").expect(200)
  ).body;
  assert(queue.some((f: any) => f.id === invoice));
  assert(!queue.some((f: any) => f.numero === "LAB-B-PRIVADO"));
  await pg.query("UPDATE faturas SET resultado_id=$2 WHERE id=$1", [
    invoice,
    manualReportId,
  ]);
  assert.equal(
    (
      await call("get", "/lab/launch-queue", "manual-entry").expect(200)
    ).body.find((f: any) => f.id === invoice).reportId,
    manualReportId,
  );
  await call("post", "/lab/reports", "manual-entry", {
    pacienteId: patient,
    faturaId: invoice,
    data: "28/10/2026",
    parametros: manualParameters,
    requestId: randomUUID(),
  }).expect(409);
  const own = queue.find((f: any) => f.id === invoice);
  assert.equal(own.total, undefined);
  assert.equal(own.clienteNif, undefined);
  assert.equal(own.linhas[0].precoUnitario, undefined);
  await call("get", "/lab/launch-queue", "finance").expect(403);
  const q = (
    await call(
      "get",
      "/lab/reports?q=" + manualReportId,
      "manual-entry",
    ).expect(200)
  ).body;
  assert.equal(q.total, 1);
  assert.equal(q.items[0].result.id, manualReportId);
  assert.equal(
    (await call("get", "/lab/reports?q=" + manualReportId, "B").expect(200))
      .body.total,
    0,
  );
  const body = {
    categoria: "Categoria teste",
    nome: "Configuração de teste",
    parametros: [{ param: "P", unidade: "U", referencia: "R" }],
  };
  await request(app)
    .post("/api/exames-custom")
    .set("Authorization", "Bearer " + tokens.finance)
    .send(body)
    .expect(403);
  const saved = (
    await request(app)
      .post("/api/exames-custom")
      .set("Authorization", "Bearer " + tokens["manual-entry"])
      .send(body)
      .expect(201)
  ).body;
  await request(app)
    .put("/api/exames-custom/" + saved.id)
    .set("Authorization", "Bearer " + tokens.B)
    .send({ ...body, nome: "Outra empresa" })
    .expect(404);
  const template = (
    await request(app)
      .get("/api/exames-custom")
      .set("Authorization", "Bearer " + tokens["manual-entry"])
      .expect(200)
  ).body.find((e: any) => e.id === saved.id);
  assert.equal(template.parametros[0].referencia, "R");
});

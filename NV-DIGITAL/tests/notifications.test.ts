import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createNotifications } from "../artifacts/api-server/src/routes/notifications";
const pg = new PGlite(),
  pool: any = {
    query: (q: string, p?: any[]) => pg.query(q, p),
    connect: async () => ({
      query: (q: string, p?: any[]) => pg.query(q, p),
      release() {},
    }),
  };
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
const users: Record<string, any> = {
  alice: { role: "empresa", empresaId: A, username: "alice", funcao: "admin" },
  tech: { role: "empresa", empresaId: A, username: "tech", funcao: "tecnico" },
  reception: {
    role: "empresa",
    empresaId: A,
    username: "reception",
    funcao: "rececionista",
  },
  finance: {
    role: "empresa",
    empresaId: A,
    username: "finance",
    funcao: "financeiro",
  },
  other: { role: "empresa", empresaId: B, username: "other", funcao: "admin" },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).user = users[String(req.headers["x-test-user"])];
  next();
});
app.use("/notifications", createNotifications(pool));
function as(who: string) {
  return {
    get: () => request(app).get("/notifications").set("x-test-user", who),
    read: (ids: string[]) =>
      request(app)
        .post("/notifications/read")
        .set("x-test-user", who)
        .send({ ids }),
  };
}
let patient: number, result: number, critical: string;
before(async () => {
  await applyMigrations(pg, "migrations", () => {});
  for (const [id, name] of [
    [A, "alice"],
    [B, "other"],
  ])
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$2,'test')",
      [id, name],
    );
  patient = (
    await pg.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Identidade confidencial teste') RETURNING id",
      [A],
    )
  ).rows[0].id;
  result = (
    await pg.query<any>(
      "INSERT INTO resultados(empresa_id,paciente_id,paciente_nome,data_emissao,parametros) VALUES($1,$2,'Identidade confidencial teste','27/10/2026','[{\"resultado\":\"medição confidencial\"}]') RETURNING id",
      [A, patient],
    )
  ).rows[0].id;
  const catalog = randomUUID(),
    order = randomUUID(),
    labTest = randomUUID(),
    container = randomUUID();
  critical = randomUUID();
  await pg.query(
    "INSERT INTO nv_lab_catalog(id,empresa_id,code,version,data,created_by) VALUES($1,$2,'TEST',1,'{}','tech')",
    [catalog, A],
  );
  await pg.query(
    "INSERT INTO nv_lab_orders(id,empresa_id,patient_id,accession,patient_snapshot,request_hash,priority,indication,origin,created_by,request_id) VALUES($1,$2,$3,'TEST-1','{}','hash','urgente','teste','interno','tech',$4)",
    [order, A, patient, randomUUID()],
  );
  await pg.query(
    "INSERT INTO nv_lab_tests(id,empresa_id,order_id,catalog_id,snapshot,result_id) VALUES($1,$2,$3,$4,'{}',$5)",
    [labTest, A, order, catalog, result],
  );
  await pg.query(
    "INSERT INTO nv_lab_containers(id,empresa_id,order_id,sample_id,code,material,container,location) VALUES($1,$2,$3,$4,'S-TEST','teste','teste','lab')",
    [container, A, order, randomUUID()],
  );
  await pg.query(
    "INSERT INTO nv_lab_values(id,empresa_id,test_id,container_id,version,data,entered_by,released_at,critical,request_id) VALUES($1,$2,$3,$4,1,'{}','tech',now(),true,$5)",
    [critical, A, labTest, container, randomUUID()],
  );
  await pg.query(
    "INSERT INTO hospital_pharmacy(id,empresa_id,code,name,lot,expiry,stock,minimum) VALUES($1,$2,'STOCK','Reagente teste','L1',current_date+20,1,3)",
    [randomUUID(), A],
  );
  await pg.query(
    "INSERT INTO hospital_messages(id,empresa_id,sender,sender_name,recipient,body,request_id) VALUES($1,$2,'tech','Técnico','alice','Texto privado',$3)",
    [randomUUID(), A, randomUUID()],
  );
});
after(async () => {
  await pg.close();
});
test("notification feed authenticates, reports released results and excludes clinical contents", async () => {
  await request(app).get("/notifications").expect(401);
  const feed = (await as("alice").get().expect(200)).body;
  assert.ok(
    feed.items.some(
      (x: any) => x.category === "resultados" && x.title === "Resultado pronto",
    ),
  );
  assert.ok(feed.items.some((x: any) => x.category === "criticos"));
  assert.ok(feed.items.some((x: any) => x.category === "stock"));
  assert.ok(feed.items.some((x: any) => x.category === "mensagens"));
  assert.ok(!JSON.stringify(feed).includes("Identidade confidencial"));
  assert.ok(!JSON.stringify(feed).includes("medição confidencial"));
  assert.ok(!JSON.stringify(feed).includes("Texto privado"));
  assert.equal((await as("other").get()).body.items.length, 0);
});
test("read state persists per user, cannot cross tenants and does not acknowledge a critical result", async () => {
  const feed = (await as("alice").get()).body;
  const id = feed.items.find((x: any) => x.category === "criticos").id;
  await as("alice").read([id]).expect(200);
  assert.equal(
    (await as("alice").get()).body.items.find((x: any) => x.id === id).read,
    true,
  );
  assert.equal(
    (await as("tech").get()).body.items.find((x: any) => x.id === id).read,
    false,
  );
  await as("other").read([id]).expect(403);
  const count = await pg.query<any>(
    "SELECT count(*)::int AS n FROM nv_lab_communications WHERE value_id=$1 AND acknowledged",
    [critical],
  );
  assert.equal(count.rows[0].n, 0);
});
test("administrative roles cannot receive critical or financial/stock notifications outside their role", async () => {
  const reception = (await as("reception").get()).body.items;
  assert.ok(reception.some((x: any) => x.category === "resultados"));
  assert.ok(
    !reception.some(
      (x: any) => x.category === "criticos" || x.category === "stock",
    ),
  );
  const finance = (await as("finance").get()).body.items;
  assert.ok(finance.some((x: any) => x.category === "stock"));
  assert.ok(
    !finance.some(
      (x: any) => x.category === "resultados" || x.category === "criticos",
    ),
  );
});
test("new emitted result versions become unread without resurrecting the read state of an older version", async () => {
  const old = (await as("alice").get()).body.items.find(
    (x: any) => x.category === "resultados",
  );
  await as("alice").read([old.id]).expect(200);
  await pg.query(
    'UPDATE resultados SET parametros=\'[{"resultado":"nova medição"}]\' WHERE empresa_id=$1 AND id=$2',
    [A, result],
  );
  const latest = (await as("alice").get()).body.items.find(
    (x: any) => x.category === "resultados",
  );
  assert.notEqual(latest.id, old.id);
  assert.equal(latest.read, false);
});

test("released manual corrections notify as ready, disappear during review and return unread as a new version", async () => {
  const report = (
    await pg.query<any>(
      "INSERT INTO resultados(empresa_id,paciente_id,paciente_nome,data_emissao,parametros) VALUES($1,$2,'Dados privados de teste','','[{\"resultado\":\"segredo de teste\"}]') RETURNING id",
      [A, patient],
    )
  ).rows[0].id;
  const first = randomUUID();
  await pg.query(
    "INSERT INTO nv_lab_report_versions(id,empresa_id,resultado_id,version,data,reason,origin,entered_by,released_by,released_at) VALUES($1,$2,$3,1,'{}','teste','manual','tech','validator',now())",
    [first, A, report],
  );
  await pg.query(
    "UPDATE resultados SET data_emissao='28/10/2026' WHERE id=$1",
    [report],
  );
  const before = (await as("alice").get().expect(200)).body.items.find(
    (n: any) => n.id.startsWith("result:" + report + ":"),
  );
  assert.equal(before.title, "Resultado pronto");
  assert(before.id.includes(first));
  assert(!JSON.stringify(before).includes("segredo de teste"));
  await as("alice").read([before.id]).expect(200);
  assert.equal(
    (await as("alice").get().expect(200)).body.items.find(
      (n: any) => n.id === before.id,
    ).read,
    true,
  );
  const second = randomUUID();
  await pg.query(
    "INSERT INTO nv_lab_report_versions(id,empresa_id,resultado_id,version,data,reason,origin,entered_by) VALUES($1,$2,$3,2,'{}','correcção','manual','tech')",
    [second, A, report],
  );
  await pg.query("UPDATE resultados SET data_emissao='' WHERE id=$1", [report]);
  assert.equal(
    (await as("alice").get().expect(200)).body.items.some((n: any) =>
      n.id.startsWith("result:" + report + ":"),
    ),
    false,
  );
  await pg.query(
    "UPDATE nv_lab_report_versions SET released_at=now(),released_by='validator' WHERE id=$1",
    [second],
  );
  await pg.query(
    "UPDATE resultados SET data_emissao='28/10/2026',parametros='[{\"resultado\":\"nova versão privada\"}]' WHERE id=$1",
    [report],
  );
  const after = (await as("alice").get().expect(200)).body.items.find(
    (n: any) => n.id.startsWith("result:" + report + ":"),
  );
  assert.equal(after.title, "Resultado pronto");
  assert.notEqual(after.id, before.id);
  assert.equal(after.read, false);
  assert.equal(
    (await as("other").get().expect(200)).body.items.some(
      (n: any) => n.id === after.id,
    ),
    false,
  );
});

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createLabWorkflow } from "../artifacts/api-server/src/routes/lab-workflow";
import { generatePDFHTML } from "../artifacts/lab-results/src/utils/pdfGenerator";
import { labelWindow } from "../artifacts/lab-results/src/pages/laboratorio/operacional/Impressao";

const db = new PGlite();
const a = randomUUID(),
  b = randomUUID();
const catalogue = new Map<string, string>();
const migration = "20261103_lab_referencias_institucionais.sql";
let queue = Promise.resolve();
const adapter: any = {
  query: (s: string, params?: any[]) => db.query(s, params),
  connect: async () => {
    const old = queue;
    let release!: () => void;
    queue = new Promise((r) => {
      release = r;
    });
    await old;
    return { query: adapter.query, release };
  },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const company = req.get("x-company") === "B" ? b : a;
  (req as any).user = {
    role: "empresa",
    empresaId: company,
    username: "tester",
    funcao: req.get("x-role") || "admin",
  };
  next();
});
app.use("/lab", createLabWorkflow(adapter));
const api = (
  method: "get" | "post" | "put",
  path: string,
  company = "A",
  role = "admin",
) =>
  request(app)
    [method]("/lab" + path)
    .set("x-company", company)
    .set("x-role", role);
async function newPatient(org: string, name: string) {
  return (
    await db.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,$2) RETURNING id,processo",
      [org, name],
    )
  ).rows[0];
}
let legacy: number, historicalId: string;
before(async () => {
  const directory = mkdtempSync(join(tmpdir(), "nv-lab-before-"));
  try {
    cpSync("migrations", directory, {
      recursive: true,
      filter: (p) => basename(p) !== migration,
    });
    await applyMigrations(db, directory, () => {});
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  for (const org of [a, b]) {
    await db.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,'Últra Diagnóstico',$2,'fixture')",
      [org, org],
    );
    const cat = randomUUID();
    catalogue.set(org, cat);
    await db.query(
      "INSERT INTO nv_lab_catalog(id,empresa_id,code,version,data,created_by,approved_by,approved_at) VALUES($1,$2,'GLU',1,$3,'fixture','fixture',now())",
      [
        cat,
        org,
        JSON.stringify({
          name: "Glicemia de ensaio",
          material: "Soro",
          container: "Tubo",
        }),
      ],
    );
  }
  legacy = (
    await db.query<any>(
      "INSERT INTO pacientes(empresa_id,nome,processo,n_amostra) VALUES($1,'Histórico','ULTRA/1','NV-HISTORICO-CODIGO-LONGO') RETURNING id",
      [a],
    )
  ).rows[0].id;
  historicalId = randomUUID();
  await db.query(
    "INSERT INTO nv_lab_orders(id,empresa_id,patient_id,accession,patient_snapshot,request_hash,priority,indication,origin,created_by,request_id) VALUES($1,$2,$3,'REQ-CODIGO-ANTIGO-COMPLETO',$4,'historico','rotina','Ensaio','Arquivo','fixture',$5)",
    [
      historicalId,
      a,
      legacy,
      JSON.stringify({ nome: "Histórico", processo: "ULTRA/1" }),
      randomUUID(),
    ],
  );
  await db.query(
    "INSERT INTO nv_lab_containers(id,empresa_id,order_id,sample_id,code,material,container,location) VALUES($1,$2,$3,$4,'NV-HISTORICO-CODIGO-LONGO','Soro','Tubo','Arquivo')",
    [randomUUID(), a, historicalId, randomUUID()],
  );
  await applyMigrations(db, "migrations", () => {});
});
after(async () => db.close());

function order(org: string, patientId: number, requestId = randomUUID()) {
  return {
    requestId,
    patientId,
    tests: [catalogue.get(org)],
    priority: "rotina",
    origin: "Laboratório",
    indication: "Apenas ensaio",
  };
}

test("patient process, order and physical specimen share distinct references per company and preserve the archive", async () => {
  const p = await newPatient(a, "Paciente A");
  assert.equal(p.processo, "ULTRA/002"); // The old ULTRA/1 remains reserved.
  const q = await newPatient(b, "Paciente B");
  assert.equal(q.processo, "ULTRA/001");
  // Make the sequences align so even identical order and sample codes remain institution scoped.
  assert.equal((await newPatient(b, "Outro B")).processo, "ULTRA/002");
  const body = order(a, p.id);
  const first = await api("post", "/orders").send(body).expect(201);
  assert.equal(first.body.accession, "ULTRA/003");
  const second = await api("post", "/orders", "B")
    .send(order(b, q.id))
    .expect(201);
  assert.equal(second.body.accession, "ULTRA/003");
  const repeated = await api("post", "/orders").send(body).expect(201);
  assert.equal(repeated.body.id, first.body.id);
  const detail = await api("get", "/orders/" + first.body.id).expect(200);
  const sample = detail.body.containers[0];
  assert.equal(sample.code, "ULTRA/004");
  const aScan = await api("get", "/scan")
    .query({ code: sample.code })
    .expect(200);
  const bScan = await api("get", "/scan", "B")
    .query({ code: sample.code })
    .expect(200);
  assert.equal(aScan.body.order_id, first.body.id);
  assert.equal(bScan.body.order_id, second.body.id);
  const rawScan = await api("get", "/scan/" + sample.code).expect(200);
  assert.equal(rawScan.body.order_id, first.body.id);
  await api("get", "/orders/" + first.body.id, "B").expect(404);
  for (const reference of ["ULTRA/002", "ultra/003", "ULTRA/004"]) {
    const matches = await api("get", "/orders")
      .query({ q: reference })
      .expect(200);
    assert.deepEqual(
      matches.body.map((x: any) => x.id),
      [first.body.id],
    );
  }
  const previous = await api("get", "/orders")
    .query({ q: "REQ-CODIGO-ANTIGO-COMPLETO" })
    .expect(200);
  assert.equal(previous.body[0].processo, "ULTRA/1");
  const oldScan = await api("get", "/scan/NV-HISTORICO-CODIGO-LONGO").expect(
    200,
  );
  assert.equal(oldScan.body.order_id, historicalId);
  await api("get", "/scan/NV-HISTORICO-CODIGO-LONGO", "B").expect(404);
});

test("only management changes the institutional prefix; numbering continues and a rollback does not consume a reference", async () => {
  await api("put", "/numbering", "A", "tecnico")
    .send({ prefix: "LAB" })
    .expect(403);
  await api("put", "/numbering").send({ prefix: "A/B" }).expect(400);
  const changed = await api("put", "/numbering")
    .send({ prefix: "lab", empresaId: b })
    .expect(200);
  assert.equal(changed.body.prefix, "LAB");
  assert.equal(
    (await api("get", "/numbering", "B").expect(200)).body.prefix,
    "ULTRA",
  );
  assert.equal(
    (await api("get", "/numbering", "A", "tecnico").expect(200)).body.canEdit,
    false,
  );
  await db.query("BEGIN");
  assert.equal((await newPatient(a, "Anulado")).processo, "LAB/005");
  await db.query("ROLLBACK");
  const p = await newPatient(a, "Paciente A seguinte");
  assert.equal(p.processo, "LAB/005");
  assert.equal(
    (
      await db.query<any>("SELECT processo FROM pacientes WHERE id=$1", [
        legacy,
      ])
    ).rows[0].processo,
    "ULTRA/1",
  );
  await db.query(
    "UPDATE nv_lab_numbering SET last_number=999 WHERE empresa_id=$1",
    [a],
  );
  assert.equal((await newPatient(a, "Milésimo")).processo, "LAB/1000");
});

test("the report uses the verified sample and request instead of a historical patient label", () => {
  const html = generatePDFHTML(
    {
      id: 1,
      pacienteNome: "Paciente fictício",
      data: "03/11/2026",
      dataEmissao: "03/11/2026",
      parametros: [],
    } as any,
    {
      nome: "Paciente fictício",
      processo: "ULTRA/002",
      nAmostra: "AMOSTRA-ANTIGA",
    } as any,
    { nomeClinica: "Clínica de ensaio" } as any,
    { processo: "ULTRA/002", accession: "ULTRA/003", sampleCode: "ULTRA/004" },
  );
  for (const code of ["ULTRA/002", "ULTRA/003", "ULTRA/004"])
    assert.ok(html.includes(code));
  assert.ok(!html.includes("AMOSTRA-ANTIGA"));
});

test("printed specimen labels retain the whole reference and their QR decodes to exactly that reference", async () => {
  const requireWeb = createRequire(
    resolve("artifacts/lab-results/package.json"),
  );
  const { PNG } = createRequire(requireWeb.resolve("qrcode"))("pngjs");
  const decode = requireWeb("jsqr");
  for (const code of ["ULTRA/004", "NV-HISTORICO-CODIGO-LONGO"]) {
    let html = "";
    const win = {
      document: {
        write: (value: string) => {
          html = value;
        },
        close() {},
      },
    } as unknown as Window;
    await labelWindow(
      win,
      {
        code,
        material: "Soro",
        container: "Tubo",
        collected_at: "2026-11-03T08:00:00Z",
      },
      {
        patient_id: 1,
        patient_name: "Paciente <fictício>",
        processo: "ULTRA/002",
        nasc: "2000-01-01",
      },
      "Instituição de ensaio",
      "60x40",
    );
    assert.ok(html.includes(`>${code}</p>`));
    assert.ok(html.includes("Paciente &lt;fictício&gt;"));
    const src = html.match(/src="data:image\/png;base64,([^"]+)"/);
    assert.ok(src);
    const png = PNG.sync.read(Buffer.from(src[1], "base64"));
    assert.equal(
      decode(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
      code,
    );
  }
});

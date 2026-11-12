import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createHospitalRouter } from "../artifacts/api-server/src/routes/hospital";
import type { ClinicalOverview } from "../lib/api-zod/src/clinical-overview";
import {
  mapServiceRequest,
  sortServiceRequestsByPriority,
} from "../artifacts/lab-results/src/modules/bahmni-clinical/request-utils";
import {
  dateGroupKey,
  getFormattedAge,
  parseClinicalDate,
} from "../artifacts/lab-results/src/modules/bahmni-clinical/patient-adapter";
import {
  matchesOverview,
  overviewKey,
} from "../artifacts/lab-results/src/modules/bahmni-clinical/scope";
import PatientDetails from "../artifacts/lab-results/src/modules/bahmni-clinical/PatientDetails";
import GenericServiceRequestTable from "../artifacts/lab-results/src/modules/bahmni-clinical/GenericServiceRequestTable";
const frontendRequire = createRequire(
  new URL("../artifacts/lab-results/package.json", import.meta.url),
);
const React = frontendRequire("react");
const { renderToStaticMarkup } = frontendRequire("react-dom/server");

const db = new PGlite();
const a = randomUUID(),
  b = randomUUID(),
  first = randomUUID(),
  second = randomUUID(),
  otherVisit = randomUUID();
const triage = randomUUID(),
  rx = randomUUID(),
  drug = randomUUID();
let patientId = 0,
  homonym = 0,
  foreignPatient = 0,
  firstTest = "",
  managedReport = 0;
let pending = Promise.resolve();
const pool: any = {
  query: (sql: string, args?: unknown[]) => db.query(sql, args),
  connect: async () => {
    const previous = pending;
    let release!: () => void;
    pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return { query: pool.query, release };
  },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const role = req.get("x-test-role");
  if (role)
    (req as any).user = {
      role: "empresa",
      empresaId: req.get("x-test-company") === "B" ? b : a,
      username: "test-clinician",
      funcao: role,
    };
  next();
});
app.use("/hospital", createHospitalRouter(pool));
const read = (path: string, role = "medico", company = "A") =>
  request(app)
    .get("/hospital/clinical-overview/" + path)
    .set("x-test-role", role)
    .set("x-test-company", company);

before(async () => {
  await applyMigrations(db, "migrations", () => {});
  for (const org of [a, b])
    await db.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$3,'test-fixture')",
      [org, org === a ? "Instituição A" : "Instituição B", "owner-" + org],
    );
  for (const [org, kind] of [
    [a, "target"],
    [a, "homonym"],
    [b, "foreign"],
  ] as const) {
    const p = (
      await db.query<any>(
        "INSERT INTO pacientes(empresa_id,nome,nasc,sexo,alergias) VALUES($1,'Ana de Teste','2020-01-02','F',$2) RETURNING id",
        [
          org,
          kind === "target"
            ? "Alergia de ensaio"
            : "informação de outro paciente",
        ],
      )
    ).rows[0].id;
    if (kind === "target") patientId = p;
    else if (kind === "homonym") homonym = p;
    else foreignPatient = p;
  }
  const visit = (id: string, pid: number, diagnosis: string) => ({
    id,
    patient: { id: pid, nome: "Ana de Teste" },
    doctor: "Médico de ensaio",
    owner: "test-clinician",
    started: "2026-11-12T08:00:00Z",
    diagnosis,
    triageId: id === first ? triage : undefined,
    subjective: "Queixa de ensaio",
    plan: "Plano de ensaio",
  });
  const clinical = {
    visits: [
      visit(first, patientId, "Diagnóstico do atendimento"),
      visit(second, patientId, "Diagnóstico anterior"),
      visit(otherVisit, homonym, "NÃO MOSTRAR HOMÓNIMO"),
    ],
    prescriptions: [
      {
        id: rx,
        visitId: first,
        patient: { id: patientId },
        doctor: "Médico de ensaio",
        created: "2026-11-12T09:00:00Z",
        items: [
          {
            id: drug,
            name: "Medicamento de ensaio",
            quantity: 5,
            unit: "unidades",
          },
        ],
      },
      {
        id: randomUUID(),
        visitId: otherVisit,
        patient: { id: patientId },
        items: [],
        notes: "NÃO MOSTRAR RECEITA INCONSISTENTE",
      },
    ],
    deliveries: [{ prescriptionId: rx, itemId: drug, quantity: 2 }],
    documents: [
      {
        id: randomUUID(),
        visitId: first,
        patient: { id: patientId },
        title: "Documento do atendimento",
        created: "2026-11-12T10:00:00Z",
        finalized: "2026-11-12T10:00:00Z",
      },
      {
        id: randomUUID(),
        visitId: otherVisit,
        patient: { id: homonym },
        title: "NÃO MOSTRAR DOCUMENTO",
      },
    ],
    audit: [{ action: "NÃO MOSTRAR AUDITORIA COMPLETA" }],
  };
  await db.query(
    "INSERT INTO hospital_state(empresa_id,namespace,data) VALUES($1,'clinical',$2)",
    [a, JSON.stringify(clinical)],
  );
  await db.query(
    "INSERT INTO hospital_state(empresa_id,namespace,data) VALUES($1,'clinical',$2)",
    [
      b,
      JSON.stringify({
        visits: [
          visit(randomUUID(), foreignPatient, "NÃO MOSTRAR OUTRA EMPRESA"),
        ],
        prescriptions: [],
        documents: [],
      }),
    ],
  );
  await db.query(
    "INSERT INTO nursing_integrated_state(empresa_id,body) VALUES($1,$2)",
    [
      a,
      JSON.stringify({
        observations: [
          {
            id: triage,
            patientId: String(patientId),
            kind: "triagem",
            at: "2026-11-12T07:00:00Z",
            author: "Enfermeiro de ensaio",
            values: { priority: "Verde" },
          },
          {
            id: randomUUID(),
            patientId: String(patientId),
            kind: "evolucao",
            at: "2026-11-11T07:00:00Z",
            author: "Enfermeiro de ensaio",
            values: { note: "Observação anterior" },
          },
          {
            id: randomUUID(),
            patientId: String(homonym),
            kind: "evolucao",
            values: { note: "NÃO MOSTRAR ENFERMAGEM" },
          },
        ],
      }),
    ],
  );
  const catalog = randomUUID();
  await db.query(
    "INSERT INTO nv_lab_catalog(id,empresa_id,code,version,data,created_by) VALUES($1,$2,'OVERVIEW',1,'{}','fixture')",
    [catalog, a],
  );
  for (const [ep, pid, title] of [
    [first, patientId, "Análise actual"],
    [second, patientId, "Análise anterior"],
    [null, patientId, "Análise sem atendimento"],
    [otherVisit, homonym, "NÃO MOSTRAR ANÁLISE"],
  ] as const) {
    const order = randomUUID(),
      testId = randomUUID();
    await db.query(
      "INSERT INTO nv_lab_orders(id,empresa_id,patient_id,episode_id,accession,patient_snapshot,request_hash,priority,indication,origin,created_by,request_id) VALUES($1,$2,$3,$4,$6,'{}','test-fixture','urgente','Ensaio','Consulta','test-clinician',$5)",
      [order, a, pid, ep, randomUUID(), order],
    );
    await db.query(
      "INSERT INTO nv_lab_tests(id,empresa_id,order_id,catalog_id,snapshot) VALUES($1,$2,$3,$4,$5)",
      [
        testId,
        a,
        order,
        catalog,
        JSON.stringify({
          name: title,
          unit: "unidade de ensaio",
          reference: "Referência de ensaio",
        }),
      ],
    );
    if (ep === first) {
      firstTest = testId;
      const container = randomUUID();
      await db.query(
        "INSERT INTO nv_lab_containers(id,empresa_id,order_id,sample_id,code,material,container,location) VALUES($1,$2,$3,$1,$4,'Material de ensaio','Recipiente de ensaio','Laboratório')",
        [container, a, order, container],
      );
      managedReport = (
        await db.query<any>(
          "INSERT INTO resultados(empresa_id,paciente_id,paciente_nome,parametros) VALUES($1,$2,'Ana de Teste',$3) RETURNING id",
          [
            a,
            patientId,
            JSON.stringify([
              {
                parametro: "NÃO DUPLICAR RESULTADO GESTIONADO",
                resultado: "1",
              },
            ]),
          ],
        )
      ).rows[0].id;
      await db.query(
        "UPDATE nv_lab_tests SET result_id=$3 WHERE empresa_id=$1 AND id=$2",
        [a, testId, managedReport],
      );
      for (const version of [1, 2])
        await db.query(
          "INSERT INTO nv_lab_values(id,empresa_id,test_id,container_id,version,data,entered_by,released_at,request_id) VALUES($1,$2,$3,$4,$5,$6,'fixture',$7,$1)",
          [
            randomUUID(),
            a,
            testId,
            container,
            version,
            JSON.stringify({
              measured: version === 1 ? "valor anterior" : "0",
              unit: "unidade de ensaio",
              reference: "Referência de ensaio",
            }),
            version === 1 ? new Date() : null,
          ],
        );
    }
  }
  await db.query(
    "INSERT INTO resultados(empresa_id,paciente_id,paciente_nome,data,parametros) VALUES($1,$2,'Ana de Teste','02/01/2025',$3)",
    [
      a,
      patientId,
      JSON.stringify([
        { parametro: "Resultado legado", resultado: 0, unidade: "u" },
      ]),
    ],
  );
});
after(async () => db.close());

test("overview keeps homonyms and unrelated episodes separate and reads only the latest test version", async () => {
  const response = await read(patientId + "?episodeId=" + first).expect(200);
  const data = response.body as ClinicalOverview;
  assert.equal(data.empresaId, a);
  assert.equal(data.patient.id, String(patientId));
  assert.equal(data.episodeId, first);
  assert.deepEqual(
    data.visits.map((v) => v.id),
    [first],
  );
  assert.equal(data.prescriptions.length, 1);
  assert.equal(data.prescriptions[0].items[0].dispensed, 2);
  assert.equal(data.documents.length, 1);
  assert.equal(data.nursing.length, 1);
  assert.equal(data.nursing[0].id, triage);
  assert.equal(data.laboratory.length, 1);
  assert.equal(data.laboratory[0].id, firstTest);
  assert.equal(data.laboratory[0].value, "0");
  assert.equal(data.laboratory[0].version, 2);
  assert.equal(data.laboratory[0].released, false);
  assert.ok(!JSON.stringify(data).includes("NÃO MOSTRAR"));
  assert.ok(!JSON.stringify(data).includes("valor anterior"));
  assert.match(response.headers["cache-control"], /no-store/);
});

test("patient history includes prior episodes and unlinked legacy reports without duplicating managed results", async () => {
  const data = (await read(String(patientId), "enfermeiro").expect(200))
    .body as ClinicalOverview;
  assert.equal(data.episodeId, null);
  assert.equal(data.visits.length, 2);
  assert.equal(data.nursing.length, 2);
  assert.equal(data.laboratory.length, 4);
  assert.equal(data.laboratory.filter((r) => r.legacy).length, 1);
  assert.equal(data.laboratory.find((r) => r.legacy)?.value, "0");
  assert.ok(!JSON.stringify(data).includes("NÃO MOSTRAR"));
  assert.ok(!JSON.stringify(data).includes("NÃO DUPLICAR"));
});

test("the endpoint rejects foreign patients, mismatched episodes, unsupported roles and malformed identifiers", async () => {
  await read(String(patientId), "medico", "B").expect(404);
  await read(patientId + "?episodeId=" + otherVisit).expect(409);
  await read(String(patientId), "financeiro").expect(403);
  await read(String(patientId), "rececionista").expect(403);
  await read(String(patientId), "farmaceutico").expect(403);
  await read("0").expect(400);
  await read("2147483648").expect(400);
  await read("not-an-id").expect(400);
  await read(patientId + "?episodeId=invalid").expect(400);
  await read(patientId + "?episodeId=" + first + "&episodeId=" + second).expect(
    400,
  );
  await request(app)
    .get("/hospital/clinical-overview/" + patientId)
    .expect(401);
});

test("overview reads preserve clinical and nursing state and record a minimal access audit", async () => {
  const before = await db.query(
    "SELECT data,revision FROM hospital_state WHERE empresa_id=$1 AND namespace='clinical'",
    [a],
  );
  const nursing = await db.query(
    "SELECT body FROM nursing_integrated_state WHERE empresa_id=$1",
    [a],
  );
  await read(patientId + "?episodeId=" + first, "admin").expect(200);
  assert.deepEqual(
    (
      await db.query(
        "SELECT data,revision FROM hospital_state WHERE empresa_id=$1 AND namespace='clinical'",
        [a],
      )
    ).rows,
    before.rows,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT body FROM nursing_integrated_state WHERE empresa_id=$1",
        [a],
      )
    ).rows,
    nursing.rows,
  );
  const audit = (
    await db.query<any>(
      "SELECT reference FROM hospital_audit WHERE empresa_id=$1 AND action='clinical.overview.read' ORDER BY created_at DESC LIMIT 1",
      [a],
    )
  ).rows[0];
  assert.deepEqual(JSON.parse(audit.reference), {
    patientId,
    episodeId: first,
  });
});

test("Bahmni request adapter preserves zero values and stable priority ordering without changing the source rows", () => {
  const base = {
    id: "x",
    orderId: "o",
    episodeId: first,
    accession: "REQ",
    name: "Teste",
    requestedAt: "2026-11-12T10:00:00Z",
    requestedBy: "Médico",
    priority: "rotina",
    cancelled: false,
    value: "0",
    unit: "u",
    reference: "ref",
    version: 2,
    released: false,
    reportId: managedReport,
    legacy: false,
  };
  const rows = mapServiceRequest([
    base,
    { ...base, id: "urgent", priority: "urgente" },
    { ...base, id: "stat", priority: "emergente" },
    { ...base, id: "same", priority: "urgente" },
  ]);
  assert.equal(rows[0].measured, "0");
  assert.equal(rows[0].status, "active");
  assert.deepEqual(
    sortServiceRequestsByPriority(rows).map((r) => r.id),
    ["stat", "urgent", "same", "x"],
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    ["x", "urgent", "stat", "same"],
  );
});

test("clinical dates group by the Luanda day and do not reinterpret Portuguese historical dates", () => {
  assert.equal(dateGroupKey("2026-11-11T23:30:00Z"), "2026-11-12");
  assert.equal(dateGroupKey("02/01/2025"), "2025-01-02");
  assert.equal(parseClinicalDate("31/02/2025"), null);
  assert.equal(parseClinicalDate("2025-02-30"), null);
  assert.equal(
    getFormattedAge("2020-11-13", undefined, new Date("2026-11-12T12:00:00Z")),
    "5 anos",
  );
  assert.equal(
    getFormattedAge("2099-01-01", undefined, new Date("2026-11-12T12:00:00Z")),
    "",
  );
});

test("client identity checks reject responses from another company, patient or episode", () => {
  const data = {
    empresaId: a,
    patient: { id: String(patientId) },
    episodeId: first,
  } as ClinicalOverview;
  assert.ok(matchesOverview(data, a, String(patientId), first));
  assert.ok(!matchesOverview(data, b, String(patientId), first));
  assert.ok(!matchesOverview(data, a, String(homonym), first));
  assert.ok(!matchesOverview(data, a, String(patientId), second));
  assert.ok(!matchesOverview(data, a, String(patientId)));
  assert.notEqual(
    overviewKey(a, String(patientId), first),
    overviewKey(b, String(patientId), first),
  );
});

test("adapted Bahmni patient header renders the current identity and escapes clinical text", () => {
  const html = renderToStaticMarkup(
    React.createElement(PatientDetails, {
      patient: {
        id: "1",
        name: "<script>ensaio</script>",
        birthDate: "2020-01-02",
        sex: "F",
        processNumber: "ENSAIO/1",
        document: "BI-ENSAIO",
        allergies: "",
        conditions: "",
      },
    }),
  );
  assert.ok(html.includes('data-testid="patient-name"'));
  assert.ok(html.includes("&lt;script&gt;ensaio&lt;/script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("Processo ENSAIO/1"));
  assert.ok(html.includes("BI BI-ENSAIO"));
  assert.ok(html.includes("Feminino"));
});

test("adapted Bahmni laboratory widget renders zero, pending states and Portuguese dates", () => {
  const base: ClinicalOverview["laboratory"][number] = {
    id: "one",
    orderId: "order",
    episodeId: first,
    accession: "REQ",
    name: "Análise de ensaio",
    requestedAt: "02/01/2025",
    requestedBy: "Médico de ensaio",
    priority: "urgente",
    cancelled: false,
    value: "0",
    unit: "u",
    reference: "Referência",
    version: 2,
    released: true,
    reportId: null,
    legacy: false,
  };
  const html = renderToStaticMarkup(
    React.createElement(GenericServiceRequestTable, {
      requests: [
        base,
        {
          ...base,
          id: "pending",
          name: "Análise pendente",
          value: null,
          released: false,
        },
      ],
    }),
  );
  assert.ok(html.includes("Pedidos e resultados laboratoriais"));
  assert.ok(html.includes("02/01/2025"));
  assert.ok(html.includes("0 u"));
  assert.ok(html.includes("Por lançar"));
  assert.ok(html.includes("Disponível"));
  assert.ok(html.includes("Em curso"));
});

test("the imported Bahmni sources remain byte-for-byte identifiable and retain their licence notices", async () => {
  const manifest = JSON.parse(
    await readFile("docs/third-party/bahmni/origins.json", "utf8"),
  );
  assert.equal(manifest.revision, "12a0173eecacf49acb95c29cccf3388a98d074e9");
  for (const file of manifest.files) {
    const data = await readFile(file.original);
    const sha = createHash("sha1")
      .update(Buffer.concat([Buffer.from(`blob ${data.length}\0`), data]))
      .digest("hex");
    assert.equal(sha, file.sha, file.original);
    const adapted = await readFile(file.adapted, "utf8");
    assert.ok(adapted.includes("Mozilla Public License"));
    assert.ok(adapted.includes("Copyright 2025"));
  }
  const license = await readFile(
    "artifacts/lab-results/src/modules/bahmni-clinical/LICENSE.txt",
    "utf8",
  );
  assert.ok(license.includes("Mozilla Public License"));
  assert.ok(license.includes("health care provider"));
});

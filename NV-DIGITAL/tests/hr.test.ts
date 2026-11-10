import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createHR } from "../artifacts/api-server/src/routes/hr";
import {
  GLOBAL_DEFAULT_ROSTER_RULES,
  calculatePayroll,
  evaluateNurseCompliance,
  payrollProfileForMonth,
} from "../lib/api-zod/src/hr-domain";
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
const A = "30000000-0000-4000-8000-000000000001",
  B = "30000000-0000-4000-8000-000000000002";
let w: string, foreign: string;
const actors: any = {
  admin: { role: "empresa", empresaId: A, username: "admin", funcao: "admin" },
  manager: {
    role: "empresa",
    empresaId: A,
    username: "manager",
    funcao: "gestor",
  },
  finance: {
    role: "empresa",
    empresaId: A,
    username: "finance",
    funcao: "financeiro",
  },
  tech: { role: "empresa", empresaId: A, username: "tech", funcao: "tecnico" },
  other: { role: "empresa", empresaId: B, username: "other", funcao: "admin" },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).user = actors[String(req.headers["x-actor"])];
  next();
});
app.use(createHR(pool));
const get = (p: string, actor = "admin") =>
  request(app).get(p).set("x-actor", actor);
const post = (p: string, b: any, actor = "admin") =>
  request(app)
    .post(p)
    .set("x-actor", actor)
    .send({ requestId: randomUUID(), ...b });
const profile = {
  department: "Enfermagem",
  nif: "5001234567",
  inssNumber: "123456789",
  basic: 300000,
  allowances: [],
  deductions: 0,
  regime: "geral",
  confirmed: true,
  incidenceBasis: "Contrato e incidências revistos para mês normal.",
};
before(async () => {
  await applyMigrations(pg, "migrations", () => {});
  for (const [id, name] of [
    [A, "Empresa A"],
    [B, "Empresa B"],
  ])
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$2,'secret-test')",
      [id, name],
    );
  await pg.query(
    "INSERT INTO nv_settings(empresa_id,data,revision,updated_by) VALUES($1,$2,1,'admin'),($3,$2,1,'other')",
    [A, JSON.stringify({ services: ["escalas"] }), B],
  );
  w = (
    await pg.query<any>(
      "INSERT INTO funcionarios(empresa_id,nome,username,password) VALUES($1,'Pessoa A','worker-a','password-confidential') RETURNING id",
      [A],
    )
  ).rows[0].id;
  foreign = (
    await pg.query<any>(
      "INSERT INTO funcionarios(empresa_id,nome,username,password) VALUES($1,'Pessoa B','worker-b','password-confidential') RETURNING id",
      [B],
    )
  ).rows[0].id;
});
after(async () => pg.close());
let roster: any, payroll: any;
test("HR authenticates, filters company, denies clinical roles and never returns passwords", async () => {
  assert.equal((await get("/workers", "none")).status, 401);
  assert.equal((await get("/workers", "tech")).status, 403);
  const r = await get("/workers");
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].id, w);
  assert.ok(!r.text.includes("password"));
  assert.equal(
    (await get("/roster?month=2026-10&department=Enfermagem", "finance"))
      .status,
    403,
  );
});
test("roster validates active company workers and rejects invalid dates/codes and duplicates", async () => {
  const body = {
    month: "2026-10",
    department: "Enfermagem",
    revision: 0,
    data: {
      rows: [{ id: foreign, days: { 1: "M" } }],
      rules: GLOBAL_DEFAULT_ROSTER_RULES,
    },
  };
  assert.equal((await post("/roster", body)).status, 403);
  body.data.rows = [{ id: w, days: { 32: "M" } } as any];
  assert.equal((await post("/roster", body)).status, 400);
  body.data.rows = [{ id: w, days: { 1: "M" } }];
  const r = await post("/roster", body);
  assert.equal(r.status, 200, r.text);
  roster = r.body;
  assert.equal(roster.data.rows[0].name, "Pessoa A");
  assert.equal((await post("/roster", body)).status, 409);
  assert.equal(
    (await get("/roster?month=2026-10&department=Enfermagem", "other")).body
      .revision,
    0,
  );
});
test("save retries are idempotent and publication requires complete days and confirmed rules", async () => {
  const body = {
    requestId: randomUUID(),
    month: "2026-10",
    department: "Enfermagem",
    revision: roster.revision,
    data: roster.data,
  };
  const a = await post("/roster", body),
    b = await post("/roster", body);
  assert.equal(a.body.revision, b.body.revision);
  roster = a.body;
  assert.equal(
    (
      await post("/roster", {
        ...body,
        requestId: randomUUID(),
        revision: roster.revision,
        publish: true,
      })
    ).status,
    400,
  );
  const days = Object.fromEntries(
    Array.from({ length: 31 }, (_, i) => [i + 1, "F"]),
  );
  const data = {
    rows: [{ id: w, days }],
    rules: { ...GLOBAL_DEFAULT_ROSTER_RULES, confirmed: true },
  };
  const r = await post("/roster", {
    month: "2026-10",
    department: "Enfermagem",
    revision: roster.revision,
    data,
    publish: true,
  });
  assert.equal(r.status, 200, r.text);
  roster = r.body;
  assert.equal(
    (
      await post("/roster", {
        month: "2026-10",
        department: "Enfermagem",
        revision: roster.revision,
        data,
      })
    ).status,
    409,
  );
});
test("reopening preserves history and 24h pattern is blocked without an explicit framework", async () => {
  const r = await post("/roster/reopen", {
    month: "2026-10",
    department: "Enfermagem",
    revision: roster.revision,
    reason: "Ajuste autorizado da equipa",
  });
  assert.equal(r.status, 200);
  roster = r.body;
  const data = JSON.parse(JSON.stringify(roster.data));
  data.rows[0].days[1] = "M2";
  assert.equal(
    (
      await post("/roster", {
        month: "2026-10",
        department: "Enfermagem",
        revision: roster.revision,
        data,
        publish: true,
        reviewNote: "Verificado",
      })
    ).status,
    400,
  );
  const alerts = evaluateNurseCompliance(data.rows[0], 2026, 9, data.rules);
  assert.ok(alerts.some((a) => a.severity === "error"));
});
test("payroll profiles are tenant-bound, versioned, and enforce explicit incidence and deduction reasons", async () => {
  assert.equal(
    (await post("/profiles", { workerId: foreign, revision: 0, data: profile }))
      .status,
    403,
  );
  assert.equal(
    (
      await post("/profiles", {
        workerId: w,
        revision: 0,
        data: { ...profile, confirmed: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/profiles", {
        workerId: w,
        revision: 0,
        data: { ...profile, deductions: 100 },
      })
    ).status,
    400,
  );
  const r = await post(
    "/profiles",
    { workerId: w, revision: 0, data: profile },
    "finance",
  );
  assert.equal(r.status, 200, r.text);
  assert.equal(
    (await post("/profiles", { workerId: w, revision: 0, data: profile }))
      .status,
    409,
  );
  await assert.rejects(() =>
    pg.query(
      "INSERT INTO nv_hr_profiles(empresa_id,worker_id,data,actor) VALUES($1,$2,$3,$4)",
      [B, w, "{}", "other"],
    ),
  );
});
test("payroll uses server calculations, exact 2026 rules and employer contributions do not reduce employee net", async () => {
  assert.equal(
    (await post("/payroll/generate", { month: "2027-01", revision: 0 })).status,
    400,
  );
  const r = await post(
    "/payroll/generate",
    { month: "2026-10", revision: 0, net: 999999 },
    "finance",
  );
  assert.equal(r.status, 200, r.text);
  payroll = r.body;
  const row = payroll.data.rows[0];
  assert.equal(row.gross, 300000);
  assert.equal(row.inssEmployee, 9000);
  assert.equal(row.inssEmployer, 24000);
  assert.equal(row.irtBase, 291000);
  assert.equal(row.irt, 47630);
  assert.equal(row.net, 243370);
  assert.equal(row.employerCost, 324000);
  assert.equal((await get("/payroll?month=2026-10", "other")).body, null);
});
test("approval is independent, freezes snapshots and payment recording needs a confirmed reference", async () => {
  const p = { month: "2026-10", revision: payroll.revision, confirmed: true };
  assert.equal((await post("/payroll/approve", p, "finance")).status, 403);
  const r = await post("/payroll/approve", p, "manager");
  assert.equal(r.status, 200, r.text);
  payroll = r.body;
  assert.equal(payroll.status, "aprovada");
  await assert.rejects(
    () =>
      pg.query("UPDATE nv_hr_payroll SET data=$2 WHERE id=$1", [
        payroll.id,
        "{}",
      ]),
    /imutável/,
  );
  assert.equal(
    (
      await post("/payroll/generate", {
        month: "2026-10",
        revision: payroll.revision,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post(
        "/payroll/paid",
        { month: "2026-10", revision: payroll.revision, reference: "" },
        "finance",
      )
    ).status,
    400,
  );
  const paid = await post(
    "/payroll/paid",
    {
      month: "2026-10",
      revision: payroll.revision,
      reference: "Comprovativo bancário 123",
    },
    "finance",
  );
  assert.equal(paid.status, 200, paid.text);
  payroll = paid.body;
});
test("exports use saved revisions, omit another institution and record an audit event", async () => {
  const x = { kind: "payroll", month: "2026-10", revision: payroll.revision };
  const r = await post("/export", x);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.document.data.rows[0].name, "Pessoa A");
  assert.ok(!r.text.includes("password"));
  assert.equal((await post("/export", { ...x, revision: 0 })).status, 409);
  assert.equal((await post("/export", x, "other")).status, 404);
  assert.ok((await get("/history")).body.some((x: any) => x.kind === "export"));
});
test("money boundaries, special retired rate, allowances and IRT threshold are explicit", () => {
  const low = calculatePayroll({ ...profile, basic: 100000 });
  assert.equal(low.irt, 0);
  assert.equal(low.net, 97000);
  const retired = calculatePayroll({ ...profile, retired: true });
  assert.equal(retired.inssEmployee, 24000);
  const allowance = calculatePayroll({
    ...profile,
    allowances: [
      { label: "Reembolso documentado", value: 10000, inss: false, irt: false },
    ],
  });
  assert.equal(allowance.net, 253370);
  assert.equal(allowance.inssEmployee, 9000);
  assert.throws(() => calculatePayroll({ ...profile, basic: NaN }));
  assert.throws(() =>
    calculatePayroll({ ...profile, allowances: [{ label: "x", value: 100 }] }),
  );
});

test("one-off salary rubrics and deductions never recur in a different month", () => {
  const p = {
    ...profile,
    allowances: [
      {
        label: "Prémio",
        value: 10000,
        inss: true,
        irt: true,
        period: "2026-10",
      },
      {
        label: "Subsídio fixo",
        value: 20000,
        inss: true,
        irt: true,
        period: "recorrente",
      },
    ],
    deductions: 1000,
    deductionsMonth: "2026-10",
  };
  assert.equal(payrollProfileForMonth(p, "2026-10").allowances.length, 2);
  assert.equal(payrollProfileForMonth(p, "2026-11").allowances.length, 1);
  assert.equal(payrollProfileForMonth(p, "2026-11").deductions, 0);
});

test("holiday and Christmas supplements keep their distinct contributory treatment", () => {
  const f = calculatePayroll({
    ...profile,
    allowances: [
      {
        kind: "ferias",
        label: "Férias",
        value: 150000,
        inss: false,
        irt: true,
      },
    ],
  });
  assert.equal(f.gross, 450000);
  assert.equal(f.ssBase, 300000);
  assert.equal(f.inssEmployee, 9000);
  assert.equal(f.irtBase, 441000);
  const n = calculatePayroll({
    ...profile,
    allowances: [
      { kind: "natal", label: "Natal", value: 150000, inss: true, irt: true },
    ],
  });
  assert.equal(n.inssEmployee, 13500);
  assert.throws(() =>
    calculatePayroll({
      ...profile,
      allowances: [
        {
          kind: "ferias",
          label: "Férias",
          value: 150000,
          inss: true,
          irt: true,
        },
      ],
    }),
  );
});

test("approval rejects self-review, changed salary inputs and a newly changed team", async () => {
  let q = await post(
    "/payroll/generate",
    { month: "2026-11", revision: 0 },
    "admin",
  );
  assert.equal(q.status, 200, q.text);
  let pay = q.body;
  assert.equal(
    (
      await post(
        "/payroll/approve",
        { month: "2026-11", revision: pay.revision, confirmed: true },
        "admin",
      )
    ).status,
    403,
  );
  const pr = (await get("/profiles")).body.find((p: any) => p.worker_id === w);
  assert.equal(
    (
      await post("/profiles", {
        workerId: w,
        revision: pr.revision,
        data: { ...pr.data, basic: 300100 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        "/payroll/approve",
        { month: "2026-11", revision: pay.revision, confirmed: true },
        "manager",
      )
    ).status,
    409,
  );
  q = await post(
    "/payroll/generate",
    { month: "2026-11", revision: pay.revision },
    "admin",
  );
  assert.equal(q.status, 200);
  pay = q.body;
  await pg.query(
    "INSERT INTO funcionarios(empresa_id,nome,username,password) VALUES($1,'Nova pessoa','new-person','test')",
    [A],
  );
  assert.equal(
    (
      await post(
        "/payroll/approve",
        { month: "2026-11", revision: pay.revision, confirmed: true },
        "manager",
      )
    ).status,
    409,
  );
});

test("configurable INSS and IRT retain defaults, require reasons, calculate custom rates and isolate internal deductions", () => {
  const normal = calculatePayroll(profile);
  assert.equal(normal.inssEmployee, 9000);
  assert.equal(normal.inssEmployer, 24000);
  assert.equal(normal.irt, 47630);
  assert.throws(
    () =>
      calculatePayroll({ ...profile, payrollOptions: { inssEnabled: false } }),
    /fundamento/,
  );
  const off = calculatePayroll({
    ...profile,
    payrollOptions: {
      inssEnabled: false,
      employerEnabled: false,
      irtEnabled: false,
      reason: "Configuração revista pelo responsável.",
    },
    internalDeductions: [
      {
        label: "Adiantamento",
        reason: "Autorizado no mês",
        enabled: true,
        mode: "fixed",
        basis: "basic",
        value: 5000,
        period: "2026-10",
      },
      {
        label: "Empréstimo",
        reason: "Contrato aceite",
        enabled: true,
        mode: "percent",
        basis: "gross",
        value: 2,
        period: "recorrente",
      },
    ],
  });
  assert.equal(off.inssEmployee, 0);
  assert.equal(off.inssEmployer, 0);
  assert.equal(off.irt, 0);
  assert.equal(off.deductions, 11000);
  assert.equal(off.net, 289000);
  assert.equal(off.employerCost, 300000);
  const custom = calculatePayroll({
    ...profile,
    payrollOptions: {
      employeeRate: 2.5,
      employerRate: 6,
      irtMode: "percent",
      irtRate: 10,
      reason: "Taxas configuradas para conferência.",
    },
  });
  assert.equal(custom.inssEmployee, 7500);
  assert.equal(custom.inssEmployer, 18000);
  assert.equal(custom.irt, 29250);
  assert.equal(custom.net, 263250);
  for (const invalid of [-1, 101, 3.001, "", true, null])
    assert.throws(() =>
      calculatePayroll({
        ...profile,
        payrollOptions: { employeeRate: invalid, reason: "Test" },
      }),
    );
  assert.throws(() =>
    calculatePayroll({
      ...profile,
      internalDeductions: [
        {
          label: "x",
          reason: "",
          enabled: true,
          mode: "fixed",
          basis: "basic",
          value: 1,
          period: "recorrente",
        },
      ],
    }),
  );
  const later = calculatePayroll(
    payrollProfileForMonth(
      {
        ...profile,
        internalDeductions: [
          {
            label: "Adiantamento",
            reason: "Autorizado",
            enabled: true,
            mode: "fixed",
            basis: "basic",
            value: 5000,
            period: "2026-10",
          },
          {
            label: "Parcela",
            reason: "Autorizada",
            enabled: false,
            mode: "percent",
            basis: "basic",
            value: 5,
            period: "recorrente",
          },
        ],
      },
      "2026-11",
    ),
  );
  assert.equal(later.deductions, 0);
});
test("salary policy persists with profile revision and is frozen into new payroll snapshots, without rewriting approved months", async () => {
  const current = (await get("/profiles")).body.find(
    (p: any) => p.worker_id === w,
  );
  const d = {
    ...current.data,
    confirmed: true,
    payrollOptions: {
      inssEnabled: false,
      employerEnabled: false,
      irtEnabled: false,
      reason: "Cálculos desactivados por configuração revista.",
    },
    internalDeductions: [
      {
        label: "Adiantamento",
        reason: "Autorizado pelo colaborador",
        enabled: true,
        mode: "fixed",
        basis: "basic",
        value: 5000,
        period: "recorrente",
      },
    ],
  };
  const invalid = await post("/profiles", {
    workerId: w,
    revision: current.revision,
    data: { ...d, payrollOptions: { ...d.payrollOptions, reason: "" } },
  });
  assert.equal(invalid.status, 400, invalid.text);
  const saved = await post("/profiles", {
    workerId: w,
    revision: current.revision,
    data: d,
  });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.body.data.payrollOptions.inssEnabled, false);
  assert.equal(
    (await get("/profiles", "other")).body.some((p: any) => p.worker_id === w),
    false,
  );
  const before = (await get("/payroll?month=2026-10")).body;
  assert.equal(before.data.rows[0].inssEmployee, 9000);
  assert.notEqual(before.data.rows[0].payrollOptions?.inssEnabled, false);
  const newWorker = (
    await pg.query<any>(
      "SELECT f.id,p.revision,p.data FROM funcionarios f LEFT JOIN nv_hr_profiles p ON p.worker_id=f.id AND p.empresa_id=f.empresa_id WHERE f.empresa_id=$1 AND f.ativo AND f.id<>$2",
      [A, w],
    )
  ).rows;
  for (const worker of newWorker)
    await post("/profiles", {
      workerId: worker.id,
      revision: worker.revision || 0,
      data: { ...profile },
    });
  const generated = await post("/payroll/generate", {
    month: "2026-09",
    revision: 0,
  });
  assert.equal(generated.status, 200, generated.text);
  const row = generated.body.data.rows.find((r: any) => r.workerId === w);
  assert.equal(row.inssEmployee, 0);
  assert.equal(row.irt, 0);
  assert.equal(row.deductions, 5000);
  assert.equal(row.profile.payrollOptions.reason, d.payrollOptions.reason);
  assert.ok(
    generated.body.data.warnings.some((v: string) =>
      v.includes("não constitui isenção"),
    ),
  );
});

test("nursing chiefs need distinct explicit grants; roster access never reveals salaries and can be revoked", async () => {
  const chief = (
    await pg.query<any>(
      "INSERT INTO funcionarios(empresa_id,nome,username,password,funcao) VALUES($1,'Chefia Enfermagem','chief','hash','enfermeiro') RETURNING id",
      [A],
    )
  ).rows[0].id;
  actors.chief = {
    role: "empresa",
    empresaId: A,
    username: "chief",
    funcao: "enfermeiro",
    funcionarioId: chief,
  };
  assert.equal((await get("/access", "chief")).body.canSchedule, false);
  assert.equal((await get("/workers", "chief")).status, 403);
  const grant = {
    workerId: chief,
    revision: 0,
    canSchedule: true,
    canPayroll: false,
    reason: "Responsável pelas escalas de enfermagem.",
  };
  assert.equal((await post("/access-admin", grant, "finance")).status, 403);
  assert.equal((await post("/access-admin", grant, "other")).status, 404);
  assert.equal((await post("/access-admin", grant, "chief")).status, 403);
  let changed = await post("/access-admin", grant);
  assert.equal(changed.status, 200, changed.text);
  assert.equal((await get("/access", "chief")).body.canSchedule, true);
  assert.equal(
    (await get("/roster?month=2026-11&department=Enfermagem", "chief")).status,
    200,
  );
  assert.equal((await get("/profiles", "chief")).status, 403);
  assert.equal((await get("/payroll?month=2026-10", "chief")).status, 403);
  assert.equal(
    (
      await post(
        "/export",
        { kind: "payroll", month: "2026-10", revision: 1 },
        "chief",
      )
    ).status,
    403,
  );
  assert.equal((await get("/access-admin", "chief")).status, 403);
  let saved = await post(
    "/roster",
    {
      month: "2026-11",
      department: "Enfermagem",
      revision: 0,
      data: {
        rows: [
          { id: chief, roleCategory: "Enf.Chefe", days: { 1: "F", 2: "M" } },
        ],
        rules: GLOBAL_DEFAULT_ROSTER_RULES,
        printSettings: {
          unitHeading: "Direcção de Enfermagem",
          title: "Escala Mensal de Trabalho para os Enfermeiros",
          activities: "Formação interna",
          morningPeriod: "07:00h - 15:00h",
        },
      },
    },
    "chief",
  );
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.body.data.printSettings.activities, "Formação interna");
  changed = await post("/access-admin", {
    ...grant,
    revision: changed.body.revision,
    canPayroll: true,
    reason: "Autorizado para consultar e preparar salários da instituição.",
  });
  assert.equal(changed.status, 200, changed.text);
  assert.equal((await get("/profiles", "chief")).status, 200);
  assert.equal(
    (
      await post(
        "/payroll/approve",
        { month: "2026-10", revision: 1, confirmed: true },
        "chief",
      )
    ).status,
    403,
  );
  const own = await post(
    "/profiles",
    { workerId: chief, revision: 0, data: profile },
    "chief",
  );
  assert.equal(own.status, 200, own.text);
  const history = (await get("/history", "chief")).body;
  assert.ok(history.some((h: any) => h.kind === "profile"));
  changed = await post("/access-admin", {
    ...grant,
    revision: changed.body.revision,
    canSchedule: false,
    canPayroll: false,
    reason: "Autorização revogada.",
  });
  assert.equal(changed.status, 200);
  assert.equal((await get("/profiles", "chief")).status, 403);
  assert.equal(
    (await get("/roster?month=2026-11&department=Enfermagem", "chief")).status,
    403,
  );
  assert.equal(
    (await post("/access-admin", { ...grant, revision: 0 })).status,
    409,
  );
  await pg.query("UPDATE funcionarios SET ativo=false WHERE id=$1", [chief]);
  assert.equal(
    (await post("/access-admin", { ...grant, revision: changed.body.revision }))
      .status,
    403,
  );
});

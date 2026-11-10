import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createIntegratedBilling } from "../artifacts/api-server/src/routes/billing-integrated";
import { totals } from "../artifacts/api-server/src/lib/billing-engine";
import { invoicePreview } from "../artifacts/lab-results/src/modules/faturacao/utils/billingNumbers";
import { render } from "../artifacts/lab-results/src/modules/faturacao/utils/printTemplate";

const pg = new PGlite();
let tail = Promise.resolve();
const db: any = {
  query: (q: string, p?: any[]) => pg.query(q, p),
  connect: async () => {
    const prev = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    return { query: db.query, release };
  },
};
const A = randomUUID(),
  B = randomUUID();
const rxId = randomUUID(),
  itemId = randomUUID(),
  lotId = randomUUID(),
  oldLot = randomUUID(),
  wrongLot = randomUUID(),
  foreignLot = randomUUID();
const users: Record<string, any> = {
  pharmacy: {
    role: "empresa",
    empresaId: A,
    username: "pharmacy",
    funcao: "farmaceutico",
  },
  colleague: {
    role: "empresa",
    empresaId: A,
    username: "colleague",
    funcao: "farmaceutico",
  },
  cashier: {
    role: "empresa",
    empresaId: A,
    username: "cashier",
    funcao: "rececionista",
  },
  other: {
    role: "empresa",
    empresaId: B,
    username: "other",
    funcao: "farmaceutico",
  },
  admin: { role: "empresa", empresaId: A, username: "admin", funcao: "admin" },
};
let patientId: number;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).user = users[String(req.headers["x-user"])];
  next();
});
app.use(
  "/api/billing-v2",
  createIntegratedBilling(db, {
    request: async () => {
      throw Error("Nenhuma comunicação AGT é permitida neste ensaio");
    },
  }),
);
const prefix = "/api/billing-v2";
const route = "/pharmacy-pos";
const get = (p: string, who = "pharmacy") =>
  request(app)
    .get(prefix + p)
    .set("x-user", who);
const post = (p: string, b: any, who = "pharmacy") =>
  request(app)
    .post(prefix + p)
    .set("x-user", who)
    .send({ requestId: randomUUID(), ...b });
const order = {
  prescriptionId: rxId,
  items: [{ itemId, lotId, quantity: 2 }],
  discountAmount: 100,
};
before(async () => {
  await applyMigrations(pg, "migrations", () => {});
  for (const [id, name] of [
    [A, "Instituição de ensaio A"],
    [B, "Instituição de ensaio B"],
  ]) {
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$2,'fixture')",
      [id, name],
    );
    await pg.query(
      "INSERT INTO config(empresa_id,nome_clinica,nif,iva_taxa) VALUES($1,$2,'5001234567',14)",
      [id, name],
    );
  }
  patientId = (
    await pg.query<{ id: number }>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Paciente fictício') RETURNING id",
      [A],
    )
  ).rows[0].id;
  await pg.query(
    "INSERT INTO hospital_state(empresa_id,namespace,data) VALUES($1,'clinical',$2)",
    [
      A,
      JSON.stringify({
        visits: [],
        deliveries: [],
        documents: [],
        audit: [],
        prescriptions: [
          {
            id: rxId,
            patient: { id: patientId, nome: "Paciente fictício" },
            created: "2026-01-01",
            validUntil: "2099-12-31T23:59:59Z",
            items: [
              {
                id: itemId,
                name: "Medicamento de ensaio 100 mg",
                dose: "100 mg",
                unit: "comprimido",
                quantity: 3,
              },
            ],
          },
          {
            id: "suspended",
            patient: { id: patientId, nome: "Paciente fictício" },
            cancelled: "2026-01-01",
            validUntil: "2099-12-31",
            items: [],
          },
        ],
      }),
    ],
  );
  for (const [id, org, code, name, expiry] of [
    [lotId, A, "MED-100", "Medicamento de ensaio 100 mg", "2099-12-31"],
    [wrongLot, A, "MED-500", "Medicamento de ensaio 500 mg", "2099-12-31"],
    [oldLot, A, "MED-EX", "Medicamento de ensaio 100 mg", "2001-12-31"],
    [foreignLot, B, "MED-100", "Medicamento de ensaio 100 mg", "2099-12-31"],
  ])
    await pg.query(
      "INSERT INTO hospital_pharmacy(id,empresa_id,code,name,lot,expiry,stock,price) VALUES($1,$2,$3,$4,'L001',$5,12,500)",
      [id, org, code, name, expiry],
    );
});
after(async () => pg.close());

test("pharmacy operators can only use their own training area and active lots", async () => {
  assert.equal((await get(route, "none")).status, 401);
  assert.equal((await get(route, "cashier")).status, 403);
  assert.equal((await get("/state")).status, 403);
  assert.equal((await post("/cash/open", { fundoInicial: 0 })).status, 403);
  const v = await get(route);
  assert.equal(v.status, 200, v.text);
  assert.deepEqual(
    v.body.prescriptions.map((r: any) => r.id),
    [rxId],
  );
  assert.deepEqual(
    new Set(v.body.lots.map((l: any) => l.id)),
    new Set([lotId, wrongLot]),
  );
  assert.deepEqual((await get(route, "other")).body.prescriptions, []);
  for (const id of [oldLot, foreignLot])
    assert.equal(
      (
        await post(route + "/stock", {
          lotId: id,
          quantity: 3,
          confirmTraining: true,
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await post(route + "/stock", {
        lotId,
        quantity: 13,
        confirmTraining: true,
      })
    ).status,
    400,
  );
  const seed = await post(route + "/stock", {
    lotId,
    quantity: 3,
    confirmTraining: true,
  });
  assert.equal(seed.status, 200, seed.text);
  assert.equal(
    (
      await post(route + "/stock", {
        lotId,
        quantity: 1,
        confirmTraining: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(route + "/stock", {
        lotId: wrongLot,
        quantity: 2,
        confirmTraining: true,
      })
    ).status,
    200,
  );
  const mismatch = await post(route + "/quote", {
    ...order,
    items: [{ itemId, lotId: wrongLot, quantity: 1 }],
  });
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.body.error, /não coincide/);
  assert.equal((await post(route + "/quote", order, "other")).status, 400);
});

test("checkout charges the quoted discount once, prints, and moves only training stock", async () => {
  const open = await post(route + "/cash/open", {
    terminal: "01",
    fundoInicial: 1000,
  });
  assert.equal(open.status, 200, open.text);
  const quote = await post(route + "/quote", order);
  assert.equal(quote.status, 200, quote.text);
  assert.equal(quote.body.total, 1026);
  const pay = {
    ...order,
    requestId: randomUUID(),
    expectedTotal: 1026,
    received: 1100,
    paymentMethod: "Numerário",
    confirmTraining: true,
    confirmItem: true,
  };
  assert.equal(
    (await post(route + "/sales", { ...pay, expectedTotal: 1140 })).status,
    400,
  );
  assert.equal(
    (await post(route + "/sales", { ...pay, production: true })).status,
    400,
  );
  assert.equal((await post(route + "/sales", pay, "colleague")).status, 400);
  const [a, b] = await Promise.all([
    post(route + "/sales", pay),
    post(route + "/sales", pay),
  ]);
  assert.equal(a.status, 200, a.text);
  assert.equal(b.status, 200, b.text);
  assert.deepEqual(a.body, b.body);
  assert.equal(a.body.troco, 74);
  assert.match(a.body.numero, /^FR TEST\d{4}FARMACIA\//);
  const state = await get(route);
  assert.equal(state.body.lots.find((l: any) => l.id === lotId).quantity, 1);
  assert.equal(state.body.prescriptions[0].items[0].remaining, 1);
  assert.equal(state.body.sales.length, 1);
  assert.equal(state.body.session.valorEsperado, 2026);
  assert.equal(
    (await post(route + "/sales", { ...pay, requestId: randomUUID() })).status,
    400,
  );
  assert.equal(
    (
      await post(
        route + "/sales/" + a.body.id + "/print",
        { format: "80mm" },
        "other",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        route + "/sales/" + a.body.id + "/print",
        { format: "80mm" },
        "colleague",
      )
    ).status,
    400,
  );
  const print = await post(route + "/sales/" + a.body.id + "/print", {
    format: "80mm",
  });
  assert.equal(print.status, 200, print.text);
  assert.equal(print.body.copyNo, 1);
  assert.equal(print.body.notice, "ORIGINAL");
  assert.equal(print.body.fatura.pacienteId, patientId);
  const html = render(
    print.body.fatura,
    print.body.config,
    print.body.format,
    print.body.notice,
  );
  assert.match(html, /SEM VALIDADE FISCAL/);
  assert.match(html, /L001/);
  const copy = await post(route + "/sales/" + a.body.id + "/print", {
    format: "a4",
  });
  assert.equal(copy.body.copyNo, 2);
  assert.match(copy.body.notice, /2\.ª via/);
  assert.equal(
    (await post("/agt/prepare", { invoiceIds: [a.body.id] }, "admin")).status,
    400,
  );
  const data = await pg.query<any>(
    `SELECT p.stock,
      (SELECT count(*) FROM nv_pharmacy_pos_items WHERE empresa_id=$1) AS items,
      (SELECT count(*) FROM nv_cash_entries WHERE invoice_id=$3) AS cash,
      (SELECT count(*) FROM nv_billing_agt_queue WHERE invoice_id=$3) AS queued,
      (SELECT jsonb_array_length(data->'deliveries') FROM hospital_state WHERE empresa_id=$1 AND namespace='clinical') AS dispensed
    FROM hospital_pharmacy p WHERE p.empresa_id=$1 AND p.id=$2`,
    [A, lotId, a.body.id],
  );
  assert.equal(Number(data.rows[0].stock), 12);
  assert.equal(Number(data.rows[0].items), 1);
  assert.equal(Number(data.rows[0].cash), 1);
  assert.equal(Number(data.rows[0].queued), 0);
  assert.equal(data.rows[0].dispensed, 0);
  const close = await post(route + "/cash/close", { valorContado: 2026 });
  assert.equal(close.status, 200, close.text);
  assert.equal(close.body.diferenca, 0);
});

test("POS cent arithmetic preserves the fixed discount and totals with the FE and training rules", () => {
  const lines = [
    {
      id: "pos-line-1",
      codigo: "P1",
      descricao: "Artigo de ensaio",
      quantidade: 1,
      precoUnitario: 1000,
      unidade: "un",
      ivaIsento: false,
    },
  ];
  for (const rounding of ["legacy", "agt2"] as const) {
    const preview = invoicePreview(lines, 14, 0, "100,00", rounding);
    const server = totals(
      {
        tipoDocumento: "factura-recibo",
        linhas: lines,
        ivaTaxa: 14,
        descontoValor: 100,
      },
      rounding,
    );
    assert.equal(preview.total, 1026);
    assert.equal(preview.total, server.total);
  }
});

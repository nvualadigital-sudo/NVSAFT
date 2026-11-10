import { createInsuranceRouter } from "../artifacts/api-server/src/routes/insurance";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createIntegratedBilling } from "../artifacts/api-server/src/routes/billing-integrated";
import {
  totals,
  localStamp,
} from "../artifacts/api-server/src/lib/billing-engine";
const pg = new PGlite();
// One transaction per physical test connection, as a PostgreSQL pool would provide.
let tail = Promise.resolve();
const db: any = {
  query: (q: string, p?: any[]) => pg.query(q, p),
  connect: async () => {
    const prev = tail;
    let done!: () => void;
    tail = new Promise((r) => (done = r));
    await prev;
    return {
      query: (q: string, p?: any[]) => pg.query(q, p),
      release: () => done(),
    };
  },
};
const A = "20000000-0000-4000-8000-000000000001",
  B = "20000000-0000-4000-8000-000000000002";
const users: any = {
  owner: { role: "empresa", empresaId: A, username: "owner", funcao: "admin" },
  cashier: {
    role: "empresa",
    empresaId: A,
    username: "cashier",
    funcao: "rececionista",
  },
  other: { role: "empresa", empresaId: B, username: "other", funcao: "admin" },
  tech: { role: "empresa", empresaId: A, username: "tech", funcao: "tecnico" },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).user = users[String(req.headers["x-user"])];
  next();
});
app.use("/hospital", createInsuranceRouter(db));
app.use(createIntegratedBilling(db));
const get = (path: string, who = "owner") =>
  request(app).get(path).set("x-user", who);
const post = (path: string, body: any, who = "owner") =>
  request(app)
    .post(path)
    .set("x-user", who)
    .send({ requestId: randomUUID(), ...body });
let client: number, foreign: number;
function doc(extra: any = {}) {
  return {
    tipoDocumento: "factura",
    estado: "emitida",
    clienteNome: "Cliente Teste",
    clienteNif: "5001234567",
    linhas: [
      {
        descricao: "Serviço de teste",
        quantidade: 1,
        precoUnitario: 100,
        ivaIsento: false,
        unidade: "serv",
        codigo: "SERV1",
      },
    ],
    ivaTaxa: 14,
    total: 1,
    subtotalSemIva: 1,
    totalIva: 0,
    ...extra,
  };
}
before(async () => {
  await applyMigrations(pg, "migrations", () => {});
  for (const [id, name] of [
    [A, "owner"],
    [B, "other"],
  ]) {
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$2,'test')",
      [id, name],
    );
    await pg.query(
      "INSERT INTO config(empresa_id,nif,nome_clinica) VALUES($1,'5001234567','Instituição Teste')",
      [id],
    );
  }
  client = (
    await pg.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Cliente Teste') RETURNING id",
      [A],
    )
  ).rows[0].id;
  foreign = (
    await pg.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Outro') RETURNING id",
      [B],
    )
  ).rows[0].id;
});
after(async () => pg.close());
test("auth, role and tenant isolation; financial state has no clinical fields", async () => {
  assert.equal((await get("/state", "none")).status, 401);
  assert.equal((await get("/state", "tech")).status, 403);
  const s = await get("/state");
  assert.equal(s.status, 200);
  assert.equal(s.body.pacientes.length, 1);
  assert.equal(s.body.pacientes[0].patologiasCronicas, undefined);
  assert.equal(
    (await post("/documents", { document: doc({ pacienteId: foreign }) }))
      .status,
    400,
  );
});
test("server recomputes money, test sequences and issued documents cannot be tampered with", async () => {
  const r = await post("/documents", { document: doc({ pacienteId: client }) });
  assert.equal(r.status, 200, r.text);
  const f = r.body.fatura;
  assert.equal(f.total, 114);
  assert.equal(f.ambiente, "homologacao");
  assert.match(f.numero, /^FT TEST\d{4}A\/1$/);
  assert.equal((await get("/state", "other")).body.faturas.length, 0);
  await assert.rejects(
    () => pg.query("UPDATE faturas SET total=1 WHERE id=$1", [f.id]),
    /imutável/,
  );
  await assert.rejects(
    () => pg.query("DELETE FROM faturas WHERE id=$1", [f.id]),
    /imutável/,
  );
  assert.equal(
    (await post("/documents/" + f.id, { document: doc({ total: 1 }) })).status,
    400,
  );
});
test("idempotent retries, simultaneous issues and rollback do not duplicate documents", async () => {
  const id = randomUUID(),
    body = { requestId: id, document: doc() };
  const a = await post("/documents", body);
  const b = await post("/documents", body);
  assert.equal(a.body.fatura.id, b.body.fatura.id);
  assert.equal(
    (
      await post("/documents", {
        ...body,
        document: doc({ clienteNome: "Alterado" }),
      })
    ).status,
    400,
  );
  const pair = await Promise.all([
    post("/documents", { document: doc() }),
    post("/documents", { document: doc() }),
  ]);
  assert.notEqual(pair[0].body.fatura.numero, pair[1].body.fatura.numero);
});
test("cash opening is mandatory for paid documents; terminals and actors cannot open duplicates", async () => {
  const paid = doc({
    tipoDocumento: "factura-recibo",
    estado: "paga",
    formaPagamento: "Numerário",
  });
  assert.equal((await post("/documents", { document: paid })).status, 400);
  assert.equal(
    (await post("/cash/open", { fundoInicial: 50, terminal: "POS-1" })).status,
    200,
  );
  assert.equal(
    (await post("/cash/open", { fundoInicial: 0, terminal: "POS-2" })).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/cash/open",
        { fundoInicial: 0, terminal: "POS-1" },
        "cashier",
      )
    ).status,
    409,
  );
  const r = await post("/documents", { document: paid });
  assert.equal(r.status, 200, r.text);
  assert.equal(
    (await get("/state")).body.config.caixaSessaoAtual.valorEsperado,
    164,
  );
  const real = (
    await pg.query<any>(
      "SELECT count(*) n FROM movimentos WHERE empresa_id=$1",
      [A],
    )
  ).rows[0].n;
  assert.equal(Number(real), 0, "Ensaio não entra na contabilidade real");
});
test("cash movements, expected balances and close are checked in server", async () => {
  assert.equal(
    (
      await post("/cash/movement", {
        tipo: "sangria",
        valor: 1000,
        motivo: "Teste excesso",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/cash/movement", {
        tipo: "sangria",
        valor: 14,
        motivo: "Retirada ensaio",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post("/cash/movement", {
        tipo: "suprimento",
        valor: 10,
        motivo: "Reforço ensaio",
      })
    ).status,
    200,
  );
  const s = (await get("/state")).body.config.caixaSessaoAtual;
  assert.equal(s.valorEsperado, 160);
  assert.equal((await post("/cash/close", { valorContado: 159 })).status, 400);
  const c = await post("/cash/close", { valorContado: 160 });
  assert.equal(c.status, 200, c.text);
  assert.equal(c.body.diferenca, 0);
  const afterClose = (await get("/state")).body.config;
  assert.equal(afterClose.caixaSessaoAtual, undefined);
  assert.ok(afterClose.historicoCaixa.length > 0);
  assert.equal(afterClose.historicoCaixa[0].valorEsperado, 160);
  assert.equal(afterClose.historicoCaixa[0].movimentos.length, 2);
  assert.equal(
    (
      await post("/cash/movement", {
        tipo: "sangria",
        valor: 1,
        motivo: "Fechada",
      })
    ).status,
    400,
  );
});
test("issued snapshot and print counters survive configuration changes and are isolated by tenant", async () => {
  const f = (await get("/state")).body.faturas.find(
    (x: any) => x.estado === "emitida",
  );
  const p = await post(`/documents/${f.id}/print`, { format: "a4" });
  assert.equal(p.status, 200, p.text);
  assert.equal(p.body.notice, "ORIGINAL");
  assert.equal(
    (await post("/config", { patch: { nomeClinica: "Nome novo" } })).status,
    200,
  );
  const p2 = await post(`/documents/${f.id}/print`, { format: "58mm" });
  assert.equal(p2.body.notice, "2.ª via, em conformidade com a original");
  assert.equal(p2.body.config.nomeClinica, "Instituição Teste");
  assert.equal(
    (await post(`/documents/${f.id}/print`, { format: "a4" }, "other")).status,
    400,
  );
  assert.equal(
    (await post("/config", { patch: { ambiente: "producao" } })).status,
    400,
  );
});
test("receipts preserve invoice, require exact origin and never receive a paid invoice twice", async () => {
  const origin = (await post("/documents", { document: doc() })).body.fatura;
  await post("/cash/open", { fundoInicial: 0, terminal: "POS-1" });
  const receipt = {
    ...origin,
    tipoDocumento: "recibo",
    estado: "paga",
    documentoOrigem: origin.numero,
    formaPagamento: "Numerário",
  };
  const r = await post("/documents", { document: receipt });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.fatura.tipoDocumento, "recibo");
  assert.equal(
    (await pg.query<any>("SELECT estado FROM faturas WHERE id=$1", [origin.id]))
      .rows[0].estado,
    "emitida",
  );
  assert.equal((await post("/documents", { document: receipt })).status, 400);
});
test("credit notes require source, reason, acknowledgement proof and quantity limits", async () => {
  const origin = (await post("/documents", { document: doc() })).body.fatura;
  const credit = doc({
    tipoDocumento: "nota-credito",
    documentoOrigem: origin.numero,
    linhas: origin.linhas.map((l: any) => ({ ...l, quantidade: -1 })),
    motivoAnulacaoOuCredito: "Serviço não prestado",
  });
  assert.equal((await post("/documents", { document: credit })).status, 400);
  const r = await post("/documents", {
    document: { ...credit, provaConhecimento: "Email arquivado ref. 123" },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.fatura.total, -114);
  assert.equal(
    (
      await post("/documents", {
        document: { ...credit, provaConhecimento: "Email arquivado ref. 123" },
      })
    ).status,
    400,
  );
});
test("electronic payments need confirmed bank reference; AGT export is preparation only", async () => {
  assert.equal(
    (
      await post("/documents", {
        document: doc({
          tipoDocumento: "factura-recibo",
          estado: "paga",
          formaPagamento: "Multicaixa (TPA)",
        }),
      })
    ).status,
    400,
  );
  const r = await get("/agt/preparation");
  assert.equal(r.status, 200);
  assert.equal(r.body.submissaoDisponivel, false);
  assert.ok(r.body.documentos.length > 0);
  assert.ok(r.body.documentos.every((x: any) => x.state === "preparacao"));
  assert.equal((await get("/agt/dossier", "cashier")).status, 403);
});
test("precision, invalid quantities, signs, local dates and drafts", async () => {
  assert.equal(
    totals(
      doc({
        linhas: [
          {
            descricao: "Decimal",
            quantidade: 3,
            precoUnitario: 0.1,
            ivaIsento: false,
          },
        ],
      }),
    ).total,
    0.34,
  );
  assert.throws(() =>
    totals(
      doc({
        linhas: [
          {
            descricao: "x",
            quantidade: NaN,
            precoUnitario: 10,
            ivaIsento: false,
          },
        ],
      }),
    ),
  );
  assert.equal(localStamp(new Date("2026-10-28T23:30:00Z")).data, "29/10/2026");
  const draft = await post("/documents", {
    document: doc({ estado: "rascunho" }),
  });
  assert.equal(draft.status, 200);
  assert.match(draft.body.fatura.numero, /^RASCUNHO-/);
  const f = draft.body.fatura;
  const issued = await post("/documents/" + f.id, {
    document: { estado: "emitida" },
  });
  assert.equal(issued.status, 200, issued.text);
  assert.equal(issued.body.fatura.id, f.id);
  assert.match(issued.body.fatura.numero, /^FT /);
});

test("fixed discounts allocate integer cents without negative line bases", () => {
  const d = totals(
    doc({
      descontoValor: 10,
      linhas: [
        { descricao: "A", quantidade: 1, precoUnitario: 60, ivaIsento: false },
        { descricao: "B", quantidade: 1, precoUnitario: 40, ivaIsento: true },
      ],
    }),
  );
  assert.equal(d.subtotalSemIva, 90);
  assert.equal(d.totalIva, 7.56);
  assert.equal(d.total, 97.56);
  assert.equal(d.linhas[0].baseLiquida, 54);
});

test("discount remainder never creates a negative zero-priced line", () => {
  const d = totals(
    doc({
      descontoValor: 0.01,
      linhas: [
        { descricao: "A", quantidade: 1, precoUnitario: 0.01, ivaIsento: true },
        { descricao: "B", quantidade: 1, precoUnitario: 0.01, ivaIsento: true },
        { descricao: "C", quantidade: 1, precoUnitario: 0, ivaIsento: true },
      ],
    }),
  );
  assert.equal(d.total, 0.01);
  assert.ok(d.linhas.every((l: any) => l.baseLiquida >= 0));
});

test("cash discrepancy approval validates a real same-company manager and never stores the password", async () => {
  await post(
    "/cash/open",
    { fundoInicial: 30, terminal: "POS-CASHIER" },
    "cashier",
  );
  const b = {
    valorContado: 29,
    diferencaMotivo: "Diferença de contagem",
    supervisorUsername: "other",
    supervisorPassword: "test",
  };
  assert.equal((await post("/cash/close", b, "cashier")).status, 403);
  const ok = await post(
    "/cash/close",
    { ...b, supervisorUsername: "owner" },
    "cashier",
  );
  assert.equal(ok.status, 200, ok.text);
  const s = (
    await pg.query<any>(
      "SELECT data FROM nv_cash_sessions WHERE empresa_id=$1 AND actor='cashier'",
      [A],
    )
  ).rows[0];
  assert.equal(s.data.aprovadoPor, "owner");
  const requests = (
    await pg.query<any>(
      "SELECT payload,result FROM nv_billing_requests WHERE empresa_id=$1",
      [A],
    )
  ).rows;
  assert.ok(!JSON.stringify(requests).includes("supervisorPassword"));
});

const insurerId = randomUUID(),
  beneficiaryId = randomUUID(),
  contractId = randomUUID();
let covered: any, receipt: any;
const coverage = () => ({
  beneficiaryId,
  contractId,
  serviceDate: localStamp().iso,
  authorization: "AUT-1",
  acts: [{ code: "CONS", professional: "Médico do serviço" }],
});
test("native insurance uses the exact per-line fiscal engine and freezes the contract snapshot", async () => {
  await pg.query("UPDATE config SET nif='5001234567' WHERE empresa_id=$1", [A]);
  await post("/config", {
    patch: {
      configuracaoFiscal: {
        motivoIsencaoPadrao: "Norma do ensaio — verificar enquadramento",
      },
    },
  });
  await pg.query(
    "INSERT INTO hospital_records(id,empresa_id,kind,data,created_by) VALUES($1,$1,'insurance',$2,'owner')",
    [
      A,
      {
        version: 1,
        seguradoras: [
          {
            id: insurerId,
            nome: "Seguradora teste",
            activa: true,
            cobertura: 100,
            prazo: 30,
          },
        ],
        assegurados: [
          {
            id: beneficiaryId,
            pacienteId: String(client),
            nome: "Cliente Teste",
            seguradoraId: insurerId,
            cartao: "CARD-1",
            plano: "P1",
            inicio: "2026-01-01",
            fim: "2099-12-31",
            activo: true,
            cobertura: 80,
          },
        ],
      },
    ],
  );
  await pg.query(
    "INSERT INTO nv_insurance_contracts(empresa_id,id,insurer_id,data,updated_by) VALUES($1,$2,$3,$4,'owner')",
    [
      A,
      contractId,
      insurerId,
      {
        insurerId,
        name: "Tabela ensaio",
        start: "2026-01-01",
        end: "2099-12-31",
        active: true,
        requiresAuthorization: true,
        rates: [
          {
            code: "CONS",
            description: "Consulta",
            service: "Medicina",
            price: 50000,
            coverage: 100,
            internalCost: 20000,
            maxCovered: null,
          },
        ],
      },
    ],
  );
  const d = doc({
    pacienteId: client,
    linhas: [
      {
        descricao: "Consulta",
        quantidade: 1,
        precoUnitario: 50000,
        ivaIsento: true,
      },
    ],
    ivaTaxa: 0,
    total: 50000,
    insurance: coverage(),
  });
  const q = await post("/hospital/insurance/quote", {
    ...d,
    engine: "integrated",
  });
  assert.equal(q.status, 200, q.text);
  assert.equal(q.body.insurerAmount, 40000);
  assert.equal(q.body.patientAmount, 10000);
  const r = await post("/documents", { document: d });
  assert.equal(r.status, 200, r.text);
  covered = r.body.fatura;
  assert.equal(covered.insuranceAmounts.insurer, 40000);
  assert.equal(
    (
      await post("/documents", {
        document: { ...d, estado: "paga", formaPagamento: "Numerário" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await post("/documents", { document: { ...d, pacienteId: foreign } }))
      .status,
    400,
  );
  const small = {
    ...d,
    linhas: Array.from({ length: 3 }, () => ({
      descricao: "Consulta",
      quantidade: 0.000001,
      precoUnitario: 50000,
      ivaIsento: false,
    })),
    ivaTaxa: 14,
    descontoValor: 0.01,
    total: 0.17,
    insurance: {
      ...coverage(),
      acts: Array.from({ length: 3 }, () => ({
        code: "CONS",
        professional: "Médico",
      })),
    },
  };
  const exact = totals(small);
  small.total = exact.total;
  const sq = await post("/hospital/insurance/quote", {
    ...small,
    engine: "integrated",
  });
  assert.equal(sq.status, 200, sq.text);
  assert.equal(sq.body.total, exact.total);
  assert.deepEqual(
    sq.body.acts.map((a: any) => a.net),
    exact.linhas.map((l: any) => l.baseLiquida),
  );
  await pg.query(
    "UPDATE nv_insurance_contracts SET data=jsonb_set(data,'{rates,0,price}','60000'::jsonb) WHERE empresa_id=$1 AND id=$2",
    [A, contractId],
  );
  const snapshot = (
    await pg.query<any>(
      "SELECT snapshot FROM nv_insurance_claims WHERE empresa_id=$1 AND invoice_id=$2",
      [A, covered.id],
    )
  ).rows[0].snapshot;
  assert.equal(snapshot.acts[0].price, 50000);
});
test("native partial receipts require an open cash session, bank reference, correct payer and idempotency", async () => {
  const state = (await get("/state")).body;
  await post("/cash/close", {
    valorContado: state.config.caixaSessaoAtual.valorEsperado,
  });
  const b = {
    requestId: randomUUID(),
    invoiceId: covered.id,
    partyType: "insurer",
    amount: 25000,
    method: "Transferência",
    reference: "BANCO-123",
    date: localStamp().iso,
  };
  assert.equal((await post("/insurance/payments", b)).status, 400);
  await post("/cash/open", { fundoInicial: 0, terminal: "POS-INSURANCE" });
  assert.equal(
    (
      await post("/insurance/payments", {
        ...b,
        requestId: randomUUID(),
        reference: "",
      })
    ).status,
    400,
  );
  assert.equal((await post("/insurance/payments", b, "other")).status, 400);
  const q = await post("/insurance/payments", b);
  assert.equal(q.status, 200, q.text);
  receipt = q.body.fatura;
  const retry = await post("/insurance/payments", b);
  assert.equal(retry.body.receiptId, receipt.id);
  assert.equal(
    (await post("/insurance/payments", { ...b, amount: 24000 })).status,
    400,
  );
  assert.equal(
    (
      await post("/insurance/payments", {
        ...b,
        requestId: randomUUID(),
        amount: 15000.01,
      })
    ).status,
    400,
  );
  const detail = (await get("/state")).body.faturas.find(
    (f: any) => f.id === covered.id,
  );
  assert.equal(detail.receivableBalance, 25000);
  assert.equal(detail.cashReceived, 25000);
  assert.equal(detail.estado, "emitida");
  assert.equal(
    (await get("/state")).body.config.caixaSessaoAtual.valorEsperado,
    0,
    "Bank receipt must not increase physical cash",
  );
  assert.equal(
    Number(
      (
        await pg.query<any>(
          "SELECT count(*) AS n FROM movimentos WHERE empresa_id=$1",
          [A],
        )
      ).rows[0].n,
    ),
    0,
  );
  assert.equal(
    (
      await pg.query<any>("SELECT estado FROM faturas WHERE id=$1", [
        covered.id,
      ])
    ).rows[0].estado,
    "emitida",
  );
  assert.equal(
    (await post("/documents/" + covered.id, { document: { estado: "paga" } }))
      .status,
    400,
    "Cannot bypass payer allocation through the regular full-payment button",
  );
});
test("insurance reports and bank-style statements keep test receipts out of the real financial archive", async () => {
  let q = await get("/hospital/insurance/report");
  assert.equal(q.status, 200, q.text);
  assert.equal(q.body.claims.length, 0);
  q = await get("/hospital/insurance/report?environment=homologacao");
  assert.equal(q.body.claims.length, 1);
  assert.equal(q.body.claims[0].insurerBalance, 15000);
  assert.equal(q.body.claims[0].patientBalance, 10000);
  q = await post("/hospital/insurance/statement", {
    partyType: "insurer",
    partyId: insurerId,
    environment: "homologacao",
  });
  assert.equal(q.status, 200, q.text);
  assert.equal(q.body.opening, 0);
  assert.equal(q.body.closing, 15000);
  assert.equal(q.body.rows.length, 2);
  assert.equal(q.body.rows[1].balance, 15000);
  q = await post("/hospital/insurance/statement", {
    partyType: "insurer",
    partyId: insurerId,
  });
  assert.equal(q.body.rows.length, 0);
  assert.equal(q.body.closing, 0);
  assert.equal(
    (
      await post("/hospital/insurance/payments", {
        invoiceId: covered.id,
        amount: 10000,
        partyType: "patient",
      })
    ).status,
    409,
  );
  assert.equal(
    (await get("/hospital/insurance/report?environment=invalid")).status,
    400,
  );
});
test("native credits retain original act allocations and leave the issued invoice immutable", async () => {
  const credit = {
    ...covered,
    insurance: null,
    tipoDocumento: "nota-credito",
    estado: "emitida",
    documentoOrigem: covered.numero,
    desconto: 0,
    linhas: covered.linhas.map((l: any, i: number) => ({
      ...l,
      quantidade: -0.5,
      originActIndex: i,
    })),
    motivoAnulacaoOuCredito: "Acto parcialmente corrigido",
    provaConhecimento: "Email arquivado ref 456",
  };
  const invalid = {
    ...credit,
    linhas: credit.linhas.map((l: any) => ({ ...l, originActIndex: 999 })),
  };
  assert.equal((await post("/documents", { document: invalid })).status, 400);
  const r = await post("/documents", { document: credit });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.fatura.total, -25000);
  const state = (await get("/state")).body.faturas.find(
    (f: any) => f.id === covered.id,
  );
  assert.equal(
    state.receivableBalance,
    5000,
    "Credit balance of one payer must not hide another remaining debt",
  );
  assert.equal(state.estado, "emitida");
  const claims = (
    await get("/hospital/insurance/report?environment=homologacao")
  ).body.claims[0];
  assert.equal(claims.insurerBalance, -5000);
  assert.equal(claims.patientBalance, 5000);
  assert.equal(
    (
      await post("/insurance/payments", {
        invoiceId: covered.id,
        partyType: "insurer",
        amount: 0.01,
        method: "Numerário",
      })
    ).status,
    400,
  );
  const paid = await post("/insurance/payments", {
    invoiceId: covered.id,
    partyType: "patient",
    amount: 5000,
    method: "Numerário",
  });
  assert.equal(paid.status, 200, paid.text);
  const paidState = (await get("/state")).body;
  assert.equal(
    paidState.faturas.find((f: any) => f.id === covered.id).estado,
    "paga",
  );
  assert.equal(paidState.config.caixaSessaoAtual.valorEsperado, 5000);
  assert.equal(
    (
      await pg.query<any>("SELECT estado FROM faturas WHERE id=$1", [
        covered.id,
      ])
    ).rows[0].estado,
    "emitida",
  );
  await assert.rejects(
    () => pg.query("UPDATE faturas SET total=1 WHERE id=$1", [covered.id]),
    /imutável/,
  );
});
test("native private accounts accept partial collection and cannot regularise the real archive in training mode", async () => {
  const source = (
    await post("/documents", { document: doc({ pacienteId: client }) })
  ).body.fatura;
  let q = await post("/insurance/payments", {
    invoiceId: source.id,
    partyType: "patient",
    amount: 50,
    method: "Numerário",
  });
  assert.equal(q.status, 200, q.text);
  assert.equal(
    (
      await post("/insurance/payments", {
        invoiceId: source.id,
        partyType: "insurer",
        amount: 1,
        method: "Numerário",
      })
    ).status,
    400,
  );
  q = await post("/insurance/payments", {
    invoiceId: source.id,
    partyType: "patient",
    amount: 64,
    method: "Transferência",
    reference: "BANCO-456",
  });
  assert.equal(q.status, 200, q.text);
  assert.equal(
    (await get("/state")).body.faturas.find((f: any) => f.id === source.id)
      .receivableBalance,
    0,
  );
  const real = (
    await pg.query<any>(
      "INSERT INTO faturas(empresa_id,numero,data,paciente_id,cliente_nome,total,estado,tipo_documento) VALUES($1,'ARQ-REAL','28/10/2026',$2,'Cliente Teste',100,'emitida','factura') RETURNING id",
      [A, client],
    )
  ).rows[0];
  assert.equal(
    (
      await post("/insurance/payments", {
        invoiceId: real.id,
        partyType: "patient",
        amount: 100,
        method: "Numerário",
      })
    ).status,
    400,
  );
  const report = (
    await post("/hospital/insurance/statement", {
      partyType: "patient",
      partyId: String(client),
    })
  ).body;
  assert.ok(
    !report.rows.some((r: any) => String(r.reference).includes("TEST")),
  );
  assert.equal(report.closing, 100);
});

let trainingPatient: number, trainingProduct: number, trainingInvoice: any;
test("training opens patient registration through invoice issue without taxpayer ID or exemption setup", async () => {
  await pg.query("UPDATE config SET nif='' WHERE empresa_id=$1", [B]);
  let state = (await get("/state", "other")).body;
  assert.equal(state.config.formacaoAtiva, true);
  assert.equal(state.config.producaoFiscalAtiva, false);
  assert.equal(state.config.nif, "");
  let result = await post(
    "/clients",
    {
      client: {
        nome: "TESTE — Percurso completo",
        nif: "",
        telefone: "900000000",
        email: "",
        endereco: "Luanda",
      },
    },
    "other",
  );
  assert.equal(result.status, 200, result.text);
  trainingPatient = result.body.id;
  result = await post(
    "/products",
    {
      product: {
        nome: "Serviço de formação",
        codigo: "FORM-1",
        categoria: "Serviços",
        preco: 2500,
        stock: 7,
        stockMinimo: 0,
        unidadeMedida: "serv",
        ativo: true,
        ivaIsento: true,
      },
    },
    "other",
  );
  assert.equal(result.status, 200, result.text);
  trainingProduct = result.body.id;
  state = (await get("/state", "other")).body;
  assert.ok(state.pacientes.some((p: any) => p.id === trainingPatient));
  assert.ok(
    !(await get("/state")).body.pacientes.some(
      (p: any) => p.id === trainingPatient,
    ),
  );
  const id = randomUUID(),
    document = doc({
      pacienteId: trainingPatient,
      clienteNome: "TESTE — Percurso completo",
      clienteNif: "",
      linhas: [
        {
          produtoId: trainingProduct,
          descricao: "Serviço de formação",
          quantidade: 1,
          precoUnitario: 2500,
          ivaIsento: true,
        },
      ],
      ivaTaxa: 0,
      ambiente: "homologacao",
    });
  result = await post("/documents", { requestId: id, document }, "other");
  assert.equal(result.status, 200, result.text);
  trainingInvoice = result.body.fatura;
  assert.equal(trainingInvoice.total, 2500);
  assert.equal(trainingInvoice.ambiente, "homologacao");
  assert.equal(trainingInvoice.emitenteSnapshot.nif, "");
  assert.equal(trainingInvoice.motivoIsencao, "");
  assert.match(trainingInvoice.numero, /^FT TEST/);
  assert.equal(
    (await post("/documents", { requestId: id, document }, "other")).body.fatura
      .id,
    trainingInvoice.id,
  );
  assert.equal(
    (await get("/state", "other")).body.config.nif,
    "",
    "Training must not write a fabricated taxpayer ID into the institutional settings",
  );
});
test("training supports open cash, partial and final receipt, print reservations and close without real treasury or stock movements", async () => {
  const payment = {
    invoiceId: trainingInvoice.id,
    partyType: "patient",
    amount: 750,
    method: "Numerário",
  };
  assert.equal(
    (await post("/insurance/payments", payment, "other")).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/cash/open",
        { fundoInicial: 1000, terminal: "FORM-01" },
        "other",
      )
    ).status,
    200,
  );
  const partial = await post("/insurance/payments", payment, "other");
  assert.equal(partial.status, 200, partial.text);
  const rest = await post(
    "/insurance/payments",
    {
      ...payment,
      amount: 1750,
      method: "Transferência",
      reference: "TESTE-BANCO-001",
    },
    "other",
  );
  assert.equal(rest.status, 200, rest.text);
  let state = (await get("/state", "other")).body;
  assert.equal(
    state.faturas.find((f: any) => f.id === trainingInvoice.id)
      .receivableBalance,
    0,
  );
  assert.equal(state.config.caixaSessaoAtual.valorEsperado, 1750);
  for (const format of ["a4", "58mm", "80mm"]) {
    const printed = await post(
      "/documents/" + trainingInvoice.id + "/print",
      { format },
      "other",
    );
    assert.equal(printed.status, 200, printed.text);
    assert.equal(printed.body.fatura.ambiente, "homologacao");
    assert.equal(printed.body.config.nif, "");
  }
  assert.equal(
    Number(
      (
        await pg.query<any>(
          "SELECT count(*) AS n FROM movimentos WHERE empresa_id=$1",
          [B],
        )
      ).rows[0].n,
    ),
    0,
  );
  assert.equal(
    Number(
      (
        await pg.query<any>(
          "SELECT stock FROM produtos WHERE empresa_id=$1 AND id=$2",
          [B, trainingProduct],
        )
      ).rows[0].stock,
    ),
    7,
  );
  assert.equal(
    (await post("/cash/close", { valorContado: 1750 }, "other")).status,
    200,
  );
  assert.equal(
    (await get("/state", "other")).body.config.caixaSessaoAtual,
    undefined,
  );
});
test("training cannot activate fiscal production through settings or document input", async () => {
  assert.equal(
    (await post("/config", { patch: { ambiente: "producao" } }, "other"))
      .status,
    400,
  );
  assert.equal(
    (await post("/config", { patch: { producaoFiscalAtiva: true } }, "other"))
      .status,
    400,
  );
  assert.equal(
    (
      await post(
        "/documents",
        { document: doc({ ambiente: "producao" }) },
        "other",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/documents",
        { document: doc({ ambiente: "production" }) },
        "other",
      )
    ).status,
    400,
  );
  const preparation = await get("/agt/preparation", "other");
  assert.equal(preparation.body.submissaoDisponivel, false);
  assert.ok(
    preparation.body.documentos.every((d: any) => d.state === "preparacao"),
  );
});

test("confirmed draft keeps settings on the server, promotes the same invoice and remains company scoped", async () => {
  const options = {
    observacoesLivres: "Nota guardada",
    referenciaExterna: "EXT-001",
    transporte: true,
    localCarga: "Origem",
    moradaCarga: "Luanda",
    dataHoraCarga: "2026-10-29T10:00",
    localDescarga: "Destino",
    moradaDescarga: "Viana",
    dataHoraDescarga: "",
    matriculaVeiculo: "TEST",
    incluirPrecosTransporte: false,
  };
  const draft = doc({
    estado: "rascunho",
    clienteNif: "",
    pacienteId: trainingPatient,
    dataDisponibilizacao: "2026-10-29",
    opcoesDocumento: options,
  });
  let result = await post("/documents", { document: draft }, "other");
  assert.equal(result.status, 200, result.text);
  const saved = result.body.fatura;
  assert.equal(saved.estado, "rascunho");
  assert.deepEqual(saved.opcoesDocumento, options);
  assert.equal(saved.dataDisponibilizacao, "2026-10-29");
  assert.equal(
    (
      await post("/documents/" + saved.id, {
        document: { ...draft, estado: "emitida" },
      })
    ).status,
    400,
  );
  result = await post(
    "/documents/" + saved.id,
    { document: { ...draft, estado: "emitida" } },
    "other",
  );
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.fatura.id, saved.id);
  assert.match(result.body.fatura.numero, /^FT TEST/);
  assert.equal(
    (
      await post(
        "/documents/" + saved.id,
        {
          document: {
            ...draft,
            estado: "rascunho",
            observacoes: "Alteração indevida",
          },
        },
        "other",
      )
    ).status,
    400,
  );
  assert.equal(
    Number(
      (
        await pg.query<any>(
          "SELECT count(*) AS n FROM movimentos WHERE empresa_id=$1",
          [B],
        )
      ).rows[0].n,
    ),
    0,
  );
});
test("unfinished insurance selection can be saved as draft and is revalidated at emission", async () => {
  const draft = doc({
    estado: "rascunho",
    pacienteId: client,
    insurance: {
      beneficiaryId,
      contractId: "",
      serviceDate: localStamp().iso,
      authorization: "",
      acts: [{ code: "", professional: "" }],
    },
  });
  let result = await post("/documents", { document: draft });
  assert.equal(result.status, 200, result.text);
  const saved = result.body.fatura;
  assert.equal(saved.insuranceAmounts, null);
  assert.equal(
    Number(
      (
        await pg.query<any>(
          "SELECT count(*) AS n FROM nv_insurance_claims WHERE empresa_id=$1 AND invoice_id=$2",
          [A, saved.id],
        )
      ).rows[0].n,
    ),
    0,
  );
  assert.equal(
    (
      await post("/documents/" + saved.id, {
        document: { ...draft, estado: "emitida" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/documents", {
        document: { ...draft, insurance: { acts: "invalid" } },
      })
    ).status,
    400,
  );
  result = await post("/documents/" + saved.id, {
    document: { ...draft, insurance: null, estado: "emitida" },
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.fatura.id, saved.id);
  assert.equal(result.body.fatura.insurance, null);
});
test("autosaving the same proforma does not consume new numbers on every edit", async () => {
  const d = doc({ tipoDocumento: "pro-forma", estado: "rascunho" });
  let result = await post("/documents", { document: d });
  assert.equal(result.status, 200, result.text);
  const first = result.body.fatura;
  for (const note of ["Primeira revisão", "Segunda revisão"]) {
    result = await post("/documents/" + first.id, {
      document: { ...d, observacoes: note },
    });
    assert.equal(result.status, 200, result.text);
    assert.equal(result.body.fatura.numero, first.numero);
    assert.equal(result.body.fatura.id, first.id);
  }
  const next = await post("/documents", { document: d });
  assert.equal(next.status, 200, next.text);
  assert.notEqual(next.body.fatura.numero, first.numero);
});

test("categories come from the institution catalogue, rename atomically and never act as SKU prefixes", async () => {
  const product = await post("/products", {
    product: {
      nome: "Consulta para kit",
      codigo: "CONS-CAT",
      categoria: "Medicina teste",
      preco: 1250.5,
      stock: 0,
      stockMinimo: 0,
      unidadeMedida: "serv",
      ativo: true,
      ivaIsento: true,
    },
  });
  assert.equal(product.status, 200, product.text);
  (globalThis as any).__catalogProduct = product.body;
  let r = await post("/categories", { nome: "Diagnóstico personalizado" });
  assert.equal(r.status, 200, r.text);
  r = await post("/categories", { nome: "diagnóstico personalizado" });
  assert.equal(r.status, 400);
  r = await post("/categories", { nome: "Categoria recepção" }, "cashier");
  assert.equal(r.status, 403);
  const state = (await get("/state")).body;
  assert.ok(state.categorias.includes("Medicina teste"));
  assert.ok(state.categorias.includes("Diagnóstico personalizado"));
  assert.ok(!state.categorias.includes("SVC - Serviços"));
  assert.ok(
    !(await get("/state", "other")).body.categorias.includes(
      "Diagnóstico personalizado",
    ),
  );
  r = await post("/categories", {
    anterior: "Medicina teste",
    nome: "Consulta clínica",
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(
    (await get("/state")).body.produtos.find(
      (p: any) => p.id === product.body.id,
    ).categoria,
    "Consulta clínica",
  );
  r = await post(
    "/categories",
    { anterior: "Consulta clínica", nome: "Outra categoria" },
    "other",
  );
  assert.equal(r.status, 400);
  const removed = await request(app)
    .delete("/categories")
    .set("x-user", "owner")
    .send({ requestId: randomUUID(), nome: "Consulta clínica" });
  assert.equal(removed.status, 400);
});
test("kits are confirmed, tenant scoped, derived from real components and protected against stale edits", async () => {
  const p = (globalThis as any).__catalogProduct;
  const input = {
    codigo: "KIT-CONS",
    nome: "Kit de consulta",
    categoria: "Consulta clínica",
    itens: [
      {
        produtoId: p.id,
        quantidade: 2,
        produtoNome: "Nome falsificado",
        precoUnitario: 99999,
      },
    ],
    precoVendaKit: 2000.25,
  };
  const id = randomUUID();
  let r = await post("/kits", { requestId: id, kit: input });
  assert.equal(r.status, 200, r.text);
  const saved = r.body;
  assert.equal(saved.itens[0].produtoNome, p.nome);
  assert.equal(saved.itens[0].precoUnitario, 1250.5);
  assert.equal(saved.precoTotalCalculado, 2501);
  assert.equal(saved.revision, 1);
  assert.equal(
    (await post("/kits", { requestId: id, kit: input })).body.id,
    saved.id,
  );
  assert.equal((await post("/kits", { kit: input })).status, 400);
  assert.equal(
    (await post("/kits", { kit: { ...input, codigo: "KIT-RECEP" } }, "cashier"))
      .status,
    403,
  );
  assert.equal(
    (await post("/kits", { kit: { ...input, codigo: "KIT-FORA" } }, "other"))
      .status,
    400,
  );
  assert.equal(
    (await post("/kits", { kit: { ...saved, nome: "Ataque" } }, "other"))
      .status,
    400,
  );
  assert.ok(
    !(await get("/state", "other")).body.kits.some(
      (k: any) => k.id === saved.id,
    ),
  );
  r = await post("/kits", { kit: { ...saved, nome: "Kit revisto" } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.revision, 2);
  assert.equal(
    (await post("/kits", { kit: { ...saved, nome: "Revisão antiga" } })).status,
    400,
  );
  r = await post("/config", {
    patch: { kits: [{ ...saved, itens: [{ produtoId: foreign }] }] },
  });
  assert.equal(
    r.status,
    400,
    "Bulk config must not bypass component ownership validation",
  );
  const del = await request(app)
    .delete("/kits/" + saved.id)
    .set("x-user", "owner")
    .send({ requestId: randomUUID(), revision: 2 });
  assert.equal(del.status, 200, del.text);
  assert.ok(
    !(await get("/state")).body.kits.some((k: any) => k.id === saved.id),
  );
});

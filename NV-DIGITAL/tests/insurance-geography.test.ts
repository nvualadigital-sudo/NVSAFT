import laboratorioRouter from "../artifacts/api-server/src/routes/laboratorio";
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
import { createInsuranceRouter } from "../artifacts/api-server/src/routes/insurance";
import { createGeographyRouter } from "../artifacts/api-server/src/routes/geography";
import { createHospitalRouter } from "../artifacts/api-server/src/routes/hospital";
import billing from "../artifacts/api-server/src/routes/billing";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import {
  ANGOLA_GEOGRAPHY,
  COUNTRY_CODES,
  emptyPatientGeography,
} from "../lib/api-zod/src/geography";
const db = new PGlite(),
  A = randomUUID(),
  B = randomUUID(),
  insurer = randomUUID(),
  member = randomUUID(),
  contract = randomUUID();
const pool: any = {
  query: (s: string, p?: any[]) => db.query(s, p),
  connect: async () => ({
    query: (s: string, p?: any[]) => db.query(s, p),
    release() {},
  }),
};
let app: ReturnType<typeof express>,
  patient: number,
  otherPatient: number,
  foreignPatient: number,
  invoice: number,
  secondInvoice: number,
  number: string;
const tokens: Record<string, string> = {};
function call(method: string, path: string, who = "admin", body?: any) {
  const q = (request(app) as any)
    [method]("/api" + path)
    .set("Authorization", "Bearer " + tokens[who]);
  return body === undefined ? q : q.send(body);
}
async function archivedPayment(
  invoiceId: number,
  party: string,
  partyId: string,
  amount: number,
  date: string,
) {
  await db.query(
    "INSERT INTO nv_receivable_entries(empresa_id,invoice_id,party_type,party_id,occurred_on,kind,credit,reference,actor) VALUES($1,$2,$3,$4,$5,'payment',$6,'REC-ARQUIVO','importacao-verificada')",
    [A, invoiceId, party, partyId, date, amount],
  );
  await db.query(
    "INSERT INTO movimentos(empresa_id,fatura_id,data,descricao,tipo,valor) VALUES($1,$2,$3,'Recebimento do arquivo','entrada',$4)",
    [A, invoiceId, date, amount],
  );
}
const selection = () => ({
  beneficiaryId: member,
  contractId: contract,
  authorization: "AUT-TEST",
  serviceDate: "2026-10-01",
  acts: [{ code: "CONS-GERAL", professional: "Profissional do serviço" }],
});
const invoiceBody = () => ({
  requestId: randomUUID(),
  tipoDocumento: "factura",
  estado: "emitida",
  data: "01/10/2026",
  dataVencimento: "31/10/2026",
  clienteNome: "Paciente teste",
  clienteNif: "123456789",
  pacienteId: patient,
  linhas: [
    {
      descricao: "Consulta geral",
      quantidade: 1,
      precoUnitario: 50000,
      ivaIsento: true,
    },
  ],
  subtotalSemIva: 50000,
  totalIva: 0,
  ivaTaxa: 0,
  total: 50000,
  desconto: 0,
  insurance: selection(),
});
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
  tokens.reception = await signToken({
    role: "empresa",
    empresaId: A,
    username: "reception",
    funcao: "rececionista",
  });
  tokens.nurse = await signToken({
    role: "empresa",
    empresaId: A,
    username: "nurse",
    funcao: "enfermeiro",
  });
  await db.query(
    "INSERT INTO config(empresa_id,nome_clinica,nif) VALUES($1,'Instituição de ensaio','5412345678')",
    [A],
  );
  patient = (
    await db.query<any>(
      "INSERT INTO pacientes(empresa_id,nome,processo,endereco) VALUES($1,'Paciente teste','PROC-1','Morada anterior preservada') RETURNING id",
      [A],
    )
  ).rows[0].id;
  otherPatient = (
    await db.query<any>(
      "INSERT INTO pacientes(empresa_id,nome,processo) VALUES($1,'Outro paciente','PROC-2') RETURNING id",
      [A],
    )
  ).rows[0].id;
  foreignPatient = (
    await db.query<any>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Paciente empresa B') RETURNING id",
      [B],
    )
  ).rows[0].id;
  app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/hospital", createInsuranceRouter(pool));
  app.use("/api/hospital", createGeographyRouter(pool));
  app.use("/api/hospital", createHospitalRouter(pool));
  app.use("/api", billing);
  app.use("/api", laboratorioRouter);
});
after(() => db.close());
test("insurance catalogue resolves the canonical patient, rejects cross-institution links and uses revisions", async () => {
  const data = {
    version: 1,
    seguradoras: [
      {
        id: insurer,
        nome: "Seguro de ensaio",
        nif: "5412345679",
        contacto: "",
        email: "",
        contrato: "Contrato teste",
        cobertura: 100,
        prazo: 30,
        activa: true,
      },
    ],
    assegurados: [
      {
        id: member,
        pacienteId: "PROC-1",
        nome: "Nome não confiável",
        seguradoraId: insurer,
        apolice: "POL-1",
        cartao: "CARD-1",
        plano: "Plano teste",
        inicio: "2026-01-01",
        fim: "2099-12-31",
        cobertura: 80,
        activo: true,
        relationship: "dependente",
      },
    ],
  };
  const q = await call("post", "/hospital/records/insurance", "admin", {
    id: A,
    revision: 0,
    data,
  });
  assert.equal(q.status, 200, JSON.stringify(q.body));
  assert.equal(q.body.data.assegurados[0].pacienteId, String(patient));
  assert.equal(q.body.data.assegurados[0].nome, "Paciente teste");
  await call("post", "/hospital/records/insurance", "admin", {
    id: A,
    revision: 0,
    data,
  }).expect(409);
  await call("post", "/hospital/records/insurance", "foreign", {
    id: A,
    revision: 1,
    data,
  }).expect(403);
  await call("post", "/hospital/records/insurance", "admin", {
    id: A,
    revision: 1,
    data: {
      ...data,
      assegurados: [
        { ...data.assegurados[0], pacienteId: String(foreignPatient) },
      ],
    },
  }).expect(400);
  const c = await call("post", "/hospital/insurance/contracts", "admin", {
    id: contract,
    revision: 0,
    insurerId: insurer,
    name: "Tabela teste",
    start: "2026-01-01",
    end: "2099-12-31",
    active: true,
    requiresAuthorization: true,
    rates: [
      {
        code: "CONS-GERAL",
        description: "Consulta geral",
        service: "Medicina geral",
        price: 50000,
        coverage: 100,
        internalCost: 20000,
        maxCovered: null,
      },
    ],
  });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  await call("post", "/hospital/insurance/contracts", "reception", {
    ...c.body,
    revision: 1,
  }).expect(403);
});
test("insured invoice freezes the act, coverage and cost, and prevents invalid or foreign eligibility", async () => {
  const body = invoiceBody();
  let q = await call("post", "/hospital/insurance/quote", "admin", body);
  assert.equal(q.status, 200, JSON.stringify(q.body));
  assert.equal(q.body.insurerAmount, 40000);
  assert.equal(q.body.patientAmount, 10000);
  assert.equal(q.body.internalCost, 20000);
  q = await call("post", "/faturas", "admin", body);
  assert.equal(q.status, 201, JSON.stringify(q.body));
  invoice = q.body.id;
  number = q.body.numero;
  assert.equal(q.body.insuredBalance, 50000);
  assert.equal(q.body.cashReceived, 0);
  const hashOnly = await call("put", "/faturas/" + invoice, "admin", {
    codigoHash: "não-substitui-o-hash",
  });
  assert.equal(hashOnly.status, 200);
  assert.equal(hashOnly.body.insured, true);
  assert.equal(
    (await call("post", "/faturas", "admin", body)).body.id,
    invoice,
  );
  await call("post", "/hospital/insurance/quote", "admin", {
    ...invoiceBody(),
    pacienteId: otherPatient,
  }).expect(409);
  await call("post", "/hospital/insurance/quote", "admin", {
    ...invoiceBody(),
    insurance: { ...selection(), authorization: "" },
  }).expect(400);
  await call("post", "/faturas", "admin", {
    ...invoiceBody(),
    estado: "paga",
    formaPagamento: "Numerário",
  }).expect(409);
  q = await call(
    "get",
    "/hospital/insurance/report?from=2026-10-01&to=2026-10-31",
  );
  assert.equal(q.body.acts[0].custoInterno, 20000);
  assert.equal(q.body.acts[0].responsabilidadeSeguradora, 40000);
  const foreign = await call("get", "/hospital/insurance/report", "foreign");
  assert.deepEqual(foreign.body.claims, []);
  const receptionist = await call(
    "get",
    "/hospital/insurance/report",
    "reception",
  );
  assert.equal(receptionist.body.acts[0].custoInterno, undefined);
  assert.equal(
    receptionist.body.claims[0].snapshot.contract.rates[0].internalCost,
    undefined,
  );
});
test("archived allocations remain readable; the old receipt endpoint cannot bypass native billing", async () => {
  await call("post", "/hospital/insurance/payments", "admin", {
    requestId: randomUUID(),
    invoiceId: invoice,
    partyType: "insurer",
    amount: 25000,
    date: "2026-10-05",
    method: "Transferência",
    reference: "BANCO-1",
  }).expect(409);
  // Existing, already-reconciled bank receipts imported with the archive.
  for (const [party, partyId, amount, date] of [
    ["insurer", insurer, 25000, "2026-10-05"],
    ["insurer", insurer, 15000, "2026-10-06"],
    ["patient", String(patient), 10000, "2026-10-07"],
  ]) {
    await db.query(
      "INSERT INTO nv_receivable_entries(empresa_id,invoice_id,party_type,party_id,occurred_on,kind,credit,reference,actor) VALUES($1,$2,$3,$4,$5,'payment',$6,'REC-ARQUIVO','importacao-verificada')",
      [A, invoice, party, partyId, date, amount],
    );
    await db.query(
      "INSERT INTO movimentos(empresa_id,fatura_id,data,descricao,tipo,valor) VALUES($1,$2,$3,'Recebimento do arquivo','entrada',$4)",
      [A, invoice, date, amount],
    );
  }
  const q = await call("post", "/hospital/insurance/statement", "admin", {
    partyType: "insurer",
    partyId: insurer,
    from: "2026-10-02",
    to: "2026-10-05",
  });
  assert.equal(q.status, 200, q.text);
  assert.equal(q.body.opening, 40000);
  assert.equal(q.body.rows[0].credit, 25000);
  assert.equal(q.body.closing, 15000);
  assert.equal(
    Number(
      (
        await db.query<any>(
          "SELECT sum(valor) AS amount FROM movimentos WHERE empresa_id=$1 AND fatura_id=$2",
          [A, invoice],
        )
      ).rows[0].amount,
    ),
    50000,
  );
});
test("credit notes retain original split, glosas do not silently erase debts, and contract changes cannot rewrite issued acts", async () => {
  let q = await call("post", "/faturas", "admin", invoiceBody());
  assert.equal(q.status, 201);
  secondInvoice = q.body.id;
  const originalNumber = q.body.numero;
  const contractRow = (await call("get", "/hospital/insurance/contracts"))
    .body[0];
  await call("post", "/hospital/insurance/contracts", "admin", {
    ...contractRow,
    rates: [{ ...contractRow.rates[0], coverage: 50, price: 60000 }],
  }).expect(200);
  const body = {
    ...invoiceBody(),
    insurance: undefined,
    tipoDocumento: "nota-credito",
    estado: "emitida",
    clienteNome: "Paciente teste",
    faturaOrigemId: secondInvoice,
    linhas: [
      {
        descricao: "Consulta geral",
        quantidade: -0.5,
        precoUnitario: 50000,
        ivaIsento: true,
        originActIndex: 0,
      },
    ],
    subtotalSemIva: -25000,
    total: -25000,
    observacoes: "Rectificação teste",
  };
  q = await call("post", "/faturas", "admin", body);
  assert.equal(q.status, 201, JSON.stringify(q.body));
  q = await call("get", "/hospital/insurance/report");
  const current = q.body.claims.find((c: any) => c.invoiceId === secondInvoice);
  assert.equal(current.insurerBalance, 20000);
  assert.equal(current.patientBalance, 5000);
  assert.equal(current.snapshot.contract.rates[0].price, 50000);
  assert.equal(current.snapshot.acts[0].coverage, 80);
  await call("post", "/faturas", "admin", {
    ...body,
    requestId: randomUUID(),
    linhas: [{ ...body.linhas[0], quantidade: -0.6 }],
    subtotalSemIva: -30000,
    total: -30000,
  }).expect(409);
  q = await call("post", "/hospital/insurance/disputes", "admin", {
    id: randomUUID(),
    invoiceId: secondInvoice,
    amount: 10000,
    reason: "Recusa em análise",
    status: "open",
  });
  assert.equal(q.status, 200, JSON.stringify(q.body));
  q = await call("post", "/hospital/insurance/statement", "admin", {
    partyType: "insurer",
    partyId: insurer,
    from: "2026-10-01",
    to: "2026-10-31",
  });
  assert.equal(q.body.closing, 20000);
  assert.ok(
    q.body.rows.some((r: any) => r.kind === "credit" && r.credit === 20000),
  );
  await call("post", "/faturas", "admin", {
    ...invoiceBody(),
    insurance: undefined,
    tipoDocumento: "recibo",
    estado: "paga",
    formaPagamento: "Banco",
    faturaOrigemId: secondInvoice,
  }).expect(409);
});
test("financial exports share filters, templates persist with revision checks and reception cannot edit costs", async () => {
  const result = await call("post", "/hospital/insurance/export", "admin", {
    kind: "production",
    format: "xlsx",
    filters: {
      insurerId: insurer,
      patientId: String(patient),
      act: "CONS-GERAL",
      service: "Medicina",
      state: "parcial",
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.claims.length, 0);
  await call("post", "/hospital/insurance/export", "nurse", {
    kind: "production",
    format: "pdf",
    filters: {},
  }).expect(403);
  const data = {
    name: "Modelo acordado em ensaio",
    columns: [
      { key: "paciente", label: "Beneficiário" },
      { key: "responsabilidadeSeguradora", label: "Valor a cobrar" },
    ],
  };
  let q = await call("post", "/hospital/insurance/templates", "admin", {
    insurerId: insurer,
    revision: 0,
    data,
  });
  assert.equal(q.status, 200, JSON.stringify(q.body));
  await call("post", "/hospital/insurance/templates", "admin", {
    insurerId: insurer,
    revision: 0,
    data,
  }).expect(409);
  await call("post", "/hospital/insurance/templates", "admin", {
    insurerId: insurer,
    revision: 1,
    data: { ...data, columns: [{ key: "custoInterno", label: "Não enviar" }] },
  }).expect(400);
});
test("patient accounts include private invoices, partial receipts and legacy cash without attributing documents by name", async () => {
  const body = {
    ...invoiceBody(),
    insurance: undefined,
    linhas: [
      {
        descricao: "Consulta particular",
        quantidade: 1,
        precoUnitario: 12000,
        ivaIsento: true,
      },
    ],
    subtotalSemIva: 12000,
    total: 12000,
  };
  let q = await call("post", "/faturas", "admin", body);
  assert.equal(q.status, 201, JSON.stringify(q.body));
  const id = q.body.id;
  assert.equal(q.body.insured, false);
  assert.equal(q.body.receivableBalance, 12000);
  const p = {
    requestId: randomUUID(),
    invoiceId: id,
    partyType: "patient",
    amount: 5000,
    date: "2026-10-09",
    method: "Numerário",
    reference: "Caixa particular",
  };
  await call("post", "/hospital/insurance/payments", "admin", p).expect(409);
  await archivedPayment(id, "patient", String(patient), 5000, "2026-10-09");
  await call("put", "/faturas/" + id, "admin", {
    estado: "paga",
    formaPagamento: "Numerário",
  }).expect(409);
  await call("put", "/faturas/" + id, "nurse", { estado: "paga" }).expect(403);
  await call("post", "/movimentos", "reception", {
    data: "2026-10-01",
    tipo: "saida",
    valor: 200,
    categoria: "Salários",
  }).expect(403);
  assert.equal(
    Number(
      (
        await db.query<any>(
          "SELECT sum(valor) AS n FROM movimentos WHERE empresa_id=$1 AND fatura_id=$2",
          [A, id],
        )
      ).rows[0].n,
    ),
    5000,
  );
  q = await call("post", "/hospital/insurance/statement", "admin", {
    partyType: "patient",
    partyId: String(patient),
    from: "2026-10-01",
    to: "2026-10-31",
  });
  assert.equal(q.status, 200);
  assert.equal(q.body.closing, 12000);
  assert.equal(
    q.body.rows.find((r: any) => r.invoice_id === id && r.kind === "invoice")
      .invoiceBalance,
    7000,
  );
  await archivedPayment(id, "patient", String(patient), 7000, "2026-10-09");
  await db.query(
    "UPDATE faturas SET estado='paga' WHERE empresa_id=$1 AND id=$2",
    [A, id],
  );
  assert.equal(
    (await db.query<any>("SELECT estado FROM faturas WHERE id=$1", [id]))
      .rows[0].estado,
    "paga",
  );
  const legacy = (
    await db.query<any>(
      "INSERT INTO faturas(empresa_id,numero,data,paciente_id,cliente_nome,total,subtotal_sem_iva,estado,tipo_documento) VALUES($1,'LEG-1','01/09/2026',$2,'Paciente teste',1000,1000,'emitida','factura') RETURNING id",
      [A, patient],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO movimentos(empresa_id,data,descricao,tipo,valor,categoria,fatura_id) VALUES($1,'02/09/2026','Movimento legado confirmado','entrada',400,'Faturação',$2)",
    [A, legacy],
  );
  await db.query(
    "INSERT INTO faturas(empresa_id,numero,data,cliente_nome,total,estado,tipo_documento) VALUES($1,'SEM-ID','01/09/2026','Paciente teste',99999,'emitida','factura')",
    [A],
  );
  q = await call("post", "/hospital/insurance/statement", "admin", {
    partyType: "patient",
    partyId: String(patient),
    from: "2026-10-01",
    to: "2026-10-31",
  });
  assert.equal(q.body.opening, 600);
  assert.equal(q.body.closing, 5600);
  assert.ok(!q.body.rows.some((r: any) => r.reference === "SEM-ID"));
});
test("geographic catalogue is complete and addresses validate ancestry, preserve old free text and stay tenant-scoped", async () => {
  assert.equal(COUNTRY_CODES.length, 249);
  assert.equal(new Set(COUNTRY_CODES).size, 249);
  assert.equal(ANGOLA_GEOGRAPHY.length, 21);
  assert.equal(
    ANGOLA_GEOGRAPHY.reduce((s, p) => s + p.municipalities.length, 0),
    326,
  );
  assert.equal(
    ANGOLA_GEOGRAPHY.reduce(
      (s, p) => s + p.municipalities.reduce((n, m) => n + m.communes.length, 0),
      0,
    ),
    378,
  );
  const geo = emptyPatientGeography(),
    p = ANGOLA_GEOGRAPHY[0],
    m = p.municipalities.find((m) => m.communes.length)!;
  geo.residence = {
    ...geo.residence,
    provinceId: p.id,
    municipalityId: m.id,
    communeId: m.communes[0].id,
    neighbourhood: "Bairro local de ensaio",
  };
  geo.birthplace = { ...geo.birthplace, country: "PT", provinceName: "Lisboa" };
  const admin = { tipo: "particular", cobertura: "0" };
  let q = await call("post", "/hospital/patient-registration", "admin", {
    id: patient,
    patient: { nome: "Paciente teste", endereco: "Morada anterior preservada" },
    administration: admin,
    adminRevision: 0,
    geography: geo,
  });
  assert.equal(q.status, 200, JSON.stringify(q.body));
  q = await call("get", "/hospital/geography/patients/" + patient);
  assert.equal(q.body.data.residence.provinceName, p.name);
  assert.equal(q.body.data.birthplace.country, "PT");
  await call(
    "get",
    "/hospital/geography/patients/" + patient,
    "foreign",
  ).expect(404);
  const bad = {
    ...geo,
    residence: {
      ...geo.residence,
      municipalityId: ANGOLA_GEOGRAPHY[1].municipalities[0].id,
    },
  };
  await call("post", "/hospital/patient-registration", "admin", {
    id: patient,
    patient: { nome: "Não guardar" },
    administration: admin,
    adminRevision: 1,
    geography: bad,
  }).expect(400);
  assert.equal(
    (
      await db.query<any>("SELECT nome,endereco FROM pacientes WHERE id=$1", [
        patient,
      ])
    ).rows[0].nome,
    "Paciente teste",
  );
  q = await call("post", "/hospital/geography/localities", "reception", {
    parentId: m.id,
    name: "Localidade de ensaio",
  });
  assert.equal(q.status, 201, JSON.stringify(q.body));
  const id = q.body.id;
  assert.equal(q.body.status, "pending");
  await call(
    "post",
    "/hospital/geography/localities/" + id + "/approve",
    "reception",
  ).expect(403);
  await call(
    "post",
    "/hospital/geography/localities/" + id + "/approve",
  ).expect(200);
  assert.equal(
    (
      await call(
        "get",
        "/hospital/geography/localities?parent=" + m.id,
        "foreign",
      )
    ).body.length,
    0,
  );
});
test("VAT and discount rounding never produce a negative copayment or accept a forged total", async () => {
  const id = randomUUID();
  await call("post", "/hospital/insurance/contracts", "admin", {
    id,
    revision: 0,
    insurerId: insurer,
    name: "Tabela de arredondamento",
    start: "2026-01-01",
    end: "2099-12-31",
    active: true,
    requiresAuthorization: false,
    rates: [
      {
        code: "SMALL",
        description: "Acto de teste",
        service: "Serviço",
        price: 0.01,
        coverage: 100,
        internalCost: null,
        maxCovered: null,
      },
    ],
  }).expect(200);
  const cat = (await call("get", "/hospital/records/insurance")).body[0];
  cat.data.assegurados[0].cobertura = 100;
  await call("post", "/hospital/records/insurance", "admin", { ...cat }).expect(
    200,
  );
  const lines = Array.from({ length: 20 }, () => ({
    descricao: "Acto de teste",
    quantidade: 1,
    precoUnitario: 0.01,
    ivaIsento: false,
  }));
  const body = {
    ...invoiceBody(),
    linhas: lines,
    subtotalSemIva: 0.2,
    totalIva: 0.03,
    ivaTaxa: 14,
    total: 0.23,
    insurance: {
      ...selection(),
      contractId: id,
      acts: lines.map(() => ({
        code: "SMALL",
        professional: "Autor de teste",
      })),
    },
  };
  const quote = await call("post", "/hospital/insurance/quote", "admin", body);
  assert.equal(quote.status, 200, JSON.stringify(quote.body));
  assert.equal(quote.body.total, 0.23);
  assert.equal(quote.body.patientAmount, 0);
  assert.ok(quote.body.acts.every((a: any) => a.patientAmount >= 0));
  await call("post", "/hospital/insurance/quote", "admin", {
    ...body,
    total: -0.01,
  }).expect(400);
  const invoice = await call("post", "/faturas", "admin", body);
  assert.equal(invoice.status, 201, JSON.stringify(invoice.body));
  assert.equal(Number(invoice.body.total), 0.23);
});
test("an insured credit cannot hide another payer's remaining debt, and competing glosa edits are rejected", async () => {
  const contracts = (await call("get", "/hospital/insurance/contracts")).body;
  const c = contracts.find((c: any) => c.id === contract);
  await call("post", "/hospital/insurance/contracts", "admin", {
    ...c,
    rates: [{ ...c.rates[0], price: 50000, coverage: 100 }],
  }).expect(200);
  const cat = (await call("get", "/hospital/records/insurance")).body[0];
  cat.data.assegurados[0].cobertura = 80;
  await call("post", "/hospital/records/insurance", "admin", cat).expect(200);
  const q = await call("post", "/faturas", "admin", invoiceBody());
  assert.equal(q.status, 201);
  const id = q.body.id;
  await archivedPayment(id, "patient", String(patient), 10000, "2026-10-08");
  const credit = {
    ...invoiceBody(),
    insurance: undefined,
    tipoDocumento: "nota-credito",
    faturaOrigemId: id,
    linhas: [
      {
        descricao: "Consulta geral",
        quantidade: -0.5,
        precoUnitario: 50000,
        ivaIsento: true,
        originActIndex: 0,
      },
    ],
    subtotalSemIva: -25000,
    total: -25000,
  };
  await call("post", "/faturas", "admin", credit).expect(201);
  const report = (await call("get", "/hospital/insurance/report")).body,
    claim = report.claims.find((x: any) => x.invoiceId === id);
  assert.equal(claim.patientBalance, -5000);
  assert.equal(claim.insurerBalance, 20000);
  assert.notEqual(claim.status, "liquidada");
  const dispute = {
    id: randomUUID(),
    invoiceId: id,
    amount: 10000,
    reason: "Revisão de recusa",
    status: "open",
    revision: 0,
  };
  await call("post", "/hospital/insurance/disputes", "admin", dispute).expect(
    200,
  );
  await call("post", "/hospital/insurance/disputes", "admin", dispute).expect(
    409,
  );
  await call("post", "/hospital/insurance/disputes", "admin", {
    ...dispute,
    status: "contested",
    revision: 1,
  }).expect(200);
});

test("manual treasury movements cannot move a native test invoice into the real accounts", async () => {
 const f=(await db.query<any>("INSERT INTO faturas(empresa_id,numero,data,paciente_id,cliente_nome,total,estado,tipo_documento,billing_meta) VALUES($1,'FT TEST-GUARD/1','28/10/2026',$2,'Paciente teste',100,'emitida','factura',$3) RETURNING id",[A,patient,{managed:'nvuala-v1',ambiente:'homologacao'}])).rows[0];
 const before=Number((await db.query<any>('SELECT count(*) AS n FROM movimentos WHERE empresa_id=$1',[A])).rows[0].n);
 await call('post','/movimentos','admin',{faturaId:f.id,data:'28/10/2026',tipo:'entrada',valor:100,categoria:'Faturação'}).expect(409);
 await call('post','/movimentos','foreign',{faturaId:f.id,data:'28/10/2026',tipo:'entrada',valor:100,categoria:'Faturação'}).expect(404);
 assert.equal(Number((await db.query<any>('SELECT count(*) AS n FROM movimentos WHERE empresa_id=$1',[A])).rows[0].n),before);
});

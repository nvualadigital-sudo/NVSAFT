import { createRequire } from "node:module";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  createPublicKey,
  verify,
  randomUUID,
} from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  chmodSync,
  rmSync,
  cpSync,
  symlinkSync,
  statSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createIntegratedBilling } from "../artifacts/api-server/src/routes/billing-integrated";
import {
  canonical,
  jws,
  verifyJws,
  legacySignature,
  publicPem,
} from "../artifacts/api-server/src/lib/agt/crypto";
import {
  loadProducer,
  loadRuntime,
  secureRead,
  publicConfiguration,
} from "../artifacts/api-server/src/lib/agt/runtime";
import {
  registerPayload,
  partialReceiptDiagnostic,
  servicePayload,
  emptyProfile,
  unitPriceForLine,
} from "../artifacts/api-server/src/lib/agt/wire";
import {
  classifyState,
  matchesConsultedDocument,
  hmlRequest,
} from "../artifacts/api-server/src/lib/agt/transport";
import { rejectionEvidence } from "../artifacts/api-server/src/lib/agt/replacement";
import { exportSaft } from "../artifacts/api-server/src/lib/agt/saft";
import {
  totals,
  localStamp,
} from "../artifacts/api-server/src/lib/billing-engine";
import { invoicePreview } from "../artifacts/lab-results/src/modules/faturacao/utils/billingNumbers";
import {
  agtQrExamplePng,
  agtQrPreflight,
} from "../artifacts/lab-results/src/modules/faturacao/utils/agtQr";
import { render as printDocument } from "../artifacts/lab-results/src/modules/faturacao/utils/printTemplate";
const python =
  process.env.AGT_XML_PYTHON ||
  (existsSync(resolve(".agt-python/bin/python"))
    ? resolve(".agt-python/bin/python")
    : "python3");
const pair = (bits: number) =>
  generateKeyPairSync("rsa", {
    modulusLength: bits,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
const fe = pair(2048),
  issuer = pair(2048),
  legacy = pair(1024),
  dir = mkdtempSync(resolve(tmpdir(), "nv-agt-test-"));
const A = "23000000-0000-4000-8000-000000000001",
  B = "23000000-0000-4000-8000-000000000002";
const producer = {
  legalName: "Produtor Fictício de Ensaio",
  nif: "5001111111",
  address: "Morada fictícia de ensaio",
  email: "test@example.invalid",
  phone: "000000000",
  representativeName: "Representante Fictício",
  representativeNif: "000000000LA000",
  productId: "NVUALASOFT-ENSAIO-AUTOMATIZADO",
  productVersion: "2026.10-test",
  softwareValidationNumber: "HML-TEST-FIXTURE-ONLY",
  signatureVersion: 1,
  fePrivateKeyFile: "fe.pem",
  legacyPrivateKeyFile: "legacy.pem",
};
const pg = new PGlite();
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
let calls: any[] = [],
  reply: any = {
    httpStatus: 200,
    body: { requestID: "202600000000001", errorList: [] },
    retrySeconds: 30,
  },
  throwNetwork = false;
const remote = async (op: string, payload: any) => {
  calls.push({ op, payload });
  if (throwNetwork) throw Error("network");
  return structuredClone(reply);
};
const users: any = {
  admin: { role: "empresa", empresaId: A, username: "admin", funcao: "admin" },
  other: { role: "empresa", empresaId: B, username: "other", funcao: "admin" },
  reception: {
    role: "empresa",
    empresaId: A,
    username: "reception",
    funcao: "rececionista",
  },
  tech: { role: "empresa", empresaId: A, username: "tech", funcao: "tecnico" },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).user = users[String(req.headers["x-user"])];
  next();
});
app.use(
  createIntegratedBilling(db, {
    runtime: (company, nif) => ({ ...loadRuntime(company, nif), live: true }),
    request: remote,
  }),
);
const get = (p: string, user = "admin") =>
  request(app).get(p).set("x-user", user);
const post = (p: string, b: any = {}, user = "admin") =>
  request(app)
    .post(p)
    .set("x-user", user)
    .send({ requestId: randomUUID(), ...b });
const profile: any = {
  ...emptyProfile,
  companyId: "MATRICULA-ENSAIO",
  address: "Morada Teste",
  city: "Luanda",
  taxRules: {
    SERV1: { operationType: "SS", taxCode: "NOR", productType: "S" },
  },
  series: {},
};
function doc(extra: any = {}) {
  return {
    tipoDocumento: "factura",
    estado: "emitida",
    clienteNome: "Consumidor Final",
    linhas: [
      {
        codigo: "SERV1",
        descricao: "Serviço de ensaio",
        quantidade: 1,
        precoUnitario: 100,
        ivaIsento: false,
        unidade: "serv",
      },
    ],
    ivaTaxa: 14,
    ...extra,
  };
}
before(async () => {
  process.env.AGT_CONFIG_DIR = dir;
  const write = (n: string, v: any) =>
    writeFileSync(
      resolve(dir, n),
      typeof v === "string" ? v : JSON.stringify(v),
      { mode: 0o600 },
    );
  write("fe.pem", fe.privateKey);
  write("issuer.pem", issuer.privateKey);
  write("legacy.pem", legacy.privateKey);
  write("producer.json", producer);
  write("tenants.json", {
    [A]: {
      nif: "5001234567",
      username: "fixture-hml-user",
      password: "fixture-hml-secret",
      privateKeyFile: "issuer.pem",
    },
  });
  write("runtime.json", {
    hmlEnabled: false,
    dossierCompanyIds: [A],
    signLocalHml: true,
    xmlPython: python,
  });
  // Certification fixture deliberately injected by the test, never a production default.
  const p = { ...producer, softwareValidationNumber: "HML_AUTOMATED_FIXTURE" };
  write("producer.json", p);
  await applyMigrations(pg, "migrations", () => {});
  for (const [id, name, nif] of [
    [A, "Empresa A", "5001234567"],
    [B, "Empresa B", "5007654321"],
  ]) {
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$2,'fixture')",
      [id, name],
    );
    await pg.query(
      "INSERT INTO config(empresa_id,nome_clinica,nif) VALUES($1,$2,$3)",
      [id, name, nif],
    );
  }
});
after(async () => {
  delete process.env.AGT_CONFIG_DIR;
  await pg.close();
  rmSync(dir, { recursive: true, force: true });
});
test("RS256 signs the exact canonical payload with the correct key and rejects tampering", () => {
  const p = {
    productId: "NV Teste",
    productVersion: "1",
    softwareValidationNumber: "X",
    signatureVersion: 1,
  };
  const token = jws(p, fe.privateKey);
  assert.equal(verifyJws(token, p, fe.publicKey), true);
  assert.equal(
    verifyJws(token, { ...p, signatureVersion: 2 }, fe.publicKey),
    false,
  );
  assert.equal(verifyJws(token, p, issuer.publicKey), false);
  assert.deepEqual(
    JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()),
    p,
  );
  assert.throws(() => jws(p, legacy.privateKey), /2048/);
  assert.throws(() => canonical({ invalid: undefined }));
  assert.throws(() => canonical({ invalid: NaN }));
});
test("SAF-T chain signature uses a distinct key, binds the previous hash and fits the XSD", () => {
  const data = {
    date: "2026-10-29",
    entryDate: "2026-10-29T12:34:56",
    number: "FT ENSAIO/1",
    gross: 114,
    previous: "",
  };
  const a = legacySignature(data, legacy.privateKey),
    b = legacySignature(
      { ...data, number: "FT ENSAIO/2", previous: a.hash },
      legacy.privateKey,
    );
  assert.equal(a.hash.length, 172);
  assert.equal(
    verify(
      "RSA-SHA1",
      Buffer.from(a.input),
      legacy.publicKey,
      Buffer.from(a.hash, "base64"),
    ),
    true,
  );
  assert.equal(
    verify(
      "RSA-SHA1",
      Buffer.from(b.input.replace(a.hash, "")),
      legacy.publicKey,
      Buffer.from(b.hash, "base64"),
    ),
    false,
  );
  assert.throws(() => legacySignature(data, fe.privateKey), /1024/);
});
test("private configuration is checked, secrets never appear in public status and default live is off", () => {
  assert.equal(loadRuntime(A, "5001234567").live, false);
  assert.throws(() => loadRuntime(B, "5007654321"));
  assert.throws(() => loadRuntime(A, "5007654321"));
  const s = JSON.stringify(publicConfiguration(A, "5001234567"));
  assert.ok(!s.includes("fixture-hml-secret") && !s.includes("PRIVATE KEY"));
  writeFileSync(resolve(dir, "unsafe.json"), "{}", { mode: 0o644 });
  assert.throws(() => secureRead(resolve(dir, "unsafe.json")), /600/);
});
test("FE 2.0 rounding is explicit and matches the preview without changing legacy results", () => {
  assert.equal(unitPriceForLine(100, 3), 0.3333333334);
  assert.equal(unitPriceForLine(100, 3, true), 0.3333333333);
  const d = doc({
    linhas: [
      {
        codigo: "SERV1",
        descricao: "Fracção",
        quantidade: 0.333333,
        precoUnitario: 1,
        ivaIsento: false,
      },
    ],
    desconto: 0,
  });
  assert.equal(totals(d).total, 0.38);
  assert.equal(totals(d, "agt2").total, 0.38);
  for (let i = 1; i < 60; i++) {
    const x = doc({
      linhas: [
        {
          codigo: "SERV1",
          descricao: "Fracção",
          quantidade: i / 7,
          precoUnitario: Math.round(i * 31.7) / 100,
          ivaIsento: i % 3 === 0,
        },
      ],
      desconto: i % 17,
    });
    x.linhas[0].quantidade = Number(x.linhas[0].quantidade.toFixed(6));
    for (const mode of ["legacy", "agt2"] as const) {
      const a = totals(x, mode),
        b = invoicePreview(x.linhas, 14, x.desconto, 0, mode);
      assert.equal(b.error, "");
      assert.equal(a.total, b.total);
      assert.equal(a.totalIva, b.totalIva);
    }
  }
  const credit = totals(
    {
      ...d,
      tipoDocumento: "nota-credito",
      linhas: d.linhas.map((l: any) => ({ ...l, quantidade: -l.quantidade })),
    },
    "agt2",
  );
  assert.equal(credit.subtotalSemIva, -0.34);
  assert.equal(credit.totalIva, -0.05);
});
test("wire signatures cover totals and anonymous buyer never replaces the issuer or stored patient", () => {
  const rt = loadRuntime(A, "5001234567"),
    computed = totals(doc(), "agt2"),
    row = {
      id: 1,
      empresa_id: A,
      numero: "FT HML2026/1",
      serie: "HML2026",
      data: "29/10/2026",
      tipo_documento: "factura",
      estado: "emitida",
      cliente_nome: "Consumidor Final",
      cliente_nif: "",
      linhas: computed.linhas,
      subtotal_sem_iva: computed.subtotalSemIva,
      total_iva: computed.totalIva,
      total: computed.total,
      iva_taxa: 14,
      emitente_snapshot: { nif: "5001234567" },
      billing_meta: {
        ambiente: "homologacao",
        agtMode: "homologacao_oficial",
        calculoFiscalAGT: true,
        agtProfile: profile,
        createdAt: "2026-10-29T12:00:00Z",
      },
    };
  const body = registerPayload([row], "5001234567", profile, rt, new Map()),
    d = body.documents[0];
  assert.equal(body.taxRegistrationNumber, "5001234567");
  assert.equal(d.customerTaxID, "999999999");
  assert.equal(row.cliente_nif, "");
  assert.equal(body.numberOfEntries, 1);
  assert.match(body.submissionUUID, /^[0-9a-f-]{36}$/);
  assert.equal(body.softwareInfo.softwareInfoDetail.signatureVersion, 1);
  const signed = {
    documentNo: d.documentNo,
    taxRegistrationNumber: body.taxRegistrationNumber,
    documentType: d.documentType,
    documentDate: d.documentDate,
    customerTaxID: d.customerTaxID,
    customerCountry: d.customerCountry,
    companyName: d.companyName,
    documentTotals: d.documentTotals,
  };
  assert.equal(
    verifyJws(d.jwsDocumentSignature, signed, issuer.publicKey),
    true,
  );
  assert.equal(
    verifyJws(
      d.jwsDocumentSignature,
      { ...signed, documentTotals: { ...d.documentTotals, grossTotal: 1 } },
      issuer.publicKey,
    ),
    false,
  );
  assert.throws(() =>
    registerPayload(
      [{ ...row, tipo_documento: "pro-forma" }],
      "5001234567",
      profile,
      rt,
      new Map(),
    ),
  );
  assert.throws(() =>
    registerPayload(
      [
        {
          ...row,
          billing_meta: { ...row.billing_meta, agtMode: "formacao_local" },
        },
      ],
      "5001234567",
      profile,
      rt,
      new Map(),
    ),
  );
  assert.throws(() =>
    servicePayload("listarSeries", {}, "5001234567", {
      ...rt,
      producer: { ...rt.producer, softwareValidationNumber: "PENDENTE_AGT" },
    }),
  );
});
test("all seven service formats and exact state classification reject incomplete or contradictory approval", () => {
  const rt = loadRuntime(A, "5001234567");
  for (const [op, input] of [
    ["obterEstado", { requestID: "202600000000001" }],
    ["consultarFactura", { documentNo: "FT HML2026/1" }],
    [
      "solicitarSerie",
      { documentType: "FT", seriesYear: 2026, establishmentNumber: "1" },
    ],
    ["listarSeries", {}],
    [
      "listarFacturas",
      { queryStartDate: "2026-10-01", queryEndDate: "2026-10-31" },
    ],
    [
      "validarDocumento",
      {
        documentNo: "FT HML2026/1",
        action: "C",
        deductAllVAT: "ND",
      },
    ],
  ] as [string, any][]) {
    const body = servicePayload(op, input, "5001234567", rt);
    assert.ok(body.jwsSignature);
  }
  assert.equal(
    classifyState(
      {
        resultCode: "0",
        documentStatusList: [{ documentNo: "A", documentStatus: "V" }],
      },
      ["A"],
    ),
    "validado",
  );
  assert.equal(classifyState({ resultCode: 8 }, ["A"]), "processando");
  assert.throws(() =>
    classifyState({ resultCode: "", documentStatusList: [] }, []),
  );
  assert.throws(() =>
    classifyState({ resultCode: 0, documentStatusList: [] }, ["A"]),
  );
  assert.throws(() =>
    classifyState(
      {
        resultCode: 0,
        documentStatusList: [{ documentNo: "A", documentStatus: "I" }],
      },
      ["A"],
    ),
  );
});
test("transport cannot activate itself or call production through a crafted operation", async () => {
  const rt = loadRuntime(A, "5001234567");
  await assert.rejects(
    () => hmlRequest("registarFactura", {}, rt),
    /desligado/,
  );
  await assert.rejects(() =>
    hmlRequest("https://sifp.minfin.gov.ao", {}, { ...rt, live: true }),
  );
  assert.equal(calls.length, 0);
});
test("HTTP transport uses only the pinned HML URL, Basic auth and no redirects", async () => {
  const saved = globalThis.fetch;
  let captured: any;
  globalThis.fetch = (async (url: any, init: any) => {
    captured = { url, init };
    return new Response(JSON.stringify({ requestID: "202600000000001" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Retry-After": "45" },
    });
  }) as any;
  try {
    const rt = { ...loadRuntime(A, "5001234567"), live: true };
    const result = await hmlRequest(
      "registarFactura",
      { schemaVersion: "2.0" },
      rt,
    );
    assert.equal(
      captured.url,
      "https://sifphml.minfin.gov.ao/sigt/fe/v1/registarFactura",
    );
    assert.equal(captured.init.redirect, "error");
    assert.equal(
      captured.init.headers.Authorization,
      "Basic " +
        Buffer.from(rt.username + ":" + rt.password).toString("base64"),
    );
    assert.equal(result.retrySeconds, 45);
    assert.equal(result.httpStatus, 200);
  } finally {
    globalThis.fetch = saved;
  }
});
test("AGT access is admin-only and all job lookups are isolated by company", async () => {
  assert.equal((await get("/agt/status", "none")).status, 401);
  assert.equal((await get("/agt/status", "reception")).status, 403);
  assert.equal((await get("/agt/status", "tech")).status, 403);
  const s = await get("/agt/status");
  assert.equal(s.status, 200, s.text);
  assert.equal(s.body.companyId, A);
  assert.equal(s.body.runtime.productionEnabled, false);
  assert.ok(!s.text.includes("fixture-hml-secret"));
  assert.equal(
    (await get("/agt/status", "other")).body.company.nif,
    "5007654321",
  );
});
let invoiceId: number, jobId: string, invoiceNumber: string;
test("series must be confirmed, profile revisions guard edits and numbering is reserved atomically", async () => {
  let s = await get("/agt/status");
  let response = await post("/agt/profile", {
    revision: s.body.revision,
    profile: { ...profile, enabled: true, series: { FT: "FAKE" } },
  });
  assert.equal(response.status, 400);
  const prep = await post("/agt/service", {
    operation: "solicitarSerie",
    input: {
      documentType: "FT",
      seriesYear: localStamp().year,
      establishmentNumber: "1",
    },
  });
  assert.equal(prep.status, 200, prep.text);
  assert.equal(calls.length, 0);
  assert.equal((await post("/agt/jobs/" + prep.body.id + "/send")).status, 400);
  reply = {
    httpStatus: 200,
    body: {
      resultCode: 1,
      seriesFEResult: {
        seriesCode: "HML2026",
        authorizedQuantity: 100,
        firstDocumentNo: "1",
        lastDocumentNo: "100",
      },
    },
    retrySeconds: 30,
  };
  const send = await post("/agt/jobs/" + prep.body.id + "/send", {
    confirmHomologacao: true,
  });
  assert.equal(send.status, 200, send.text);
  profile.series = { FT: "HML2026" };
  profile.enabled = true;
  response = await post("/agt/profile", { revision: s.body.revision, profile });
  assert.equal(response.status, 200, response.text);
  assert.equal(
    (await post("/agt/profile", { revision: s.body.revision, profile })).status,
    400,
  );
  const issued = await post("/documents", { document: doc() }, "reception");
  assert.equal(issued.status, 200, issued.text);
  invoiceId = issued.body.fatura.id;
  invoiceNumber = issued.body.fatura.numero;
  assert.equal(invoiceNumber, "FT HML2026/1");
  assert.equal(issued.body.fatura.agtMode, "homologacao_oficial");
  assert.equal(
    issued.body.fatura.emitenteSnapshot.endereco,
    "Morada Teste, Luanda",
  );
  assert.equal(issued.body.fatura.fiscalSaft.hash.length, 172);
  const second = await post("/documents", { document: doc() });
  assert.equal(second.body.fatura.numero, "FT HML2026/2");
  assert.equal(
    second.body.fatura.fiscalSaft.previousHash,
    issued.body.fatura.fiscalSaft.hash,
  );
  await assert.rejects(
    () => pg.query("UPDATE faturas SET total=1 WHERE id=$1", [invoiceId]),
    /imutável/,
  );
  await pg.query(
    "UPDATE nv_agt_series SET next_no=101 WHERE empresa_id=$1 AND tipo='FT'",
    [A],
  );
  const fail = await post("/documents", { document: doc() });
  assert.equal(fail.status, 400);
  await pg.query(
    "UPDATE nv_agt_series SET next_no=3 WHERE empresa_id=$1 AND tipo='FT'",
    [A],
  );
});
test("frozen idempotent jobs prepare without HTTP; concurrent send performs a single request", async () => {
  const before = calls.length,
    body = { requestId: randomUUID(), invoiceIds: [invoiceId] },
    a = await post("/agt/prepare", body);
  assert.equal(a.status, 200, a.text);
  jobId = a.body.id;
  assert.equal(calls.length, before);
  const b = await post("/agt/prepare", body);
  assert.equal(b.body.id, jobId);
  assert.equal(
    (await post("/agt/prepare", { ...body, invoiceIds: [invoiceId + 1] }))
      .status,
    400,
  );
  assert.equal(
    (await post("/agt/prepare", { invoiceIds: [invoiceId] })).status,
    400,
  );
  assert.equal((await get("/agt/jobs/" + jobId, "other")).status, 400);
  assert.equal(
    (
      await post(
        "/agt/jobs/" + jobId + "/send",
        { confirmHomologacao: true },
        "other",
      )
    ).status,
    400,
  );
  reply = {
    httpStatus: 200,
    body: { requestID: "202600000000001", errorList: [] },
    retrySeconds: 30,
  };
  const sends = await Promise.all([
    post("/agt/jobs/" + jobId + "/send", { confirmHomologacao: true }),
    post("/agt/jobs/" + jobId + "/send", { confirmHomologacao: true }),
  ]);
  assert.deepEqual(sends.map((s) => s.status).sort(), [200, 400]);
  assert.equal(calls.length, before + 1);
  assert.equal((await get("/agt/jobs/" + jobId)).body.status, "recebido");
});
test("polling enforces wait and exact receipt identity before recording validation", async () => {
  assert.equal((await post("/agt/jobs/" + jobId + "/poll")).status, 400);
  const ready = () =>
    pg.query(
      "UPDATE nv_agt_jobs SET next_poll_at=now()-interval '1 second' WHERE id=$1",
      [jobId],
    );
  await ready();
  reply = {
    httpStatus: 200,
    body: {
      requestID: "202600000000001",
      taxRegistrationNumber: "5007654321",
      resultCode: 0,
      documentStatusList: [{ documentNo: invoiceNumber, documentStatus: "V" }],
    },
    retrySeconds: 30,
  };
  assert.equal(
    (await post("/agt/jobs/" + jobId + "/poll")).body.status,
    "recebido",
  );
  await ready();
  reply.body.taxRegistrationNumber = "5001234567";
  reply.body.documentStatusList = [];
  assert.equal(
    (await post("/agt/jobs/" + jobId + "/poll")).body.status,
    "recebido",
  );
  await ready();
  reply = {
    httpStatus: 422,
    body: { idError: "E95", descriptionError: "NIF diferente" },
    retrySeconds: 30,
  };
  assert.equal(
    (await post("/agt/jobs/" + jobId + "/poll")).body.status,
    "recebido",
  );
  await ready();
  reply = {
    httpStatus: 200,
    body: {
      requestID: "202600000000001",
      taxRegistrationNumber: "5001234567",
      resultCode: 0,
      documentStatusList: [
        { documentNo: invoiceNumber, documentStatus: "V", errorList: [] },
      ],
    },
    retrySeconds: 30,
  };
  const poll = await post("/agt/jobs/" + jobId + "/poll");
  assert.equal(poll.body.status, "validado", poll.text);
});
test("uncertain sends never repeat; reconciliation needs the exact signed document", async () => {
  const issued = await post("/documents", { document: doc() });
  const prepared = await post("/agt/prepare", {
    invoiceIds: [issued.body.fatura.id],
  });
  assert.equal(prepared.status, 200, prepared.text);
  const id = prepared.body.id;
  throwNetwork = true;
  const sent = await post("/agt/jobs/" + id + "/send", {
    confirmHomologacao: true,
  });
  throwNetwork = false;
  assert.equal(sent.body.status, "envio_incerto");
  const count = calls.length;
  assert.equal(
    (await post("/agt/jobs/" + id + "/send", { confirmHomologacao: true }))
      .status,
    400,
  );
  assert.equal(calls.length, count);
  assert.equal((await post("/agt/jobs/" + id + "/cancel")).status, 400);
  const d = prepared.body.payload.documents[0];
  await pg.query(
    "UPDATE nv_agt_jobs SET next_poll_at=now()-interval '1 second' WHERE id=$1",
    [id],
  );
  reply = {
    httpStatus: 200,
    body: {
      documentNo: d.documentNo,
      documentStatus: "V",
      document: { ...d, jwsDocumentSignature: "wrong" },
      errorList: [],
    },
    retrySeconds: 30,
  };
  assert.equal(
    (await post("/agt/jobs/" + id + "/reconcile")).body.status,
    "envio_incerto",
  );
  await pg.query(
    "UPDATE nv_agt_jobs SET next_poll_at=now()-interval '1 second' WHERE id=$1",
    [id],
  );
  reply.body = {
    documentNo: d.documentNo,
    validationStatus: "V",
    documents: [d],
    customerAcceptance: "N",
    taxRegistrationNumber: "5001234567",
  };
  assert.equal(
    (await post("/agt/jobs/" + id + "/reconcile")).body.status,
    "validado",
  );
});
test("unsubmitted preparations can be cancelled without deleting audit evidence", async () => {
  const p = await post("/agt/service", { operation: "listarSeries" });
  assert.equal(p.body.status, "preparado");
  const cancel = await post("/agt/jobs/" + p.body.id + "/cancel");
  assert.equal(cancel.body.status, "cancelado");
  assert.equal(
    (
      await post("/agt/jobs/" + p.body.id + "/send", {
        confirmHomologacao: true,
      })
    ).status,
    400,
  );
  const events = await pg.query(
    "SELECT action FROM nv_agt_events WHERE job_id=$1",
    [p.body.id],
  );
  assert.ok(events.rows.some((e: any) => e.action === "cancel.unsubmitted"));
});
test("finalized proformas are frozen and exported as WorkingDocuments, not sales", async () => {
  const issued = await post("/documents", {
    document: doc({ tipoDocumento: "pro-forma", finalizarProforma: true }),
  });
  assert.equal(issued.status, 200, issued.text);
  const f = issued.body.fatura;
  assert.equal(f.proformaFinalizada, true);
  assert.equal(
    (
      await post("/documents/" + f.id, {
        document: doc({ tipoDocumento: "pro-forma" }),
      })
    ).status,
    400,
  );
  await assert.rejects(
    () => pg.query("DELETE FROM faturas WHERE id=$1", [f.id]),
    /imutável/,
  );
  const out = await post("/agt/saft", {
    startDate: localStamp().iso.slice(0, 4) + "-01-01",
    endDate: localStamp().iso,
  });
  assert.equal(out.status, 200, out.text);
  assert.equal(out.body.validation.valid, true);
  assert.match(out.body.xml, /<WorkingDocuments>/);
  assert.match(out.body.xml, /<WorkType>PF<\/WorkType>/);
  assert.ok(!out.body.xml.includes("PRIVATE KEY"));
  assert.equal(
    (
      await post(
        "/agt/saft",
        { startDate: "2026-01-01", endDate: "2026-12-31" },
        "other",
      )
    ).status,
    400,
  );
});
test("SAF-T XSD validation rejects malformed XML, external entities and untrusted hash lengths", () => {
  const run = (xml: string) =>
    spawnSync(python, ["scripts/agt/validate_xml.py"], {
      input: xml,
      encoding: "utf8",
    });
  assert.equal(
    run('<!DOCTYPE x [<!ENTITY s SYSTEM "file:///etc/passwd">]><x>&s;</x>')
      .status,
    2,
  );
  assert.equal(run("<AuditFile/>").status, 2);
  const d: any = {
    empresa_id: A,
    id: 99,
    numero: "FT TEST2026/99",
    serie: "TEST2026",
    data: "29/10/2026",
    estado: "emitida",
    tipo_documento: "factura",
    cliente_nome: "Nome & <Teste>",
    cliente_nif: "",
    emitido_por: "operador",
    linhas: totals(doc()).linhas,
    subtotal_sem_iva: 100,
    total_iva: 14,
    total: 114,
    iva_taxa: 14,
    billing_meta: {
      ambiente: "homologacao",
      createdAt: "2026-10-29T12:00:00Z",
    },
  };
  const output = exportSaft(
    [d],
    { nif: "5001234567", name: "Empresa & Teste" },
    profile,
    loadProducer(),
    "2026-10-01",
    "2026-10-31",
  );
  assert.equal(run(output.xml).status, 0);
  assert.match(output.xml, /Nome &amp; &lt;Teste&gt;/);
  assert.ok(output.warnings.some((w) => w.includes("Hash=0")));
  d.billing_meta.fiscalSaft = {
    hash: "a".repeat(64),
    keyVersion: 1,
    entryDate: "2026-10-29T12:00:00",
  };
  assert.throws(
    () =>
      exportSaft(
        [d],
        { nif: "5001234567", name: "Empresa" },
        profile,
        loadProducer(),
        "2026-10-01",
        "2026-10-31",
      ),
    /Assinatura/,
  );
});
test("SAF-T keeps sales, credit notes, proformas and allocated receipts in their proper sections", () => {
  const base: any = {
    empresa_id: A,
    id: 301,
    numero: "FT TEST2026/301",
    serie: "TEST2026",
    data: "29/10/2026",
    estado: "emitida",
    tipo_documento: "factura",
    cliente_nome: "Consumidor Final",
    cliente_nif: "",
    emitido_por: "operador",
    linhas: totals(doc()).linhas,
    subtotal_sem_iva: 100,
    total_iva: 14,
    total: 114,
    iva_taxa: 14,
    billing_meta: {
      ambiente: "homologacao",
      createdAt: "2026-10-29T12:00:00Z",
    },
  };
  const all = [
    base,
    {
      ...structuredClone(base),
      id: 302,
      numero: "FR TEST2026/302",
      tipo_documento: "factura-recibo",
      estado: "paga",
    },
    {
      ...structuredClone(base),
      id: 303,
      numero: "FG TEST2026/303",
      tipo_documento: "factura-global",
    },
    {
      ...structuredClone(base),
      id: 304,
      numero: "NC TEST2026/304",
      tipo_documento: "nota-credito",
      subtotal_sem_iva: -100,
      total_iva: -14,
      total: -114,
      linhas: base.linhas.map((l: any) => ({
        ...l,
        quantidade: -1,
        baseLiquida: -100,
        ivaValor: -14,
      })),
      billing_meta: {
        ...base.billing_meta,
        documentoOrigem: base.numero,
        motivoAnulacaoOuCredito: "Devolução",
      },
    },
    {
      ...structuredClone(base),
      id: 305,
      numero: "PF TEST2026/305",
      tipo_documento: "pro-forma",
      estado: "rascunho",
      billing_meta: { ...base.billing_meta, proformaFinalizada: true },
    },
    {
      ...structuredClone(base),
      id: 306,
      numero: "RC TEST2026/306",
      tipo_documento: "recibo",
      subtotal_sem_iva: 57,
      total_iva: 0,
      total: 57,
      billing_meta: {
        ...base.billing_meta,
        documentoOrigem: base.numero,
        fiscalReceipt: { netTotal: 50, taxPayable: 7, grossTotal: 57 },
      },
    },
  ];
  const r = exportSaft(
    all,
    { nif: "5001234567", name: "Empresa de Ensaio" },
    profile,
    loadProducer(),
    "2026-10-01",
    "2026-10-31",
  );
  const checked = spawnSync(python, ["scripts/agt/validate_xml.py"], {
    input: r.xml,
    encoding: "utf8",
  });
  assert.equal(checked.status, 0, checked.stdout);
  assert.match(r.xml, /<PaymentType>RC<\/PaymentType>/);
  assert.match(r.xml, /<DebitAmount>100.00<\/DebitAmount>/);
  assert.match(r.xml, /<CreditAmount>50.00<\/CreditAmount>/);
  assert.equal(r.count, 6);
  const f: any = {
    id: 304,
    numero: "NC TEST2026/304",
    tipoDocumento: "nota-credito",
    estado: "emitida",
    data: "29/10/2026",
    dataVencimento: "29/10/2026",
    clienteNome: "Consumidor Final",
    linhas: all[3].linhas,
    subtotalSemIva: -100,
    totalIva: -14,
    total: -114,
    ivaTaxa: 14,
    ambiente: "homologacao",
    agtStatus: "validado",
    agtRequestId: "202600000000001",
    observacoes: "",
    fiscalSaft: {
      hash: legacySignature(
        {
          date: "2026-10-29",
          entryDate: "2026-10-29T12:00:00",
          number: "NC TEST2026/304",
          gross: 114,
          previous: "",
        },
        legacy.privateKey,
      ).hash,
      keyVersion: 1,
    },
  };
  const html = printDocument(
    f,
    { nomeClinica: "Empresa Teste", nif: "5001234567" } as any,
    "a4",
    "ORIGINAL",
  );
  assert.match(html, /Validado no ambiente de homologação/);
  assert.ok(!html.includes("Este ensaio não foi submetido"));
  assert.match(html, /29-10-2026/);
  assert.ok(!html.includes(">-1<"));
  assert.match(html, /Assinatura SAF-T de ensaio/);
});
test("QR preflight exposes the published version-capacity conflict without inventing a fiscal QR", () => {
  const r = agtQrPreflight("5001234567", "FT HML2026/1");
  assert.match(r.encodedURL, /FT%20HML2026%2F1$/);
  assert.equal(r.fixedVersionMatches, false);
  assert.ok(r.suggestedVersion > 4);
  assert.equal(r.approved, false);
  assert.ok(!r.encodedURL.includes("patient"));
});
test("setup generates private keys locally, protects existing keys and exports only public dossier files", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "nv-agt-setup-")),
    originalDir = process.env.AGT_CONFIG_DIR;
  try {
    mkdirSync(resolve(fixture, "scripts/agt"), { recursive: true });
    mkdirSync(resolve(fixture, "artifacts/api-server/src/lib/agt"), {
      recursive: true,
    });
    for (const n of ["configurar.mjs", "verificar.mjs", "dossier.mjs"])
      cpSync(resolve("scripts/agt", n), resolve(fixture, "scripts/agt", n));
    for (const n of ["runtime.ts", "crypto.ts"])
      cpSync(
        resolve("artifacts/api-server/src/lib/agt", n),
        resolve(fixture, "artifacts/api-server/src/lib/agt", n),
      );
    writeFileSync(resolve(fixture, "package.json"), '{"type":"module"}');
    writeFileSync(resolve(fixture, "pnpm-workspace.yaml"), "packages: []\n");
    writeFileSync(resolve(fixture, ".env"), "ENV_EXAMPLE=preservar\n");
    symlinkSync(
      resolve("node_modules"),
      resolve(fixture, "node_modules"),
      "dir",
    );
    writeFileSync(
      resolve(fixture, "dados.json"),
      JSON.stringify({
        ...producer,
        softwareValidationNumber: "",
        legalName: "Produtor <Ensaio> & Teste",
      }),
      { mode: 0o600 },
    );
    const env = {
      ...process.env,
      AGT_CONFIG_DIR: resolve(fixture, ".agt"),
      AGT_PROJECT_ROOT: fixture,
      AGT_XML_PYTHON: python,
    };
    const run = (args: string[]) =>
      spawnSync("node", args, {
        cwd: fixture,
        env,
        encoding: "utf8",
        timeout: 30000,
      });
    let s = run(["scripts/agt/configurar.mjs", "--from", "dados.json"]);
    assert.equal(s.status, 0, s.stderr);
    const key = readFileSync(
      resolve(fixture, ".agt/keys/produtor-fe-v1.pem"),
      "utf8",
    );
    assert.equal(
      createPublicKey(key).asymmetricKeyDetails?.modulusLength,
      4096,
    );
    assert.equal(
      statSync(resolve(fixture, ".agt/keys/produtor-fe-v1.pem")).mode & 0o077,
      0,
    );
    assert.equal(
      readFileSync(resolve(fixture, ".env"), "utf8"),
      "ENV_EXAMPLE=preservar\n",
    );
    assert.notEqual(
      run(["scripts/agt/configurar.mjs", "--from", "dados.json"]).status,
      0,
    );
    assert.equal(
      readFileSync(resolve(fixture, ".agt/keys/produtor-fe-v1.pem"), "utf8"),
      key,
    );
    assert.equal(
      run(["--import", "tsx", "scripts/agt/verificar.mjs"]).status,
      0,
    );
    s = run(["--import", "tsx", "scripts/agt/dossier.mjs"]);
    assert.equal(s.status, 0, s.stderr);
    for (const n of readdirSync(resolve(fixture, "agt-export")))
      assert.ok(
        !readFileSync(resolve(fixture, "agt-export", n), "utf8").includes(
          "PRIVATE KEY",
        ),
      );
    assert.match(
      readFileSync(
        resolve(fixture, "agt-export/REQUERIMENTO_AGT_MINUTA.html"),
        "utf8",
      ),
      /Produtor &lt;Ensaio&gt; &amp; Teste/,
    );
    writeFileSync(resolve(fixture, "issuer.pem"), issuer.privateKey, {
      mode: 0o600,
    });
    writeFileSync(
      resolve(fixture, "tenant.json"),
      JSON.stringify({
        companyId: A,
        nif: "5001234567",
        username: "user-fixture",
        password: "secret-fixture",
        privateKeyFile: resolve(fixture, "issuer.pem"),
      }),
      { mode: 0o600 },
    );
    s = run(["scripts/agt/configurar.mjs", "--tenant", "tenant.json"]);
    assert.equal(s.status, 0, s.stderr);
    assert.ok(!s.stdout.includes("secret-fixture"));
    assert.equal(
      JSON.parse(readFileSync(resolve(fixture, ".agt/runtime.json"), "utf8"))
        .hmlEnabled,
      false,
    );
    assert.notEqual(
      run(["scripts/agt/configurar.mjs", "--enable-hml"]).status,
      0,
    );
  } finally {
    if (originalDir) process.env.AGT_CONFIG_DIR = originalDir;
    else delete process.env.AGT_CONFIG_DIR;
    rmSync(fixture, { recursive: true, force: true });
  }
});
test("prepared payloads and audit events cannot be rewritten; producer dossier belongs only to its owner", async () => {
  const before = await get("/agt/jobs/" + jobId);
  assert.equal(before.status, 200, before.text);
  assert.ok(
    before.body.events.some(
      (e: any) =>
        e.action === "send.result" &&
        e.data.response.body.requestID === "202600000000001",
    ),
  );
  await assert.rejects(
    () =>
      pg.query("UPDATE nv_agt_jobs SET payload='{}'::jsonb WHERE id=$1", [
        jobId,
      ]),
    /imutável/,
  );
  await assert.rejects(
    () => pg.query("DELETE FROM nv_agt_jobs WHERE id=$1", [jobId]),
    /imutável/,
  );
  await assert.rejects(
    () =>
      pg.query("UPDATE nv_agt_events SET data='{}'::jsonb WHERE job_id=$1", [
        jobId,
      ]),
    /imutável/,
  );
  const owner = await get("/agt/modelo8");
  assert.equal(owner.status, 200, owner.text);
  assert.ok(!owner.text.includes("PRIVATE KEY"));
  assert.equal(
    owner.body.producer.representativeName,
    "Representante Fictício",
  );
  assert.equal((await get("/agt/modelo8", "other")).status, 403);
  const state = await get("/agt/status"),
    body = {
      requestId: randomUUID(),
      revision: state.body.revision,
      profile: state.body.profile,
    };
  assert.equal((await post("/agt/profile", body)).status, 200);
  assert.equal((await post("/agt/profile", body)).status, 200);
  assert.equal((await get("/agt/status")).body.revision, body.revision + 1);
});
test("malformed private credential JSON does not expose its contents through an API error", async () => {
  const file = resolve(dir, "tenants.json"),
    original = readFileSync(file, "utf8"),
    secret = "sensitive-credential-fixture-never-return";
  try {
    writeFileSync(file, '{"password":"' + secret, { mode: 0o600 });
    const r = await post("/agt/service", { operation: "listarSeries" });
    assert.equal(r.status, 400);
    assert.ok(!r.text.includes(secret));
    assert.match(r.body.error, /JSON inválido/);
  } finally {
    writeFileSync(file, original, { mode: 0o600 });
  }
});

test("confirmed rejection creates one corrected FT, with one patient balance and no fiscal send", async () => {
  const patient = (
    await pg.query<{ id: number }>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Paciente fictício da substituição') RETURNING id",
      [A],
    )
  ).rows[0].id;
  const issued = await post("/documents", {
    document: doc({
      pacienteId: patient,
      clienteNome: "Nome de ensaio anterior",
      agtCorrection: { invoiceId: 1, documentNo: "FT FORGED/1" },
    }),
  });
  assert.equal(issued.status, 200, issued.text);
  const f = issued.body.fatura;
  assert.equal(f.agtCorrection, undefined);
  const cmd = {
    invoiceId: f.id,
    reason: "Corrigir a identificação do adquirente",
    customerName: "Nome corrigido do ensaio",
    customerNif: "5001234567",
    customerAddress: "Luanda",
    confirmHomologacao: true,
    requestId: randomUUID(),
  };
  assert.equal((await post("/agt/corrections", cmd)).status, 400);
  const p = await post("/agt/prepare", { invoiceIds: [f.id] });
  assert.equal(p.status, 200, p.text);
  const url = "/agt/jobs/" + p.body.id;
  reply = { httpStatus: 200, body: "202600000000090", retrySeconds: 30 };
  const sent = await post(url + "/send", { confirmHomologacao: true });
  assert.equal(sent.body.status, "recebido", sent.text);
  await pg.query(
    "UPDATE nv_agt_jobs SET next_poll_at=now()-interval '1 second' WHERE id=$1",
    [p.body.id],
  );
  reply = {
    httpStatus: 200,
    retrySeconds: 30,
    body: {
      requestID: sent.body.requestID,
      taxRegistrationNumber: "5001234567",
      resultCode: 2,
      documentStatusList: [
        {
          documentNo: f.numero,
          documentStatus: "I",
          errorList: [
            {
              idError: "E20",
              descriptionError: "Adquirente inválido (fixture)",
            },
          ],
        },
      ],
    },
  };
  assert.equal((await post(url + "/poll")).body.status, "rejeitado");
  const beforeCorrection = calls.length;
  assert.equal((await post("/agt/corrections", cmd, "other")).status, 400);
  assert.equal((await post("/agt/corrections", cmd, "reception")).status, 403);
  assert.equal(
    (await post("/agt/corrections", { ...cmd, confirmHomologacao: false }))
      .status,
    400,
  );
  const fixed = await post("/agt/corrections", cmd);
  assert.equal(fixed.status, 200, fixed.text);
  const n = fixed.body.fatura;
  assert.notEqual(n.numero, f.numero);
  assert.equal(n.clienteNome, cmd.customerName);
  assert.equal(n.agtCorrection.documentNo, f.numero);
  assert.equal(n.total, f.total);
  assert.equal((await post("/agt/corrections", cmd)).body.fatura.id, n.id);
  assert.equal(
    (await post("/agt/corrections", { ...cmd, requestId: randomUUID() }))
      .status,
    400,
  );
  assert.equal(
    (await post("/documents/" + f.id, { document: { estado: "paga" } })).status,
    400,
  );
  assert.equal(calls.length, beforeCorrection);

  const rows = await pg.query<any>(
    "SELECT invoice_id,kind,debit,credit,details FROM nv_receivable_entries WHERE empresa_id=$1 AND party_id=$2 ORDER BY id",
    [A, String(patient)],
  );
  assert.equal(rows.rows.length, 3);
  assert.equal(
    rows.rows.reduce((sum, x) => sum + Number(x.debit) - Number(x.credit), 0),
    f.total,
  );
  assert.equal(
    rows.rows.find((x) => x.kind === "credit").details.adjustment,
    "agt_replacement",
  );
  const cash = await pg.query(
    "SELECT 1 FROM nv_cash_entries WHERE empresa_id=$1 AND invoice_id=ANY($2::integer[])",
    [A, [f.id, n.id]],
  );
  assert.equal(cash.rows.length, 0);
  await assert.rejects(() =>
    pg.query(
      "DELETE FROM nv_agt_replacements WHERE empresa_id=$1 AND original_id=$2",
      [A, f.id],
    ),
  );
  const state = (await get("/state")).body.faturas.find(
    (x: any) => x.id === f.id,
  );
  assert.equal(state.agtStatus, "substituida");
  assert.equal(state.agtReplacementNo, n.numero);
  assert.equal(state.estado, "emitida");
  const printed = await post("/documents/" + f.id + "/print", { format: "a4" });
  assert.equal(printed.body.fatura.agtReplacementNo, n.numero);
  assert.ok(
    printDocument(
      printed.body.fatura,
      { nomeClinica: "Clínica" } as any,
      "a4",
      "ORIGINAL",
    ).includes("Substituída por: " + n.numero),
  );
  assert.equal(
    (await post("/agt/prepare", { invoiceIds: [f.id] })).status,
    400,
  );
  const correction = await post("/agt/prepare", { invoiceIds: [n.id] });
  assert.equal(correction.status, 200, correction.text);
  const wire = correction.body.payload.documents[0];
  assert.equal(wire.documentNo, n.numero);
  assert.equal(wire.documentStatus, "C");
  assert.equal(wire.rejectedDocumentNo, f.numero);
  assert.equal(
    (
      await post("/agt/saft", {
        startDate: localStamp().iso,
        endDate: localStamp().iso,
      })
    ).status,
    400,
  );
});

test("AGT consultation rejects penalties, multiple versions and mismatched signed details", () => {
  const d = {
    documentNo: "FT HML2026/1",
    documentStatus: "N",
    documentType: "FT",
    documentDate: "2026-11-03",
    customerTaxID: "999999999",
    customerCountry: "AO",
    companyName: "Consumidor Final",
    documentTotals: { netTotal: 100, taxPayable: 14, grossTotal: 114 },
    jwsDocumentSignature: "signed.example.fixture",
  };
  const body = {
    documentNo: d.documentNo,
    validationStatus: "V",
    documents: [d],
    taxRegistrationNumber: "5001234567",
  };
  const match = (b: any) =>
    matchesConsultedDocument(
      { httpStatus: 200, body: b, retrySeconds: 30 },
      d,
      "5001234567",
    );
  assert.ok(match(body));
  assert.ok(
    match({
      documentNo: d.documentNo,
      documentStatus: "V",
      document: JSON.stringify(d),
    }),
  );
  assert.ok(!match({ ...body, validationStatus: "P" }));
  assert.ok(!match({ ...body, taxRegistrationNumber: "5001234568" }));
  assert.ok(!match({ ...body, documents: [d, { ...d, documentStatus: "A" }] }));
  assert.ok(
    !match({
      ...body,
      documents: [
        { ...d, documentTotals: { ...d.documentTotals, grossTotal: 115 } },
      ],
    }),
  );
  assert.ok(
    !match({ ...body, documents: [{ ...d, jwsDocumentSignature: "other" }] }),
  );
  assert.ok(!match({ ...body, documentStatus: "V", document: d }));
});
test("duplicate or inconclusive AGT errors cannot authorize a replacement", () => {
  const docNo = "FT HML2026/1",
    nif = "5001234567",
    id = "202600000000090";
  const row = { id: 1, numero: docNo, emitente_snapshot: { nif } };
  const job = (code: string, overrides: any = {}) => ({
    id: "job",
    operation: "registarFactura",
    status: "rejeitado",
    invoice_ids: [1],
    agt_request_id: id,
    payload: { taxRegistrationNumber: nif, documents: [{ documentNo: docNo }] },
    response: {
      httpStatus: 200,
      body: {
        requestID: id,
        taxRegistrationNumber: nif,
        resultCode: 2,
        documentStatusList: [
          {
            documentNo: docNo,
            documentStatus: "I",
            errorList: [{ idError: code }],
          },
        ],
        ...overrides,
      },
    },
  });
  assert.ok(rejectionEvidence(row, [job("E20")]));
  for (const code of ["E09", "E46", "E41", ""])
    assert.equal(rejectionEvidence(row, [job(code)]), null);
  assert.equal(
    rejectionEvidence(row, [job("E20", { successRequestID: id })]),
    null,
  );
  assert.equal(
    rejectionEvidence(row, [
      job("E20", { taxRegistrationNumber: "5001234568" }),
    ]),
    null,
  );
  assert.equal(
    rejectionEvidence(row, [
      job("E20", {
        documentStatusList: [{ documentNo: docNo, documentStatus: "I" }],
      }),
    ]),
    null,
  );
});
test("receipt diagnostic isolates the local allocation and rejects another company's invoice", () => {
  const mode = "homologacao_oficial";
  const origin = {
    empresa_id: A,
    numero: "FT HML2026/1",
    total: "114",
    subtotal_sem_iva: "100",
    total_iva: "14",
    billing_meta: { agtMode: mode },
  };
  const receipt = {
    empresa_id: A,
    tipo_documento: "recibo",
    estado: "paga",
    numero: "RG HML2026/1",
    total: "57",
    billing_meta: {
      agtMode: mode,
      documentoOrigem: origin.numero,
      fiscalReceipt: {
        originNo: origin.numero,
        allocation: "proporcional-centimos",
        grossTotal: 57,
        netTotal: 50,
        taxPayable: 7,
      },
    },
  };
  const report = partialReceiptDiagnostic(receipt, origin);
  assert.equal(report.transmissivel, false);
  assert.equal(report.assinado, false);
  assert.equal(report.totaisOriginais.grossTotal, 114);
  assert.equal(report.reparticaoLocalDoRecebimento.grossTotal, 57);
  assert.throws(() =>
    partialReceiptDiagnostic(receipt, { ...origin, empresa_id: B }),
  );
  assert.throws(() =>
    partialReceiptDiagnostic({ ...receipt, total: "58" }, origin),
  );
});
test("diagnostic PNG is 350px and decodes back to the published query URL", async () => {
  const requireWeb = createRequire(
    resolve("artifacts/lab-results/package.json"),
  );
  const { PNG } = createRequire(requireWeb.resolve("qrcode"))("pngjs");
  const decode = requireWeb("jsqr");
  const report = await agtQrExamplePng("5001234567", "FT HML2026/1");
  const png = PNG.sync.read(
    Buffer.from(report.dataUrl.split(",")[1], "base64"),
  );
  assert.equal(png.width, 350);
  assert.equal(png.height, 350);
  assert.equal(report.approved, false);
  assert.match(report.notice, /não fiscal/);
  const decoded = decode(
    new Uint8ClampedArray(png.data),
    png.width,
    png.height,
  );
  assert.equal(decoded?.data, report.encodedURL);
});

test("native partial receipt can be printed and diagnosed but cannot enter the FE queue", async () => {
  const p = await post("/agt/service", {
    operation: "solicitarSerie",
    input: {
      documentType: "RG",
      seriesYear: localStamp().year,
      establishmentNumber: "1",
    },
  });
  assert.equal(p.status, 200, p.text);
  reply = {
    httpStatus: 200,
    retrySeconds: 30,
    body: {
      resultCode: 1,
      seriesFEResult: {
        seriesCode: "HMLRG",
        authorizedQuantity: 100,
        firstDocumentNo: "1",
        lastDocumentNo: "100",
      },
    },
  };
  const s = await post("/agt/jobs/" + p.body.id + "/send", {
    confirmHomologacao: true,
  });
  assert.equal(s.status, 200, s.text);
  const cfg = (await get("/agt/status")).body;
  const configured = await post("/agt/profile", {
    revision: cfg.revision,
    profile: {
      ...cfg.profile,
      series: { ...cfg.profile.series, RG: "HMLRG" },
    },
  });
  assert.equal(configured.status, 200, configured.text);
  const patient = (
    await pg.query<{ id: number }>(
      "INSERT INTO pacientes(empresa_id,nome) VALUES($1,'Paciente fictício RG') RETURNING id",
      [A],
    )
  ).rows[0].id;
  const issued = await post("/documents", {
    document: doc({ clienteNome: "Paciente fictício RG", pacienteId: patient }),
  });
  assert.equal(issued.status, 200, issued.text);
  const cash = await post("/cash/open", { fundoInicial: 0, terminal: "HML" });
  assert.equal(cash.status, 200, cash.text);
  const partial = await post("/insurance/payments", {
    invoiceId: issued.body.fatura.id,
    partyType: "patient",
    amount: 57,
    method: "Numerário",
  });
  assert.equal(partial.status, 200, partial.text);
  const { receiptId } = partial.body;
  const before = calls.length;
  const evidence = await post("/agt/partial-receipt-preview", {
    invoiceId: receiptId,
  });
  assert.equal(evidence.status, 200, evidence.text);
  assert.equal(evidence.body.transmissivel, false);
  assert.equal(evidence.body.reparticaoLocalDoRecebimento.grossTotal, 57);
  assert.equal(
    (
      await post(
        "/agt/partial-receipt-preview",
        { invoiceId: receiptId },
        "other",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/agt/partial-receipt-preview",
        { invoiceId: receiptId },
        "reception",
      )
    ).status,
    403,
  );
  assert.equal(
    (await post("/documents/" + receiptId + "/print", { format: "a4" })).status,
    200,
  );
  const denied = await post("/agt/prepare", { invoiceIds: [receiptId] });
  assert.equal(denied.status, 400);
  assert.match(denied.body.error, /recibos parciais/);
  assert.equal(calls.length, before);
});

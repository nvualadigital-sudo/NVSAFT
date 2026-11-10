import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createAssistantAgentRouter, interpretAgentCommand } from "../artifacts/api-server/src/routes/assistant-agent";

const pg = new PGlite();
const pool: any = {
  query: (sql: string, args?: unknown[]) => pg.query(sql, args),
  connect: async () => ({ query: (sql: string, args?: unknown[]) => pg.query(sql, args), release() {} }),
};
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const users: Record<string, any> = {
  alice: { role: "empresa", empresaId: A, empresaNome: "Clínica A", username: "alice", funcionarioNome: "Alice" },
  bob: { role: "empresa", empresaId: A, username: "bob" },
  outsider: { role: "empresa", empresaId: B, username: "outsider" },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as any).user = users[String(req.headers["x-test-user"])]; next(); });
app.use("/ai", createAssistantAgentRouter(pool));
const as = (who: string) => ({
  get: (url: string) => request(app).get("/ai" + url).set("x-test-user", who),
  post: (url: string) => request(app).post("/ai" + url).set("x-test-user", who),
});

before(async () => {
  await applyMigrations(pg, "migrations", () => {});
  await pg.query("INSERT INTO public.empresas(id,nome,username,password) VALUES($1,'Clínica A','alice','test'),($2,'Clínica B','outsider','test')", [A, B]);
});
after(async () => { await pg.close(); });

test("NV-ASSISTENTE reconhece apenas comandos admitidos e não inventa operações", () => {
  assert.deepEqual(interpretAgentCommand("abre laboratório")?.kind, "navigate");
  assert.equal((interpretAgentCommand("abrir farmácia") as any)?.module, "farmacia");
  assert.equal((interpretAgentCommand("mostra MedLink") as any)?.module, "medlink");
  assert.equal((interpretAgentCommand("abrir faturação") as any)?.module, "faturacao");
  assert.equal((interpretAgentCommand("enviar mensagem para a equipa: Reunião às 15h") as any)?.text, "Reunião às 15h");
  assert.equal(interpretAgentCommand("emitir factura sem confirmação"), null);
  assert.equal(interpretAgentCommand(""), null);
});

test("capacidades dependem da sessão, não do nome LAICISA nem de privilégios no modelo", async () => {
  await request(app).get("/ai/capabilities").expect(401);
  const caps = (await as("alice").get("/capabilities").expect(200)).body;
  assert.equal(caps.company, "Clínica A");
  assert.deepEqual(caps.actions, ["chat.send_team"]);
  assert.equal(caps.text, true);
  assert.match(caps.limitations, /fiscal/);
  await as("alice").post("/commands").send({ message: "abrir laboratório" }).expect(200);
  await as("alice").post("/actions/prepare").send({ tool: "lab.release_result", text: "não" }).expect(403);
});

test("a acção fica congelada; somente o mesmo actor confirma uma vez; empresa estrangeira não vê nem envia", async () => {
  const body = "Aviso interno sem dados de pacientes";
  const prepared = (await as("alice").post("/actions/prepare").send({ tool: "chat.send_team", text: body }).expect(201)).body;
  assert.equal(prepared.status, "requires_confirmation");
  const id = prepared.actionId;
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM public.hospital_messages WHERE empresa_id=$1", [A])).rows[0].n, 0);
  await as("bob").post(`/actions/${id}/confirm`).send({}).expect(404);
  await as("outsider").post(`/actions/${id}/confirm`).send({}).expect(404);
  const sent = (await as("alice").post(`/actions/${id}/confirm`).send({ text: "texto forjado" }).expect(200)).body;
  assert.equal(sent.ok, true);
  assert.equal(sent.repeated, false);
  const repeated = (await as("alice").post(`/actions/${id}/confirm`).send({}).expect(200)).body;
  assert.equal(repeated.repeated, true);
  assert.equal(repeated.messageId, sent.messageId);
  assert.deepEqual((await pg.query("SELECT payload FROM public.nv_ai_action_requests WHERE id=$1", [id])).rows[0].payload, {});
  const messages = (await pg.query("SELECT body,recipient FROM public.hospital_messages WHERE empresa_id=$1", [A])).rows;
  assert.deepEqual(messages, [{ body, recipient: null }]);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM public.hospital_messages WHERE empresa_id=$1", [B])).rows[0].n, 0);
  const audits = (await pg.query("SELECT details::text AS details FROM public.nv_audit WHERE empresa_id=$1 AND action LIKE 'ai.%'", [A])).rows;
  assert.ok(audits.length >= 2);
  assert.ok(audits.every((entry: any) => !entry.details.includes(body)));
});

test("cancelamento e expiração impedem envio e a confirmação cruzada", async () => {
  const cancel = (await as("alice").post("/actions/prepare").send({ tool: "chat.send_team", text: "Mensagem cancelada" }).expect(201)).body.actionId;
  await as("alice").post(`/actions/${cancel}/cancel`).send({}).expect(200);
  assert.deepEqual((await pg.query("SELECT payload FROM public.nv_ai_action_requests WHERE id=$1", [cancel])).rows[0].payload, {});
  await as("alice").post(`/actions/${cancel}/confirm`).send({}).expect(409);
  const expire = (await as("alice").post("/actions/prepare").send({ tool: "chat.send_team", text: "Mensagem expirada" }).expect(201)).body.actionId;
  await pg.query("UPDATE public.nv_ai_action_requests SET expires_at=now()-interval '1 second' WHERE id=$1", [expire]);
  await as("alice").post(`/actions/${expire}/confirm`).send({}).expect(409);
  const messages = (await pg.query("SELECT body FROM public.hospital_messages WHERE empresa_id=$1", [A])).rows;
  assert.ok(messages.every((entry: any) => !["Mensagem cancelada", "Mensagem expirada"].includes(entry.body)));
});

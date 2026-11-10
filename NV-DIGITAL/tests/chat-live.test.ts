import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createChatLive } from "../artifacts/api-server/src/routes/chat-live";

const pg = new PGlite();
const pool: any = {
  query: (text: string, values?: any[]) => pg.query(text, values),
  connect: async () => ({
    query: (text: string, values?: any[]) => pg.query(text, values),
    release() {},
  }),
};
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
const users: Record<string, any> = {
  alice: {
    role: "empresa",
    empresaId: A,
    username: "alice",
    funcionarioNome: "Alice",
  },
  bob: {
    role: "empresa",
    empresaId: A,
    username: "bob",
    funcionarioNome: "Bob",
  },
  carol: { role: "empresa", empresaId: A, username: "carol" },
  outsider: { role: "empresa", empresaId: B, username: "outsider" },
};
const app = express();
app.use(express.json({ limit: "20mb" }));
app.use((req, _res, next) => {
  (req as any).user = users[String(req.headers["x-test-user"])];
  next();
});
app.use("/chat", createChatLive(pool));
const as = (who: string) => ({
  get: (url: string) =>
    request(app)
      .get("/chat" + url)
      .set("x-test-user", who),
  post: (url: string) =>
    request(app)
      .post("/chat" + url)
      .set("x-test-user", who),
  patch: (url: string) =>
    request(app)
      .patch("/chat" + url)
      .set("x-test-user", who),
  delete: (url: string) =>
    request(app)
      .delete("/chat" + url)
      .set("x-test-user", who),
});
before(async () => {
  await applyMigrations(pg, "migrations", () => {});
  for (const [id, name] of [
    [A, "alice"],
    [B, "outsider"],
  ])
    await pg.query(
      "INSERT INTO empresas(id,nome,username,password) VALUES($1,$2,$2,'test')",
      [id, name],
    );
  for (const name of ["bob", "carol"])
    await pg.query(
      "INSERT INTO funcionarios(id,empresa_id,nome,username,password,funcao) VALUES($1,$2,$3,$3,'test','admin')",
      [randomUUID(), A, name],
    );
});
after(async () => {
  await pg.close();
});

test("authentication and institution isolation, persistent direct history and read receipts", async () => {
  await request(app).get("/chat/state").expect(401);
  const state = (await as("alice").get("/state").expect(200)).body;
  assert.ok(state.chats.some((c: any) => c.id === "d:bob"));
  assert.ok(!state.chats.some((c: any) => c.id === "d:outsider"));
  const payload = {
    conversation: "d:bob",
    text: "Resultado disponível",
    requestId: randomUUID(),
  };
  const sent = (await as("alice").post("/send").send(payload).expect(201)).body;
  const repeated = (await as("alice").post("/send").send(payload).expect(201))
    .body;
  assert.equal(sent.id, repeated.id);
  await as("alice")
    .post("/send")
    .send({ ...payload, text: "Outra mensagem" })
    .expect(409);
  assert.equal(
    (await as("carol").get("/messages?conversation=d:alice")).body.messages
      .length,
    0,
  );
  const history = (
    await as("bob").get("/messages?conversation=d:alice").expect(200)
  ).body;
  assert.equal(history.messages[0].text, payload.text);
  await as("outsider")
    .patch("/messages/" + sent.id)
    .send({ text: "Intrusão" })
    .expect(404);
  await as("bob")
    .patch("/messages/" + sent.id)
    .send({ text: "Intrusão" })
    .expect(403);
  await as("bob")
    .post("/read")
    .send({ conversation: "d:alice", lastId: sent.id })
    .expect(200);
  assert.equal(
    (await as("alice").get("/messages?conversation=d:bob")).body.messages[0]
      .read,
    true,
  );
  await as("alice")
    .post("/send")
    .send({ conversation: "d:outsider", text: "Não", requestId: randomUUID() })
    .expect(403);
});
test("groups, attachments, replies, edits and reactions persist with member permissions", async () => {
  const group = (
    await as("alice")
      .post("/groups")
      .send({
        name: "Laboratório",
        participants: ["bob"],
        requestId: randomUUID(),
      })
      .expect(201)
  ).body.id;
  const payload = {
    conversation: group,
    text: "Documento",
    attachment: {
      name: "nota.txt",
      mime: "text/plain",
      base64: Buffer.from("Nota de teste").toString("base64"),
    },
    requestId: randomUUID(),
  };
  const sent = (await as("alice").post("/send").send(payload).expect(201)).body;
  await as("carol")
    .get("/messages?conversation=" + group)
    .expect(403);
  await as("outsider")
    .get("/messages?conversation=" + group)
    .expect(403);
  const history = (
    await as("bob")
      .get("/messages?conversation=" + group)
      .expect(200)
  ).body.messages;
  assert.equal(history[0].text, "Documento");
  const attachment = history[0].attachments[0];
  await as("bob")
    .get("/attachments/" + attachment.id)
    .expect(200);
  await as("carol")
    .get("/attachments/" + attachment.id)
    .expect(403);
  await as("outsider")
    .get("/attachments/" + attachment.id)
    .expect(404);
  await as("bob")
    .post("/send")
    .send({
      conversation: group,
      text: "Recebido",
      replyTo: sent.id,
      requestId: randomUUID(),
    })
    .expect(201);
  await as("bob")
    .post("/send")
    .send({
      conversation: "team",
      text: "Resposta indevida",
      replyTo: sent.id,
      requestId: randomUUID(),
    })
    .expect(400);
  await as("alice")
    .patch("/messages/" + sent.id)
    .send({ text: "Documento revisto" })
    .expect(200);
  await as("bob")
    .post("/messages/" + sent.id + "/reactions")
    .send({ emoji: "👍" })
    .expect(200);
  let h = (await as("alice").get("/messages?conversation=" + group)).body
    .messages;
  assert.equal(h[0].edited, true);
  assert.deepEqual(h[0].reactions["👍"], ["bob"]);
  assert.equal(h[1].replyTo, sent.id);
  await as("alice")
    .delete("/messages/" + sent.id)
    .expect(200);
  h = (await as("bob").get("/messages?conversation=" + group)).body.messages;
  assert.equal(h[0].deleted, true);
  assert.equal(h[0].attachments.length, 0);
  await as("bob")
    .get("/attachments/" + attachment.id)
    .expect(404);
});
test("preferences, blocking and clear-history apply only to the authenticated user", async () => {
  await as("bob")
    .patch("/preferences")
    .send({
      conversation: "d:alice",
      data: { blocked: true, wallpaper: "forest" },
    })
    .expect(200);
  await as("alice")
    .post("/send")
    .send({ conversation: "d:bob", text: "Bloqueada", requestId: randomUUID() })
    .expect(403);
  assert.equal(
    (await as("bob").get("/state")).body.chats.find(
      (c: any) => c.id === "d:alice",
    ).wallpaper,
    "forest",
  );
  await as("bob")
    .patch("/preferences")
    .send({ conversation: "d:alice", data: { blocked: false, clear: true } })
    .expect(200);
  assert.equal(
    (await as("bob").get("/messages?conversation=d:alice")).body.messages
      .length,
    0,
  );
  assert.ok(
    (await as("alice").get("/messages?conversation=d:bob")).body.messages
      .length > 0,
  );
  await as("bob")
    .patch("/preferences")
    .send({ conversation: "settings", data: { language: "fr", dark: true } })
    .expect(200);
  assert.equal((await as("bob").get("/state")).body.settings.language, "fr");
});
test("history pagination preserves older messages and read receipts do not swallow a later arrival", async () => {
  await pg.query(
    "INSERT INTO hospital_messages(id,empresa_id,sender,sender_name,recipient,body,request_id,created_at) SELECT gen_random_uuid(),$1,'bob','Bob',NULL,'Linha '||i,gen_random_uuid(),now()-interval '1 hour'+i*interval '1 second' FROM generate_series(1,105) i",
    [A],
  );
  const latest = (
    await as("alice").get("/messages?conversation=team").expect(200)
  ).body;
  assert.equal(latest.messages.length, 100);
  assert.equal(latest.hasMore, true);
  const older = (
    await as("alice").get("/messages?conversation=team&offset=100").expect(200)
  ).body;
  assert.equal(older.messages.length, 5);
  assert.equal(older.hasMore, false);
  assert.equal(older.messages[0].text, "Linha 1");
  await as("bob")
    .post("/send")
    .send({
      conversation: "team",
      text: "Chegou depois",
      requestId: randomUUID(),
    })
    .expect(201);
  await as("alice")
    .post("/read")
    .send({ conversation: "team", lastId: latest.messages.at(-1).id })
    .expect(200);
  const team = (await as("alice").get("/state")).body.chats.find(
    (x: any) => x.id === "team",
  );
  assert.equal(team.unread, 1);
});
test("invalid attachment signatures and oversized attachments are rejected without a message", async () => {
  const count = async () =>
    Number(
      (
        await pg.query<any>(
          "SELECT count(*) AS n FROM hospital_messages WHERE empresa_id=$1",
          [A],
        )
      ).rows[0].n,
    );
  const prior = await count();
  await as("alice")
    .post("/send")
    .send({
      conversation: "team",
      text: "Imagem falsa",
      attachment: {
        name: "x.png",
        mime: "image/png",
        base64: Buffer.from("invalid").toString("base64"),
      },
      requestId: randomUUID(),
    })
    .expect(400);
  await as("alice")
    .post("/send")
    .send({
      conversation: "team",
      text: "Demasiado grande",
      attachment: {
        name: "x.txt",
        mime: "text/plain",
        base64: Buffer.alloc(5242881, 65).toString("base64"),
      },
      requestId: randomUUID(),
    })
    .expect(400);
  assert.equal(await count(), prior);
});

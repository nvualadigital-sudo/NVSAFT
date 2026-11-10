import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import { createChatCalls } from "../artifacts/api-server/src/routes/chat-calls";
import { createChatSocial } from "../artifacts/api-server/src/routes/chat-social";
const pg = new PGlite();
const pool: any = {
  query: (q: string, p?: any[]) => pg.query(q, p),
  connect: async () => ({
    query: (q: string, p?: any[]) => pg.query(q, p),
    release() {},
  }),
};
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
const users: Record<string, any> = {
  alice: { role: "empresa", empresaId: A, username: "alice" },
  bob: { role: "empresa", empresaId: A, username: "bob" },
  carol: { role: "empresa", empresaId: A, username: "carol" },
  outsider: { role: "empresa", empresaId: B, username: "outsider" },
};
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).user = users[String(req.headers["x-test-user"])];
  next();
});
app.use("/calls", createChatCalls(pool));
app.use("/social", createChatSocial(pool));
function as(who: string) {
  return {
    get: (p: string) => request(app).get(p).set("x-test-user", who),
    post: (p: string) => request(app).post(p).set("x-test-user", who),
    delete: (p: string) => request(app).delete(p).set("x-test-user", who),
  };
}
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

test("calls authenticate, isolate companies, prevent self/cross-company invites and enforce participant roles", async () => {
  await request(app).get("/calls/inbox").expect(401);
  await as("alice")
    .post("/calls")
    .send({ peer: "alice", kind: "voice", requestId: randomUUID() })
    .expect(400);
  await as("alice")
    .post("/calls")
    .send({ peer: "outsider", kind: "voice", requestId: randomUUID() })
    .expect(403);
  const payload = { peer: "bob", kind: "voice", requestId: randomUUID() };
  const row = (await as("alice").post("/calls").send(payload).expect(201)).body;
  assert.equal(
    (await as("alice").post("/calls").send(payload).expect(201)).body.id,
    row.id,
  );
  assert.equal((await as("bob").get("/calls/inbox")).body[0].id, row.id);
  assert.equal((await as("carol").get("/calls/inbox")).body.length, 0);
  await as("carol")
    .get("/calls/" + row.id)
    .expect(404);
  await as("outsider")
    .get("/calls/" + row.id)
    .expect(404);
  await as("alice")
    .post("/calls/" + row.id + "/action")
    .send({ action: "accept" })
    .expect(403);
  await as("carol")
    .post("/calls")
    .send({ peer: "bob", kind: "video", requestId: randomUUID() })
    .expect(409);
  await as("bob")
    .post("/calls/" + row.id + "/action")
    .send({ action: "reject" })
    .expect(200);
  assert.equal(
    (await as("alice").get("/calls/history")).body[0].status,
    "rejected",
  );
});
test("offer/answer/ICE relay is private, ordered, idempotent and disabled after hangup", async () => {
  const row = (
    await as("alice")
      .post("/calls")
      .send({ peer: "bob", kind: "video", requestId: randomUUID() })
      .expect(201)
  ).body;
  const offer = {
    kind: "offer",
    payload: { type: "offer", sdp: "v=0\r\n" },
    requestId: randomUUID(),
  };
  await as("alice")
    .post("/calls/" + row.id + "/signals")
    .send(offer)
    .expect(201);
  await as("alice")
    .post("/calls/" + row.id + "/signals")
    .send({ ...offer, payload: { sdp: "v=0\r\n", type: "offer" } })
    .expect(201);
  await as("alice")
    .post("/calls/" + row.id + "/signals")
    .send({ ...offer, payload: { type: "offer", sdp: "v=0\r\nother" } })
    .expect(409);
  await as("bob")
    .post("/calls/" + row.id + "/signals")
    .send(offer)
    .expect(403);
  const signals = (await as("bob").get("/calls/" + row.id)).body.signals;
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "offer");
  assert.equal(
    (await as("alice").get("/calls/" + row.id)).body.signals.length,
    0,
  );
  assert.equal(
    (await as("bob").get("/calls/" + row.id + "?after=" + signals[0].id)).body
      .signals.length,
    0,
  );
  await as("bob")
    .post("/calls/" + row.id + "/action")
    .send({ action: "accept" })
    .expect(200);
  await as("bob")
    .post("/calls/" + row.id + "/signals")
    .send({
      kind: "answer",
      payload: { type: "answer", sdp: "v=0\r\n" },
      requestId: randomUUID(),
    })
    .expect(201);
  await as("alice")
    .post("/calls/" + row.id + "/signals")
    .send({
      kind: "ice",
      payload: {
        candidate: "candidate:1 1 udp 1 127.0.0.1 50000 typ host",
        sdpMid: "0",
      },
      requestId: randomUUID(),
    })
    .expect(201);
  await as("carol")
    .post("/calls/" + row.id + "/action")
    .send({ action: "end" })
    .expect(404);
  await as("alice")
    .post("/calls/" + row.id + "/action")
    .send({ action: "end" })
    .expect(200);
  await as("alice")
    .post("/calls/" + row.id + "/signals")
    .send(offer)
    .expect(409);
});
test("unanswered calls expire, disabled contacts lose access, TURN uses expiring credentials without exposing the secret", async () => {
  const row = (
    await as("alice")
      .post("/calls")
      .send({ peer: "bob", kind: "voice", requestId: randomUUID() })
      .expect(201)
  ).body;
  await pg.query(
    "UPDATE nv_chat_calls SET created_at=now()-interval '61 seconds' WHERE id=$1",
    [row.id],
  );
  assert.equal((await as("bob").get("/calls/inbox")).body.length, 0);
  assert.equal(
    (await as("alice").get("/calls/" + row.id)).body.call.status,
    "missed",
  );
  process.env.CHAT_TURN_URLS = "turn:relay.example.test:3478";
  process.env.CHAT_TURN_SECRET = "test-only-shared-turn-secret";
  const config = (await as("alice").get("/calls/config").expect(200)).body;
  assert.equal(config.relayConfigured, true);
  const turn = config.iceServers[0];
  assert.ok(Number(turn.username.split(":")[0]) > Date.now() / 1000);
  assert.equal(
    turn.credential,
    createHmac("sha1", process.env.CHAT_TURN_SECRET)
      .update(turn.username)
      .digest("base64"),
  );
  assert.ok(!JSON.stringify(config).includes(process.env.CHAT_TURN_SECRET));
  delete process.env.CHAT_TURN_URLS;
  delete process.env.CHAT_TURN_SECRET;
  await pg.query(
    "UPDATE funcionarios SET ativo=false WHERE empresa_id=$1 AND username='bob'",
    [A],
  );
  await as("alice")
    .get("/calls/" + row.id)
    .expect(403);
  await pg.query(
    "UPDATE funcionarios SET ativo=true WHERE empresa_id=$1 AND username='bob'",
    [A],
  );
});
test("states expire after 24 hours and are visible only within their institution", async () => {
  const payload = { body: "Equipa disponível", requestId: randomUUID() };
  const row = (
    await as("alice").post("/social/posts").send(payload).expect(201)
  ).body;
  assert.equal(
    (await as("alice").post("/social/posts").send(payload)).body.id,
    row.id,
  );
  assert.equal((await as("bob").get("/social/status")).body.length, 1);
  assert.equal((await as("outsider").get("/social/status")).body.length, 0);
  await as("bob")
    .delete("/social/posts/" + row.id)
    .expect(403);
  await pg.query(
    "UPDATE nv_chat_posts SET expires_at=now()-interval '1 second' WHERE id=$1",
    [row.id],
  );
  assert.equal((await as("bob").get("/social/status")).body.length, 0);
});
test("channels restrict publishing to creators; communities require membership; all posts are tenant scoped", async () => {
  const channel = (
    await as("alice")
      .post("/social/spaces")
      .send({ kind: "channel", name: "Avisos", requestId: randomUUID() })
      .expect(201)
  ).body.id;
  const community = (
    await as("alice")
      .post("/social/spaces")
      .send({
        kind: "community",
        name: "Investigação",
        requestId: randomUUID(),
      })
      .expect(201)
  ).body.id;
  await as("bob")
    .get("/social/spaces/" + community + "/posts")
    .expect(403);
  await as("outsider")
    .get("/social/spaces/" + channel + "/posts")
    .expect(404);
  await as("bob")
    .post("/social/posts")
    .send({ spaceId: channel, body: "Intrusão", requestId: randomUUID() })
    .expect(403);
  await as("alice")
    .post("/social/posts")
    .send({
      spaceId: channel,
      body: "Aviso da equipa",
      requestId: randomUUID(),
    })
    .expect(201);
  assert.equal(
    (await as("bob").get("/social/spaces/" + channel + "/posts")).body.length,
    1,
  );
  await as("bob")
    .post("/social/spaces/" + community + "/membership")
    .send({ join: true })
    .expect(200);
  await as("bob")
    .post("/social/posts")
    .send({ spaceId: community, body: "Ideia", requestId: randomUUID() })
    .expect(201);
  assert.equal(
    (await as("alice").get("/social/spaces/" + community + "/posts")).body[0]
      .body,
    "Ideia",
  );
  await as("bob")
    .post("/social/spaces/" + community + "/membership")
    .send({ join: false })
    .expect(200);
  await as("bob")
    .get("/social/spaces/" + community + "/posts")
    .expect(403);
  await as("alice")
    .post("/social/spaces/" + community + "/membership")
    .send({ join: false })
    .expect(400);
});

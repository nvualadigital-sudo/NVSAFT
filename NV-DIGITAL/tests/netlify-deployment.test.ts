import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import release from "../nv-release.json" with { type: "json" };
import { applyMigrations } from "../scripts/operations/migrations.mjs";
import {
  httpsOrigin,
  redirectsFor,
  resolveNetlifyConfig,
} from "../scripts/netlify-config.mjs";
import { createHealthRouter } from "../artifacts/api-server/src/routes/health";

test("Netlify build accepts only an external HTTPS origin and routes the API before the SPA", () => {
  assert.deepEqual(
    resolveNetlifyConfig({
      NV_NETLIFY_API_ORIGIN: "https://api.example.invalid/",
      VITE_API_URL: "https://legacy.example.invalid",
    }),
    { api: "https://api.example.invalid", direct: false },
  );
  assert.deepEqual(
    resolveNetlifyConfig({
      VITE_API_URL: "https://legacy.example.invalid",
      NV_NETLIFY_STAFF_DIRECT: "1",
    }),
    { api: "https://legacy.example.invalid", direct: true },
  );
  for (const value of [
    "",
    "http://api.example.invalid",
    "https://user:password@api.example.invalid",
    "https://api.example.invalid/api",
    "https://api.example.invalid/?a=b",
    "https://api.example.invalid\n/* /index.html 200",
  ]) {
    assert.throws(() => httpsOrigin(value), /HTTPS/);
  }
  assert.throws(
    () =>
      resolveNetlifyConfig({
        NV_NETLIFY_API_ORIGIN: "https://site.netlify.app/",
        DEPLOY_PRIME_URL: "https://site.netlify.app",
      }),
    /próprio site/,
  );
  assert.deepEqual(
    redirectsFor("https://api.example.invalid").trim().split("\n"),
    [
      "/api https://api.example.invalid/api 200!",
      "/api/* https://api.example.invalid/api/:splat 200!",
      "/* /index.html 200",
    ],
  );
});

test("backend readiness detects absent or stale migrations while preserving the old health probe", async () => {
  const db = new PGlite();
  try {
    const app = express();
    app.use("/api", createHealthRouter(db));
    assert.deepEqual(
      (await request(app).get("/api/healthz").expect(200)).body,
      { status: "ok" },
    );
    const unready = await request(app).get("/api/readyz").expect(503);
    assert.equal(unready.headers["cache-control"], "no-store");
    assert.deepEqual(unready.body, {
      status: "indisponivel",
      version: release.version,
    });
    await applyMigrations(db, "migrations", () => {});
    const ready = await request(app).get("/api/readyz").expect(200);
    assert.deepEqual(ready.body, { status: "ok", version: release.version });
    await db.query(
      "UPDATE hospital_migrations SET sha256='stale' WHERE name=$1",
      ["20261103_pos_farmacia_formacao.sql"],
    );
    assert.equal(
      (await request(app).get("/api/readyz").expect(503)).body.status,
      "indisponivel",
    );
  } finally {
    await db.close();
  }
});

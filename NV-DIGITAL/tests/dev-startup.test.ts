import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, symlinkSync, existsSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function cleanEnv(extra: Record<string, string> = {}) {
  const env = { ...process.env };
  for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "SESSION_SECRET", "DEV_USERNAME", "DEV_PASSWORD", "ALLOWED_ORIGINS", "API_PORT", "WEB_PORT", "NV_DEV_PORT", "PORT"]) delete env[key];
  return { ...env, ...extra };
}
function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "nv-dev-"));
  mkdirSync(path.join(dir, "scripts"));
  for (const name of ["dev.mjs", "configurar-local.mjs", "parar-dev.mjs"]) copyFileSync(path.join(root, "scripts", name), path.join(dir, "scripts", name));
  writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
  return dir;
}
async function freePorts() {
  const servers = [createServer(), createServer()];
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))));
  const values = servers.map((server) => (server.address() as { port: number }).port);
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  return values;
}
async function until(check: () => boolean) {
  const end = Date.now() + 10000;
  while (!check()) {
    if (Date.now() > end) throw new Error("Serviço de teste não ficou pronto.");
    await pause(40);
  }
}
async function portFree(value: number) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(value, "0.0.0.0", () => server.close(() => resolve()));
  });
}
function services(dir: string) {
  mkdirSync(path.join(dir, "artifacts/lab-results"), { recursive: true });
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  writeFileSync(path.join(dir, "artifacts/lab-results/dev-server.mjs"), `
import {createServer} from 'node:net';
import {writeFileSync,existsSync} from 'node:fs';
writeFileSync('api.pid',String(process.pid));
writeFileSync('web.pid',String(process.pid));
createServer().listen(Number(process.env.PORT),'0.0.0.0',()=>{
 writeFileSync('api.ready','1');writeFileSync('web.ready','1');
 if(process.env.NV_QA_API_FAILURE)setTimeout(()=>process.exit(7),300);
});
`);
}
function forceCleanup(dir: string) {
  for (const name of ["api.pid", "pnpm.pid", "web.pid"]) {
    try { process.kill(Number(readFileSync(path.join(dir, name), "utf8")), "SIGKILL"); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}

test("missing configuration stops before API or frontend can occupy a port", () => {
  const dir = fixture();
  try {
    const result = spawnSync(process.execPath, ["scripts/dev.mjs"], { cwd: dir, env: cleanEnv(), encoding: "utf8", timeout: 6000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_URL está em falta/);
    assert.match(result.stderr, /SESSION_SECRET/);
    assert.ok(!existsSync(path.join(dir, "api.pid")));
    assert.ok(!existsSync(path.join(dir, "web.pid")));
  } finally { forceCleanup(dir); }
});

test("a porta única ocupada é recusada sem criar uma segunda porta", async () => {
  const dir = fixture(), busy = createServer();
  await new Promise<void>((resolve) => busy.listen(0, "0.0.0.0", resolve));
  const value = (busy.address() as { port: number }).port;
  try {
    const child = spawn(process.execPath, ["scripts/dev.mjs"], { cwd: dir, env: cleanEnv({ DATABASE_URL: "postgresql://test:test@127.0.0.1/test", SESSION_SECRET: "test-configuration-secret-32-characters", NV_DEV_PORT: String(value) }) });
    let error = "";
    child.stderr.on("data", (data) => { error += data; });
    const status = await new Promise((resolve) => child.once("exit", resolve));
    assert.equal(status, 1);
    assert.match(error, new RegExp("A porta " + value + " está ocupada"));
    assert.ok(!existsSync(path.join(dir, "api.pid")));
  } finally { await new Promise<void>((resolve) => busy.close(() => resolve())); forceCleanup(dir); }
});

for (const failure of [true, false]) test(failure ? "a falha no servidor único encerra o supervisor" : "parar pnpm dev liberta a única porta e o processo unificado", async () => {
  const dir = fixture();
  services(dir);
  const [api, web] = await freePorts();
  const child = spawn(process.execPath, ["scripts/dev.mjs"], {
    cwd: dir,
    env: cleanEnv({ DATABASE_URL: "postgresql://test:test@127.0.0.1/test", SESSION_SECRET: "test-configuration-secret-32-characters", NV_DEV_PORT: String(api), ...(failure ? { NV_QA_API_FAILURE: "1" } : {}) }),
    stdio: "pipe",
  });
  let error = "";
  child.stderr.on("data", (data) => { error += data; });
  const ended = new Promise<number | null>((resolve) => child.once("exit", resolve));
  try {
    await until(() => existsSync(path.join(dir, "web.ready")) && existsSync(path.join(dir, "api.ready")));
    if (!failure) child.kill("SIGTERM");
    assert.equal(await ended, failure ? 7 : 0, error);
    await portFree(api);
    await portFree(web); // O segundo porto nunca chegou a ser ocupado.
  } finally { child.kill("SIGKILL"); forceCleanup(dir); }
});

test("local setup preserves existing settings, generates a session key and never prints credentials", () => {
  const dir = fixture();
  const database = "postgresql://test:private-test-password@127.0.0.1/nv_tests";
  const password = "private's local#test$password\\2026";
  writeFileSync(path.join(dir, ".env"), 'UNCHANGED_SETTING="preservar"\n');
  try {
    const result = spawnSync(process.execPath, ["scripts/configurar-local.mjs"], { cwd: dir, env: cleanEnv(), encoding: "utf8", input: [database, "admin", password, password, ""].join("\n"), timeout: 6000 });
    assert.equal(result.status, 0, result.stderr);
    const values = parseEnv(readFileSync(path.join(dir, ".env"), "utf8"));
    assert.equal(values.DATABASE_URL, database);
    assert.equal(values.DEV_USERNAME, "admin");
    assert.equal(values.DEV_PASSWORD, password);
    assert.equal(values.UNCHANGED_SETTING, "preservar");
    assert.equal(values.SESSION_SECRET.length, 64);
    assert.equal(statSync(path.join(dir, ".env")).mode & 0o777, 0o600);
    assert.ok(!result.stdout.includes(database) && !result.stdout.includes(password));
    const prior = readFileSync(path.join(dir, ".env"), "utf8");
    const repeat = spawnSync(process.execPath, ["scripts/configurar-local.mjs"], { cwd: dir, env: cleanEnv(), encoding: "utf8", input: "", timeout: 6000 });
    assert.equal(repeat.status, 0, repeat.stderr);
    assert.equal(readFileSync(path.join(dir, ".env"), "utf8"), prior);
  } finally { forceCleanup(dir); }
});

test("local setup refuses to write credentials to a tracked env file", () => {
  const dir = fixture();
  try {
    writeFileSync(path.join(dir, ".env"), "EXISTING=preservar\n");
    assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: dir }).status, 0);
    assert.equal(spawnSync("git", ["add", ".env"], { cwd: dir }).status, 0);
    const result = spawnSync(process.execPath, ["scripts/configurar-local.mjs"], { cwd: dir, env: cleanEnv(), encoding: "utf8", timeout: 6000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /está versionado/);
    assert.equal(readFileSync(path.join(dir, ".env"), "utf8"), "EXISTING=preservar\n");
  } finally { forceCleanup(dir); }
});

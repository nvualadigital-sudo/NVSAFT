import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, symlinkSync, rmSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const apiRequire = createRequire(path.resolve("artifacts/api-server/package.json"));
const { transformSync } = apiRequire("esbuild");

function moduleRoot(name: string) {
  let directory = path.dirname(apiRequire.resolve(name));
  while (!existsSync(path.join(directory, "package.json"))) {
    const parent = path.dirname(directory);
    assert.notEqual(parent, directory, "Package root not found: " + name);
    directory = parent;
  }
  return directory;
}

test("Vercel loads the compiled Express default export and preserves module paths", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "nv-vercel-build-"));
  try {
    const api = path.join(fixture, "artifacts/api-server");
    mkdirSync(path.join(api, "src"), { recursive: true });
    // Resolve the real build dependencies, without connecting to a database.
    const modules = path.join(fixture, "node_modules");
    mkdirSync(modules);
    for (const name of ["esbuild", "pino", "pino-pretty", "thread-stream"]) {
      symlinkSync(moduleRoot(name), path.join(modules, name), "dir");
    }
    copyFileSync(path.resolve("artifacts/api-server/build-vercel.mjs"), path.join(api, "build-vercel.mjs"));
    writeFileSync(path.join(api, "src/app.ts"), `
      import pino from "pino";
      const logger = pino({ level: "silent" });
      export default function app(_req: unknown, res: any) {
        logger.info("Vercel handler loaded");
        res.json({ directory: import.meta.dirname, filename: import.meta.filename, url: import.meta.url });
      }
    `);
    const built = spawnSync(process.execPath, [path.join(api, "build-vercel.mjs")], {
      cwd: fixture, encoding: "utf8", timeout: 30000,
    });
    assert.equal(built.status, 0, built.stderr);
    const entryDir = path.join(fixture, "api");
    mkdirSync(entryDir);
    const adapter = transformSync(readFileSync(path.resolve("api/[...path].ts"), "utf8"), {
      loader: "ts", format: "cjs", platform: "node",
    }).code;
    const entry = path.join(entryDir, "entry.cjs");
    writeFileSync(entry, adapter);
    const handler = createRequire(entry)(entry).default;
    assert.equal(typeof handler, "function");
    let payload: any;
    handler({}, { json(value: unknown) { payload = value; } });
    const bundle = path.join(api, "dist-vercel/app.cjs");
    assert.equal(payload.directory, path.dirname(bundle));
    assert.equal(payload.filename, bundle);
    assert.equal(payload.url, pathToFileURL(bundle).href);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

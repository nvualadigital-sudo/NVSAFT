import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(
  resolve(root, "artifacts/api-server/package.json"),
);
const { build } = require("esbuild");
const folder = resolve(root, "artifacts/lab-results/public/vendor");
await mkdir(folder, { recursive: true });
await build({
  entryPoints: [
    resolve(root, "artifacts/lab-results/src/pages/admin/passes/runtime.mjs"),
  ],
  outfile: resolve(folder, "passes-runtime.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2020",
  minify: true,
  legalComments: "eof",
  logLevel: "warning",
});

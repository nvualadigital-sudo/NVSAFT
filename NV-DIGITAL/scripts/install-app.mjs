import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
// Installs the application, its workspace dependencies and the root validation tools.
// The API generator remains in the source tree and is installed only for explicit code generation.
const args = [
  "install",
  "--frozen-lockfile",
  "--filter",
  "workspace",
  "--filter",
  "@workspace/lab-results...",
  "--filter",
  "@workspace/api-server...",
];
const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  args,
  { cwd: root, stdio: "inherit", env: { ...process.env, CI: "true" } },
);
if (result.error) {
  console.error("Não foi possível iniciar pnpm: " + result.error.message);
  process.exitCode = 1;
} else process.exitCode = result.status ?? 1;

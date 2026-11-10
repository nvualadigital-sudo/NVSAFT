import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveNetlifyConfig, redirectsFor } from "./netlify-config.mjs";

const root = resolve(import.meta.dirname, "..");
try {
  const { api, direct } = resolveNetlifyConfig(process.env);
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3000",
    BASE_PATH: "/",
    VITE_API_URL: direct ? api : "",
  };
  const result = spawnSync(
    "pnpm",
    ["--filter", "@workspace/lab-results", "run", "build"],
    {
      cwd: root,
      env,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("A compilação da interface falhou.");
  const output = resolve(root, "artifacts/lab-results/dist/public");
  for (const name of ["index.html", "portal-paciente/index.html"])
    if (!existsSync(resolve(output, name)))
      throw new Error("Falta no resultado da compilação: " + name);
  writeFileSync(resolve(output, "_redirects"), redirectsFor(api));
  const { version } = JSON.parse(
    readFileSync(resolve(root, "nv-release.json"), "utf8"),
  );
  writeFileSync(
    resolve(output, "release.json"),
    JSON.stringify({ version }) + "\n",
  );
  console.log(
    `NV-DIGITAL ${version} compilado. API via ${direct ? "origem directa para equipas; proxy para o portal" : "proxy na origem do site"}.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

import release from "../nv-release.json" with { type: "json" };
import { httpsOrigin } from "./netlify-config.mjs";

try {
  const args = process.argv.slice(2);
  const onlyApi = args[0] === "--api";
  const origin = httpsOrigin(args[onlyApi ? 1 : 0], "endereço a verificar");
  async function get(path, expect, accept) {
    const r = await fetch(origin + path, {
      headers: { Accept: accept, "Cache-Control": "no-cache" },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const type = r.headers.get("content-type") || "";
    if (r.status !== expect || !type.toLowerCase().includes(accept))
      throw new Error(
        `${path}: esperava HTTP ${expect} e ${accept}; recebi ${r.status} ${type}.`,
      );
    return r;
  }
  const ready = await (
    await get("/api/readyz", 200, "application/json")
  ).json();
  if (ready.status !== "ok" || ready.version !== release.version)
    throw new Error(
      "A API não corresponde à versão " +
        release.version +
        " ou não tem o esquema actualizado.",
    );
  await get("/api/auth/me", 401, "application/json");
  if (!onlyApi) {
    const site = await (
      await get("/release.json", 200, "application/json")
    ).json();
    if (site.version !== ready.version)
      throw new Error("A interface e a API têm versões diferentes.");
    await get("/portal-paciente/index.html", 200, "text/html");
    await get("/api/patient-portal/session", 401, "application/json");
  }
  console.log(
    "Verificação pública concluída: " +
      release.version +
      (onlyApi ? " (API)" : " (interface, API e rota do portal)") +
      ".",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

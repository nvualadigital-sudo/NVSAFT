/**
 * Desenvolvimento numa só porta: Express (API) + Vite (HMR) no mesmo HTTP server.
 * Não altera o servidor de produção nem os proxies da Netlify.
 */
import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createServer as createViteServer } from "vite";

const root = path.resolve(import.meta.dirname, "../..");
const webRoot = import.meta.dirname;
const port = Number(process.env.PORT || "3000");

// A versão compilada anterior não pode ocultar as páginas do Vite.
process.env.WEB_DIST = path.join(webRoot, "__dev_static_disabled__");

const vendor = spawnSync(process.execPath, ["scripts/build-pass-vendor.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (vendor.error || vendor.status !== 0) {
  throw vendor.error || new Error("Não foi possível preparar os recursos locais.");
}

const { default: app } = await import("../api-server/src/app.ts");
const server = createHttpServer(app);
const vite = await createViteServer({
  configFile: path.join(webRoot, "vite.config.ts"),
  root: webRoot,
  appType: "custom",
  server: {
    middlewareMode: true,
    host: "0.0.0.0",
    hmr: { server },
  },
});

// Express trata /api primeiro; as restantes rotas são entregues pelo Vite.
app.use(vite.middlewares);
app.use(async (req, res, next) => {
  if (req.method !== "GET" || (req.path === "/api" || req.path.startsWith("/api/"))) return next();
  try {
    const html = await readFile(path.join(webRoot, "index.html"), "utf8");
    const transformed = await vite.transformIndexHtml(req.originalUrl, html);
    res.status(200).type("html").send(transformed);
  } catch (error) {
    next(error);
  }
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await vite.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGTERM", () => { void stop(); });
process.on("SIGINT", () => { void stop(); });
server.listen(port, "0.0.0.0", () => {
  console.log(`NV-DIGITAL: interface, API e HMR na mesma porta ${port} (http://localhost:${port}).`);
});

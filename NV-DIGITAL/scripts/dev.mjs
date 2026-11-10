import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}

const failures = [];
if (!process.env.DATABASE_URL) failures.push("DATABASE_URL está em falta.");
else {
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname)
      throw new Error();
  } catch {
    failures.push("DATABASE_URL tem de ser uma ligação PostgreSQL válida.");
  }
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  failures.push("SESSION_SECRET precisa de pelo menos 32 caracteres.");
function port(name, fallback) {
  const value = process.env[name] || fallback;
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < 1 || number > 65535) {
    failures.push(name + " tem de ser uma porta entre 1 e 65535.");
    return null;
  }
  return number;
}
// A API e o Vite partilham o mesmo servidor HTTP. A porta padrão é SEMPRE 3000.
// NV_DEV_PORT só é útil em testes isolados ou quando a máquina exige outra porta.
const devPort = port("NV_DEV_PORT", "3000");
if (failures.length) {
  console.error(failures.join("\n"));
  console.error("Configure os Secrets ou execute: node scripts/configurar-local.mjs");
  process.exit(1);
}

async function available(value) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      reject(new Error(error.code === "EADDRINUSE"
        ? `A porta ${value} está ocupada. Pare a execução anterior antes de iniciar.`
        : `Não foi possível reservar a porta ${value} (${error.code || "erro"}).`));
    });
    server.listen({ host: "0.0.0.0", port: value, exclusive: true }, () => server.close(resolve));
  });
}
try {
  await available(devPort);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const children = [];
let stopping = false;
function signal(child, name) {
  if (!child.pid) return;
  try {
    // Each service owns a process group: pnpm and its Vite descendants stop together.
    if (process.platform !== "win32") process.kill(-child.pid, name);
    else child.kill(name);
  } catch (error) {
    if (error.code !== "ESRCH") console.error("Não foi possível parar um serviço.");
  }
}
function stop(code) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => signal(child, "SIGTERM"));
  // Keep the supervisor alive until descendants have had time to exit.
  setTimeout(() => {
    children.forEach((child) => signal(child, "SIGKILL"));
    process.exit(code);
  }, 1500);
}
function run(command, args, env) {
  const child = spawn(command, args, {
    stdio: "inherit", env, detached: process.platform !== "win32",
  });
  children.push(child);
  child.once("error", () => {
    console.error("Não foi possível iniciar um serviço. Verifique a instalação das dependências.");
    stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) {
      console.error("Um serviço terminou; a outra execução também será encerrada.");
      stop(code || 1);
    }
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
run(process.execPath, ["--import", "tsx", "artifacts/lab-results/dev-server.mjs"], {
  ...process.env, PORT: String(devPort), NODE_ENV: "development",
});

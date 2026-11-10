import { readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const envFile = path.join(root, ".env");
const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", ".env"], { cwd: root, stdio: "ignore" });
if (tracked.status === 0) {
  console.error("O ficheiro .env está versionado. Retire-o do controlo de versões antes de guardar credenciais.");
  process.exit(1);
}
try { process.loadEnvFile(envFile); } catch (e) { if (e.code !== "ENOENT") throw e; }
let muted = false;
const output = new Writable({ write(chunk, encoding, callback) {
  if (!muted) process.stdout.write(chunk, encoding);
  callback();
}});
const terminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const rl = createInterface({ input: process.stdin, output, terminal });
// Pipe-driven mode is useful for automated tests; interactive use keeps secret input hidden.
const queued = [];
const waiting = [];
let closed = false;
if (!terminal) {
  rl.on("line", (line) => waiting.length ? waiting.shift()(line) : queued.push(line));
  rl.on("close", () => { closed = true; while (waiting.length) waiting.shift()(null); });
}
async function ask(label, secret = false) {
  if (!terminal) {
    const value = queued.length ? queued.shift() : closed ? null : await new Promise((resolve) => waiting.push(resolve));
    if (value === null) throw new Error("Configuração cancelada antes de guardar.");
    return secret ? value : value.trim();
  }
  if (!secret) return (await rl.question(label)).trim();
  process.stdout.write(label);
  muted = true;
  try { return await rl.question(""); }
  finally { muted = false; process.stdout.write("\n"); }
}
const additions = {};
try {
  console.log("Configuração local. Cole a ligação à base actual apenas neste terminal. A entrada de ligação e palavra-passe fica oculta.");
  let database = process.env.DATABASE_URL;
  while (!database) {
    const value = (await ask("Ligação PostgreSQL da sua base actual: ", true)).trim();
    try {
      const url = new URL(value);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || /\s/.test(value)) throw new Error();
      database = value;
      additions.DATABASE_URL = value;
    } catch { console.log("Cole uma ligação PostgreSQL completa, obtida no ambiente anterior ou no fornecedor da base."); }
  }
  if (!process.env.SESSION_SECRET) additions.SESSION_SECRET = randomBytes(32).toString("hex");
  else if (process.env.SESSION_SECRET.length < 32) throw new Error("Corrija SESSION_SECRET nos Secrets: precisa de pelo menos 32 caracteres.");
  if (!process.env.DEV_USERNAME) additions.DEV_USERNAME = (await ask("Utilizador do desenvolvedor [admin]: ")) || "admin";
  if (!process.env.DEV_PASSWORD) {
    let password = "";
    while (!password) {
      const first = await ask("Crie uma palavra-passe do desenvolvedor (mínimo 12 caracteres): ", true);
      const second = await ask("Repita a palavra-passe: ", true);
      if (first.length >= 12 && first === second) password = first;
      else console.log("Use pelo menos 12 caracteres e confirme a mesma palavra-passe.");
    }
    additions.DEV_PASSWORD = password;
  }
  if (!process.env.ALLOWED_ORIGINS) additions.ALLOWED_ORIGINS = process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `https://${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : "http://localhost:3000,http://127.0.0.1:3000";
  let content = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  for (const [key, value] of Object.entries(additions)) {
    const encoded = ["'" + value + "'", '"' + value + '"', JSON.stringify(value), value]
      .find((candidate) => parseEnv("VALUE=" + candidate).VALUE === value);
    if (encoded === undefined) throw new Error("Um valor contém aspas incompatíveis com .env. Configure-o nos Secrets do Codespaces.");
    const line = key + "=" + encoded;
    const prior = new RegExp("^\\s*(?:export\\s+)?" + key + "\\s*=.*$", "gm");
    content = prior.test(content) ? content.replace(prior, () => line) : content.replace(/\n?$/, "\n") + line + "\n";
  }
  if (Object.keys(additions).length) {
    const ignoreFile = path.join(root, ".gitignore");
    const ignored = existsSync(ignoreFile) ? readFileSync(ignoreFile, "utf8") : "";
    if (!ignored.split(/\r?\n/).some((line) => line.trim() === ".env"))
      writeFileSync(ignoreFile, ignored.replace(/\n?$/, "\n") + "# Configuração local privada\n.env\n");
    writeFileSync(envFile, content, { mode: 0o600 });
    chmodSync(envFile, 0o600);
  }
  console.log("Configuração concluída. Execute pnpm db:migrate e, após terminar sem erro, pnpm dev.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { rl.close(); }

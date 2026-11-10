import { readdirSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
if (process.platform !== "linux") {
  console.error("Este comando é para Codespaces/Replit Linux. Pare os terminais do projecto com Ctrl+C.");
  process.exit(1);
}
const stopped = [];
const selfProc = readlinkSync("/proc/self");
const namespace = readlinkSync("/proc/self/ns/pid");
for (const entry of readdirSync("/proc")) {
  if (!/^\d+$/.test(entry) || entry === selfProc) continue;
  try {
    if (readlinkSync(`/proc/${entry}/ns/pid`) !== namespace) continue;
    const cwd = readlinkSync(`/proc/${entry}/cwd`);
    if (cwd !== root && !cwd.startsWith(root + path.sep)) continue;
    const args = readFileSync(`/proc/${entry}/cmdline`, "utf8").split("\0").filter(Boolean);
    if (!/^(?:node|nodejs)$/.test(path.basename(args[0] || ""))) continue;
    const vite = args.slice(1).some((arg) => /(?:^|\/)vite(?:\.js)?$/.test(arg)) && args.includes("vite.config.ts");
    const api = args.includes("artifacts/api-server/src/index.ts") && args.includes("tsx");
    const supervisor = args.slice(1).some((arg) => /(?:^|\/)scripts\/dev\.mjs$/.test(arg));
    const frontend = args.includes("@workspace/lab-results") && args.includes("dev");
    const unified = args.includes("artifacts/lab-results/dev-server.mjs");
    if (!(vite || api || supervisor || frontend || unified)) continue;
    // Some containers expose host /proc IDs; signals need the PID in our own namespace.
    const status = readFileSync(`/proc/${entry}/status`, "utf8");
    const ids = status.match(/^NSpid:\s+([\d\s]+)$/m)?.[1].trim().split(/\s+/);
    const pid = Number(ids?.at(-1) || entry);
    if (pid === process.pid) continue;
    process.kill(pid, "SIGTERM");
    stopped.push(pid);
  } catch (error) {
    if (!["ENOENT", "ESRCH", "EACCES", "EPERM"].includes(error.code)) throw error;
  }
}
await new Promise((resolve) => setTimeout(resolve, stopped.length ? 1800 : 0));
console.log(stopped.length ? `Execuções antigas deste projecto encerradas: ${stopped.length}.` : "Não foram encontradas execuções antigas deste projecto.");

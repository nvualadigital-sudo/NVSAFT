import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Client } from "pg";
import { encryptBackup, decryptBackup } from "./operations/backup-crypto.mjs";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const [mode, file] = process.argv.slice(2);
if (!["create", "restore-test"].includes(mode) || !file)
  throw new Error(
    "Uso: pnpm backup create /caminho-seguro/copia.nvb | pnpm backup restore-test /caminho-seguro/copia.nvb",
  );
const target = resolve(file),
  secret = process.env.BACKUP_PASSPHRASE;
if (!secret || secret.length < 32)
  throw new Error("Configure BACKUP_PASSPHRASE com pelo menos 32 caracteres.");
const url =
  mode === "create"
    ? process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    : process.env.RESTORE_TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "Configure a ligação directa da origem ou RESTORE_TEST_DATABASE_URL da base isolada.",
  );
const db = new URL(url);
if (db.hostname.includes("-pooler"))
  throw new Error("Use uma ligação directa, sem -pooler.");
const env = {
  ...process.env,
  PGHOST: db.hostname,
  PGPORT: db.port || "5432",
  PGDATABASE: decodeURIComponent(db.pathname.slice(1)),
  PGUSER: decodeURIComponent(db.username),
  PGPASSWORD: decodeURIComponent(db.password),
  PGSSLMODE: db.searchParams.get("sslmode") || "require",
};
function run(command, args, input) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
      }),
      chunks = [];
    let length = 0;
    child.stdout.on("data", (b) => {
      length += b.length;
      if (length > 512 * 1024 * 1024) {
        child.kill();
        fail(
          new Error(
            "Cópia acima de 512 MB. Usar procedimento de backup contínuo da infraestrutura.",
          ),
        );
      } else chunks.push(b);
    });
    child.stderr.resume();
    child.on("error", () =>
      fail(
        new Error(
          command +
            " indisponível. Instale as ferramentas PostgreSQL compatíveis.",
        ),
      ),
    );
    child.on("close", (code) =>
      code === 0
        ? done(Buffer.concat(chunks))
        : fail(
            new Error(
              command +
                " falhou. Consulte a monitorização protegida da infraestrutura.",
            ),
          ),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
if (mode === "create") {
  const raw = await run("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--schema=public",
  ]);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, encryptBackup(raw, secret), {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    "Cópia cifrada criada. Teste o restauro numa base isolada e guarde a chave separadamente.",
  );
} else {
  if (process.env.RESTORE_CONFIRM !== "RESTORE_TO_ISOLATED_DATABASE")
    throw new Error(
      "Defina RESTORE_CONFIRM=RESTORE_TO_ISOLATED_DATABASE apenas para o ensaio isolado.",
    );
  const production =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (production) {
    const original = new URL(production);
    if (
      original.hostname.replace("-pooler", "") ===
        db.hostname.replace("-pooler", "") &&
      original.pathname === db.pathname
    )
      throw new Error(
        "O destino coincide com a origem. Restauro de produção bloqueado.",
      );
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const q = await client.query(
      "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') LIMIT 1",
    );
    if (q.rowCount)
      throw new Error(
        "O ensaio só pode usar uma base vazia. Não foram apagados dados.",
      );
  } finally {
    await client.end();
  }
  const raw = decryptBackup(await readFile(target), secret);
  await run(
    "pg_restore",
    [
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
      "--no-acl",
      "--dbname=" + env.PGDATABASE,
    ],
    raw,
  );
  console.log(
    "Restauro de ensaio concluído. Verifique contagens, vínculos e acesso antes de aprovar o plano de recuperação.",
  );
}

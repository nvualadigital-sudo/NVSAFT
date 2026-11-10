import { Client } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
try {
  process.loadEnvFile(resolve(root, ".env"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const connection =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connection) {
  console.error(
    "Configure DATABASE_URL no ambiente do servidor da API. Não cole a ligação no chat.",
  );
  process.exitCode = 2;
} else {
  const client = new Client({
    connectionString: connection,
    connectionTimeoutMillis: 8000,
    query_timeout: 10000,
  });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const exists = (
      await client.query(
        "SELECT to_regclass('public.hospital_migrations') AS ref",
      )
    ).rows[0].ref;
    const rows = exists
      ? (
          await client.query(
            "SELECT name,sha256 FROM public.hospital_migrations",
          )
        ).rows
      : [];
    const applied = new Map(rows.map((x) => [x.name, x.sha256]));
    let pending = 0,
      conflicts = 0;
    for (const name of (await readdir(resolve(root, "migrations")))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const content = await readFile(resolve(root, "migrations", name));
      const hash = createHash("sha256").update(content).digest("hex");
      if (!applied.has(name)) {
        console.log("Por aplicar: " + name);
        pending++;
      } else if (applied.get(name) !== hash) {
        console.error(
          "Conflito: a migração aplicada difere do ficheiro " + name,
        );
        conflicts++;
      }
    }
    await client.query("COMMIT");
    console.log(
      `Verificação sem alterações: ${pending} migrações por aplicar; ${conflicts} conflitos.`,
    );
    if (pending || conflicts) {
      process.exitCode = 2;
      console.log(
        conflicts
          ? "Concilie as migrações sem apagar o histórico nem alterar os hashes da base."
          : "Execute pnpm db:migrate no servidor com esta versão do código; depois repita pnpm db:status.",
      );
    }
  } catch (e) {
    console.error(
      "Não foi possível verificar a base. Confirme a ligação configurada no ambiente e a disponibilidade do servidor. Código: " +
        (e.code || "ligacao"),
    );
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

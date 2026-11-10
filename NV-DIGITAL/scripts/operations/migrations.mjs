import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
export function splitSQL(source) {
  const result = [];
  let current = "",
    mode = "",
    dollar = "",
    depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i],
      next = source[i + 1];
    if (mode === "line") {
      current += c;
      if (c === "\n") mode = "";
      continue;
    }
    if (mode === "comment") {
      current += c;
      if (c === "/" && next === "*") {
        depth++;
        current += next;
        i++;
      } else if (c === "*" && next === "/") {
        current += next;
        i++;
        if (--depth === 0) mode = "";
      }
      continue;
    }
    if (mode === "single" || mode === "double") {
      current += c;
      const quote = mode === "single" ? "'" : '"';
      if (c === quote) {
        if (next === quote) {
          current += next;
          i++;
        } else mode = "";
      }
      continue;
    }
    if (mode === "dollar") {
      if (source.startsWith(dollar, i)) {
        current += dollar;
        i += dollar.length - 1;
        mode = "";
      } else current += c;
      continue;
    }
    if (c === "-" && next === "-") {
      mode = "line";
      current += c + next;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      mode = "comment";
      depth = 1;
      current += c + next;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      mode = c === "'" ? "single" : "double";
      current += c;
      continue;
    }
    if (c === "$") {
      const match = source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) {
        dollar = match[0];
        mode = "dollar";
        current += dollar;
        i += dollar.length - 1;
        continue;
      }
    }
    if (c === ";") {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else current += c;
  }
  if (mode && mode !== "line")
    throw new Error("SQL com literal ou comentário não terminado.");
  if (current.trim()) result.push(current.trim());
  return result;
}
export async function applyMigrations(
  client,
  directory = "migrations",
  report = console.log,
) {
  await client.query("SELECT pg_advisory_lock(804127654)");
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS public.hospital_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir(directory))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const source = await readFile(directory + "/" + name, "utf8"),
        hash = createHash("sha256").update(source).digest("hex"),
        old = await client.query(
          "SELECT sha256 FROM public.hospital_migrations WHERE name=$1",
          [name],
        );
      if (old.rows[0]) {
        if (old.rows[0].sha256 !== hash)
          throw new Error("Uma migração aplicada foi alterada: " + name);
        continue;
      }
      await client.query("BEGIN");
      try {
        for (const statement of splitSQL(source)) {
          if (/^\s*(BEGIN|COMMIT)\s*$/i.test(statement)) continue;
          const constraint = statement.match(/ADD CONSTRAINT ([a-z_]+)/i);
          if (constraint) {
            const exists = await client.query(
              "SELECT 1 FROM pg_constraint WHERE conname=$1 AND connamespace='public'::regnamespace",
              [constraint[1]],
            );
            if (exists.rows.length) continue;
          }
          await client.query(statement);
        }
        await client.query(
          "INSERT INTO public.hospital_migrations(name,sha256) VALUES($1,$2)",
          [name, hash],
        );
        await client.query("COMMIT");
        report("Aplicada: " + name);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(804127654)").catch(() => {});
  }
}

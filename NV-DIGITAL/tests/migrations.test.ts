import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, copyFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  applyMigrations,
  splitSQL,
} from "../scripts/operations/migrations.mjs";
test("versioned migrations install an empty database, replay safely and roll back a failing change", async () => {
  const pg = new PGlite(),
    directory = await mkdtemp(join(tmpdir(), "nv-migration-"));
  try {
    for (const name of await readdir("migrations"))
      if (name.endsWith(".sql"))
        await copyFile("migrations/" + name, directory + "/" + name);
    await applyMigrations(pg, directory, () => {});
    const tables = await pg.query<any>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
    );
    assert.ok(tables.rows.some((x) => x.table_name === "nv_lab_containers"));
    assert.ok(tables.rows.some((x) => x.table_name === "pacientes"));
    await pg.query(
      "INSERT INTO empresas(nome,username,password) VALUES('Instituição fictícia','migration-test','test')",
    );
    await applyMigrations(pg, directory, () => {});
    assert.equal(
      (await pg.query<any>("SELECT count(*) AS n FROM empresas")).rows[0].n,
      1,
    );
    await writeFile(
      directory + "/99999999_invalid.sql",
      "CREATE TABLE public.should_roll_back(id int); INSERT INTO public.missing_table VALUES(1);",
    );
    await assert.rejects(applyMigrations(pg, directory, () => {}));
    assert.equal(
      (
        await pg.query<any>(
          "SELECT to_regclass('public.should_roll_back') AS ref",
        )
      ).rows[0].ref,
      null,
    );
    await rm(directory + "/99999999_invalid.sql");
    const first = (await readdir(directory))
      .filter((x) => x.endsWith(".sql"))
      .sort()[0];
    await writeFile(directory + "/" + first, "-- modified after application");
    await assert.rejects(
      applyMigrations(pg, directory, () => {}),
      /alterada/,
    );
  } finally {
    await pg.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("migration parsing preserves semicolons in quoted SQL and procedural bodies", () => {
  const source =
    "SELECT ';'; -- comment ;\n DO $$ BEGIN PERFORM 1; END $$; SELECT 'a'';b'; /* ; */ SELECT 2;";
  assert.equal(splitSQL(source).length, 4);
  assert.throws(() => splitSQL("SELECT 'unclosed"));
});

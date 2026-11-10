import { writeFile } from "node:fs/promises";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import * as schema from "../lib/db/src/schema/index";
const dialect = new PgDialect(),
  tables = Object.values(schema),
  statements = [
    "-- Base SQL gerada a partir do schema Drizzle existente. Apenas CREATE IF NOT EXISTS e relações NOT VALID.",
  ];
for (const table of tables) {
  const cfg = getTableConfig(table as any);
  const cols = cfg.columns.map((c) => {
    let d = "";
    if (c.default !== undefined) {
      const def = c.default;
      d =
        " DEFAULT " +
        (def instanceof SQL ||
        (def && typeof def === "object" && "queryChunks" in def)
          ? dialect.sqlToQuery(def as any).sql
          : typeof def === "string"
            ? "'" + def.replaceAll("'", "''") + "'"
            : typeof def === "object"
              ? "'" + JSON.stringify(def).replaceAll("'", "''") + "'::jsonb"
              : String(def));
    }
    return (
      '"' +
      c.name +
      '" ' +
      c.getSQLType() +
      (c.primary ? " PRIMARY KEY" : "") +
      (c.notNull ? " NOT NULL" : "") +
      d +
      (c.isUnique ? " UNIQUE" : "")
    );
  });
  statements.push(
    'CREATE TABLE IF NOT EXISTS public."' +
      cfg.name +
      '" (' +
      cols.join(",") +
      ");",
  );
}
for (const table of tables) {
  const cfg = getTableConfig(table as any);
  for (const fk of cfg.foreignKeys) {
    const ref = fk.reference(),
      target = getTableConfig(ref.foreignTable as any);
    statements.push(
      'ALTER TABLE public."' +
        cfg.name +
        '" ADD CONSTRAINT ' +
        fk.getName() +
        " FOREIGN KEY(" +
        ref.columns.map((c) => '"' + c.name + '"').join(",") +
        ') REFERENCES public."' +
        target.name +
        '"(' +
        ref.foreignColumns.map((c) => '"' + c.name + '"').join(",") +
        ") NOT VALID;",
    );
  }
}
await writeFile(
  "migrations/00000000_schema_base.sql",
  statements.join("\n") + "\n",
);

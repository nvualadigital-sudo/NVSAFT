import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export let pool = new Pool({ connectionString: process.env.DATABASE_URL });
export let db = drizzle(pool, { schema });

export * from "./schema";

export function setDatabaseForTests(
  database: typeof db,
  testPool: typeof pool,
) {
  if (process.env.NODE_ENV !== "test") throw new Error("Apenas em testes.");
  db = database;
  pool = testPool;
}

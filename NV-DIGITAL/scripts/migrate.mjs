import { Client } from "pg";
import { applyMigrations } from "./operations/migrations.mjs";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("Configure DATABASE_URL_UNPOOLED para migrar.");
if (new URL(url).hostname.includes("-pooler"))
  throw new Error("A migração exige a ligação directa, sem -pooler.");
const client = new Client({ connectionString: url });
await client.connect();
try {
  await applyMigrations(client);
} finally {
  await client.end();
}

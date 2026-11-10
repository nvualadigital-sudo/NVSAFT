const CORE = [
  "nv_billing_settings",
  "nv_cash_sessions",
  "nv_cash_entries",
  "nv_billing_requests",
  "nv_receivable_entries",
];
const AGT = ["nv_agt_profiles", "nv_agt_jobs", "nv_agt_replacements"];
const POS = [
  "nv_pharmacy_pos_stock",
  "nv_pharmacy_pos_sales",
  "nv_pharmacy_pos_items",
];
export async function billingReadiness(db: any, pharmacy = false) {
  const required = [...CORE, ...AGT, ...(pharmacy ? POS : [])];
  const rows = (
    await db.query(
      "SELECT name,to_regclass('public.'||name)::text AS ref FROM unnest($1::text[]) AS name",
      [required],
    )
  ).rows;
  const missing = rows.filter((r: any) => !r.ref).map((r: any) => r.name);
  return { ready: missing.length === 0, missing };
}
export async function assertBillingReady(db: any, pharmacy = false) {
  const result = await billingReadiness(db, pharmacy);
  if (!result.ready)
    throw Object.assign(
      new Error(
        "A base de dados ainda não recebeu as migrações desta versão. Execute pnpm db:migrate no servidor da API e volte a carregar este módulo.",
      ),
      { status: 503, publicCode: "database_update_required" },
    );
}

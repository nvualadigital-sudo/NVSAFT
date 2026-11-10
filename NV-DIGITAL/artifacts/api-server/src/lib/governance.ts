import { createHash } from "node:crypto";
import type { TokenPayload } from "./auth.js";
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const deny = (message: string, status = 400): never => {
  throw new DomainError(status, message);
};
export function value(x: unknown, max = 2000, optional = false): string {
  if (optional && (x === undefined || x === null || x === "")) return "";
  if (typeof x !== "string" || !x.trim() || x.trim().length > max)
    return deny("Campo obrigatório ou demasiado longo.");
  return x.trim();
}
export function uuid(x: unknown): string {
  if (
    typeof x !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      x,
    )
  )
    return deny("Identificador inválido.");
  return x;
}
export function allowed(u: TokenPayload, roles: string[]) {
  if (!roles.includes(u.funcao || ""))
    deny("A sua função não está autorizada para esta operação.", 403);
}
export async function granted(c: any, u: TokenPayload, permission: string) {
  const q = await c.query(
    "SELECT 1 FROM public.nv_grants WHERE empresa_id=$1 AND actor=$2 AND permission=$3 AND revoked_at IS NULL AND expires_at>now()",
    [u.empresaId, u.username, permission],
  );
  if (!q.rowCount)
    deny("É necessária uma autorização vigente: " + permission + ".", 403);
  if (permission.startsWith("lab.")) {
    const credential = (
      await c.query(
        "SELECT p.data FROM public.nv_professionals p JOIN public.funcionarios f ON f.id=p.funcionario_id AND f.empresa_id=p.empresa_id WHERE p.empresa_id=$1 AND f.username=$2 AND f.ativo",
        [u.empresaId, u.username],
      )
    ).rows[0]?.data;
    if (
      !credential ||
      credential.status !== "activo" ||
      !credential.verifiedBy ||
      new Date(credential.validUntil).getTime() <= Date.now()
    )
      deny("Credencial profissional suspensa ou expirada.", 403);
  }
}
export async function transaction<T>(
  pool: any,
  org: string,
  fn: (c: any) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["nv:" + org]);
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function event(
  c: any,
  u: TokenPayload,
  action: string,
  reference: string,
  details: any = {},
) {
  // Caller holds the per-institution transaction lock. No clinical text in the chain.
  const prior =
    (
      await c.query(
        "SELECT hash FROM public.nv_audit WHERE empresa_id=$1 ORDER BY id DESC LIMIT 1",
        [u.empresaId],
      )
    ).rows[0]?.hash || "";
  const at = new Date().toISOString();
  const hash = auditDigest(
    prior,
    u.empresaId!,
    u.username,
    action,
    reference,
    at,
    details,
  );
  await c.query(
    "INSERT INTO public.nv_audit(empresa_id,actor,action,reference,details,at,previous_hash,hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [u.empresaId, u.username, action, reference, details, at, prior, hash],
  );
}
function canonical(x: any): any {
  return Array.isArray(x)
    ? x.map(canonical)
    : x && typeof x === "object"
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canonical(x[k])]),
        )
      : x;
}
export function auditDigest(
  prior: string,
  org: string,
  actor: string,
  action: string,
  reference: string,
  at: string,
  details: any,
) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonical([prior, org, actor, action, reference, at, details]),
      ),
    )
    .digest("hex");
}
export function apiErrors(err: any, _req: any, res: any, _next: any) {
  const status =
    err instanceof DomainError
      ? err.status
      : ["23503", "23505", "23514"].includes(err?.code)
        ? 409
        : 500;
  res
    .status(status)
    .json({
      error:
        err instanceof DomainError
          ? err.message
          : status === 409
            ? "Conflito de referências, estado ou identificação. Actualize e confira os dados."
            : "A operação não foi confirmada pelo servidor.",
    });
}
export async function patient(c: any, org: string, id: unknown) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0)
    deny("Seleccione um paciente do cadastro.");
  const q = await c.query(
    "SELECT id,nome,nasc,processo FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
    [org, id],
  );
  return q.rows[0] || deny("Paciente indisponível nesta instituição.", 404);
}
export async function episode(
  c: any,
  org: string,
  id: unknown,
  patientId: number,
) {
  if (!id) return null;
  uuid(id);
  const q = await c.query(
    "SELECT data FROM public.hospital_state WHERE empresa_id=$1 AND namespace='clinical'",
    [org],
  );
  const visit = q.rows[0]?.data?.visits?.find(
    (v: any) => v.id === id && String(v.patient?.id) === String(patientId),
  );
  if (!visit) deny("O episódio não corresponde ao paciente/instituição.", 409);
  return id;
}

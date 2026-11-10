import { LAB_STAFF_DELEGATIONS, STAFF_ACCESS_ROLES } from "@workspace/api-zod";
import { randomUUID } from "node:crypto";
import type { TokenPayload } from "./auth.js";
import { deny, value } from "./governance.js";
import { event } from "./governance.js";
import { institutionSignatories } from "./document-signatories.js";

export function accessRole(input: unknown) {
  if (!(STAFF_ACCESS_ROLES as readonly unknown[]).includes(input))
    deny("Perfil de acesso desconhecido.");
  return input as string;
}
export function imageData(input: unknown): string {
  if (!input) return "";
  if (typeof input !== "string" || input.length > 280000)
    deny("Use PNG/JPEG até 200 KB para assinatura ou carimbo.");
  const match = (input as string).match(
    /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match)
    return deny("Assinatura/carimbo precisa de uma imagem PNG ou JPEG.");
  const bytes = Buffer.from(match[2], "base64");
  if (
    bytes.length > 200 * 1024 ||
    (match[1] === "png"
      ? bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
      : bytes.subarray(0, 3).toString("hex") !== "ffd8ff")
  )
    deny("Imagem de assinatura/carimbo inválida.");
  return input as string;
}
export function professionalData(input: any, previous: any = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    deny("Ficha profissional inválida.");
  const result: any = { ...previous };
  for (const [key, max] of Object.entries({
    category: 150,
    specialties: 500,
    credential: 200,
    service: 200,
    contract: 200,
    employeeCode: 80,
    phone: 60,
    email: 160,
    qualification: 200,
    position: 150,
    credentialAuthority: 200,
  }))
    if (Object.hasOwn(input, key)) result[key] = value(input[key], max, true);
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    deny("Email profissional inválido.");
  if (Object.hasOwn(input, "validUntil")) {
    if (
      input.validUntil &&
      (typeof input.validUntil !== "string" ||
        !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(
          input.validUntil,
        ))
    )
      deny("Validade profissional inválida.");
    if (input.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(input.validUntil)) {
      const day = new Date(input.validUntil);
      if (
        !Number.isFinite(day.getTime()) ||
        day.toISOString().slice(0, 10) !== input.validUntil
      )
        deny("Validade profissional não corresponde a uma data de calendário.");
    }

    if (!input.validUntil) result.validUntil = "";
    else if (
      /^\d{4}-\d{2}-\d{2}$/.test(input.validUntil) &&
      previous.validUntil?.startsWith(input.validUntil)
    )
      result.validUntil = previous.validUntil;
    else {
      const date = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(input.validUntil)
          ? input.validUntil + "T23:59:59.999Z"
          : input.validUntil,
      );
      if (!Number.isFinite(date.getTime()))
        deny("Validade profissional inválida.");
      result.validUntil = date.toISOString();
    }
  }
  for (const key of ["signatureData", "stampData"])
    if (Object.hasOwn(input, key)) result[key] = imageData(input[key]);
  if (Object.hasOwn(input, "requestedLabPermissions")) {
    const requested = input.requestedLabPermissions;
    if (
      !Array.isArray(requested) ||
      requested.length > LAB_STAFF_DELEGATIONS.length ||
      requested.some(
        (permission: unknown) =>
          !(LAB_STAFF_DELEGATIONS as readonly unknown[]).includes(permission),
      )
    )
      deny("A nomeação laboratorial contém competências desconhecidas.");
    result.requestedLabPermissions = [...new Set(requested)];
  }
  return result;
}
export const verifiedProfessional = (data: any) =>
  Boolean(
    data?.status === "activo" &&
    data?.verifiedBy &&
    data?.credential &&
    Number.isFinite(new Date(data.validUntil).getTime()) &&
    new Date(data.validUntil).getTime() > Date.now(),
  );

/**
 * Keep the laboratory checkboxes and their effective, audited grants in sync.
 * Staff registration may save proposals before the credential is verified;
 * verification activates them without another administrative action.
 */
export async function syncLabStaffPermissions(
  c: any,
  u: TokenPayload,
  staff: { username: string; role: string; active: boolean; profile: any },
) {
  const requested: string[] = staff.profile?.requestedLabPermissions || [];
  const eligible = ["tecnico", "medico"].includes(staff.role);
  if (requested.includes("lab.validate.solo") && staff.role !== "tecnico")
    deny("A substituição excepcional exige um técnico habilitado.");
  if (requested.length && !eligible)
    deny("Só um técnico ou médico habilitado pode receber estas competências.");
  const rows = (
    await c.query(
      "SELECT id,permission,expires_at FROM public.nv_grants WHERE empresa_id=$1 AND actor=$2 AND permission = ANY($3::text[]) AND revoked_at IS NULL AND expires_at>now() FOR UPDATE",
      [u.empresaId, staff.username, LAB_STAFF_DELEGATIONS],
    )
  ).rows;
  const valid = staff.active && eligible && verifiedProfessional(staff.profile);
  const active = new Set(rows.map((row: any) => row.permission));
  const revoked: string[] = [];
  for (const row of rows) {
    if (valid && requested.includes(row.permission)) continue;
    await c.query(
      "UPDATE public.nv_grants SET revoked_at=now() WHERE empresa_id=$1 AND id=$2 AND revoked_at IS NULL",
      [u.empresaId, row.id],
    );
    await event(c, u, "access.revoke", row.id, {
      actor: staff.username,
      permission: row.permission,
      origin: "staff.permissions",
    });
    revoked.push(row.permission);
    active.delete(row.permission);
  }
  if (!valid) return { active: [], pending: requested, revoked };
  const missing = requested.filter((permission) => !active.has(permission));
  if (missing.length && u.username === staff.username)
    deny("A nomeação da própria conta exige outro responsável.", 403);
  for (const permission of missing) {
    const expiresAt = new Date(Math.min(
      Date.now() + (permission === "lab.validate.solo" ? 90 : 365) * 86400000,
      new Date(staff.profile.validUntil).getTime(),
    )).toISOString();
    const row = (
      await c.query(
        "INSERT INTO public.nv_grants(id,empresa_id,actor,permission,reason,granted_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
        [
          randomUUID(),
          u.empresaId,
          staff.username,
          permission,
          permission === "lab.validate.solo"
            ? "Nomeação excepcional de técnico único na ficha profissional; cada libertação exige justificação e avaliação de risco."
            : "Permissão seleccionada na ficha profissional e credencial verificada.",
          u.username,
          expiresAt,
        ],
      )
    ).rows[0];
    await event(c, u, "access.grant", row.id, {
      actor: staff.username,
      permission,
      origin: "staff.permissions",
    });
    active.add(permission);
  }
  return { active: [...active], pending: [], revoked };
}
export async function professionalFor(c: any, u: TokenPayload) {
  return (
    (
      await c.query(
        "SELECT f.id,f.nome,f.username,f.funcao,f.ativo,p.data,p.revision FROM public.funcionarios f LEFT JOIN public.nv_professionals p ON p.empresa_id=f.empresa_id AND p.funcionario_id=f.id WHERE f.empresa_id=$1 AND f.username=$2",
        [u.empresaId, u.username],
      )
    ).rows[0] || null
  );
}
export async function issuerFor(
  c: any,
  u: TokenPayload,
  role: "medico" | "enfermeiro",
) {
  const who = await professionalFor(c, u);
  if (
    !who ||
    !who.ativo ||
    who.funcao !== role ||
    !verifiedProfessional(who.data)
  )
    deny(
      "Registe e verifique a credencial profissional vigente desta conta individual antes de emitir documentos.",
      409,
    );
  const d = who.data;
  return {
    name: who.nome,
    username: who.username,
    funcionarioId: who.id,
    category: d.category,
    specialties: d.specialties,
    credential: d.credential,
    credentialAuthority: d.credentialAuthority || "",
    service: d.service,
    position: d.position || "",
    signatureData: imageData(d.signatureData),
    stampData: imageData(d.stampData),
    verifiedBy: d.verifiedBy,
    verifiedAt: d.verifiedAt || "",
  };
}
export async function invalidateProfessional(
  c: any,
  org: string,
  actor: string,
) {
  await c.query(
    "UPDATE public.auth_sessions SET revoked_at=now() WHERE empresa_id=$1 AND actor=$2",
    [org, actor],
  );
  await c.query(
    "UPDATE public.nv_grants SET revoked_at=now() WHERE empresa_id=$1 AND actor=$2 AND revoked_at IS NULL",
    [org, actor],
  );
}
export async function institutionFor(c: any, u: TokenPayload) {
  const institution = (
    await c.query(
      "SELECT nome_clinica AS name,nif,endereco AS address,telefone AS phone,logo_data AS logo FROM public.config WHERE empresa_id=$1",
      [u.empresaId],
    )
  ).rows[0] || { name: u.empresaNome || "Instituição" };
  const signatories = await institutionSignatories(c, u.empresaId!);
  const kind = u.funcao === "enfermeiro" ? "nursing" : "clinical";
  return {
    ...institution,
    signatories: signatories[kind] ? { [kind]: signatories[kind] } : {},
  };
}
export async function captureClinicalIssuers(
  c: any,
  u: TokenPayload,
  previous: any,
  data: any,
) {
  for (const [collection, kind] of [
    ["prescriptions", "prescription"],
    ["documents", "medical"],
  ]) {
    for (const item of data[collection] || []) {
      const old = previous[collection]?.find((x: any) => x.id === item.id);
      const emitted =
        kind === "prescription" ? !old : item.finalized && !old?.finalized;
      if (!emitted) continue;
      const visit = data.visits?.find((v: any) => v.id === item.visitId);
      if (!visit || String(visit.patient?.id) !== String(item.patient?.id))
        deny("O paciente do documento deve corresponder ao episódio.", 409);
      if (kind === "medical") {
        value(item.title, 200);
        value(item.text, 20000);
        item.finalized = new Date().toISOString();
      } else item.created = new Date().toISOString();
      const issuer = await issuerFor(c, u, "medico");
      item.doctor = issuer.name;
      item.registration = issuer.credential;
      const institution = await institutionFor(c, u);
      await c.query(
        "INSERT INTO public.nv_professional_documents(empresa_id,id,source_kind,patient_id,issuer,institution,state,created_by,issued_at) VALUES($1,$2,$3,$4,$5,$6,'issued',$7,now())",
        [
          u.empresaId,
          item.id,
          kind,
          Number(item.patient?.id),
          issuer,
          institution,
          u.username,
        ],
      );
      await event(c, u, "professional.document.issue", item.id, { kind });
    }
  }
}

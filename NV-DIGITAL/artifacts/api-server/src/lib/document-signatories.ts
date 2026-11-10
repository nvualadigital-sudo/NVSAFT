import { imageData, verifiedProfessional } from "./professionals.js";
export const SIGNATORY_ROLES = {
  clinical: "medico",
  nursing: "enfermeiro",
} as const;
export async function institutionSignatories(c: any, org: string) {
  const rows = (
    await c.query(
      "SELECT s.kind,f.id,f.nome,f.funcao,f.ativo,p.data FROM public.nv_document_signatories s JOIN public.funcionarios f ON f.id=s.funcionario_id AND f.empresa_id=s.empresa_id LEFT JOIN public.nv_professionals p ON p.funcionario_id=f.id AND p.empresa_id=f.empresa_id WHERE s.empresa_id=$1",
      [org],
    )
  ).rows;
  const result: Record<string, any> = {};
  for (const row of rows)
    if (
      row.ativo &&
      row.funcao ===
        SIGNATORY_ROLES[row.kind as keyof typeof SIGNATORY_ROLES] &&
      verifiedProfessional(row.data)
    )
      result[row.kind] = {
        funcionarioId: row.id,
        name: row.nome,
        credential: row.data.credential,
        position: row.data.position || "",
        signatureData: imageData(row.data.signatureData),
        stampData: imageData(row.data.stampData),
      };
  return result;
}

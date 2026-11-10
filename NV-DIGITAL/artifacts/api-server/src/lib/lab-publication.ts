import { deny } from "./governance.js";

/** Staff-only projection. Patient/partner publication continues to require release. */
export const STAFF_REPORT_SQL = `SELECT r.*,
  v.data AS manual_data,v.version AS manual_version,v.entered_by AS manual_entered_by,
  v.technical_at AS manual_technical_at,v.released_at AS manual_released_at,
  v.technical_by AS manual_technical_by,v.released_by AS manual_released_by,
  t.id AS test_id,t.order_id,t.snapshot AS test_snapshot,
  o.accession,o.patient_snapshot->>'processo' AS process_reference,
  lv.data AS value_data,lv.version AS value_version,lv.entered_by AS value_entered_by,
  lv.technical_at AS value_technical_at,lv.released_at AS value_released_at,
  lv.technical_by AS value_technical_by,lv.released_by AS value_released_by,
  sc.code AS sample_code
  FROM public.resultados r
  LEFT JOIN LATERAL(SELECT * FROM public.nv_lab_report_versions v WHERE v.empresa_id=r.empresa_id AND v.resultado_id=r.id ORDER BY version DESC LIMIT 1) v ON true
  LEFT JOIN public.nv_lab_tests t ON t.empresa_id=r.empresa_id AND t.result_id=r.id
  LEFT JOIN public.nv_lab_orders o ON o.empresa_id=t.empresa_id AND o.id=t.order_id
  LEFT JOIN LATERAL(SELECT * FROM public.nv_lab_values lv WHERE lv.empresa_id=t.empresa_id AND lv.test_id=t.id ORDER BY version DESC LIMIT 1) lv ON true
  LEFT JOIN public.nv_lab_containers sc ON sc.empresa_id=lv.empresa_id AND sc.id=lv.container_id`;

export const OWNED_REPORT_SQL = `r.empresa_id=$1 AND (r.paciente_id IS NULL OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.empresa_id=r.empresa_id AND p.id=r.paciente_id))`;

export function staffReport(row: any) {
  const managed = Boolean(row.test_id);
  const version = managed ? row.value_version : row.manual_version;
  const released = managed ? row.value_released_at : row.manual_released_at;
  const technical = managed ? row.value_technical_at : row.manual_technical_at;
  const state =
    version != null
      ? released
        ? "pronto"
        : technical
          ? "revisao"
          : "rascunho"
      : row.data_emissao
        ? "legado"
        : "rascunho";
  const provisional = state === "rascunho" || state === "revisao";
  const result = {
    id: row.id,
    pacienteId: row.paciente_id,
    pacienteNome: row.paciente_nome,
    data: row.data,
    dataEmissao: row.data_emissao,
    parametros: row.parametros,
    tecnicoNome: row.tecnico_nome,
    solicitacaoId: row.solicitacao_id,
    ...(!managed && row.manual_data ? row.manual_data : {}),
    ...(managed && row.value_data
      ? {
          parametros: [
            {
              exame: row.test_snapshot.name,
              parametro: row.test_snapshot.name,
              resultado: row.value_data.measured,
              unidade: row.value_data.unit || "",
              referencia: row.value_data.reference || "",
            },
          ],
          tecnicoNome: row.value_entered_by,
        }
      : {}),
    reviewState: state,
    reviewVersion: version ?? 0,
  };
  if (provisional) result.dataEmissao = "";
  const trace = {
    ...(managed
      ? {
          orderId: row.order_id,
          accession: row.accession,
          processo: row.process_reference,
          sampleCode: row.sample_code,
          technicalBy: row.value_technical_by,
          releasedBy: row.value_released_by,
        }
      : {
          source: "manual",
          technicalBy: row.manual_technical_by,
          releasedBy: row.manual_released_by,
        }),
    version: version ?? 0,
    reviewState: state,
    provisional,
  };
  return {
    result,
    version: version ?? 0,
    state,
    trace,
    managed: managed
      ? {
          testId: row.test_id,
          orderId: row.order_id,
          accession: row.accession,
          sampleCode: row.sample_code,
        }
      : null,
    enteredBy: managed ? row.value_entered_by : row.manual_entered_by,
  };
}

export async function readStaffReport(c: any, org: string, id: number) {
  const row = (
    await c.query(
      STAFF_REPORT_SQL + " WHERE " + OWNED_REPORT_SQL + " AND r.id=$2",
      [org, id],
    )
  ).rows[0];
  if (!row) deny("Resultado indisponível nesta instituição.", 404);
  return staffReport(row);
}

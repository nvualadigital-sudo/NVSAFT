import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "pg";
import type { ClinicalOverview } from "@workspace/api-zod";
import { getUser } from "../lib/auth.js";
import {
  allowed,
  apiErrors,
  deny,
  episode,
  patient,
} from "../lib/governance.js";

const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const measurement = (value: unknown): string =>
  typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : text(value);
const date = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : text(value);

/** Reads the existing clinical, nursing and laboratory records; never creates a parallel record. */
export function createClinicalOverviewRouter(pool: Pool) {
  const r = Router();
  r.get("/clinical-overview/:patientId", async (req, res) => {
    res
      .set("Cache-Control", "private, no-store")
      .vary("Authorization")
      .vary("Cookie");
    const user = getUser(req);
    allowed(user, ["admin", "gestor", "medico", "enfermeiro"]);
    const org = user.empresaId!;
    const patientId = Number(req.params.patientId);
    if (
      !/^\d+$/.test(String(req.params.patientId)) ||
      !Number.isSafeInteger(patientId) ||
      patientId <= 0 ||
      patientId > 2147483647
    )
      deny("Identificador de paciente inválido.");
    if (
      req.query.episodeId !== undefined &&
      typeof req.query.episodeId !== "string"
    )
      deny("Identificador de atendimento inválido.");
    const requestedEpisode = req.query.episodeId || null;
    const c = await pool.connect();
    let result: ClinicalOverview;
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await patient(c, org, patientId);
      const episodeId = requestedEpisode
        ? String(await episode(c, org, requestedEpisode, patientId))
        : null;
      const p = (
        await c.query(
          "SELECT id,nome,nasc,sexo,processo,bi,alergias,patologias_cronicas FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
          [org, patientId],
        )
      ).rows[0];
      const clinical =
        (
          await c.query(
            "SELECT data FROM public.hospital_state WHERE empresa_id=$1 AND namespace='clinical'",
            [org],
          )
        ).rows[0]?.data || {};
      const visits = list(clinical.visits).filter(
        (v) =>
          String(v.patient?.id) === String(patientId) &&
          (!episodeId || v.id === episodeId),
      );
      const visitIds = new Set(visits.map((v) => v.id));
      const belongs = (row: any) =>
        String(row.patient?.id) === String(patientId) &&
        visitIds.has(row.visitId);
      const tests = (
        await c.query(
          `SELECT t.id,t.snapshot,t.result_id,o.id AS order_id,o.episode_id,o.accession,o.priority,o.created_at,o.created_by,o.cancelled_at,
                v.data AS result_data,v.version,v.released_at
         FROM public.nv_lab_orders o
         JOIN public.nv_lab_tests t ON t.empresa_id=o.empresa_id AND t.order_id=o.id
         LEFT JOIN LATERAL (SELECT x.data,x.version,x.released_at FROM public.nv_lab_values x
                            WHERE x.empresa_id=t.empresa_id AND x.test_id=t.id ORDER BY x.version DESC LIMIT 1) v ON true
         WHERE o.empresa_id=$1 AND o.patient_id=$2 AND ($3::uuid IS NULL OR o.episode_id=$3)
         ORDER BY o.created_at DESC,t.id`,
          [org, patientId, episodeId],
        )
      ).rows;
      // Earlier reports have no provable episode link; expose them only in the patient's history.
      const legacy = episodeId
        ? []
        : (
            await c.query(
              `SELECT r.id,r.data,r.data_emissao,r.parametros FROM public.resultados r
         WHERE r.empresa_id=$1 AND r.paciente_id=$2
           AND NOT EXISTS(SELECT 1 FROM public.nv_lab_tests t WHERE t.empresa_id=r.empresa_id AND t.result_id=r.id)
         ORDER BY r.id DESC`,
              [org, patientId],
            )
          ).rows;
      const nursing =
        (
          await c.query(
            "SELECT body FROM public.nursing_integrated_state WHERE empresa_id=$1",
            [org],
          )
        ).rows[0]?.body || {};
      const triages = new Set(visits.map((v) => v.triageId).filter(Boolean));
      result = {
        empresaId: org,
        patient: {
          id: String(p.id),
          name: text(p.nome),
          birthDate: text(p.nasc),
          sex: text(p.sexo),
          processNumber: text(p.processo),
          document: text(p.bi),
          allergies: text(p.alergias),
          conditions: text(p.patologias_cronicas),
        },
        episodeId,
        visits: visits
          .map((v) => ({
            id: v.id,
            started: text(v.started),
            closed: text(v.closed),
            doctor: text(v.doctor),
            specialty: text(v.specialty),
            diagnosis: text(v.diagnosis),
            subjective: text(v.subjective),
            objective: text(v.objective),
            assessment: text(v.assessment),
            plan: text(v.plan),
            followup: text(v.followup),
          }))
          .sort((a, b) => b.started.localeCompare(a.started)),
        prescriptions: list(clinical.prescriptions)
          .filter(belongs)
          .map((rx) => ({
            id: rx.id,
            visitId: rx.visitId,
            created: text(rx.created),
            doctor: text(rx.doctor),
            validUntil: text(rx.validUntil),
            cancelled: text(rx.cancelled),
            items: list(rx.items).map((item) => ({
              id: item.id,
              name: text(item.name),
              dose: text(item.dose),
              route: text(item.route),
              frequency: text(item.frequency),
              duration: text(item.duration),
              quantity: Number(item.quantity) || 0,
              unit: text(item.unit),
              dispensed: list(clinical.deliveries)
                .filter(
                  (d) => d.prescriptionId === rx.id && d.itemId === item.id,
                )
                .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0),
            })),
          }))
          .sort((a, b) => b.created.localeCompare(a.created)),
        documents: list(clinical.documents)
          .filter(belongs)
          .map((d) => ({
            id: d.id,
            visitId: d.visitId,
            title: text(d.title),
            kind: text(d.kind),
            created: text(d.created),
            finalized: text(d.finalized),
            voided: text(d.voided),
          }))
          .sort((a, b) => b.created.localeCompare(a.created)),
        laboratory: [
          ...tests.map((t) => ({
            id: t.id,
            orderId: t.order_id,
            episodeId: t.episode_id,
            accession: t.accession,
            name: text(t.snapshot?.name),
            requestedAt: date(t.created_at),
            requestedBy: text(t.created_by),
            priority: t.priority,
            cancelled: Boolean(t.cancelled_at),
            value: t.result_data ? measurement(t.result_data.measured) : null,
            unit: text(t.result_data?.unit ?? t.snapshot?.unit),
            reference: text(t.result_data?.reference ?? t.snapshot?.reference),
            version: t.version || null,
            released: Boolean(t.released_at),
            reportId: t.result_id || null,
            legacy: false,
          })),
          ...legacy.flatMap((r) =>
            list(r.parametros).map((parameter, index) => ({
              id: `legacy:${r.id}:${index}`,
              orderId: null,
              episodeId: null,
              accession: "",
              name: text(parameter.parametro || parameter.exame),
              requestedAt: text(r.data),
              requestedBy: "",
              priority: "rotina",
              cancelled: false,
              value: measurement(parameter.resultado),
              unit: text(parameter.unidade),
              reference: text(parameter.referencia),
              version: null,
              released: Boolean(r.data_emissao),
              reportId: r.id,
              legacy: true,
            })),
          ),
        ],
        nursing: list(nursing.observations)
          .filter(
            (o) =>
              String(o.patientId) === String(patientId) &&
              (!episodeId || triages.has(o.id)),
          )
          .map((o) => ({
            id: o.id,
            kind: text(o.kind),
            at: text(o.at),
            author: text(o.author),
            values: Object.fromEntries(
              Object.entries(o.values || {}).filter(
                ([, v]) => typeof v === "string" || typeof v === "number",
              ),
            ) as Record<string, string | number>,
          }))
          .sort((a, b) => b.at.localeCompare(a.at)),
      };
      await c.query("COMMIT");
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    } finally {
      c.release();
    }
    await pool.query(
      "INSERT INTO public.hospital_audit(id,empresa_id,actor,action,reference) VALUES($1,$2,$3,'clinical.overview.read',$4)",
      [
        randomUUID(),
        org,
        user.username,
        JSON.stringify({ patientId, episodeId: result.episodeId }),
      ],
    );
    res.json(result);
  });
  r.use(apiErrors);
  return r;
}

import { randomUUID } from "node:crypto";
import { type ClinicalState, emptyState } from "../src/integrated/model";
import { type ClinicalStore } from "./nursingRouter";
import { DomainError } from "./domain";
export interface Queryable {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: any[]; rowCount?: number | null }>;
}
export interface HostPool extends Queryable {
  connect(): Promise<Queryable & { release(): void }>;
}
/** Adapter for the inspected NVUALASOFT_Integrado schema. No separate stock database. */
export class HostPostgresStore implements ClinicalStore {
  constructor(private pool: HostPool) {}
  private async hydrate(
    c: Queryable,
    tenant: string,
    s: ClinicalState,
    lock = false,
  ) {
    const patients = await c.query(
      "SELECT id,nome,nasc,sexo,processo,alergias,patologias_cronicas FROM public.pacientes WHERE empresa_id=$1 ORDER BY id" +
        (lock ? " FOR UPDATE" : ""),
      [tenant],
    );
    s.patients = patients.rows.map((p) => ({
      id: String(p.id),
      code: p.processo || `PAC-${p.id}`,
      name: p.nome,
      birthDate: p.nasc,
      sex: p.sexo,
      allergies: p.alergias || "Desconhecidas",
      conditions: p.patologias_cronicas || "",
    }));
    const batches = await c.query(
      "SELECT * FROM public.hospital_pharmacy WHERE empresa_id=$1 AND active=true ORDER BY id" +
        (lock ? " FOR UPDATE" : ""),
      [tenant],
    );
    for (const b of batches.rows) {
      let d = s.drugs.find((x) => x.sourceCode === b.code);
      if (!d) {
        d = {
          id: `central-${b.code}`,
          sourceCode: b.code,
          name: b.name,
          ingredient: "",
          strength: "Por validar",
          unit: "Por validar",
          highAlert: false,
          needsReview: true,
        };
        s.drugs.push(d);
      }
    }
    s.batches = batches.rows.map((b) => ({
      id: b.id,
      drugId: s.drugs.find((d) => d.sourceCode === b.code)!.id,
      lot: b.lot,
      expires:
        b.expiry instanceof Date
          ? b.expiry.toISOString().slice(0, 10)
          : String(b.expiry).slice(0, 10),
      quantity: Number(b.stock),
    }));
    return s;
  }
  async read(tenant: string) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const q = await c.query(
        "SELECT body FROM public.nursing_integrated_state WHERE empresa_id=$1",
        [tenant],
      );
      const s = await this.hydrate(c, tenant, q.rows[0]?.body || emptyState());
      await c.query("COMMIT");
      return s;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async command(
    tenant: string,
    requestId: string,
    revision: number,
    run: (s: ClinicalState) => ClinicalState,
  ) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "INSERT INTO public.nursing_integrated_state(empresa_id,body) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [tenant, JSON.stringify(emptyState())],
      );
      const q = await c.query(
        "SELECT body FROM public.nursing_integrated_state WHERE empresa_id=$1 FOR UPDATE",
        [tenant],
      );
      let s = await this.hydrate(c, tenant, q.rows[0].body, true);
      const duplicate = await c.query(
        "SELECT 1 FROM public.nursing_integrated_requests WHERE empresa_id=$1 AND request_id=$2",
        [tenant, requestId],
      );
      if (duplicate.rows.length) {
        await c.query("COMMIT");
        return s;
      }
      if (s.revision !== revision)
        throw new DomainError(
          "O processo foi actualizado por outro profissional. Actualize e confirme novamente.",
          409,
        );
      const before = structuredClone(s);
      s = run(s);
      // Patient IDs remain the serial IDs used by the existing registration, medical and billing modules.
      for (const p of s.patients) {
        const old = before.patients.find((x) => x.id === p.id);
        if (!old) {
          const inserted = await c.query(
            "INSERT INTO public.pacientes(empresa_id,nome,nasc,sexo,alergias,patologias_cronicas) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,processo",
            [
              tenant,
              p.name,
              p.birthDate,
              p.sex === "Masculino" ? "M" : p.sex === "Feminino" ? "F" : p.sex,
              p.allergies,
              p.conditions,
            ],
          );
          const previousId = p.id;
          p.id = String(inserted.rows[0].id);
          p.code = inserted.rows[0].processo;
          for (const event of s.audit)
            if (event.entityId === previousId) event.entityId = p.id;
        } else if (
          old.allergies !== p.allergies ||
          old.conditions !== p.conditions
        ) {
          await c.query(
            "UPDATE public.pacientes SET alergias=$3,patologias_cronicas=$4 WHERE empresa_id=$1 AND id=$2",
            [tenant, Number(p.id), p.allergies, p.conditions],
          );
        }
      }
      for (const b of s.batches) {
        const old = before.batches.find((x) => x.id === b.id),
          d = s.drugs.find((x) => x.id === b.drugId)!;
        if (Math.abs(b.quantity - Number(b.quantity.toFixed(3))) > 1e-8)
          throw new DomainError(
            "O stock central admite até três casas decimais. Reveja as unidades.",
          );
        if (!old) {
          d.sourceCode ||= `NUR-${d.id}`;
          await c.query(
            "INSERT INTO public.hospital_pharmacy(id,empresa_id,code,name,lot,expiry,stock,minimum,price) VALUES($1,$2,$3,$4,$5,$6,$7,0,0)",
            [b.id, tenant, d.sourceCode, d.name, b.lot, b.expires, b.quantity],
          );
        } else if (old.quantity !== b.quantity) {
          await c.query(
            "UPDATE public.hospital_pharmacy SET stock=$3 WHERE empresa_id=$1 AND id=$2",
            [tenant, b.id, b.quantity],
          );
        }
        const delta = b.quantity - (old?.quantity || 0);
        if (delta !== 0) {
          const event = s.audit.at(-1)!;
          await c.query(
            "INSERT INTO public.hospital_pharmacy_moves(id,empresa_id,product_id,quantity,reason,actor,request_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [
              randomUUID(),
              tenant,
              b.id,
              delta,
              `Enfermagem integrada: ${event.action}`,
              event.actor,
              randomUUID(),
            ],
          );
        }
      }
      const event = s.audit.at(-1)!;
      await c.query(
        "INSERT INTO public.hospital_audit(id,empresa_id,actor,action,reference) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          tenant,
          event.actor,
          `nursing.${event.action}`,
          event.entityId,
        ],
      );
      await c.query(
        "UPDATE public.nursing_integrated_state SET body=$2,updated_at=now() WHERE empresa_id=$1",
        [tenant, JSON.stringify(s)],
      );
      await c.query(
        "INSERT INTO public.nursing_integrated_requests(empresa_id,request_id) VALUES($1,$2)",
        [tenant, requestId],
      );
      await c.query("COMMIT");
      return s;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}

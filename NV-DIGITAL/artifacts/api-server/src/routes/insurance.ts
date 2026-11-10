import { Router } from "express";
import { createHash, randomUUID } from "node:crypto";
import { pool as productionPool } from "@workspace/db";
import { INSURANCE_EXPORT_COLUMNS } from "@workspace/api-zod";
import { getUser, requireEmpresa } from "../lib/auth.js";
import {
  allowed,
  apiErrors,
  deny,
  event,
  patient,
  uuid,
  value,
  DomainError,
} from "../lib/governance.js";
import {
  contractData,
  dateOnly,
  insuranceCatalogue,
  insuranceQuote,
  insuredInvoice,
  money,
  numberIn,
  refreshClaimState,
  todayISO,
  validateCatalogue,
  ensurePrivateAccount,
  legacyPatientEntries,
} from "../lib/insurance.js";
export async function insuranceTransaction<T>(
  pool: any,
  org: string,
  fn: (c: any) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "billing:" + org,
    ]);
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
const finance = ["admin", "gestor", "financeiro", "rececionista"],
  costRoles = ["admin", "gestor", "financeiro"],
  care = [...finance, "medico", "enfermeiro", "tecnico"];
const withoutCost = (q: any) => ({
  ...q,
  internalCost: undefined,
  contract: {
    ...q.contract,
    rates: q.contract?.rates?.map((r: any) => ({
      ...r,
      internalCost: undefined,
    })),
  },
  acts: q.acts?.map((a: any) => ({
    ...a,
    internalCost: undefined,
    cost: undefined,
  })),
});
export async function enrichInsuredInvoices(c: any, org: string, rows: any[]) {
  const sums = (
    await c.query(
      "SELECT f.id AS invoice_id, EXISTS(SELECT 1 FROM public.nv_insurance_claims x WHERE x.empresa_id=f.empresa_id AND x.invoice_id=f.id) AS insured, coalesce(sum(e.debit-e.credit),0) AS balance, (SELECT coalesce(sum(greatest(z.balance,0)),0) FROM (SELECT sum(x.debit-x.credit) AS balance FROM public.nv_receivable_entries x WHERE x.empresa_id=f.empresa_id AND x.invoice_id=f.id GROUP BY x.party_type,x.party_id) z) AS outstanding, coalesce(sum(CASE WHEN e.kind='payment' THEN e.credit-e.debit ELSE 0 END),0) AS received FROM public.faturas f LEFT JOIN public.nv_receivable_entries e ON e.empresa_id=f.empresa_id AND e.invoice_id=f.id WHERE f.empresa_id=$1 AND f.id=ANY($2::int[]) GROUP BY f.empresa_id,f.id HAVING count(e.id)>0 OR EXISTS(SELECT 1 FROM public.nv_insurance_claims x WHERE x.empresa_id=f.empresa_id AND x.invoice_id=f.id)",
      [org, rows.map((r) => Number(r.id))],
    )
  ).rows;
  const map = new Map(sums.map((s: any) => [Number(s.invoice_id), s]));
  return rows.map((row) => {
    const s: any = map.get(Number(row.id));
    return s
      ? {
          ...row,
          insured: s.insured,
          receivableBalance: money(Number(s.outstanding)),
          insuredBalance: s.insured ? money(Number(s.balance)) : undefined,
          cashReceived: money(Number(s.received)),
        }
      : row;
  });
}
function environmentOf(filter: any) {
  const scope = filter.environment || "production";
  if (!["production", "homologacao"].includes(scope))
    deny("Âmbito financeiro inválido.");
  return scope;
}
const scopeSQL =
  "CASE WHEN f.billing_meta->>'ambiente'='homologacao' THEN 'homologacao' ELSE 'production' END";
async function report(c: any, u: any, filter: any) {
  const environment = environmentOf(filter);
  const from = filter.from ? dateOnly(filter.from) : "0001-01-01",
    to = filter.to ? dateOnly(filter.to) : "9999-12-31";
  if (from > to) deny("Período inválido.");
  const insurer = String(filter.insurerId || ""),
    pid = String(filter.patientId || ""),
    act = String(filter.act || "").toLocaleLowerCase(),
    service = String(filter.service || "").toLocaleLowerCase(),
    state = String(filter.state || "");
  const q = await c.query(
    "SELECT c.*,f.numero,f.estado FROM public.nv_insurance_claims c JOIN public.faturas f ON f.empresa_id=c.empresa_id AND f.id=c.invoice_id WHERE c.empresa_id=$1 AND ($2='' OR c.insurer_id=$2) AND ($3='' OR c.patient_id::text=$3) AND c.service_date >= $4::date AND c.service_date <= $5::date AND (" +
      scopeSQL +
      ")=$6 ORDER BY c.service_date,c.invoice_id LIMIT 10001",
    [u.empresaId, insurer, pid, from, to, environment],
  );
  if (q.rows.length > 10000)
    deny("Reduza o período do mapa para até 10.000 documentos.");
  const balances = (
    await c.query(
      "SELECT invoice_id,party_type,coalesce(sum(debit-credit),0) AS balance,coalesce(sum(CASE WHEN kind='payment' THEN credit ELSE 0 END),0) AS paid FROM public.nv_receivable_entries WHERE empresa_id=$1 GROUP BY invoice_id,party_type",
      [u.empresaId],
    )
  ).rows;
  const disputes = (
    await c.query(
      "SELECT * FROM public.nv_insurance_disputes WHERE empresa_id=$1 ORDER BY created_at DESC",
      [u.empresaId],
    )
  ).rows;
  const claims: any[] = [],
    acts: any[] = [];
  for (const row of q.rows) {
    const s = row.snapshot,
      insurance = balances.find(
        (b: any) =>
          b.invoice_id === row.invoice_id && b.party_type === "insurer",
      ),
      patientBalance = balances.find(
        (b: any) =>
          b.invoice_id === row.invoice_id && b.party_type === "patient",
      );
    const balance = money(
        Number(insurance?.balance || 0) + Number(patientBalance?.balance || 0),
      ),
      paid = money(
        Number(insurance?.paid || 0) + Number(patientBalance?.paid || 0),
      );
    const status =
      Number(insurance?.balance || 0) <= 0 &&
      Number(patientBalance?.balance || 0) <= 0
        ? "liquidada"
        : String(row.due_date).slice(0, 10) < todayISO()
          ? "vencida"
          : paid > 0
            ? "parcial"
            : "pendente";
    const selected = s.acts.filter(
      (a: any) =>
        (!act ||
          (a.code + " " + a.description).toLocaleLowerCase().includes(act)) &&
        (!service || a.service.toLocaleLowerCase().includes(service)),
    );
    if ((state && state !== status) || !selected.length) continue;
    claims.push({
      environment,
      invoiceId: row.invoice_id,
      number: row.numero,
      patientId: row.patient_id,
      insurerId: row.insurer_id,
      beneficiaryId: row.beneficiary_id,
      snapshot: costRoles.includes(u.funcao || "") ? s : withoutCost(s),
      status,
      balance,
      paid,
      insurerBalance: Number(insurance?.balance || 0),
      patientBalance: Number(patientBalance?.balance || 0),
      disputes: disputes.filter((d: any) => d.invoice_id === row.invoice_id),
    });
    for (const a of selected)
      acts.push({
        data: s.serviceDate,
        factura: row.numero,
        seguradora: s.insurer.nome,
        paciente: s.patient.nome,
        processo: s.patient.processo,
        cartao: s.beneficiary.cartao,
        apolice: s.beneficiary.apolice,
        plano: s.beneficiary.plano,
        acto: a.code,
        descricao: a.description,
        servico: a.service,
        profissional: a.professional,
        quantidade: a.quantity,
        preco: a.price,
        facturado: a.gross,
        responsabilidadeSeguradora: a.insurerAmount,
        responsabilidadePaciente: a.patientAmount,
        autorizacao: s.authorization,
        vencimento: s.dueDate,
        estado: status,
        ...(costRoles.includes(u.funcao || "")
          ? {
              custoInterno: a.cost,
              margem:
                a.cost === null ? null : money((a.net ?? a.gross) - a.cost),
            }
          : {}),
      });
  }
  return {
    environment,
    claims,
    acts,
    from,
    to,
    generatedAt: new Date().toISOString(),
    filters: { ...filter },
    summary: {
      invoices: claims.length,
      acts: acts.length,
      charged: money(acts.reduce((s, a) => s + a.facturado, 0)),
      insurer: money(
        acts.reduce((s, a) => s + a.responsabilidadeSeguradora, 0),
      ),
      patient: money(acts.reduce((s, a) => s + a.responsabilidadePaciente, 0)),
      balance: money(claims.reduce((s, a) => s + a.balance, 0)),
      paid: money(claims.reduce((s, a) => s + a.paid, 0)),
    },
  };
}
async function statement(c: any, u: any, b: any) {
  const environment = environmentOf(b);
  if (!["insurer", "patient"].includes(b.partyType))
    deny("Seleccione seguradora ou paciente para o extracto.");
  const id = value(b.partyId, 100),
    from = b.from ? dateOnly(b.from) : "0001-01-01",
    to = b.to ? dateOnly(b.to) : todayISO();
  if (from > to) deny("Período inválido.");
  let party: any;
  if (b.partyType === "patient")
    party = await patient(c, u.empresaId, Number(id));
  else {
    party = (await insuranceCatalogue(c, u.empresaId)).data.seguradoras.find(
      (s: any) => s.id === id,
    );
    if (!party) deny("Seguradora indisponível.", 404);
  }
  const previous = (
    await c.query(
      "SELECT coalesce(sum(e.debit-e.credit),0) AS balance FROM public.nv_receivable_entries e JOIN public.faturas f ON f.empresa_id=e.empresa_id AND f.id=e.invoice_id WHERE e.empresa_id=$1 AND e.party_type=$2 AND e.party_id=$3 AND e.occurred_on<$4::date AND (" +
        scopeSQL +
        ")=$5",
      [u.empresaId, b.partyType, id, from, environment],
    )
  ).rows[0];
  const q = await c.query(
    "SELECT e.id,e.invoice_id,e.occurred_on AS date,e.kind,e.debit,e.credit,e.reference,e.details,f.numero FROM public.nv_receivable_entries e JOIN public.faturas f ON f.empresa_id=e.empresa_id AND f.id=e.invoice_id WHERE e.empresa_id=$1 AND e.party_type=$2 AND e.party_id=$3 AND e.occurred_on >= $4::date AND e.occurred_on <= $5::date AND (" +
      scopeSQL +
      ")=$6 ORDER BY e.occurred_on,e.id LIMIT 10001",
    [u.empresaId, b.partyType, id, from, to, environment],
  );
  const legacy =
    b.partyType === "patient" && environment === "production"
      ? await legacyPatientEntries(c, u.empresaId, Number(id))
      : { rows: [], warnings: [] };
  let balance = money(
    Number(previous.balance) +
      legacy.rows
        .filter((r: any) => r.date < from)
        .reduce((sum: number, r: any) => sum + r.debit - r.credit, 0),
  );
  const opening = balance;
  const combined = [
    ...q.rows.map((r: any) => ({
      ...r,
      date: String(r.date).slice(0, 10),
      debit: Number(r.debit),
      credit: Number(r.credit),
    })),
    ...legacy.rows.filter((r: any) => r.date >= from && r.date <= to),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === "invoice" ? -1 : b.kind === "invoice" ? 1 : 0) ||
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
  );
  if (combined.length > 10000) deny("Reduza o período do extracto.");
  const current = (
    await c.query(
      "SELECT e.invoice_id,coalesce(sum(e.debit-e.credit),0) AS balance FROM public.nv_receivable_entries e JOIN public.faturas f ON f.empresa_id=e.empresa_id AND f.id=e.invoice_id WHERE e.empresa_id=$1 AND e.party_type=$2 AND e.party_id=$3 AND (" +
        scopeSQL +
        ")=$4 GROUP BY e.invoice_id",
      [u.empresaId, b.partyType, id, environment],
    )
  ).rows;
  const rows = combined.map((r: any) => {
    balance = money(balance + r.debit - r.credit);
    const recorded = current.find((x: any) => x.invoice_id === r.invoice_id);
    const invoiceBalance = recorded
      ? Number(recorded.balance)
      : money(
          legacy.rows
            .filter((x: any) => x.invoice_id === r.invoice_id)
            .reduce((s: number, x: any) => s + x.debit - x.credit, 0),
        );
    return { ...r, balance, invoiceBalance };
  });
  return {
    environment,
    party: { id, name: party.nome, type: b.partyType },
    from,
    to,
    opening,
    rows,
    closing: balance,
    warnings: legacy.warnings,
    generatedAt: new Date().toISOString(),
  };
}
export function createInsuranceRouter(pool: any = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use((req, _res, next) => {
    if (
      (req.path.startsWith("/insurance/") ||
        req.path === "/records/insurance") &&
      ["POST", "PUT"].includes(req.method) &&
      (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    )
      return next(new DomainError(400, "Corpo do pedido inválido."));
    next();
  });
  r.get("/records/insurance", async (req, res) => {
    const u = getUser(req);
    allowed(u, care);
    const row = await insuranceCatalogue(pool, u.empresaId!);
    res.json(row.revision ? [row] : []);
  });
  r.post("/records/insurance", async (req, res) => {
    const u = getUser(req);
    allowed(u, finance);
    if (req.body.id !== u.empresaId)
      deny("Cadastro pertence a outra instituição.", 403);
    res.json(
      await insuranceTransaction(pool, u.empresaId!, async (c) => {
        const old = await insuranceCatalogue(c, u.empresaId!);
        if (old.revision !== (req.body.revision || 0))
          deny("Cadastro alterado noutro posto; actualize a página.", 409);
        const data = await validateCatalogue(
          c,
          u.empresaId!,
          req.body.data,
          old.data,
        );
        for (const prior of old.data.seguradoras)
          if (!data.seguradoras.some((s: any) => s.id === prior.id))
            deny(
              "Desactive a seguradora para conservar os vínculos e extractos; não apague o cadastro.",
            );
        const row = (
          await c.query(
            "INSERT INTO public.hospital_records(id,empresa_id,kind,data,created_by) VALUES($1,$1,'insurance',$2,$3) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=hospital_records.revision+1,updated_at=now() WHERE hospital_records.empresa_id=excluded.empresa_id AND hospital_records.kind='insurance' RETURNING id,data,revision",
            [u.empresaId, data, u.username],
          )
        ).rows[0];
        if (!row) deny("Identificador de cadastro indisponível.", 409);
        await event(c, u, "insurance.catalogue.save", u.empresaId!);
        return row;
      }),
    );
  });
  r.get("/insurance/patients/:id/eligibility", async (req, res) => {
    const u = getUser(req);
    allowed(u, care);
    const p = await patient(pool, u.empresaId!, Number(req.params.id)),
      d = (await insuranceCatalogue(pool, u.empresaId!)).data;
    const members = d.assegurados.filter(
      (a: any) => String(a.pacienteId) === String(p.id),
    );
    res.json({
      patient: p,
      beneficiaries: members.map((a: any) => ({
        ...a,
        insurer: d.seguradoras.find((s: any) => s.id === a.seguradoraId),
      })),
    });
  });
  r.get("/insurance/contracts", async (req, res) => {
    const u = getUser(req);
    allowed(u, care);
    const rows = (
      await pool.query(
        "SELECT id,data,revision FROM public.nv_insurance_contracts WHERE empresa_id=$1 ORDER BY updated_at DESC",
        [u.empresaId],
      )
    ).rows;
    res.json(
      rows.map((x: any) => ({
        ...x.data,
        id: x.id,
        revision: x.revision,
        rates: x.data.rates.map((l: any) =>
          costRoles.includes(u.funcao || "")
            ? l
            : { ...l, internalCost: undefined },
        ),
      })),
    );
  });
  r.post("/insurance/contracts", async (req, res) => {
    const u = getUser(req);
    allowed(u, costRoles);
    const id = uuid(req.body.id),
      data = contractData(req.body);
    res.json(
      await insuranceTransaction(pool, u.empresaId!, async (c) => {
        if (
          !(await insuranceCatalogue(c, u.empresaId!)).data.seguradoras.some(
            (s: any) => s.id === data.insurerId,
          )
        )
          deny("Seguradora deste contrato não existe nesta instituição.", 404);
        const old = (
          await c.query(
            "SELECT revision FROM public.nv_insurance_contracts WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, id],
          )
        ).rows[0];
        if ((old?.revision || 0) !== (req.body.revision || 0))
          deny("Contrato alterado noutro posto.", 409);
        const row = (
          await c.query(
            "INSERT INTO public.nv_insurance_contracts(empresa_id,id,insurer_id,data,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(empresa_id,id) DO UPDATE SET data=excluded.data,insurer_id=excluded.insurer_id,revision=nv_insurance_contracts.revision+1,updated_by=excluded.updated_by,updated_at=now() RETURNING id,revision",
            [u.empresaId, id, data.insurerId, data, u.username],
          )
        ).rows[0];
        await event(c, u, "insurance.contract.save", id);
        return { ...data, ...row };
      }),
    );
  });
  r.post("/insurance/quote", async (req, res) => {
    const u = getUser(req);
    allowed(u, finance);
    const q = await insuranceQuote(pool, u.empresaId!, req.body, {
      integrated: req.body.engine === "integrated",
      rounding:
        req.body.engine === "integrated" &&
        (
          await pool.query(
            "SELECT data FROM public.nv_agt_profiles WHERE empresa_id=$1",
            [u.empresaId],
          )
        ).rows[0]?.data?.enabled === true
          ? "agt2"
          : "legacy",
    });
    res.json(costRoles.includes(u.funcao || "") ? q : withoutCost(q));
  });
  r.get("/insurance/report", async (req, res) => {
    const u = getUser(req);
    allowed(u, finance);
    res.json(await report(pool, u, req.query));
  });
  r.post("/insurance/statement", async (req, res) => {
    const u = getUser(req);
    allowed(u, finance);
    res.json(await statement(pool, u, req.body));
  });
  r.post("/insurance/export", async (req, res) => {
    const u = getUser(req);
    allowed(u, finance);
    if (
      !["csv", "xlsx", "pdf"].includes(req.body.format) ||
      !["production", "statement"].includes(req.body.kind)
    )
      deny("Formato de exportação desconhecido.");
    res.json(
      await insuranceTransaction(pool, u.empresaId!, async (c) => {
        const data =
          req.body.kind === "statement"
            ? await statement(c, u, req.body.filters || {})
            : await report(c, u, req.body.filters || {});
        await event(c, u, "insurance.export", req.body.kind, {
          format: req.body.format,
          filters: req.body.filters || {},
        });
        return data;
      }),
    );
  });
  // A cobrança tem de passar pelo mesmo motor, caixa e série dos documentos.
  r.post("/insurance/payments", (_req, res) => {
    res.status(409).json({
      error:
        "Utilize a cobrança integrada em /billing-v2/insurance/payments. O arquivo fiscal anterior é de consulta; não emita recibos reais por esta rota.",
    });
  });
  r.post("/insurance/disputes", async (req, res) => {
    const u = getUser(req);
    allowed(u, costRoles);
    const b = req.body,
      id = uuid(b.id),
      invoiceId = Number(b.invoiceId);
    res.json(
      await insuranceTransaction(pool, u.empresaId!, async (c) => {
        const claim = await insuredInvoice(c, u.empresaId!, invoiceId);
        if (!claim) deny("Factura indisponível.", 404);
        const amount = numberIn(b.amount, 0.01, claim.snapshot.insurerAmount),
          reason = value(b.reason, 1500);
        if (!["open", "contested", "resolved"].includes(b.status))
          deny("Situação de glosa inválida.");
        const resolution = value(b.resolution, 1500, true);
        if (b.status === "resolved" && !resolution)
          deny(
            "Indique como a glosa foi resolvida. Uma redução exige a nota de crédito correspondente.",
          );
        const old = (
          await c.query(
            "SELECT invoice_id,revision FROM public.nv_insurance_disputes WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, id],
          )
        ).rows[0];
        if (old && old.invoice_id !== invoiceId)
          deny("Não pode trocar a factura de uma glosa.", 409);
        if ((old?.revision || 0) !== (b.revision || 0))
          deny("Glosa alterada noutro posto. Actualize antes de rever.", 409);
        let creditId = null;
        if (b.creditInvoiceId) {
          creditId = Number(b.creditInvoiceId);
          const credit = (
            await c.query(
              "SELECT observacoes,tipo_documento,billing_meta FROM public.faturas WHERE empresa_id=$1 AND id=$2",
              [u.empresaId, creditId],
            )
          ).rows[0];
          if (
            credit?.tipo_documento !== "nota-credito" ||
            (!credit.observacoes?.includes("[ORIGEM:" + invoiceId + "]") &&
              credit.billing_meta?.documentoOrigem !==
                (
                  await c.query(
                    "SELECT numero FROM public.faturas WHERE empresa_id=$1 AND id=$2",
                    [u.empresaId, invoiceId],
                  )
                ).rows[0]?.numero)
          )
            deny("Nota de crédito não corresponde à factura desta glosa.");
        }
        await c.query(
          "INSERT INTO public.nv_insurance_disputes(empresa_id,id,invoice_id,amount,reason,status,resolution,credit_invoice_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(empresa_id,id) DO UPDATE SET amount=excluded.amount,reason=excluded.reason,status=excluded.status,resolution=excluded.resolution,credit_invoice_id=excluded.credit_invoice_id,revision=nv_insurance_disputes.revision+1",
          [
            u.empresaId,
            id,
            invoiceId,
            amount,
            reason,
            b.status,
            resolution,
            creditId,
            u.username,
          ],
        );
        await event(c, u, "insurance.dispute", id, {
          status: b.status,
          creditInvoiceId: creditId,
        });
        return { ok: true };
      }),
    );
  });
  r.get("/insurance/templates", async (req, res) => {
    const u = getUser(req);
    allowed(u, finance);
    res.json(
      (
        await pool.query(
          'SELECT insurer_id AS "insurerId",data,revision FROM public.nv_insurance_templates WHERE empresa_id=$1',
          [u.empresaId],
        )
      ).rows,
    );
  });
  r.post("/insurance/templates", async (req, res) => {
    const u = getUser(req);
    allowed(u, costRoles);
    const id = uuid(req.body.insurerId),
      b = req.body.data;
    if (
      !b ||
      !Array.isArray(b.columns) ||
      !b.columns.length ||
      b.columns.length > 40
    )
      deny("Defina as colunas do modelo.");
    const data = {
      name: value(b.name, 150),
      columns: b.columns.map((x: any) => {
        if (!(INSURANCE_EXPORT_COLUMNS as readonly string[]).includes(x.key))
          return deny("Coluna de exportação desconhecida.");
        return { key: x.key, label: value(x.label, 120) };
      }),
    };
    res.json(
      await insuranceTransaction(pool, u.empresaId!, async (c) => {
        if (
          !(await insuranceCatalogue(c, u.empresaId!)).data.seguradoras.some(
            (s: any) => s.id === id,
          )
        )
          deny("Seguradora indisponível.", 404);
        const old = (
          await c.query(
            "SELECT revision FROM public.nv_insurance_templates WHERE empresa_id=$1 AND insurer_id=$2",
            [u.empresaId, id],
          )
        ).rows[0];
        if ((old?.revision || 0) !== (req.body.revision || 0))
          deny("Modelo alterado noutro posto.", 409);
        const row = (
          await c.query(
            "INSERT INTO public.nv_insurance_templates(empresa_id,insurer_id,data,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(empresa_id,insurer_id) DO UPDATE SET data=excluded.data,revision=nv_insurance_templates.revision+1,updated_by=excluded.updated_by RETURNING revision",
            [u.empresaId, id, data, u.username],
          )
        ).rows[0];
        await event(c, u, "insurance.template", id);
        return { insurerId: id, data, ...row };
      }),
    );
  });
  r.use(apiErrors);
  return r;
}

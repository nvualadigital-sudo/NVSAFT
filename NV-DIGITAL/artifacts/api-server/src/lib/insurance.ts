import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import type { InsuranceContract, InsuranceQuote } from "@workspace/api-zod";
import { totals as billingTotals } from "./billing-engine.js";
import { deny, patient, value, uuid } from "./governance.js";
export const money = (v: number) =>
  Math.round((v + Number.EPSILON) * 100) / 100;
export function dateOnly(x: unknown) {
  const s = String(x || "");
  const d = /^\d{2}\/\d{2}\/\d{4}$/.test(s)
    ? s.slice(6) + "-" + s.slice(3, 5) + "-" + s.slice(0, 2)
    : s;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    !Number.isFinite(new Date(d).getTime()) ||
    new Date(d).toISOString().slice(0, 10) !== d
  )
    return deny("Data de calendário inválida.");
  return d;
}
export const todayISO = () => new Date().toISOString().slice(0, 10);
export function numberIn(x: any, min: number, max: number) {
  if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max)
    return deny("Valor financeiro fora dos limites.");
  return money(x);
}
export async function insuranceCatalogue(c: any, org: string) {
  return (
    (
      await c.query(
        "SELECT id,data,revision FROM public.hospital_records WHERE empresa_id=$1 AND kind='insurance' AND id=$1",
        [org],
      )
    ).rows[0] || {
      id: org,
      data: { version: 1, seguradoras: [], assegurados: [] },
      revision: 0,
    }
  );
}
export async function validateCatalogue(
  c: any,
  org: string,
  d: any,
  previous: any = { assegurados: [] },
) {
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.seguradoras) ||
    !Array.isArray(d.assegurados) ||
    d.seguradoras.length > 1000 ||
    d.assegurados.length > 10000
  )
    deny("Cadastro de seguradoras inválido.");
  const insurers: any[] = [],
    members: any[] = [];
  for (const s of d.seguradoras) {
    const x: any = { id: uuid(s.id) };
    for (const k of ["nome", "nif", "contacto", "email", "contrato"])
      x[k] = value(s[k], 300, k !== "nome");
    x.cobertura = numberIn(s.cobertura, 0, 100);
    if (
      !Number.isInteger(s.prazo) ||
      s.prazo < 0 ||
      s.prazo > 3650 ||
      typeof s.activa !== "boolean"
    )
      deny("Prazo ou situação da seguradora inválidos.");
    x.prazo = s.prazo;
    x.activa = s.activa;
    insurers.push(x);
  }
  if (
    new Set(insurers.map((s) => s.id)).size !== insurers.length ||
    new Set(insurers.map((s) => s.nome.toLocaleLowerCase())).size !==
      insurers.length
  )
    deny("Seguradoras duplicadas.");
  for (const a of d.assegurados) {
    const prior = previous.assegurados.find((x: any) => x.id === a.id);
    if (prior && isDeepStrictEqual(prior, a)) {
      const patientId = Number(a.pacienteId),
        existing = Number.isSafeInteger(patientId)
          ? (
              await c.query(
                "SELECT nome FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
                [org, patientId],
              )
            ).rows[0]
          : null;
      if (!existing || existing.nome !== a.nome) {
        members.push({ ...a, unlinked: true });
        continue;
      }
    }
    const x: any = { id: uuid(a.id), seguradoraId: uuid(a.seguradoraId) };
    if (!insurers.some((s) => s.id === x.seguradoraId))
      deny("Seguradora do vínculo não existe.");
    const raw = value(a.pacienteId, 100),
      p = (
        await c.query(
          "SELECT id,nome,processo FROM public.pacientes WHERE empresa_id=$1 AND (id::text=$2 OR processo=$2) ORDER BY CASE WHEN id::text=$2 THEN 0 ELSE 1 END",
          [org, raw],
        )
      ).rows;
    const canonical =
      p.find((row: any) => String(row.id) === raw) ||
      (p.length === 1 ? p[0] : null);
    if (!canonical)
      deny(
        "Associe cada assegurado ao ID único de um paciente desta instituição; repare o vínculo com a pesquisa de pacientes.",
      );
    x.pacienteId = String(canonical.id);
    x.nome = canonical.nome;
    x.processo = canonical.processo;
    for (const k of ["apolice", "cartao", "plano"])
      x[k] = value(a[k], 200, k !== "cartao");
    x.inicio = dateOnly(a.inicio);
    x.fim = dateOnly(a.fim);
    if (x.fim < x.inicio || typeof a.activo !== "boolean")
      deny("Validade ou situação do vínculo inválidas.");
    x.activo = a.activo;
    x.cobertura = numberIn(a.cobertura, 0, 100);
    x.relationship = ["titular", "dependente"].includes(a.relationship)
      ? a.relationship
      : "titular";
    members.push(x);
  }
  if (
    new Set(members.map((a) => a.id)).size !== members.length ||
    new Set(
      members.map((a) => a.seguradoraId + ":" + a.cartao.toLocaleLowerCase()),
    ).size !== members.length
  )
    deny("Cartão duplicado na seguradora.");
  return { version: 1, seguradoras: insurers, assegurados: members };
}
export async function syncRegistrationInsurance(
  c: any,
  org: string,
  actor: string,
  p: any,
  a: any,
) {
  if (a.tipo !== "assegurado") return;
  const row = await insuranceCatalogue(c, org),
    d = row.data,
    s = d.seguradoras.find((s: any) => s.id === a.seguradoraId);
  if (!s?.activa) deny("Seleccione uma seguradora activa do cadastro.");
  const start = dateOnly(a.inicio),
    end = dateOnly(a.fim);
  if (end < start) deny("Validade do cartão inválida.");
  value(a.cartao, 200);
  const coverage = numberIn(Number(a.cobertura), 0, 100);
  const old = d.assegurados.find(
    (b: any) => b.seguradoraId === a.seguradoraId && b.cartao === a.cartao,
  );
  if (
    old &&
    String(old.pacienteId) !== String(p.id) &&
    String(old.pacienteId) !== p.processo
  )
    deny("Este cartão está associado a outro paciente.", 409);
  const member = {
    id: old?.id || randomUUID(),
    pacienteId: String(p.id),
    nome: p.nome,
    processo: p.processo,
    seguradoraId: s.id,
    apolice: String(a.apolice || ""),
    cartao: a.cartao,
    plano: String(a.plano || ""),
    inicio: start,
    fim: end,
    cobertura: coverage,
    activo: true,
    relationship: old?.relationship || "titular",
  };
  const next = {
    ...d,
    assegurados: [
      ...d.assegurados.filter((b: any) => b.id !== member.id),
      member,
    ],
  };
  const saved = await c.query(
    "INSERT INTO public.hospital_records(id,empresa_id,kind,data,created_by) VALUES($1,$1,'insurance',$2,$3) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=hospital_records.revision+1,updated_at=now() WHERE hospital_records.empresa_id=excluded.empresa_id AND hospital_records.kind='insurance' RETURNING id",
    [org, next, actor],
  );
  if (!saved.rowCount)
    deny(
      "Identificador do cadastro indisponível; a gravação foi anulada.",
      409,
    );
}
export function contractData(
  b: any,
): Omit<InsuranceContract, "id" | "revision"> {
  const start = dateOnly(b.start),
    end = dateOnly(b.end);
  if (
    end < start ||
    typeof b.active !== "boolean" ||
    typeof b.requiresAuthorization !== "boolean" ||
    !Array.isArray(b.rates) ||
    !b.rates.length ||
    b.rates.length > 1000
  )
    deny("Contrato, vigência ou tabela de actos inválidos.");
  const rates = b.rates.map((l: any) => ({
    code: value(l.code, 80),
    description: value(l.description, 300),
    service: value(l.service, 150),
    price: numberIn(l.price, 0, 1e10),
    coverage: numberIn(l.coverage, 0, 100),
    internalCost:
      l.internalCost === null || l.internalCost === ""
        ? null
        : numberIn(l.internalCost, 0, 1e10),
    maxCovered:
      l.maxCovered === null || l.maxCovered === ""
        ? null
        : numberIn(l.maxCovered, 0, 1e10),
  }));
  if (new Set(rates.map((l: any) => l.code)).size !== rates.length)
    deny("Códigos de acto duplicados no contrato.");
  return {
    insurerId: uuid(b.insurerId),
    name: value(b.name, 200),
    start,
    end,
    active: b.active,
    requiresAuthorization: b.requiresAuthorization,
    rates,
  };
}
export async function insuranceQuote(
  c: any,
  org: string,
  b: any,
  options: { integrated?: boolean; rounding?: "legacy" | "agt2" } = {},
): Promise<InsuranceQuote> {
  const selection = b.insurance;
  if (!selection) deny("Seleccione o vínculo e contrato deste atendimento.");
  await patient(c, org, Number(b.pacienteId));
  const p = (
      await c.query(
        "SELECT id,nome,nasc,processo,nif,bi,endereco FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
        [org, Number(b.pacienteId)],
      )
    ).rows[0],
    catalog = (await insuranceCatalogue(c, org)).data;
  const member = catalog.assegurados.find(
      (x: any) =>
        x.id === selection.beneficiaryId &&
        String(x.pacienteId) === String(p.id),
    ),
    insurer = catalog.seguradoras.find(
      (x: any) => x.id === member?.seguradoraId,
    );
  const serviceDate = dateOnly(selection.serviceDate);
  if (serviceDate > todayISO())
    deny("Não registe como realizado um acto com data futura.");
  if (member?.unlinked)
    deny(
      "Repare a associação deste vínculo no cadastro de assegurados antes de facturar.",
      409,
    );
  if (
    !member?.activo ||
    !insurer?.activa ||
    !member.inicio ||
    !member.fim ||
    dateOnly(member.inicio) > serviceDate ||
    dateOnly(member.fim) < serviceDate
  )
    deny("Vínculo inexistente, suspenso ou sem validade na data do acto.", 409);
  const row = (
    await c.query(
      "SELECT id,data,revision FROM public.nv_insurance_contracts WHERE empresa_id=$1 AND id=$2",
      [org, uuid(selection.contractId)],
    )
  ).rows[0];
  if (
    !row ||
    row.data.insurerId !== insurer.id ||
    !row.data.active ||
    row.data.start > serviceDate ||
    row.data.end < serviceDate
  )
    deny("Contrato sem vigência nesta seguradora/data.", 409);
  const contract = {
      ...row.data,
      id: row.id,
      revision: row.revision,
    } as InsuranceContract,
    authorization = value(selection.authorization, 200, true);
  if (contract.requiresAuthorization && !authorization)
    deny("Este contrato exige autorização da seguradora.");
  if (
    !Array.isArray(b.linhas) ||
    !b.linhas.length ||
    b.linhas.length > 1000 ||
    !Array.isArray(selection.acts) ||
    selection.acts.length !== b.linhas.length
  )
    deny("Associe um código de acto contratado a cada linha da factura.");
  const discount = numberIn(Number(b.desconto || 0), 0, 100),
    tax = numberIn(Number(b.ivaTaxa || 0), 0, 100);
  const calculated = options.integrated
    ? billingTotals({ ...b, tipoDocumento: "factura" }, options.rounding)
    : null;
  let total = 0,
    insurerAmount = 0,
    internalCost: number | null = 0;
  const acts = b.linhas.map((l: any, index: number) => {
    const meta = selection.acts[index],
      rate =
        contract.rates.find((r) => r.code === meta.code) ??
        deny("O acto não pertence à tabela contratada.");
    const quantity = Number(l.quantidade);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e6)
      deny("Quantidade inválida no acto.");
    if (
      !Number.isFinite(Number(l.precoUnitario)) ||
      Math.abs(Number(l.precoUnitario) - rate.price) > 0.001
    )
      deny(
        "O preço da linha difere da tabela contratada. Aplique o preço do contrato antes de emitir.",
      );
    const base = calculated
        ? calculated.linhas[index].baseLiquida
        : quantity * rate.price * (1 - discount / 100),
      gross = calculated
        ? money(base + calculated.linhas[index].ivaValor)
        : money(base * (l.ivaIsento ? 1 : 1 + tax / 100));
    if (!Number.isFinite(gross) || gross > 1e12)
      deny("O acto ultrapassa o limite financeiro suportado.");
    const coverage = Math.min(
      numberIn(Number(rate.coverage), 0, 100),
      numberIn(Number(member.cobertura), 0, 100),
      numberIn(Number(insurer.cobertura), 0, 100),
    );
    const share = money(
      Math.min(
        (gross * coverage) / 100,
        rate.maxCovered === null ? Infinity : rate.maxCovered * quantity,
      ),
    );
    const cost =
      rate.internalCost === null ? null : money(rate.internalCost * quantity);
    if (cost === null) internalCost = null;
    else if (internalCost !== null) internalCost += cost;
    total += gross;
    insurerAmount += share;
    return {
      ...rate,
      coverage,
      quantity,
      net: money(base),
      tax: money(gross - base),
      gross,
      insurerAmount: share,
      patientAmount: money(gross - share),
      cost,
      professional: value(meta.professional, 200),
      index,
    };
  });
  total = money(total);
  insurerAmount = money(insurerAmount);
  // Align per-line rounding with the invoice's aggregate IVA calculation (at most a few cents).
  const invoiceBase = acts.reduce(
      (n: number, a: any) => n + a.quantity * a.price,
      0,
    ),
    invoiceTax = acts.reduce(
      (n: number, a: any, i: number) =>
        n + (b.linhas[i].ivaIsento ? 0 : (a.quantity * a.price * tax) / 100),
      0,
    );
  const expected =
    calculated?.total ??
    money(
      money(invoiceBase * (1 - discount / 100)) +
        money(invoiceTax * (1 - discount / 100)),
    );
  if (
    b.total !== undefined &&
    (!Number.isFinite(Number(b.total)) ||
      Math.abs(Number(b.total) - expected) > 0.02)
  )
    deny("A simulação do seguro não corresponde ao total da factura.");
  if (expected < 0 || expected > 1e12)
    deny("Total do seguro fora do limite suportado.");
  {
    let cents = Math.round((expected - total) * 100);
    if (Math.abs(cents) > acts.length + 2)
      deny("A simulação do seguro não corresponde ao total da factura.");
    for (
      let i = acts.length - 1;
      cents !== 0;
      i = (i - 1 + acts.length) % acts.length
    ) {
      const a = acts[i],
        step = cents > 0 ? 1 : -1;
      if (step < 0 && a.gross <= 0) continue;
      const gross = money(a.gross + step / 100),
        share = money(
          Math.min(
            (gross * a.coverage) / 100,
            a.maxCovered === null ? Infinity : a.maxCovered * a.quantity,
          ),
        );
      insurerAmount = money(insurerAmount + share - a.insurerAmount);
      a.gross = gross;
      a.tax = money(gross - a.net);
      a.insurerAmount = share;
      a.patientAmount = money(gross - share);
      cents -= step;
    }
    total = expected;
  }

  const issued = dateOnly(b.data || todayISO()),
    due = new Date(issued + "T00:00:00Z");
  due.setUTCDate(due.getUTCDate() + Number(insurer.prazo || 0));
  return {
    insurer: { ...insurer },
    beneficiary: { ...member },
    patient: p,
    contract: {
      ...contract,
      rates: contract.rates.filter((r) =>
        acts.some((a: any) => a.code === r.code),
      ),
    },
    authorization,
    serviceDate,
    dueDate: due.toISOString().slice(0, 10),
    acts,
    total,
    insurerAmount,
    patientAmount: money(total - insurerAmount),
    internalCost: internalCost === null ? null : money(internalCost),
  };
}
export async function insuredInvoice(c: any, org: string, id: number) {
  return (
    (
      await c.query(
        "SELECT * FROM public.nv_insurance_claims WHERE empresa_id=$1 AND invoice_id=$2",
        [org, id],
      )
    ).rows[0] || null
  );
}
export async function recordInsuredInvoice(
  c: any,
  u: any,
  invoice: any,
  quote: InsuranceQuote,
) {
  const issued = dateOnly(invoice.data);
  await c.query(
    "INSERT INTO public.nv_insurance_claims(empresa_id,invoice_id,patient_id,insurer_id,beneficiary_id,snapshot,service_date,due_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      u.empresaId,
      invoice.id,
      quote.patient.id,
      quote.insurer.id,
      quote.beneficiary.id,
      quote,
      quote.serviceDate,
      quote.dueDate,
      u.username,
    ],
  );
  for (const [type, id, amount] of [
    ["insurer", quote.insurer.id, quote.insurerAmount],
    ["patient", String(quote.patient.id), quote.patientAmount],
  ] as const)
    if (amount > 0)
      await c.query(
        "INSERT INTO public.nv_receivable_entries(empresa_id,invoice_id,party_type,party_id,occurred_on,kind,debit,reference,actor) VALUES($1,$2,$3,$4,$5,'invoice',$6,$7,$8)",
        [
          u.empresaId,
          invoice.id,
          type,
          id,
          issued,
          amount,
          invoice.numero,
          u.username,
        ],
      );
}
export async function refreshClaimState(c: any, org: string, id: number) {
  const balances = (
    await c.query(
      "SELECT party_type,coalesce(sum(debit-credit),0) AS balance FROM public.nv_receivable_entries WHERE empresa_id=$1 AND invoice_id=$2 GROUP BY party_type",
      [org, id],
    )
  ).rows;
  const paid = balances.every((x: any) => Number(x.balance) <= 0.001);
  await c.query(
    "UPDATE public.faturas SET estado=$3 WHERE empresa_id=$1 AND id=$2 AND coalesce(billing_meta->>'managed','')<>'nvuala-v1'",
    [org, id, paid ? "paga" : "emitida"],
  );
}
export async function creditInsuredInvoice(
  c: any,
  u: any,
  origin: any,
  invoice: any,
  claim: any,
) {
  const snapshot = claim.snapshot,
    amount = Math.abs(Number(invoice.total));
  // A credit note must identify original act codes. Mixed coverages cannot be reduced by a guessed global percentage.
  const credited: any[] = [];
  const entries = (
    await c.query(
      "SELECT DISTINCT ON (reference) details FROM public.nv_receivable_entries WHERE empresa_id=$1 AND invoice_id=$2 AND kind='credit' ORDER BY reference,id",
      [u.empresaId, origin.id],
    )
  ).rows;
  for (const e of entries) credited.push(...(e.details.acts || []));
  let insurer = 0,
    patientAmount = 0;
  const details: any[] = [];
  for (const line of invoice.linhas) {
    const index = Number(line.originActIndex);
    const a = snapshot.acts[index];
    if (!Number.isInteger(index) || !a)
      deny(
        "A nota de crédito deve identificar o índice do acto na factura original.",
      );
    const qty = Math.abs(Number(line.quantidade)),
      already =
        credited
          .filter((x) => x.index === index)
          .reduce((s, x) => s + x.quantity, 0) +
        details
          .filter((x) => x.index === index)
          .reduce((s, x) => s + x.quantity, 0);
    if (
      qty + already > a.quantity + 0.000001 ||
      Math.abs(Number(line.precoUnitario) - a.price) > 0.001
    )
      deny("Quantidade/preço do crédito ultrapassa o acto original.");
    const gross = money((a.gross * qty) / a.quantity),
      share = money((a.insurerAmount * qty) / a.quantity);
    insurer += share;
    patientAmount += gross - share;
    details.push({ index, quantity: qty, gross, insurerAmount: share });
  }
  if (Math.abs(money(insurer + patientAmount) - amount) > 0.02)
    deny(
      "O valor do crédito deve conservar o desconto, IVA e repartição dos actos originais.",
    );
  patientAmount = money(amount - insurer);
  insurer = money(insurer);
  const day = dateOnly(invoice.data);
  for (const [type, id, share] of [
    ["insurer", claim.insurer_id, insurer],
    ["patient", String(claim.patient_id), patientAmount],
  ] as const)
    if (share > 0)
      await c.query(
        "INSERT INTO public.nv_receivable_entries(empresa_id,invoice_id,party_type,party_id,occurred_on,kind,credit,reference,details,actor) VALUES($1,$2,$3,$4,$5,'credit',$6,$7,$8,$9)",
        [
          u.empresaId,
          origin.id,
          type,
          id,
          day,
          share,
          invoice.numero,
          { creditInvoiceId: invoice.id, acts: details },
          u.username,
        ],
      );
  // Record zero-insurer credits for quantity controls using patient entries as fallback in subsequent queries.
  await refreshClaimState(c, u.empresaId, origin.id);
}

async function privateSourceEntries(
  c: any,
  org: string,
  f: any,
  excludeDocId?: number,
) {
  const amount = money(Number(f.total));
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const rows: any[] = [
    {
      id: "legacy-invoice-" + f.id,
      invoice_id: f.id,
      date: dateOnly(f.data),
      kind: "invoice",
      debit: amount,
      credit: 0,
      reference: f.numero,
      numero: f.numero,
      details: { source: "document" },
    },
  ];
  const cash = (
    await c.query(
      "SELECT id,data,tipo,valor,referencia FROM public.movimentos WHERE empresa_id=$1 AND fatura_id=$2 ORDER BY id",
      [org, f.id],
    )
  ).rows;
  for (const p of cash)
    if (Number(p.valor) > 0)
      rows.push({
        id: "legacy-payment-" + p.id,
        invoice_id: f.id,
        date: dateOnly(p.data),
        kind: "payment",
        debit: p.tipo === "saida" ? Number(p.valor) : 0,
        credit: p.tipo === "entrada" ? Number(p.valor) : 0,
        reference: p.referencia || f.numero,
        numero: f.numero,
        details: { source: "cash", cashId: p.id },
      });
  const credits = (
    await c.query(
      "SELECT id,data,total,numero FROM public.faturas WHERE empresa_id=$1 AND tipo_documento='nota-credito' AND estado IN ('emitida','paga') AND observacoes LIKE $2 AND id<>$3",
      [org, "%[ORIGEM:" + f.id + "]%", excludeDocId || 0],
    )
  ).rows;
  for (const n of credits)
    rows.push({
      id: "legacy-credit-" + n.id,
      invoice_id: f.id,
      date: dateOnly(n.data),
      kind: "credit",
      debit: 0,
      credit: Math.abs(Number(n.total)),
      reference: n.numero,
      numero: f.numero,
      details: { creditInvoiceId: n.id, source: "credit" },
    });
  return rows;
}
export async function legacyPatientEntries(
  c: any,
  org: string,
  patientId: number,
) {
  const invoices = (
    await c.query(
      "SELECT f.* FROM public.faturas f WHERE f.empresa_id=$1 AND f.paciente_id=$2 AND f.estado IN ('emitida','paga') AND f.tipo_documento NOT IN ('recibo','nota-credito','pro-forma') AND coalesce(f.billing_meta->>'ambiente','')<>'homologacao' AND NOT EXISTS(SELECT 1 FROM public.nv_receivable_entries e WHERE e.empresa_id=f.empresa_id AND e.invoice_id=f.id) AND NOT EXISTS(SELECT 1 FROM public.nv_insurance_claims c WHERE c.empresa_id=f.empresa_id AND c.invoice_id=f.id)",
      [org, patientId],
    )
  ).rows;
  const rows: any[] = [],
    warnings: string[] = [];
  for (const f of invoices) {
    try {
      const actual = await privateSourceEntries(c, org, f);
      rows.push(...actual);
      if (f.estado === "paga" && !actual.some((r) => r.kind === "payment"))
        warnings.push(
          "Documento " +
            f.numero +
            " marcado pago sem movimento de caixa associado: requer reconciliação.",
        );
    } catch {
      warnings.push(
        "Documento " +
          f.numero +
          " com data/valores antigos inválidos: requer revisão antes de integrar no extracto.",
      );
    }
  }
  return { rows, warnings };
}
export async function ensurePrivateAccount(
  c: any,
  u: any,
  f: any,
  excludeDocId?: number,
) {
  if (
    !f?.paciente_id ||
    ["recibo", "nota-credito", "pro-forma"].includes(f.tipo_documento) ||
    !["emitida", "paga"].includes(f.estado)
  )
    return false;
  await patient(c, u.empresaId, Number(f.paciente_id));
  const found = (
    await c.query(
      "SELECT 1 FROM public.nv_receivable_entries WHERE empresa_id=$1 AND invoice_id=$2 LIMIT 1",
      [u.empresaId, f.id],
    )
  ).rowCount;
  if (found) return true;
  for (const r of await privateSourceEntries(c, u.empresaId, f, excludeDocId))
    if (r.debit > 0 || r.credit > 0)
      await c.query(
        "INSERT INTO public.nv_receivable_entries(empresa_id,invoice_id,party_type,party_id,occurred_on,kind,debit,credit,reference,details,actor) VALUES($1,$2,'patient',$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          u.empresaId,
          f.id,
          String(f.paciente_id),
          r.date,
          r.kind,
          r.debit,
          r.credit,
          r.reference,
          r.details,
          u.username,
        ],
      );
  return true;
}
export async function recordPrivateBilling(
  c: any,
  u: any,
  f: any,
  origin?: any,
) {
  const source = origin || f;
  if (!(await ensurePrivateAccount(c, u, source, f.id))) return;
  const credit =
    f.tipo_documento === "nota-credito"
      ? Math.abs(Number(f.total))
      : f.estado === "paga"
        ? Number(f.total)
        : 0;
  if (credit > 0)
    await c.query(
      "INSERT INTO public.nv_receivable_entries(empresa_id,invoice_id,party_type,party_id,occurred_on,kind,credit,reference,details,actor) VALUES($1,$2,'patient',$3,$4,$5,$6,$7,$8,$9)",
      [
        u.empresaId,
        source.id,
        String(source.paciente_id),
        dateOnly(f.data),
        f.tipo_documento === "nota-credito" ? "credit" : "payment",
        credit,
        f.numero,
        {
          source: "billing",
          ...(f.tipo_documento === "nota-credito"
            ? { creditInvoiceId: f.id }
            : { receiptId: f.id, receiptNumber: f.numero }),
        },
        u.username,
      ],
    );
  if (origin) await refreshClaimState(c, u.empresaId, source.id);
}

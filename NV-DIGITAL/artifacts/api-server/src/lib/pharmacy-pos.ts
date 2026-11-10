import { cents, check, localStamp, text, totals } from "./billing-engine.js";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase("pt").replace(/\s+/g, " ");
const date = (v: Date | string) => new Date(v).toISOString().slice(0, 10);

function qty(v: any) {
  const n = typeof v === "number" ? Math.round(v * 1000) : NaN;
  check(
    Number.isSafeInteger(n) &&
      n > 0 &&
      n <= 1e9 &&
      Math.abs(n - v * 1000) < 0.0001,
    "Introduza uma quantidade positiva com até três casas decimais.",
  );
  return n;
}
const scaled = (v: any) => Math.round(Number(v) * 1000);

async function clinical(c: any, org: string, lock = false) {
  return (
    (
      await c.query(
        "SELECT data FROM public.hospital_state WHERE empresa_id=$1 AND namespace='clinical'" +
          (lock ? " FOR UPDATE" : ""),
        [org],
      )
    ).rows[0]?.data || { prescriptions: [], deliveries: [] }
  );
}

async function usage(c: any, org: string, prescriptionId?: string) {
  return (
    await c.query(
      `SELECT s.prescription_id,i.item_id,sum(i.quantity) AS quantity
       FROM public.nv_pharmacy_pos_sales s
       JOIN public.nv_pharmacy_pos_items i ON i.empresa_id=s.empresa_id AND i.invoice_id=s.invoice_id
      WHERE s.empresa_id=$1 AND ($2::text IS NULL OR s.prescription_id=$2)
      GROUP BY s.prescription_id,i.item_id`,
      [org, prescriptionId ?? null],
    )
  ).rows;
}

async function lots(c: any, org: string, only?: string[]) {
  return (
    await c.query(
      `SELECT p.id,p.code,p.name,p.lot,p.expiry,p.price,p.stock,q.quantity
       FROM public.hospital_pharmacy p
       LEFT JOIN public.nv_pharmacy_pos_stock q ON q.empresa_id=p.empresa_id AND q.lot_id=p.id
      WHERE p.empresa_id=$1 AND p.active=true AND p.expiry>=$2::date
        AND ($3::uuid[] IS NULL OR p.id=ANY($3::uuid[]))
      ORDER BY p.expiry,p.code,p.lot`,
      [org, localStamp().iso, only ?? null],
    )
  ).rows;
}
const rxActive = (rx: any) =>
  rx &&
  !rx.cancelled &&
  new Date(rx.validUntil).getTime() >= Date.now() &&
  Number.isSafeInteger(Number(rx.patient?.id)) &&
  Number(rx.patient.id) > 0;

function remaining(state: any, used: any[], rx: any, item: any) {
  const clinicalQty = state.deliveries
    .filter((d: any) => d.prescriptionId === rx.id && d.itemId === item.id)
    .reduce((n: number, d: any) => n + scaled(d.quantity), 0);
  const trainingQty = scaled(
    used.find((d) => d.prescription_id === rx.id && d.item_id === item.id)
      ?.quantity || 0,
  );
  return Math.max(0, scaled(item.quantity) - clinicalQty - trainingQty);
}

export async function pharmacyPosState(c: any, u: any) {
  const org = u.empresaId;
  const [state, used, batches, sales] = await Promise.all([
    clinical(c, org),
    usage(c, org),
    lots(c, org),
    c.query(
      `SELECT s.invoice_id AS id,f.numero,f.cliente_nome AS patient,
              f.total,f.data,s.created_at
         FROM public.nv_pharmacy_pos_sales s
         JOIN public.faturas f ON f.empresa_id=s.empresa_id AND f.id=s.invoice_id
        WHERE s.empresa_id=$1 AND s.actor=$2 ORDER BY s.created_at DESC,s.invoice_id DESC LIMIT 40`,
      [org, u.username],
    ),
  ]);
  return {
    prescriptions: state.prescriptions
      .filter(rxActive)
      .map((rx: any) => ({
        id: rx.id,
        patient: rx.patient.nome,
        created: rx.created,
        validUntil: rx.validUntil,
        items: rx.items.map((i: any) => ({
          id: i.id,
          name: i.name,
          dose: i.dose,
          unit: i.unit,
          remaining: remaining(state, used, rx, i) / 1000,
        })),
      }))
      .filter((rx: any) => rx.items.some((i: any) => i.remaining > 0))
      .reverse(),
    lots: batches.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      lot: p.lot,
      expiry: date(p.expiry),
      price: Number(p.price),
      quantity: p.quantity === null ? null : Number(p.quantity),
      availableToInitialize: Number(p.stock),
    })),
    sales: sales.rows.map((s: any) => ({ ...s, total: Number(s.total) })),
  };
}

export async function initializeTrainingLot(c: any, u: any, body: any) {
  check(
    body.confirmTraining === true && uuid.test(body.lotId || ""),
    "Confirme o lote de ensaio.",
  );
  const amount = qty(body.quantity);
  const p = (await lots(c, u.empresaId, [body.lotId]))[0];
  check(
    p && p.quantity === null && amount <= scaled(p.stock),
    "Lote já preparado, expirado, sem saldo ou indisponível nesta empresa.",
  );
  await c.query(
    "INSERT INTO public.nv_pharmacy_pos_stock(empresa_id,lot_id,initial_quantity,quantity,actor) VALUES($1,$2,$3,$3,$4)",
    [u.empresaId, p.id, amount / 1000, u.username],
  );
  return { ok: true };
}

export async function pharmacyQuote(
  c: any,
  u: any,
  b: any,
  ivaTaxa: number,
  lock = false,
) {
  const org = u.empresaId;
  check(
    typeof b.prescriptionId === "string" &&
      b.prescriptionId.length <= 120 &&
      Array.isArray(b.items) &&
      b.items.length > 0 &&
      b.items.length <= 50,
    "Seleccione uma receita e até 50 linhas de lote.",
  );
  const state = await clinical(c, org, lock);
  const rx = state.prescriptions.find((r: any) => r.id === b.prescriptionId);
  check(
    rxActive(rx),
    "Receita suspensa, expirada ou indisponível nesta empresa.",
  );
  const patient = (
    await c.query(
      "SELECT id,nome,nif,endereco FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
      [org, Number(rx.patient.id)],
    )
  ).rows[0];
  check(patient, "O paciente não pertence à empresa ou não está registado.");
  check(
    b.items.every(
      (i: any) =>
        i &&
        typeof i.itemId === "string" &&
        i.itemId.length <= 120 &&
        typeof i.lotId === "string" &&
        uuid.test(i.lotId),
    ),
    "Referência de medicamento ou lote inválida.",
  );
  const allLots = [...new Set<string>(b.items.map((i: any) => i.lotId))].sort();
  if (lock)
    await c.query(
      "SELECT lot_id FROM public.nv_pharmacy_pos_stock WHERE empresa_id=$1 AND lot_id=ANY($2::uuid[]) ORDER BY lot_id FOR UPDATE",
      [org, allLots],
    );
  const [available, used] = await Promise.all([
    lots(c, org, allLots),
    usage(c, org, rx.id),
  ]);
  const lotUses = new Map<string, number>(),
    itemUses = new Map<string, number>(),
    pairs = new Set<string>();
  const items = b.items.map((i: any) => {
    const count = qty(i.quantity);
    const item = rx.items.find((x: any) => x.id === i.itemId);
    const batch = available.find((x: any) => x.id === i.lotId);
    check(
      item && batch && batch.quantity !== null,
      "Lote não preparado, expirado ou indisponível.",
    );
    check(
      key(item.name) === key(batch.name),
      "O medicamento do lote não coincide com a receita. Confira o nome, a concentração e a apresentação.",
    );
    const pair = JSON.stringify([item.id, batch.id]);
    check(
      !pairs.has(pair),
      "Junte as quantidades do mesmo medicamento e lote.",
    );
    pairs.add(pair);
    const l = (lotUses.get(batch.id) || 0) + count;
    const m = (itemUses.get(item.id) || 0) + count;
    check(l <= scaled(batch.quantity), "Saldo insuficiente no lote de ensaio.");
    check(
      m <= remaining(state, used, rx, item),
      "A quantidade ultrapassa o saldo da receita no ensaio.",
    );
    check(
      cents(batch.price) > 0,
      "Configure o preço de venda do lote antes de cobrar.",
    );
    lotUses.set(batch.id, l);
    itemUses.set(item.id, m);
    return {
      itemId: item.id as string,
      lotId: batch.id as string,
      quantity: count / 1000,
      codigo: text(batch.code, 80),
      descricao: text(batch.name, 300),
      unidade: String(item.unit || "un").slice(0, 20),
      lote: text(batch.lot, 100),
      dataValidade: date(batch.expiry),
      precoUnitario: Number(batch.price),
    };
  });
  const d = {
    tipoDocumento: "factura-recibo",
    estado: "paga",
    ivaTaxa,
    pacienteId: patient.id,
    clienteNome: patient.nome,
    clienteNif: /^[A-Za-z0-9]{8,15}$/.test(patient.nif || "")
      ? patient.nif
      : "",
    clienteEndereco: patient.endereco || "",
    desconto: b.discountPercent ?? 0,
    descontoValor: b.discountAmount ?? 0,
    observacoes:
      "Venda de formação no balcão da Farmácia. Sem entrega clínica.",
    linhas: items.map((i: any) => ({
      ...i,
      quantidade: i.quantity,
      ivaIsento: ivaTaxa === 0,
    })),
  };
  const quote = totals(d);
  check(cents(quote.total) > 0, "O total da venda deve ser positivo.");
  return {
    prescriptionId: rx.id as string,
    items,
    lotUses,
    document: d,
    quote,
  };
}

export async function recordTrainingSale(
  c: any,
  u: any,
  invoiceId: number,
  plan: Awaited<ReturnType<typeof pharmacyQuote>>,
) {
  const org = u.empresaId;
  await c.query(
    "INSERT INTO public.nv_pharmacy_pos_sales(empresa_id,invoice_id,prescription_id,actor) VALUES($1,$2,$3,$4)",
    [org, invoiceId, plan.prescriptionId, u.username],
  );
  for (const [lotId, value] of plan.lotUses) {
    const update = await c.query(
      "UPDATE public.nv_pharmacy_pos_stock SET quantity=quantity-$3 WHERE empresa_id=$1 AND lot_id=$2 AND quantity>=$3 RETURNING lot_id",
      [org, lotId, value / 1000],
    );
    check(update.rowCount === 1, "Saldo insuficiente no lote de ensaio.");
  }
  for (const item of plan.items)
    await c.query(
      "INSERT INTO public.nv_pharmacy_pos_items(empresa_id,invoice_id,item_id,lot_id,quantity) VALUES($1,$2,$3,$4,$5)",
      [org, invoiceId, item.itemId, item.lotId, item.quantity],
    );
}

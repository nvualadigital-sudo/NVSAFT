import { randomUUID } from "node:crypto";
import { check, cents } from "./billing-engine.js";
import {
  creditInsuredInvoice,
  dateOnly,
  ensurePrivateAccount,
  insuredInvoice,
  recordInsuredInvoice,
} from "./insurance.js";

// Called only inside the native billing transaction, after issuing the document.
// Environment comes from the immutable source invoice, never from a request flag.
export async function recordIntegratedAccount(
  c: any,
  u: any,
  f: any,
  quote: any,
  origin: any,
) {
  const source = origin || f;
  if (!source.paciente_id) return;
  if (quote) await recordInsuredInvoice(c, u, f, quote);
  else if (!["recibo", "nota-credito"].includes(f.tipo_documento))
    await ensurePrivateAccount(c, u, f);

  if (f.tipo_documento === "nota-credito") {
    const claim = await insuredInvoice(c, u.empresaId, source.id);
    if (claim) {
      await creditInsuredInvoice(c, u, source, f, claim);
      return;
    }
    await ensurePrivateAccount(c, u, source);
    await entry(
      c,
      u,
      source,
      f,
      "credit",
      "patient",
      String(source.paciente_id),
      Math.abs(Number(f.total)),
      {},
    );
    return;
  }
  if (f.estado !== "paga") return;
  if (f.tipo_documento === "recibo") await ensurePrivateAccount(c, u, source);
  const allocation = f.billing_meta?.settlement;
  await entry(
    c,
    u,
    source,
    f,
    "payment",
    allocation?.partyType || "patient",
    allocation?.partyId || String(source.paciente_id),
    Number(f.total),
    {
      receiptId: f.id,
      receiptNumber: f.numero,
      environment: "homologacao",
      cashSessionId: f.billing_meta.caixaSessaoId,
    },
  );
}

async function entry(
  c: any,
  u: any,
  source: any,
  document: any,
  kind: string,
  partyType: string,
  partyId: string,
  amount: number,
  details: any,
) {
  if (cents(amount) <= 0) return;
  await c.query(
    "INSERT INTO public.nv_receivable_entries(empresa_id,invoice_id,party_type,party_id,occurred_on,kind,credit,reference,details,actor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      u.empresaId,
      source.id,
      partyType,
      partyId,
      dateOnly(document.data),
      kind,
      amount,
      document.numero,
      { ...details, documentId: document.id },
      u.username,
    ],
  );
}

export async function settlementDocument(c: any, u: any, b: any, stamp: any) {
  check(
    Number.isSafeInteger(b.invoiceId) && b.invoiceId > 0,
    "Seleccione uma factura.",
  );
  check(
    ["patient", "insurer"].includes(b.partyType),
    "Seleccione a responsabilidade do pagador.",
  );
  const source = (
    await c.query(
      "SELECT * FROM public.faturas WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
      [u.empresaId, b.invoiceId],
    )
  ).rows[0];
  check(
    source &&
      source.billing_meta?.managed === "nvuala-v1" &&
      source.billing_meta?.ambiente === "homologacao" &&
      source.estado === "emitida" &&
      ["factura", "factura-global"].includes(source.tipo_documento),
    "Factura indisponível. O arquivo fiscal anterior é de consulta neste modo.",
  );
  check(
    !b.date || dateOnly(b.date) === stamp.iso,
    "O recebimento usa a data actual do servidor (Luanda).",
  );
  const claim = await insuredInvoice(c, u.empresaId, source.id);
  check(
    claim || b.partyType === "patient",
    "Esta factura não tem responsabilidade de uma seguradora.",
  );
  check(source.paciente_id, "Associe a factura ao cadastro único do paciente.");
  if (!claim) await ensurePrivateAccount(c, u, source);
  const partyId =
    b.partyType === "insurer" ? claim.insurer_id : String(source.paciente_id);
  const balance = Number(
    (
      await c.query(
        "SELECT coalesce(sum(debit-credit),0) AS balance FROM public.nv_receivable_entries WHERE empresa_id=$1 AND invoice_id=$2 AND party_type=$3 AND party_id=$4",
        [u.empresaId, source.id, b.partyType, partyId],
      )
    ).rows[0].balance,
  );
  const amount = cents(b.amount);
  check(
    amount > 0 && amount <= cents(balance),
    "O recebimento excede o saldo desta responsabilidade ou tem valor inválido.",
  );
  const settlement = { partyType: b.partyType, partyId, sourceId: source.id };
  return {
    settlement,
    document: {
      tipoDocumento: "recibo",
      estado: "paga",
      documentoOrigem: source.numero,
      clienteNome: source.cliente_nome,
      clienteNif: source.cliente_nif,
      clienteEndereco: source.cliente_endereco,
      pacienteId: source.paciente_id,
      linhas: [
        {
          descricao:
            "Recebimento parcial de " +
            source.numero +
            " — " +
            (b.partyType === "insurer" ? "seguradora" : "paciente"),
          quantidade: 1,
          precoUnitario: amount / 100,
          ivaIsento: true,
        },
      ],
      ivaTaxa: 0,
      desconto: 0,
      total: amount / 100,
      formaPagamento: b.method,
      formasPagamentoDetalhe: [
        {
          id: randomUUID(),
          forma: b.method,
          valor: amount / 100,
          referencia: b.reference || "",
        },
      ],
      observacoes:
        "Recebimento da parcela " +
        (b.partyType === "insurer" ? "da seguradora" : "do paciente") +
        (claim
          ? ": " +
            (b.partyType === "insurer"
              ? claim.snapshot.insurer.nome
              : claim.snapshot.patient.nome)
          : ""),
    },
  };
}

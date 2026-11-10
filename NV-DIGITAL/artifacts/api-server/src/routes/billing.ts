import { insuranceQuote, insuredInvoice, recordInsuredInvoice, creditInsuredInvoice, recordPrivateBilling } from "../lib/insurance.js";
import { enrichInsuredInvoices } from "./insurance.js";
import { Router } from "express";
import { pool } from "@workspace/db";
import { requireEmpresa, getUser } from "../lib/auth.js";
import { createHash, randomUUID } from "node:crypto";
const router = Router();
const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
router.post("/faturas", requireEmpresa, async (req, res) => {
  const u = getUser(req),
    d = req.body;
  if (
    !["admin", "gestor", "financeiro", "rececionista"].includes(u.funcao || "")
  ) {
    res.status(403).json({ error: "Sem permissão de facturação." });
    return;
  }
  const types = [
    "factura",
    "factura-recibo",
    "recibo",
    "nota-credito",
    "nota-debito",
    "pro-forma",
  ];
  if (
    !types.includes(d.tipoDocumento || "factura") ||
    !["rascunho", "emitida", "paga"].includes(d.estado) ||
    !Array.isArray(d.linhas) ||
    !d.linhas.length
  ) {
    res.status(400).json({ error: "Documento inválido." });
    return;
  }
  let sub = 0,
    tax = 0;
  const rate = Number(d.ivaTaxa),
    discount = Number(d.desconto || 0);
  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100 ||
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > 100
  ) {
    res.status(400).json({ error: "Taxa ou desconto inválido." });
    return;
  }
  for (const line of d.linhas) {
    const qty = Number(line.quantidade),
      price = Number(line.precoUnitario);
    if (
      typeof line.descricao !== "string" ||
      !line.descricao.trim() ||
      !Number.isFinite(qty) ||
      qty === 0 ||
      !Number.isFinite(price) ||
      price < 0 ||
      (d.tipoDocumento === "nota-credito" ? qty >= 0 : qty < 0)
    ) {
      res.status(400).json({ error: "Linha de documento inválida." });
      return;
    }
    sub += qty * price;
    if (!line.ivaIsento) tax += (qty * price * rate) / 100;
  }
  sub = round(sub * (1 - discount / 100));
  tax = round(tax * (1 - discount / 100));
  const total = round(sub + tax);
  if (
    [
      ["subtotalSemIva", sub],
      ["totalIva", tax],
      ["total", total],
    ].some(
      ([k, v]) =>
        !Number.isFinite(Number(d[k as string])) ||
        Math.abs(Number(d[k as string]) - Number(v)) > 0.02,
    )
  ) {
    res
      .status(400)
      .json({ error: "Os totais não correspondem às linhas e descontos." });
    return;
  }
  if (
    ["factura-recibo", "recibo"].includes(d.tipoDocumento) &&
    d.estado !== "paga"
  ) {
    res
      .status(400)
      .json({ error: "Factura-recibo e recibo exigem pagamento confirmado." });
    return;
  }
  if (d.estado === "paga" && !d.formaPagamento) {
    res.status(400).json({ error: "Indique a forma de pagamento." });
    return;
  }
  if (
    !/^\d{2}\/\d{2}\/\d{4}$/.test(d.data || "") &&
    !/^\d{4}-\d{2}-\d{2}$/.test(d.data || "")
  ) {
    res.status(400).json({ error: "Data inválida." });
    return;
  }
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "billing:" + u.empresaId,
    ]);
    const hash = createHash("sha256")
      .update(JSON.stringify({ ...d, requestId: undefined }))
      .digest("hex");
    if (d.requestId) {
      const old = await c.query(
        "SELECT data FROM public.hospital_records WHERE empresa_id=$1 AND id=$2 AND kind='billing-requests'",
        [u.empresaId, d.requestId],
      );
      if (old.rows[0]) {
        if (old.rows[0].data.hash !== hash)
          throw new Error("Chave de pedido reutilizada com outro conteúdo.");
        const q = await c.query(
          "SELECT * FROM public.faturas WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, old.rows[0].data.invoiceId],
        );
        await c.query("COMMIT");
        res.json((await enrichInsuredInvoices(c,u.empresaId!,[camel(q.rows[0])]))[0]);
        return;
      }
    }
    await c.query(
      "INSERT INTO public.config(empresa_id) VALUES($1) ON CONFLICT(empresa_id) DO NOTHING",
      [u.empresaId],
    );
    const cfg = (
      await c.query(
        "SELECT * FROM public.config WHERE empresa_id=$1 FOR UPDATE",
        [u.empresaId],
      )
    ).rows[0];
    if (
      d.estado !== "rascunho" &&
      d.tipoDocumento !== "pro-forma" &&
      (!/^[a-z0-9]{8,16}$/i.test(cfg.nif || "") || /^0+$/.test(cfg.nif))
    )
      throw new Error("Configure o NIF real do emitente antes de emitir.");
    let origin: any;
    const explicit = Number(d.faturaOrigemId),
      match = String(d.observacoes || "").match(
        /(?:referente ao documento|pagamento da)\s+(\S+)/i,
      );
    if (["recibo", "nota-credito"].includes(d.tipoDocumento)) {
      origin = (
        await c.query(
          "SELECT * FROM public.faturas WHERE empresa_id=$1 AND (id=$2 OR numero=$3) FOR UPDATE",
          [u.empresaId, explicit || 0, match?.[1] || ""],
        )
      ).rows[0];
      if (
        !origin ||
        !["emitida", "paga"].includes(origin.estado) ||
        ["recibo", "nota-credito", "pro-forma"].includes(origin.tipo_documento)
      )
        throw new Error(
          "Seleccione uma factura original válida desta instituição.",
        );
      if (d.tipoDocumento === "nota-credito") {
        const credited = await c.query(
          "SELECT coalesce(sum(abs(total)),0) AS total FROM public.faturas WHERE empresa_id=$1 AND tipo_documento='nota-credito' AND observacoes LIKE $2",
          [u.empresaId, "%[ORIGEM:" + origin.id + "]%"],
        );
        if (
          Number(credited.rows[0].total) + Math.abs(total) >
          Number(origin.total) + 0.02
        )
          throw new Error("O crédito ultrapassa o saldo da factura original.");
        if (
          d.clienteNome !== origin.cliente_nome ||
          Number(d.ivaTaxa) !== Number(origin.iva_taxa)
        )
          throw new Error("Adquirente ou taxa diferentes da factura original.");
      } else {
        if (origin.estado === "paga")
          throw new Error("Esta factura já está paga.");
        if (Math.abs(total - Number(origin.total)) > 0.02)
          throw new Error(
            "O recibo deve corresponder ao valor integral da factura original.",
          );
      }
    }
    const originClaim=origin ? await insuredInvoice(c,u.empresaId!,origin.id) : null;
    if(origin && !originClaim && d.tipoDocumento==="recibo"){
      const posted=(await c.query("SELECT count(*) AS n,coalesce(sum(debit-credit),0) AS balance FROM public.nv_receivable_entries WHERE empresa_id=$1 AND invoice_id=$2",[u.empresaId,origin.id])).rows[0];
      if(Number(posted.n)>0 && Math.abs(Number(posted.balance)-total)>0.001)throw new Error("A factura tem recebimentos/créditos parciais. Registe apenas o saldo no extracto do paciente.");
    }

    if(originClaim && d.tipoDocumento==="recibo")throw new Error("Registe o recebimento parcial/integral pela responsabilidade em Seguradoras → Cobrança; será emitido o recibo.");
    let insurance;
    if(d.insurance){
      if(d.estado!=="emitida" || !["factura","nota-debito"].includes(d.tipoDocumento))throw new Error("Emita a factura do seguro como emitida. Registe depois os recebimentos de cada pagador em Seguradoras → Cobrança.");
      insurance=await insuranceQuote(c,u.empresaId!,d);
    }
    const number =
      String(cfg.serie || "A") +
      "/" +
      String(cfg.proximo_numero_fatura).padStart(6, "0");
    await c.query(
      "UPDATE public.config SET proximo_numero_fatura=proximo_numero_fatura+1 WHERE empresa_id=$1",
      [u.empresaId],
    );
    let observations = String(d.observacoes || "");
    if (origin) observations += " [ORIGEM:" + origin.id + "]";
    const q = await c.query(
      `INSERT INTO public.faturas(empresa_id,numero,serie,data,hora_operacao,data_vencimento,cliente_nome,cliente_nif,cliente_endereco,linhas,subtotal_sem_iva,total_iva,iva_taxa,total,estado,observacoes,paciente_id,resultado_id,emitido_por,codigo_hash,tipo_documento,forma_pagamento,emitente_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [
        u.empresaId,
        number,
        cfg.serie,
        d.data,
        d.horaOperacao || "",
        insurance?.dueDate || d.dataVencimento || d.data,
        d.clienteNome || "Consumidor Final",
        d.clienteNif || "",
        d.clienteEndereco || "",
        JSON.stringify(d.linhas),
        sub,
        tax,
        rate,
        total,
        d.estado,
        observations,
        d.pacienteId || null,
        d.resultadoId || null,
        u.username,
        createHash("sha256")
          .update(
            number +
              "|" +
              u.empresaId +
              "|" +
              total +
              "|" +
              JSON.stringify(d.linhas),
          )
          .digest("hex"),
        d.tipoDocumento || "factura",
        d.formaPagamento || "",
        JSON.stringify(camel(cfg)),
      ],
    );
    const row = q.rows[0];
    if(insurance)await recordInsuredInvoice(c,u,row,insurance);
    if(originClaim && d.tipoDocumento==="nota-credito")await creditInsuredInvoice(c,u,origin,row,originClaim);
    if(!insurance && !originClaim)await recordPrivateBilling(c,u,row,origin);
    if (
      d.estado === "paga" &&
      d.tipoDocumento !== "nota-credito" &&
      d.tipoDocumento !== "pro-forma"
    ) {
      if (origin)
        await c.query(
          "UPDATE public.faturas SET estado='paga',forma_pagamento=$3 WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, origin.id, d.formaPagamento],
        );
      await c.query(
        "INSERT INTO public.movimentos(empresa_id,data,descricao,tipo,valor,categoria,fatura_id,referencia,registado_por) VALUES($1,$2,$3,'entrada',$4,'Faturação',$5,$6,$7)",
        [
          u.empresaId,
          d.data,
          "Recebimento " + number,
          total,
          origin?.id || row.id,
          number,
          u.username,
        ],
      );
    }
    if (d.requestId)
      await c.query(
        "INSERT INTO public.hospital_records(id,empresa_id,kind,data,created_by) VALUES($1,$2,'billing-requests',$3,$4)",
        [
          d.requestId,
          u.empresaId,
          JSON.stringify({ hash, invoiceId: row.id }),
          u.username,
        ],
      );
    await c.query(
      "INSERT INTO public.hospital_audit(id,empresa_id,actor,action,reference) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), u.empresaId, u.username, "billing.issue", number],
    );
    await c.query("COMMIT");
    res.status(201).json((await enrichInsuredInvoices(c,u.empresaId!,[camel(row)]))[0]);
  } catch (e: any) {
    await c.query("ROLLBACK");
    res
      .status(e.code === "23503" ? 403 : 409)
      .json({
        error:
          e.code === "23503"
            ? "Referência de outra instituição."
            : e.message || "Emissão não confirmada.",
      });
  } finally {
    c.release();
  }
});
export function camel(row: any) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, a) => a.toUpperCase()),
      v,
    ]),
  );
}
export default router;

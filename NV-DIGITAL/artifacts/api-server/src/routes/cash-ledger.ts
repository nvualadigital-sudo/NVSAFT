import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool as productionPool } from "@workspace/db";
import { getUser, requireEmpresa } from "../lib/auth.js";
import {
  allowed,
  apiErrors,
  deny,
  event,
  transaction,
  uuid,
  value,
} from "../lib/governance.js";
import { camel } from "./billing.js";
const FINANCE = ["admin", "gestor", "financeiro"];
function date(input: unknown) {
  const s = value(input, 10),
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : s;
  const d = new Date(iso + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== iso
  )
    deny("Data do movimento inválida.");
  return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
const id = (x: unknown) => {
  const n = Number(x);
  if (!Number.isSafeInteger(n) || n <= 0) deny("Referência inválida.");
  return n;
};
export function createCashLedgerRouter(providedPool?: any) {
  const pool: any = {
    query: (sql: string, params?: any[]) =>
      (providedPool || productionPool).query(sql, params),
    connect: () => (providedPool || productionPool).connect(),
  };
  const r = Router();
  r.use(requireEmpresa);
  r.get("/movimentos", async (req, res) => {
    const u = getUser(req);
    if (!FINANCE.includes(u.funcao || "")) {
      res.json([]);
      return;
    }
    const rows = await pool.query(
      "SELECT * FROM public.movimentos WHERE empresa_id=$1 ORDER BY id",
      [u.empresaId],
    );
    res.json(rows.rows.map(camel));
  });
  r.post("/movimentos", async (req, res) => {
    const u = getUser(req);
    allowed(u, [...FINANCE, "rececionista"]);
    const b = req.body || {},
      invoiceId = b.faturaId ? id(b.faturaId) : null;
    const result = await transaction(pool, u.empresaId!, async (c) => {
      if (invoiceId) {
        const f = (
          await c.query(
            "SELECT billing_meta FROM public.faturas WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, invoiceId],
          )
        ).rows[0];
        if (!f) deny("Factura indisponível nesta instituição.", 404);
        if (
          f.billing_meta?.managed === "nvuala-v1" ||
          f.billing_meta?.ambiente === "homologacao"
        )
          deny(
            "Registe este recebimento na Facturação. Um ensaio não pode gerar movimentos na contabilidade real.",
            409,
          );
        const prior = (
          await c.query(
            "SELECT * FROM public.movimentos WHERE empresa_id=$1 AND fatura_id=$2 ORDER BY id LIMIT 1",
            [u.empresaId, invoiceId],
          )
        ).rows[0];
        if (prior && b.tipo === "entrada" && b.categoria === "Faturação")
          return prior;
        deny(
          "Registe o recebimento pela conta do paciente ou seguradora para actualizar o saldo e emitir o recibo.",
          409,
        );
      }
      allowed(u, FINANCE);
      const d = {
        data: date(b.data),
        descricao: value(b.descricao, 500),
        tipo: value(b.tipo, 10),
        valor: b.valor,
        categoria: value(b.categoria, 100, true) || "Geral",
        referencia: value(b.referencia, 200, true),
      };
      if (!["entrada", "saida"].includes(d.tipo))
        deny("Tipo de movimento inválido.");
      if (
        typeof d.valor !== "number" ||
        !Number.isFinite(d.valor) ||
        d.valor <= 0 ||
        d.valor > 1e12 ||
        Math.abs(d.valor * 100 - Math.round(d.valor * 100)) > 0.0001
      )
        deny("Indique um valor positivo, com até duas casas decimais.");
      const requestId = b.requestId ? uuid(b.requestId) : randomUUID();
      const prior = (
        await c.query(
          "SELECT * FROM public.movimentos WHERE empresa_id=$1 AND request_id=$2",
          [u.empresaId, requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.data !== d.data ||
          prior.descricao !== d.descricao ||
          prior.tipo !== d.tipo ||
          Number(prior.valor) !== d.valor ||
          prior.categoria !== d.categoria ||
          prior.referencia !== d.referencia
        )
          deny("O identificador de repetição pertence a outro movimento.", 409);
        return prior;
      }
      const row = (
        await c.query(
          "INSERT INTO public.movimentos(empresa_id,data,descricao,tipo,valor,categoria,referencia,registado_por,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
          [
            u.empresaId,
            d.data,
            d.descricao,
            d.tipo,
            Math.round(d.valor * 100) / 100,
            d.categoria,
            d.referencia,
            u.funcionarioNome || u.username,
            requestId,
          ],
        )
      ).rows[0];
      await event(c, u, "finance.movement.create", String(row.id), {
        tipo: d.tipo,
        valor: d.valor,
      });
      return row;
    });
    res.status(201).json(camel(result));
  });
  r.delete("/movimentos/:id", async (req, res) => {
    const u = getUser(req);
    allowed(u, FINANCE);
    await transaction(pool, u.empresaId!, async (c) => {
      const number = id(req.params.id);
      const row = (
        await c.query(
          "SELECT * FROM public.movimentos WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
          [u.empresaId, number],
        )
      ).rows[0];
      if (!row) return;
      if (row.fatura_id)
        deny(
          "Um recebimento vinculado não pode ser apagado. Registe a rectificação na conta do pagador.",
          409,
        );
      // Retain the original manual entry in the institution's audit chain.
      await event(c, u, "finance.movement.delete", String(number), {
        original: row,
      });
      await c.query(
        "DELETE FROM public.movimentos WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, number],
      );
    });
    res.sendStatus(204);
  });
  r.use(apiErrors);
  return r;
}

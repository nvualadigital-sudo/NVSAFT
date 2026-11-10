import { enrichInsuredInvoices } from "./insurance.js";
import { insuredInvoice, recordPrivateBilling, ensurePrivateAccount } from "../lib/insurance.js";
import { camel } from "./billing.js";
import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  configTable,
  pacientesTable,
  resultadosTable,
  faturasTable,
  movimentosTable,
  produtosTable,
  examesCustomTable,
  reagentesTable,
  stockMovimentosTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireEmpresa, getUser } from "../lib/auth.js";
import { STAFF_REPORT_SQL, OWNED_REPORT_SQL, staffReport } from "../lib/lab-publication.js";

import { createCashLedgerRouter } from "./cash-ledger.js";
const router = Router();
router.use("/exames-custom", requireEmpresa, (req, res, next) => {
  if (
    !["GET", "HEAD"].includes(req.method) &&
    !["admin", "gestor", "tecnico"].includes(getUser(req).funcao || "")
  ) {
    res
      .status(403)
      .json({
        error: "A configuração de exames exige uma função de laboratório.",
      });
    return;
  }
  next();
});

function getEmpresaId(req: any): string {
  const user = getUser(req);
  if (!user?.empresaId) throw new Error("empresaId ausente no token");
  return user.empresaId;
}

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(str, 10);
  if (isNaN(id)) throw new Error("ID inválido");
  return id;
}

// --- Config ---
router.get("/config", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  let [cfg] = await db
    .select()
    .from(configTable)
    .where(eq(configTable.empresaId, empresaId));
  if (!cfg) {
    const [created] = await db
      .insert(configTable)
      .values({ empresaId })
      .returning();
    cfg = created;
  }
  res.json(cfg);
});

router.put("/config", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  if (!["admin","gestor"].includes(getUser(req).funcao || "")) {res.status(403).json({error:"A configuração da empresa exige um administrador ou gestor."});return;}
  const d = req.body;
  const u: Record<string, any> = {};
  const fields = [
    "nomeClinica",
    "nif",
    "endereco",
    "telefone",
    "email",
    "directorTecnico",
    "logoData",
    "assinaturaData",
    "serie",
    "proximoNumeroFatura",
    "ivaTaxa",
    "moeda",
    "website",
  ];
  for (const f of fields)
    if (Object.prototype.hasOwnProperty.call(d, f) && d[f] !== undefined)
      u[f] = d[f];

  let [cfg] = await db
    .select()
    .from(configTable)
    .where(eq(configTable.empresaId, empresaId));
  if (!cfg) {
    const [created] = await db
      .insert(configTable)
      .values({ empresaId, ...u })
      .returning();
    res.json(created);
    return;
  }
  const [updated] = await db
    .update(configTable)
    .set(u)
    .where(eq(configTable.empresaId, empresaId))
    .returning();
  res.json(updated);
});

// --- Pacientes ---
router.get("/pacientes", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  const rows = await db
    .select()
    .from(pacientesTable)
    .where(eq(pacientesTable.empresaId, empresaId));
  const role = getUser(req).funcao || "";
  if (["financeiro", "rececionista"].includes(role)) {
    res.json(
      rows.map((p) => ({
        ...p,
        alergias: "",
        patologiasCronicas: "",
        medicacaoHabitual: "",
        observacoes: "",
        grupoSanguineo: "",
        fatorRh: "",
      })),
    );
    return;
  }
  res.json(rows);
});

router.post("/pacientes", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  const d = req.body;
  const [row] = await db
    .insert(pacientesTable)
    .values({
      passaporte: d.passaporte ?? "",
      observacoes: d.observacoes ?? "",
      nome: d.nome ?? "",
      nasc: d.nasc ?? "",
      sexo: d.sexo ?? "",
      idade: d.idade ?? "",
      bi: d.bi ?? "",
      nif: d.nif ?? "",
      nacionalidade: d.nacionalidade ?? "",
      estadoCivil: d.estadoCivil ?? "",
      profissao: d.profissao ?? "",
      telefone: d.telefone ?? "",
      telefone2: d.telefone2 ?? "",
      email: d.email ?? "",
      endereco: d.endereco ?? "",
      grupoSanguineo: d.grupoSanguineo ?? "",
      fatorRh: d.fatorRh ?? "",
      alergias: d.alergias ?? "",
      patologiasCronicas: d.patologiasCronicas ?? "",
      medicacaoHabitual: d.medicacaoHabitual ?? "",
      contactoEmergenciaNome: d.contactoEmergenciaNome ?? "",
      contactoEmergenciaTel: d.contactoEmergenciaTel ?? "",
      empresa: d.empresa ?? "",
      medico: d.medico ?? "",
      recolha: d.recolha ?? "",
      empresaId,
    })
    .returning();
  res.status(201).json(row);
});

router.put(
  "/pacientes/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    let id: number;
    try {
      id = parseId(req.params.id);
    } catch {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const d = req.body;
    const u: Record<string, any> = {};
    const fields = [
      "passaporte",
      "observacoes",
      "nome",
      "nasc",
      "sexo",
      "idade",
      "bi",
      "nif",
      "nacionalidade",
      "estadoCivil",
      "profissao",
      "telefone",
      "telefone2",
      "email",
      "endereco",
      "grupoSanguineo",
      "fatorRh",
      "alergias",
      "patologiasCronicas",
      "medicacaoHabitual",
      "contactoEmergenciaNome",
      "contactoEmergenciaTel",
      "empresa",
      "medico",
      "recolha",
    ];
    for (const f of fields)
      if (Object.prototype.hasOwnProperty.call(d, f) && d[f] !== undefined)
        u[f] = d[f];
    if (!Object.keys(u).length) {
      res.status(400).json({ error: "Sem campos alteráveis no cadastro." });
      return;
    }
    const [row] = await db
      .update(pacientesTable)
      .set(u)
      .where(
        and(eq(pacientesTable.id, id), eq(pacientesTable.empresaId, empresaId)),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    res.json(row);
  },
);

router.delete(
  "/pacientes/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    let id: number;
    try {
      id = parseId(req.params.id);
    } catch {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db
      .delete(pacientesTable)
      .where(
        and(eq(pacientesTable.id, id), eq(pacientesTable.empresaId, empresaId)),
      );
    res.sendStatus(204);
  },
);

// --- Resultados ---
router.get("/resultados", requireEmpresa, async (req, res): Promise<void> => {
  if (
    !["admin", "gestor", "tecnico", "medico", "enfermeiro"].includes(
      getUser(req).funcao || "",
    )
  ) {
    res.json([]);
    return;
  }
  const empresaId = getEmpresaId(req);
  const rows = await pool.query(STAFF_REPORT_SQL + " WHERE " + OWNED_REPORT_SQL + " ORDER BY r.id DESC",[empresaId]);
  res.json(rows.rows.map((row:any)=>staffReport(row).result));
});

// Legacy reports remain readable; all new entries/corrections use the traceable workflow.
for (const method of ["post", "put", "delete"] as const) {
  const route = method === "post" ? "/resultados" : "/resultados/:id";
  router[method](route, requireEmpresa, (_req, res) => {
    res.status(409).json({
      error:
        "Resultados clínicos são preservados. Use o Laboratório para criar um pedido ou uma rectificação versionada com validação independente.",
    });
  });
}

// --- Faturas ---
router.get("/faturas", requireEmpresa, async (req, res): Promise<void> => {
  if (
    !["admin", "gestor", "financeiro", "rececionista"].includes(
      getUser(req).funcao || "",
    )
  ) {
    res.json([]);
    return;
  }
  const empresaId = getEmpresaId(req);
  const rows = await db
    .select()
    .from(faturasTable)
    .where(
      and(
        eq(faturasTable.empresaId, empresaId),
        sql`(${faturasTable.pacienteId} IS NULL OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=${faturasTable.pacienteId} AND p.empresa_id=${faturasTable.empresaId}))`,
      ),
    );
  res.json(await enrichInsuredInvoices(pool,empresaId,rows));
});

router.put("/faturas/:id", requireEmpresa, async (req, res): Promise<void> => {
  if(!["admin","gestor","financeiro","rececionista"].includes(getUser(req).funcao || "")){res.status(403).json({error:"Sem permissão de facturação."});return;}
  const empresaId = getEmpresaId(req);
  let id: number;
  try {
    id = parseId(req.params.id);
  } catch {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const [existing] = await db
    .select()
    .from(faturasTable)
    .where(and(eq(faturasTable.id, id), eq(faturasTable.empresaId, empresaId)));
  if (!existing) {
    res.status(404).json({ error: "Documento não encontrado." });
    return;
  }
  if (req.body.insurance || await insuredInvoice(pool,empresaId,id)) {
    if(Object.keys(req.body).every(k=>k==="codigoHash")){res.json((await enrichInsuredInvoices(pool,empresaId,[existing]))[0]);return;}
    res.status(409).json({error:"Utilize a cobrança por responsabilidade e as notas de crédito para documentos de seguro. A factura e a cobertura emitidas são conservadas."});return;
  }
  if (existing.estado !== "rascunho") {
    const keys = Object.keys(req.body);
    if (keys.every((k) => k === "codigoHash")) {
      res.json((await enrichInsuredInvoices(pool,empresaId,[existing]))[0]);
      return;
    }
    if (
      req.body.estado === "paga" &&
      keys.every((k) =>
        ["estado", "formaPagamento", "horaOperacao"].includes(k),
      )
    ) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["billing:"+empresaId]);
        const q = await c.query(
          "SELECT * FROM public.faturas WHERE id=$1 AND empresa_id=$2 FOR UPDATE",
          [id, empresaId],
        );
        const f = q.rows[0];
        if (f.estado === "emitida") {
          await ensurePrivateAccount(c,getUser(req),f);
          const account=(await c.query("SELECT count(*) AS n,coalesce(sum(debit-credit),0) AS balance FROM public.nv_receivable_entries WHERE empresa_id=$1 AND invoice_id=$2",[empresaId,id])).rows[0];
          const remaining=Number(account.n)>0?Number(account.balance):Number(f.total);
          if(remaining>0.001 && Math.abs(remaining-Number(f.total))>0.001){await c.query("ROLLBACK");res.status(409).json({error:"Esta factura tem movimentos parciais. Registe apenas o saldo no extracto do paciente para emitir o recibo correcto."});return;}
          const paidDate=new Date().toISOString().slice(0,10);
          if(remaining>0.001)await recordPrivateBilling(c,getUser(req),{...f,data:paidDate,estado:"paga"});
          await c.query(
            "UPDATE public.faturas SET estado='paga',forma_pagamento=$3 WHERE id=$1 AND empresa_id=$2",
            [
              id,
              empresaId,
              req.body.formaPagamento ||
                f.forma_pagamento ||
                "Registo conferido",
            ],
          );
          if(remaining>0.001)await c.query(
            "INSERT INTO public.movimentos(empresa_id,data,descricao,tipo,valor,categoria,fatura_id,referencia,registado_por) VALUES($1,$2,$3,'entrada',$4,'Faturação',$5,$6,$7)",
            [
              empresaId,
              paidDate,
              "Recebimento " + f.numero,
              f.total,
              id,
              f.numero,
              getUser(req).username,
            ],
          );
        }
        await c.query("COMMIT");
        const [row] = await db
          .select()
          .from(faturasTable)
          .where(
            and(eq(faturasTable.id, id), eq(faturasTable.empresaId, empresaId)),
          );
        res.json((await enrichInsuredInvoices(pool,empresaId,[row]))[0]);
        return;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    res.status(409).json({
      error: "Documento emitido é imutável. Utilize nota de crédito.",
    });
    return;
  }
  const d = req.body;
  const u: Record<string, any> = {};
  const fields = [
    "numero",
    "serie",
    "data",
    "horaOperacao",
    "dataVencimento",
    "clienteNome",
    "clienteNif",
    "clienteEndereco",
    "linhas",
    "subtotalSemIva",
    "totalIva",
    "ivaTaxa",
    "total",
    "estado",
    "observacoes",
    "pacienteId",
    "resultadoId",
    "emitidoPor",
    "codigoHash",
    "emissaoContagem",
    "facturaPremiada",
    "notaCreditoMotivo",
    "tipoDocumento",
    "formaPagamento",
  ];
  for (const f of fields)
    if (Object.prototype.hasOwnProperty.call(d, f) && d[f] !== undefined)
      u[f] = d[f];
  if (Object.keys(u).length === 0) {
    res.status(400).json({ error: "Nenhum campo válido para actualizar" });
    return;
  }
  const [row] = await db
    .update(faturasTable)
    .set(u)
    .where(and(eq(faturasTable.id, id), eq(faturasTable.empresaId, empresaId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Fatura não encontrada" });
    return;
  }
  res.json(row);
});

router.delete(
  "/faturas/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    let id: number;
    try {
      id = parseId(req.params.id);
    } catch {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [issued] = await db
      .select()
      .from(faturasTable)
      .where(
        and(eq(faturasTable.id, id), eq(faturasTable.empresaId, empresaId)),
      );
    if (issued && issued.estado !== "rascunho") {
      res
        .status(409)
        .json({ error: "Não é permitido eliminar documentos emitidos." });
      return;
    }
    await db
      .delete(faturasTable)
      .where(
        and(eq(faturasTable.id, id), eq(faturasTable.empresaId, empresaId)),
      );
    res.sendStatus(204);
  },
);

// --- Movimentos CC ---
router.use(createCashLedgerRouter());

// --- Produtos ---
router.get("/produtos", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  const rows = await db
    .select()
    .from(produtosTable)
    .where(eq(produtosTable.empresaId, empresaId));
  res.json(rows);
});

router.post("/produtos", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  const d = req.body;
  const [row] = await db
    .insert(produtosTable)
    .values({
      stock: String(Number(d.stock) || 0),
      stockMinimo: String(Number(d.stockMinimo) || 0),
      codigo: d.codigo ?? "",
      nome: d.nome ?? "",
      categoria: d.categoria ?? "",
      preco: d.preco ?? 0,
      ivaIsento: d.ivaIsento ?? false,
      descricao: d.descricao ?? "",
      ativo: d.ativo !== false,
      empresaId,
    })
    .returning();
  res.status(201).json(row);
});

router.put("/produtos/:id", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  let id: number;
  try {
    id = parseId(req.params.id);
  } catch {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const d = req.body;
  const u: Record<string, any> = {};
  const fields = [
    "codigo",
    "nome",
    "categoria",
    "preco",
    "ivaIsento",
    "descricao",
    "ativo",
    "stock",
    "stockMinimo",
  ];
  for (const f of fields)
    if (Object.prototype.hasOwnProperty.call(d, f) && d[f] !== undefined)
      u[f] = d[f];
  if (Object.keys(u).length === 0) {
    res.status(400).json({ error: "Nenhum campo válido para actualizar" });
    return;
  }
  const [row] = await db
    .update(produtosTable)
    .set(u)
    .where(
      and(eq(produtosTable.id, id), eq(produtosTable.empresaId, empresaId)),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }
  res.json(row);
});

router.delete(
  "/produtos/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    let id: number;
    try {
      id = parseId(req.params.id);
    } catch {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db
      .delete(produtosTable)
      .where(
        and(eq(produtosTable.id, id), eq(produtosTable.empresaId, empresaId)),
      );
    res.sendStatus(204);
  },
);

// --- Exames Custom ---
router.get(
  "/exames-custom",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    const rows = await db
      .select()
      .from(examesCustomTable)
      .where(eq(examesCustomTable.empresaId, empresaId));
    res.json(rows);
  },
);

router.post(
  "/exames-custom",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    const d = req.body;
    const [row] = await db
      .insert(examesCustomTable)
      .values({
        categoria: d.categoria ?? "",
        nome: d.nome ?? "",
        parametros: d.parametros ?? [],
        empresaId,
      })
      .returning();
    res.status(201).json(row);
  },
);

router.put(
  "/exames-custom/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    let id: number;
    try {
      id = parseId(req.params.id);
    } catch {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const d = req.body;
    const u: Record<string, any> = {};
    const fields = ["categoria", "nome", "parametros"];
    for (const f of fields)
      if (Object.prototype.hasOwnProperty.call(d, f) && d[f] !== undefined)
        u[f] = d[f];
    if (Object.keys(u).length === 0) {
      res.status(400).json({ error: "Nenhum campo válido para actualizar" });
      return;
    }
    const [row] = await db
      .update(examesCustomTable)
      .set(u)
      .where(
        and(
          eq(examesCustomTable.id, id),
          eq(examesCustomTable.empresaId, empresaId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Exame não encontrado" });
      return;
    }
    res.json(row);
  },
);

router.delete(
  "/exames-custom/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    let id: number;
    try {
      id = parseId(req.params.id);
    } catch {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db
      .delete(examesCustomTable)
      .where(
        and(
          eq(examesCustomTable.id, id),
          eq(examesCustomTable.empresaId, empresaId),
        ),
      );
    res.sendStatus(204);
  },
);

// --- Reagentes ---
router.get("/reagentes", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  const rows = await db
    .select()
    .from(reagentesTable)
    .where(eq(reagentesTable.empresaId, empresaId));
  res.json(rows);
});

router.post("/reagentes", requireEmpresa, async (req, res): Promise<void> => {
  const empresaId = getEmpresaId(req);
  const d = req.body;
  if (!d.nome) {
    res.status(400).json({ error: "Nome obrigatório" });
    return;
  }
  const [row] = await db
    .insert(reagentesTable)
    .values({
      empresaId,
      codigo: d.codigo ?? "",
      nome: d.nome,
      categoria: d.categoria ?? "",
      tipo: d.tipo ?? "reagente",
      unidade: d.unidade ?? "unidades",
      quantidadeAtual: d.quantidadeAtual ?? 0,
      quantidadeMinima: d.quantidadeMinima ?? 0,
      lote: d.lote ?? "",
      validade: d.validade ?? "",
      fornecedor: d.fornecedor ?? "",
      localizacao: d.localizacao ?? "",
      observacoes: d.observacoes ?? "",
      ativo: d.ativo !== false,
    })
    .returning();
  res.status(201).json(row);
});

router.put(
  "/reagentes/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    let id: number;
    try {
      id = parseId(req.params.id);
    } catch {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const d = req.body;
    const u: Record<string, any> = {};
    const fields = [
      "codigo",
      "nome",
      "categoria",
      "tipo",
      "unidade",
      "quantidadeAtual",
      "quantidadeMinima",
      "lote",
      "validade",
      "fornecedor",
      "localizacao",
      "observacoes",
      "ativo",
    ];
    for (const f of fields)
      if (Object.prototype.hasOwnProperty.call(d, f) && d[f] !== undefined)
        u[f] = d[f];
    if (Object.keys(u).length === 0) {
      res.status(400).json({ error: "Nenhum campo para actualizar" });
      return;
    }
    const [row] = await db
      .update(reagentesTable)
      .set(u)
      .where(
        and(eq(reagentesTable.id, id), eq(reagentesTable.empresaId, empresaId)),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Reagente não encontrado" });
      return;
    }
    res.json(row);
  },
);

router.delete(
  "/reagentes/:id",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    let id: number;
    try {
      id = parseId(req.params.id);
    } catch {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db
      .delete(reagentesTable)
      .where(
        and(eq(reagentesTable.id, id), eq(reagentesTable.empresaId, empresaId)),
      );
    res.sendStatus(204);
  },
);

// --- Stock Movimentos ---
router.get(
  "/stock-movimentos",
  requireEmpresa,
  async (req, res): Promise<void> => {
    const empresaId = getEmpresaId(req);
    const rows = await db
      .select()
      .from(stockMovimentosTable)
      .where(eq(stockMovimentosTable.empresaId, empresaId));
    res.json(rows);
  },
);

router.post("/stock-movimentos", requireEmpresa, async (req, res) => {
  const org = getEmpresaId(req),
    d = req.body,
    quantity = Number(d.quantidade);
  if (
    !Number.isSafeInteger(Number(d.reagenteId)) ||
    !["entrada", "saida", "ajuste"].includes(d.tipo) ||
    !Number.isFinite(quantity) ||
    quantity < 0 ||
    (d.tipo !== "ajuste" && quantity === 0) ||
    !String(d.motivo || "").trim()
  ) {
    res
      .status(400)
      .json({ error: "Movimento, quantidade ou motivo inválido." });
    return;
  }
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const found = await c.query(
      "SELECT * FROM public.reagentes WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
      [org, d.reagenteId],
    );
    const old = found.rows[0];
    if (!old) {
      await c.query("ROLLBACK");
      res.status(404).json({ error: "Reagente não encontrado." });
      return;
    }
    const next =
      d.tipo === "entrada"
        ? Number(old.quantidade_atual) + quantity
        : d.tipo === "saida"
          ? Number(old.quantidade_atual) - quantity
          : quantity;
    if (next < 0) {
      await c.query("ROLLBACK");
      res.status(409).json({ error: "Stock insuficiente para a saída." });
      return;
    }
    const movement = await c.query(
      "INSERT INTO public.stock_movimentos(empresa_id,reagente_id,tipo,quantidade,lote,validade,motivo,data,registado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [
        org,
        d.reagenteId,
        d.tipo,
        quantity,
        d.lote || old.lote,
        d.validade || old.validade,
        d.motivo,
        d.data || new Date().toISOString().slice(0, 10),
        getUser(req).username,
      ],
    );
    const updated = await c.query(
      "UPDATE public.reagentes SET quantidade_atual=$3,lote=$4,validade=$5 WHERE empresa_id=$1 AND id=$2 RETURNING *",
      [
        org,
        d.reagenteId,
        next,
        d.tipo === "entrada" ? d.lote || old.lote : old.lote,
        d.tipo === "entrada" ? d.validade || old.validade : old.validade,
      ],
    );
    await c.query("COMMIT");
    res.status(201).json({
      movimento: camel(movement.rows[0]),
      reagente: camel(updated.rows[0]),
    });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});

router.delete("/stock-movimentos/:id", requireEmpresa, (_req, res) => {
  res.status(409).json({
    error:
      "Os movimentos de stock preservam o histórico. Registe um ajuste com motivo.",
  });
});

export default router;

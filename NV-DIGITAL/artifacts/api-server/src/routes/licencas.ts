import { Router } from "express";
import { pool } from "@workspace/db";
import { requireDeveloper, getUser } from "../lib/auth.js";

const router = Router();
router.use(requireDeveloper);

const VALID_STATES = new Set(["activo", "suspenso", "cancelado"]);
const VALID_MODULES = new Set(["laboratorial", "hospitalar", "escolar", "comercial", "faturacao", "farmacia", "laboratorio"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/licencas", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT e.id AS empresa_id, e.nome, e.ativo, e.modulos,
      l.plano, l.estado, l.inicio, l.fim, l.valor_mensal, l.moeda, l.observacoes, l.actualizado_em,
      CASE WHEN l.empresa_id IS NULL THEN 'sem_licenca'
           WHEN l.estado <> 'activo' THEN l.estado
           WHEN l.inicio > CURRENT_DATE THEN 'futuro'
           WHEN l.fim IS NOT NULL AND l.fim < CURRENT_DATE THEN 'expirado'
           ELSE 'vigente' END AS situacao
      FROM public.empresas e LEFT JOIN public.nv_licencas l ON l.empresa_id=e.id
      ORDER BY e.nome`);
    res.json(result.rows);
  } catch (e) {
    res.status(503).json({error:"Gestor de licenças indisponível. Execute a migração 20261112_nv_licencas.sql."});
  }
});

router.put("/licencas/:empresaId", async (req, res) => {
  const id = String(req.params.empresaId);
  if (!UUID.test(id)) { res.status(400).json({error:"Identificador inválido."}); return; }
  const { plano, estado, inicio, fim, valorMensal, observacoes, modulos } = req.body ?? {};
  if (typeof plano !== "string" || plano.trim().length < 1 || plano.length > 80 ||
      !VALID_STATES.has(estado) || typeof inicio !== "string" || !DATE.test(inicio) ||
      (fim !== null && fim !== "" && (typeof fim !== "string" || !DATE.test(fim))) ||
      !Number.isFinite(Number(valorMensal)) || Number(valorMensal) < 0 ||
      typeof observacoes !== "string" || observacoes.length > 2000 ||
      !Array.isArray(modulos) || modulos.length < 1 ||
      modulos.some((m: unknown) => typeof m !== "string" || !VALID_MODULES.has(m))) {
    res.status(400).json({error:"Dados da licença inválidos."}); return;
  }
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const company = await c.query("SELECT id,modulos FROM public.empresas WHERE id=$1 FOR UPDATE", [id]);
    if (!company.rowCount) { await c.query("ROLLBACK"); res.status(404).json({error:"Empresa não encontrada."}); return; }
    const previous = await c.query("SELECT * FROM public.nv_licencas WHERE empresa_id=$1 FOR UPDATE", [id]);
    const updated = await c.query(`INSERT INTO public.nv_licencas
      (empresa_id,plano,estado,inicio,fim,valor_mensal,observacoes,actualizado_por)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (empresa_id) DO UPDATE SET plano=EXCLUDED.plano,estado=EXCLUDED.estado,
      inicio=EXCLUDED.inicio,fim=EXCLUDED.fim,valor_mensal=EXCLUDED.valor_mensal,
      observacoes=EXCLUDED.observacoes,actualizado_por=EXCLUDED.actualizado_por,
      actualizado_em=now() RETURNING *`,
      [id,plano.trim(),estado,inicio,fim || null,Number(valorMensal),observacoes,getUser(req).username]);
    const uniqueModules=[...new Set(modulos)];
    await c.query("UPDATE public.empresas SET modulos=$2::jsonb WHERE id=$1", [id,JSON.stringify(uniqueModules)]);
    await c.query("INSERT INTO public.nv_licencas_auditoria(empresa_id,operador,anterior,novo) VALUES($1,$2,$3::jsonb,$4::jsonb)",
      [id,getUser(req).username,previous.rows[0] ? JSON.stringify({...previous.rows[0],modulos:company.rows[0].modulos}) : null,
       JSON.stringify({...updated.rows[0],modulos:uniqueModules})]);
    await c.query("COMMIT");
    res.json({...updated.rows[0],modulos:uniqueModules});
  } catch (e: any) {
    await c.query("ROLLBACK").catch(()=>{});
    res.status(e?.code === "23514" ? 400 : 500).json({error: e?.code === "23514" ? "Período inválido." : "Não foi possível guardar a licença."});
  } finally { c.release(); }
});

router.get("/licencas/:empresaId/auditoria", async (req,res) => {
  const id=String(req.params.empresaId);
  if (!UUID.test(id)) {res.status(400).json({error:"Identificador inválido."});return;}
  const rows=await pool.query("SELECT id,operador,anterior,novo,data FROM public.nv_licencas_auditoria WHERE empresa_id=$1 ORDER BY data DESC LIMIT 100",[id]);
  res.json(rows.rows);
});

export default router;

import {
  pharmacyPosState,
  initializeTrainingLot,
  pharmacyQuote,
  recordTrainingSale,
} from "../lib/pharmacy-pos.js";
import { createAgtRouter } from "./agt-homologacao.js";
import { assertBillingReady } from "../lib/billing-readiness.js";
import {
  loadProducer,
  readKey,
  options as agtOptions,
} from "../lib/agt/runtime.js";
import { legacySignature, fingerprint } from "../lib/agt/crypto.js";
import { docTypes, isoDate } from "../lib/agt/wire.js";
import {
  findReplacement,
  preflightReplacement,
  rejectionEvidence,
  replacementType,
  type ReplacementProof,
} from "../lib/agt/replacement.js";
import {
  catalogueSettings,
  saveCatalogue,
  categoryNames,
  validatedKit,
} from "../lib/billing-catalogue.js";
import { insuranceQuote, insuredInvoice } from "../lib/insurance.js";
import {
  recordIntegratedAccount,
  settlementDocument,
} from "../lib/insurance-integrated.js";
import { enrichInsuredInvoices } from "./insurance.js";
import { Router } from "express";
import { pool } from "@workspace/db";
import { randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";
import { requireEmpresa, getUser } from "../lib/auth.js";
import { camel } from "./billing.js";
import {
  check,
  text,
  cents,
  totals,
  codes,
  digest,
  localStamp,
} from "../lib/billing-engine.js";
const admins = ["admin", "gestor"],
  cashRoles = [...admins, "financeiro", "rececionista"],
  pharmacyRoles = [...admins, "farmaceutico"];
const isPharmacyPos = (req: any) =>
  req.path === "/pharmacy-pos" || req.path.startsWith("/pharmacy-pos/");
const defaults = {
  moeda: "AOA",
  serie: "A",
  ivaTaxa: 14,
  regimeIva: "Regime Geral",
  formatoImpressaoPadrao: "a4",
  alertaDiasValidade: 30,
  alertaStockBaixo: true,
  sonsScanner: false,
  configuracaoFiscal: {
    softwareNome: "NVUALASOFT",
    softwareVersao: "2026.10",
    softwareCertificadoNumero: "PENDENTE_AGT",
    terminalCaixa: "POS-01",
    motivoIsencaoPadrao: "",
    comunicacaoSaftAtiva: false,
  },
  ambiente: "homologacao",
};
function invoice(r: any) {
  const d: any = camel(r);
  const meta = d.billingMeta || {};
  for (const k of ["subtotalSemIva", "totalIva", "ivaTaxa", "total"])
    d[k] = Number(d[k]);
  return {
    ...d,
    ...meta,
    id: r.id,
    numero: r.numero,
    estado: r.estado,
    emitenteSnapshot: r.emitente_snapshot,
  };
}
function agtStatus(row: any, jobs: any[]) {
  if (row.agt_replacement_no)
    return {
      agtStatus: "substituida",
      agtReplacementNo: row.agt_replacement_no,
    };
  const job = jobs.find((j) => j.invoice_ids.includes(row.id));
  if (!job)
    return {
      agtStatus:
        row.billing_meta?.agtMode === "homologacao_oficial"
          ? "nao_preparado"
          : "formacao_local",
    };
  const d = job.response?.body?.documentStatusList?.find(
    (d: any) => d.documentNo === row.numero,
  );
  return {
    agtStatus:
      job.status === "parcial" && d
        ? d.documentStatus === "V"
          ? "validado"
          : "rejeitado"
        : job.status,
    agtRequestId: job.agt_request_id || null,
    agtCanCorrect: replacementType(row) && !!rejectionEvidence(row, [job]),
  };
}
function product(r: any) {
  const d: any = camel(r);
  return {
    ...d,
    ...d.billingMeta,
    id: r.id,
    stock: Number(r.stock),
    stockMinimo: Number(r.stock_minimo),
    preco: Number(r.preco),
    unidadeMedida:
      d.billingMeta?.unidadeMedida ||
      (/serv|exame|labor/i.test(r.categoria) ? "serv" : "un"),
  };
}
export function createIntegratedBilling(
  db: any = pool,
  agtDependencies: Parameters<typeof createAgtRouter>[1] = {},
) {
  function countedDenominations(value: any) {
    if (!value) return 0;
    check(
      typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length <= 10,
      "Contagem por gavetas inválida.",
    );
    let total = 0;
    for (const denominations of Object.values(value) as any[]) {
      check(
        denominations &&
          typeof denominations === "object" &&
          Object.keys(denominations).length <= 20,
        "Contagem inválida.",
      );
      for (const [denom, qty] of Object.entries(denominations)) {
        check(
          [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000].includes(
            Number(denom),
          ) &&
            Number.isSafeInteger(qty) &&
            Number(qty) >= 0 &&
            Number(qty) <= 100000,
          "Denominação ou quantidade inválida.",
        );
        total += Number(denom) * Number(qty);
      }
    }
    return cents(total);
  }
  const router = Router();
  router.use(requireEmpresa);
  router.use((req, res, next) => {
    const allowed = isPharmacyPos(req) ? pharmacyRoles : cashRoles;
    if (!allowed.includes(getUser(req).funcao || "")) {
      res.status(403).json({ error: "Sem permissão de facturação." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const wrap = (fn: any) => async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      const schemaError = ["42P01", "42703"].includes(e.code);
      res
        .status(
          schemaError
            ? 503
            : e.status ||
                (["23503", "23505", "23514", "40001", "40P01"].includes(e.code)
                  ? 409
                  : e.code
                    ? 500
                    : 400),
        )
        .json({
          code: schemaError ? "database_update_required" : e.publicCode,
          error: schemaError
            ? "A base de dados ainda não recebeu as migrações desta versão. Execute pnpm db:migrate no servidor da API e volte a carregar este módulo."
            : e.code
              ? "Operação rejeitada pela base de dados. Verifique referências e concorrência."
              : e.message || "Operação não confirmada.",
        });
    }
  };
  const approvalAttempts = new Map<string, { count: number; until: number }>();
  const admin = (req: any) => {
    if (!admins.includes(getUser(req).funcao || ""))
      throw Object.assign(
        new Error(
          "Esta operação exige um gestor ou administrador autenticado.",
        ),
        { status: 403 },
      );
  };
  async function approveDifference(c: any, u: any, b: any) {
    if (admins.includes(u.funcao || "")) return u.username;
    const key = u.empresaId + ":" + u.username,
      old = approvalAttempts.get(key),
      now = Date.now();
    if (old && old.until > now && old.count >= 5)
      throw Object.assign(
        new Error("Demasiadas tentativas de aprovação. Aguarde 15 minutos."),
        { status: 429 },
      );
    const attempt =
      old && old.until > now ? old : { count: 0, until: now + 15 * 60 * 1000 };
    attempt.count++;
    approvalAttempts.set(key, attempt);
    const username = String(b.supervisorUsername || ""),
      password = String(b.supervisorPassword || "");
    check(
      username &&
        username !== u.username &&
        password.length > 0 &&
        password.length <= 200,
      "Indique o utilizador e a palavra-passe de um gestor da instituição.",
    );
    const account = (
      await c.query(
        "SELECT username,password FROM public.funcionarios WHERE empresa_id=$1 AND username=$2 AND ativo=true AND funcao IN ('admin','gestor') UNION ALL SELECT username,password FROM public.empresas WHERE id=$1 AND username=$2 AND ativo=true",
        [u.empresaId, username],
      )
    ).rows[0];
    let verified = false;
    if (account) {
      if (account.password.startsWith("$2"))
        verified = await bcrypt.compare(password, account.password);
      else {
        const a = Buffer.from(password),
          b = Buffer.from(account.password);
        verified = a.length === b.length && timingSafeEqual(a, b);
      }
    }
    if (!verified)
      throw Object.assign(
        new Error("Credenciais de gestor inválidas para esta instituição."),
        { status: 403 },
      );
    approvalAttempts.delete(key);
    return account.username;
  }
  async function config(c: any, org: string) {
    const base = (
      await c.query("SELECT * FROM public.config WHERE empresa_id=$1", [org])
    ).rows[0];
    const extra =
      (
        await c.query(
          "SELECT data FROM public.nv_billing_settings WHERE empresa_id=$1",
          [org],
        )
      ).rows[0]?.data || {};
    const agt = (
      await c.query(
        "SELECT data FROM public.nv_agt_profiles WHERE empresa_id=$1",
        [org],
      )
    ).rows[0]?.data;
    return {
      ...defaults,
      ...(base ? camel(base) : {}),
      ...extra,
      ivaTaxa: Number(extra.ivaTaxa ?? base?.iva_taxa ?? 14),
      logoDataUrl: base?.logo_data || "",
      calculoFiscalAGT: agt?.enabled === true,
      ambiente: "homologacao",
      formacaoAtiva: true,
      producaoFiscalAtiva: false,
      configuracaoFiscal: {
        ...defaults.configuracaoFiscal,
        ...extra.configuracaoFiscal,
        softwareNome: "NVUALASOFT",
        comunicacaoSaftAtiva: false,
      },
    };
  }
  async function tx(req: any, fn: any) {
    const u = getUser(req),
      b = req.body || {};
    check(
      /^[0-9a-f-]{36}$/i.test(b.requestId || ""),
      "Pedido sem chave de idempotência.",
    );
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        "nv-billing:" + u.empresaId,
      ]);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        "billing:" + u.empresaId,
      ]);
      const { supervisorPassword: _secret, ...safeBody } = b;
      const payload = { method: req.method, path: req.path, body: safeBody };
      const old = (
        await c.query(
          "SELECT actor,result,payload=$3::jsonb AS same FROM public.nv_billing_requests WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, b.requestId, JSON.stringify(payload)],
        )
      ).rows[0];
      if (old) {
        check(
          old.actor === u.username && old.same,
          "Chave de pedido reutilizada com outro conteúdo.",
        );
        await c.query("COMMIT");
        return old.result;
      }
      const result = await fn(c, u);
      await c.query(
        "INSERT INTO public.nv_billing_requests(empresa_id,id,actor,payload,result) VALUES($1,$2,$3,$4,$5)",
        [
          u.empresaId,
          b.requestId,
          u.username,
          JSON.stringify(payload),
          JSON.stringify(result),
        ],
      );
      await c.query(
        "INSERT INTO public.hospital_audit(id,empresa_id,actor,action,reference) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          u.empresaId,
          u.username,
          "billing" + req.method,
          req.path,
        ],
      );
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async function active(c: any, u: any) {
    return (
      await c.query(
        "SELECT * FROM public.nv_cash_sessions WHERE empresa_id=$1 AND actor=$2 AND closed_at IS NULL FOR UPDATE",
        [u.empresaId, u.username],
      )
    ).rows[0];
  }
  async function cashInfo(c: any, s: any, preloadedEntries?: any[]) {
    const entries = preloadedEntries || (
      await c.query(
        "SELECT * FROM public.nv_cash_entries WHERE empresa_id=$1 AND session_id=$2 ORDER BY created_at DESC,id",
        [s.empresa_id, s.id],
      )
    ).rows;
    const expected =
      Number(s.opening) +
      entries.reduce(
        (n: number, e: any) =>
          n + (e.kind === "withdrawal" ? -1 : 1) * Number(e.amount),
        0,
      );
    const movements = entries
      .filter((e: any) => e.kind !== "sale")
      .map((e: any) => ({
        id: e.id,
        tipo: e.kind === "withdrawal" ? "sangria" : "suprimento",
        valor: Number(e.amount),
        motivo: e.reason,
        operador: e.actor,
        em: e.created_at,
        gavetaId: "gaveta-principal",
        destinoId: "cofre",
      }));
    return {
      ...s.data,
      id: s.id,
      terminal: s.terminal,
      operador: s.actor,
      abertaEm: new Date(s.opened_at).toISOString(),
      fundoInicial: Number(s.opening),
      estado: s.closed_at ? "fechada" : "aberta",
      fechadaEm: s.closed_at,
      valorEsperado: Math.round(expected * 100) / 100,
      valorContado: s.counted === null ? undefined : Number(s.counted),
      diferenca: s.closed_at
        ? Number(s.counted) - Number(s.expected)
        : undefined,
      movimentos: movements,
      gavetas: [
        {
          id: "gaveta-principal",
          nome: "Gaveta Principal",
          tipo: "principal",
          saldo: Math.round(expected * 100) / 100,
          aberturas: 0,
        },
        { id: "cofre", nome: "Cofre", tipo: "cofre", saldo: 0, aberturas: 0 },
      ],
    };
  }
  router.get(
    "/state",
    wrap(async (req: any, res: any) => {
      await assertBillingReady(db);
      const u = getUser(req),
        org = u.empresaId,
        cfg = await config(db, org!);
      const [fs, ps, cs, ss, hs] = await Promise.all([
        db.query(
          "SELECT f.*,sub.numero AS agt_replacement_no FROM public.faturas f LEFT JOIN public.nv_agt_replacements rep ON rep.empresa_id=f.empresa_id AND rep.original_id=f.id LEFT JOIN public.faturas sub ON sub.empresa_id=rep.empresa_id AND sub.id=rep.replacement_id WHERE f.empresa_id=$1 AND (f.paciente_id IS NULL OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=f.paciente_id AND p.empresa_id=f.empresa_id)) ORDER BY f.id DESC",
          [org],
        ),
        db.query(
          "SELECT * FROM public.produtos WHERE empresa_id=$1 ORDER BY nome",
          [org],
        ),
        db.query(
          "SELECT id,nome,nif,bi,passaporte,telefone,email,endereco FROM public.pacientes WHERE empresa_id=$1 ORDER BY nome",
          [org],
        ),
        db.query(
          "SELECT * FROM public.nv_cash_sessions WHERE empresa_id=$1 AND actor=$2 AND closed_at IS NULL AND COALESCE(data->>'posChannel','')<>'farmacia'",
          [org, u.username],
        ),
        db.query(
          "SELECT * FROM public.nv_cash_sessions WHERE empresa_id=$1 AND actor=$2 AND closed_at IS NOT NULL AND COALESCE(data->>'posChannel','')<>'farmacia' ORDER BY closed_at DESC LIMIT 100",
          [org, u.username],
        ),
      ]);
      const printRows = (
        await db.query(
          "SELECT p.*,f.numero FROM public.nv_billing_prints p JOIN public.faturas f ON f.id=p.invoice_id AND f.empresa_id=p.empresa_id WHERE p.empresa_id=$1 ORDER BY p.created_at",
          [org],
        )
      ).rows;
      const audit: Record<string, any[]> = {};
      for (const f of fs.rows)
        audit[f.numero] = [
          {
            id: "issue-" + f.id,
            at: f.billing_meta?.createdAt || "",
            action: "emissao",
            label:
              f.estado === "rascunho"
                ? "Rascunho guardado"
                : "Documento registado",
            detail: f.emitido_por,
          },
        ];
      for (const p of printRows)
        (audit[p.numero] ||= []).push({
          id: p.id,
          at: p.created_at,
          action: "impressao",
          label: "Reserva de impressão",
          detail: p.actor + " · " + p.format + " · tentativa " + p.copy_no,
        });
      const receipts = new Set(
        fs.rows
          .filter(
            (x: any) =>
              x.tipo_documento === "recibo" && x.estado !== "rascunho",
          )
          .filter((x: any) => !x.billing_meta?.settlement)
          .map((x: any) => x.billing_meta?.documentoOrigem),
      );
      const agtJobs = (
        await db.query(
          "SELECT id,operation,invoice_ids,status,agt_request_id,CASE WHEN status IN ('parcial','rejeitado') THEN response END AS response,CASE WHEN status IN ('parcial','rejeitado') THEN payload END AS payload FROM public.nv_agt_jobs WHERE empresa_id=$1 AND operation='registarFactura' AND status<>'cancelado' ORDER BY created_at DESC,id DESC",
          [org],
        )
      ).rows;
      const enriched = await enrichInsuredInvoices(db, org!, fs.rows);
      // Uma única consulta substitui até 100 consultas individuais para as
      // sessões de caixa encerradas. O conteúdo/histórico mantém-se igual.
      const cashHistory = hs.rows.length
        ? (
            await db.query(
              "SELECT * FROM public.nv_cash_entries WHERE empresa_id=$1 AND session_id=ANY($2::uuid[]) ORDER BY created_at DESC,id",
              [org, hs.rows.map((s: any) => s.id)],
            )
          ).rows
        : [];
      const historyBySession = new Map<string, any[]>();
      for (const entry of cashHistory) {
        const id = String(entry.session_id);
        const list = historyBySession.get(id) || [];
        list.push(entry);
        historyBySession.set(id, list);
      }
      res.json({
        audit,
        faturas: enriched.map((x: any) => {
          const f = invoice(x);
          return {
            ...f,
            ...agtStatus(x, agtJobs),
            estado: x.agt_replacement_no
              ? f.estado
              : typeof f.receivableBalance === "number" &&
                  ["factura", "factura-recibo", "factura-global"].includes(
                    f.tipoDocumento,
                  )
                ? f.receivableBalance <= 0
                  ? "paga"
                  : f.estado
                : receipts.has(f.numero)
                  ? "paga"
                  : f.estado,
          };
        }),
        produtos: ps.rows.map(product),
        pacientes: cs.rows,
        kits: cfg.kits || [],
        categorias: categoryNames(cfg, ps.rows),
        movimentos: [],
        notificacoes: [],
        config: {
          ...cfg,
          caixaSessaoAtual: ss.rows[0]
            ? await cashInfo(db, ss.rows[0])
            : undefined,
          historicoCaixa: await Promise.all(
            hs.rows.map((s: any) => cashInfo(db, s, historyBySession.get(String(s.id)) || [])),
          ),
        },
        currentUser: {
          id: u.username,
          username: u.username,
          nome: u.funcionarioNome || u.username,
          cargo: u.funcao,
          role: admins.includes(u.funcao || "") ? "admin" : "operador",
          ativo: true,
          pin: "",
          criadoEm: "",
        },
      });
    }),
  );
  router.post(
    "/config",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          admin(req);
          const patch = req.body.patch || {};
          const before = await config(c, u.empresaId);
          const allowed = [
            "nomeClinica",
            "nif",
            "endereco",
            "telefone",
            "email",
            "serie",
            "ivaTaxa",
            "regimeIva",
            "formatoImpressaoPadrao",
            "mensagemRodape",
            "bancoNome",
            "bancoIban",
            "bancoSwift",
            "bancoConta",
            "perfisImpressoras",
            "configuracaoFiscal",
            "alertaDiasValidade",
            "alertaStockBaixo",
            "sonsScanner",
          ];
          check(
            Object.keys(patch).every((k) => allowed.includes(k)),
            "Campo de configuração não permitido.",
          );
          const next = { ...before, ...patch };
          check(/^[A-Za-z0-9_-]{1,20}$/.test(next.serie), "Série inválida.");
          check(
            [0, 5, 7, 14].includes(Number(next.ivaTaxa)),
            "Taxa não suportada.",
          );
          check(
            ["a4", "termica"].includes(next.formatoImpressaoPadrao),
            "Formato inválido.",
          );
          check(
            JSON.stringify(next).length < 500000,
            "Configuração demasiado grande.",
          );
          next.configuracaoFiscal = {
            ...before.configuracaoFiscal,
            ...patch.configuracaoFiscal,
            softwareNome: "NVUALASOFT",
            comunicacaoSaftAtiva: false,
          };
          delete next.caixaSessaoAtual;
          delete next.historicoCaixa;
          delete next.id;
          delete next.empresaId;
          await c.query(
            "INSERT INTO public.nv_billing_settings(empresa_id,data,revision) VALUES($1,$2,1) ON CONFLICT(empresa_id) DO UPDATE SET data=$2,revision=nv_billing_settings.revision+1",
            [u.empresaId, JSON.stringify(next)],
          );
          // Mantém o emitente partilhado com os restantes módulos do NVUALASOFT.
          await c.query(
            "INSERT INTO public.config(empresa_id) VALUES($1) ON CONFLICT DO NOTHING",
            [u.empresaId],
          );
          await c.query(
            "UPDATE public.config SET nome_clinica=$2,nif=$3,endereco=$4,telefone=$5,email=$6,serie=$7,iva_taxa=$8 WHERE empresa_id=$1",
            [
              u.empresaId,
              next.nomeClinica || "",
              next.nif || "",
              next.endereco || "",
              next.telefone || "",
              next.email || "",
              next.serie,
              next.ivaTaxa,
            ],
          );
          return { ok: true };
        }),
      ),
    ),
  );
  router.post(
    ["/cash/open", "/pharmacy-pos/cash/open"],
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          const b = req.body,
            amount = cents(b.fundoInicial);
          check(amount >= 0, "Fundo inválido.");
          const counted = countedDenominations(b.contagemAbertura);
          check(
            !counted || counted === amount,
            "A contagem por denominação não coincide com o fundo inicial.",
          );
          check(!(await active(c, u)), "Já tem uma caixa aberta.");
          const pharmacy = isPharmacyPos(req);
          const terminal = pharmacy
            ? "FARMACIA-" + text(b.terminal || "01", 36)
            : text(b.terminal || "POS-01", 60);
          check(
            pharmacy || !/^FARMACIA-/i.test(terminal),
            "Use o balcão da Farmácia para este terminal.",
          );
          check(terminal, "Terminal obrigatório.");
          const id = randomUUID();
          await c.query(
            "INSERT INTO public.nv_cash_sessions(id,empresa_id,terminal,actor,opening,data) VALUES($1,$2,$3,$4,$5,$6)",
            [
              id,
              u.empresaId,
              terminal,
              u.username,
              amount / 100,
              JSON.stringify({
                contagemAbertura: b.contagemAbertura || {},
                ...(pharmacy ? { posChannel: "farmacia" } : {}),
                observacoes: String(b.observacoes || "").slice(0, 1000),
              }),
            ],
          );
          return { id };
        }),
      ),
    ),
  );
  router.post(
    ["/cash/movement", "/pharmacy-pos/cash/movement"],
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          const b = req.body,
            s = await active(c, u);
          check(
            s && (s.data?.posChannel === "farmacia") === isPharmacyPos(req),
            "Abra a caixa deste balcão antes de registar movimentos.",
          );
          check(
            ["sangria", "suprimento"].includes(b.tipo),
            "Movimento inválido.",
          );
          const amount = cents(b.valor),
            reason = text(b.motivo, 1000);
          check(
            amount > 0 && reason.length >= 3,
            "Valor positivo e motivo são obrigatórios.",
          );
          const info = await cashInfo(c, s);
          check(
            b.tipo !== "sangria" || amount <= cents(info.valorEsperado),
            "Numerário insuficiente.",
          );
          await c.query(
            "INSERT INTO public.nv_cash_entries(id,empresa_id,session_id,actor,kind,amount,reason) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [
              randomUUID(),
              u.empresaId,
              s.id,
              u.username,
              b.tipo === "sangria" ? "withdrawal" : "supply",
              amount / 100,
              reason,
            ],
          );
          return { ok: true };
        }),
      ),
    ),
  );
  router.post(
    "/cash/drawer",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          check(
            text(req.body.motivo || "", 300).length >= 3,
            "Motivo obrigatório para abertura da gaveta.",
          );
          return {
            ok: true,
            actor: u.username,
            modo:
              req.body.modo === "comando" ? "comando solicitado" : "simulação",
            gavetaId: String(req.body.gavetaId || "").slice(0, 60),
          };
        }),
      ),
    ),
  );
  router.post(
    ["/cash/close", "/pharmacy-pos/cash/close"],
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          const b = req.body,
            s = await active(c, u);
          check(
            s && (s.data?.posChannel === "farmacia") === isPharmacyPos(req),
            "Não tem caixa aberta neste balcão.",
          );
          const info = await cashInfo(c, s),
            counted = cents(b.valorContado);
          check(counted >= 0, "Contagem inválida.");
          const countedNotes = countedDenominations(b.contagemFecho);
          check(
            !countedNotes || countedNotes === counted,
            "A contagem por denominação não coincide com o total declarado.",
          );
          const diff = counted - cents(info.valorEsperado);
          let approvedBy: string | null = null;
          if (diff !== 0) {
            check(
              text(b.diferencaMotivo || "", 1000).length >= 3,
              "A diferença exige motivo e aprovação por gestor autenticado.",
            );
            approvedBy = await approveDifference(c, u, b);
          }
          await c.query(
            "UPDATE public.nv_cash_sessions SET closed_at=now(),counted=$3,expected=$4,data=data||$5::jsonb WHERE empresa_id=$1 AND id=$2",
            [
              u.empresaId,
              s.id,
              counted / 100,
              info.valorEsperado,
              JSON.stringify({
                diferencaMotivo: b.diferencaMotivo || "",
                aprovadoPor: approvedBy,
                contagemFecho: b.contagemFecho || {},
              }),
            ],
          );
          return {
            ok: true,
            valorEsperado: info.valorEsperado,
            valorContado: counted / 100,
            diferenca: diff / 100,
          };
        }),
      ),
    ),
  );
  async function issue(
    c: any,
    u: any,
    input: any,
    existing?: any,
    settlement?: any,
    correction?: ReplacementProof,
    pharmacyTraining?: { prescriptionId: string },
  ) {
    const savedConfig = await config(c, u.empresaId);
    const cfg = pharmacyTraining
      ? { ...savedConfig, calculoFiscalAGT: false }
      : savedConfig;
    const stamp = localStamp();
    // This installation opens the complete training workflow, never fiscal production.
    check(
      cfg.ambiente === "homologacao" && cfg.producaoFiscalAtiva === false,
      "A produção fiscal permanece bloqueada. Utilize a formação.",
    );
    check(
      !input?.ambiente || input.ambiente === "homologacao",
      "Não é possível emitir em produção fiscal. Utilize a formação.",
    );
    check(
      !existing?.billing_meta?.proformaFinalizada,
      "A pró-forma finalizada é imutável. Crie um novo documento.",
    );
    const agtProfile = (
      await c.query(
        "SELECT data FROM public.nv_agt_profiles WHERE empresa_id=$1",
        [u.empresaId],
      )
    ).rows[0]?.data;
    const d = {
      ...input,
      ...totals(input, cfg.calculoFiscalAGT ? "agt2" : "legacy"),
    };
    check(
      ["rascunho", "emitida", "paga"].includes(d.estado),
      "Estado inválido.",
    );
    const official = d.estado !== "rascunho" && d.tipoDocumento !== "pro-forma";
    if (correction)
      check(
        cfg.calculoFiscalAGT &&
          d.tipoDocumento === "factura" &&
          d.estado === "emitida",
        "Active a série oficial de FT de homologação antes de criar a substituta.",
      );
    check(
      d.clienteNome && text(d.clienteNome, 300),
      "Identifique o adquirente.",
    );
    check(
      !d.clienteNif || /^[A-Za-z0-9]{8,15}$/.test(d.clienteNif),
      "Formato do NIF do adquirente inválido.",
    );
    if (d.pacienteId)
      check(
        (
          await c.query(
            "SELECT 1 FROM public.pacientes WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, Number(d.pacienteId)],
          )
        ).rowCount,
        "Paciente de outra instituição ou inexistente.",
      );
    // A test invoice does not require inventing a taxpayer ID or legal exemption.
    // Its snapshot keeps the configured values; missing data is explicit in print.
    check(
      d.tipoDocumento !== "factura-global" ||
        String(d.observacoes || "").includes("SUPORTES:"),
      "A factura global exige a referência aos documentos de suporte (SUPORTES: ...).",
    );
    if (official)
      check(
        !d.data || d.data === stamp.data || d.data === stamp.iso,
        "A data de emissão é a data actual do servidor (Luanda).",
      );
    if (d.insurance) {
      const selection = d.insurance;
      check(
        typeof selection === "object" && !Array.isArray(selection),
        "Selecção de seguro inválida.",
      );
      check(
        Array.isArray(selection.acts) && selection.acts.length <= 500,
        "Actos do seguro inválidos.",
      );
      for (const k of [
        "beneficiaryId",
        "contractId",
        "serviceDate",
        "authorization",
      ])
        check(
          selection[k] === undefined ||
            (typeof selection[k] === "string" && selection[k].length <= 200),
          "Selecção de seguro inválida.",
        );
      check(
        selection.acts.every(
          (a: any) =>
            a &&
            typeof a === "object" &&
            ["code", "professional"].every(
              (k) =>
                a[k] === undefined ||
                (typeof a[k] === "string" && a[k].length <= 300),
            ),
        ),
        "Actos do seguro inválidos.",
      );
      d.insurance = Object.fromEntries(
        [
          "beneficiaryId",
          "contractId",
          "serviceDate",
          "authorization",
          "acts",
        ].map((k) => [k, selection[k]]),
      );
    }
    let opcoesDocumento: any = null;
    if (d.opcoesDocumento) {
      check(
        typeof d.opcoesDocumento === "object" &&
          !Array.isArray(d.opcoesDocumento),
        "Definições do documento inválidas.",
      );
      opcoesDocumento = {};
      for (const k of [
        "observacoesLivres",
        "referenciaExterna",
        "localCarga",
        "moradaCarga",
        "dataHoraCarga",
        "localDescarga",
        "moradaDescarga",
        "dataHoraDescarga",
        "matriculaVeiculo",
      ]) {
        check(
          typeof d.opcoesDocumento[k] === "string" &&
            d.opcoesDocumento[k].length <=
              (k === "observacoesLivres" ? 8000 : 300),
          "Definições do documento inválidas.",
        );
        opcoesDocumento[k] = d.opcoesDocumento[k];
      }
      for (const k of ["transporte", "incluirPrecosTransporte"]) {
        check(
          typeof d.opcoesDocumento[k] === "boolean",
          "Definições do documento inválidas.",
        );
        opcoesDocumento[k] = d.opcoesDocumento[k];
      }
    }
    let insuranceSnapshot: any = null;
    if (
      d.insurance &&
      ["factura", "factura-global"].includes(d.tipoDocumento)
    ) {
      check(
        d.tipoDocumento === "factura" && (!official || d.estado === "emitida"),
        "Emita a cobertura como Factura / Emitida e receba cada parcela em Seguradoras → Cobrança.",
      );
      insuranceSnapshot = official
        ? await insuranceQuote(
            c,
            u.empresaId,
            { ...d, data: stamp.iso },
            {
              integrated: true,
              rounding: cfg.calculoFiscalAGT ? "agt2" : "legacy",
            },
          )
        : null;
      if (insuranceSnapshot) d.dataVencimento = insuranceSnapshot.dueDate;
    }
    const paid = official && d.estado === "paga";
    check(
      !official ||
        !["factura-recibo", "recibo"].includes(d.tipoDocumento) ||
        paid,
      "Factura-recibo e recibo exigem pagamento confirmado.",
    );
    const session = paid ? await active(c, u) : null;
    check(
      !paid ||
        (session &&
          (session.data?.posChannel === "farmacia") === !!pharmacyTraining),
      "Abra a caixa deste balcão antes de receber pagamentos.",
    );
    let payments: any[] = [];
    if (paid) {
      payments =
        Array.isArray(d.formasPagamentoDetalhe) &&
        d.formasPagamentoDetalhe.length
          ? d.formasPagamentoDetalhe
          : [
              {
                forma: d.formaPagamento,
                valor: d.total,
                referencia: d.referenciaPagamento,
              },
            ];
      check(payments.length <= 5, "Demasiadas formas de pagamento.");
      let sum = 0;
      payments = payments.map((p: any) => {
        const value = cents(p.valor);
        check(value > 0, "Pagamento inválido.");
        const forma = text(p.forma, 80);
        check(
          [
            "Numerário",
            "Multicaixa (TPA)",
            "Multicaixa Express",
            "Transferência Bancária",
            "Transferência",
            "Cartão",
            "Cheque",
          ].includes(forma),
          "Forma de pagamento não suportada.",
        );
        if (forma !== "Numerário")
          check(
            text(p.referencia || "", 100).length >= 3,
            "Introduza a referência do pagamento confirmado no terminal ou banco.",
          );
        sum += value;
        return {
          id: randomUUID(),
          forma,
          valor: value / 100,
          referencia: p.referencia || "",
        };
      });
      check(
        sum === cents(d.total),
        "A soma dos pagamentos deve coincidir com o total.",
      );
    }
    let origin: any;
    if (official && ["nota-credito", "recibo"].includes(d.tipoDocumento)) {
      origin = (
        await c.query(
          "SELECT * FROM public.faturas WHERE empresa_id=$1 AND numero=$2 FOR UPDATE",
          [u.empresaId, d.documentoOrigem || ""],
        )
      ).rows[0];
      check(
        origin &&
          ["factura", "factura-recibo", "factura-global"].includes(
            origin.tipo_documento,
          ) &&
          origin.estado !== "rascunho" &&
          origin.estado !== "anulada",
        "Documento de origem inválido ou de outra instituição.",
      );
      check(
        !(await findReplacement(c, u.empresaId, origin.id)),
        "A factura de origem foi substituída. Utilize o novo documento.",
      );
      if (origin.billing_meta?.agtCorrection) {
        const jobs = (
          await c.query(
            "SELECT id,operation,invoice_ids,status,agt_request_id,response,payload FROM public.nv_agt_jobs WHERE empresa_id=$1 AND operation='registarFactura' AND status<>'cancelado' AND invoice_ids @> $2::jsonb ORDER BY created_at DESC,id DESC LIMIT 1",
            [u.empresaId, JSON.stringify([origin.id])],
          )
        ).rows;
        check(
          agtStatus(origin, jobs).agtStatus === "validado",
          "A factura substituta deve estar validada em homologação antes de receber ou corrigir valores.",
        );
      }
      check(
        !origin.billing_meta?.pharmacyPosTraining,
        "Este documento de ensaio pertence ao balcão da Farmácia.",
      );
      check(
        origin.billing_meta?.ambiente === "homologacao",
        "O arquivo fiscal anterior é só de consulta neste modo. A regularização real depende da activação fiscal.",
      );
      check(
        d.clienteNome === origin.cliente_nome &&
          (d.clienteNif || "") === (origin.cliente_nif || ""),
        "O adquirente deve coincidir com o documento de origem.",
      );
      check(
        Number(d.pacienteId || 0) === Number(origin.paciente_id || 0),
        "O paciente deve coincidir com o documento de origem.",
      );
      const prior = (
        await c.query(
          "SELECT * FROM public.faturas WHERE empresa_id=$1 AND billing_meta->>'documentoOrigem'=$2 AND estado<>'rascunho'",
          [u.empresaId, origin.numero],
        )
      ).rows;
      if (d.tipoDocumento === "recibo" && !settlement) {
        check(
          !(await insuredInvoice(c, u.empresaId, origin.id)),
          "Registe o recebimento por pagador em Seguradoras → Cobrança.",
        );
        const account = (
          await c.query(
            "SELECT count(*) AS n FROM public.nv_receivable_entries WHERE empresa_id=$1 AND invoice_id=$2 AND kind<>'invoice'",
            [u.empresaId, origin.id],
          )
        ).rows[0];
        check(
          Number(account.n) === 0,
          "Esta conta tem recebimentos ou créditos. Utilize o recebimento do saldo em Seguradoras → Extractos.",
        );
        check(
          origin.estado !== "paga" &&
            !prior.some((r: any) => r.tipo_documento === "recibo"),
          "Factura já paga.",
        );
        check(
          !prior.some((r: any) => r.tipo_documento === "nota-credito"),
          "Factura com créditos: regularize a conta antes do recebimento.",
        );
        check(
          cents(d.total) === cents(origin.total),
          "O recibo deve corresponder ao saldo integral da factura.",
        );
        check(
          digest(d.linhas) ===
            digest(
              totals({
                ...invoice(origin),
                desconto: origin.billing_meta?.desconto || 0,
              }).linhas,
            ),
          "As linhas do recibo devem coincidir com a factura.",
        );
      } else if (d.tipoDocumento === "nota-credito") {
        check(
          text(d.motivoAnulacaoOuCredito || "", 1000).length >= 3,
          "Indique o motivo da nota de crédito.",
        );
        check(
          text(d.provaConhecimento || "", 1000).length >= 5,
          "Registe a prova de conhecimento do adquirente (referência ao email, carta ou assinatura arquivada).",
        );
        check(
          !origin.billing_meta?.descontoValor,
          "Crédito de documento com desconto em valor exige regularização fiscal específica antes da activação.",
        );
        check(
          Number(d.ivaTaxa) === Number(origin.iva_taxa) &&
            Number(d.desconto || 0) ===
              Number(origin.billing_meta?.desconto || 0),
          "IVA e desconto devem coincidir com a origem.",
        );
        const amount = prior
          .filter((r: any) => r.tipo_documento === "nota-credito")
          .reduce((s: number, r: any) => s + Math.abs(cents(r.total)), 0);
        check(
          amount + Math.abs(cents(d.total)) <= Math.abs(cents(origin.total)),
          "Crédito superior ao valor da factura.",
        );
        const key = (l: any) =>
          String(l.produtoId || l.descricao) +
          "|" +
          l.precoUnitario +
          "|" +
          l.ivaIsento;
        const available = new Map<string, number>();
        const claim = await insuredInvoice(c, u.empresaId, origin.id);
        for (const l of origin.linhas)
          available.set(
            key(l),
            (available.get(key(l)) || 0) + Math.abs(Number(l.quantidade)),
          );
        for (const r of prior.filter(
          (r: any) => r.tipo_documento === "nota-credito",
        ))
          for (const l of r.linhas)
            available.set(
              key(l),
              (available.get(key(l)) || 0) - Math.abs(l.quantidade),
            );
        for (const l of d.linhas) {
          if (claim) {
            const originalLine = origin.linhas[l.originActIndex];
            check(
              Number.isInteger(l.originActIndex) &&
                originalLine &&
                key(l) === key(originalLine),
              "O índice do acto deve identificar a linha e o enquadramento de IVA da factura original.",
            );
          }
          const remain = (available.get(key(l)) || 0) - Math.abs(l.quantidade);
          check(
            remain >= -0.000001,
            "Linha ou quantidade de crédito não corresponde à origem.",
          );
          available.set(key(l), remain);
        }
      }
    }
    for (const l of d.linhas)
      if (l.produtoId) {
        const p = (
          await c.query(
            "SELECT id,ativo FROM public.produtos WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, l.produtoId],
          )
        ).rows[0];
        check(
          p && p.ativo,
          "Artigo inactivo, inexistente ou de outra instituição.",
        );
      }
    let numero = existing?.numero || `RASCUNHO-${randomUUID().slice(0, 8)}`,
      previous = "",
      actualSeries = cfg.serie;
    const keepProformaNumber =
      d.tipoDocumento === "pro-forma" &&
      existing?.tipo_documento === "pro-forma" &&
      String(existing?.numero || "").startsWith("PF TEST");
    if (keepProformaNumber) actualSeries = existing.serie;
    if (official || (d.tipoDocumento === "pro-forma" && !keepProformaNumber)) {
      // A série remota pertence exclusivamente ao ambiente de homologação.
      let serie =
        "TEST" + stamp.year + (pharmacyTraining ? "FARMACIA" : cfg.serie);
      if (official && cfg.calculoFiscalAGT) {
        const type = docTypes[d.tipoDocumento];
        const sequence = (
          await c.query(
            "SELECT * FROM public.nv_agt_series WHERE empresa_id=$1 AND tipo=$2 AND code=$3 AND year=$4 FOR UPDATE",
            [u.empresaId, type, agtProfile?.series?.[type] || "", stamp.year],
          )
        ).rows[0];
        check(
          sequence &&
            sequence.evidence?.issuerNif === cfg.nif &&
            Number(sequence.next_no) <= Number(sequence.last_no),
          "Seleccione uma série AGT confirmada e com numeração disponível para este tipo/ano.",
        );
        check(
          cfg.nif && cfg.nif !== "999999999" && cfg.nomeClinica,
          "Complete os dados verdadeiros do emitente.",
        );
        if (d.tipoDocumento !== "recibo")
          for (const line of d.linhas) {
            const rule = agtProfile?.taxRules?.[line.codigo];
            check(
              rule &&
                (line.ivaIsento
                  ? rule.taxCode === "ISE" &&
                    rule.exemptionCode &&
                    rule.exemptionReason
                  : rule.taxCode !== "ISE" && d.ivaTaxa > 0),
              "Configure o enquadramento fiscal de todos os artigos antes de emitir em homologação oficial.",
            );
            const expectedRate = (
              { NOR: 14, INT: 7, RED: 5 } as Record<string, number>
            )[rule.taxCode];
            check(
              expectedRate === undefined || expectedRate === Number(d.ivaTaxa),
              "A taxa de IVA não coincide com o código normal/intermédio/reduzido do artigo.",
            );
            check(
              line.codigo.length <= 60 &&
                line.descricao.length <= 200 &&
                line.unidade.length <= 20,
              "Código, descrição ou unidade excede os limites FE 2.0.",
            );
          }
        if (d.tipoDocumento === "factura-global") isoDate(d.dataOperacao);
        serie = sequence.code;
        numero = type + " " + serie + "/" + sequence.next_no;
        await c.query(
          "UPDATE public.nv_agt_series SET next_no=next_no+1 WHERE empresa_id=$1 AND tipo=$2 AND code=$3",
          [u.empresaId, type, serie],
        );
      }
      actualSeries = serie;
      const seq = !(official && cfg.calculoFiscalAGT)
        ? (
            await c.query(
              "INSERT INTO public.nv_billing_sequences(empresa_id,serie,tipo,ano,ultimo,last_issued_at) VALUES($1,$2,$3,$4,1,now()) ON CONFLICT(empresa_id,serie,tipo,ano) DO UPDATE SET ultimo=nv_billing_sequences.ultimo+1,last_issued_at=now() RETURNING ultimo",
              [u.empresaId, serie, d.tipoDocumento, stamp.year],
            )
          ).rows[0]
        : null;
      if (seq) numero = `${codes[d.tipoDocumento]} ${serie}/${seq.ultimo}`;
      previous =
        (
          await c.query(
            "SELECT codigo_hash FROM public.faturas WHERE empresa_id=$1 AND billing_meta->>'managed'='nvuala-v1' AND tipo_documento=$2 AND serie=$3 AND estado<>'rascunho' ORDER BY id DESC LIMIT 1",
            [u.empresaId, d.tipoDocumento, serie],
          )
        ).rows[0]?.codigo_hash || "";
    }
    const meta: any = {
      calculoFiscalAGT: cfg.calculoFiscalAGT === true,
      ...(correction ? { agtCorrection: correction } : {}),
      ...(pharmacyTraining ? { pharmacyPosTraining: true } : {}),
      agtMode:
        official && cfg.calculoFiscalAGT
          ? "homologacao_oficial"
          : "formacao_local",
      agtProfile: cfg.calculoFiscalAGT
        ? {
            ...agtProfile,
            taxRules: Object.fromEntries(
              d.linhas
                .filter((l: any) => agtProfile?.taxRules?.[l.codigo])
                .map((l: any) => [l.codigo, agtProfile.taxRules[l.codigo]]),
            ),
          }
        : null,
      proformaFinalizada:
        d.tipoDocumento === "pro-forma" && d.finalizarProforma === true,
      dataOperacao: String(d.dataOperacao || "").slice(0, 40),
      localOperacao: String(d.localOperacao || "").slice(0, 300),
      managed: "nvuala-v1",
      ambiente: "homologacao",
      dataDisponibilizacao: String(d.dataDisponibilizacao || "").slice(0, 40),
      opcoesDocumento,
      desconto: d.desconto,
      descontoValor: d.descontoValor || 0,
      documentoOrigem: d.documentoOrigem || "",
      motivoAnulacaoOuCredito: d.motivoAnulacaoOuCredito || "",
      provaConhecimento: d.provaConhecimento || "",
      formasPagamentoDetalhe: payments,
      hashAnterior: previous,
      caixaSessaoId: session?.id,
      terminalCaixa: session?.terminal,
      motivoIsencao: cfg.configuracaoFiscal.motivoIsencaoPadrao,
      createdAt: new Date().toISOString(),
      clienteTelefone: String(d.clienteTelefone || "").slice(0, 60),
      clienteEmail: String(d.clienteEmail || "").slice(0, 160),
      insurance: d.insurance || null,
      settlement: settlement || null,
      insuranceAmounts: insuranceSnapshot
        ? {
            total: insuranceSnapshot.total,
            insurer: insuranceSnapshot.insurerAmount,
            patient: insuranceSnapshot.patientAmount,
          }
        : null,
    };
    if (d.tipoDocumento === "recibo" && origin) {
      const gross = cents(d.total),
        originGross = cents(origin.total),
        originTax = cents(origin.total_iva);
      const tax = Number(
        (BigInt(gross) * BigInt(originTax) + BigInt(originGross) / 2n) /
          BigInt(originGross),
      );
      meta.fiscalReceipt = {
        grossTotal: gross / 100,
        taxPayable: tax / 100,
        netTotal: (gross - tax) / 100,
        originNo: origin.numero,
        allocation: "proporcional-centimos",
      };
    }
    if (
      ((official && cfg.calculoFiscalAGT) || meta.proformaFinalizada) &&
      agtOptions().signLocalHml === true &&
      d.tipoDocumento !== "recibo"
    ) {
      const producer = loadProducer();
      check(
        producer.legacyPrivateKeyFile,
        "Configure a chave SAF-T própria do produtor.",
      );
      const key = readKey(producer.legacyPrivateKeyFile),
        entryDate = stamp.iso + "T" + stamp.hora;
      const prior =
        (
          await c.query(
            "SELECT billing_meta->'fiscalSaft'->>'hash' AS hash FROM public.faturas WHERE empresa_id=$1 AND tipo_documento=$2 AND serie=$3 AND billing_meta->'fiscalSaft' IS NOT NULL ORDER BY id DESC LIMIT 1",
            [u.empresaId, d.tipoDocumento, actualSeries],
          )
        ).rows[0]?.hash || "";
      const signed = legacySignature(
        {
          date: stamp.iso,
          entryDate,
          number: numero,
          gross: d.total,
          previous: prior,
        },
        key,
      );
      meta.softwareHml = {
        productId: producer.productId,
        productVersion: producer.productVersion,
        softwareValidationNumber: producer.softwareValidationNumber,
        signatureVersion: producer.signatureVersion,
      };
      meta.fiscalSaft = {
        hash: signed.hash,
        keyVersion: producer.signatureVersion,
        previousHash: prior,
        entryDate,
        fingerprint: fingerprint(key),
        scheme: "RSA1024-SHA1-SAF-T-AO-1.01_01",
      };
    }
    const hash = official
      ? digest({
          numero,
          data: stamp.data,
          linhas: d.linhas,
          total: d.total,
          previous,
        })
      : "";
    check(
      !official || d.total !== 0,
      "Documento emitido deve ter total diferente de zero.",
    );
    const values = [
      u.empresaId,
      numero,
      keepProformaNumber
        ? existing.serie
        : official || d.tipoDocumento === "pro-forma"
          ? actualSeries
          : cfg.serie,
      stamp.data,
      stamp.hora,
      d.dataVencimento || stamp.data,
      d.clienteNome,
      d.clienteNif || "",
      d.clienteEndereco || "",
      JSON.stringify(d.linhas),
      d.subtotalSemIva,
      d.totalIva,
      d.ivaTaxa,
      d.total,
      d.tipoDocumento === "pro-forma" ? "rascunho" : d.estado,
      String(d.observacoes || "").slice(0, 10000),
      d.pacienteId || null,
      u.username,
      hash,
      d.tipoDocumento,
      d.formaPagamento || "",
      JSON.stringify(
        cfg.calculoFiscalAGT
          ? {
              ...cfg,
              endereco: [
                agtProfile.address,
                agtProfile.city,
                agtProfile.postalCode,
              ]
                .filter(Boolean)
                .join(", "),
            }
          : cfg,
      ),
      JSON.stringify(meta),
    ];
    let row: any;
    const columns =
      "empresa_id,numero,serie,data,hora_operacao,data_vencimento,cliente_nome,cliente_nif,cliente_endereco,linhas,subtotal_sem_iva,total_iva,iva_taxa,total,estado,observacoes,paciente_id,emitido_por,codigo_hash,tipo_documento,forma_pagamento,emitente_snapshot,billing_meta";
    if (existing) {
      check(existing.estado === "rascunho", "Documento emitido é imutável.");
      const names = columns.split(",");
      row = (
        await c.query(
          `UPDATE public.faturas SET ${names.map((k, i) => `${k}=$${i + 1}`).join(",")} WHERE id=$24 AND empresa_id=$1 RETURNING *`,
          [...values, existing.id],
        )
      ).rows[0];
    } else
      row = (
        await c.query(
          `INSERT INTO public.faturas(${columns}) VALUES(${values.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
          values,
        )
      ).rows[0];
    // Stock real debitado apenas em documentos fiscais; o modo homologação não altera existências reais.
    // As vendas de ensaio não entram na conta corrente/tesouraria contabilística real.
    if (paid) {
      for (const p of payments.filter((p: any) => p.forma === "Numerário"))
        await c.query(
          "INSERT INTO public.nv_cash_entries(id,empresa_id,session_id,actor,kind,amount,reason,invoice_id) VALUES($1,$2,$3,$4,'sale',$5,$6,$7)",
          [
            randomUUID(),
            u.empresaId,
            session.id,
            u.username,
            p.valor,
            "Ensaio: " + numero,
            row.id,
          ],
        );
    }
    if (official)
      await recordIntegratedAccount(c, u, row, insuranceSnapshot, origin);
    if (official && !cfg.calculoFiscalAGT && !pharmacyTraining)
      await c.query(
        "INSERT INTO public.nv_billing_agt_queue(empresa_id,invoice_id,payload) VALUES($1,$2,$3)",
        [
          u.empresaId,
          row.id,
          JSON.stringify({
            schemaVersion: "2.0",
            preparacao: true,
            naoSubmeter: true,
            document: invoice(row),
          }),
        ],
      );
    return { fatura: invoice(row) };
  }
  router.get(
    "/pharmacy-pos",
    wrap(async (req: any, res: any) => {
      await assertBillingReady(db, true);
      const u = getUser(req);
      const session = (
        await db.query(
          "SELECT * FROM public.nv_cash_sessions WHERE empresa_id=$1 AND actor=$2 AND closed_at IS NULL",
          [u.empresaId, u.username],
        )
      ).rows[0];
      const cfg = await config(db, u.empresaId!);
      const result = await pharmacyPosState(db, u);
      res.json({
        ...result,
        environment: "formacao_local",
        ivaTaxa: cfg.ivaTaxa,
        session:
          session?.data?.posChannel === "farmacia"
            ? await cashInfo(db, session)
            : null,
        otherCashOpen: !!session && session.data?.posChannel !== "farmacia",
      });
    }),
  );
  router.post(
    "/pharmacy-pos/stock",
    wrap(async (req: any, res: any) => {
      res.json(
        await tx(req, (c: any, u: any) =>
          initializeTrainingLot(c, u, req.body),
        ),
      );
    }),
  );
  router.post(
    "/pharmacy-pos/quote",
    wrap(async (req: any, res: any) => {
      const u = getUser(req);
      const cfg = await config(db, u.empresaId!);
      const q = await pharmacyQuote(db, u, req.body, cfg.ivaTaxa);
      res.json({
        subtotal: q.quote.subtotalSemIva,
        iva: q.quote.totalIva,
        total: q.quote.total,
        ivaTaxa: cfg.ivaTaxa,
      });
    }),
  );
  router.post(
    "/pharmacy-pos/sales",
    wrap(async (req: any, res: any) => {
      res.json(
        await tx(req, async (c: any, u: any) => {
          const b = req.body;
          check(
            b.confirmTraining === true &&
              b.confirmItem === true &&
              !b.production,
            "Confirme a conferência dos medicamentos e a venda de formação.",
          );
          const session = await active(c, u);
          check(
            session?.data?.posChannel === "farmacia",
            "Abra a caixa de ensaio da Farmácia.",
          );
          const cfg = await config(c, u.empresaId);
          const q = await pharmacyQuote(c, u, b, cfg.ivaTaxa, true);
          const total = cents(q.quote.total);
          check(
            total === cents(b.expectedTotal),
            "O valor mudou. Reveja a venda antes de confirmar.",
          );
          const method = b.paymentMethod;
          check(
            [
              "Numerário",
              "Multicaixa (TPA)",
              "Transferência Bancária",
            ].includes(method),
            "Seleccione uma forma de pagamento de ensaio.",
          );
          const reference = text(b.reference || "", 100);
          let change = 0;
          if (method === "Numerário") {
            const tendered = cents(b.received);
            check(
              tendered >= total,
              "O numerário de ensaio não cobre a venda.",
            );
            change = tendered - total;
            const cash = await cashInfo(c, session);
            check(
              change <= cents(cash.valorEsperado),
              "O fundo de caixa de ensaio não cobre o troco.",
            );
          } else
            check(
              reference.length >= 3,
              "Indique a referência de ensaio do TPA ou banco.",
            );
          const { fatura } = await issue(
            c,
            u,
            {
              ...q.document,
              formaPagamento: method,
              formasPagamentoDetalhe: [
                { forma: method, valor: total / 100, referencia: reference },
              ],
            },
            undefined,
            undefined,
            undefined,
            { prescriptionId: q.prescriptionId },
          );
          await recordTrainingSale(c, u, fatura.id, q);
          return {
            id: fatura.id,
            numero: fatura.numero,
            total: fatura.total,
            troco: change / 100,
            environment: "formacao_local",
          };
        }),
      );
    }),
  );
  router.post(
    "/agt/corrections",
    wrap(async (req: any, res: any) => {
      admin(req);
      res.json(
        await tx(req, async (c: any, u: any) => {
          const b = req.body;
          check(
            b.confirmHomologacao === true &&
              Number.isSafeInteger(b.invoiceId) &&
              b.invoiceId > 0,
            "Confirme a criação da factura substituta em homologação.",
          );
          const reason = text(b.reason, 300);
          check(
            reason.length >= 8,
            "Explique a correcção (8 a 300 caracteres).",
          );
          const nome = text(b.customerName, 200),
            nif = text(b.customerNif, 15),
            address = text(b.customerAddress, 300);
          check(
            nome && (!nif || /^[A-Za-z0-9]{8,15}$/.test(nif)),
            "Identificação do adquirente inválida.",
          );
          const original = (
            await c.query(
              "SELECT * FROM public.faturas WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
              [u.empresaId, b.invoiceId],
            )
          ).rows[0];
          await preflightReplacement(c, u.empresaId, original);
          const cfg = await config(c, u.empresaId);
          check(
            cfg.nif === original.emitente_snapshot?.nif,
            "O NIF actual do emitente difere da factura rejeitada.",
          );
          const jobs = (
            await c.query(
              "SELECT * FROM public.nv_agt_jobs WHERE empresa_id=$1 AND operation='registarFactura' AND status IN ('rejeitado','parcial') AND invoice_ids @> $2::jsonb ORDER BY created_at DESC,id DESC",
              [u.empresaId, JSON.stringify([original.id])],
            )
          ).rows;
          const proof = rejectionEvidence(original, jobs);
          check(
            proof,
            "A AGT não confirmou a rejeição desta factura. Consulte primeiro o estado do pedido.",
          );
          const correction: ReplacementProof = {
            invoiceId: original.id,
            documentNo: original.numero,
            jobId: proof.jobId,
            requestID: proof.requestID,
            reason,
          };
          const { fatura } = await issue(
            c,
            u,
            {
              tipoDocumento: "factura",
              estado: "emitida",
              clienteNome: nome,
              clienteNif: nif,
              clienteEndereco: address,
              clienteTelefone: original.billing_meta.clienteTelefone,
              clienteEmail: original.billing_meta.clienteEmail,
              pacienteId: original.paciente_id,
              linhas: original.linhas,
              ivaTaxa: Number(original.iva_taxa),
              desconto: original.billing_meta.desconto,
              descontoValor: original.billing_meta.descontoValor,
              dataVencimento: original.data_vencimento,
              dataOperacao: original.billing_meta.dataOperacao,
              localOperacao: original.billing_meta.localOperacao,
              observacoes: original.observacoes,
              opcoesDocumento: original.billing_meta.opcoesDocumento,
            },
            undefined,
            undefined,
            correction,
          );
          check(
            cents(fatura.total) === cents(original.total) &&
              cents(fatura.subtotalSemIva) ===
                cents(original.subtotal_sem_iva) &&
              cents(fatura.totalIva) === cents(original.total_iva) &&
              digest(fatura.linhas) === digest(original.linhas),
            "Os valores ou as linhas mudaram. A substituição não foi emitida.",
          );
          await c.query(
            "INSERT INTO public.nv_agt_replacements(empresa_id,original_id,replacement_id,rejection_job_id,reason,actor) VALUES($1,$2,$3,$4,$5,$6)",
            [
              u.empresaId,
              original.id,
              fatura.id,
              proof.jobId,
              reason,
              u.username,
            ],
          );
          // Neutral reclassification of the original open balance. Not a payment or a fiscal credit note.
          if (original.paciente_id)
            await c.query(
              "INSERT INTO public.nv_receivable_entries(empresa_id,invoice_id,party_type,party_id,occurred_on,kind,credit,reference,details,actor) VALUES($1,$2,'patient',$3,$4,'credit',$5,$6,$7,$8)",
              [
                u.empresaId,
                original.id,
                String(original.paciente_id),
                localStamp().iso,
                fatura.total,
                fatura.numero,
                JSON.stringify({
                  adjustment: "agt_replacement",
                  replacementId: fatura.id,
                  environment: "homologacao",
                }),
                u.username,
              ],
            );
          await c.query(
            "INSERT INTO public.nv_agt_events(empresa_id,job_id,actor,action,data) VALUES($1,$2,$3,'document.replace',$4)",
            [
              u.empresaId,
              proof.jobId,
              u.username,
              JSON.stringify({
                originalId: original.id,
                originalNo: original.numero,
                replacementId: fatura.id,
                replacementNo: fatura.numero,
                reason,
                errorCodes: proof.codes,
              }),
            ],
          );
          return {
            fatura,
            originalNo: original.numero,
            environment: "homologacao",
          };
        }),
      );
    }),
  );
  router.post(
    "/insurance/payments",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          const { document, settlement } = await settlementDocument(
            c,
            u,
            req.body,
            localStamp(),
          );
          const result = await issue(c, u, document, undefined, settlement);
          return {
            ...result,
            receiptId: result.fatura.id,
            receiptNumber: result.fatura.numero,
            environment: "homologacao",
          };
        }),
      ),
    ),
  );
  router.post(
    "/documents",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, (c: any, u: any) => issue(c, u, req.body.document)),
      ),
    ),
  );
  router.post(
    "/documents/:id",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          const current = (
            await c.query(
              "SELECT * FROM public.faturas WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
              [u.empresaId, Number(req.params.id)],
            )
          ).rows[0];
          check(current, "Documento inexistente.");
          // Recebimento de factura emitida gera recibo autónomo e preserva a factura.
          if (
            current.estado !== "rascunho" &&
            req.body.document?.estado === "paga"
          ) {
            const f = invoice(current);
            check(current.estado !== "paga", "Factura já paga.");
            check(
              !(await findReplacement(c, u.empresaId, current.id)),
              "A factura foi substituída. Utilize o novo documento.",
            );
            return issue(c, u, {
              ...f,
              ...req.body.document,
              tipoDocumento: "recibo",
              documentoOrigem: current.numero,
              data: localStamp().data,
            });
          }
          return issue(
            c,
            u,
            { ...invoice(current), ...req.body.document },
            current,
          );
        }),
      ),
    ),
  );
  router.delete(
    "/documents/:id",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          const q = await c.query(
            "DELETE FROM public.faturas WHERE empresa_id=$1 AND id=$2 AND estado='rascunho' AND COALESCE(billing_meta->>'proformaFinalizada','false')<>'true' RETURNING id",
            [u.empresaId, Number(req.params.id)],
          );
          check(q.rowCount, "Só pode eliminar rascunhos.");
          return { ok: true };
        }),
      ),
    ),
  );
  router.post(
    ["/documents/:id/print", "/pharmacy-pos/sales/:id/print"],
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          const row = (
            await c.query(
              "SELECT * FROM public.faturas WHERE empresa_id=$1 AND id=$2 FOR UPDATE",
              [u.empresaId, Number(req.params.id)],
            )
          ).rows[0];
          check(row, "Documento inexistente.");
          if (isPharmacyPos(req)) {
            const owner = (
              await c.query(
                "SELECT actor FROM public.nv_pharmacy_pos_sales WHERE empresa_id=$1 AND invoice_id=$2",
                [u.empresaId, row.id],
              )
            ).rows[0];
            check(
              owner && owner.actor === u.username,
              "Venda indisponível neste balcão.",
            );
          }
          const format = req.body.format || "a4";
          check(["a4", "58mm", "80mm"].includes(format), "Formato inválido.");
          const count =
            Number(
              (
                await c.query(
                  "SELECT count(*) AS n FROM public.nv_billing_prints WHERE empresa_id=$1 AND invoice_id=$2",
                  [u.empresaId, row.id],
                )
              ).rows[0].n,
            ) + 1;
          await c.query(
            "INSERT INTO public.nv_billing_prints(id,empresa_id,invoice_id,actor,format,copy_no) VALUES($1,$2,$3,$4,$5,$6)",
            [randomUUID(), u.empresaId, row.id, u.username, format, count],
          );
          const jobs = (
            await c.query(
              "SELECT id,operation,invoice_ids,status,agt_request_id,response,payload FROM public.nv_agt_jobs WHERE empresa_id=$1 AND operation='registarFactura' AND status<>'cancelado' AND invoice_ids @> $2::jsonb ORDER BY created_at DESC,id DESC LIMIT 1",
              [u.empresaId, JSON.stringify([row.id])],
            )
          ).rows;
          return {
            fatura: {
              ...invoice(row),
              ...agtStatus(
                {
                  ...row,
                  agt_replacement_no: await findReplacement(
                    c,
                    u.empresaId,
                    row.id,
                  ),
                },
                jobs,
              ),
            },
            config: row.emitente_snapshot || (await config(c, u.empresaId)),
            copyNo: count,
            format,
            notice:
              count === 1 && row.billing_meta?.managed === "nvuala-v1"
                ? "ORIGINAL"
                : "2.ª via, em conformidade com a original",
          };
        }),
      ),
    ),
  );
  router.post(
    "/categories",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          admin(req);
          const nome = text(req.body.nome, 100),
            anterior = req.body.anterior ? text(req.body.anterior, 100) : "";
          check(nome, "Indique o nome da categoria.");
          const cfg = await catalogueSettings(c, u.empresaId),
            products = (
              await c.query(
                "SELECT categoria FROM public.produtos WHERE empresa_id=$1",
                [u.empresaId],
              )
            ).rows,
            categories = categoryNames(cfg, products);
          check(
            !categories.some(
              (x) =>
                x.toLocaleLowerCase() === nome.toLocaleLowerCase() &&
                x !== anterior,
            ),
            "Já existe uma categoria com este nome.",
          );
          if (anterior) {
            check(
              categories.includes(anterior),
              "Categoria inexistente nesta empresa.",
            );
            await c.query(
              "UPDATE public.produtos SET categoria=$2 WHERE empresa_id=$1 AND categoria=$3",
              [u.empresaId, nome, anterior],
            );
          }
          const kits = (cfg.kits || []).map((k: any) =>
            anterior && k.categoria === anterior
              ? { ...k, categoria: nome, revision: (k.revision || 0) + 1 }
              : k,
          );
          await saveCatalogue(c, u.empresaId, {
            categoriasCatalogo: [
              ...categories.filter((x) => x !== anterior),
              nome,
            ],
            kits,
          });
          return { nome };
        }),
      ),
    ),
  );
  router.delete(
    "/categories",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          admin(req);
          const nome = text(req.body.nome, 100);
          const cfg = await catalogueSettings(c, u.empresaId);
          const used = (
            await c.query(
              "SELECT 1 FROM public.produtos WHERE empresa_id=$1 AND categoria=$2 LIMIT 1",
              [u.empresaId, nome],
            )
          ).rowCount;
          check(
            !used && !(cfg.kits || []).some((k: any) => k.categoria === nome),
            "Esta categoria está em uso. Mude primeiro a categoria dos produtos e kits.",
          );
          check(
            (cfg.categoriasCatalogo || []).includes(nome),
            "Categoria inexistente.",
          );
          await saveCatalogue(c, u.empresaId, {
            categoriasCatalogo: cfg.categoriasCatalogo.filter(
              (x: string) => x !== nome,
            ),
          });
          return { ok: true };
        }),
      ),
    ),
  );
  router.post(
    "/kits",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          admin(req);
          const input = req.body.kit,
            cfg = await catalogueSettings(c, u.empresaId),
            kits = cfg.kits || [],
            prior = input?.id ? kits.find((k: any) => k.id === input.id) : null;
          if (input?.id) {
            check(prior, "Kit inexistente nesta empresa.");
            check(
              input.revision === (prior.revision || 0),
              "O kit foi alterado por outro utilizador. Actualize os dados antes de guardar.",
            );
          }
          const valid = await validatedKit(c, u.empresaId, input);
          check(
            !kits.some(
              (k: any) =>
                k.id !== prior?.id &&
                k.codigo.toLocaleLowerCase() ===
                  valid.codigo.toLocaleLowerCase(),
            ),
            "Já existe um kit com este código.",
          );
          const kit = {
            ...valid,
            id: prior?.id || randomUUID(),
            revision: (prior?.revision || 0) + 1,
            criadoEm: prior?.criadoEm || new Date().toISOString(),
          };
          check(kits.length < 500 || prior, "Limite de kits atingido.");
          await saveCatalogue(c, u.empresaId, {
            kits: prior
              ? kits.map((k: any) => (k.id === kit.id ? kit : k))
              : [...kits, kit],
          });
          return kit;
        }),
      ),
    ),
  );
  router.delete(
    "/kits/:id",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          admin(req);
          const cfg = await catalogueSettings(c, u.empresaId),
            kits = cfg.kits || [],
            kit = kits.find((k: any) => k.id === req.params.id);
          check(kit, "Kit inexistente nesta empresa.");
          check(
            req.body.revision === (kit.revision || 0),
            "O kit foi alterado por outro utilizador. Actualize os dados.",
          );
          await saveCatalogue(c, u.empresaId, {
            kits: kits.filter((k: any) => k.id !== kit.id),
          });
          return { ok: true };
        }),
      ),
    ),
  );
  router.post(
    "/products",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          admin(req);
          const b = req.body.product;
          check(b && text(b.nome, 300), "Nome obrigatório.");
          check(cents(b.preco) >= 0, "Preço inválido.");
          check(
            Number.isFinite(Number(b.stock)) && Number(b.stock) >= 0,
            "Stock inválido.",
          );
          const meta = {
            unidadeMedida: String(b.unidadeMedida || "un").slice(0, 30),
            codigoBarras: String(b.codigoBarras || "").slice(0, 100),
            lotes: b.lotes || [],
            dataValidade: b.dataValidade || "",
            precoCusto: Number(b.precoCusto || 0),
            localizacao: String(b.localizacao || "").slice(0, 100),
          };
          const args = [
            u.empresaId,
            text(b.codigo || "", 80),
            b.nome,
            text(b.categoria || "", 100),
            Number(b.preco),
            Boolean(b.ivaIsento),
            text(b.descricao || "", 1000),
            b.ativo !== false,
            Number(b.stock),
            Number(b.stockMinimo || 0),
            JSON.stringify(meta),
          ];
          check(
            Number.isFinite(args[9] as number) && Number(args[9]) >= 0,
            "Stock mínimo inválido.",
          );
          let q;
          if (b.id)
            q = await c.query(
              "UPDATE public.produtos SET codigo=$2,nome=$3,categoria=$4,preco=$5,iva_isento=$6,descricao=$7,ativo=$8,stock=$9,stock_minimo=$10,billing_meta=$11 WHERE empresa_id=$1 AND id=$12 RETURNING *",
              [...args, Number(b.id)],
            );
          else
            q = await c.query(
              "INSERT INTO public.produtos(empresa_id,codigo,nome,categoria,preco,iva_isento,descricao,ativo,stock,stock_minimo,billing_meta) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
              args,
            );
          check(q.rows[0], "Artigo inexistente.");
          return product(q.rows[0]);
        }),
      ),
    ),
  );
  router.post(
    "/clients",
    wrap(async (req: any, res: any) =>
      res.json(
        await tx(req, async (c: any, u: any) => {
          const b = req.body.client;
          check(b && text(b.nome, 300), "Nome obrigatório.");
          const a = [
            u.empresaId,
            b.nome,
            text(b.nif || "", 30),
            text(b.telefone || "", 60),
            text(b.email || "", 160),
            text(b.endereco || "", 500),
          ];
          // Mesmo cadastro de pacientes, sem copiar dados clínicos para o módulo financeiro.
          const q = b.id
            ? await c.query(
                "UPDATE public.pacientes SET nome=$2,nif=$3,telefone=$4,email=$5,endereco=$6 WHERE empresa_id=$1 AND id=$7 RETURNING id,nome,nif,telefone,email,endereco",
                [...a, Number(b.id)],
              )
            : await c.query(
                "INSERT INTO public.pacientes(empresa_id,nome,nif,telefone,email,endereco) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,nome,nif,telefone,email,endereco",
                a,
              );
          check(q.rows[0], "Cliente inexistente.");
          return q.rows[0];
        }),
      ),
    ),
  );
  router.get(
    "/agt/preparation",
    wrap(async (req: any, res: any) => {
      admin(req);
      const u = getUser(req),
        cfg = await config(db, u.empresaId!);
      const q = await db.query(
        "SELECT invoice_id,state,request_id,created_at FROM public.nv_billing_agt_queue WHERE empresa_id=$1 ORDER BY created_at DESC",
        [u.empresaId],
      );
      const prints = await db.query(
        "SELECT invoice_id,actor,format,copy_no,created_at FROM public.nv_billing_prints WHERE empresa_id=$1 ORDER BY created_at DESC",
        [u.empresaId],
      );
      res.json({
        software: "NVUALASOFT",
        schemaVersion: "2.0",
        ambiente: "homologacao",
        submissaoDisponivel: false,
        aviso:
          "Fila anterior de ensaios locais. O painel AGT actual apresenta os pedidos de homologação.",
        certificado: cfg.configuracaoFiscal.softwareCertificadoNumero,
        pendencias: [
          "Validação/certificação AGT do NVUALASOFT",
          "Credenciais oficiais e chaves RSA/JWS do produtor e contribuinte",
          "Séries autorizadas pela AGT",
          "Mapeamento fiscal, SAF-T(AO) e esquema 2.0 validados em homologação",
          "QR/código de validação oficial e testes de impressão",
          "Activação de produção após homologação: emissão fiscal permanece bloqueada",
        ],
        documentos: q.rows,
        impressoes: prints.rows,
      });
    }),
  );
  router.get(
    "/agt/dossier",
    wrap(async (req: any, res: any) => {
      admin(req);
      const org = getUser(req).empresaId;
      const docs = await db.query(
        "SELECT * FROM public.faturas WHERE empresa_id=$1 ORDER BY id",
        [org],
      );
      const queue = await db.query(
        "SELECT * FROM public.nv_billing_agt_queue WHERE empresa_id=$1 ORDER BY created_at",
        [org],
      );
      res.json({
        formato: "NVUALASOFT_PREPARACAO_AGT",
        aviso:
          "Dossier interno de homologação. Não é SAF-T(AO) validado nem pedido pronto para envio à AGT.",
        schemaAlvo: "2.0",
        geradoEm: new Date().toISOString(),
        documentos: docs.rows.map(invoice),
        fila: queue.rows,
      });
    }),
  );
  router.use("/agt", createAgtRouter(db, agtDependencies));
  return router;
}
export const integratedBilling = createIntegratedBilling();
// Fecha as rotas antigas de escrita: não permite contornar o motor integrado.
const legacy = Router();
legacy.get("/faturas", requireEmpresa, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM public.faturas WHERE empresa_id=$1 AND coalesce(billing_meta->>'ambiente','')<>'homologacao' AND (paciente_id IS NULL OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=faturas.paciente_id AND p.empresa_id=faturas.empresa_id)) ORDER BY id DESC",
      [getUser(req).empresaId],
    );
    res.json(r.rows.map(invoice));
  } catch {
    res
      .status(500)
      .json({ error: "Não foi possível carregar o arquivo de facturação." });
  }
});
legacy.use("/faturas", (req, res, next) => {
  if (["GET", "HEAD"].includes(req.method)) {
    next();
    return;
  }
  res.status(409).json({
    error:
      "Utilize Finanças → Facturação. A emissão foi transferida para o módulo integrado com controlo de caixa.",
  });
});
export default legacy;

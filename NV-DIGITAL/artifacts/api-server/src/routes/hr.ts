import { Router } from "express";
import { pool as defaultPool } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { getUser, requireEmpresa } from "../lib/auth.js";
import {
  allowed,
  deny,
  value,
  uuid,
  transaction,
  apiErrors,
} from "../lib/governance.js";
import {
  GLOBAL_DEFAULT_ROSTER_RULES,
  SHIFT_LEGEND,
  calculatePayroll,
  evaluateNurseCompliance,
  getDaysInMonth,
  HR_RULE_VERSION,
  payrollOptions,
  internalDeductionRows,
  payrollProfileForMonth,
} from "@workspace/api-zod";
export function createHR(pool: any = defaultPool) {
  const r = Router();
  r.use(requireEmpresa);
  async function capabilities(u: any) {
    const defaults = {
      canSchedule: ["admin", "gestor"].includes(u.funcao || ""),
      canPayroll: ["admin", "gestor", "financeiro"].includes(u.funcao || ""),
      canManageAccess: ["admin", "gestor"].includes(u.funcao || ""),
    };
    if (u.funcao !== "enfermeiro" || !u.funcionarioId) return defaults;
    const grant = (
      await pool.query(
        "SELECT a.can_schedule,a.can_payroll FROM nv_hr_access a JOIN funcionarios f ON f.id=a.worker_id AND f.empresa_id=a.empresa_id WHERE a.empresa_id=$1 AND a.worker_id=$2 AND f.ativo AND f.funcao='enfermeiro' AND f.username=$3",
        [u.empresaId, u.funcionarioId, u.username],
      )
    ).rows[0];
    return {
      ...defaults,
      canSchedule: grant?.can_schedule === true,
      canPayroll: grant?.can_payroll === true,
    };
  }
  r.get("/access", async (req, res, next) => {
    try {
      const u = getUser(req),
        caps = await capabilities(u),
        q = await pool.query(
          "SELECT data FROM nv_settings WHERE empresa_id=$1",
          [u.empresaId],
        );
      res.set("Cache-Control", "no-store");
      res.json({
        ...caps,
        serviceEnabled: q.rows[0]?.data?.services?.includes("escalas") === true,
      });
    } catch (e) {
      next(e);
    }
  });
  r.use(async (req, res, next) => {
    try {
      const u = getUser(req),
        caps = await capabilities(u);
      if (!caps.canSchedule && !caps.canPayroll)
        deny(
          "A administração deve autorizar o acesso a escalas ou à folha salarial.",
          403,
        );
      (u as any).hrAccess = caps;
      res.set("Cache-Control", "no-store");
      next();
    } catch (e) {
      next(e);
    }
  });
  r.use((req, res, next) => {
    pool
      .query("SELECT data FROM public.nv_settings WHERE empresa_id=$1", [
        getUser(req).empresaId,
      ])
      .then((q: any) => {
        if (!q.rows[0]?.data?.services?.includes("escalas")) {
          res.status(403).json({
            error:
              "Active Recursos humanos — escalas na configuração da instituição.",
          });
          return;
        }
        next();
      })
      .catch(next);
  });
  const scheduling = (u: any) => {
    if (!u.hrAccess?.canSchedule)
      deny("Sem autorização para gerir escalas.", 403);
  };
  const payrollAccess = (u: any) => {
    if (!u.hrAccess?.canPayroll)
      deny("Sem autorização para consultar ou gerir remunerações.", 403);
  };
  r.use(["/profiles", "/payroll"], (req, _res, next) => {
    try {
      payrollAccess(getUser(req));
      next();
    } catch (e) {
      next(e);
    }
  });
  r.get("/access-admin", async (req, res, next) => {
    try {
      const u = getUser(req);
      allowed(u, ["admin", "gestor"]);
      res.json(
        (
          await pool.query(
            "SELECT f.id,f.nome,f.funcao,f.ativo,p.data->>'position' AS position,p.data->>'category' AS category,a.can_schedule,a.can_payroll,a.revision,a.reason FROM funcionarios f LEFT JOIN nv_professionals p ON p.empresa_id=f.empresa_id AND p.funcionario_id=f.id LEFT JOIN nv_hr_access a ON a.empresa_id=f.empresa_id AND a.worker_id=f.id WHERE f.empresa_id=$1 AND (f.funcao='enfermeiro' OR a.worker_id IS NOT NULL) ORDER BY f.nome",
            [u.empresaId],
          )
        ).rows,
      );
    } catch (e) {
      next(e);
    }
  });
  r.post("/access-admin", async (req, res, next) => {
    try {
      const u = getUser(req);
      allowed(u, ["admin", "gestor"]);
      const id = uuid(req.body.workerId),
        reason = value(req.body.reason, 1000);
      if (
        typeof req.body.canSchedule !== "boolean" ||
        typeof req.body.canPayroll !== "boolean"
      )
        deny("Indique as duas autorizações.");
      res.json(
        await transaction(pool, u.empresaId!, async (c: any) => {
          const worker =
            (
              await c.query(
                "SELECT funcao,ativo FROM funcionarios WHERE empresa_id=$1 AND id=$2",
                [u.empresaId, id],
              )
            ).rows[0] ||
            deny("Colaborador inexistente nesta instituição.", 404);
          if (
            (req.body.canSchedule || req.body.canPayroll) &&
            (!worker.ativo || worker.funcao !== "enfermeiro")
          )
            deny("Seleccione uma conta activa de enfermagem.", 403);
          const old = (
            await c.query(
              "SELECT revision FROM nv_hr_access WHERE empresa_id=$1 AND worker_id=$2 FOR UPDATE",
              [u.empresaId, id],
            )
          ).rows[0];
          if (Number(req.body.revision) !== Number(old?.revision || 0))
            deny("Autorizações alteradas. Actualize.", 409);
          const row = (
            await c.query(
              "INSERT INTO nv_hr_access(empresa_id,worker_id,can_schedule,can_payroll,reason,actor) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(empresa_id,worker_id) DO UPDATE SET can_schedule=$3,can_payroll=$4,reason=$5,actor=$6,revision=nv_hr_access.revision+1,updated_at=now() RETURNING *",
              [
                u.empresaId,
                id,
                req.body.canSchedule,
                req.body.canPayroll,
                reason,
                u.username,
              ],
            )
          ).rows[0];
          await c.query(
            "INSERT INTO nv_hr_history(id,empresa_id,kind,reference,actor,data) VALUES($1,$2,'access',$3,$4,$5)",
            [randomUUID(), u.empresaId, id, u.username, JSON.stringify(row)],
          );
          return row;
        }),
      );
    } catch (e) {
      next(e);
    }
  });
  const month = (s: any) => {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(s || "")) deny("Mês inválido.");
    return s as string;
  };
  const endpoint = (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res)).catch(next);
  async function action(req: any, kind: string, reference: string, fn: any) {
    const u = getUser(req),
      id = uuid(req.body.requestId);
    return transaction(pool, u.empresaId!, async (c) => {
      const payload = { method: req.method, path: req.path, body: req.body };
      const old = (
        await c.query(
          "SELECT actor,result,payload=$3::jsonb AS same FROM public.nv_hr_requests WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, id, JSON.stringify(payload)],
        )
      ).rows[0];
      if (old) {
        if (old.actor !== u.username || !old.same)
          deny("Chave de pedido reutilizada.", 409);
        return old.result;
      }
      const result = await fn(c, u);
      await c.query(
        "INSERT INTO public.nv_hr_requests(empresa_id,id,actor,payload,result) VALUES($1,$2,$3,$4,$5)",
        [
          u.empresaId,
          id,
          u.username,
          JSON.stringify(payload),
          JSON.stringify(result),
        ],
      );
      await c.query(
        "INSERT INTO public.nv_hr_history(id,empresa_id,kind,reference,actor,data) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          u.empresaId,
          kind,
          reference,
          u.username,
          JSON.stringify(result),
        ],
      );
      return result;
    });
  }
  const calc = (p: any) => {
    try {
      return calculatePayroll(p);
    } catch (e: any) {
      return deny(e.message);
    }
  };
  const worker = async (c: any, org: string, id: string) => {
    const w = (
      await c.query(
        "SELECT id,nome,funcao,ativo FROM public.funcionarios WHERE empresa_id=$1 AND id=$2 AND ativo",
        [org, uuid(id)],
      )
    ).rows[0];
    if (!w)
      deny("Funcionário inactivo, inexistente ou de outra instituição.", 403);
    return w;
  };
  r.get(
    "/workers",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      const ws = await pool.query(
        "SELECT f.id,f.nome,f.funcao,f.ativo,p.data->>'position' AS position,p.data->>'category' AS category FROM public.funcionarios f LEFT JOIN public.nv_professionals p ON p.empresa_id=f.empresa_id AND p.funcionario_id=f.id WHERE f.empresa_id=$1 ORDER BY f.nome",
        [u.empresaId],
      );
      res.json(ws.rows);
    }),
  );
  r.get(
    "/roster",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      scheduling(u);
      const m = month(req.query.month),
        department = value(req.query.department, 100);
      const data = (
        await pool.query(
          "SELECT * FROM public.nv_hr_rosters WHERE empresa_id=$1 AND month=$2 AND department=$3",
          [u.empresaId, m, department],
        )
      ).rows[0];
      res.json(
        data || {
          id: null,
          month: m,
          department,
          revision: 0,
          status: "rascunho",
          data: { rows: [], rules: GLOBAL_DEFAULT_ROSTER_RULES },
        },
      );
    }),
  );
  r.get(
    "/legacy",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      scheduling(u);
      res.json(
        (
          await pool.query(
            "SELECT id,reference,title,status,data,revision FROM public.nv_cases WHERE empresa_id=$1 AND kind='escalas' ORDER BY updated_at DESC LIMIT 100",
            [u.empresaId],
          )
        ).rows,
      );
    }),
  );
  r.post(
    "/roster",
    endpoint(async (req: any, res: any) => {
      const u = getUser(req);
      scheduling(u);
      const m = month(req.body.month),
        department = value(req.body.department, 100);
      res.json(
        await action(
          req,
          "roster",
          m + "|" + department,
          async (c: any, u: any) => {
            const old = (
              await c.query(
                "SELECT * FROM public.nv_hr_rosters WHERE empresa_id=$1 AND month=$2 AND department=$3 FOR UPDATE",
                [u.empresaId, m, department],
              )
            ).rows[0];
            if (Number(req.body.revision) !== Number(old?.revision || 0))
              deny(
                "A escala mudou noutro computador. Actualize antes de guardar.",
                409,
              );
            if (old?.status === "publicada")
              deny(
                "A escala está publicada. Reabra com motivo para corrigir.",
                409,
              );
            const input = req.body.data,
              rows = input?.rows,
              rules = input?.rules;
            if (
              !Array.isArray(rows) ||
              rows.length > 300 ||
              !rules ||
              JSON.stringify(input).length > 300000
            )
              deny("Escala inválida.");
            const seen = new Set(),
              clean = [] as any[];
            const [year, mon] = m.split("-").map(Number);
            const days = getDaysInMonth(year, mon - 1);
            const checkedRules = {
              ...GLOBAL_DEFAULT_ROSTER_RULES,
              ...rules,
              hours: { ...GLOBAL_DEFAULT_ROSTER_RULES.hours, ...rules.hours },
            };
            if (
              typeof checkedRules.allow24 !== "boolean" ||
              typeof checkedRules.confirmed !== "boolean" ||
              typeof checkedRules.legalBasis !== "string" ||
              checkedRules.legalBasis.length > 1000
            )
              deny("Configuração de regras inválida.");
            for (const k of Object.keys(SHIFT_LEGEND)) {
              const h = Number(checkedRules.hours[k]);
              if (!Number.isFinite(h) || h < 0 || h > 24)
                deny("Duração de turno inválida.");
              checkedRules.hours[k] = h;
            }
            if (checkedRules.hours.M2 !== 24)
              deny("O código M2 do modelo representa 24h.");
            for (const code of ["D", "F", "FE", "BM", "L"])
              if (checkedRules.hours[code] !== 0)
                deny(
                  "Folgas, férias e ausências não representam horas planeadas de trabalho.",
                );
            if (
              !Number.isFinite(Number(checkedRules.maxWeeklyHours)) ||
              checkedRules.maxWeeklyHours < 1 ||
              checkedRules.maxWeeklyHours > 54
            )
              deny(
                "Limite semanal inválido (1 a 54h; depende do enquadramento).",
              );
            if (
              !Number.isInteger(Number(checkedRules.maxConsecutiveDays)) ||
              checkedRules.maxConsecutiveDays < 1 ||
              checkedRules.maxConsecutiveDays > 7
            )
              deny("Limite de dias consecutivos inválido.");
            if (
              !Number.isFinite(Number(checkedRules.chiefMorningHours)) ||
              checkedRules.chiefMorningHours < 0 ||
              checkedRules.chiefMorningHours > 24
            )
              deny("Duração da manhã de chefia inválida.");
            for (const row of rows) {
              const w = await worker(c, u.empresaId, row.id);
              if (seen.has(w.id)) deny("Funcionário duplicado.");
              seen.add(w.id);
              const daily: any = {};
              for (const [day, code] of Object.entries(row.days || {})) {
                const d = Number(day);
                if (
                  !Number.isInteger(d) ||
                  d < 1 ||
                  d > days ||
                  !Object.hasOwn(SHIFT_LEGEND, String(code))
                )
                  deny("Dia ou código de turno inválido.");
                daily[d] = code;
              }
              clean.push({
                id: w.id,
                name: w.nome,
                department,
                jobTitle: String(row.jobTitle || w.funcao).slice(0, 100),
                roleCategory: String(row.roleCategory || "Equipa").slice(0, 80),
                days: daily,
              });
            }
            const status = req.body.publish ? "publicada" : "rascunho";
            const alerts = clean.flatMap((row) =>
              evaluateNurseCompliance(row, year, mon - 1, checkedRules).map(
                (a) => ({ ...a, worker: row.name }),
              ),
            );
            if (req.body.publish) {
              if (!clean.length || checkedRules.confirmed !== true)
                deny("Confirme as regras e inclua pelo menos um colaborador.");
              if (clean.some((row) => Object.keys(row.days).length !== days))
                deny(
                  "Preencha todos os dias dos colaboradores antes de publicar.",
                );
              if (alerts.some((a) => a.severity === "error"))
                deny("Corrija os alertas impeditivos antes de publicar.");
              if (alerts.length && !String(req.body.reviewNote || "").trim())
                deny("Registe a justificação da revisão dos alertas.");
              const other = (
                await c.query(
                  "SELECT data,department FROM public.nv_hr_rosters WHERE empresa_id=$1 AND month=$2 AND department<>$3 AND status='publicada'",
                  [u.empresaId, m, department],
                )
              ).rows;
              for (const roster of other)
                for (const row of clean) {
                  const same = roster.data.rows.find(
                    (x: any) => x.id === row.id,
                  );
                  if (same)
                    for (let d = 1; d <= days; d++)
                      if (
                        checkedRules.hours[row.days[d]] > 0 &&
                        roster.data.rules.hours[same.days[d]] > 0
                      )
                        deny(
                          `${row.name} já está escalado em ${roster.department} no dia ${d}.`,
                          409,
                        );
                }
            }
            const data = {
              rows: clean,
              rules: checkedRules,
              alerts,
              reviewNote: String(req.body.reviewNote || "").slice(0, 1000),
              printSettings: {
                unitHeading: value(
                  req.body.data?.printSettings?.unitHeading || department,
                  200,
                ),
                title: value(
                  req.body.data?.printSettings?.title ||
                    (/enferm/i.test(department)
                      ? "Escala Mensal de Trabalho para os Enfermeiros"
                      : "Escala Mensal de Trabalho"),
                  200,
                ),
                morningPeriod: value(
                  req.body.data?.printSettings?.morningPeriod ||
                    "07:00h - 15:00h",
                  80,
                ),
                afternoonPeriod: value(
                  req.body.data?.printSettings?.afternoonPeriod ||
                    "15:00h - 20:00h",
                  80,
                ),
                onCallPeriod: value(
                  req.body.data?.printSettings?.onCallPeriod ||
                    "07:00h - 07:00h",
                  80,
                ),
                activities: String(
                  req.body.data?.printSettings?.activities || "",
                ).slice(0, 3000),
              },
            };
            return (
              await c.query(
                "INSERT INTO public.nv_hr_rosters(id,empresa_id,month,department,revision,status,data,actor) VALUES($1,$2,$3,$4,1,$5,$6,$7) ON CONFLICT(empresa_id,month,department) DO UPDATE SET data=$6,status=$5,revision=nv_hr_rosters.revision+1,actor=$7,updated_at=now() RETURNING *",
                [
                  old?.id || randomUUID(),
                  u.empresaId,
                  m,
                  department,
                  status,
                  JSON.stringify(data),
                  u.username,
                ],
              )
            ).rows[0];
          },
        ),
      );
    }),
  );
  r.post(
    "/roster/reopen",
    endpoint(async (req: any, res: any) => {
      scheduling(getUser(req));
      const m = month(req.body.month),
        d = value(req.body.department, 100),
        reason = value(req.body.reason, 1000);
      res.json(
        await action(
          req,
          "roster-reopen",
          m + "|" + d,
          async (c: any, u: any) => {
            const q = await c.query(
              "UPDATE public.nv_hr_rosters SET status='rascunho',revision=revision+1,actor=$5,updated_at=now(),data=jsonb_set(data,'{reopenReason}',$6::jsonb) WHERE empresa_id=$1 AND month=$2 AND department=$3 AND revision=$4 AND status='publicada' RETURNING *",
              [
                u.empresaId,
                m,
                d,
                Number(req.body.revision),
                u.username,
                JSON.stringify(reason),
              ],
            );
            if (!q.rowCount) deny("Escala alterada ou não publicada.", 409);
            return q.rows[0];
          },
        ),
      );
    }),
  );
  r.get(
    "/profiles",
    endpoint(async (req: any, res: any) => {
      res.json(
        (
          await pool.query(
            "SELECT * FROM public.nv_hr_profiles WHERE empresa_id=$1",
            [getUser(req).empresaId],
          )
        ).rows,
      );
    }),
  );
  r.post(
    "/profiles",
    endpoint(async (req: any, res: any) => {
      const id = uuid(req.body.workerId);
      res.json(
        await action(req, "profile", id, async (c: any, u: any) => {
          await worker(c, u.empresaId, id);
          const old = (
            await c.query(
              "SELECT revision FROM public.nv_hr_profiles WHERE empresa_id=$1 AND worker_id=$2 FOR UPDATE",
              [u.empresaId, id],
            )
          ).rows[0];
          if (Number(req.body.revision) !== Number(old?.revision || 0))
            deny("O perfil salarial mudou. Actualize.", 409);
          const p = req.body.data;
          if (!p || !p.department) deny("Preencha o serviço / unidade.");
          const opts = (() => {
            try {
              return payrollOptions(p);
            } catch (e: any) {
              return deny(e.message);
            }
          })();
          if (opts.irtEnabled && !p.nif)
            deny("Indique o NIF para o cálculo de IRT.");
          if ((opts.inssEnabled || opts.employerEnabled) && !p.inssNumber)
            deny(
              "Indique o número INSS ou fundamente a desactivação do cálculo.",
            );
          if (p.confirmed !== true || !p.incidenceBasis || p.regime !== "geral")
            deny(
              "Confirme o enquadramento e as incidências. Regimes especiais exigem tratamento próprio.",
            );
          if (Number(p.basic) <= 0)
            deny("Salário base deve ser superior a zero.");
          calc(p);
          const clean = {
            department: value(p.department, 100),
            nif: value(p.nif, 30, true),
            inssNumber: value(p.inssNumber, 50, true),
            payrollOptions: opts,
            internalDeductions: internalDeductionRows(p),
            basic: Number(p.basic),
            retired: p.retired === true,
            deductions: Number(p.deductions || 0),
            deductionsMonth: p.deductionsMonth ? month(p.deductionsMonth) : "",
            deductionReason: String(p.deductionReason || "").slice(0, 500),
            allowances: (p.allowances || []).map((a: any) => ({
              label: value(a.label, 150),
              kind: ["ferias", "natal"].includes(a.kind) ? a.kind : "custom",
              value: Number(a.value),
              inss: a.inss,
              irt: a.irt,
              period:
                a.period === "recorrente" ? "recorrente" : month(a.period),
            })),
            regime: "geral",
            confirmed: true,
            incidenceBasis: value(p.incidenceBasis, 1000),
            iban: String(p.iban || "").slice(0, 60),
          };
          if (
            clean.deductions &&
            (!clean.deductionReason || !clean.deductionsMonth)
          )
            deny("Indique a fundamentação dos outros descontos.");
          return (
            await c.query(
              "INSERT INTO public.nv_hr_profiles(empresa_id,worker_id,data,actor) VALUES($1,$2,$3,$4) ON CONFLICT(empresa_id,worker_id) DO UPDATE SET data=$3,actor=$4,revision=nv_hr_profiles.revision+1,updated_at=now() RETURNING *",
              [u.empresaId, id, JSON.stringify(clean), u.username],
            )
          ).rows[0];
        }),
      );
    }),
  );
  r.get(
    "/payroll",
    endpoint(async (req: any, res: any) => {
      const m = month(req.query.month);
      res.json(
        (
          await pool.query(
            "SELECT * FROM public.nv_hr_payroll WHERE empresa_id=$1 AND month=$2",
            [getUser(req).empresaId, m],
          )
        ).rows[0] || null,
      );
    }),
  );
  r.post(
    "/payroll/generate",
    endpoint(async (req: any, res: any) => {
      const m = month(req.body.month);
      if (!m.startsWith("2026-"))
        deny(
          "A tabela fiscal disponível aplica-se apenas a 2026. Actualize as regras para outro exercício.",
        );
      res.json(
        await action(req, "payroll", m, async (c: any, u: any) => {
          const old = (
            await c.query(
              "SELECT * FROM public.nv_hr_payroll WHERE empresa_id=$1 AND month=$2 FOR UPDATE",
              [u.empresaId, m],
            )
          ).rows[0];
          if (old && old.status !== "rascunho")
            deny("Folha aprovada é imutável.", 409);
          if (Number(req.body.revision) !== Number(old?.revision || 0))
            deny("Folha alterada. Actualize.", 409);
          const workers = (
            await c.query(
              "SELECT f.id,f.nome,p.data,p.revision FROM public.funcionarios f LEFT JOIN public.nv_hr_profiles p ON p.worker_id=f.id AND p.empresa_id=f.empresa_id WHERE f.empresa_id=$1 AND f.ativo ORDER BY f.nome",
              [u.empresaId],
            )
          ).rows;
          if (!workers.length || workers.some((w: any) => !w.data?.confirmed))
            deny(
              "Configure e confirme o perfil salarial de todos os funcionários activos antes de gerar a folha.",
            );
          const rows = workers.map((w: any) => {
            const profile = payrollProfileForMonth(w.data, m);
            return {
              workerId: w.id,
              name: w.nome,
              profile,
              profileRevision: w.revision,
              ...calc(profile),
            };
          });
          const warnings = rows
            .filter((row: any) => row.gross < 100000)
            .map(
              (row: any) =>
                `${row.name}: rendimento inferior a 100 000 AOA; confirmar salário mínimo, microempresa/Startup, proporcionalidade ou autorização aplicável.`,
            );
          for (const row of rows) {
            const o = row.payrollOptions;
            if (
              !o.inssEnabled ||
              !o.employerEnabled ||
              !o.irtEnabled ||
              o.irtMode !== "table" ||
              o.employeeRate !== (row.profile.retired ? 8 : 3) ||
              o.employerRate !== 8
            )
              warnings.push(
                `${row.name}: cálculo configurado com desactivação/taxa personalizada. Fundamento: ${o.reason}. A configuração não constitui isenção legal.`,
              );
          }
          if (m.endsWith("-12"))
            for (const row of rows)
              if (!row.profile.allowances.some((a: any) => a.kind === "natal"))
                warnings.push(
                  `${row.name}: verificar pagamento do subsídio de Natal, inclusive noutra folha ou mês.`,
                );
          const data = {
            warnings,
            ruleVersion: HR_RULE_VERSION,
            rows,
            scope:
              "Grupo A / regime geral, remunerações introduzidas e validadas; sem pagamento bancário automático",
            generatedAt: new Date().toISOString(),
          };
          return (
            await c.query(
              "INSERT INTO public.nv_hr_payroll(id,empresa_id,month,data,prepared_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(empresa_id,month) DO UPDATE SET data=$4,prepared_by=$5,revision=nv_hr_payroll.revision+1,updated_at=now() RETURNING *",
              [
                old?.id || randomUUID(),
                u.empresaId,
                m,
                JSON.stringify(data),
                u.username,
              ],
            )
          ).rows[0];
        }),
      );
    }),
  );
  r.post(
    "/payroll/approve",
    endpoint(async (req: any, res: any) => {
      allowed(getUser(req), ["admin", "gestor"]);
      const m = month(req.body.month);
      res.json(
        await action(req, "payroll-approve", m, async (c: any, u: any) => {
          const old = (
            await c.query(
              "SELECT * FROM public.nv_hr_payroll WHERE empresa_id=$1 AND month=$2 FOR UPDATE",
              [u.empresaId, m],
            )
          ).rows[0];
          if (
            !old ||
            old.status !== "rascunho" ||
            old.revision !== Number(req.body.revision)
          )
            deny("Folha inexistente, alterada ou já aprovada.", 409);
          if (old.prepared_by === u.username)
            deny("A aprovação exige outro gestor autenticado.", 403);
          if (req.body.confirmed !== true)
            deny("Confirme a revisão dos valores e do enquadramento fiscal.");
          const activeWorkers = (
            await c.query(
              "SELECT id,nome FROM public.funcionarios WHERE empresa_id=$1 AND ativo",
              [u.empresaId],
            )
          ).rows;
          if (
            activeWorkers.length !== old.data.rows.length ||
            activeWorkers.some(
              (w: any) =>
                !old.data.rows.some(
                  (row: any) => row.workerId === w.id && row.name === w.nome,
                ),
            )
          )
            deny(
              "A equipa activa mudou. Regenere a folha antes de aprovar.",
              409,
            );
          for (const row of old.data.rows) {
            const w = await worker(c, u.empresaId, row.workerId),
              p = (
                await c.query(
                  "SELECT revision FROM public.nv_hr_profiles WHERE empresa_id=$1 AND worker_id=$2",
                  [u.empresaId, w.id],
                )
              ).rows[0];
            if (!p || Number(p.revision) !== Number(row.profileRevision))
              deny("Um perfil mudou após a geração. Regenere a folha.", 409);
          }
          return (
            await c.query(
              "UPDATE public.nv_hr_payroll SET status='aprovada',approved_by=$3,approved_at=now(),revision=revision+1,updated_at=now() WHERE empresa_id=$1 AND month=$2 RETURNING *",
              [u.empresaId, m, u.username],
            )
          ).rows[0];
        }),
      );
    }),
  );
  r.post(
    "/payroll/paid",
    endpoint(async (req: any, res: any) => {
      const m = month(req.body.month),
        reference = value(req.body.reference, 200);
      res.json(
        await action(req, "payroll-paid", m, async (c: any, u: any) => {
          const q = await c.query(
            "UPDATE public.nv_hr_payroll SET status='paga',payment_reference=$4,revision=revision+1,updated_at=now() WHERE empresa_id=$1 AND month=$2 AND revision=$3 AND status='aprovada' RETURNING *",
            [u.empresaId, m, Number(req.body.revision), reference],
          );
          if (!q.rowCount)
            deny(
              "Só pode registar pagamento de uma folha aprovada e actual.",
              409,
            );
          return q.rows[0];
        }),
      );
    }),
  );
  r.post(
    "/export",
    endpoint(async (req: any, res: any) => {
      const m = month(req.body.month),
        kind = req.body.kind;
      if (!["roster", "payroll", "slip", "inss"].includes(kind))
        deny("Exportação inválida.");
      if (kind === "roster") scheduling(getUser(req));
      else payrollAccess(getUser(req));
      res.json(
        await action(req, "export", m, async (c: any, u: any) => {
          const data =
            kind === "roster"
              ? (
                  await c.query(
                    "SELECT * FROM public.nv_hr_rosters WHERE empresa_id=$1 AND month=$2 AND department=$3",
                    [u.empresaId, m, value(req.body.department, 100)],
                  )
                ).rows[0]
              : (
                  await c.query(
                    "SELECT * FROM public.nv_hr_payroll WHERE empresa_id=$1 AND month=$2",
                    [u.empresaId, m],
                  )
                ).rows[0];
          if (!data)
            deny("Guarde o documento no servidor antes de exportar.", 404);
          if (Number(data.revision) !== Number(req.body.revision))
            deny("O documento mudou. Actualize antes de exportar.", 409);
          if (kind === "slip") {
            data.data = {
              ...data.data,
              rows: data.data.rows.filter(
                (x: any) => x.workerId === req.body.workerId,
              ),
            };
            if (data.data.rows.length !== 1)
              deny("Colaborador não consta nesta folha.");
          }
          const company =
            (
              await c.query(
                "SELECT nome_clinica,nif,endereco,logo_data FROM public.config WHERE empresa_id=$1",
                [u.empresaId],
              )
            ).rows[0] ||
            (
              await c.query(
                "SELECT nome AS nome_clinica FROM public.empresas WHERE id=$1",
                [u.empresaId],
              )
            ).rows[0];
          return {
            kind,
            document: data,
            company,
            exportedBy: u.username,
            exportedAt: new Date().toISOString(),
          };
        }),
      );
    }),
  );
  r.get(
    "/history",
    endpoint(async (req: any, res: any) => {
      res.json(
        (
          await pool.query(
            "SELECT kind,reference,actor,created_at FROM public.nv_hr_history WHERE empresa_id=$1 AND ($2::boolean OR kind LIKE 'roster%') ORDER BY created_at DESC LIMIT 100",
            [getUser(req).empresaId, (getUser(req) as any).hrAccess.canPayroll],
          )
        ).rows,
      );
    }),
  );
  r.use(apiErrors);
  return r;
}
export default createHR();

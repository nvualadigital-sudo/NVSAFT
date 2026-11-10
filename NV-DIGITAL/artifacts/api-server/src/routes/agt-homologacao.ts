import { Router } from "express";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { requireEmpresa, getUser } from "../lib/auth.js";
import { check, localStamp } from "../lib/billing-engine.js";
import {
  canonical,
  sha256,
  verifyJws,
  publicPem,
  fingerprint,
} from "../lib/agt/crypto.js";
import {
  emptyProfile,
  validateProfile,
  registerPayload,
  partialReceiptDiagnostic,
  servicePayload,
  docTypes,
  type Profile,
} from "../lib/agt/wire.js";
import {
  loadRuntime,
  loadProducer,
  publicConfiguration,
  readKey,
  projectRoot,
  options,
  type Runtime,
} from "../lib/agt/runtime.js";
import {
  hmlRequest,
  classifyState,
  matchesConsultedDocument,
  type Reply,
} from "../lib/agt/transport.js";
import { exportSaft } from "../lib/agt/saft.js";
type Dependencies = {
  runtime?: typeof loadRuntime;
  request?: (op: string, payload: any, runtime: Runtime) => Promise<Reply>;
  producer?: typeof loadProducer;
};
const uuid = (v: any) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v || "",
  );
export function createAgtRouter(db: any, dependencies: Dependencies = {}) {
  const r = Router(),
    runtime = dependencies.runtime || loadRuntime,
    remote = dependencies.request || hmlRequest,
    producer = dependencies.producer || loadProducer;
  r.use(requireEmpresa);
  r.use((req, res, next) => {
    if (!["admin", "gestor"].includes(getUser(req).funcao || "")) {
      res.status(403).json({
        error:
          "A homologação exige um administrador ou gestor da própria empresa.",
      });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const wrap = (fn: any) => async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      res.status(e.status || 400).json({
        error: e.code
          ? "A operação fiscal não foi confirmada. Verifique a configuração e as referências."
          : e.message || "Operação fiscal não confirmada.",
      });
    }
  };
  async function tx(u: any, fn: any) {
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        "nv-billing:" + u.empresaId,
      ]);
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
  async function event(
    c: any,
    u: any,
    action: string,
    id: string | null,
    data: any = {},
  ) {
    await c.query(
      "INSERT INTO public.nv_agt_events(empresa_id,job_id,actor,action,data) VALUES($1,$2,$3,$4,$5)",
      [u.empresaId, id, u.username, action, JSON.stringify(data)],
    );
  }
  async function configuration(c: any, u: any) {
    const base =
      (
        await c.query(
          "SELECT nif,nome_clinica FROM public.config WHERE empresa_id=$1",
          [u.empresaId],
        )
      ).rows[0] || {};
    const saved = (
      await c.query(
        "SELECT * FROM public.nv_agt_profiles WHERE empresa_id=$1",
        [u.empresaId],
      )
    ).rows[0];
    return {
      company: {
        nif: String(base.nif || ""),
        name: String(base.nome_clinica || ""),
      },
      profile: { ...emptyProfile, ...saved?.data } as Profile,
      revision: saved?.revision || 0,
    };
  }
  async function ownJob(c: any, u: any, id: string) {
    check(uuid(id), "Pedido inválido.");
    const row = (
      await c.query(
        "SELECT * FROM public.nv_agt_jobs WHERE empresa_id=$1 AND id=$2",
        [u.empresaId, id],
      )
    ).rows[0];
    check(row, "Pedido inexistente nesta empresa.");
    return row;
  }
  async function savePrepared(
    c: any,
    u: any,
    b: any,
    operation: string,
    build: () => any | Promise<any>,
    ids: number[] = [],
  ) {
    check(uuid(b.requestId), "Falta a chave de idempotência.");
    const hash = sha256(canonical({ operation, input: b }));
    const prior = (
      await c.query(
        "SELECT * FROM public.nv_agt_jobs WHERE empresa_id=$1 AND request_key=$2",
        [u.empresaId, b.requestId],
      )
    ).rows[0];
    if (prior) {
      check(
        prior.input_hash === hash && prior.actor === u.username,
        "Chave de pedido reutilizada com outro conteúdo ou utilizador.",
      );
      return prior;
    }
    if (ids.length) {
      const active = (
        await c.query(
          "SELECT invoice_ids FROM public.nv_agt_jobs WHERE empresa_id=$1 AND operation='registarFactura' AND status<>'cancelado'",
          [u.empresaId],
        )
      ).rows;
      check(
        !active.some((j: any) =>
          j.invoice_ids.some((id: number) => ids.includes(id)),
        ),
        "Um documento já pertence a um pedido. Consulte a resposta; uma rejeição exige a correcção prevista pela AGT, sem repetir o documento original.",
      );
    }
    const payload = await build(),
      id = randomUUID();
    const row = (
      await c.query(
        "INSERT INTO public.nv_agt_jobs(id,empresa_id,actor,request_key,input_hash,operation,payload,payload_hash,invoice_ids,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'preparado') RETURNING *",
        [
          id,
          u.empresaId,
          u.username,
          b.requestId,
          hash,
          operation,
          JSON.stringify(payload),
          sha256(canonical(payload)),
          JSON.stringify(ids),
        ],
      )
    ).rows[0];
    await event(c, u, "prepare", id, {
      operation,
      invoiceIds: ids,
      payloadHash: row.payload_hash,
    });
    return row;
  }
  r.get(
    "/status",
    wrap(async (req: any, res: any) => {
      const u = getUser(req),
        cfg = await configuration(db, u);
      res.json({
        ...cfg,
        companyId: u.empresaId,
        environment: "homologacao",
        dossierAllowed:
          options().dossierCompanyIds?.includes(u.empresaId) === true,
        runtime: publicConfiguration(u.empresaId!, cfg.company.nif),
        series: (
          await db.query(
            "SELECT tipo,code,year,first_no,last_no,next_no,confirmed_at FROM public.nv_agt_series WHERE empresa_id=$1 ORDER BY tipo,code",
            [u.empresaId],
          )
        ).rows,
        jobs: (
          await db.query(
            "SELECT id,operation,status,agt_request_id,invoice_ids,created_at,updated_at,next_poll_at,attempts FROM public.nv_agt_jobs WHERE empresa_id=$1 ORDER BY created_at DESC LIMIT 100",
            [u.empresaId],
          )
        ).rows,
      });
    }),
  );
  r.post(
    "/profile",
    wrap(async (req: any, res: any) => {
      const u = getUser(req);
      res.json(
        await tx(u, async (c: any) => {
          check(uuid(req.body.requestId), "Falta a chave de pedido.");
          const inputHash = sha256(
            canonical({
              profile: req.body.profile,
              revision: req.body.revision,
            }),
          );
          const prior = (
            await c.query(
              "SELECT actor,data FROM public.nv_agt_events WHERE empresa_id=$1 AND action='profile.save' AND data->>'requestId'=$2 ORDER BY id DESC LIMIT 1",
              [u.empresaId, req.body.requestId],
            )
          ).rows[0];
          if (prior) {
            check(
              prior.actor === u.username && prior.data.inputHash === inputHash,
              "Chave de pedido de perfil reutilizada com outro conteúdo.",
            );
            return { ok: true, revision: prior.data.revision };
          }
          const cfg = await configuration(c, u);
          check(
            req.body.revision === cfg.revision,
            "O perfil foi alterado. Actualize os dados antes de guardar.",
          );
          const p = validateProfile(req.body.profile);
          if (p.enabled) {
            const rt = runtime(u.empresaId!, cfg.company.nif);
            servicePayload("listarSeries", {}, cfg.company.nif, rt);
            check(cfg.company.name, "Configure a razão social da empresa.");
            for (const [type, code] of Object.entries(p.series)) {
              const row = (
                await c.query(
                  "SELECT 1 FROM public.nv_agt_series WHERE empresa_id=$1 AND tipo=$2 AND code=$3 AND year=$4 AND next_no<=last_no AND evidence->>'issuerNif'=$5",
                  [u.empresaId, type, code, localStamp().year, cfg.company.nif],
                )
              ).rows[0];
              check(
                row,
                "Seleccione uma série confirmada pela AGT, válida para o ano e não esgotada.",
              );
            }
          }
          await c.query(
            "INSERT INTO public.nv_agt_profiles(empresa_id,data,revision,updated_by) VALUES($1,$2,1,$3) ON CONFLICT(empresa_id) DO UPDATE SET data=EXCLUDED.data,revision=nv_agt_profiles.revision+1,updated_at=now(),updated_by=EXCLUDED.updated_by",
            [u.empresaId, JSON.stringify(p), u.username],
          );
          await event(c, u, "profile.save", null, {
            revision: cfg.revision + 1,
            requestId: req.body.requestId,
            inputHash,
            enabled: p.enabled,
          });
          return { ok: true, revision: cfg.revision + 1 };
        }),
      );
    }),
  );
  r.post(
    "/prepare",
    wrap(async (req: any, res: any) => {
      const u = getUser(req),
        b = req.body;
      res.json(
        await tx(u, async (c: any) => {
          check(
            Array.isArray(b.invoiceIds) &&
              b.invoiceIds.length > 0 &&
              b.invoiceIds.length <= 30 &&
              b.invoiceIds.every(
                (v: any) => Number.isSafeInteger(v) && v > 0,
              ) &&
              new Set(b.invoiceIds).size === b.invoiceIds.length,
            "Seleccione entre 1 e 30 documentos diferentes.",
          );
          return savePrepared(
            c,
            u,
            b,
            "registarFactura",
            async () => {
              const cfg = await configuration(c, u),
                rt = runtime(u.empresaId!, cfg.company.nif);
              const rows = (
                await c.query(
                  "SELECT * FROM public.faturas WHERE empresa_id=$1 AND id=ANY($2::integer[]) ORDER BY id",
                  [u.empresaId, b.invoiceIds],
                )
              ).rows;
              check(
                rows.length === b.invoiceIds.length,
                "Documento inexistente ou de outra empresa.",
              );
              const links = (
                await c.query(
                  `SELECT r.*, f.numero AS original_no
                   FROM public.nv_agt_replacements r JOIN public.faturas f
                     ON f.empresa_id=r.empresa_id AND f.id=r.original_id
                  WHERE r.empresa_id=$1 AND (r.original_id=ANY($2::integer[]) OR r.replacement_id=ANY($2::integer[]))`,
                  [u.empresaId, b.invoiceIds],
                )
              ).rows;
              for (const row of rows) {
                check(
                  !links.some((link: any) => link.original_id === row.id),
                  "Uma factura substituída não pode ser reenviada.",
                );
                const link = links.find(
                  (item: any) => item.replacement_id === row.id,
                );
                const proof = row.billing_meta?.agtCorrection;
                check(
                  (!link && !proof) ||
                    (link &&
                      proof &&
                      link.original_id === proof.invoiceId &&
                      link.original_no === proof.documentNo &&
                      link.rejection_job_id === proof.jobId),
                  "A correcção não coincide com o registo de substituição desta empresa.",
                );
              }
              const names = rows
                .map((row: any) => row.billing_meta?.documentoOrigem)
                .filter(Boolean);
              const originals = names.length
                ? (
                    await c.query(
                      "SELECT * FROM public.faturas WHERE empresa_id=$1 AND numero=ANY($2::text[])",
                      [u.empresaId, names],
                    )
                  ).rows
                : [];
              return registerPayload(
                rows,
                cfg.company.nif,
                cfg.profile,
                rt,
                new Map(originals.map((row: any) => [row.numero, row])),
              );
            },
            b.invoiceIds,
          );
        }),
      );
    }),
  );
  r.post(
    "/service",
    wrap(async (req: any, res: any) => {
      const u = getUser(req),
        b = req.body;
      check(
        [
          "solicitarSerie",
          "listarSeries",
          "consultarFactura",
          "listarFacturas",
          "validarDocumento",
        ].includes(b.operation),
        "Serviço não permitido.",
      );
      res.json(
        await tx(u, async (c: any) =>
          savePrepared(c, u, b, b.operation, async () => {
            const cfg = await configuration(c, u);
            return servicePayload(
              b.operation,
              b.input || {},
              cfg.company.nif,
              runtime(u.empresaId!, cfg.company.nif),
            );
          }),
        ),
      );
    }),
  );
  r.get(
    "/jobs/:id",
    wrap(async (req: any, res: any) => {
      const u = getUser(req),
        job = await ownJob(db, u, req.params.id);
      const events = (
        await db.query(
          "SELECT actor,action,data,created_at FROM public.nv_agt_events WHERE empresa_id=$1 AND job_id=$2 ORDER BY id",
          [u.empresaId, job.id],
        )
      ).rows;
      res.json({ ...job, events });
    }),
  );
  r.post(
    "/jobs/:id/cancel",
    wrap(async (req: any, res: any) => {
      const u = getUser(req);
      res.json(
        await tx(u, async (c: any) => {
          const j = await ownJob(c, u, req.params.id);
          check(
            j.status === "preparado" && j.attempts === 0,
            "Só pode cancelar um pedido que nunca foi enviado.",
          );
          await c.query(
            "UPDATE public.nv_agt_jobs SET status='cancelado',updated_at=now() WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, j.id],
          );
          await event(c, u, "cancel.unsubmitted", j.id);
          return { ok: true, status: "cancelado" };
        }),
      );
    }),
  );
  r.post(
    "/jobs/:id/send",
    wrap(async (req: any, res: any) => {
      const u = getUser(req);
      check(
        req.body.confirmHomologacao === true,
        "Confirme expressamente o envio para homologação.",
      );
      const claim = await tx(u, async (c: any) => {
        const j = await ownJob(c, u, req.params.id);
        check(
          j.status === "preparado" && j.attempts === 0,
          "Este pedido já teve uma tentativa de envio. Consulte ou reconcilie o estado; não o reenvie.",
        );
        check(
          sha256(canonical(j.payload)) === j.payload_hash,
          "A integridade do pedido não confere.",
        );
        const cfg = await configuration(c, u),
          rt = runtime(u.empresaId!, cfg.company.nif);
        check(
          rt.live,
          "O envio para homologação está desligado na configuração local.",
        );
        check(
          j.payload.taxRegistrationNumber === cfg.company.nif,
          "O NIF mudou depois da preparação.",
        );
        check(
          verifyJws(
            j.payload.softwareInfo.jwsSoftwareSignature,
            j.payload.softwareInfo.softwareInfoDetail,
            publicPem(rt.producerKey),
          ),
          "A chave do produtor mudou. Cancele este pedido não enviado e prepare novamente.",
        );
        if (j.operation === "registarFactura")
          for (const d of j.payload.documents) {
            const signed = {
              documentNo: d.documentNo,
              taxRegistrationNumber: cfg.company.nif,
              documentType: d.documentType,
              documentDate: d.documentDate,
              customerTaxID: d.customerTaxID,
              customerCountry: d.customerCountry,
              companyName: d.companyName,
              documentTotals: d.documentTotals,
            };
            check(
              verifyJws(
                d.jwsDocumentSignature,
                signed,
                publicPem(rt.issuerKey),
              ),
              "A chave do contribuinte mudou. Prepare um novo pedido antes de enviar.",
            );
          }
        else {
          const {
            schemaVersion: _schema,
            submissionTimeStamp: _stamp,
            softwareInfo: _software,
            jwsSignature: signature,
            ...signed
          } = j.payload;
          const expected =
            j.operation === "validarDocumento"
              ? {
                  taxRegistrationNumber: signed.taxRegistrationNumber,
                  documentNo: signed.documentNo,
                }
              : signed;
          check(
            verifyJws(signature, expected, publicPem(rt.issuerKey)),
            "A chave do contribuinte mudou. Cancele a preparação não enviada e prepare de novo.",
          );
        }
        await c.query(
          "UPDATE public.nv_agt_jobs SET status='a_enviar',attempts=attempts+1,updated_at=now() WHERE empresa_id=$1 AND id=$2",
          [u.empresaId, j.id],
        );
        await event(c, u, "send.claim", j.id);
        return { j, rt };
      });
      let reply: Reply | undefined;
      try {
        reply = await remote(claim.j.operation, claim.j.payload, claim.rt);
      } catch {}
      res.json(
        await tx(u, async (c: any) => {
          const j = await ownJob(c, u, claim.j.id);
          let status = "envio_incerto",
            requestID: null | string = null;
          if (reply) {
            if (reply.httpStatus === 200) {
              if (j.operation === "registarFactura") {
                if (
                  /^\d{1,15}$/.test(
                    typeof reply.body === "string"
                      ? reply.body
                      : String(reply.body?.requestID || ""),
                  ) &&
                  (!reply.body.errorList ||
                    (Array.isArray(reply.body.errorList) &&
                      reply.body.errorList.length === 0)) &&
                  (!reply.body.taxRegistrationNumber ||
                    reply.body.taxRegistrationNumber ===
                      j.payload.taxRegistrationNumber)
                ) {
                  status = "recebido";
                  requestID =
                    typeof reply.body === "string"
                      ? reply.body
                      : String(reply.body.requestID);
                }
              } else status = "respondido";
            } else if (
              reply.httpStatus >= 400 &&
              reply.httpStatus < 500 &&
              ![408, 429].includes(reply.httpStatus)
            )
              status = "rejeitado";
            if (
              j.operation === "solicitarSerie" &&
              status === "respondido" &&
              String(reply.body?.resultCode) === "1"
            ) {
              const s = reply.body.seriesFEResult,
                first = String(s?.firstDocumentNo || "")
                  .split("/")
                  .at(-1)!,
                last = String(s?.lastDocumentNo || "")
                  .split("/")
                  .at(-1)!;
              if (
                s &&
                /^[A-Za-z0-9_-]{3,45}$/.test(s.seriesCode || "") &&
                /^[1-9]\d{0,14}$/.test(first) &&
                /^[1-9]\d{0,14}$/.test(last) &&
                /^[1-9]\d{0,14}$/.test(String(s.authorizedQuantity)) &&
                (!String(s.firstDocumentNo).includes("/") ||
                  String(s.firstDocumentNo).startsWith(
                    j.payload.documentType + " " + s.seriesCode + "/",
                  )) &&
                (!String(s.lastDocumentNo).includes("/") ||
                  String(s.lastDocumentNo).startsWith(
                    j.payload.documentType + " " + s.seriesCode + "/",
                  )) &&
                (!reply.body.taxRegistrationNumber ||
                  reply.body.taxRegistrationNumber ===
                    j.payload.taxRegistrationNumber) &&
                BigInt(last) >= BigInt(first) &&
                BigInt(last) - BigInt(first) + 1n <=
                  BigInt(String(s.authorizedQuantity))
              ) {
                await c.query(
                  "INSERT INTO public.nv_agt_series(empresa_id,tipo,code,year,first_no,last_no,next_no,evidence) VALUES($1,$2,$3,$4,$5,$6,$5,$7) ON CONFLICT(empresa_id,tipo,code) DO UPDATE SET last_no=GREATEST(nv_agt_series.last_no,EXCLUDED.last_no),evidence=EXCLUDED.evidence,confirmed_at=now() WHERE nv_agt_series.year=EXCLUDED.year AND nv_agt_series.first_no=EXCLUDED.first_no",
                  [
                    u.empresaId,
                    j.payload.documentType,
                    s.seriesCode,
                    j.payload.seriesYear,
                    first,
                    last,
                    JSON.stringify({
                      ...reply.body,
                      issuerNif: j.payload.taxRegistrationNumber,
                      environment: "homologacao",
                    }),
                  ],
                );
              } else status = "envio_incerto";
            }
          }
          await c.query(
            "UPDATE public.nv_agt_jobs SET status=$3,response=$4,agt_request_id=$5,next_poll_at=now()+interval '30 seconds',updated_at=now() WHERE empresa_id=$1 AND id=$2",
            [
              u.empresaId,
              j.id,
              status,
              reply ? JSON.stringify(reply) : null,
              requestID,
            ],
          );
          await event(c, u, "send.result", j.id, {
            status,
            httpStatus: reply?.httpStatus || null,
            requestID,
            response: reply || null,
          });
          return { id: j.id, status, requestID };
        }),
      );
    }),
  );
  r.post(
    "/jobs/:id/poll",
    wrap(async (req: any, res: any) => {
      const u = getUser(req),
        claim = await tx(u, async (c: any) => {
          const j = await ownJob(c, u, req.params.id);
          check(
            j.operation === "registarFactura" &&
              j.agt_request_id &&
              ["recebido", "processando", "envio_incerto"].includes(j.status),
            "Este pedido não tem uma consulta pendente.",
          );
          check(
            !j.next_poll_at || new Date(j.next_poll_at).getTime() <= Date.now(),
            "Aguarde o intervalo mínimo indicado pela AGT.",
          );
          const cfg = await configuration(c, u),
            rt = runtime(u.empresaId!, cfg.company.nif);
          check(
            rt.live && cfg.company.nif === j.payload.taxRegistrationNumber,
            "A configuração de homologação ou o NIF não coincide.",
          );
          await c.query(
            "UPDATE public.nv_agt_jobs SET next_poll_at=now()+interval '30 seconds' WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, j.id],
          );
          return { j, rt };
        });
      let reply: Reply | undefined;
      try {
        reply = await remote(
          "obterEstado",
          servicePayload(
            "obterEstado",
            { requestID: claim.j.agt_request_id },
            claim.j.payload.taxRegistrationNumber,
            claim.rt,
          ),
          claim.rt,
        );
      } catch {}
      res.json(
        await tx(u, async (c: any) => {
          const j = await ownJob(c, u, claim.j.id);
          let status = j.status,
            warning = "";
          if (reply) {
            try {
              const b = reply.body;
              if (reply.httpStatus === 200) {
                check(
                  String(b.requestID) === j.agt_request_id &&
                    (!b.taxRegistrationNumber ||
                      b.taxRegistrationNumber ===
                        j.payload.taxRegistrationNumber),
                  "A resposta AGT pertence a outro pedido ou NIF.",
                );
                status = classifyState(
                  b,
                  j.payload.documents.map((d: any) => d.documentNo),
                );
              } else if (
                reply.httpStatus === 429 ||
                (reply.httpStatus === 422 &&
                  ["E96", "E97"].includes(
                    b.idError || b.errorList?.[0]?.idError,
                  ))
              )
                status = "processando";
              else
                warning =
                  "Consulta não conclusiva. Consulte a resposta; o estado de aprovação não foi alterado.";
            } catch (e: any) {
              warning = e.message;
            }
          } else
            warning = "Falha de rede na consulta. O pedido não foi reenviado.";
          await c.query(
            "UPDATE public.nv_agt_jobs SET status=$3,response=COALESCE($4::jsonb,response),next_poll_at=now()+$5*interval '1 second',updated_at=now() WHERE empresa_id=$1 AND id=$2",
            [
              u.empresaId,
              j.id,
              status,
              reply ? JSON.stringify(reply) : null,
              reply?.retrySeconds || 30,
            ],
          );
          await event(c, u, "poll.result", j.id, {
            status,
            httpStatus: reply?.httpStatus || null,
            warning,
            response: reply || null,
          });
          return { id: j.id, status, warning };
        }),
      );
    }),
  );
  r.post(
    "/jobs/:id/reconcile",
    wrap(async (req: any, res: any) => {
      const u = getUser(req),
        claim = await tx(u, async (c: any) => {
          const j = await ownJob(c, u, req.params.id);
          check(
            j.operation === "registarFactura" &&
              !j.agt_request_id &&
              (j.status === "envio_incerto" ||
                (j.status === "a_enviar" &&
                  Date.now() - new Date(j.updated_at).getTime() >= 60000)),
            "A reconciliação destina-se a envios sem resposta conclusiva.",
          );
          check(
            !j.next_poll_at || new Date(j.next_poll_at).getTime() <= Date.now(),
            "Aguarde antes de consultar novamente.",
          );
          const cfg = await configuration(c, u),
            rt = runtime(u.empresaId!, cfg.company.nif);
          check(
            rt.live && cfg.company.nif === j.payload.taxRegistrationNumber,
            "A configuração ou o NIF não coincide.",
          );
          await c.query(
            "UPDATE public.nv_agt_jobs SET status='envio_incerto',next_poll_at=now()+$3::int*interval '1 second' WHERE empresa_id=$1 AND id=$2",
            [u.empresaId, j.id, 30 + 16 * j.payload.documents.length],
          );
          return { j, rt };
        });
      const evidence: any[] = [];
      let allValid = true,
        retrySeconds = 30;
      for (const expected of claim.j.payload.documents) {
        try {
          const response = await remote(
            "consultarFactura",
            servicePayload(
              "consultarFactura",
              { documentNo: expected.documentNo },
              claim.j.payload.taxRegistrationNumber,
              claim.rt,
            ),
            claim.rt,
          );
          evidence.push(response);
          retrySeconds = Math.max(retrySeconds, response.retrySeconds);
          if (
            !matchesConsultedDocument(
              response,
              expected,
              claim.j.payload.taxRegistrationNumber,
            )
          )
            allValid = false;
          if (response.httpStatus === 429) break;
        } catch {
          allValid = false;
          evidence.push({ error: "Consulta sem resposta conclusiva" });
        }
      }
      res.json(
        await tx(u, async (c: any) => {
          const status = allValid ? "validado" : "envio_incerto";
          await c.query(
            "UPDATE public.nv_agt_jobs SET status=$3,response=$4,updated_at=now(),next_poll_at=now()+$5::int*interval '1 second' WHERE empresa_id=$1 AND id=$2",
            [
              u.empresaId,
              claim.j.id,
              status,
              JSON.stringify({ reconciliation: evidence }),
              retrySeconds,
            ],
          );
          await event(c, u, "reconcile", claim.j.id, { status, evidence });
          return {
            status,
            warning: allValid
              ? ""
              : "Não foi possível comprovar a aceitação de todos os documentos. Guarde o pedido e confirme com a AGT; não reenvie.",
          };
        }),
      );
    }),
  );
  r.get(
    "/modelo8",
    wrap(async (req: any, res: any) => {
      const u = getUser(req);
      if (options().dossierCompanyIds?.includes(u.empresaId) !== true)
        throw Object.assign(
          new Error(
            "A identificação completa do produtor está reservada à empresa proprietária. Use o gerador local de minutas no servidor.",
          ),
          { status: 403 },
        );
      const p = producer(),
        key = readKey(p.fePrivateKeyFile);
      res.json({
        status: "MINUTA_POR_PREENCHER_E_ASSINAR",
        producer: {
          legalName: p.legalName,
          nif: p.nif,
          address: p.address,
          email: p.email,
          phone: p.phone,
          representativeName: p.representativeName,
          representativeNif: p.representativeNif,
        },
        software: {
          productId: p.productId,
          productVersion: p.productVersion,
          signatureVersion: p.signatureVersion,
          softwareValidationNumber: p.softwareValidationNumber || null,
        },
        publicKeyFE: publicPem(key),
        publicKeyFingerprint: fingerprint(key),
        publicKeySAFT: p.legacyPrivateKeyFile
          ? publicPem(readKey(p.legacyPrivateKeyFile))
          : null,
        productionEnabled: false,
        notice:
          "Execute agt:dossier para preparar as minutas. Este JSON não é o formulário oficial Modelo 8 nem prova certificação.",
      });
    }),
  );
  r.post(
    "/partial-receipt-preview",
    wrap(async (req: any, res: any) => {
      const u = getUser(req),
        id = req.body.invoiceId;
      check(Number.isSafeInteger(id) && id > 0, "Seleccione um recibo.");
      const receipt = (
        await db.query(
          "SELECT * FROM public.faturas WHERE empresa_id=$1 AND id=$2 AND tipo_documento='recibo'",
          [u.empresaId, id],
        )
      ).rows[0];
      check(receipt, "Recibo inexistente nesta empresa.");
      const origin = (
        await db.query(
          "SELECT * FROM public.faturas WHERE empresa_id=$1 AND numero=$2",
          [u.empresaId, receipt.billing_meta?.documentoOrigem || ""],
        )
      ).rows[0];
      res.json(partialReceiptDiagnostic(receipt, origin));
    }),
  );
  r.post(
    "/saft",
    wrap(async (req: any, res: any) => {
      const u = getUser(req),
        cfg = await configuration(db, u);
      const rows = (
        await db.query(
          `SELECT f.*, EXISTS(SELECT 1 FROM public.nv_agt_replacements r
                 WHERE r.empresa_id=f.empresa_id AND r.original_id=f.id) AS agt_has_replacement
             FROM public.faturas f WHERE f.empresa_id=$1 ORDER BY f.id`,
          [u.empresaId],
        )
      ).rows;
      const result = exportSaft(
        rows,
        cfg.company,
        cfg.profile,
        producer(),
        req.body.startDate,
        req.body.endDate,
      );
      const run = spawnSync(
        process.env.AGT_XML_PYTHON || options().xmlPython || "python3",
        [resolve(projectRoot(), "scripts/agt/validate_xml.py")],
        {
          input: result.xml,
          encoding: "utf8",
          timeout: 20000,
          maxBuffer: 2_000_000,
        },
      );
      let report: any;
      try {
        report = JSON.parse(run.stdout || "{}");
      } catch {}
      check(
        run.status === 0 && report?.valid === true,
        "A exportação não passou na validação XSD. " +
          (report?.errors?.slice(0, 3).join(" ") ||
            "Instale lxml e execute agt:verificar."),
      );
      await event(db, u, "saft.export", null, {
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        count: result.count,
        xmlSha256: sha256(result.xml),
      });
      res.json({ ...result, validation: report });
    }),
  );
  return r;
}

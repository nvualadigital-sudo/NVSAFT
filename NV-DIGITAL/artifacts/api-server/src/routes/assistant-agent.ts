/** NV-ASSISTENTE: intents allowlisted; actions frozen in Postgres and confirmed per user/tenant. */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "pg";
import { pool as productionPool } from "@workspace/db";
import { getUser, requireEmpresa } from "../lib/auth.js";
import { apiErrors, deny, event, transaction, uuid, value } from "../lib/governance.js";

const MODULES = [
  { id: "chat", aliases: ["chat", "mensagens", "conversas"] },
  { id: "laboratorio", aliases: ["laboratório", "laboratorio", "exames", "resultados"] },
  { id: "enfermagem", aliases: ["enfermagem", "triagem"] },
  { id: "medico", aliases: ["médico", "medico", "medicina", "consultas"] },
  { id: "farmacia", aliases: ["farmácia", "farmacia", "medicamentos"] },
  { id: "faturacao", aliases: ["financeiro", "faturação", "facturação", "faturacao", "facturacao"] },
  { id: "medlink", aliases: ["medlink", "medlik", "parceiros"] },
  { id: "pacientes", aliases: ["pacientes", "recepção", "recepcao"] },
  { id: "config", aliases: ["configurações", "configuracoes"] },
] as const;

export type AgentCommand =
  | { kind: "navigate"; module: string; message: string }
  | { kind: "proposal"; tool: "chat.send_team"; text: string; message: string }
  | { kind: "help"; message: string }
  | null;

export function interpretAgentCommand(input: unknown): AgentCommand {
  if (typeof input !== "string" || !input.trim() || input.length > 4000) return null;
  const text = input.trim();
  const normal = text.toLocaleLowerCase("pt-PT").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const navigation = /^(?:abre|abrir|vai\s+(?:para|ao|a)|ir\s+(?:para|ao|a)|mostra|mostrar)\s+(?:o\s+|a\s+|modulo\s+(?:de\s+)?)?(.+?)[.!?]*$/.exec(normal);
  if (navigation) {
    const wanted = navigation[1].trim();
    const found = MODULES.find((m) => m.aliases.some((a) => a.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === wanted));
    if (found) return { kind: "navigate", module: found.id, message: `Vou abrir ${wanted}, se estiver disponível nas suas permissões.` };
  }
  const team = /^(?:enviar|envia|mandar|manda)\s+(?:uma\s+)?(?:mensagem|aviso)\s+(?:a|para)\s+(?:a\s+)?(?:equipa|equipe)\s*[:\-]\s*(.+)$/is.exec(normal);
  if (team) {
    // Preserve a escrita do utilizador em vez de a reconstruir a partir da versão normalizada.
    const colon = text.search(/[:\-]/);
    const body = text.slice(colon + 1).trim();
    if (colon >= 0 && body && body.length <= 2000)
      return { kind: "proposal", tool: "chat.send_team", text: body, message: "Vou preparar uma mensagem à equipa. Nada será enviado sem confirmação." };
  }
  if (/^(?:ajuda|comandos|o que podes fazer)[?!. ]*$/.test(normal))
    return { kind: "help", message: "Posso abrir módulos autorizados e preparar uma mensagem à equipa mediante confirmação. Para outras dúvidas, use a conversação com IA autorizada. Não assino, prescrevo, libero resultados nem emito facturas por comando de voz." };
  return null;
}

export function createAssistantAgentRouter(pool: Pool = productionPool) {
  const router = Router();
  router.use(requireEmpresa);
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

  router.get("/capabilities", (req, res) => {
    const u = getUser(req);
    res.json({
      company: u.empresaNome || "Instituição activa",
      text: true,
      commands: true,
      actions: ["chat.send_team"],
      voice: "browser_with_consent",
      wakeWord: "only_in_explicit_session",
      model: process.env.AI_ASSISTANT_ENABLED === "true" &&
        (!!process.env.OPENAI_API_KEY || !!(process.env.NEON_AI_GATEWAY_TOKEN && process.env.NEON_AI_GATEWAY_BASE_URL)),
      limitations: "Nenhuma operação fiscal, clínica ou crítica é autorizada pelo agente.",
    });
  });
  router.post("/commands", (req, res) => {
    const text = value(req.body?.message, 4000);
    const command = interpretAgentCommand(text);
    res.json(command || { kind: "unknown", message: "Posso ajudar a navegar ou preparar mensagens à equipa. Para uma resposta aberta, autorize a conversação com IA." });
  });

  router.post("/actions/prepare", async (req, res) => {
    const u = getUser(req);
    if (req.body?.tool !== "chat.send_team") return res.status(403).json({ error: "Esta operação não está disponível no assistente." });
    const body = value(req.body?.text, 2000);
    const id = randomUUID();
    const until = new Date(Date.now() + 2 * 60_000).toISOString();
    await transaction(pool, u.empresaId!, async (c) => {
      await c.query("INSERT INTO public.nv_ai_action_requests(id,empresa_id,actor,tool,payload,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
        [id, u.empresaId, u.username, "chat.send_team", JSON.stringify({ text: body }), until]);
      await event(c, u, "ai.action.prepared", id, { tool: "chat.send_team" });
    });
    return res.status(201).json({ actionId: id, status: "requires_confirmation", tool: "chat.send_team", summary: "Enviar mensagem à equipa da instituição", preview: body, expiresAt: until });
  });
  router.post("/actions/:id/confirm", async (req, res) => {
    const u = getUser(req), id = uuid(req.params.id);
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const action = (await c.query("SELECT * FROM public.nv_ai_action_requests WHERE id=$1 AND empresa_id=$2 AND actor=$3 FOR UPDATE", [id, u.empresaId, u.username])).rows[0];
      if (!action) return deny("Acção indisponível nesta sessão ou instituição.", 404);
      if (action.status === "completed") return { ok: true, repeated: true, messageId: action.result?.messageId };
      if (action.status !== "pending") return deny("A acção foi cancelada.", 409);
      if (new Date(action.expires_at).getTime() <= Date.now()) return deny("A confirmação expirou; prepare novamente.", 409);
      if (action.tool !== "chat.send_team" || typeof action.payload?.text !== "string") return deny("Acção inválida.");
      const text = value(action.payload.text, 2000);
      // Message ID and request_id ensure a repeated confirmation cannot duplicate an effect.
      const messageId = randomUUID();
      await c.query("INSERT INTO public.hospital_messages(id,empresa_id,sender,sender_name,recipient,body,request_id) VALUES($1,$2,$3,$4,NULL,$5,$6)",
        [messageId, u.empresaId, u.username, u.funcionarioNome || u.username, text, id]);
      // O texto definitivo encontra-se no canal institucional; não reter uma segunda cópia.
      await c.query("UPDATE public.nv_ai_action_requests SET status='completed',payload='{}'::jsonb,result=$4,finished_at=now() WHERE id=$1 AND empresa_id=$2 AND actor=$3", [id, u.empresaId, u.username, JSON.stringify({ messageId })]);
      await event(c, u, "ai.action.executed", id, { tool: "chat.send_team" });
      return { ok: true, repeated: false, messageId };
    });
    res.json(result);
  });
  router.post("/actions/:id/cancel", async (req, res) => {
    const u = getUser(req), id = uuid(req.params.id);
    const result = await transaction(pool, u.empresaId!, async (c) => {
      const action = (await c.query("SELECT status FROM public.nv_ai_action_requests WHERE id=$1 AND empresa_id=$2 AND actor=$3 FOR UPDATE", [id, u.empresaId, u.username])).rows[0];
      if (!action) return deny("Acção indisponível nesta sessão ou instituição.", 404);
      if (action.status === "completed") return deny("Esta acção já foi executada.", 409);
      if (action.status === "pending") {
        await c.query("UPDATE public.nv_ai_action_requests SET status='cancelled',payload='{}'::jsonb,finished_at=now() WHERE id=$1 AND empresa_id=$2 AND actor=$3", [id, u.empresaId, u.username]);
        await event(c, u, "ai.action.cancelled", id, { tool: "chat.send_team" });
      }
      return { ok: true, status: "cancelled" };
    });
    res.json(result);
  });
  router.use(apiErrors);
  return router;
}

export default createAssistantAgentRouter();

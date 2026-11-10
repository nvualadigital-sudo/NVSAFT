import { Router } from "express";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { pool as productionPool } from "@workspace/db";
import { SERVICE_DEFINITIONS } from "@workspace/api-zod";
import { getUser, requireEmpresa, type TokenPayload } from "../lib/auth.js";
import { apiErrors, deny, granted, transaction } from "../lib/governance.js";

type Item = {
  id: string;
  title: string;
  description: string;
  category: string;
  tab: string;
  priority: "alta" | "normal";
  at: string | null;
  requiresAction?: boolean;
  read?: boolean;
};
export function createNotifications(pool: Pool = productionPool) {
  const r = Router();
  r.use(requireEmpresa);
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  async function feed(u: TokenPayload, c: any = pool) {
    const items: Item[] = [],
      role = u.funcao || "",
      org = u.empresaId;
    const clinical = [
      "admin",
      "gestor",
      "medico",
      "tecnico",
      "enfermeiro",
    ].includes(role);
    const reception = ["admin", "gestor", "rececionista"].includes(role);
    const stock = ["admin", "gestor", "farmaceutico", "financeiro"].includes(
      role,
    );
    const add = (x: Item) => items.push(x);
    if (clinical || reception) {
      // No patient names, measurements or clinical values in the notifications feed.
      const results = (
        await c.query(
          "SELECT r.id,n.revision,n.emitted_at,coalesce(rel.id,manual.id) AS release_key,coalesce(rel.released_at,manual.released_at) AS released_at FROM public.resultados r JOIN public.nv_result_notification_versions n ON n.empresa_id=r.empresa_id AND n.result_id=r.id LEFT JOIN LATERAL (SELECT v.id,v.released_at FROM public.nv_lab_values v JOIN public.nv_lab_tests t ON t.id=v.test_id AND t.empresa_id=v.empresa_id JOIN public.nv_lab_orders o ON o.id=t.order_id AND o.empresa_id=t.empresa_id WHERE t.empresa_id=r.empresa_id AND t.result_id=r.id AND o.cancelled_at IS NULL AND v.released_at IS NOT NULL ORDER BY v.released_at DESC LIMIT 1) rel ON true LEFT JOIN LATERAL(SELECT mv.id,mv.released_at FROM public.nv_lab_report_versions mv WHERE mv.empresa_id=r.empresa_id AND mv.resultado_id=r.id ORDER BY mv.version DESC LIMIT 1) manual ON true WHERE r.empresa_id=$1 AND (manual.id IS NULL OR manual.released_at IS NOT NULL) AND r.data_emissao<>'' AND CASE WHEN jsonb_typeof(r.parametros)='array' THEN jsonb_array_length(r.parametros)>0 ELSE false END AND r.paciente_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.pacientes p WHERE p.empresa_id=r.empresa_id AND p.id=r.paciente_id) AND NOT EXISTS(SELECT 1 FROM public.nv_lab_tests t JOIN public.nv_lab_orders o ON o.id=t.order_id AND o.empresa_id=t.empresa_id WHERE t.empresa_id=r.empresa_id AND t.result_id=r.id AND o.cancelled_at IS NOT NULL) ORDER BY n.emitted_at DESC LIMIT 100",
          [org],
        )
      ).rows;
      for (const row of results) {
        // A later emitted version gets its own identity and becomes unread again.
        const version =
          String(row.revision) + ":" + (row.release_key || "emitted");
        add({
          id: `result:${row.id}:${version}`,
          title: row.released_at ? "Resultado pronto" : "Resultado emitido",
          description: `Registo n.º ${row.id} disponível para consulta autorizada.`,
          category: "resultados",
          tab: role === "medico" ? "medico" : "historico",
          priority: "normal",
          at: new Date(row.released_at || row.emitted_at).toISOString(),
        });
      }
    }
    if (clinical) {
      const critical = (
        await c.query(
          "SELECT v.id,v.created_at FROM public.nv_lab_values v JOIN public.nv_lab_tests t ON t.empresa_id=v.empresa_id AND t.id=v.test_id JOIN public.nv_lab_orders o ON o.empresa_id=t.empresa_id AND o.id=t.order_id WHERE v.empresa_id=$1 AND v.critical AND o.cancelled_at IS NULL AND v.version=(SELECT max(x.version) FROM public.nv_lab_values x WHERE x.empresa_id=v.empresa_id AND x.test_id=v.test_id) AND NOT EXISTS(SELECT 1 FROM public.nv_lab_communications cm WHERE cm.empresa_id=v.empresa_id AND cm.value_id=v.id AND cm.acknowledged) ORDER BY v.created_at DESC LIMIT 40",
          [org],
        )
      ).rows;
      for (const row of critical)
        add({
          id: "critical:" + row.id,
          title: "Resultado crítico por comunicar",
          description:
            "Há uma comunicação clínica ainda sem confirmação no laboratório.",
          category: "criticos",
          tab: "laboratorio",
          priority: "alta",
          at: new Date(row.created_at).toISOString(),
          requiresAction: true,
        });
    }
    if (["admin", "gestor", "tecnico"].includes(role)) {
      const orders = (
        await c.query(
          "SELECT id,accession,priority,created_at FROM public.nv_lab_orders WHERE empresa_id=$1 AND cancelled_at IS NULL AND created_at>now()-interval '7 days' AND EXISTS(SELECT 1 FROM public.nv_lab_tests t WHERE t.empresa_id=nv_lab_orders.empresa_id AND t.order_id=nv_lab_orders.id AND NOT EXISTS(SELECT 1 FROM public.nv_lab_values v WHERE v.empresa_id=t.empresa_id AND v.test_id=t.id AND v.released_at IS NOT NULL)) ORDER BY created_at DESC LIMIT 30",
          [org],
        )
      ).rows;
      for (const row of orders)
        add({
          id: "order:" + row.id,
          title: "Pedido laboratorial pendente",
          description: "Pedido " + row.accession + " aguarda conclusão.",
          category: "pedidos",
          tab: "laboratorio",
          priority: row.priority === "rotina" ? "normal" : "alta",
          at: new Date(row.created_at).toISOString(),
          requiresAction: true,
        });
    }
    const cases = (
      await c.query(
        "SELECT id,kind,reference,revision,updated_at FROM public.nv_cases WHERE empresa_id=$1 AND assigned_to=$2 AND status IN ('aberto','em_curso') ORDER BY updated_at DESC LIMIT 40",
        [org, u.username],
      )
    ).rows;
    for (const row of cases) {
      const spec = SERVICE_DEFINITIONS[row.kind];
      if (spec?.permission) {
        try {
          await granted(c, u, spec.permission);
        } catch {
          continue;
        }
      }
      add({
        id: `task:${row.id}:${row.revision}`,
        title: "Tarefa atribuída",
        description: `${spec?.label || row.kind} · ${row.reference}`,
        category: "tarefas",
        tab: "servicos",
        priority: "normal",
        at: new Date(row.updated_at).toISOString(),
        requiresAction: true,
      });
    }
    if (stock) {
      const products = (
        await c.query(
          "SELECT id,code,name,stock,minimum,expiry FROM public.hospital_pharmacy WHERE empresa_id=$1 AND active AND (stock<=minimum OR (stock>0 AND expiry<=current_date+30)) ORDER BY expiry LIMIT 40",
          [org],
        )
      ).rows;
      for (const row of products) {
        const low = Number(row.stock) <= Number(row.minimum),
          expired = new Date(row.expiry).getTime() < Date.now() - 86400000;
        const version = createHash("sha256")
          .update(
            JSON.stringify([
              row.stock,
              row.minimum,
              String(row.expiry),
              expired,
            ]),
          )
          .digest("hex")
          .slice(0, 16);
        add({
          id: `stock:${row.id}:${version}`,
          title:
            expired && Number(row.stock) > 0
              ? "Lote fora de validade"
              : low
                ? "Stock no mínimo"
                : "Validade próxima",
          description: `${row.name} · ${row.code}. Consulte a farmácia.`,
          category: "stock",
          tab: "farmacia",
          priority: expired ? "alta" : "normal",
          at: null,
          requiresAction: true,
        });
      }
    }
    const chats = (
      await c.query(
        `WITH visible AS(SELECT m.id,m.created_at,CASE WHEN m.group_id IS NOT NULL THEN 'g:'||m.group_id::text WHEN m.recipient IS NULL THEN 'team' ELSE 'd:'||m.sender END AS key FROM public.hospital_messages m WHERE m.empresa_id=$1 AND m.sender<>$2 AND m.deleted_at IS NULL AND m.created_at>now()-interval '30 days' AND ((m.group_id IS NULL AND (m.recipient IS NULL OR m.recipient=$2)) OR EXISTS(SELECT 1 FROM public.nv_chat_groups g WHERE g.empresa_id=m.empresa_id AND g.id=m.group_id AND g.members ? $2))) SELECT v.id,v.created_at FROM visible v LEFT JOIN public.hospital_read_receipts rr ON rr.empresa_id=$1 AND rr.actor=$2 AND rr.conversation=v.key LEFT JOIN public.nv_chat_preferences p ON p.empresa_id=$1 AND p.actor=$2 AND p.conversation=v.key WHERE v.created_at>coalesce(rr.read_at,'epoch') AND v.created_at>coalesce((p.data->>'cutoff')::timestamptz,'epoch') AND coalesce(p.data->>'blocked','false')<>'true' ORDER BY v.created_at DESC LIMIT 30`,
        [org, u.username],
      )
    ).rows;
    for (const row of chats)
      add({
        id: "chat:" + row.id,
        title: "Mensagem por ler",
        description: "Há uma mensagem na comunicação interna.",
        category: "mensagens",
        tab: "chat",
        priority: "normal",
        at: new Date(row.created_at).toISOString(),
      });
    const calls = (
      await c.query(
        "SELECT id,ended_at,created_at FROM public.nv_chat_calls WHERE empresa_id=$1 AND callee=$2 AND status='missed' AND created_at>now()-interval '7 days' ORDER BY created_at DESC LIMIT 20",
        [org, u.username],
      )
    ).rows;
    for (const row of calls)
      add({
        id: "call:" + row.id,
        title: "Chamada não atendida",
        description: "Consulte o histórico de chamadas.",
        category: "chamadas",
        tab: "chat",
        priority: "normal",
        at: new Date(row.ended_at || row.created_at).toISOString(),
      });
    const reads = (
      await c.query(
        "SELECT notification_id FROM public.nv_notification_reads WHERE empresa_id=$1 AND actor=$2 AND notification_id=ANY($3::text[])",
        [org, u.username, items.map((i) => i.id)],
      )
    ).rows;
    const read = new Set(reads.map((x: any) => x.notification_id));
    return items
      .map((i) => ({ ...i, read: read.has(i.id) }))
      .sort(
        (a, b) =>
          Number(b.priority === "alta") - Number(a.priority === "alta") ||
          Number(a.read) - Number(b.read) ||
          String(b.at || "").localeCompare(String(a.at || "")),
      );
  }
  r.get("/", async (req, res) => {
    const items = await feed(getUser(req));
    res.json({
      items,
      unread: items.filter((x) => !x.read).length,
      updatedAt: new Date().toISOString(),
    });
  });
  r.post("/read", async (req, res) => {
    const u = getUser(req),
      ids = req.body.ids;
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 300 ||
      ids.some((x) => typeof x !== "string" || x.length > 200)
    )
      deny("Seleccione notificações válidas.");
    await transaction(pool, u.empresaId!, async (c) => {
      const available = new Set((await feed(u, c)).map((x) => x.id));
      if (ids.some((x: string) => !available.has(x)))
        deny("Notificação indisponível para este utilizador.", 403);
      await c.query(
        "INSERT INTO public.nv_notification_reads(empresa_id,actor,notification_id) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
        [u.empresaId, u.username, ids],
      );
    });
    res.json({ ok: true });
  });
  r.use(apiErrors);
  return r;
}
export default createNotifications();

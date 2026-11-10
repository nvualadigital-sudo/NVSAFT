/**
 * GET  /api/sync/events  — SSE stream for live change notifications
 * GET  /api/sync/status  — lightweight connectivity probe
 * POST /api/sync/push    — replay a batch of offline-queued mutations
 */
import { Router } from "express";
import { requireEmpresa, getUser } from "../lib/auth.js";
import {
  addSseClient,
  removeSseClient,
  countSseClients,
  broadcast,
} from "../lib/sync.js";

const router = Router();

// ── SSE stream ────────────────────────────────────────────────────────────────
router.get("/sync/events", requireEmpresa, (req, res): void => {
  const user = getUser(req);
  const empresaId = user?.empresaId;
  if (!empresaId) {
    res.status(403).json({ error: "empresaId ausente" });
    return;
  }

  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Initial handshake event
  res.write(
    `event: connected\ndata: ${JSON.stringify({ clientId, ts: Date.now() })}\n\n`,
  );

  addSseClient(clientId, empresaId, res);

  // Keep-alive ping every 25 s (Replit proxy times out idle connections at 30 s)
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(clientId);
  });
});

// ── Connectivity probe ────────────────────────────────────────────────────────
router.get("/sync/status", requireEmpresa, (req, res): void => {
  const user = getUser(req);
  const empresaId = user?.empresaId ?? "";
  res.json({
    ok: true,
    ts: Date.now(),
    liveClients: countSseClients(empresaId),
  });
});

// ── Batch push (replay offline queue) ────────────────────────────────────────
//
// Body: { ops: Array<{ method, path, body }> }
// The server executes each op against its own routes, then broadcasts a
// "change" event so other LAN clients update.
//
// For simplicity we do a lightweight "trust and replay" approach — the ops
// were already validated on the frontend and are now being committed.
router.post("/sync/push", requireEmpresa, (_req, res) => {
  res
    .status(409)
    .json({
      error:
        "As operações antigas sem identificação institucional não são reenviadas automaticamente.",
    });
});

export { broadcast };
export default router;

/**
 * SSE (Server-Sent Events) registry for LAN-wide live sync.
 *
 * When any authenticated client performs a mutation (POST/PUT/DELETE),
 * the broadcast() function pushes a lightweight "change" event to every
 * other SSE client in the same empresa, so their UIs refresh automatically.
 */
import type { Response } from "express";

interface SseClient {
  id: string;
  empresaId: string;
  res: Response;
}

const clients: SseClient[] = [];

/** Register a new SSE connection. */
export function addSseClient(
  id: string,
  empresaId: string,
  res: Response,
): void {
  clients.push({ id, empresaId, res });
}

/** Remove a closed SSE connection. */
export function removeSseClient(id: string): void {
  const idx = clients.findIndex((c) => c.id === id);
  if (idx !== -1) clients.splice(idx, 1);
}

/** How many live SSE connections exist for an empresa. */
export function countSseClients(empresaId: string): number {
  return clients.filter((c) => c.empresaId === empresaId).length;
}

/**
 * Broadcast a named SSE event to all connected clients for the given empresa.
 * Silently removes any clients whose connection has already dropped.
 */
export function broadcast(
  empresaId: string,
  eventName: string,
  data: unknown = {},
): void {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead: string[] = [];

  for (const client of clients) {
    if (client.empresaId !== empresaId) continue;
    try {
      client.res.write(payload);
    } catch {
      dead.push(client.id);
    }
  }

  for (const id of dead) removeSseClient(id);
}

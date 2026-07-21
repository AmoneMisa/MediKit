import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { verifyToken } from './auth.js';
import { q } from './db.js';

// Map of userId → set of live sockets (a user may have several devices).
const sockets = new Map<string, Set<WebSocket>>();

function add(userId: string, ws: WebSocket): void {
  let set = sockets.get(userId);
  if (!set) { set = new Set(); sockets.set(userId, set); }
  set.add(ws);
}

function remove(userId: string, ws: WebSocket): void {
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) sockets.delete(userId);
}

async function memberIdsOf(kitId: string): Promise<string[]> {
  const rows = await q<{ user_id: string }>('SELECT user_id FROM kit_members WHERE kit_id = $1', [kitId]);
  return rows.map(r => r.user_id);
}

function sendTo(userId: string, payload: unknown): void {
  const set = sockets.get(userId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

/**
 * Broadcast an event to every member of a kit (optionally excluding one user).
 * Fire-and-forget: callers don't need to await delivery.
 */
export function broadcastToKit(kitId: string, event: unknown, exceptUserId?: string): void {
  void memberIdsOf(kitId).then(ids => {
    for (const uid of ids) {
      if (uid === exceptUserId) continue;
      sendTo(uid, event);
    }
  }).catch(() => { /* best-effort delivery */ });
}

/** Push an event straight to one user (e.g. a new invite/notification). */
export function pushToUser(userId: string, event: unknown): void {
  sendTo(userId, event);
}

export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const t = url.searchParams.get('token') ?? '';
    const userId = t ? verifyToken(t) : null;
    if (!userId) { ws.close(4001, 'unauthorized'); return; }

    add(userId, ws);
    ws.send(JSON.stringify({ type: 'connected' }));

    ws.on('close', () => remove(userId, ws));
    ws.on('error', () => remove(userId, ws));
    // Heartbeat so clients can keep the connection alive.
    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      } catch { /* ignore malformed frames */ }
    });
  });
}

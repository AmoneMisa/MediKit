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

  wss.on('connection', (ws) => {
    // Auth is sent as the first message frame — token never appears in URL / logs.
    let userId: string | null = null;
    const authDeadline = setTimeout(() => {
      if (!userId) ws.close(4001, 'unauthorized');
    }, 5_000); // must authenticate within 5 s

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString());

        if (!userId) {
          // Expecting { type: 'auth', token: '...' } as the first frame
          if (msg?.type === 'auth' && msg.token) {
            clearTimeout(authDeadline);
            const verified = verifyToken(msg.token);
            if (!verified) { ws.close(4001, 'unauthorized'); return; }
            userId = verified.userId;
            add(userId, ws);
            ws.send(JSON.stringify({ type: 'connected' }));
          } else {
            ws.close(4001, 'unauthorized');
          }
          return;
        }

        if (msg?.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      } catch { /* ignore malformed frames */ }
    });

    ws.on('close', () => { if (userId) remove(userId, ws); clearTimeout(authDeadline); });
    ws.on('error', () => { if (userId) remove(userId, ws); });
  });
}

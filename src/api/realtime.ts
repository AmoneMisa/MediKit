import { getToken } from './client';
import { wsUrl } from './config';

export type RealtimeEvent =
  | { type: 'connected' }
  | { type: 'pong' }
  | { type: 'kit_updated'; kitId: string; kit: unknown }
  | { type: 'kit_deleted'; kitId: string }
  | { type: 'members_changed'; kitId: string; kit: unknown }
  | { type: 'medicine_upserted'; kitId: string; medicine: unknown }
  | { type: 'medicine_deleted'; kitId: string; medicineId: string }
  | { type: 'activity'; kitId: string; event: unknown }
  | { type: 'notification'; notification: unknown };

type Listener = (event: RealtimeEvent) => void;

/**
 * Lightweight WebSocket client for live kit/notification updates.
 * Auto-reconnects with backoff; no-ops gracefully when the backend is offline.
 */
class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectDelay = 1000;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;

  connect(): void {
    const token = getToken();
    if (!token || this.ws) return;
    this.closedByUser = false;
    try {
      this.ws = new WebSocket(wsUrl(token));
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.pingTimer = setInterval(() => {
        try { this.ws?.send(JSON.stringify({ type: 'ping' })); } catch {}
      }, 25000);
    };
    this.ws.onmessage = e => {
      try {
        const event = JSON.parse(String(e.data)) as RealtimeEvent;
        this.listeners.forEach(l => l(event));
      } catch {}
    };
    this.ws.onerror = () => { this.ws?.close(); };
    this.ws.onclose = () => {
      this.cleanup();
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  private cleanup(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    this.ws = null;
  }

  private scheduleReconnect(): void {
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  disconnect(): void {
    this.closedByUser = true;
    try { this.ws?.close(); } catch {}
    this.cleanup();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const realtime = new RealtimeClient();

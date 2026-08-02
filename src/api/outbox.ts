import { LazyMMKV } from '../utils/createSecureMMKV';

// Try-require NetInfo so the module works even if the package isn't linked yet.
let NetInfo: any = null;
try { NetInfo = require('@react-native-community/netinfo').default; } catch {}
import {
  createKit, updateKit as apiUpdateKit, deleteKit as apiDeleteKit,
  upsertKitMedicine, deleteKitMedicine,
  markNotificationRead as apiMarkRead, markAllNotificationsRead as apiMarkAllRead,
  deleteNotification as apiDeleteNotif,
  upsertDoctor as apiUpsertDoctor, patchDoctor as apiPatchDoctor,
  deleteDoctor as apiDeleteDoctor,
  upsertAppointment as apiUpsertAppointment, patchAppointment as apiPatchAppointment,
  deleteAppointment as apiDeleteAppointment,
} from './social';
import type { MedicineKit, Medicine, Doctor, DoctorAppointment } from '../types';

// The outbox lets the local-first store fire backend pushes without importing it
// directly (store → outbox → social/realtime), keeping the dependency graph acyclic.
// Operations are persisted to MMKV so they survive app restarts when offline.
// drainQueue() is called by sync.ts after auth is established.

const outboxMmkv = new LazyMMKV('medikit-outbox');
const OPS_KEY = 'pending';

// ─── Op types ────────────────────────────────────────────────────────────────

type OutboxOp =
  | { id: string; type: 'kitCreate';       kit: Parameters<typeof createKit>[0] }
  | { id: string; type: 'kitUpdate';       kitId: string; changes: Partial<MedicineKit> }
  | { id: string; type: 'kitDelete';       kitId: string }
  | { id: string; type: 'medicineUpsert';  kitId: string; medicine: Medicine }
  | { id: string; type: 'medicineDelete';  kitId: string; medicineId: string }
  | { id: string; type: 'notifRead';       notifId: string }
  | { id: string; type: 'notifReadAll' }
  | { id: string; type: 'notifDismiss';    notifId: string }
  | { id: string; type: 'doctorUpsert';    doctor: Doctor }
  | { id: string; type: 'doctorPatch';     doctorId: string; changes: Partial<Doctor> }
  | { id: string; type: 'doctorDelete';    doctorId: string }
  | { id: string; type: 'apptUpsert';      appt: DoctorAppointment }
  | { id: string; type: 'apptPatch';       apptId: string; changes: Partial<DoctorAppointment> }
  | { id: string; type: 'apptDelete';      apptId: string };

// ─── In-memory queue (loaded from MMKV on first access) ──────────────────────

let queue: OutboxOp[] = [];
let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    const stored = outboxMmkv.getString(OPS_KEY);
    if (stored) queue = JSON.parse(stored);
  } catch { queue = []; }
}

function persist(): void {
  try { outboxMmkv.set(OPS_KEY, JSON.stringify(queue)); } catch {}
}

function enqueue(op: OutboxOp): void {
  ensureLoaded();
  // Collapse duplicate ops to keep the queue lean:
  // - For upserts: replace existing op for same entity
  // - For deletes: drop all prior ops for same entity, then enqueue delete
  switch (op.type) {
    case 'kitCreate':
    case 'kitUpdate': {
      const idx = queue.findIndex(o => (o.type === 'kitCreate' || o.type === 'kitUpdate') && (o as any).kitId === (op as any).kitId);
      if (idx >= 0) { queue[idx] = op; } else { queue.push(op); }
      break;
    }
    case 'medicineUpsert': {
      const idx = queue.findIndex(o => o.type === 'medicineUpsert' && (o as any).medicine.id === (op as any).medicine.id);
      if (idx >= 0) { queue[idx] = op; } else { queue.push(op); }
      break;
    }
    case 'doctorUpsert':
    case 'doctorPatch': {
      const idx = queue.findIndex(o => (o.type === 'doctorUpsert' || o.type === 'doctorPatch') && (o as any).doctorId === (op as any).doctorId);
      if (idx >= 0) { queue[idx] = op; } else { queue.push(op); }
      break;
    }
    case 'apptUpsert':
    case 'apptPatch': {
      const apptId = op.type === 'apptUpsert' ? op.appt.id : op.apptId;
      const idx = queue.findIndex(o => (o.type === 'apptUpsert' || o.type === 'apptPatch') && ((o as any).appt?.id ?? (o as any).apptId) === apptId);
      if (idx >= 0) { queue[idx] = op; } else { queue.push(op); }
      break;
    }
    default:
      queue.push(op);
  }
  persist();
}

function dequeue(opId: string): void {
  const idx = queue.findIndex(o => o.id === opId);
  if (idx >= 0) { queue.splice(idx, 1); persist(); }
}

function opId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

// ─── Execute a single op ──────────────────────────────────────────────────────

async function executeOp(op: OutboxOp): Promise<void> {
  switch (op.type) {
    case 'kitCreate':      await createKit(op.kit); break;
    case 'kitUpdate':      await apiUpdateKit(op.kitId, op.changes); break;
    case 'kitDelete':      await apiDeleteKit(op.kitId); break;
    case 'medicineUpsert': await upsertKitMedicine(op.kitId, op.medicine); break;
    case 'medicineDelete': await deleteKitMedicine(op.kitId, op.medicineId); break;
    case 'notifRead':      await apiMarkRead(op.notifId); break;
    case 'notifReadAll':   await apiMarkAllRead(); break;
    case 'notifDismiss':   await apiDeleteNotif(op.notifId); break;
    case 'doctorUpsert':   await apiUpsertDoctor(op.doctor); break;
    case 'doctorPatch':    await apiPatchDoctor(op.doctorId, op.changes); break;
    case 'doctorDelete':   await apiDeleteDoctor(op.doctorId); break;
    case 'apptUpsert':     await apiUpsertAppointment(op.appt); break;
    case 'apptPatch':      await apiPatchAppointment(op.apptId, op.changes); break;
    case 'apptDelete':     await apiDeleteAppointment(op.apptId); break;
  }
}

// ─── Sync gate ────────────────────────────────────────────────────────────────

let enabled = false;
let netInfoSubscribed = false;

/**
 * Subscribe to network-reconnect events exactly once.
 * When the device goes online while sync is active, drain any queued ops
 * immediately rather than waiting for the next app launch.
 */
function subscribeNetworkDrain(): void {
  if (netInfoSubscribed || !NetInfo) return;
  netInfoSubscribed = true;
  NetInfo.addEventListener((state: any) => {
    if (state.isConnected && state.isInternetReachable && enabled) {
      drainQueue().catch(() => {});
    }
  });
}

export function setSyncEnabled(value: boolean): void {
  enabled = value;
  if (value) subscribeNetworkDrain();
}
export function isSyncEnabled(): boolean { return enabled; }

/** Drain all persisted ops. Called by sync.ts after auth is established. */
export async function drainQueue(): Promise<void> {
  ensureLoaded();
  // snapshot to avoid mutation issues during iteration
  const ops = [...queue];
  for (const op of ops) {
    try {
      await executeOp(op);
      dequeue(op.id);
    } catch {
      // Leave in queue — will retry next launch
    }
  }
}

/** Fire an op: persist it, then attempt immediate send. */
function fire(op: OutboxOp): void {
  enqueue(op);
  if (!enabled) return;
  executeOp(op)
    .then(() => dequeue(op.id))
    .catch(() => { /* will retry via drainQueue() */ });
}

// ─── Strip device-local fields before sending an appointment to the server ────

function sanitizeAppointment<T extends Partial<DoctorAppointment>>(appt: T): Omit<T, 'calendarEventId'> {
  const { calendarEventId: _cal, ...rest } = appt as any;
  // Strip fileUri/mimeType from analyses — files live on-device ("Viber logic")
  if (rest.analyses) {
    rest.analyses = (rest.analyses as DoctorAppointment['analyses']).map(
      ({ fileUri: _f, mimeType: _m, ...meta }) => meta,
    );
  }
  return rest;
}

// ─── Public push helpers ──────────────────────────────────────────────────────

export function pushKitCreate(kit: MedicineKit): void {
  fire({ id: opId(), type: 'kitCreate', kit: {
    id: kit.id, name: kit.name, description: kit.description, icon: kit.icon,
    colorTag: kit.colorTag, isPrivate: kit.isPrivate,
    createdAt: kit.createdAt, updatedAt: kit.updatedAt,
  }});
}

export function pushKitUpdate(kitId: string, changes: Partial<MedicineKit>): void {
  fire({ id: opId(), type: 'kitUpdate', kitId, changes });
}

export function pushKitDelete(kitId: string): void {
  fire({ id: opId(), type: 'kitDelete', kitId });
}

export function pushMedicineUpsert(_kitId: string, medicine: Medicine): void {
  fire({ id: opId(), type: 'medicineUpsert', kitId: medicine.kitId, medicine });
}

export function pushMedicineDelete(kitId: string, medicineId: string): void {
  fire({ id: opId(), type: 'medicineDelete', kitId, medicineId });
}

export function pushNotificationRead(notifId: string): void {
  fire({ id: opId(), type: 'notifRead', notifId });
}

export function pushAllNotificationsRead(): void {
  fire({ id: opId(), type: 'notifReadAll' });
}

export function pushNotificationDismiss(notifId: string): void {
  fire({ id: opId(), type: 'notifDismiss', notifId });
}

export function pushDoctorUpsert(doctor: Doctor): void {
  fire({ id: opId(), type: 'doctorUpsert', doctor });
}

export function pushDoctorPatch(doctorId: string, changes: Partial<Doctor>): void {
  fire({ id: opId(), type: 'doctorPatch', doctorId, changes });
}

export function pushDoctorDelete(doctorId: string): void {
  fire({ id: opId(), type: 'doctorDelete', doctorId });
}

export function pushAppointmentUpsert(appt: DoctorAppointment): void {
  fire({ id: opId(), type: 'apptUpsert', appt: sanitizeAppointment(appt) as DoctorAppointment });
}

export function pushAppointmentPatch(apptId: string, changes: Partial<DoctorAppointment>): void {
  fire({ id: opId(), type: 'apptPatch', apptId, changes: sanitizeAppointment(changes) as Partial<DoctorAppointment> });
}

export function pushAppointmentDelete(apptId: string): void {
  fire({ id: opId(), type: 'apptDelete', apptId });
}

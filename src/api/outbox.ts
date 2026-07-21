import {
  createKit, updateKit as apiUpdateKit, deleteKit as apiDeleteKit,
  upsertKitMedicine, deleteKitMedicine,
  markNotificationRead as apiMarkRead, markAllNotificationsRead as apiMarkAllRead,
  deleteNotification as apiDeleteNotif,
} from './social';
import type { MedicineKit, Medicine } from '../types';

// The outbox lets the local-first store fire backend pushes without importing it
// directly (store → outbox → social/realtime), keeping the dependency graph acyclic.
// Every push is best-effort: failures (offline, auth) are swallowed so the UI never
// blocks on the network. When sync is disabled the app behaves as pure local-first.

let enabled = false;

export function setSyncEnabled(value: boolean): void { enabled = value; }
export function isSyncEnabled(): boolean { return enabled; }

function fire(p: Promise<unknown>): void { p.catch(() => { /* best-effort */ }); }

export function pushKitCreate(kit: MedicineKit): void {
  if (!enabled) return;
  fire(createKit({
    id: kit.id, name: kit.name, description: kit.description, icon: kit.icon,
    colorTag: kit.colorTag, isPrivate: kit.isPrivate,
    createdAt: kit.createdAt, updatedAt: kit.updatedAt,
  }));
}

export function pushKitUpdate(kitId: string, changes: Partial<MedicineKit>): void {
  if (!enabled) return;
  // Server ignores non-meta fields (members etc.), so passing raw changes is safe.
  fire(apiUpdateKit(kitId, changes));
}

export function pushKitDelete(kitId: string): void {
  if (!enabled) return;
  fire(apiDeleteKit(kitId));
}

export function pushMedicineUpsert(_kitId: string, medicine: Medicine): void {
  if (!enabled) return;
  fire(upsertKitMedicine(medicine.kitId, medicine));
}

export function pushMedicineDelete(kitId: string, medicineId: string): void {
  if (!enabled) return;
  fire(deleteKitMedicine(kitId, medicineId));
}

export function pushNotificationRead(notifId: string): void {
  if (!enabled) return;
  fire(apiMarkRead(notifId));
}

export function pushAllNotificationsRead(): void {
  if (!enabled) return;
  fire(apiMarkAllRead());
}

export function pushNotificationDismiss(notifId: string): void {
  if (!enabled) return;
  fire(apiDeleteNotif(notifId));
}

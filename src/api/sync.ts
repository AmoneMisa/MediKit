import { ensureAuth, type ApiUser } from './client';
import {
  listKits, listKitMedicines, listNotifications, listContacts,
  createKit, upsertKitMedicine, type ApiContact,
} from './social';
import { realtime, type RealtimeEvent } from './realtime';
import { setSyncEnabled } from './outbox';
import { useAppStore } from '../store';
import type { MedicineKit, Medicine, AppNotification, Person } from '../types';

// Sync orchestration: provisions the device account, migrates local-first data up
// to the server, pulls the authoritative state, and then keeps the store live via
// WebSocket events. Every step tolerates being offline — on failure we simply stay
// local-first and can retry on the next launch.

let started = false;
let unsubscribe: (() => void) | null = null;

// Use the contact row id (not the user id) so PersonsScreen can delete by it.
export function contactToPerson(c: ApiContact): Person {
  return {
    id: c.contactId,
    name: c.name,
    surname: c.surname,
    nickname: c.nickname,
    avatarInitials: c.avatarInitials,
    sharedKitIds: [],
    createdAt: c.createdAt,
  };
}

/** Push kits (and their medicines) that this device owns but the server hasn't seen. */
async function pushLocal(kits: MedicineKit[], medicines: Medicine[], mineIds: Set<string>): Promise<void> {
  for (const kit of kits) {
    if (!mineIds.has(kit.ownerId)) continue; // never claim someone else's shared kit
    try {
      await createKit({
        id: kit.id, name: kit.name, description: kit.description, icon: kit.icon,
        colorTag: kit.colorTag, isPrivate: kit.isPrivate,
        createdAt: kit.createdAt, updatedAt: kit.updatedAt,
      });
    } catch { continue; } // kit push failed → skip its medicines too
    for (const med of medicines.filter(m => m.kitId === kit.id)) {
      try { await upsertKitMedicine(kit.id, med); } catch { /* best-effort */ }
    }
  }
}

/** Pull authoritative kits/medicines/notifications/contacts and replace local slices. */
async function pullAll(): Promise<void> {
  const kits = await listKits(); // throws when offline → caller keeps local data
  const medicines: Medicine[] = [];
  for (const k of kits) {
    try { medicines.push(...await listKitMedicines(k.id)); } catch { /* skip kit */ }
  }
  const [notifications, persons] = await Promise.all([
    listNotifications().catch(() => undefined),
    listContacts().then(cs => cs.map(contactToPerson)).catch(() => undefined),
  ]);
  useAppStore.getState().hydrate({ kits, medicines, notifications, persons });
}

function applyEvent(ev: RealtimeEvent): void {
  const s = useAppStore.getState();
  switch (ev.type) {
    case 'kit_updated':
    case 'members_changed':
      s.mergeKit(ev.kit as MedicineKit);
      break;
    case 'kit_deleted':
      s.removeKitLocal(ev.kitId);
      break;
    case 'medicine_upserted':
      s.mergeMedicine(ev.medicine as Medicine);
      break;
    case 'medicine_deleted':
      s.removeMedicineLocal(ev.medicineId);
      break;
    case 'notification':
      s.addNotificationLocal(ev.notification as AppNotification);
      break;
    default:
      break; // connected / pong / activity handled elsewhere
  }
}

function connectRealtime(): void {
  unsubscribe?.();
  unsubscribe = realtime.subscribe(applyEvent);
  realtime.connect();
}

/** Bootstrap sync once per app session. Safe to call on every launch. */
export async function startSync(): Promise<void> {
  if (started) return;
  started = true;

  const store = useAppStore.getState();
  const localUserId = store.user.id; // pre-account id owning all local kits

  let apiUser: ApiUser;
  try {
    apiUser = await ensureAuth(store.user.nickname, store.user.name);
  } catch {
    started = false; // allow a later retry
    return;
  }

  // Adopt the server identity so local ownership lines up with the account.
  store.updateUser({
    id: apiUser.id, nickname: apiUser.nickname, name: apiUser.name,
    surname: apiUser.surname, email: apiUser.email, avatarInitials: apiUser.avatarInitials,
    googleLinked: apiUser.googleLinked,
  });

  setSyncEnabled(true);

  // Kits owned either under the old local id (first migration) or the new server id.
  const mineIds = new Set([localUserId, apiUser.id]);
  await pushLocal(store.kits, store.medicines, mineIds);

  try {
    await pullAll();
  } catch { /* offline → keep local-first data, retry next launch */ }

  connectRealtime();
}

/** Tear down realtime + disable pushes (e.g. on sign-out). */
export function stopSync(): void {
  setSyncEnabled(false);
  unsubscribe?.();
  unsubscribe = null;
  realtime.disconnect();
  started = false;
}

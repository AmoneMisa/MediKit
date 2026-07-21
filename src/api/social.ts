import { request, type ApiUser } from './client';
import type {
  MedicineKit, KitMember, KitActivityEvent, AppNotification, KitAccessRole, MedicinePrefill,
  Medicine,
} from '../types';

export type { ApiUser };

// ─── Users & contacts ────────────────────────────────────────────────────────

export interface ProfileUpdate {
  nickname?: string; name?: string; surname?: string; email?: string; avatarInitials?: string;
}

export function updateMe(changes: ProfileUpdate) {
  return request<{ user: ApiUser }>('/auth/me', { method: 'PATCH', body: changes }).then(r => r.user);
}

export function searchUsers(q: string) {
  return request<{ users: ApiUser[] }>(`/users/search?q=${encodeURIComponent(q)}`)
    .then(r => r.users);
}

export interface ApiContact extends ApiUser { contactId: string; }

export function listContacts() {
  return request<{ contacts: ApiContact[] }>('/users/contacts').then(r => r.contacts);
}

export function addContact(nickname: string) {
  return request<{ contact: ApiContact }>('/users/contacts', { method: 'POST', body: { nickname } })
    .then(r => r.contact);
}

export function removeContact(contactId: string) {
  return request<{ ok: true }>(`/users/contacts/${contactId}`, { method: 'DELETE' });
}

// ─── Kits & members ──────────────────────────────────────────────────────────

export function listKits() {
  return request<{ kits: MedicineKit[] }>('/kits').then(r => r.kits);
}

export function getKit(kitId: string) {
  return request<{ kit: MedicineKit }>(`/kits/${kitId}`).then(r => r.kit);
}

export function createKit(input: {
  id?: string; name: string; description?: string; icon?: string; colorTag?: string;
  isPrivate?: boolean; createdAt?: string; updatedAt?: string;
}) {
  return request<{ kit: MedicineKit }>('/kits', { method: 'POST', body: input }).then(r => r.kit);
}

export function updateKit(kitId: string, changes: Partial<MedicineKit>) {
  return request<{ kit: MedicineKit }>(`/kits/${kitId}`, { method: 'PATCH', body: changes }).then(r => r.kit);
}

export function deleteKit(kitId: string) {
  return request<{ ok: true }>(`/kits/${kitId}`, { method: 'DELETE' });
}

export function setMemberRole(kitId: string, userId: string, role: Exclude<KitAccessRole, 'owner'>) {
  return request<{ kit: MedicineKit }>(`/kits/${kitId}/members/${userId}`, {
    method: 'PATCH', body: { role },
  }).then(r => r.kit);
}

export function removeMember(kitId: string, userId: string) {
  return request<{ kit: MedicineKit }>(`/kits/${kitId}/members/${userId}`, { method: 'DELETE' }).then(r => r.kit);
}

export function leaveKit(kitId: string, myUserId: string) {
  return removeMember(kitId, myUserId);
}

// ─── Medicines inside a shared kit (synced across members) ─────────────────────

export function listKitMedicines(kitId: string) {
  return request<{ medicines: Medicine[] }>(`/kits/${kitId}/medicines`).then(r => r.medicines);
}

/** Upsert a medicine by its (client-generated) id. */
export function upsertKitMedicine(kitId: string, medicine: Medicine) {
  return request<{ medicine: Medicine }>(`/kits/${kitId}/medicines`, { method: 'POST', body: medicine })
    .then(r => r.medicine);
}

export function patchKitMedicine(kitId: string, medId: string, changes: Partial<Medicine>) {
  return request<{ medicine: Medicine }>(`/kits/${kitId}/medicines/${medId}`, {
    method: 'PATCH', body: changes,
  }).then(r => r.medicine);
}

export function deleteKitMedicine(kitId: string, medId: string) {
  return request<{ ok: true }>(`/kits/${kitId}/medicines/${medId}`, { method: 'DELETE' });
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export interface ApiInvite {
  id: string; token: string; kitId: string; kitName?: string; kitIcon?: string;
  inviterId: string; inviterName?: string; role: KitAccessRole; status: string;
  link: string; createdAt: string; expiresAt: string;
}

export function createInvite(kitId: string, input: {
  nickname?: string; email?: string; role?: Exclude<KitAccessRole, 'owner'>;
}) {
  return request<{ invite: ApiInvite }>(`/kits/${kitId}/invites`, { method: 'POST', body: input })
    .then(r => r.invite);
}

export function listInvites() {
  return request<{ invites: ApiInvite[] }>('/invites').then(r => r.invites);
}

export function previewInvite(token: string) {
  return request<{ invite: ApiInvite }>(`/invites/${token}`).then(r => r.invite);
}

export function acceptInvite(token: string) {
  return request<{ kit: MedicineKit }>(`/invites/${token}/accept`, { method: 'POST' }).then(r => r.kit);
}

export function declineInvite(token: string) {
  return request<{ ok: true }>(`/invites/${token}/decline`, { method: 'POST' });
}

// ─── Activity ────────────────────────────────────────────────────────────────

export function listActivity(kitId: string) {
  return request<{ events: KitActivityEvent[] }>(`/kits/${kitId}/activity`).then(r => r.events);
}

export function logActivity(kitId: string, input: {
  type: KitActivityEvent['type']; medicineId?: string; medicineName?: string; detail?: string;
}) {
  return request<{ ok: true }>(`/kits/${kitId}/activity`, { method: 'POST', body: input });
}

// ─── Notifications ───────────────────────────────────────────────────────────

export function listNotifications() {
  return request<{ notifications: AppNotification[] }>('/notifications').then(r => r.notifications);
}

export function markNotificationRead(notifId: string) {
  return request<{ ok: true }>(`/notifications/${notifId}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
  return request<{ ok: true }>('/notifications/read-all', { method: 'POST' });
}

export function deleteNotification(notifId: string) {
  return request<{ ok: true }>(`/notifications/${notifId}`, { method: 'DELETE' });
}

// ─── Medicines catalog (server-side, for fast search & placeholders) ───────────

export interface CatalogMedicine extends MedicinePrefill { id: string; }

/** A medicine returned from a live open-data source (openFDA / RxNav). */
export interface GlobalMedicine {
  name: string;
  activeIngredient?: string;
  form?: string;
  description?: string;
  usageNotes?: string;
  warnings?: string[];
  source: string;
}

/** Search the local seeded catalog. Pass global=true to also query openFDA/RxNav. */
export function searchCatalog(q: string, global = false) {
  const qs = `q=${encodeURIComponent(q)}${global ? '&global=1' : ''}`;
  return request<{ medicines: CatalogMedicine[]; global: GlobalMedicine[] }>(`/medicines/search?${qs}`);
}

export function catalogByBarcode(barcode: string) {
  return request<{ medicine: CatalogMedicine | null }>(`/medicines/barcode/${encodeURIComponent(barcode)}`)
    .then(r => r.medicine);
}

// ─── Drug-drug interaction matching ────────────────────────────────────────────

export type InteractionStatus = 'ok' | 'caution' | 'restricted';

export interface InteractionPair {
  a: string;
  b: string;
  status: InteractionStatus; // 'ok' = can be used together, 'restricted' = restricted to use together
  severity?: string;
  note?: string;
  source: string;
}

/** Classify every unordered pair among the given medicines/ingredients. */
export function checkInteractions(items: string[]) {
  return request<{ pairs: InteractionPair[]; worst: InteractionStatus }>('/medicines/interactions', {
    method: 'POST', body: { items },
  });
}

export type { KitMember };

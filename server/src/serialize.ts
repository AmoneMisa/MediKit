import { q } from './db.js';

// Row → API DTO mappers. Keys mirror the React Native client's `types/index.ts`.

export interface UserRow {
  id: string; nickname: string; name: string; surname: string | null;
  email: string | null; avatar_initials: string; created_at: string;
}

export function publicUser(row: UserRow) {
  return {
    id: row.id,
    nickname: row.nickname,
    name: row.name,
    surname: row.surname ?? undefined,
    email: row.email ?? undefined,
    avatarInitials: row.avatar_initials,
    createdAt: row.created_at,
  };
}

export async function kitMembers(kitId: string) {
  const rows = await q<{
    user_id: string; role: string; sync_status: string; last_active_at: string | null;
    name: string; avatar_initials: string; nickname: string;
  }>(`
    SELECT m.user_id, m.role, m.sync_status, m.last_active_at,
           u.name, u.avatar_initials, u.nickname
    FROM kit_members m JOIN users u ON u.id = m.user_id
    WHERE m.kit_id = $1
    ORDER BY m.joined_at ASC
  `, [kitId]);
  return rows.map(r => ({
    userId: r.user_id,
    name: r.name,
    nickname: r.nickname,
    avatarInitials: r.avatar_initials,
    role: r.role,
    syncStatus: r.sync_status,
    lastActiveAt: r.last_active_at ?? undefined,
  }));
}

export interface KitRow {
  id: string; name: string; description: string | null; icon: string;
  color_tag: string; is_private: boolean; owner_id: string;
  created_at: string; updated_at: string;
}

export async function kitDto(row: KitRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    icon: row.icon,
    colorTag: row.color_tag,
    isPrivate: !!row.is_private,
    ownerId: row.owner_id,
    members: await kitMembers(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface MedicineRow {
  id: string; kit_id: string; name: string; manufacturer: string | null;
  active_ingredient: string | null; dosage: string | null; form: string;
  composition: unknown; total_quantity: string | number; remaining_quantity: string | number;
  start_date: string | null; expiration_date: string; storage_notes: string | null;
  notes: string | null; photo_uri: string | null; description: string | null;
  usage_notes: string | null; warnings: unknown; incompatible_with: unknown;
  tags: unknown; added_at: string; updated_at: string;
}

// JSONB columns arrive already parsed from pg.
function jsonArr(v: unknown): unknown[] | undefined {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : undefined; } catch { return undefined; } }
  return undefined;
}

export function medicineDto(r: MedicineRow) {
  return {
    id: r.id,
    kitId: r.kit_id,
    name: r.name,
    manufacturer: r.manufacturer ?? undefined,
    activeIngredient: r.active_ingredient ?? undefined,
    dosage: r.dosage ?? undefined,
    form: r.form,
    composition: jsonArr(r.composition) as { name: string; amount?: string }[] | undefined,
    totalQuantity: Number(r.total_quantity),
    remainingQuantity: Number(r.remaining_quantity),
    startDate: r.start_date ?? undefined,
    expirationDate: r.expiration_date,
    storageNotes: r.storage_notes ?? undefined,
    notes: r.notes ?? undefined,
    photoUri: r.photo_uri ?? undefined,
    description: r.description ?? undefined,
    usageNotes: r.usage_notes ?? undefined,
    warnings: jsonArr(r.warnings) as string[] | undefined,
    incompatibleWith: jsonArr(r.incompatible_with) as string[] | undefined,
    tags: jsonArr(r.tags) as string[] | undefined,
    addedAt: r.added_at,
    updatedAt: r.updated_at,
  };
}

export function activityDto(r: {
  id: string; kit_id: string; user_id: string; user_name: string; type: string;
  medicine_id: string | null; medicine_name: string | null; detail: string | null; created_at: string;
}) {
  return {
    id: r.id,
    kitId: r.kit_id,
    userId: r.user_id,
    userName: r.user_name,
    type: r.type,
    medicineId: r.medicine_id ?? undefined,
    medicineName: r.medicine_name ?? undefined,
    detail: r.detail ?? undefined,
    createdAt: r.created_at,
  };
}

export function notificationDto(r: {
  id: string; type: string; title: string; body: string;
  kit_id: string | null; medicine_id: string | null; is_read: boolean; created_at: string;
}) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    kitId: r.kit_id ?? undefined,
    medicineId: r.medicine_id ?? undefined,
    isRead: !!r.is_read,
    createdAt: r.created_at,
  };
}

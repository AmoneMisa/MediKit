import { q1 } from './db.js';
import { HttpError } from './util.js';
import type { KitRow } from './serialize.js';

export type Role = 'owner' | 'editor' | 'viewer' | 'synced';

export interface MembershipRow {
  kit_id: string; user_id: string; role: Role; sync_status: string;
}

export function getKit(kitId: string): Promise<KitRow | undefined> {
  return q1<KitRow>('SELECT * FROM kits WHERE id = $1', [kitId]);
}

export function membership(kitId: string, userId: string): Promise<MembershipRow | undefined> {
  return q1<MembershipRow>('SELECT * FROM kit_members WHERE kit_id = $1 AND user_id = $2', [kitId, userId]);
}

/** Require the user to be a member of the kit; returns kit + role. */
export async function requireMember(kitId: string, userId: string): Promise<{ kit: KitRow; role: Role }> {
  const kit = await getKit(kitId);
  if (!kit) throw new HttpError(404, 'Kit not found');
  const m = await membership(kitId, userId);
  if (!m) throw new HttpError(403, 'Not a member of this kit');
  return { kit, role: m.role };
}

const CAN_EDIT: Role[] = ['owner', 'editor', 'synced'];

export async function requireEditor(kitId: string, userId: string): Promise<KitRow> {
  const { kit, role } = await requireMember(kitId, userId);
  if (!CAN_EDIT.includes(role)) throw new HttpError(403, 'Insufficient permissions');
  return kit;
}

export async function requireOwner(kitId: string, userId: string): Promise<KitRow> {
  const kit = await getKit(kitId);
  if (!kit) throw new HttpError(404, 'Kit not found');
  if (kit.owner_id !== userId) throw new HttpError(403, 'Only the owner can do this');
  return kit;
}

import { Router } from 'express';
import { z } from 'zod';
import { q, q1, exec } from '../db.js';
import { kitDto, type KitRow } from '../serialize.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { requireMember, requireEditor, requireOwner, membership } from '../access.js';
import { broadcastToKit } from '../realtime.js';
import { ah, id, now, HttpError } from '../util.js';
import { logActivity } from './activity.js';

export const kitsRouter = Router();
kitsRouter.use(requireAuth);

// ── List kits the user belongs to ───────────────────────────────────────────────
kitsRouter.get('/', ah(async (req: AuthedRequest, res) => {
  const rows = await q<KitRow>(`
    SELECT k.* FROM kits k
    JOIN kit_members m ON m.kit_id = k.id
    WHERE m.user_id = $1
    ORDER BY k.updated_at DESC
  `, [req.user!.id]);
  res.json({ kits: await Promise.all(rows.map(kitDto)) });
}));

// ── Create a shared kit ─────────────────────────────────────────────────────────
const createSchema = z.object({
  // Client may supply its own id so an offline-created kit keeps identity after sync.
  id: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().max(8).optional(),
  colorTag: z.string().trim().max(16).optional(),
  isPrivate: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

kitsRouter.post('/', ah(async (req: AuthedRequest, res) => {
  const body = createSchema.parse(req.body);
  const ts = now();
  const kit: KitRow = {
    id: body.id ?? id('kit'),
    name: body.name,
    description: body.description ?? null,
    icon: body.icon ?? '🩺',
    color_tag: body.colorTag ?? '#A0CEFF',
    is_private: !!body.isPrivate,
    owner_id: req.user!.id,
    created_at: body.createdAt ?? ts,
    updated_at: body.updatedAt ?? ts,
  };
  // Upsert so a retried offline push is idempotent; only the owner may re-push their kit.
  await exec(
    `INSERT INTO kits (id, name, description, icon, color_tag, is_private, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon,
       color_tag = EXCLUDED.color_tag, is_private = EXCLUDED.is_private,
       updated_at = EXCLUDED.updated_at
     WHERE kits.owner_id = EXCLUDED.owner_id`,
    [kit.id, kit.name, kit.description, kit.icon, kit.color_tag, kit.is_private, kit.owner_id, kit.created_at, kit.updated_at],
  );
  await exec(
    `INSERT INTO kit_members (kit_id, user_id, role, sync_status, joined_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (kit_id, user_id) DO NOTHING`,
    [kit.id, req.user!.id, 'owner', 'active', ts]);
  const fresh = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [kit.id]);
  res.status(201).json({ kit: await kitDto(fresh!) });
}));

// ── Read a single kit ───────────────────────────────────────────────────────────
kitsRouter.get('/:kitId', ah(async (req: AuthedRequest, res) => {
  const { kit } = await requireMember(req.params.kitId, req.user!.id);
  res.json({ kit: await kitDto(kit) });
}));

// ── Update kit meta ─────────────────────────────────────────────────────────────
const updateSchema = createSchema.partial();

kitsRouter.patch('/:kitId', ah(async (req: AuthedRequest, res) => {
  await requireEditor(req.params.kitId, req.user!.id);
  const body = updateSchema.parse(req.body);

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown) => { params.push(value); sets.push(`${col} = $${params.length}`); };

  if ('name' in body) push('name', body.name);
  if ('description' in body) push('description', body.description ?? null);
  if ('icon' in body) push('icon', body.icon);
  if ('colorTag' in body) push('color_tag', body.colorTag);
  if ('isPrivate' in body) push('is_private', !!body.isPrivate);

  if (sets.length) {
    push('updated_at', now());
    params.push(req.params.kitId);
    await exec(`UPDATE kits SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  }
  const kit = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [req.params.kitId]);
  const dto = await kitDto(kit!);
  broadcastToKit(kit!.id, { type: 'kit_updated', kitId: kit!.id, kit: dto }, req.user!.id);
  res.json({ kit: dto });
}));

// ── Delete kit (owner only) ─────────────────────────────────────────────────────
kitsRouter.delete('/:kitId', ah(async (req: AuthedRequest, res) => {
  await requireOwner(req.params.kitId, req.user!.id);
  broadcastToKit(req.params.kitId, { type: 'kit_deleted', kitId: req.params.kitId }, req.user!.id);
  await exec('DELETE FROM kits WHERE id = $1', [req.params.kitId]);
  res.json({ ok: true });
}));

// ── Members ─────────────────────────────────────────────────────────────────────
const roleSchema = z.object({ role: z.enum(['editor', 'viewer', 'synced']) });

kitsRouter.patch('/:kitId/members/:userId', ah(async (req: AuthedRequest, res) => {
  const kit = await requireOwner(req.params.kitId, req.user!.id);
  const { role } = roleSchema.parse(req.body);
  if (req.params.userId === kit.owner_id) throw new HttpError(400, 'Cannot change owner role');
  const m = await membership(req.params.kitId, req.params.userId);
  if (!m) throw new HttpError(404, 'Member not found');
  await exec('UPDATE kit_members SET role = $1 WHERE kit_id = $2 AND user_id = $3',
    [role, req.params.kitId, req.params.userId]);
  const fresh = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [req.params.kitId]);
  const dto = await kitDto(fresh!);
  broadcastToKit(kit.id, { type: 'members_changed', kitId: kit.id, kit: dto });
  res.json({ kit: dto });
}));

kitsRouter.delete('/:kitId/members/:userId', ah(async (req: AuthedRequest, res) => {
  const kit = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [req.params.kitId]);
  if (!kit) throw new HttpError(404, 'Kit not found');
  const isOwner = kit.owner_id === req.user!.id;
  const isSelf = req.params.userId === req.user!.id;
  if (!isOwner && !isSelf) throw new HttpError(403, 'Insufficient permissions');
  if (req.params.userId === kit.owner_id) throw new HttpError(400, 'Owner cannot be removed');

  const leaving = await q1<{ name: string }>('SELECT name FROM users WHERE id = $1', [req.params.userId]);
  await exec('DELETE FROM kit_members WHERE kit_id = $1 AND user_id = $2', [req.params.kitId, req.params.userId]);
  if (isSelf && leaving) {
    await logActivity(kit.id, req.params.userId, leaving.name, 'member_left');
  }
  const fresh = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [req.params.kitId]);
  const dto = await kitDto(fresh!);
  broadcastToKit(kit.id, { type: 'members_changed', kitId: kit.id, kit: dto });
  res.json({ kit: dto });
}));

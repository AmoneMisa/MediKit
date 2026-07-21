import { Router } from 'express';
import { z } from 'zod';
import { q, q1, exec } from '../db.js';
import { kitDto, type KitRow, type UserRow } from '../serialize.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { requireOwner, membership } from '../access.js';
import { config } from '../config.js';
import { broadcastToKit } from '../realtime.js';
import { ah, id, now, token as makeToken, HttpError } from '../util.js';
import { logActivity } from './activity.js';
import { notify } from './notifications.js';

interface InviteRow {
  id: string; token: string; kit_id: string; inviter_id: string;
  invitee_nickname: string | null; invitee_email: string | null;
  role: string; status: string; accepted_by: string | null;
  created_at: string; expires_at: string;
}

function inviteDto(row: InviteRow, kit?: KitRow, inviter?: UserRow) {
  return {
    id: row.id,
    token: row.token,
    kitId: row.kit_id,
    kitName: kit?.name,
    kitIcon: kit?.icon,
    inviterId: row.inviter_id,
    inviterName: inviter?.name,
    role: row.role,
    status: row.status,
    link: `https://medikit.app/join/${row.token}`,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

// ── Router mounted at /api/kits (invite creation lives under a kit) ──────────────
export const kitInvitesRouter = Router();
kitInvitesRouter.use(requireAuth);

const createSchema = z.object({
  nickname: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(['editor', 'viewer', 'synced']).default('viewer'),
});

// POST /api/kits/:kitId/invites  → create an invite (link, or targeted by nickname/email)
kitInvitesRouter.post('/:kitId/invites', ah(async (req: AuthedRequest, res) => {
  const kit = await requireOwner(req.params.kitId, req.user!.id);
  const body = createSchema.parse(req.body);
  const nick = body.nickname?.replace(/^@/, '').trim() || undefined;

  // If a nickname is given it must resolve to a real user.
  let target: UserRow | undefined;
  if (nick) {
    target = await q1<UserRow>('SELECT * FROM users WHERE nickname = $1', [nick]);
    if (!target) throw new HttpError(404, 'No MediKit user with that nickname');
    if (await membership(kit.id, target.id)) throw new HttpError(409, 'User is already a member');
  }

  const row: InviteRow = {
    id: id('inv'),
    token: makeToken(),
    kit_id: kit.id,
    inviter_id: req.user!.id,
    invitee_nickname: nick ?? null,
    invitee_email: body.email ?? null,
    role: body.role,
    status: 'pending',
    accepted_by: null,
    created_at: now(),
    expires_at: new Date(Date.now() + config.inviteTtlMs).toISOString(),
  };
  await exec(
    `INSERT INTO invites (id, token, kit_id, inviter_id, invitee_nickname, invitee_email, role, status, accepted_by, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [row.id, row.token, row.kit_id, row.inviter_id, row.invitee_nickname, row.invitee_email,
      row.role, row.status, row.accepted_by, row.created_at, row.expires_at],
  );

  await logActivity(kit.id, req.user!.id, req.user!.name, 'share_created');

  // Notify the target user in-app if they exist on the platform.
  if (target) {
    await notify(target.id, 'kit_update', 'Приглашение в аптечку',
      `${req.user!.name} приглашает вас в «${kit.name}»`, { kitId: kit.id });
  }

  res.status(201).json({ invite: inviteDto(row, kit, req.user!) });
}));

// ── Router mounted at /api/invites (invitee-facing operations) ───────────────────
export const invitesRouter = Router();
invitesRouter.use(requireAuth);

// GET /api/invites  → pending invites addressed to me (by nickname/email)
invitesRouter.get('/', ah(async (req: AuthedRequest, res) => {
  const rows = await q<InviteRow>(`
    SELECT * FROM invites
    WHERE status = 'pending' AND expires_at > $1
      AND (invitee_nickname = $2 OR invitee_email = $3)
    ORDER BY created_at DESC
  `, [now(), req.user!.nickname, req.user!.email ?? '']);
  const enriched = await Promise.all(rows.map(async r => {
    const kit = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [r.kit_id]);
    const inviter = await q1<UserRow>('SELECT * FROM users WHERE id = $1', [r.inviter_id]);
    return inviteDto(r, kit, inviter);
  }));
  res.json({ invites: enriched });
}));

// GET /api/invites/:token  → preview an invite (for link/QR joins)
invitesRouter.get('/:token', ah(async (req: AuthedRequest, res) => {
  const row = await q1<InviteRow>('SELECT * FROM invites WHERE token = $1', [req.params.token]);
  if (!row) throw new HttpError(404, 'Invite not found');
  const kit = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [row.kit_id]);
  const inviter = await q1<UserRow>('SELECT * FROM users WHERE id = $1', [row.inviter_id]);
  res.json({ invite: inviteDto(row, kit, inviter) });
}));

// POST /api/invites/:token/accept  → join the kit
invitesRouter.post('/:token/accept', ah(async (req: AuthedRequest, res) => {
  const row = await q1<InviteRow>('SELECT * FROM invites WHERE token = $1', [req.params.token]);
  if (!row) throw new HttpError(404, 'Invite not found');
  if (row.status !== 'pending') throw new HttpError(410, 'Invite is no longer valid');
  if (row.expires_at <= now()) throw new HttpError(410, 'Invite has expired');

  const kit = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [row.kit_id]);
  if (!kit) throw new HttpError(404, 'Kit no longer exists');

  if (!(await membership(kit.id, req.user!.id))) {
    await exec('INSERT INTO kit_members (kit_id, user_id, role, sync_status, joined_at) VALUES ($1, $2, $3, $4, $5)',
      [kit.id, req.user!.id, row.role, 'active', now()]);
    await logActivity(kit.id, req.user!.id, req.user!.name, 'member_joined');
  }
  await exec("UPDATE invites SET status = 'accepted', accepted_by = $1 WHERE id = $2", [req.user!.id, row.id]);

  const fresh = await q1<KitRow>('SELECT * FROM kits WHERE id = $1', [kit.id]);
  const dto = await kitDto(fresh!);
  broadcastToKit(kit.id, { type: 'members_changed', kitId: kit.id, kit: dto }, req.user!.id);
  await notify(kit.owner_id, 'kit_update', 'Новый участник',
    `${req.user!.name} присоединился к «${kit.name}»`, { kitId: kit.id });

  res.json({ kit: dto });
}));

// POST /api/invites/:token/decline
invitesRouter.post('/:token/decline', ah(async (req: AuthedRequest, res) => {
  const row = await q1<InviteRow>('SELECT * FROM invites WHERE token = $1', [req.params.token]);
  if (!row) throw new HttpError(404, 'Invite not found');
  await exec("UPDATE invites SET status = 'declined' WHERE id = $1", [row.id]);
  res.json({ ok: true });
}));

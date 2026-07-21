import { Router } from 'express';
import { z } from 'zod';
import { q, q1, exec } from '../db.js';
import { publicUser, type UserRow } from '../serialize.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { ah, id, now, HttpError } from '../util.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

// ── Search users by nickname (for invites / adding contacts) ────────────────────
usersRouter.get('/search', ah(async (req: AuthedRequest, res) => {
  const query = String(req.query.q ?? '').replace(/^@/, '').trim();
  if (query.length < 2) { res.json({ users: [] }); return; }
  const rows = await q<UserRow>(`
    SELECT * FROM users
    WHERE nickname ILIKE $1 AND id != $2
    ORDER BY nickname LIMIT 10
  `, [`${query}%`, req.user!.id]);
  res.json({ users: rows.map(publicUser) });
}));

// ── Contacts ────────────────────────────────────────────────────────────────────
usersRouter.get('/contacts', ah(async (req: AuthedRequest, res) => {
  const rows = await q<UserRow & { contact_id: string }>(`
    SELECT c.id AS contact_id, u.*
    FROM contacts c JOIN users u ON u.id = c.contact_user_id
    WHERE c.owner_id = $1
    ORDER BY u.name
  `, [req.user!.id]);
  res.json({
    contacts: rows.map(r => ({ contactId: r.contact_id, ...publicUser(r) })),
  });
}));

const addContactSchema = z.object({ nickname: z.string().trim().min(2) });

usersRouter.post('/contacts', ah(async (req: AuthedRequest, res) => {
  const { nickname } = addContactSchema.parse(req.body);
  const nick = nickname.replace(/^@/, '');
  const target = await q1<UserRow>('SELECT * FROM users WHERE nickname = $1', [nick]);
  if (!target) throw new HttpError(404, 'No MediKit user with that nickname');
  if (target.id === req.user!.id) throw new HttpError(400, 'You cannot add yourself');

  const existing = await q1<{ id: string }>(
    'SELECT id FROM contacts WHERE owner_id = $1 AND contact_user_id = $2', [req.user!.id, target.id],
  );
  const contactId = existing?.id ?? id('contact');
  if (!existing) {
    await exec('INSERT INTO contacts (id, owner_id, contact_user_id, created_at) VALUES ($1, $2, $3, $4)',
      [contactId, req.user!.id, target.id, now()]);
  }
  res.status(201).json({ contact: { contactId, ...publicUser(target) } });
}));

usersRouter.delete('/contacts/:contactId', ah(async (req: AuthedRequest, res) => {
  await exec('DELETE FROM contacts WHERE id = $1 AND owner_id = $2', [req.params.contactId, req.user!.id]);
  res.json({ ok: true });
}));

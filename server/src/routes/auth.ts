import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { q1, exec } from '../db.js';
import { config } from '../config.js';
import { publicUser, type UserRow } from '../serialize.js';
import { signToken, verifyToken, getUserById, requireAuth, type AuthedRequest } from '../auth.js';
import { ah, id, now, initialsFrom, HttpError } from '../util.js';

export const authRouter = Router();

const googleClient = new OAuth2Client();

const registerSchema = z.object({
  nickname: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_.]+$/, 'invalid nickname'),
  name: z.string().trim().min(1).max(60),
  surname: z.string().trim().max(60).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).max(200),
});

authRouter.post('/register', ah(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const nickname = body.nickname.replace(/^@/, '');

  const exists = await q1('SELECT id FROM users WHERE nickname = $1', [nickname]);
  if (exists) throw new HttpError(409, 'Nickname already taken');
  if (body.email) {
    const emailUsed = await q1('SELECT id FROM users WHERE email = $1', [body.email]);
    if (emailUsed) throw new HttpError(409, 'Email already registered');
  }

  const displayName = [body.name, body.surname].filter(Boolean).join(' ');
  const user: UserRow = {
    id: id('user'),
    nickname,
    name: body.name,
    surname: body.surname ?? null,
    email: body.email ?? null,
    avatar_initials: initialsFrom(displayName, nickname),
    created_at: now(),
  };
  await exec(
    `INSERT INTO users (id, nickname, name, surname, email, password_hash, avatar_initials, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [user.id, user.nickname, user.name, user.surname, user.email,
      bcrypt.hashSync(body.password, 10), user.avatar_initials, user.created_at],
  );

  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
}));

const loginSchema = z.object({
  identifier: z.string().trim().min(1), // nickname or email
  password: z.string().min(1),
});

authRouter.post('/login', ah(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const ident = body.identifier.replace(/^@/, '');
  const row = await q1<UserRow & { password_hash: string }>(
    'SELECT * FROM users WHERE nickname = $1 OR email = $1', [ident],
  );
  if (!row || !bcrypt.compareSync(body.password, row.password_hash)) {
    throw new HttpError(401, 'Invalid credentials');
  }
  res.json({ token: signToken(row.id), user: publicUser(row) });
}));

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: publicUser(req.user!) });
});

const updateMeSchema = z.object({
  nickname: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_.]+$/, 'invalid nickname').optional(),
  name: z.string().trim().min(1).max(60).optional(),
  surname: z.string().trim().max(60).optional(),
  email: z.string().trim().email().optional(),
  avatarInitials: z.string().trim().min(1).max(4).optional(),
});

// Persist edits from the profile screen so they survive relaunch. Without this the
// client's local edit is silently overwritten on next launch by GET /auth/me.
authRouter.patch('/me', requireAuth, ah(async (req: AuthedRequest, res) => {
  const body = updateMeSchema.parse(req.body);
  const cur = req.user!;

  const nickname = body.nickname !== undefined ? body.nickname.replace(/^@/, '') : cur.nickname;
  const name = body.name ?? cur.name;
  const surname = body.surname !== undefined ? (body.surname || null) : cur.surname;
  const email = body.email !== undefined ? (body.email || null) : cur.email;

  if (nickname !== cur.nickname) {
    const taken = await q1('SELECT id FROM users WHERE nickname = $1 AND id <> $2', [nickname, cur.id]);
    if (taken) throw new HttpError(409, 'Nickname already taken');
  }
  if (email && email !== cur.email) {
    const used = await q1('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, cur.id]);
    if (used) throw new HttpError(409, 'Email already registered');
  }

  const displayName = [name, surname].filter(Boolean).join(' ');
  const avatarInitials = body.avatarInitials?.trim() || initialsFrom(displayName, nickname);

  await exec(
    `UPDATE users SET nickname = $1, name = $2, surname = $3, email = $4, avatar_initials = $5
     WHERE id = $6`,
    [nickname, name, surname, email, avatarInitials, cur.id],
  );

  const updated: UserRow = { ...cur, nickname, name, surname, email, avatar_initials: avatarInitials };
  res.json({ user: publicUser(updated) });
}));

// ─── Google Sign-In ──────────────────────────────────────────────────────────

const googleSchema = z.object({ idToken: z.string().min(1) });

/** Turn an email/name into a free nickname (append digits until unique). */
async function uniqueNickname(base: string): Promise<string> {
  let root = base.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase().slice(0, 24);
  if (root.length < 2) root = 'user';
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? root : `${root}${Math.floor(Math.random() * 1e4)}`;
    const taken = await q1('SELECT id FROM users WHERE nickname = $1', [candidate]);
    if (!taken) return candidate;
  }
  return `user${Date.now()}`;
}

/**
 * Sign in with a Google ID token. If the caller already holds a valid session
 * (Bearer token) and that Google identity isn't yet claimed, we LINK Google to
 * the current device account so its local kits/data carry over. Otherwise we log
 * into the existing Google-linked account, or provision a fresh one.
 */
authRouter.post('/google', ah(async (req: AuthedRequest, res) => {
  if (config.googleClientIds.length === 0) {
    throw new HttpError(503, 'Google sign-in is not configured');
  }
  const { idToken } = googleSchema.parse(req.body);

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: config.googleClientIds });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Invalid Google token');
  }
  if (!payload?.sub) throw new HttpError(401, 'Invalid Google token');

  const googleId = payload.sub;
  const email = payload.email ?? null;
  const gName = payload.given_name || payload.name || 'User';

  // 1) Already linked → straightforward login.
  const linked = await q1<UserRow>('SELECT * FROM users WHERE google_id = $1', [googleId]);
  if (linked) {
    res.json({ token: signToken(linked.id), user: publicUser(linked) });
    return;
  }

  // 2) Caller has a session and this Google id is unclaimed → link onto it.
  const header = req.header('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const currentUserId = bearer ? verifyToken(bearer) : null;
  const current = currentUserId ? await getUserById(currentUserId) : undefined;
  if (current) {
    // Don't clobber an email already used by a different account.
    let linkEmail = current.email;
    if (email && !current.email) {
      const emailUsed = await q1('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, current.id]);
      if (!emailUsed) linkEmail = email;
    }
    await exec('UPDATE users SET google_id = $1, email = $2 WHERE id = $3',
      [googleId, linkEmail, current.id]);
    const updated: UserRow = { ...current, google_id: googleId, email: linkEmail };
    res.json({ token: signToken(updated.id), user: publicUser(updated) });
    return;
  }

  // 3) Brand-new Google account.
  const nickname = await uniqueNickname(email ? email.split('@')[0] : gName);
  const safeEmail = email && !(await q1('SELECT id FROM users WHERE email = $1', [email])) ? email : null;
  const user: UserRow = {
    id: id('user'),
    nickname,
    name: gName,
    surname: payload.family_name ?? null,
    email: safeEmail,
    avatar_initials: initialsFrom([gName, payload.family_name].filter(Boolean).join(' '), nickname),
    created_at: now(),
    google_id: googleId,
  };
  await exec(
    `INSERT INTO users (id, nickname, name, surname, email, password_hash, avatar_initials, created_at, google_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [user.id, user.nickname, user.name, user.surname, user.email,
      bcrypt.hashSync(id('goog'), 10), user.avatar_initials, user.created_at, user.google_id],
  );
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
}));

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { q1, exec } from '../db.js';
import { publicUser, type UserRow } from '../serialize.js';
import { signToken, requireAuth, type AuthedRequest } from '../auth.js';
import { ah, id, now, initialsFrom, HttpError } from '../util.js';

export const authRouter = Router();

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

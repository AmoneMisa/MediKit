import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { q1 } from './db.js';
import { HttpError } from './util.js';
import type { UserRow } from './serialize.js';

export interface AuthedRequest extends Request {
  user?: UserRow;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '90d' });
}

export function verifyToken(t: string): string | null {
  try {
    const payload = jwt.verify(t, config.jwtSecret) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function getUserById(userId: string): Promise<UserRow | undefined> {
  return q1<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
}

/** Express middleware requiring a valid Bearer token. */
export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization') ?? '';
    const t = header.startsWith('Bearer ') ? header.slice(7) : '';
    const userId = t ? verifyToken(t) : null;
    if (!userId) return next(new HttpError(401, 'Unauthorized'));
    const user = await getUserById(userId);
    if (!user) return next(new HttpError(401, 'Unauthorized'));
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

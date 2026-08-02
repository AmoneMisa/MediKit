import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { q1, exec } from './db.js';
import { HttpError } from './util.js';
import type { UserRow } from './serialize.js';

const TOKEN_TTL_DAYS = 30;
const TOKEN_TTL_SECS = TOKEN_TTL_DAYS * 24 * 60 * 60;

export interface AuthedRequest extends Request {
  user?: UserRow;
  tokenJti?: string;   // set by requireAuth; used by logout to revoke the right token
  tokenExp?: number;   // unix seconds — actual expiry from the token's 'exp' claim
}

export function signToken(userId: string): string {
  return jwt.sign(
    { sub: userId, jti: randomUUID() },
    config.jwtSecret,
    { expiresIn: TOKEN_TTL_SECS },
  );
}

interface TokenPayload { sub?: string; jti?: string; exp?: number; }

/** Returns { userId, jti } from a valid token, or null if invalid/expired. */
export function verifyToken(t: string): { userId: string; jti: string; exp: number } | null {
  try {
    const payload = jwt.verify(t, config.jwtSecret) as TokenPayload;
    if (!payload.sub || !payload.jti || !payload.exp) return null;
    return { userId: payload.sub, jti: payload.jti, exp: payload.exp };
  } catch {
    return null;
  }
}

export function getUserById(userId: string): Promise<UserRow | undefined> {
  return q1<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
}

// ─── In-memory blocklist cache ────────────────────────────────────────────────
// Avoids one DB round-trip per request for the common case (not-revoked tokens).
// Entries: jti → expiry unix-ms.  Max 2 000 entries; evicts oldest on overflow.

const blockedCache = new Map<string, number>();
const CACHE_MAX = 2_000;

function cacheBlock(jti: string, expiresAtMs: number): void {
  if (blockedCache.size >= CACHE_MAX) {
    // Map preserves insertion order; delete the very first (oldest) entry.
    blockedCache.delete(blockedCache.keys().next().value!);
  }
  blockedCache.set(jti, expiresAtMs);
}

/** Revoke a specific token by its jti. */
export async function revokeToken(jti: string, expiresAt: Date): Promise<void> {
  await exec(
    'INSERT INTO token_blocklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
    [jti, expiresAt.toISOString()],
  );
  cacheBlock(jti, expiresAt.getTime()); // warm the cache immediately
}

async function isRevoked(jti: string): Promise<boolean> {
  const now = Date.now();

  // Fast path: check in-memory cache.
  const cached = blockedCache.get(jti);
  if (cached !== undefined) {
    if (cached <= now) { blockedCache.delete(jti); return false; } // expired
    return true;
  }

  // Slow path: DB lookup (cache miss — valid token that has never been revoked).
  const row = await q1<{ jti: string; expires_at: string }>(
    'SELECT jti, expires_at FROM token_blocklist WHERE jti = $1 AND expires_at > $2',
    [jti, new Date().toISOString()],
  );
  if (row) cacheBlock(jti, new Date(row.expires_at).getTime());
  return !!row;
}

/** Express middleware requiring a valid, non-revoked Bearer token. */
export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization') ?? '';
    const t = header.startsWith('Bearer ') ? header.slice(7) : '';
    const verified = t ? verifyToken(t) : null;
    if (!verified) return next(new HttpError(401, 'Unauthorized'));

    if (await isRevoked(verified.jti)) return next(new HttpError(401, 'Token revoked'));

    const user = await getUserById(verified.userId);
    if (!user) return next(new HttpError(401, 'Unauthorized'));

    req.user = user;
    req.tokenJti = verified.jti;
    req.tokenExp = verified.exp;
    next();
  } catch (e) {
    next(e);
  }
}

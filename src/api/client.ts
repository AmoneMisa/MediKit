import { apiStorage, apiUrl } from './config';

// ─── Token + credential storage ────────────────────────────────────────────────

const KEY_TOKEN = 'authToken';
const KEY_NICK = 'accountNickname';
const KEY_SECRET = 'accountSecret';

export function getToken(): string | null {
  return apiStorage.getString(KEY_TOKEN) ?? null;
}
function setToken(t: string): void { apiStorage.set(KEY_TOKEN, t); }
export function clearToken(): void { apiStorage.delete(KEY_TOKEN); }

export function getAccountNickname(): string | null {
  return apiStorage.getString(KEY_NICK) ?? null;
}

/**
 * Exchange a Google ID token for a MediKit session. When the device already has
 * a session token, it's sent along so the backend links Google onto the current
 * account (keeping local kits/data). Persists the returned token + identity.
 */
export async function loginWithGoogle(idToken: string): Promise<ApiUser> {
  const { token, user } = await request<{ token: string; user: ApiUser }>('/auth/google', {
    // auth:true attaches the current bearer (if any) so the server can link.
    method: 'POST', auth: true, body: { idToken },
  });
  setToken(token);
  if (user.nickname) apiStorage.set(KEY_NICK, user.nickname);
  return user;
}

// ─── Errors ─────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ─── Core request ─────────────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean; // attach bearer token (default true)
  timeoutMs?: number;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = 12000 } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data)
      ? String((data as { error: unknown }).error)
      : `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

// ─── Auth bootstrapping ────────────────────────────────────────────────────────

export interface ApiUser {
  id: string; nickname: string; name: string; surname?: string;
  email?: string; avatarInitials: string; createdAt: string;
  googleLinked?: boolean;
}

function randomSecret(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function sanitizeNickname(raw: string): string {
  const cleaned = raw.replace(/^@/, '').replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase();
  return cleaned.length >= 2 ? cleaned : `user${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Ensure the device has a valid session, provisioning a lightweight account
 * on first use. `desiredNickname`/`name` seed a readable account when available.
 * Returns the authenticated user, or throws if the backend is unreachable.
 */
export async function ensureAuth(desiredNickname?: string, name?: string): Promise<ApiUser> {
  const token = getToken();
  if (token) {
    try {
      const { user } = await request<{ user: ApiUser }>('/auth/me');
      return user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clearToken();
      else throw e; // network error → let caller fall back
    }
  }

  // Reuse stored device credentials if we have them.
  let nickname = getAccountNickname();
  let secret = apiStorage.getString(KEY_SECRET) ?? null;

  if (nickname && secret) {
    const { token: t, user } = await request<{ token: string; user: ApiUser }>('/auth/login', {
      auth: false, method: 'POST', body: { identifier: nickname, password: secret },
    });
    setToken(t);
    return user;
  }

  // First-time provisioning.
  nickname = sanitizeNickname(desiredNickname ?? '');
  secret = randomSecret();
  const displayName = name?.trim() || nickname;
  try {
    const { token: t, user } = await request<{ token: string; user: ApiUser }>('/auth/register', {
      auth: false, method: 'POST', body: { nickname, name: displayName, password: secret },
    });
    apiStorage.set(KEY_NICK, nickname);
    apiStorage.set(KEY_SECRET, secret);
    setToken(t);
    return user;
  } catch (e) {
    // Nickname collision → append a suffix and retry once.
    if (e instanceof ApiError && e.status === 409) {
      const alt = `${nickname}${Math.floor(Math.random() * 1e4)}`;
      const { token: t, user } = await request<{ token: string; user: ApiUser }>('/auth/register', {
        auth: false, method: 'POST', body: { nickname: alt, name: displayName, password: secret },
      });
      apiStorage.set(KEY_NICK, alt);
      apiStorage.set(KEY_SECRET, secret);
      setToken(t);
      return user;
    }
    throw e;
  }
}

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env loader (avoids a dependency). Lines like KEY=value.
function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',

  // OAuth Web client ID(s) used to verify Google ID tokens. Accepts a comma-
  // separated list so the Android + Web client IDs can both be trusted audiences.
  // Empty → the /auth/google endpoint is disabled (returns 503).
  googleClientIds: (process.env.GOOGLE_CLIENT_ID ?? '')
    .split(',').map(s => s.trim()).filter(Boolean),

  // PostgreSQL connection. DATABASE_URL takes precedence; otherwise the PG* vars
  // are assembled into a connection string.
  databaseUrl:
    process.env.DATABASE_URL ??
    `postgres://${process.env.PGUSER ?? 'medikit'}:${process.env.PGPASSWORD ?? 'medikit'}` +
      `@${process.env.PGHOST ?? 'localhost'}:${process.env.PGPORT ?? '5432'}/${process.env.PGDATABASE ?? 'medikit'}`,

  // How long an invite token stays valid (7 days).
  inviteTtlMs: 7 * 24 * 60 * 60 * 1000,

  // Toggle live open-source medicine lookups (openFDA / RxNav). Set to 'false' to
  // rely only on the local seeded catalog (e.g. offline / air-gapped deploys).
  enableGlobalMedicineSources: (process.env.ENABLE_GLOBAL_SOURCES ?? 'true') !== 'false',
};

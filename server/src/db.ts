import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

/** Run a query and return all rows. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/** Run a query and return the first row (or undefined). */
export async function q1<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const res = await pool.query(text, params);
  return res.rows[0] as T | undefined;
}

/** Run a statement, ignoring the result set. */
export async function exec(text: string, params: unknown[] = []): Promise<void> {
  await pool.query(text, params);
}

/** Create tables/indexes if they do not exist. Safe to run on every boot. */
export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      nickname        TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      surname         TEXT,
      email           TEXT UNIQUE,
      password_hash   TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kits (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      icon        TEXT NOT NULL DEFAULT '🩺',
      color_tag   TEXT NOT NULL DEFAULT '#A0CEFF',
      is_private  BOOLEAN NOT NULL DEFAULT FALSE,
      owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kit_members (
      kit_id         TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role           TEXT NOT NULL DEFAULT 'viewer',
      sync_status    TEXT NOT NULL DEFAULT 'active',
      last_active_at TEXT,
      joined_at      TEXT NOT NULL,
      PRIMARY KEY (kit_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invites (
      id               TEXT PRIMARY KEY,
      token            TEXT NOT NULL UNIQUE,
      kit_id           TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
      inviter_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitee_nickname TEXT,
      invitee_email    TEXT,
      role             TEXT NOT NULL DEFAULT 'viewer',
      status           TEXT NOT NULL DEFAULT 'pending',
      accepted_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at       TEXT NOT NULL,
      expires_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity (
      id            TEXT PRIMARY KEY,
      kit_id        TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name     TEXT NOT NULL,
      type          TEXT NOT NULL,
      medicine_id   TEXT,
      medicine_name TEXT,
      detail        TEXT,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      kit_id      TEXT,
      medicine_id TEXT,
      is_read     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id              TEXT PRIMARY KEY,
      owner_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at      TEXT NOT NULL,
      UNIQUE (owner_id, contact_user_id)
    );

    -- Actual medicines stored inside a shared kit (synced across members).
    CREATE TABLE IF NOT EXISTS kit_medicines (
      id                 TEXT PRIMARY KEY,
      kit_id             TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
      name               TEXT NOT NULL,
      manufacturer       TEXT,
      active_ingredient  TEXT,
      dosage             TEXT,
      form               TEXT NOT NULL DEFAULT 'other',
      composition        JSONB,
      total_quantity     NUMERIC NOT NULL DEFAULT 0,
      remaining_quantity NUMERIC NOT NULL DEFAULT 0,
      start_date         TEXT,
      expiration_date    TEXT NOT NULL,
      storage_notes      TEXT,
      notes              TEXT,
      photo_uri          TEXT,
      description        TEXT,
      usage_notes        TEXT,
      warnings           JSONB,
      incompatible_with  JSONB,
      tags               JSONB,
      added_at           TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medicines_catalog (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      active_ingredient TEXT,
      dosage            TEXT,
      form              TEXT,
      description       TEXT,
      usage_notes       TEXT,
      warnings          JSONB,
      incompatible_with JSONB,
      tags              JSONB,
      barcodes          JSONB,
      source            TEXT NOT NULL DEFAULT 'seed',
      search_blob       TEXT NOT NULL
    );

    -- Directed pairs of active ingredients with a compatibility verdict.
    CREATE TABLE IF NOT EXISTS medicine_interactions (
      id            TEXT PRIMARY KEY,
      ingredient_a  TEXT NOT NULL,   -- normalised (lowercased) ingredient/name
      ingredient_b  TEXT NOT NULL,
      status        TEXT NOT NULL,   -- 'restricted' | 'caution' | 'ok'
      severity      TEXT,            -- optional free-text severity
      note          TEXT,
      source        TEXT NOT NULL DEFAULT 'seed',
      UNIQUE (ingredient_a, ingredient_b)
    );

    CREATE INDEX IF NOT EXISTS idx_members_user  ON kit_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_kit  ON activity(kit_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notif_user    ON notifications(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_invite_nick   ON invites(invitee_nickname);
    CREATE INDEX IF NOT EXISTS idx_kitmeds_kit   ON kit_medicines(kit_id);
    CREATE INDEX IF NOT EXISTS idx_catalog_blob  ON medicines_catalog(search_blob);
    CREATE INDEX IF NOT EXISTS idx_interactions_a ON medicine_interactions(ingredient_a);
    CREATE INDEX IF NOT EXISTS idx_interactions_b ON medicine_interactions(ingredient_b);
  `);
}

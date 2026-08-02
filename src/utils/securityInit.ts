/**
 * Security bootstrap — must be called ONCE before any MMKV store is accessed.
 *
 * Flow:
 *  1. Read (or generate) a 256-bit AES encryption key from the OS keychain.
 *  2. One-time migration: copy existing plaintext MMKV data into new encrypted
 *     instances and wipe the plaintext originals.
 *  3. Make the key available to the lazy MMKV factory (createSecureMMKV).
 */

import { MMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';

// ─── Key storage ──────────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE = 'MediKitMMKV';
let _key: string | undefined;

export function getMMKVEncryptionKey(): string | undefined {
  return _key;
}

async function getOrCreateKey(): Promise<string> {
  const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (creds && creds.password) return creds.password;

  // Generate a cryptographically-random 256-bit key (hex-encoded).
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

  await Keychain.setGenericPassword('medikit', key, {
    service: KEYCHAIN_SERVICE,
    // Key stays on this device and does not migrate to a new device/backup.
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

// ─── One-time migration ───────────────────────────────────────────────────────

// Tiny unencrypted store that ONLY tracks whether the migration is done.
// Nothing sensitive is stored here.
const BOOTSTRAP_ID   = 'medikit-bootstrap';
const MIGRATION_FLAG = 'enc-migrated-v1';

// For each old (plaintext) ID, list the MMKV keys we need to carry over
// and the new (encrypted) ID that replaces it.
const MIGRATIONS: { oldId: string; newId: string; keys: string[] }[] = [
  { oldId: 'medikit-store',     newId: 'medikit-store-2',     keys: ['medikit-data'] },
  { oldId: 'medikit-api',       newId: 'medikit-api-2',       keys: ['authToken', 'accountNickname', 'accountSecret', 'baseUrl'] },
  { oldId: 'medikit-outbox',    newId: 'medikit-outbox-2',    keys: ['pending'] },
  { oldId: 'medikit-scheduler', newId: 'medikit-scheduler-2', keys: ['schedule_hash'] },
];

function migrateIfNeeded(encKey: string): void {
  const boot = new MMKV({ id: BOOTSTRAP_ID });
  if (boot.getBoolean(MIGRATION_FLAG)) return; // already done on a previous launch

  for (const { oldId, newId, keys } of MIGRATIONS) {
    const oldStore = new MMKV({ id: oldId });
    const newStore = new MMKV({ id: newId, encryptionKey: encKey });
    for (const key of keys) {
      const value = oldStore.getString(key);
      if (value !== undefined) {
        newStore.set(key, value);
        oldStore.delete(key); // wipe plaintext copy
      }
    }
  }

  boot.set(MIGRATION_FLAG, true);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Async bootstrap — call this ONCE at app startup, before any component that
 * touches the store is rendered.  After it resolves, every LazyMMKV instance
 * will create its underlying MMKV with the hardware-backed encryption key.
 */
export async function bootstrapSecurity(): Promise<void> {
  const key = await getOrCreateKey();
  migrateIfNeeded(key);
  _key = key;
}

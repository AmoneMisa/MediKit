/**
 * Lazy encrypted MMKV factory.
 *
 * All four stores have been renamed (old → new) to avoid opening the same file
 * with and without encryption, which would corrupt data.  The migration in
 * securityInit.ts copies data from old IDs before the new ones are first used.
 */

import { MMKV } from 'react-native-mmkv';
import { getMMKVEncryptionKey } from './securityInit';

const ID_MAP: Record<string, string> = {
  'medikit-store':     'medikit-store-2',
  'medikit-api':       'medikit-api-2',
  'medikit-outbox':    'medikit-outbox-2',
  'medikit-scheduler': 'medikit-scheduler-2',
};

/**
 * Lazy wrapper around MMKV.
 * The underlying MMKV instance is only created on the first property access,
 * so `bootstrapSecurity()` has time to set the encryption key first.
 */
export class LazyMMKV {
  private _mmkv: MMKV | null = null;
  private readonly _id: string;

  constructor(logicalId: string) {
    this._id = ID_MAP[logicalId] ?? logicalId;
  }

  private get mmkv(): MMKV {
    if (!this._mmkv) {
      this._mmkv = new MMKV({ id: this._id, encryptionKey: getMMKVEncryptionKey() });
    }
    return this._mmkv;
  }

  getString(key: string): string | undefined { return this.mmkv.getString(key); }
  set(key: string, value: string | number | boolean): void { this.mmkv.set(key, value); }
  delete(key: string): void { this.mmkv.delete(key); }
  getBoolean(key: string): boolean | undefined { return this.mmkv.getBoolean(key); }
  clearAll(): void { this.mmkv.clearAll(); }
}

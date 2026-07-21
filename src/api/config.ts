import { MMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

/**
 * Persistent storage for backend connection + auth.
 * Kept separate from the main data store so clearing app data behaves predictably.
 */
export const apiStorage = new MMKV({ id: 'medikit-api' });

// Production hits the deployed server over HTTPS. In dev builds we fall back to the
// local backend — Android emulators reach the host via 10.0.2.2, iOS via localhost.
const DEFAULT_BASE_URL = __DEV__
  ? (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000')
  : 'https://whiteslove.me/medikit';

const KEY_BASE_URL = 'baseUrl';

/**
 * Google OAuth *Web* client ID (from Google Cloud Console → Credentials).
 * This is the `webClientId` passed to GoogleSignin.configure and must match one
 * of the server's GOOGLE_CLIENT_ID audiences. Safe to commit (public by design).
 * Leave empty to hide the Google button until configured.
 */
export const GOOGLE_WEB_CLIENT_ID = '913508510175-ckp4uhqrhfpam5m7j78b44uu8d4aa353.apps.googleusercontent.com';

/** Base server URL (without the /api suffix), user-configurable at runtime. */
export function getBaseUrl(): string {
  return apiStorage.getString(KEY_BASE_URL) ?? DEFAULT_BASE_URL;
}

export function setBaseUrl(url: string): void {
  apiStorage.set(KEY_BASE_URL, url.replace(/\/+$/, ''));
}

export function apiUrl(path: string): string {
  return `${getBaseUrl()}/api${path.startsWith('/') ? path : `/${path}`}`;
}

export function wsUrl(token: string): string {
  const base = getBaseUrl().replace(/^http/, 'ws');
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

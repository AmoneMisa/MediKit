import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from './config';
import { loginWithGoogle } from './client';
import type { ApiUser } from './client';

// Thin wrapper around the native Google Sign-In SDK. Keeps the SDK details out
// of the UI: the screen just calls signInWithGoogle() and gets back an ApiUser.

let configured = false;

/** True when a Web client ID is set, so the UI can hide the button otherwise. */
export const isGoogleConfigured = (): boolean => GOOGLE_WEB_CLIENT_ID.length > 0;

function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

/** Raised when the user simply dismisses the Google dialog — callers ignore it. */
export class GoogleCancelled extends Error {}

/**
 * Run the native Google flow and exchange the resulting ID token for a MediKit
 * session (linking onto the current device account server-side).
 */
export async function signInWithGoogle(): Promise<ApiUser> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  let idToken: string | null | undefined;
  try {
    const result = await GoogleSignin.signIn();
    // v13 returns { type, data }; older shapes expose idToken at the top level.
    idToken =
      (result as { data?: { idToken?: string | null } }).data?.idToken ??
      (result as { idToken?: string | null }).idToken;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new GoogleCancelled('cancelled');
    }
    throw e;
  }

  if (!idToken) throw new Error('No Google ID token returned');
  return loginWithGoogle(idToken);
}

/** Sign the device out of Google (does not clear the MediKit session). */
export async function signOutGoogle(): Promise<void> {
  try { await GoogleSignin.signOut(); } catch { /* best-effort */ }
}

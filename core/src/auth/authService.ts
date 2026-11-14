// Sign-in, sign-out and password flows (US1 FR-001/FR-004, feature 003, feature 011) on Supabase
// Auth (feature 023). Every function keeps the name and signature it had on Firebase, so no screen
// changes; errors are thrown raw and normalised by the caller through `mapAuthError`, so no screen
// ever branches on a provider code (account-enumeration rule, feature 003).
import { Capacitor } from '@capacitor/core';
import { supabase, type AppUser } from '../supabase';
import { forgetAll } from '../db/offlineCache';
import { forgetPushDevice } from '../push/pushRegistration';

/** Random value for Google's nonce check; the RAW value goes to Supabase, its SHA-256 to Google. */
function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Google sign-in.
 *
 * Web: Supabase's OAuth redirect (a popup cannot be relied on, and the redirect lands back on the
 * page with the session, which `detectSessionInUrl` picks up).
 *
 * Native: the device's Google account sheet (Credential Manager) returns an ID token, exchanged
 * with `signInWithIdToken`. THE NONCE IS THE DOCUMENTED FAILURE MODE (research R2): Google is given
 * the SHA-256 of a random value and puts it in the token; Supabase is given the RAW value and hashes
 * it itself to compare. Swapping the two is the "nonces mismatch" error.
 */
export async function signInWithGoogle(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    await SocialLogin.initialize({ google: { webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string } });
    const rawNonce = randomNonce();
    // NO `scopes`. Passing any makes the plugin refuse on Android ("You CANNOT use scopes without
    // modifying the main activity") — found on the phone, 2026-10-22: every Google sign-in failed
    // before Google was even asked. Its defaults are `openid profile email`, which is all an ID
    // token needs; custom scopes are only for calling Google APIs, which this app never does.
    const res = await SocialLogin.login({
      provider: 'google',
      options: { nonce: await sha256Hex(rawNonce) },
    });
    const idToken = 'idToken' in res.result ? res.result.idToken : null;
    if (!idToken) throw Object.assign(new Error('google_no_id_token'), { code: 'auth/popup-closed-by-user' });
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function signOutUser(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // Best effort, and it must not be able to stop the line below (a throw here once left a traveler
    // signed in after tapping "sign out" — on a shared phone, the whole point of the button).
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      await SocialLogin.logout({ provider: 'google' });
    } catch {
      // Falls through.
    }
  }
  // This phone stops receiving the account's pushes — BEFORE the session ends, because removing the
  // device row needs it (feature 020 US4). Never fatal: sign-out must always complete.
  await forgetPushDevice();
  // The offline cache holds private data (favorites, Trips, conversations): it leaves with the
  // account, or the next person on the phone reads it (FR-019).
  forgetAll();
  // `local` clears the stored session synchronously and without the network (FR-013 offline).
  await supabase.auth.signOut({ scope: 'local' });
}

// --- Email + password (feature 003) --------------------------------------------------------------

/**
 * Create an account and sign in (FR-001, FR-006). Does NOT create the profile row: AuthProvider
 * calls `ensureUserProfile` on every sign-in, provider-agnostic (FR-005).
 */
export async function registerWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
}

/** Sign in an existing password account (FR-007). */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/**
 * Request a reset link (FR-014). Resolves for unknown addresses too — Supabase does not reveal
 * whether an address is registered, and the caller shows its confirmation unconditionally (FR-015).
 *
 * The link points back into the app (`/reset-password?oobCode=<token hash>`), the same parameter
 * name the reset screens have always read — set by the recovery email template
 * (supabase/templates/recovery.html), so the screens do not change.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${resetLinkOrigin()}/reset-password`,
  });
  if (error) throw error;
}

/**
 * Where the emailed link lands. In a browser that is the page's own origin. In the Android shell it
 * is NOT: the WebView's origin is `https://localhost`, so a reset requested from the phone emailed a
 * link to a page that does not exist ("localhost refused to connect" — found on the first real
 * reset email, 2026-10-22). The email opens in a MAIL APP's browser, so it must point at the public
 * web app. Override with VITE_WEB_BASE_URL for a staging site.
 */
export const DEFAULT_WEB_ORIGIN = 'https://app.svtrip.com';
function resetLinkOrigin(): string {
  if (!Capacitor.isNativePlatform()) return window.location.origin;
  return ((import.meta.env.VITE_WEB_BASE_URL as string | undefined) || DEFAULT_WEB_ORIGIN).replace(/\/+$/, '');
}

/**
 * While a reset link is being completed, the recovery session it creates must NOT count as a
 * sign-in: the router would swap to the signed-in tree, which redirects /reset-password to the
 * index, and the traveler would never reach the new-password form. AuthProvider reads this.
 */
let recovering = false;
export const isRecoveringPassword = () => recovering;

/**
 * Validate the link BEFORE the traveler types a password, so an expired or used link fails early
 * (FR-017). Verifying consumes the one-time token and opens a recovery session; resolves to the
 * account's email.
 */
export async function verifyResetCode(oobCode: string): Promise<string> {
  recovering = true;
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: oobCode, type: 'recovery' });
  if (error || !data.user?.email) {
    recovering = false;
    throw error ?? new Error('auth/invalid-action-code');
  }
  return data.user.email;
}

/** Set the new password, then sign out — the same end state as Firebase's flow (FR-017). */
export async function completePasswordReset(_oobCode: string, newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
  recovering = false;
}

/**
 * Does this account have a password of the product's own? (feature 011.) A Google-only account
 * does not, so the profile screen must not offer "change your password" (FR-011). Asks whether a
 * password EXISTS, so an account with both keeps the option.
 */
export function hasPasswordProvider(user: AppUser | null): boolean {
  return Boolean(user?.providerData.some((p) => p.providerId === 'password'));
}

/**
 * Change the password of a signed-in account (feature 011, FR-015/FR-016). Re-entering the CURRENT
 * password is the check, as it was: it is verified by signing in with it before the change is made.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) throw new Error('not_signed_in');
  const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (check.error) throw check.error;
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

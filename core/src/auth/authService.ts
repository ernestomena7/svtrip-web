// Google sign-in / sign-out (US1, FR-001/FR-004).
// On the web we use Firebase's popup flow. Inside the native app (Capacitor),
// popups don't work in the webview, so we use the native Firebase Auth plugin
// and bridge the resulting credential into the Firebase JS SDK so the rest of
// the app (Firestore + BFF token) keeps working unchanged.
import { Capacitor } from '@capacitor/core';
import type { User } from 'firebase/auth';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  reauthenticateWithCredential,
  updatePassword,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export async function signInWithGoogle(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    const accessToken = result.credential?.accessToken;
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    await signInWithCredential(auth, credential);
  } else {
    await signInWithPopup(auth, googleProvider);
  }
}

export async function signOutUser(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut();
  }
  // Clears the persisted credential synchronously and without the network, which
  // is what FR-013 asks for offline; the SDK reconciles when connectivity returns.
  await signOut(auth);
}

// --- Email + password credentials (feature 003) -----------------------------
// Errors are thrown raw and normalized by the caller through `mapAuthError`, so
// no screen ever branches on a provider code (see authErrors.ts).

/**
 * Create an account and sign in (FR-001, FR-006).
 *
 * Does NOT create the profile document: `AuthProvider` already calls
 * `ensureUserProfile` on every auth-state change, and it is provider-agnostic,
 * so a password account gets the same profile a Google account does (FR-005).
 */
export async function registerWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

/** Sign in an existing password account (FR-007). */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Request a reset link (FR-014).
 *
 * Resolves even for addresses that are not registered — with email enumeration
 * protection enabled Firebase does not throw, and the caller MUST show its
 * confirmation on the success path unconditionally so an unknown address is
 * indistinguishable from a known one (FR-015).
 *
 * The link points back into the app rather than Firebase's hosted page: that
 * page cannot be built from the design system's tokens and picks its language
 * from the browser instead of the app's active language (research R5).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim(), {
    url: `${window.location.origin}/sign-in`,
    handleCodeInApp: false,
  });
}

/**
 * Validate a reset code before showing the new-password form, so an expired or
 * already-used link fails early rather than after the traveler has typed
 * a password (FR-017). Resolves to the account's email address.
 */
export function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

/** Set the new password; the code is consumed and cannot be reused (FR-017). */
export async function completePasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

/**
 * Does this account have a password of the product's own? (feature 011.)
 *
 * A Google account does not, so "change your password" has nothing to change and
 * "current password" has nothing to mean — which is why the profile screen must
 * not offer it (FR-011). Asks whether a password EXISTS rather than whether the
 * account is Google: an account that has linked both providers correctly keeps
 * the option.
 */
export function hasPasswordProvider(user: User | null): boolean {
  return Boolean(user?.providerData.some((p) => p.providerId === 'password'));
}

/**
 * Change the password of a signed-in account (feature 011, FR-015/FR-016).
 *
 * The reauthentication IS the current-password check, and that is not a
 * shortcut — Firebase refuses `updatePassword` on a session that is not recent
 * (`auth/requires-recent-login`), so reauthenticating was always going to be
 * necessary. Doing it with the password the traveler just typed proves the
 * password is correct AND refreshes the session in one call. Verifying the
 * current password separately would check the same secret twice and still leave
 * the reauth to do.
 *
 * Confirmation matching is the caller's job — it is a form concern with nothing
 * to ask the server about.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('not_signed_in');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

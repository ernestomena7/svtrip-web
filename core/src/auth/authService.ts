// Google sign-in / sign-out (US1, FR-001/FR-004).
// On the web we use Firebase's popup flow. Inside the native app (Capacitor),
// popups don't work in the webview, so we use the native Firebase Auth plugin
// and bridge the resulting credential into the Firebase JS SDK so the rest of
// the app (Firestore + BFF token) keeps working unchanged.
import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
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

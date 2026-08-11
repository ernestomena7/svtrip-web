// Firebase auth error -> one closed set of app-level codes (T005).
//
// This module exists for a security reason, not tidiness. FR-008 requires a
// wrong password and an unregistered email to be INDISTINGUISHABLE: if a screen
// branched on the raw Firebase code, an attacker could enumerate which addresses
// have accounts. Screens render `messageKey` and MUST NOT inspect raw codes.
//
// The platform does most of the work — `emailPrivacyConfig.enableImprovedEmailPrivacy`
// is enabled on this project, so Firebase already collapses both failures into
// `auth/invalid-credential` (verified, see validation-results.md T001-T003).
// This mapping makes that guarantee explicit and testable rather than implicit.

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'registration_failed'
  | 'weak_password'
  | 'invalid_email'
  | 'reset_link_expired'
  | 'reset_link_invalid'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export interface MappedAuthError {
  code: AuthErrorCode;
  /** i18n key the screen renders. Ships in both locales in the same change. */
  messageKey: string;
}

/** Minimum password length. Also enforced by the project policy, so the rule
 *  cannot be bypassed by calling the REST API directly (FR-004). */
export const MIN_PASSWORD_LENGTH = 8;

const MAP: Record<string, MappedAuthError> = {
  // FR-008 — every credential failure collapses here. Never split these.
  'auth/invalid-credential': { code: 'invalid_credentials', messageKey: 'auth.errors.invalidCredentials' },
  'auth/wrong-password': { code: 'invalid_credentials', messageKey: 'auth.errors.invalidCredentials' },
  'auth/user-not-found': { code: 'invalid_credentials', messageKey: 'auth.errors.invalidCredentials' },
  'auth/invalid-login-credentials': { code: 'invalid_credentials', messageKey: 'auth.errors.invalidCredentials' },

  // FR-003 — Firebase still reveals existence here; the neutral copy is the
  // mitigation. See research R3 for why this is a copy problem, not a technical one.
  'auth/email-already-in-use': { code: 'registration_failed', messageKey: 'auth.errors.registrationFailed' },

  'auth/weak-password': { code: 'weak_password', messageKey: 'auth.errors.weakPassword' },
  'auth/password-does-not-meet-requirements': { code: 'weak_password', messageKey: 'auth.errors.weakPassword' },
  'auth/invalid-email': { code: 'invalid_email', messageKey: 'auth.errors.invalidEmail' },

  // FR-017 — expired and already-used/superseded links.
  'auth/expired-action-code': { code: 'reset_link_expired', messageKey: 'auth.errors.resetLinkExpired' },
  'auth/invalid-action-code': { code: 'reset_link_invalid', messageKey: 'auth.errors.resetLinkInvalid' },

  'auth/too-many-requests': { code: 'rate_limited', messageKey: 'auth.errors.rateLimited' },
  'auth/network-request-failed': { code: 'network', messageKey: 'auth.errors.network' },
};

const UNKNOWN: MappedAuthError = { code: 'unknown', messageKey: 'common.somethingWrong' };

/**
 * Normalize any thrown auth error. Unrecognized codes fall back to a generic
 * message so raw provider text can never reach the UI.
 */
export function mapAuthError(err: unknown): MappedAuthError {
  const raw = (err as { code?: unknown })?.code;
  if (typeof raw !== 'string') return UNKNOWN;
  return MAP[raw] ?? UNKNOWN;
}

/** Client-side password check so the traveler gets an immediate, localized message. */
export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

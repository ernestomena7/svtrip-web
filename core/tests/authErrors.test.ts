// T006/T010 — the anti-enumeration guarantee, pinned.
//
// If these tests ever fail, the app has started telling an attacker which email
// addresses have accounts. That is a security defect, which is why this mapping
// is tested even though the rest of the UI is not heavily unit-tested
// (Constitution III weighs security contracts above breadth).
import { describe, it, expect } from 'vitest';
import { mapAuthError, mapPasswordChangeError, isPasswordLongEnough, MIN_PASSWORD_LENGTH } from '../src/auth/authErrors';

const err = (code: string) => Object.assign(new Error(code), { code });

describe('mapAuthError — FR-008 indistinguishable credential failures', () => {
  it('maps a wrong password and an unknown email to the SAME code', () => {
    const wrongPassword = mapAuthError(err('auth/wrong-password'));
    const unknownEmail = mapAuthError(err('auth/user-not-found'));

    expect(wrongPassword).toEqual(unknownEmail);
    expect(wrongPassword.code).toBe('invalid_credentials');
  });

  it('maps the platform-collapsed code to that same result', () => {
    // With email enumeration protection enabled, this is what Firebase actually
    // returns for both cases (verified in validation-results.md).
    expect(mapAuthError(err('auth/invalid-credential')).code).toBe('invalid_credentials');
    expect(mapAuthError(err('auth/invalid-login-credentials')).code).toBe('invalid_credentials');
  });

  it('renders one shared message key for every credential failure', () => {
    const keys = [
      'auth/invalid-credential',
      'auth/wrong-password',
      'auth/user-not-found',
      'auth/invalid-login-credentials',
    ].map((c) => mapAuthError(err(c)).messageKey);

    expect(new Set(keys).size).toBe(1);
  });
});

describe('mapAuthError — FR-003 duplicate registration', () => {
  it('maps an existing email to the neutral registration failure', () => {
    const mapped = mapAuthError(err('auth/email-already-in-use'));
    expect(mapped.code).toBe('registration_failed');
    expect(mapped.messageKey).toBe('auth.errors.registrationFailed');
  });

  it('does not reuse the credential-failure key, so the copy can differ', () => {
    // Registration needs its own wording ("if you already have an account, sign
    // in") without confirming the address exists.
    expect(mapAuthError(err('auth/email-already-in-use')).messageKey).not.toBe(
      mapAuthError(err('auth/invalid-credential')).messageKey,
    );
  });
});

describe('mapAuthError — reset links (FR-017)', () => {
  it('distinguishes an expired link from an invalid or superseded one', () => {
    expect(mapAuthError(err('auth/expired-action-code')).code).toBe('reset_link_expired');
    expect(mapAuthError(err('auth/invalid-action-code')).code).toBe('reset_link_invalid');
  });
});

describe('mapAuthError — fallback', () => {
  it('never leaks an unrecognized provider code to the UI', () => {
    const mapped = mapAuthError(err('auth/some-future-code'));
    expect(mapped.code).toBe('unknown');
    expect(mapped.messageKey).toBe('common.somethingWrong');
  });

  it('handles non-Firebase throwables', () => {
    expect(mapAuthError(new Error('boom')).code).toBe('unknown');
    expect(mapAuthError(null).code).toBe('unknown');
    expect(mapAuthError({ code: 42 }).code).toBe('unknown');
  });
});

// Feature 023 (T049): Supabase Auth's OWN codes, folded into the same outcomes the Firebase codes
// mapped to above. This is the "extend its tests" half of the task — the mapping existed in the
// code with no case pinning it, so a typo in one of these strings (e.g. `user_not_found` vs
// Supabase's actual `user_not_found`) would have shipped silently as "unknown".
describe('mapAuthError — Supabase Auth codes collapse into the SAME outcomes', () => {
  it('still collapses wrong-credential shapes into one code — the enumeration rule, on the new provider', () => {
    const wrongPassword = mapAuthError(err('invalid_credentials'));
    const unknownEmail = mapAuthError(err('user_not_found'));
    expect(wrongPassword).toEqual(unknownEmail);
    expect(wrongPassword.code).toBe('invalid_credentials');
  });

  it('maps both of Supabase\'s "already registered" codes to the neutral registration failure', () => {
    expect(mapAuthError(err('user_already_exists')).code).toBe('registration_failed');
    expect(mapAuthError(err('email_exists')).code).toBe('registration_failed');
  });

  it('maps weak_password and email_address_invalid', () => {
    expect(mapAuthError(err('weak_password')).code).toBe('weak_password');
    expect(mapAuthError(err('email_address_invalid')).code).toBe('invalid_email');
  });

  it('maps reset-link failures: otp_expired, bad_code_verifier, flow_state_expired', () => {
    expect(mapAuthError(err('otp_expired')).code).toBe('reset_link_expired');
    expect(mapAuthError(err('bad_code_verifier')).code).toBe('reset_link_invalid');
    expect(mapAuthError(err('flow_state_expired')).code).toBe('reset_link_expired');
  });

  it('maps both of Supabase\'s rate-limit codes', () => {
    expect(mapAuthError(err('over_request_rate_limit')).code).toBe('rate_limited');
    expect(mapAuthError(err('over_email_send_rate_limit')).code).toBe('rate_limited');
  });

  it('recognizes an AuthRetryableFetchError (no `code`) as a network failure, not unknown', () => {
    const networkErr = Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError' });
    expect(mapAuthError(networkErr).code).toBe('network');
  });
});

describe('mapPasswordChangeError — feature 011, on Supabase codes', () => {
  it('names invalid_credentials as the WRONG current password, not the sign-in oracle message', () => {
    // The opposite of mapAuthError's rule, by design: the account is already proven, so naming the
    // actual field is not an enumeration leak. Re-pointing this globally would reopen that oracle —
    // the comment this guards against doing.
    expect(mapPasswordChangeError(err('invalid_credentials')).code).toBe('wrong_current_password');
  });

  it('treats reauthentication_needed as requiring a fresh sign-in', () => {
    expect(mapPasswordChangeError(err('reauthentication_needed')).code).toBe('requires_recent_login');
  });

  it('falls through to mapAuthError for anything else, e.g. weak_password', () => {
    expect(mapPasswordChangeError(err('weak_password')).code).toBe('weak_password');
  });
});

describe('isPasswordLongEnough — FR-004', () => {
  it('requires at least 8 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(isPasswordLongEnough('1234567')).toBe(false);
    expect(isPasswordLongEnough('12345678')).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(isPasswordLongEnough('')).toBe(false);
  });
});

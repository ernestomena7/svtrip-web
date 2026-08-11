// T006/T010 — the anti-enumeration guarantee, pinned.
//
// If these tests ever fail, the app has started telling an attacker which email
// addresses have accounts. That is a security defect, which is why this mapping
// is tested even though the rest of the UI is not heavily unit-tested
// (Constitution III weighs security contracts above breadth).
import { describe, it, expect } from 'vitest';
import { mapAuthError, isPasswordLongEnough, MIN_PASSWORD_LENGTH } from '../src/auth/authErrors';

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

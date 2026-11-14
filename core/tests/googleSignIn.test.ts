// Google sign-in on the phone (feature 023, R2). NEW FILE.
//
// Two ways it fails, both before any screen can show why:
//   1. Passing `scopes` makes @capgo/capacitor-social-login refuse on Android unless the main activity
//      is modified ("You CANNOT use scopes without modifying the main activity"). Every attempt on
//      the product owner's phone failed exactly so, 2026-10-22.
//   2. The nonce: Google must get the SHA-256 of a random value, Supabase the RAW value (it hashes it
//      itself to compare). Swapped, Supabase answers "nonces mismatch" — research R2's documented trap.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));

const initialize = vi.fn(async () => undefined);
const login = vi.fn(async (_args: { provider: string; options: Record<string, unknown> }) => ({
  provider: 'google',
  result: { idToken: 'google-id-token' },
}));
vi.mock('@capgo/capacitor-social-login', () => ({ SocialLogin: { initialize, login } }));

const signInWithIdToken = vi.fn(async (_args: { provider: string; token: string; nonce: string }) => ({ error: null }));
vi.mock('../src/supabase', () => ({ supabase: { auth: { signInWithIdToken } }, auth: { currentUser: null } }));

const { signInWithGoogle } = await import('../src/auth/authService');

beforeEach(() => {
  login.mockClear();
  signInWithIdToken.mockClear();
});

describe('signInWithGoogle on Android', () => {
  it('passes NO scopes to the plugin — the option that made every attempt fail', async () => {
    await signInWithGoogle();
    const { options } = login.mock.calls[0][0];
    expect(options).not.toHaveProperty('scopes');
    expect(options).not.toHaveProperty('scope');
  });

  it('gives Google the SHA-256 of the nonce and Supabase the raw value', async () => {
    await signInWithGoogle();
    const googleNonce = login.mock.calls[0][0].options.nonce as string;
    const { nonce: rawNonce, token, provider } = signInWithIdToken.mock.calls[0][0];
    expect(provider).toBe('google');
    expect(token).toBe('google-id-token');
    expect(rawNonce).not.toBe(googleNonce);
    expect(createHash('sha256').update(rawNonce).digest('hex')).toBe(googleNonce);
  });
});

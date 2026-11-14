// @vitest-environment jsdom
//
// Where the password-reset email points (feature 023). NEW FILE.
//
// Found on the first real reset email: requested from the Android app, the link went to
// `https://localhost/reset-password` — the WebView's own origin — and the mail app's browser showed
// "localhost refused to connect". A browser's origin is right; the native shell's is not. These
// cases pin both halves, because "always use the public address" would break the local dev flow and
// "always use the page's origin" is the bug.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let native = false;
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));

const reset = vi.fn(async () => ({ error: null }));
vi.mock('../src/supabase', () => ({ supabase: { auth: { resetPasswordForEmail: reset } }, auth: { currentUser: null } }));

const { requestPasswordReset, DEFAULT_WEB_ORIGIN } = await import('../src/auth/authService');

beforeEach(() => {
  reset.mockClear();
  native = false;
});

describe('requestPasswordReset — where the emailed link lands', () => {
  it('in a browser, returns to the page the traveler is on', async () => {
    await requestPasswordReset(' a@b.com ');
    expect(reset).toHaveBeenCalledWith('a@b.com', { redirectTo: `${window.location.origin}/reset-password` });
  });

  it('in the native app, points at the PUBLIC web address, never the WebView origin', async () => {
    native = true;
    await requestPasswordReset('a@b.com');
    const [, options] = reset.mock.calls[0] as unknown as [string, { redirectTo: string }];
    expect(options.redirectTo).toBe(`${DEFAULT_WEB_ORIGIN}/reset-password`);
    expect(options.redirectTo).not.toContain('localhost');
  });

  it('the public address is the one the auth redirect list allows', () => {
    // Supabase refuses a redirect outside its allow-list; app.svtrip.com/** is on it.
    expect(DEFAULT_WEB_ORIGIN).toBe('https://app.svtrip.com');
  });
});

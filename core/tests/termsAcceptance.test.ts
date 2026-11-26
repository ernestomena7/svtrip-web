// Feature 025 (T024, research R12): recording which Terms and Privacy versions a merchant accepted.
//
// Two consequences pinned, both measured lessons of this repo:
//   1. It must NOT stamp `profile_version`. Feature 020 measured that 62 of 71 live accounts are
//      grandfathered AND incomplete; a write that stamps the version on them ejects them into the
//      mandatory profile form. Any new profile write that piggybacks on `saveProfileFields` does that.
//   2. It never writes `terms_accepted_at` itself — the database trigger sets it to the server's clock
//      (R17, U6), so the evidence's time is not the browser's.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));

const { recordTermsAcceptance } = await import('../src/auth/userProfile');

const row = () => ({
  id: 'merchant',
  display_name: 'M',
  email: 'm@x.com',
  persona: 'traveler',
  onboarding_complete: true,
  preferences: { vibes: [] },
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
});

beforeEach(() => {
  fake.reset();
  fake.seed('profiles', [row()]);
});

describe('recordTermsAcceptance', () => {
  it('writes both versions', async () => {
    await recordTermsAcceptance('merchant', { termsVersion: '2026-11-24', privacyVersion: '2026-11-24' });
    const stored = fake.tables.profiles[0];
    expect(stored.terms_version).toBe('2026-11-24');
    expect(stored.privacy_version).toBe('2026-11-24');
  });

  it('does NOT stamp profile_version — an incomplete grandfathered account stays grandfathered', async () => {
    await recordTermsAcceptance('merchant', { termsVersion: '2026-11-24', privacyVersion: '2026-11-24' });
    expect(fake.tables.profiles[0].profile_version).toBeUndefined();
  });

  it('never writes terms_accepted_at — the database trigger owns that clock', async () => {
    await recordTermsAcceptance('merchant', { termsVersion: '2026-11-24', privacyVersion: '2026-11-24' });
    const update = fake.writesTo('profiles').find((w) => w.op === 'update')!;
    expect(Object.keys(update.values as Record<string, unknown>)).not.toContain('terms_accepted_at');
  });
});

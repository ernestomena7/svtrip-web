// Registration answers must survive the gap before the profile row exists (feature 023). NEW FILE.
//
// Found by the product owner on the first real sign-up on Supabase: the form asked for name, age,
// gender, country and marital status, the account was created — and the profile form asked for all
// of it AGAIN. RegisterScreen saves the fields right after `signUp`, while AuthProvider creates the
// profile row a tick later (deferred, to avoid a supabase-js deadlock). The save was an UPDATE on a
// row that did not exist yet: zero rows matched, Postgres reported success, the answers vanished.
// Firestore's merge-write created the document, which is why this never happened before.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', async () => {
  const real = await vi.importActual<typeof import('../src/supabase')>('../src/supabase');
  return { supabase: fake.client, auth: { currentUser: null }, toAppUser: real.toAppUser };
});

const { saveProfileFields, setPersona } = await import('../src/auth/userProfile');
const { PROFILE_VERSION } = await import('@svtrip/shared');

const UID = '11111111-2222-4333-8444-555555555555';
const signedInAs = (id: string, email = 'new@traveler.test') => {
  fake.client.auth.getSession = async () =>
    ({ data: { session: { user: { id, email, user_metadata: {}, app_metadata: {}, identities: [] } } } }) as never;
};

const ANSWERS = { firstName: 'Ana', lastName: 'López', gender: 'female', age: 30, countryCode: 'SV', maritalStatus: 'single' } as const;

beforeEach(() => {
  fake.reset();
  fake.client.auth.getSession = async () => ({ data: { session: null } }) as never;
});

describe('saveProfileFields right after sign-up — no profile row yet', () => {
  it('keeps every answer: the row is created, then filled', async () => {
    signedInAs(UID);
    expect(fake.tables.profiles ?? []).toHaveLength(0); // the exact state registration is in
    await saveProfileFields(UID, ANSWERS);

    const row = fake.tables.profiles.find((r) => r.id === UID)!;
    expect(row).toBeDefined();
    expect(row).toMatchObject({ first_name: 'Ana', last_name: 'López', gender: 'female', age: 30, country_code: 'SV', marital_status: 'single' });
    // Stamped AND complete — so the profile gate has nothing left to ask.
    expect(row.profile_version).toBe(PROFILE_VERSION);
    expect(row.display_name).toBe('Ana López');
  });

  it('is idempotent when AuthProvider creates the row at the same moment', async () => {
    signedInAs(UID);
    fake.seed('profiles', [
      { id: UID, display_name: 'Viajero', email: 'new@traveler.test', persona: 'traveler', onboarding_complete: false,
        preferences: { vibes: [], language: 'es' }, profile_version: PROFILE_VERSION, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]);
    await saveProfileFields(UID, ANSWERS);
    expect(fake.tables.profiles).toHaveLength(1);
    expect(fake.tables.profiles[0]).toMatchObject({ first_name: 'Ana', display_name: 'Ana López' });
  });

  it('never creates a row for ANOTHER account than the one signed in', async () => {
    signedInAs('99999999-0000-4000-8000-000000000000');
    await expect(saveProfileFields(UID, ANSWERS)).rejects.toThrow('profile_not_found');
    expect(fake.tables.profiles ?? []).toHaveLength(0);
  });
});

describe('a profile write that lands nowhere is an error, not a silent success', () => {
  it('throws profile_not_found instead of reporting success', async () => {
    await expect(setPersona(UID, 'provider')).rejects.toMatchObject({ code: 'profile_not_found' });
  });
});

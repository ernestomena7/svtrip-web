// `displayName` stays current when the profile is saved (feature 011, FR-017).
//
// THIS IS THE REGRESSION THAT IS INVISIBLE FROM THE SCREEN THAT CAUSES IT.
//
// `server/src/services/reviewService.ts` reads `displayName` from the profile
// for the author name on every public review, and `claimService.ts` reads it
// for the requester name in the operator's claim-approval queue. If
// `saveProfileFields` ever stops deriving that field, both fall back to their
// generic placeholders ("Viajero", "Usuario") — on reviews that are ALREADY
// PUBLISHED — and nothing on the profile screen where the edit was made would
// show it.
//
// CHANGED IN THE PORT (feature 023, FR-011): these cases read the captured
// Firestore `setDoc` and its `merge: true`. They now read the stored ROW after
// the write (snake_case columns) and the write's kind — an UPDATE of named
// columns is what "always merges" means in SQL, and it is checked by the other
// columns surviving. Each case's claim is unchanged.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));

const { saveProfileFields } = await import('../src/auth/userProfile');

const base = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  display_name: 'Viajero',
  email: 'u@x.com',
  persona: 'traveler',
  onboarding_complete: true,
  preferences: { language: 'es', vibes: [] },
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  ...over,
});
const stored = () => fake.tables.profiles.find((r) => r.id === 'u1')!;
const lastWrite = () => fake.writesTo('profiles').at(-1)!;

beforeEach(() => {
  fake.reset();
  fake.seed('profiles', [base()]);
});

describe('saveProfileFields keeps displayName current', () => {
  it('derives it from both names on a full save', async () => {
    await saveProfileFields('u1', { firstName: 'Gustavo', lastName: 'Carcamo' });
    expect(stored().display_name).toBe('Gustavo Carcamo');
  });

  it('rebuilds it from the stored half when only one name changes', async () => {
    // A traveler correcting a surname must not end up displayed as " Carcamo".
    fake.seed('profiles', [base({ first_name: 'Gustavo', last_name: 'Mena' })]);
    await saveProfileFields('u1', { lastName: 'Carcamo' });
    expect(stored().display_name).toBe('Gustavo Carcamo');
  });

  it('leaves the existing name alone on a partial save that has no names', async () => {
    // FR-020 lets a grandfathered account fill two fields at a time.
    fake.seed('profiles', [base({ display_name: 'Neto Mena' })]);
    await saveProfileFields('u1', { age: 34 });
    expect(lastWrite().values).not.toHaveProperty('display_name');
    expect(stored().display_name).toBe('Neto Mena');
  });

  it('stamps profile_version, which is what un-grandfathers a completed account', async () => {
    await saveProfileFields('u1', { firstName: 'Gustavo', lastName: 'Carcamo' });
    expect(stored().profile_version).toBe(11);
  });

  it('omits undefined fields rather than writing them as null', async () => {
    // An untouched field must stay untouched — writing null would erase a value the traveler never
    // edited.
    fake.seed('profiles', [base({ age: 41 })]);
    await saveProfileFields('u1', { firstName: 'Gustavo', lastName: 'Carcamo', age: undefined });
    expect('age' in (lastWrite().values as object)).toBe(false);
    expect(stored().age).toBe(41);
  });

  it('always merges, never replaces the row', async () => {
    // A replacing write would drop `preferences`, `persona` and `onboarding_complete` — everything
    // the account holds that this form does not know about.
    await saveProfileFields('u1', { firstName: 'Gustavo', lastName: 'Carcamo' });
    expect(lastWrite().op).toBe('update');
    expect(stored().preferences).toEqual({ language: 'es', vibes: [] });
    expect(stored().onboarding_complete).toBe(true);
  });
});

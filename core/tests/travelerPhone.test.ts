// `saveTravelerPhone` must not un-grandfather an account (feature 020, FR-008).
//
// Measured 2026-10-13: 62 of 71 accounts carried no `profileVersion` AND were missing five fields
// — the exact combination where stamping the version locks the account into the mandatory profile
// form. A traveler's reward for their first reservation would be losing the app.
//
// CHANGED IN THE PORT (feature 023, FR-011). These cases used to read a captured Firestore `setDoc`
// (its data and `merge: true`). They now read the ROW as stored in the table after the write,
// converted back through the same `profileFromRow` the app uses — so the consequence is asserted on
// what the gate will actually see, which is stronger than asserting on the write. "Merging rather
// than replacing" becomes: the write is an UPDATE of named columns, and every other column survives.
// The gate assertions themselves are unchanged.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { predatesProfileFields, isProfileComplete } from '@svtrip/shared';
import type { UserProfile } from '@svtrip/shared';
import { createFakeSupabase } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));

const { saveTravelerPhone } = await import('../src/auth/userProfile');
const { profileFromRow } = await import('@svtrip/shared');

/** An account that predates feature 011: no stamp, and missing all five fields. */
const pre011Row = () => ({
  id: 'alice',
  display_name: 'Alice',
  email: 'a@b.com',
  persona: 'traveler',
  onboarding_complete: true,
  preferences: { language: 'es', vibes: ['beach'] },
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
});

/** The gate, exactly as both surfaces evaluate it. */
function wouldBeGated(profile: UserProfile): boolean {
  return !predatesProfileFields(profile) && !isProfileComplete(profile);
}

const stored = () => fake.tables.profiles.find((r) => r.id === 'alice')!;
const lastWrite = () => fake.writesTo('profiles').at(-1)!;

beforeEach(() => {
  fake.reset();
  fake.seed('profiles', [pre011Row()]);
});

describe('saveTravelerPhone', () => {
  it('writes the phone as an UPDATE of named columns — everything else survives', async () => {
    await saveTravelerPhone('alice', '+503 7777 7777');
    expect(lastWrite().op).toBe('update');
    expect(stored().phone).toBe('+503 7777 7777');
    expect(stored().preferences).toEqual({ language: 'es', vibes: ['beach'] });
    expect(stored().persona).toBe('traveler');
  });

  it('does NOT stamp profile_version — the whole point of the function', async () => {
    await saveTravelerPhone('alice', '+503 7777 7777');
    expect(lastWrite().values).not.toHaveProperty('profile_version');
    expect(stored().profile_version).toBeUndefined();
  });

  it('leaves a pre-011 account STILL GRANDFATHERED afterwards', async () => {
    await saveTravelerPhone('alice', '+503 7777 7777');
    expect(predatesProfileFields(profileFromRow(stored()))).toBe(true);
  });

  it('does not push a pre-011 account into the mandatory profile form', async () => {
    // THE assertion, against the full gate expression, on the stored row.
    await saveTravelerPhone('alice', '+503 7777 7777');
    expect(wouldBeGated(profileFromRow(stored()))).toBe(false);
  });

  it('and the gate DOES fire once such an account is stamped — so the test above is not vacuous', () => {
    const stamped = profileFromRow({ ...pre011Row(), profile_version: 1 });
    expect(wouldBeGated(stamped)).toBe(true);
  });

  it('does not touch display_name, which two server-side services read', async () => {
    await saveTravelerPhone('alice', '+503 7777 7777');
    expect(lastWrite().values).not.toHaveProperty('display_name');
    expect(stored().display_name).toBe('Alice');
  });

});

describe('the phone is never a required field (FR-009, SC-010)', () => {
  it('is absent from missingProfileFields even when it is missing', () => {
    // Adding it there would gate every POST-011 account on a field the signup
    // flow never asks for — the mirror of the defect above, aimed at the other
    // 9 accounts.
    const complete = {
      firstName: 'Ana',
      lastName: 'Lopez',
      gender: 'feminine' as const,
      age: 30,
      countryCode: 'SV',
    };
    expect(isProfileComplete(complete as unknown as UserProfile)).toBe(true);
    // ...and still complete with no phone at all, which is the same statement
    // made from the direction a reader would check.
    expect(isProfileComplete({ ...complete, phone: undefined } as unknown as UserProfile)).toBe(
      true,
    );
  });
});

// T013 (feature 020, FR-008): remembering a traveler's phone WITHOUT locking
// them out of the app.
//
// THIS IS THE MOST CONSEQUENTIAL FOUR LINES IN THIS FEATURE, and the defect it
// guards was found by measurement rather than by reading.
//
// FR-008 says a phone given in the reservation form is remembered on the
// profile. The writer that already exists is `saveProfileFields()`, and
// extending its `Pick<>` is a one-line change. It also stamps
// `profileVersion: PROFILE_VERSION` on every call — feature 011's grandfathering
// stamp, whose ABSENCE is what makes an older account exempt from the mandatory
// profile form.
//
// So the one-line version un-grandfathers the account. And measured on the live
// project 2026-10-13:
//
//     users: 71
//     sin profileVersion (grandfathered): 62
//       de esas, incompletas: 62
//
// Every grandfathered account is also incomplete, which is the precise
// combination that makes the stamp fatal: the gate in `client/src/app/App.tsx`
// and `web/src/app/Router.tsx` reads
//
//     !predatesProfileFields(profile) && !isProfileComplete(profile)
//
// so 62 of 71 travelers — 87% — would be dropped into `CompleteProfileScreen` on
// their next render, unable to leave without filling five fields they were never
// asked for. The reward for making your first reservation would be being locked
// out.
//
// The assertions below are about THE CONSEQUENCE, not the mechanism. "The phone
// was written" passes either way; "the account is still grandfathered" is what
// actually matters, and the gate expression itself is pinned so a future writer
// that stamps through some other path still reddens this.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { predatesProfileFields, isProfileComplete } from '@svtrip/shared';
import type { UserProfile } from '@svtrip/shared';

/** The last document written, and how. */
let written: { data: Record<string, unknown>; merge: boolean } | null = null;
let existing: Record<string, unknown> = {};

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, _col: string, id: string) => ({ id }),
  getDoc: async () => ({ exists: () => true, data: () => existing }),
  setDoc: async (_ref: unknown, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
    written = { data, merge: Boolean(opts?.merge) };
  },
  onSnapshot: () => () => {},
  serverTimestamp: () => 'SERVER_TS',
}));
vi.mock('../src/firebase', () => ({ db: {} }));

const { saveTravelerPhone } = await import('../src/auth/userProfile');

/** An account that predates feature 011: no stamp, and missing all five fields. */
function pre011(): Record<string, unknown> {
  return { uid: 'alice', displayName: 'Alice', email: 'a@b.com', persona: 'traveler' };
}

/** The gate, exactly as both surfaces evaluate it. */
function wouldBeGated(profile: Record<string, unknown>): boolean {
  const p = profile as unknown as UserProfile;
  return !predatesProfileFields(p) && !isProfileComplete(p);
}

beforeEach(() => {
  written = null;
  existing = pre011();
});

describe('saveTravelerPhone', () => {
  it('writes the phone, merging rather than replacing', () => {
    return saveTravelerPhone('alice', '+503 7777 7777').then(() => {
      expect(written).not.toBeNull();
      expect(written!.data.phone).toBe('+503 7777 7777');
      expect(written!.merge).toBe(true);
    });
  });

  it('does NOT stamp profileVersion — the whole point of the function', () => {
    return saveTravelerPhone('alice', '+503 7777 7777').then(() => {
      expect(written!.data).not.toHaveProperty('profileVersion');
    });
  });

  it('leaves a pre-011 account STILL GRANDFATHERED afterwards', () => {
    // The consequence, asserted on the profile as it would read after the write
    // rather than on the write itself.
    return saveTravelerPhone('alice', '+503 7777 7777').then(() => {
      const after = { ...existing, ...written!.data };
      expect(predatesProfileFields(after as unknown as UserProfile)).toBe(true);
    });
  });

  it('does not push a pre-011 account into the mandatory profile form', () => {
    // THE assertion. It is written against the full gate expression so that a
    // future writer which stamps the account through some other path still
    // reddens this test, rather than only the `profileVersion` check above.
    return saveTravelerPhone('alice', '+503 7777 7777').then(() => {
      const after = { ...existing, ...written!.data };
      expect(wouldBeGated(after)).toBe(false);
    });
  });

  it('and the gate DOES fire once such an account is stamped — so the test above is not vacuous', () => {
    // Without this, "wouldBeGated is false" could be true because the gate never
    // fires for anybody, and the test would pass while asserting nothing. This
    // is the shape of the vacuous passes features 016 and 018 each found.
    const stamped = { ...pre011(), profileVersion: 1 };
    expect(wouldBeGated(stamped)).toBe(true);
  });

  it('does not touch displayName, which two server-side services read', () => {
    // Feature 011's FR-017: `reviewService.ts` and `claimService.ts` both read
    // `displayName` server-side. A writer that derived it from absent names
    // would blank the author on reviews that are already published.
    return saveTravelerPhone('alice', '+503 7777 7777').then(() => {
      expect(written!.data).not.toHaveProperty('displayName');
    });
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

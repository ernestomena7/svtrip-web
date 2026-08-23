// `displayName` stays current when the profile is saved (feature 011, FR-017).
//
// THIS IS THE REGRESSION THAT IS INVISIBLE FROM THE SCREEN THAT CAUSES IT.
//
// `server/src/services/reviewService.ts` reads `displayName` from the user
// document for the author name on every public review, and
// `claimService.ts` reads it for the requester name in the operator's
// claim-approval queue. Neither service is touched by feature 011. If
// `saveProfileFields` ever stops deriving that field, both fall back to their
// generic placeholders ("Viajero", "Usuario") — on reviews that are ALREADY
// PUBLISHED — and nothing on the profile screen where the edit was made would
// show it.
//
// The two services are server-side and not reachable from this workspace, so
// what is pinned here is the one thing that would break them: the write.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { saveProfileFields } = await import('../src/auth/userProfile');

beforeEach(() => {
  written = null;
  existing = {};
});

describe('saveProfileFields keeps displayName current', () => {
  it('derives it from both names on a full save', () => {
    return saveProfileFields('u1', { firstName: 'Gustavo', lastName: 'Carcamo' }).then(() => {
      expect(written?.data.displayName).toBe('Gustavo Carcamo');
    });
  });

  it('rebuilds it from the stored half when only one name changes', async () => {
    // A traveler correcting a surname must not end up displayed as " Carcamo".
    existing = { firstName: 'Gustavo', lastName: 'Mena' };
    await saveProfileFields('u1', { lastName: 'Carcamo' });
    expect(written?.data.displayName).toBe('Gustavo Carcamo');
  });

  it('leaves the existing name alone on a partial save that has no names', async () => {
    // FR-020 lets a grandfathered account fill two fields at a time. A save that
    // has not reached the name fields yet must not blank out whatever the
    // account currently displays on its published reviews.
    existing = { displayName: 'Neto Mena' };
    await saveProfileFields('u1', { age: 34 });
    expect(written?.data.displayName).toBeUndefined();
    expect(written?.merge).toBe(true);
  });

  it('stamps profileVersion, which is what un-grandfathers a completed account', async () => {
    await saveProfileFields('u1', { firstName: 'Gustavo', lastName: 'Carcamo' });
    expect(written?.data.profileVersion).toBe(11);
  });

  it('omits undefined fields rather than writing them as null', async () => {
    // Firestore rejects `undefined`, and an untouched field must stay untouched
    // — writing null would erase a value the traveler never edited.
    await saveProfileFields('u1', { firstName: 'Gustavo', lastName: 'Carcamo', age: undefined });
    expect('age' in (written?.data ?? {})).toBe(false);
  });

  it('always merges, never replaces the document', async () => {
    // A replacing write would drop `preferences`, `persona` and
    // `onboardingComplete` — everything the account holds that this form does
    // not know about.
    await saveProfileFields('u1', { firstName: 'Gustavo', lastName: 'Carcamo' });
    expect(written?.merge).toBe(true);
  });
});

// FR-002a (feature 020): emptying the opening hours turns reservations off, in
// the SAME write.
//
// THIS TEST EXISTS BECAUSE THE REQUIREMENT WAS FIRST BUILT WHERE NOTHING COULD
// REACH IT. `reservationService.saveOpeningHours()` was written in the BFF to do
// this, and no caller could ever have existed: the listing form on both surfaces
// writes hours straight to Firestore through `updateListing`, which the rules
// allow because the merchant owns the document. The API contract had been
// drafted from the feature's own logic rather than from how the screen already
// persisted its data — so a requirement read as done and was not.
//
// The write has to be ONE update, not two. Split, a crash between them leaves
// exactly the state this prevents: a place advertising reservations against
// hours that no longer exist.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpeningHour } from '@svtrip/shared';

let updated: Record<string, unknown> | null = null;

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_col: unknown, id: string) => ({ id }),
  updateDoc: async (_ref: unknown, data: Record<string, unknown>) => {
    updated = data;
  },
  addDoc: async () => ({ id: 'new' }),
  deleteDoc: async () => undefined,
  onSnapshot: () => () => {},
  query: () => ({}),
  where: () => ({}),
}));
vi.mock('../src/firebase', () => ({ db: {} }));
vi.mock('../src/repos/discoverRepo', () => ({ clearDiscoverCache: () => {} }));

const { updateListing } = await import('../src/repos/listingsRepo');

const OPEN: OpeningHour[] = [{ day: 1, open: '09:00', close: '17:00', closed: false }];
const ALL_CLOSED: OpeningHour[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  open: '09:00',
  close: '17:00',
  closed: true,
}));

beforeEach(() => {
  updated = null;
});

describe('updateListing and FR-002a', () => {
  it('clears `reservationsEnabled` when the hours are emptied', async () => {
    await updateListing('l1', { openingHours: [] });
    expect(updated).not.toBeNull();
    expect(updated!.reservationsEnabled).toBe(false);
  });

  it('clears it when every day is marked CLOSED, not only when the array is empty', async () => {
    // Seven closed days is the shape the Firestore rules cannot refuse — they
    // have no predicate over an array's elements, so `size() > 0` is all a rule
    // can say. This is the half that holds the line the rule cannot.
    await updateListing('l1', { openingHours: ALL_CLOSED });
    expect(updated!.reservationsEnabled).toBe(false);
  });

  it('does it in ONE write, together with the hours', async () => {
    // Not "then another update". Split into two writes, a failure between them
    // leaves the place advertising reservations against hours that are gone.
    await updateListing('l1', { openingHours: [] });
    expect(updated).toMatchObject({ openingHours: [], reservationsEnabled: false });
  });

  it('does NOT touch the flag when the hours are still usable', async () => {
    // The merchant may be editing one day of a working week. Clearing the switch
    // on every hours save would be a control that turns itself off for no reason
    // the merchant can see.
    await updateListing('l1', { openingHours: OPEN });
    expect(updated).not.toHaveProperty('reservationsEnabled');
  });

  it('does NOT touch the flag on a save that does not include hours at all', async () => {
    // A merchant changing their description must not lose reservations. This is
    // the case that makes the guard a precondition rather than a blanket.
    await updateListing('l1', { description: 'nueva' });
    expect(updated).not.toHaveProperty('reservationsEnabled');
    expect(updated).toMatchObject({ description: 'nueva' });
  });
});

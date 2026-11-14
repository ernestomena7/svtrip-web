// @vitest-environment jsdom
//
// `renderHook` needs a DOM. Scoped with the pragma rather than switching the
// whole workspace, the way `avatar.test.tsx` and `taxonomyIcon.test.tsx`
// already do here — everything else in `core/tests` is pure logic and should
// keep running without one.
//
// T038/T039/T050 (feature 020): the groupings both surfaces render.
//
// TESTED HERE RATHER THAN IN TWO SCREEN SUITES, and that is the point. The
// Próximas/Pasadas split (FR-015), the nearest-one card (FR-016) and the
// Pendientes/Confirmadas/Historial tabs (FR-018) are all derived in this one
// repo from `shared`'s resolver. Asserting them on each screen would test the
// same logic twice and still leave the two free to disagree — which is exactly
// the defect feature 014 left alive in desktop Discover and three features have
// recorded without fixing.
//
// THE CASES THAT CARRY THIS FILE are the elapsed ones. Every group reads the
// DERIVED state, so a request whose moment has passed moves on its own, with
// nothing having run — this product has no cron, no scheduled function and no
// job (measured at 018). Grouped on `recorded` instead, a lapsed request would
// sit in Pendientes forever and the merchant's count would climb with work
// nobody can do.
//
// CHANGED IN THE PORT (feature 023, FR-011): the Firestore `onSnapshot` double — which delivered
// synchronously — is replaced by the shared Supabase fake behind the real `subscribeLive`, whose
// first read is ASYNC. So each case awaits the hook leaving `loading` before it asserts; that is the
// only edit to the case bodies (`async` + `await render(...)`). The fake applies the repo's own
// filter (traveler_uid / merchant_uid) and its `order('at')`, so the double stays honest: a case
// cannot pass because the hook happened to re-sort.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Reservation } from '@svtrip/shared';
import { createFakeSupabase } from './fakeSupabase';

let stored: Reservation[] = [];

const fake = createFakeSupabase();
let toRowRef: ((t: 'reservations', v: Record<string, unknown>) => Record<string, unknown>) | null = null;
vi.mock('../src/supabase', () => ({
  auth: { currentUser: null },
  supabase: {
    from: (table: 'reservations') => {
      fake.seed(table, stored.map((r) => toRowRef!(table, { ...r })));
      return fake.client.from(table);
    },
    channel: () => fake.client.channel(),
    removeChannel: () => fake.client.removeChannel(),
  },
}));
const { toRow } = await import('@svtrip/shared');
toRowRef = toRow;

/** Renders a hook and waits for its first read to land. */
async function render<T extends { loading: boolean }>(hook: () => T) {
  const r = renderHook(hook);
  await waitFor(() => expect(r.result.current.loading).toBe(false));
  return r;
}

const { useMyReservations, useNextReservation, useReservationInbox } = await import(
  '../src/repos/reservationsRepo'
);

// A fixed instant: 2026-10-20T18:00 local (El Salvador, UTC-6, no DST).
const NOW = new Date('2026-10-21T00:00:00Z');

function res(over: Partial<Reservation> = {}): Reservation {
  return {
    reservationId: 'r1',
    listingId: 'l1',
    travelerUid: 'alice',
    merchantUid: 'bob',
    at: '2026-12-01T20:00',
    people: 2,
    contactName: 'Alice',
    contactEmail: 'a@b.com',
    recorded: 'pending',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe('useMyReservations — Próximas and Pasadas (FR-015)', () => {
  it('puts a pending future reservation in Próximas', async () => {
    stored = [res()];
    const { result } = await render(() => useMyReservations('alice', NOW));
    expect(result.current.upcoming.map((r) => r.reservationId)).toEqual(['r1']);
    expect(result.current.past).toHaveLength(0);
  });

  it('moves an ELAPSED pending reservation to Pasadas, with nothing having run', async () => {
    // The case the derived state exists for. `recorded` is still 'pending' in
    // the document; only time moved.
    stored = [res({ at: '2026-10-01T20:00' })];
    const { result } = await render(() => useMyReservations('alice', NOW));
    expect(result.current.upcoming).toHaveLength(0);
    expect(result.current.past[0].state).toBe('expirada');
  });

  it('moves an elapsed CONFIRMED one to Pasadas as completada', async () => {
    stored = [res({ at: '2026-10-01T20:00', recorded: 'confirmed' })];
    const { result } = await render(() => useMyReservations('alice', NOW));
    expect(result.current.past[0].state).toBe('completada');
  });

  it('keeps a CANCELLED one out of Próximas even while its moment is still ahead', async () => {
    stored = [res({ recorded: 'cancelled' })];
    const { result } = await render(() => useMyReservations('alice', NOW));
    expect(result.current.upcoming).toHaveLength(0);
    expect(result.current.past[0].state).toBe('cancelada');
  });

  it('orders Próximas soonest-first and Pasadas most-recent-first', async () => {
    // Same data, opposite ends: a traveler planning wants the next thing, and a
    // traveler looking back wants the last thing.
    stored = [
      res({ reservationId: 'soon', at: '2026-11-01T20:00' }),
      res({ reservationId: 'later', at: '2026-12-01T20:00' }),
      res({ reservationId: 'old', at: '2026-09-01T20:00' }),
      res({ reservationId: 'older', at: '2026-08-01T20:00' }),
    ];
    const { result } = await render(() => useMyReservations('alice', NOW));
    expect(result.current.upcoming.map((r) => r.reservationId)).toEqual(['soon', 'later']);
    expect(result.current.past.map((r) => r.reservationId)).toEqual(['old', 'older']);
  });

  it('returns nothing at all for a signed-out traveler', async () => {
    stored = [res()];
    const { result } = await render(() => useMyReservations(undefined, NOW));
    expect(result.current.upcoming).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });
});

describe('useNextReservation — the NEAREST one only (FR-016)', () => {
  it('returns the soonest upcoming reservation', async () => {
    stored = [
      res({ reservationId: 'later', at: '2026-12-01T20:00' }),
      res({ reservationId: 'soon', at: '2026-11-01T20:00' }),
    ];
    const { result } = await render(() => useNextReservation('alice', NOW));
    expect(result.current.next?.reservationId).toBe('soon');
  });

  it('returns NULL with none upcoming, so the card renders nothing', async () => {
    // Not an empty object, not a placeholder. Explorar belongs to discovery, and
    // a traveler with no reservation must see no trace of the feature there.
    stored = [res({ at: '2026-09-01T20:00' })];
    const { result } = await render(() => useNextReservation('alice', NOW));
    expect(result.current.next).toBeNull();
  });

  it('ignores a cancelled reservation even when it is the soonest by date', async () => {
    stored = [
      res({ reservationId: 'cancelled-soon', at: '2026-11-01T20:00', recorded: 'cancelled' }),
      res({ reservationId: 'real', at: '2026-12-01T20:00' }),
    ];
    const { result } = await render(() => useNextReservation('alice', NOW));
    expect(result.current.next?.reservationId).toBe('real');
  });
});

describe('useReservationInbox — the three tabs (FR-018)', () => {
  it('orders Pendientes by NEAREST reservation date', async () => {
    stored = [
      res({ reservationId: 'far', at: '2026-12-20T20:00' }),
      res({ reservationId: 'near', at: '2026-11-02T20:00' }),
    ];
    const { result } = await render(() => useReservationInbox('bob', NOW));
    expect(result.current.pending.map((r) => r.reservationId)).toEqual(['near', 'far']);
  });

  it('counts only the genuinely pending ones', async () => {
    stored = [
      res({ reservationId: 'p' }),
      res({ reservationId: 'c', recorded: 'confirmed' }),
      res({ reservationId: 'x', recorded: 'rejected' }),
    ];
    const { result } = await render(() => useReservationInbox('bob', NOW));
    expect(result.current.pendingCount).toBe(1);
  });

  it('drops an ELAPSED pending request into Historial, not Pendientes', async () => {
    // THE case this tab split exists for. On `recorded` alone it would sit in
    // Pendientes forever, waiting for an answer nobody can usefully give — and
    // the merchant's count would keep climbing with work that cannot be done.
    stored = [res({ at: '2026-09-01T20:00' })];
    const { result } = await render(() => useReservationInbox('bob', NOW));
    expect(result.current.pending).toHaveLength(0);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.history[0].state).toBe('expirada');
  });

  it('puts a rejected request in Historial whichever side rejected it', async () => {
    stored = [res({ recorded: 'rejected' }), res({ reservationId: 'r2', recorded: 'cancelled' })];
    const { result } = await render(() => useReservationInbox('bob', NOW));
    expect(result.current.history).toHaveLength(2);
    expect(result.current.confirmed).toHaveLength(0);
  });

  it('keeps an elapsed CONFIRMED request out of Confirmadas', async () => {
    stored = [res({ at: '2026-09-01T20:00', recorded: 'confirmed' })];
    const { result } = await render(() => useReservationInbox('bob', NOW));
    expect(result.current.confirmed).toHaveLength(0);
    expect(result.current.history[0].state).toBe('completada');
  });
});

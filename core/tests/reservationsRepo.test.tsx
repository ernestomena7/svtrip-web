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
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Reservation } from '@svtrip/shared';

let stored: Reservation[] = [];

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  onSnapshot: (_q: unknown, next: (snap: unknown) => void) => {
    // The real query is `orderBy('at')`, so the docs arrive sorted. Sorting here
    // too keeps the double honest rather than letting a test pass because the
    // hook happened to re-sort.
    const docs = [...stored]
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      .map((r) => ({ id: r.reservationId, data: () => r }));
    next({ docs });
    return () => {};
  },
}));
vi.mock('../src/firebase', () => ({ db: {} }));

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
  it('puts a pending future reservation in Próximas', () => {
    stored = [res()];
    const { result } = renderHook(() => useMyReservations('alice', NOW));
    expect(result.current.upcoming.map((r) => r.reservationId)).toEqual(['r1']);
    expect(result.current.past).toHaveLength(0);
  });

  it('moves an ELAPSED pending reservation to Pasadas, with nothing having run', () => {
    // The case the derived state exists for. `recorded` is still 'pending' in
    // the document; only time moved.
    stored = [res({ at: '2026-10-01T20:00' })];
    const { result } = renderHook(() => useMyReservations('alice', NOW));
    expect(result.current.upcoming).toHaveLength(0);
    expect(result.current.past[0].state).toBe('expirada');
  });

  it('moves an elapsed CONFIRMED one to Pasadas as completada', () => {
    stored = [res({ at: '2026-10-01T20:00', recorded: 'confirmed' })];
    const { result } = renderHook(() => useMyReservations('alice', NOW));
    expect(result.current.past[0].state).toBe('completada');
  });

  it('keeps a CANCELLED one out of Próximas even while its moment is still ahead', () => {
    stored = [res({ recorded: 'cancelled' })];
    const { result } = renderHook(() => useMyReservations('alice', NOW));
    expect(result.current.upcoming).toHaveLength(0);
    expect(result.current.past[0].state).toBe('cancelada');
  });

  it('orders Próximas soonest-first and Pasadas most-recent-first', () => {
    // Same data, opposite ends: a traveler planning wants the next thing, and a
    // traveler looking back wants the last thing.
    stored = [
      res({ reservationId: 'soon', at: '2026-11-01T20:00' }),
      res({ reservationId: 'later', at: '2026-12-01T20:00' }),
      res({ reservationId: 'old', at: '2026-09-01T20:00' }),
      res({ reservationId: 'older', at: '2026-08-01T20:00' }),
    ];
    const { result } = renderHook(() => useMyReservations('alice', NOW));
    expect(result.current.upcoming.map((r) => r.reservationId)).toEqual(['soon', 'later']);
    expect(result.current.past.map((r) => r.reservationId)).toEqual(['old', 'older']);
  });

  it('returns nothing at all for a signed-out traveler', () => {
    stored = [res()];
    const { result } = renderHook(() => useMyReservations(undefined, NOW));
    expect(result.current.upcoming).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });
});

describe('useNextReservation — the NEAREST one only (FR-016)', () => {
  it('returns the soonest upcoming reservation', () => {
    stored = [
      res({ reservationId: 'later', at: '2026-12-01T20:00' }),
      res({ reservationId: 'soon', at: '2026-11-01T20:00' }),
    ];
    const { result } = renderHook(() => useNextReservation('alice', NOW));
    expect(result.current.next?.reservationId).toBe('soon');
  });

  it('returns NULL with none upcoming, so the card renders nothing', () => {
    // Not an empty object, not a placeholder. Explorar belongs to discovery, and
    // a traveler with no reservation must see no trace of the feature there.
    stored = [res({ at: '2026-09-01T20:00' })];
    const { result } = renderHook(() => useNextReservation('alice', NOW));
    expect(result.current.next).toBeNull();
  });

  it('ignores a cancelled reservation even when it is the soonest by date', () => {
    stored = [
      res({ reservationId: 'cancelled-soon', at: '2026-11-01T20:00', recorded: 'cancelled' }),
      res({ reservationId: 'real', at: '2026-12-01T20:00' }),
    ];
    const { result } = renderHook(() => useNextReservation('alice', NOW));
    expect(result.current.next?.reservationId).toBe('real');
  });
});

describe('useReservationInbox — the three tabs (FR-018)', () => {
  it('orders Pendientes by NEAREST reservation date', () => {
    stored = [
      res({ reservationId: 'far', at: '2026-12-20T20:00' }),
      res({ reservationId: 'near', at: '2026-11-02T20:00' }),
    ];
    const { result } = renderHook(() => useReservationInbox('bob', NOW));
    expect(result.current.pending.map((r) => r.reservationId)).toEqual(['near', 'far']);
  });

  it('counts only the genuinely pending ones', () => {
    stored = [
      res({ reservationId: 'p' }),
      res({ reservationId: 'c', recorded: 'confirmed' }),
      res({ reservationId: 'x', recorded: 'rejected' }),
    ];
    const { result } = renderHook(() => useReservationInbox('bob', NOW));
    expect(result.current.pendingCount).toBe(1);
  });

  it('drops an ELAPSED pending request into Historial, not Pendientes', () => {
    // THE case this tab split exists for. On `recorded` alone it would sit in
    // Pendientes forever, waiting for an answer nobody can usefully give — and
    // the merchant's count would keep climbing with work that cannot be done.
    stored = [res({ at: '2026-09-01T20:00' })];
    const { result } = renderHook(() => useReservationInbox('bob', NOW));
    expect(result.current.pending).toHaveLength(0);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.history[0].state).toBe('expirada');
  });

  it('puts a rejected request in Historial whichever side rejected it', () => {
    stored = [res({ recorded: 'rejected' }), res({ reservationId: 'r2', recorded: 'cancelled' })];
    const { result } = renderHook(() => useReservationInbox('bob', NOW));
    expect(result.current.history).toHaveLength(2);
    expect(result.current.confirmed).toHaveLength(0);
  });

  it('keeps an elapsed CONFIRMED request out of Confirmadas', () => {
    stored = [res({ at: '2026-09-01T20:00', recorded: 'confirmed' })];
    const { result } = renderHook(() => useReservationInbox('bob', NOW));
    expect(result.current.confirmed).toHaveLength(0);
    expect(result.current.history[0].state).toBe('completada');
  });
});

// T007 (feature 020): the six reservation states, and the ORDER that produces them.
//
// Four states are stored; Expirada and Completada are derived from the moment
// against now, because this product has no cron, no scheduled function and no
// job — measured at feature 018, which built `subscriptionState.ts` on the same
// finding.
//
// **Cases 5 and 6 are the reason this module exists.** They are the only two
// that fail when the resolution order is wrong, and both are states a real
// traveler reaches: cancelling and then looking back is the ordinary path, not
// an edge. 018's equivalent — the internal plan checked before any date —
// reddened four cases when the order was swapped.
import { describe, it, expect } from 'vitest';
import {
  resolveReservationState,
  reservationLabelKey,
  localNow,
  RESERVATION_STATE_KEYS,
} from '../src/reservationState.js';

// A fixed instant, so nothing here depends on when the suite runs.
// 2026-10-20T18:00 local (El Salvador is UTC-6, year round, no DST).
const NOW = new Date('2026-10-21T00:00:00Z');
const NOW_LOCAL = '2026-10-20T18:00';

const FUTURE = '2026-10-25T20:00';
const PAST = '2026-10-15T20:00';

describe('resolveReservationState — the stored states that ignore time', () => {
  // Rows 5 and 6. Nothing may be moved above these two checks.
  it('a CANCELLED reservation whose moment has passed is cancelada, NOT completada', () => {
    // A traveler cancelled in March and looks back in April. Reading this as
    // Completada is the product telling them they attended something they
    // called off — and it makes FR-029's "Cancelada por ti" a lie about their
    // own action.
    expect(resolveReservationState('cancelled', PAST, NOW)).toBe('cancelada');
  });

  it('a REJECTED reservation whose moment has passed is rechazada, NOT expirada', () => {
    // Expirada means "nobody answered". This one was answered.
    expect(resolveReservationState('rejected', PAST, NOW)).toBe('rechazada');
  });

  it('a cancelled reservation in the future is cancelada', () => {
    expect(resolveReservationState('cancelled', FUTURE, NOW)).toBe('cancelada');
  });

  it('a rejected reservation in the future is rechazada', () => {
    expect(resolveReservationState('rejected', FUTURE, NOW)).toBe('rechazada');
  });
});

describe('resolveReservationState — the derived half', () => {
  it('pending and still ahead is pendiente', () => {
    expect(resolveReservationState('pending', FUTURE, NOW)).toBe('pendiente');
  });

  it('pending and already past is expirada', () => {
    expect(resolveReservationState('pending', PAST, NOW)).toBe('expirada');
  });

  it('confirmed and still ahead is confirmada', () => {
    expect(resolveReservationState('confirmed', FUTURE, NOW)).toBe('confirmada');
  });

  it('confirmed and already past is completada', () => {
    expect(resolveReservationState('confirmed', PAST, NOW)).toBe('completada');
  });

  it('a moment exactly equal to now has ARRIVED', () => {
    // `<=`, not `<`. At 18:00 sharp the 18:00 slot is no longer bookable and no
    // longer pending — it is happening.
    expect(resolveReservationState('pending', NOW_LOCAL, NOW)).toBe('expirada');
    expect(resolveReservationState('confirmed', NOW_LOCAL, NOW)).toBe('completada');
  });
});

describe('resolveReservationState — a malformed moment', () => {
  it('never resolves to a FUTURE state, and is never NaN-driven', () => {
    // Feature 016 measured the failure this guards: `new Date('2026-10-12T')` is
    // NaN, and a NaN comparison is false against everything — which would pin a
    // broken reservation on Pendiente forever, looking like a live request
    // nobody ever answers. A string comparison degrades the other way.
    for (const bad of ['', '2026-10-12T', 'no es una fecha', '2026-13-45T99:99']) {
      const state = resolveReservationState('pending', bad, NOW);
      expect(state).not.toBe('pendiente');
      expect(state).toBe('expirada');
    }
  });
});

describe('localNow — the timezone nobody had named', () => {
  it('formats in America/El_Salvador, not UTC', () => {
    // The BFF runs on Cloud Run in UTC. `at` is a LOCAL string, so a `now`
    // formatted from the UTC clock runs 6 hours ahead: every reservation would
    // read Expirada six hours early, on both surfaces, which is FR-028 broken by
    // a formatting choice. It never shows in local development, where the
    // developer's clock IS the local one.
    expect(localNow(NOW)).toBe(NOW_LOCAL);
  });

  it('a slot 3 hours ahead of a UTC evening is still FUTURE when read locally', () => {
    // 2026-10-20T23:00Z is 17:00 local. A 20:00 local slot that same day is
    // three hours ahead — but a UTC-formatted `now` would read "23:00" and call
    // the 20:00 slot past.
    const utcEvening = new Date('2026-10-20T23:00:00Z');
    expect(resolveReservationState('pending', '2026-10-20T20:00', utcEvening)).toBe('pendiente');
    // And the naive version, shown here so the failure is legible rather than
    // just asserted away:
    expect(utcEvening.toISOString().slice(0, 16)).toBe('2026-10-20T23:00');
  });
});

describe('reservationLabelKey — one function, two sides (FR-029)', () => {
  it('names the canceller and the rejecter from the reader s point of view', () => {
    expect(reservationLabelKey('cancelada', 'traveler')).toBe(
      'reservations.state.cancelledByYou',
    );
    expect(reservationLabelKey('cancelada', 'merchant')).toBe(
      'reservations.state.cancelledByClient',
    );
    expect(reservationLabelKey('rechazada', 'traveler')).toBe(
      'reservations.state.rejectedByMerchant',
    );
    expect(reservationLabelKey('rechazada', 'merchant')).toBe(
      'reservations.state.rejectedByYou',
    );
  });

  it('reads the SAME to both sides for the other four states', () => {
    // Only 2 of the 6 differ. An earlier draft of the task list said twelve keys
    // — six states times two sides — and that over-counted these four rows.
    for (const s of ['pendiente', 'confirmada', 'expirada', 'completada'] as const) {
      expect(reservationLabelKey(s, 'traveler')).toBe(reservationLabelKey(s, 'merchant'));
    }
  });

  it('yields exactly EIGHT distinct keys across every state and both sides', () => {
    const keys = new Set<string>();
    for (const s of [
      'pendiente',
      'confirmada',
      'rechazada',
      'cancelada',
      'expirada',
      'completada',
    ] as const) {
      keys.add(reservationLabelKey(s, 'traveler'));
      keys.add(reservationLabelKey(s, 'merchant'));
    }
    expect(keys.size).toBe(8);
    // And the exported list is the same set, so a screen can render a legend
    // without re-deriving it.
    expect(new Set(RESERVATION_STATE_KEYS)).toEqual(keys);
  });

  it('actually BRANCHES on viewer, which a sabotage that ignores it would not', () => {
    // Written as a behaviour assertion rather than a parameter count: feature
    // 017 found that `fn.length` stops at the first defaulted parameter, so a
    // signature check passed while the function did the forbidden thing.
    expect(reservationLabelKey('cancelada', 'traveler')).not.toBe(
      reservationLabelKey('cancelada', 'merchant'),
    );
  });
});

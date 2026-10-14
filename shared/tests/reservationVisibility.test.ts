// T029 (feature 020, FR-003): whether a place offers "Reservar" at all.
//
// WHY THIS IS A SHARED TEST RATHER THAN TWO SCREEN TESTS. The rule is one
// comparison — `reservationsEnabled === true` — and it has to read identically
// on the phone and on the desktop, because FR-006 of this feature forbids the
// two surfaces disagreeing. Feature 014 left exactly that defect alive in
// desktop Discover (it iterates the static `MOODS` constant while the phone uses
// the live taxonomy), and three features have now recorded it without fixing it.
// So the predicate lives in one place with nothing else in its import graph, the
// way feature 017 moved `visibleMoods` out of its component so it could be
// tested without Firebase.
//
// THE CASE THAT CARRIES THIS FILE is "a listing with no such field at all". All
// 33 live listings are that shape, so `=== true` and `!== false` agree on every
// document that exists and disagree only on what this feature creates. The
// lenient form — which is the CORRECT one for 018's `covered`, four fields away
// in the same type — would put a reservation button on every beach, volcano and
// town in the catalog, none of which has opening hours.
import { describe, it, expect } from 'vitest';
import type { Place } from '../src/types.js';
import { offersReservations, visibleServices } from '../src/reservationState.js';

function place(over: Partial<Place> = {}): Place {
  return {
    placeId: 'p1',
    name: 'El Barrilon',
    description: '',
    moods: [],
    categories: [],
    rating: 0,
    lat: 13.7,
    lng: -89.2,
    photos: [],
    trending: false,
    colonialTown: false,
    keywords: [],
    source: 'listing',
    ...over,
  };
}

describe('offersReservations', () => {
  it('is FALSE when the field is absent — the shape of all 33 live listings', () => {
    expect(offersReservations(place())).toBe(false);
  });

  it('is false when it is explicitly false', () => {
    expect(offersReservations(place({ reservationsEnabled: false }))).toBe(false);
  });

  it('is TRUE only when it is explicitly true', () => {
    expect(offersReservations(place({ reservationsEnabled: true }))).toBe(true);
  });

  it('is false for a seed destination, which can never have an owner to answer', () => {
    // A beach has no merchant. Even if the field somehow arrived true, there is
    // nobody on the other end of the request — so this fails closed rather than
    // offering a traveler a form that reaches no inbox.
    expect(offersReservations(place({ source: 'seed', reservationsEnabled: true }))).toBe(false);
  });

  it('is false for a listing whose subscription no longer covers it', () => {
    // Feature 018's visibility rule still applies: a suspended place is not
    // offered. The server refuses such a request too (409 `listing_not_visible`),
    // and this is the UI half so a traveler is never shown a door that is barred.
    expect(offersReservations(place({ reservationsEnabled: true, covered: false }))).toBe(false);
  });

  it('IS true for a listing with no `covered` field — 018s default, unchanged', () => {
    // `covered !== false`, never `covered === true`. Measured at 018: all 33
    // live listings carry no such field, so the strict form would empty the
    // catalog. The two defaults in this one function point in OPPOSITE
    // directions, and that is the whole reason this test exists.
    expect(offersReservations(place({ reservationsEnabled: true, covered: undefined }))).toBe(true);
  });
});

describe('visibleServices — the chip that advertised something unavailable', () => {
  // `businessTypes.ts:64` has offered `'reservations'` as a declarable service
  // since feature 005, FOUR features before this one, and nothing in this
  // feature's first draft of artifacts noticed. A restaurant that ticked it with
  // the switch off shipped a profile advertising reservations with no way to
  // make one — FR-034's problem exactly.
  const withChip = { services: ['reservations', 'outdoor-seating', 'delivery'] };

  it('hides the reservations chip when the switch is OFF', () => {
    expect(visibleServices({ ...withChip, source: 'listing' })).toEqual([
      'outdoor-seating',
      'delivery',
    ]);
  });

  it('shows it when the switch is on', () => {
    expect(
      visibleServices({ ...withChip, source: 'listing', reservationsEnabled: true }),
    ).toContain('reservations');
  });

  it('hides `appointments` the same way — wellness-spa has its own word for it', () => {
    expect(visibleServices({ services: ['appointments', 'massage'], source: 'listing' })).toEqual([
      'massage',
    ]);
  });

  it('leaves every other service alone', () => {
    const all = ['outdoor-seating', 'delivery', 'takeaway', 'vegetarian'];
    expect(visibleServices({ services: all, source: 'listing' })).toEqual(all);
  });

  it('hides it on a place feature 018 no longer covers, even with the flag on', () => {
    // Fails closed through the same predicate: if the place is not offered at
    // all, it must not advertise the thing it cannot deliver either.
    expect(
      visibleServices({
        ...withChip,
        source: 'listing',
        reservationsEnabled: true,
        covered: false,
      }),
    ).not.toContain('reservations');
  });

  it('handles a place with no services at all', () => {
    expect(visibleServices({ source: 'listing' })).toEqual([]);
  });
});

// T010 (feature 020): `hasUsableHours()` — the half of FR-002 that CANNOT live
// in the Firestore rules.
//
// Rules have no filter, no map and no predicate over list elements, so a rule
// can enforce `openingHours.size() > 0` and nothing stronger. This is the rest,
// and it is in `shared/` because the BFF applies it (409 `hours_unusable`) and
// both surfaces need the same answer.
//
// Measured on the live project 2026-10-13: all 33 listings carry the field as an
// ARRAY, 32 of them holding `[]`. So the empty case below is not an edge — it is
// 97% of the catalog.
import { describe, it, expect } from 'vitest';
import type { OpeningHour } from '../src/types.js';
import { hasUsableHours } from '../src/openingHours.js';

function day(over: Partial<OpeningHour> = {}): OpeningHour {
  return { day: 1, open: '09:00', close: '17:00', closed: false, ...over };
}

describe('hasUsableHours', () => {
  it('is false for an empty array — 32 of the 33 live listings', () => {
    expect(hasUsableHours([])).toBe(false);
  });

  it('is false when the field is absent, rather than throwing', () => {
    // A listing written before this feature has no reason to carry it, and a
    // throw here would surface as a broken merchant screen rather than as a
    // business that has not filled its hours in.
    expect(hasUsableHours(undefined)).toBe(false);
    expect(hasUsableHours(null as unknown as OpeningHour[])).toBe(false);
  });

  it('is false for seven days ALL marked closed', () => {
    // This is the residual gap the rules cannot close: a client bypassing the UI
    // could enable reservations with exactly this. The result is a place whose
    // every slot is unselectable — an empty calendar, not an exploit. Same shape
    // as 018's Básico cap, where a second place is simply not covered.
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => day({ day: d, closed: true }));
    expect(hasUsableHours(week)).toBe(false);
  });

  it('is false when a day carries no opening or no closing time', () => {
    expect(hasUsableHours([day({ open: '' })])).toBe(false);
    expect(hasUsableHours([day({ close: '' })])).toBe(false);
    expect(hasUsableHours([day({ open: undefined as unknown as string })])).toBe(false);
  });

  it('is TRUE for one real open day — El Barrilón, the 1 of 33', () => {
    expect(hasUsableHours([day()])).toBe(true);
  });

  it('is true when one day is open among six closed ones', () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) =>
      d === 3 ? day({ day: d }) : day({ day: d, closed: true }),
    );
    expect(hasUsableHours(week)).toBe(true);
  });

  it('treats a MISSING `closed` as open rather than as closed', () => {
    // `closed` is declared required, but a document written by hand or by an
    // older form may omit it. Reading an absent `closed` as "closed" would hide
    // real hours; reading it as "open" matches what the editor shows.
    const d = { day: 2, open: '08:00', close: '12:00' } as unknown as OpeningHour;
    expect(hasUsableHours([d])).toBe(true);
  });
});

// `displayHours` — the rows a traveler reads (feature 020).
//
// THIS MODULE EXISTS BECAUSE A FIELD WAS WRITE-ONLY FOR FOUR FEATURES.
// `Listing.openingHours` has been fillable since feature 006 and no traveler
// screen ever rendered it; `Place` did not even declare it until this feature
// added it for the slot picker. A merchant could set their hours and nobody
// could see them. It surfaced when a merchant went looking for the hours they
// had been told to fill in.
//
// The two cases that carry this file are the EMPTY one and the ABSENT-`closed`
// one. The first decides whether 32 of the 33 live listings advertise
// themselves as closed all week; the second has to agree with `hasUsableHours`,
// or a merchant can switch reservations on for a day the profile shows shut.
import { describe, it, expect } from 'vitest';
import type { OpeningHour } from '../src/types.js';
import { displayHours } from '../src/openingHoursDisplay.js';
import { hasUsableHours } from '../src/openingHours.js';

// A Wednesday: 2026-10-21T00:00Z is 2026-10-20 18:00 local (Tuesday).
const TUESDAY = new Date('2026-10-21T00:00:00Z');

function day(over: Partial<OpeningHour> = {}): OpeningHour {
  return { day: 1, open: '09:00', close: '17:00', closed: false, ...over };
}

const WEEK = [0, 1, 2, 3, 4, 5, 6].map((d) => day({ day: d }));

describe('displayHours', () => {
  it('returns NOTHING for an empty array — the shape of 32 of 33 live listings', () => {
    // So the profile renders no section at all. Seven "cerrado" rows would be
    // the product stating a business is shut all week because nobody filled a
    // form, which is the same line it drew refusing to price 18 real
    // destinations at feature 014.
    expect(displayHours([], TUESDAY)).toEqual([]);
  });

  it('returns nothing when the field is absent, rather than throwing', () => {
    expect(displayHours(undefined, TUESDAY)).toEqual([]);
    expect(displayHours(null as unknown as OpeningHour[], TUESDAY)).toEqual([]);
  });

  it('orders the week MONDAY first, while the data is 0-based from Sunday', () => {
    // Two different conventions on purpose: `OpeningHour.day` keeps the
    // JavaScript numbering the 33 documents were written with, and the display
    // reads the way a week reads here. Migrating the documents would be a bigger
    // change than a lookup.
    expect(displayHours(WEEK, TUESDAY).map((r) => r.day)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(displayHours(WEEK, TUESDAY).map((r) => r.dayKey)).toEqual([
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
      'sun',
    ]);
  });

  it('marks TODAY, in El Salvador time and not UTC', () => {
    // 2026-10-21T00:00Z is still Tuesday the 20th locally. Reading the UTC date
    // would highlight Wednesday — a traveler told the wrong row is worse than no
    // highlight at all.
    const rows = displayHours(WEEK, TUESDAY);
    expect(rows.filter((r) => r.isToday).map((r) => r.dayKey)).toEqual(['tue']);
  });

  it('shows a closed day as closed', () => {
    const rows = displayHours([day({ day: 1, closed: true })], TUESDAY);
    expect(rows[0].closed).toBe(true);
  });

  it('treats a day with no times as closed, however `closed` is set', () => {
    expect(displayHours([day({ open: '' })], TUESDAY)[0].closed).toBe(true);
    expect(displayHours([day({ close: '' })], TUESDAY)[0].closed).toBe(true);
  });

  it('AGREES with hasUsableHours about an absent `closed` flag', () => {
    // Both read it as OPEN. If they disagreed, a merchant could switch
    // reservations on for a day whose profile row says "cerrado" — the product
    // contradicting itself across two screens about the same document.
    const noFlag = [{ day: 2, open: '08:00', close: '12:00' } as unknown as OpeningHour];
    expect(hasUsableHours(noFlag)).toBe(true);
    expect(displayHours(noFlag, TUESDAY)[0].closed).toBe(false);
  });

  it('skips a day the document simply does not carry', () => {
    // A partial week is legitimate: a business open only on weekends has no rows
    // for the rest, and inventing them would state closures nobody entered.
    const weekend = [day({ day: 6 }), day({ day: 0 })];
    expect(displayHours(weekend, TUESDAY).map((r) => r.dayKey)).toEqual(['sat', 'sun']);
  });
});

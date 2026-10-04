// The scheduling rules, where both surfaces read them from (feature 016, US2).
//
// The floor (FR-020) has NO other test anywhere and no second line of defence:
// `contracts/firestore-rules.md` records that the rules file deliberately does
// not enforce it, so if these cases are wrong nothing else says so.
import { describe, it, expect } from 'vitest';
import { isBeforeTripStart, canSetTime, timeFor } from '../src/tripSchedule.js';

describe('the date floor (FR-020)', () => {
  it('refuses a date before the Trip starts', () => {
    expect(isBeforeTripStart('2026-10-09', '2026-10-10')).toBe(true);
  });

  it('allows the start date itself — the floor is inclusive', () => {
    expect(isBeforeTripStart('2026-10-10', '2026-10-10')).toBe(false);
  });

  it('allows any later date', () => {
    expect(isBeforeTripStart('2026-10-11', '2026-10-10')).toBe(false);
  });

  it('treats no date as no violation, because unscheduled is always allowed (FR-019)', () => {
    expect(isBeforeTripStart(undefined, '2026-10-10')).toBe(false);
    expect(isBeforeTripStart('', '2026-10-10')).toBe(false);
  });

  it('compares across months and years without parsing', () => {
    // The whole reason both sides stay 'YYYY-MM-DD' strings: the moment one is
    // parsed into an instant, a timezone enters a comparison between two days.
    // `calendarDay.ts` carries the bug this repository already shipped from it.
    expect(isBeforeTripStart('2026-09-30', '2026-10-01')).toBe(true);
    expect(isBeforeTripStart('2025-12-31', '2026-01-01')).toBe(true);
    expect(isBeforeTripStart('2026-10-02', '2026-09-30')).toBe(false);
  });
});

describe('a time needs a day (FR-021)', () => {
  it('offers no time control until a date is set', () => {
    expect(canSetTime(undefined)).toBe(false);
    expect(canSetTime('')).toBe(false);
  });

  it('offers it once there is one', () => {
    expect(canSetTime('2026-10-11')).toBe(true);
  });

  it('never stores a time without a date', () => {
    // A time with no day places nothing, so it would be an orphan the ordering
    // never reads and a later date would resurrect.
    expect(timeFor(undefined, '09:00')).toBeUndefined();
    expect(timeFor('', '09:00')).toBeUndefined();
  });

  it('drops the time when the date is cleared (FR-023)', () => {
    // Two effects from one act, stated once here rather than remembered at
    // every call site.
    expect(timeFor('2026-10-11', '09:00')).toBe('09:00');
    expect(timeFor(undefined, '09:00')).toBeUndefined();
  });
});

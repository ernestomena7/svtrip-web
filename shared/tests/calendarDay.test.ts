// The timezone defect, pinned.
//
// These tests are only meaningful in a timezone west of UTC, which is where the
// product lives. `vitest.config.ts` for this workspace pins TZ so the suite does
// not quietly pass on a UTC machine — a green run in UTC would prove nothing,
// because UTC midnight and local midnight are the same instant there.
import { describe, it, expect } from 'vitest';
import { toDateInput, fromDateInput, startOfToday } from '../src/calendarDay.js';

describe('the bug that shipped', () => {
  it('accepts a promotion that ends today', () => {
    // The desktop form refused this. `new Date('YYYY-MM-DD')` gave UTC midnight
    // (00:00Z) and the floor was local midnight (06:00Z in El Salvador), so the
    // comparison failed by six hours.
    const today = toDateInput(Date.now());
    expect(fromDateInput(today) >= startOfToday()).toBe(true);
  });

  it('still refuses a promotion that ended yesterday', () => {
    // The check the fix must not weaken: FR-025 wants a FUTURE end date.
    const yesterday = toDateInput(Date.now() - 24 * 60 * 60 * 1000);
    expect(fromDateInput(yesterday) >= startOfToday()).toBe(false);
  });

  it('parses local midnight, not UTC midnight', () => {
    const local = new Date(fromDateInput('2026-09-05'));
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(8); // septiembre
    expect(local.getDate()).toBe(5);
    expect(local.getHours()).toBe(0);
  });
});

describe('the two halves are inverses', () => {
  it('round-trips any calendar day', () => {
    // `toISOString().slice(0, 10)` is NOT the inverse of a local parse, which is
    // how the two helpers drifted apart in the first place.
    for (const day of ['2026-01-01', '2026-06-15', '2026-09-05', '2026-12-31']) {
      expect(toDateInput(fromDateInput(day))).toBe(day);
    }
  });

  it('names the day the viewer is living in, late at night', () => {
    // 23:30 local. `toISOString().slice(0, 10)` would report TOMORROW anywhere
    // west of UTC — the display half of the same defect.
    const lateTonight = new Date();
    lateTonight.setHours(23, 30, 0, 0);
    expect(toDateInput(lateTonight.getTime())).toBe(toDateInput(startOfToday()));
  });
});

// Feature 025 (T005): calendar months on the El Salvador calendar, and the promotion window's edges.
//
// Why this file exists: 018's `addMonths` used `Date.setMonth`, which OVERFLOWS — 30 Nov + 3 months
// became 2 March. 018 only ever added months to `launch_at` (the 1st of a month), where it cannot
// overflow; 025 adds months to an arbitrary enrolment moment, where it can. And Cloud Run's clock is
// UTC: an enrolment at 20:00 local on 30 January is already 31 January in UTC, and clamping there
// lands on 29 April local instead of 30 April (research R4.0).
import { describe, expect, it } from 'vitest';
import { addMonthsClamped, isWithinWindow } from '../src/months.js';

const local = (iso: string) => Date.parse(`${iso}-06:00`); // an El Salvador wall-clock time
const utc = (ms: number) => new Date(ms).toISOString();

describe('addMonthsClamped — three calendar months, on the El Salvador calendar', () => {
  it('15 Dec → 15 Mar (the HU example)', () => {
    expect(utc(addMonthsClamped(local('2026-12-15T10:00:00'), 3))).toBe(utc(local('2027-03-15T10:00:00')));
  });

  it('31 Jan → 30 Apr — the window’s own month-end case', () => {
    expect(utc(addMonthsClamped(local('2027-01-31T09:00:00'), 3))).toBe(utc(local('2027-04-30T09:00:00')));
  });

  it('30 Nov → 28 Feb 2027, not 2 March (the setMonth overflow)', () => {
    expect(utc(addMonthsClamped(local('2026-11-30T12:00:00'), 3))).toBe(utc(local('2027-02-28T12:00:00')));
  });

  it('31 Dec → 31 Mar', () => {
    expect(utc(addMonthsClamped(local('2026-12-31T12:00:00'), 3))).toBe(utc(local('2027-03-31T12:00:00')));
  });

  it('29 Feb 2028 + 12 → 28 Feb 2029', () => {
    expect(utc(addMonthsClamped(local('2028-02-29T12:00:00'), 12))).toBe(utc(local('2029-02-28T12:00:00')));
  });

  it('an EVENING enrolment counts on the local calendar: 30 Jan 20:00 local + 3 → 30 Apr 20:00 local', () => {
    const enrolled = Date.parse('2027-01-31T02:00:00Z'); // = 30 Jan 20:00 in El Salvador
    expect(utc(addMonthsClamped(enrolled, 3))).toBe('2027-05-01T02:00:00.000Z'); // = 30 Apr 20:00 local
  });
});

describe('isWithinWindow — 1 Dec 2026 00:00 to 31 Jan 2027 23:59:59.999, El Salvador time', () => {
  const launchAt = Date.parse('2026-12-01T06:00:00Z');
  const months = 2;

  it('closed one millisecond before the launch', () => {
    expect(isWithinWindow(launchAt - 1, launchAt, months)).toBe(false);
  });
  it('open at the launch instant', () => {
    expect(isWithinWindow(Date.parse('2026-12-01T06:00:00.000Z'), launchAt, months)).toBe(true);
  });
  it('open at the last millisecond of 31 January, local', () => {
    expect(isWithinWindow(Date.parse('2027-02-01T05:59:59.999Z'), launchAt, months)).toBe(true);
  });
  it('closed at 1 February 00:00 local', () => {
    expect(isWithinWindow(Date.parse('2027-02-01T06:00:00.000Z'), launchAt, months)).toBe(false);
  });
  it('closed when there is no launch date (fail closed, 018 FR-049)', () => {
    expect(isWithinWindow(Date.parse('2026-12-15T12:00:00Z'), undefined, months)).toBe(false);
  });
});

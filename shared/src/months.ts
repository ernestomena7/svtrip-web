// Calendar months on the El Salvador calendar (feature 025, research R4).
//
// Two defects this replaces, both measured:
//   1. 018's `addMonths` used `Date.setMonth`, which OVERFLOWS: 30 Nov + 3 months became 2 March.
//      018 only added months to `launch_at` (the 1st of a month), where it cannot overflow; 025 adds
//      months to an arbitrary enrolment moment, where it can.
//   2. The server's clock is UTC. An enrolment at 20:00 local on 30 January is already 31 January in
//      UTC; clamping in UTC gives 30 April 02:00Z — 29 April local. A merchant reads a local date.
//
// El Salvador is UTC-6 with no daylight saving, so a fixed offset is exact (no tz database needed).

/** El Salvador's offset from UTC, in milliseconds (UTC-6, no daylight saving). */
export const EL_SALVADOR_OFFSET_MS = -6 * 60 * 60 * 1000;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * `instant` plus `months` calendar months, counted on the El Salvador calendar, keeping the local
 * time of day. When the target month lacks the day (31 Jan → April), the result is that month's last
 * day — never a spill into the next month.
 */
export function addMonthsClamped(instant: number, months: number): number {
  const local = new Date(instant + EL_SALVADOR_OFFSET_MS); // read its UTC fields as local wall time
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const day = Math.min(local.getUTCDate(), daysInMonth(targetYear, targetMonth));
  const shifted = Date.UTC(
    targetYear,
    targetMonth,
    day,
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return shifted - EL_SALVADOR_OFFSET_MS;
}

/**
 * Whether `now` falls inside an enrolment window that opens at `launchAt` and lasts `months` calendar
 * months. No launch date means CLOSED (feature 018, FR-049: fail closed).
 */
export function isWithinWindow(now: number, launchAt: number | undefined, months: number): boolean {
  if (launchAt === undefined) return false;
  if (now < launchAt) return false;
  return now < addMonthsClamped(launchAt, months);
}

/** The El Salvador calendar date of an instant, as `YYYY-MM-DD`. */
export function localDate(instant: number): string {
  return new Date(instant + EL_SALVADOR_OFFSET_MS).toISOString().slice(0, 10);
}

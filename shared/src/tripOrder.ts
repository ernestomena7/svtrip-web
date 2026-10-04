// How a Trip's stops are ordered. ONE rule, in one place (feature 016).
//
// FR-044 puts the same Trip on two surfaces and FR-025 through FR-028 describe
// how it reads. If each surface implemented that description separately, the two
// would not stay identical — and the disagreement is invisible, because each
// list looks internally sensible on its own.
//
// So this is a pure function of a stop list: no clock, no locale, no component,
// no data access. `check:boundaries` keeps `shared/` free of React and the DOM,
// which is also what makes these cases testable without a browser.
//
// What belongs to the surfaces and not here: rendering the two groups and
// whatever divides them; the drag gesture, whose library is per-surface; and
// MARKING a stop unavailable or conflicting. A conflicting stop still sorts by
// its own date — FR-034 says mark it, not move it.
import type { TripStop } from './types.js';

/**
 * A stop is SCHEDULED when it has a date, and UNSCHEDULED otherwise.
 *
 * An empty string is treated as absent on purpose: `<input type="date">` clears
 * to `''`, and a stop half-way through being cleared must not sort as though it
 * were scheduled for the year zero.
 */
export function isScheduled(stop: TripStop): boolean {
  return Boolean(stop.date);
}

/**
 * Compare two scheduled stops.
 *
 * THE CASE THIS EXISTS FOR (FR-027): a stop with a date and no time must sort
 * among ITS OWN date's stops, never behind a later date.
 *
 * The naive version builds one combined key — `${date}T${time}` — and a missing
 * time makes it either `'2026-10-12T'` or `'2026-10-12T99:99'`. Within a day
 * either is defensible. Across days, a `undefined` time handled as a missing
 * VALUE rather than a missing FIELD sorts the stop out of its date entirely.
 *
 * Comparing date first and time only within an equal date makes that
 * unreachable: the time never participates in an across-day comparison.
 */
function compareScheduled(a: TripStop, b: TripStop): number {
  // Both are 'YYYY-MM-DD', zero-padded, so string order IS chronological order
  // and no parse and no timezone enter the comparison. See `calendarDay.ts`.
  if (a.date !== b.date) return (a.date ?? '') < (b.date ?? '') ? -1 : 1;

  // Same day. Only now does the time matter at all.
  const at = a.time ?? '';
  const bt = b.time ?? '';
  // A stop with no time sits at the start of its own day. That is a choice
  // between two defensible options — what is NOT defensible is it leaving the
  // day, which the structure above already prevents.
  if (at !== bt) return at < bt ? -1 : 1;

  return a.addedAt - b.addedAt;
}

function compareUnscheduled(a: TripStop, b: TripStop): number {
  if (a.position !== b.position) return a.position - b.position;
  return a.addedAt - b.addedAt;
}

/**
 * Order a Trip's stops: scheduled first, chronologically; then unscheduled, in
 * the arrangement the traveler made.
 *
 * Returns a NEW array. The input is never mutated — these lists come straight
 * out of a live subscription, and sorting one in place makes a component's
 * props change under it without a re-render.
 */
export function tripOrder(stops: readonly TripStop[]): TripStop[] {
  const scheduled: TripStop[] = [];
  const unscheduled: TripStop[] = [];
  for (const stop of stops) {
    (isScheduled(stop) ? scheduled : unscheduled).push(stop);
  }
  scheduled.sort(compareScheduled);
  unscheduled.sort(compareUnscheduled);
  return [...scheduled, ...unscheduled];
}

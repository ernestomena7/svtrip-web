// When a Trip stop may be scheduled (feature 016, FR-020 / FR-021).
//
// Here rather than in either surface for the same reason `tripOrder` is: both
// render the refusal, and two implementations of "is this date too early" drift
// the moment one of them starts parsing.
//
// **This rule lives ONLY in the interface.** `contracts/firestore-rules.md`
// records why the rules file deliberately does not enforce it: doing so would
// mean reading the parent Trip document on every stop write — a cross-document
// read on the hot path, to defend a traveler against a bad date in their own
// private data. Rules draw the isolation boundary; this is form validation.
//
// So there is no second line of defence, and that is the point of putting it
// somewhere both surfaces import rather than writing it twice.
import type { CalendarDay, TimeOfDay } from './calendarDay.js';

/**
 * Is this stop date earlier than the Trip's start?
 *
 * Plain string comparison, never a parse: both sides are 'YYYY-MM-DD' and
 * zero-padded, so `<` already means "earlier" with no timezone involved. This
 * module exists in a repository that shipped a bug from parsing a calendar day
 * into an instant — `calendarDay.ts` carries the whole story.
 *
 * An empty or absent date is NOT a violation: it means unscheduled, which is
 * always allowed (FR-019).
 */
export function isBeforeTripStart(
  date: CalendarDay | undefined,
  tripStartDate: CalendarDay,
): boolean {
  if (!date) return false;
  return date < tripStartDate;
}

/**
 * May a time be offered yet? (FR-021)
 *
 * A time with no day places nothing, so the control does not exist until a date
 * is set. Returning this from one place keeps the two surfaces from disagreeing
 * about when the field appears.
 */
export function canSetTime(date: CalendarDay | undefined): boolean {
  return Boolean(date);
}

/**
 * The time to actually store alongside a date.
 *
 * Returns undefined when there is no date, which is what makes "clearing the
 * date clears the time" (FR-023) one rule rather than two call sites that must
 * remember each other.
 */
export function timeFor(
  date: CalendarDay | undefined,
  time: TimeOfDay | undefined,
): TimeOfDay | undefined {
  return date && time ? time : undefined;
}

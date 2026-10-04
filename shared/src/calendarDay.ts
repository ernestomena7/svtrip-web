// A calendar day, as a person living in it means it.
//
// `<input type="date">` speaks 'YYYY-MM-DD' with no timezone, and the two
// obvious conversions disagree by up to a day:
//
//   new Date('2026-09-05')              → 2026-09-05T00:00:00Z  (UTC midnight)
//   new Date('2026-09-05T00:00:00')     → 2026-09-05T06:00:00Z  (local, UTC-6)
//
// In El Salvador those are six hours apart, and the gap is not academic: the
// desktop deal form parsed the end date as UTC midnight and compared it against
// `new Date().setHours(0,0,0,0)`, which is local midnight. A promotion ending
// today came out as 00:00Z against a floor of 06:00Z, so the form REFUSED it —
// the exact opposite of what its own comment promised.
//
// The mobile form had this right, with a local-midnight parse written inline.
// The desktop screen was duplicated from it in feature 007 and the helper did
// not travel. Hence this module: one definition both surfaces import, so the
// next duplicated screen inherits the fix instead of the bug.
//
// It lives in `shared/` by the usual test — nothing here touches React or a
// browser API, and any server-side validation of a promotion window needs the
// same arithmetic.
//
// Every function is LOCAL-time by design. A deal that runs "until the 5th" ends
// when the 5th ends where the business is, not where the server is.

/** A timestamp as the 'YYYY-MM-DD' the viewer's own calendar shows. */
export function toDateInput(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * A 'YYYY-MM-DD' as local midnight.
 *
 * The `T00:00:00` suffix is what makes it local: bare 'YYYY-MM-DD' is defined
 * as UTC, and a date-time without a zone is defined as local. Removing it looks
 * like tidying and moves every date by the offset.
 */
export function fromDateInput(v: string): number {
  return new Date(v + 'T00:00:00').getTime();
}

/**
 * The start of today, locally — the floor an end date must still clear.
 *
 * Start of day rather than "now" on purpose: a promotion running out this
 * evening is still savable, which is the behaviour FR-025 asks for.
 */
export function startOfToday(now: number = Date.now()): number {
  return new Date(now).setHours(0, 0, 0, 0);
}

/**
 * A calendar day as 'YYYY-MM-DD' — the same string `<input type="date">` emits.
 *
 * Kept as a string rather than converted to a number on the way into storage,
 * for the reason this whole module exists: a day has no instant, and giving it
 * one forces a timezone into a value that does not have one. As strings,
 * two days compare with `<` correctly and identically everywhere, with no
 * parse and no offset — which is what feature 016's FR-020 floor needs.
 */
export type CalendarDay = string;

/**
 * A time of day as 'HH:MM', 24-hour — what `<input type="time">` emits.
 *
 * Only ever meaningful beside a `CalendarDay`. Same reasoning: it compares
 * lexicographically because the hour is zero-padded.
 */
export type TimeOfDay = string;

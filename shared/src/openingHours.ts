/**
 * Usable opening hours (feature 020, FR-002).
 *
 * **This is the half of FR-002 that Firestore rules cannot express.** Rules have
 * no `filter`, no `map` and no predicate over list elements, so a rule can
 * enforce `openingHours.size() > 0` and nothing stronger. `reservationsFloorHeld()`
 * does that much; this does the rest, and the BFF applies it (409
 * `hours_unusable`).
 *
 * The residual gap between the two is recorded rather than papered over: a
 * client bypassing the UI could enable reservations with seven explicitly-closed
 * days. The result is a place whose every slot is unselectable — an empty
 * calendar, not an exploit. Same shape as 018's Básico cap, where a second place
 * is simply not covered and therefore not visible.
 *
 * Measured on the live project 2026-10-13: all 33 listings carry `openingHours`
 * as an **array**, 32 of them holding `[]`. So the empty case is 97% of the
 * catalog, not an edge.
 */
import type { OpeningHour } from './types.js';

/** Whether a single day can actually take a reservation. */
function dayIsOpen(d: OpeningHour | undefined | null): boolean {
  if (!d) return false;
  // `closed` is declared required, but a document written by an older form may
  // omit it. Reading an absent `closed` as "closed" would HIDE real hours that
  // the merchant's editor shows as set, so absence means open.
  if (d.closed === true) return false;
  return typeof d.open === 'string' && d.open !== '' && typeof d.close === 'string' && d.close !== '';
}

/**
 * Whether a place carries hours a traveler could pick a slot inside.
 *
 * At least one day that is not marked closed and carries both an opening and a
 * closing time — the definition FR-002 now states in the spec, so a reader
 * validating SC-008 does not have to find it here.
 */
export function hasUsableHours(hours: readonly OpeningHour[] | undefined | null): boolean {
  if (!Array.isArray(hours)) return false;
  return hours.some(dayIsOpen);
}

/**
 * Whether a local `YYYY-MM-DDTHH:mm` falls inside the place's hours (FR-011).
 *
 * Enforced here as well as in the picker, because a client can post anything —
 * the picker makes it hard, this makes it false.
 */
export function momentInsideHours(
  at: string,
  hours: readonly OpeningHour[] | undefined | null,
): boolean {
  if (!Array.isArray(hours)) return false;
  // `at` is 'YYYY-MM-DDTHH:mm'. Parsing only the parts needed, and only after
  // the shape is checked, so a malformed string answers false rather than
  // becoming a NaN that compares false against everything on its own terms.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return false;
  const [date, time] = at.split('T');
  // `Date.UTC` on the date parts gives the weekday without a timezone shifting
  // it — the date string is already local, so treating it as UTC for the sole
  // purpose of asking "which weekday is this" is correct and reading it with the
  // local constructor would not be.
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return hours.some(
    (h) => h && h.day === weekday && dayIsOpen(h) && time >= h.open && time <= h.close,
  );
}

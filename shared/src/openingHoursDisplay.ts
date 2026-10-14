/**
 * Opening hours, for a traveler to read (feature 020).
 *
 * **This exists because the field was WRITE-ONLY for four features.**
 * `Listing.openingHours` has been fillable since feature 006, and no traveler
 * screen has ever rendered it — `Place` did not even declare the field until
 * this feature added it for the slot picker. A merchant could set their hours
 * and nobody could see them.
 *
 * In `shared/` rather than duplicated per surface for the usual reason, which
 * bites harder here than most: a business that reads "abierto" on the phone and
 * "cerrado" on the desktop is worse than one that shows nothing.
 */
import type { OpeningHour } from './types.js';
import { localNow } from './reservationState.js';

/** i18n key suffixes, indexed by `OpeningHour.day` (0 = Sunday). */
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface DisplayHourRow {
  day: number;
  /** `days.<key>` */
  dayKey: string;
  closed: boolean;
  open: string;
  close: string;
  /** Whether this row is today, in El Salvador's timezone. */
  isToday: boolean;
}

/**
 * The seven rows a profile shows, in week order starting Monday.
 *
 * Monday-first because that is how opening hours are read in El Salvador, while
 * `OpeningHour.day` is 0-based from Sunday (the JavaScript convention the data
 * was written with). The two orders are different things and keeping them
 * separate is cheaper than migrating 33 documents.
 *
 * Returns an EMPTY array when there is nothing usable, so a caller renders no
 * section at all rather than seven "cerrado" rows — 32 of the 33 live listings
 * carry `openingHours: []`, and claiming a business is closed all week because
 * nobody filled a form would be the product stating something it was not told.
 */
export function displayHours(
  hours: readonly OpeningHour[] | undefined | null,
  now: Date = new Date(),
): DisplayHourRow[] {
  if (!Array.isArray(hours) || hours.length === 0) return [];

  const todayIndex = new Date(`${localNow(now).slice(0, 10)}T00:00:00Z`).getUTCDay();
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];

  const rows: DisplayHourRow[] = [];
  for (const day of weekOrder) {
    const h = hours.find((x) => x && x.day === day);
    if (!h) continue;
    rows.push({
      day,
      dayKey: DAY_KEYS[day],
      // An absent `closed` reads as OPEN, matching `hasUsableHours` — the two
      // must agree, or a merchant can enable reservations on a day the profile
      // shows as closed.
      closed: h.closed === true || !h.open || !h.close,
      open: h.open ?? '',
      close: h.close ?? '',
      isToday: day === todayIndex,
    });
  }
  return rows;
}

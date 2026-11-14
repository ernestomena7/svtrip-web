// Where a reservation is (2026-10-23).
//
// Feature 020 shipped every reservation display showing date and state but never the place. The
// name now arrives with the reservation (core's reservationsRepo joins it through the listing), and
// this decides how it reads. In shared/ because BOTH surfaces render it and must agree — the rule
// feature 016 set — and because it is pure.
import type { LocalizedText } from './i18nContent.js';
import { resolveLocalized } from './i18nContent.js';

export interface ReservationPlace {
  placeName?: string;
  placeNameI18n?: LocalizedText;
}

/** The place's name in the reader's language, or '' when it cannot be read — never invented. */
export function reservationPlaceName(r: ReservationPlace, language: string): string {
  return resolveLocalized(r.placeName, r.placeNameI18n, language === 'en' ? 'en' : 'es');
}

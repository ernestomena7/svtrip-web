/**
 * Reservation state (feature 020, FR-027/FR-028/FR-028a/FR-029).
 *
 * `shared/`, not `core/`, by the standing rule — **does the Node server run
 * it?** The BFF resolves the state to guard confirm/reject/cancel and to compose
 * push copy, and `core/` carries React and the Firebase Web SDK. 016 extended
 * the rule and this is also that case: a state resolving differently on phone
 * and desktop is FR-028 broken.
 *
 * **Four states are stored, six are spoken.** Expirada and Completada are
 * DERIVED, because this product has no cron, no scheduled function and no job —
 * measured at feature 018, which built `subscriptionState.ts` on the same
 * finding. A stored status needs something to rewrite it, and there is nothing.
 */
import type {
  RecordedReservationState,
  ReservationState,
  ReservationViewer,
} from './types.js';

/**
 * El Salvador: UTC-6, year round, **no DST**. That is what makes a bare local
 * string unambiguous in the first place, and it is why a fixed offset is honest
 * here rather than a shortcut — there is no transition to get wrong.
 */
const EL_SALVADOR_UTC_OFFSET_MINUTES = -6 * 60;

/**
 * `now` as a local `YYYY-MM-DDTHH:mm`, the same shape as a reservation's `at`.
 *
 * **Every producer of `now` must go through this.** The BFF runs on Cloud Run in
 * UTC, so formatting from the UTC clock puts `now` six hours ahead: valid
 * same-evening slots get rejected as past, and every reservation reads Expirada
 * or Completada six hours early — on BOTH surfaces, which is FR-028 broken by a
 * formatting choice. It never shows up in local development, where the
 * developer's clock *is* the local one.
 */
export function localNow(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + EL_SALVADOR_UTC_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/**
 * Whether `at` is a real local moment, not merely a string of the right shape.
 *
 * **This function exists because a comment two paragraphs below used to claim it
 * was unnecessary, and the test caught the claim.** The reasoning was that a
 * malformed `at` would sort BELOW any real `now` and so degrade to Expirada —
 * visible and finished rather than invisible and eternal. Measured against the
 * four malformed values in the test:
 *
 *     ""                  <= now  ->  true
 *     "2026-10-12T"       <= now  ->  true
 *     "no es una fecha"   <= now  ->  false
 *     "2026-13-45T99:99"  <= now  ->  false
 *
 * Half of them sort ABOVE. A string comparison reads `'2026-13-45T99:99'` as a
 * far-future date, so the broken reservation lands on **Pendiente** — exactly
 * the failure the string comparison was supposed to avoid, arrived at from the
 * other direction. Feature 016 found the mirror of this: the sabotage it
 * *expected* to break its ordering left all twelve rows green, because the date
 * prefix dominates.
 *
 * So the shape is checked with a regex AND the parts are checked for being a
 * real date, because `'2026-13-45T99:99'` passes the regex.
 */
export function isValidLocalMoment(at: unknown): at is string {
  if (typeof at !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return false;
  const [date, time] = at.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  if (hh > 23 || mm > 59) return false;
  // Round-trip the date so 31 February is refused rather than rolled forward.
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * The six states, from what is stored plus the passage of time.
 *
 * **The ORDER of these checks is the contract.** The recorded terminal states
 * are tested FIRST, so no date can reach them. Move the time comparison above
 * them and a reservation a traveler cancelled in March reads **Completada** in
 * April — the product asserting they attended something they called off, and
 * FR-029's "Cancelada por ti" becoming a lie about their own action. That is
 * 018's finding restated, where swapping `grace` and `suspended` reddened four
 * cases.
 */
export function resolveReservationState(
  recorded: RecordedReservationState,
  at: string,
  now: Date,
): ReservationState {
  // 1 and 2: answered, by one side or the other. Time is never consulted.
  if (recorded === 'rejected') return 'rechazada';
  if (recorded === 'cancelled') return 'cancelada';

  // A moment that is not a real moment is treated as ELAPSED, never as a live
  // request. See `isValidLocalMoment` for why this check is not redundant: half
  // the malformed values sort ABOVE `now` under a string comparison, which would
  // leave a broken reservation sitting on Pendiente forever, looking like
  // something a merchant ought to answer.
  if (!isValidLocalMoment(at)) {
    return recorded === 'confirmed' ? 'completada' : 'expirada';
  }

  // 3 and 4: nobody answered, or somebody did and the moment came.
  //
  // A STRING comparison, deliberately, and `<=` rather than `<`: at 18:00 sharp
  // the 18:00 slot is happening, not pending. Feature 016 measured why parsing
  // is the wrong instinct — `new Date('2026-10-12T')` is NaN, and a NaN
  // comparison is false against everything. The validity check above is what
  // makes the comparison safe; without it, the two approaches fail in opposite
  // directions rather than one being right.
  if (at <= localNow(now)) {
    return recorded === 'confirmed' ? 'completada' : 'expirada';
  }

  // 5: still ahead.
  return recorded === 'confirmed' ? 'confirmada' : 'pendiente';
}

/**
 * The i18n key for a state, **from the reader's point of view** (FR-029).
 *
 * One function taking the side, never two renderers: two renderers are how
 * "Cancelada por cliente" ends up shown to the client. Only 2 of the 6 states
 * differ, which is why this is **8** distinct keys and not 12.
 *
 * A KEY, never rendered text — feature 012's rule, and both of its reasons
 * apply: the BFF must not import `core/`, where the locale files live, and push
 * copy composed from a state would otherwise freeze Spanish into a sent
 * notification.
 */
export function reservationLabelKey(
  state: ReservationState,
  viewer: ReservationViewer,
): string {
  switch (state) {
    case 'rechazada':
      return viewer === 'merchant'
        ? 'reservations.state.rejectedByYou'
        : 'reservations.state.rejectedByMerchant';
    case 'cancelada':
      return viewer === 'merchant'
        ? 'reservations.state.cancelledByClient'
        : 'reservations.state.cancelledByYou';
    case 'pendiente':
      return 'reservations.state.pending';
    case 'confirmada':
      return 'reservations.state.confirmed';
    case 'expirada':
      return 'reservations.state.expired';
    case 'completada':
      return 'reservations.state.completed';
  }
}

/** Every key `reservationLabelKey` can return — eight, not twelve. */
export const RESERVATION_STATE_KEYS: readonly string[] = [
  'reservations.state.pending',
  'reservations.state.confirmed',
  'reservations.state.rejectedByMerchant',
  'reservations.state.rejectedByYou',
  'reservations.state.cancelledByYou',
  'reservations.state.cancelledByClient',
  'reservations.state.expired',
  'reservations.state.completed',
];

/**
 * Whether a reservation is still answerable or cancellable (FR-028a).
 *
 * The guards read the DERIVED state, not `recorded`. Guarding on `recorded`
 * alone is wrong in two directions: a traveler could cancel one that reads
 * **Completada**, rewriting their own history weeks later and pushing the
 * merchant about it; and a merchant could confirm one that reads **Expirada**,
 * flipping it to Completada instantly — the product asserting a traveler
 * attended something nobody answered.
 */
export function isElapsed(state: ReservationState): boolean {
  return state === 'expirada' || state === 'completada';
}

/** Whether a reservation belongs in Próximas (FR-015) / Pendientes (FR-018). */
export function isUpcoming(state: ReservationState): boolean {
  return state === 'pendiente' || state === 'confirmada';
}

/**
 * Whether a place offers "Reservar" to a traveler (FR-003).
 *
 * **One function, both surfaces.** The rule is one comparison, and the reason it
 * is not simply inlined in two screens is feature 014's still-live defect:
 * desktop Discover iterates the static `MOODS` constant while the phone reads
 * the live taxonomy, so an admin-created mood appears on one surface and is
 * silently absent on the other. Three features have recorded that without
 * fixing it. This feature's FR-006 forbids the same shape, so the predicate has
 * one home.
 *
 * Three conditions, and each one fails CLOSED:
 *
 *   - `reservationsEnabled === true`, never `!== false`. All 33 live listings
 *     carry no such field, and the lenient form would offer a reservation
 *     button on every beach, volcano and town in the catalog. Note that
 *     `covered` four fields away in the same type defaults the OTHER way, and is
 *     correct to — which is why neither can be written from habit.
 *   - a seed destination is never offered. A beach has no merchant, so there is
 *     nobody on the other end of the request.
 *   - a place feature 018 no longer covers is never offered. The server refuses
 *     such a request too (409 `listing_not_visible`); this is the half that
 *     keeps a traveler from being shown a door that is barred.
 */
export function offersReservations(place: {
  source?: 'seed' | 'listing';
  reservationsEnabled?: boolean;
  covered?: boolean;
}): boolean {
  if (place.reservationsEnabled !== true) return false;
  if (place.source !== 'listing') return false;
  return place.covered !== false;
}

/**
 * The services a traveler should be SHOWN, which is not always the ones the
 * merchant declared (feature 020, FR-034).
 *
 * **`shared/src/businessTypes.ts` has offered `'reservations'` as a declarable
 * additional service since feature 005, four features before this one, and
 * nothing in this feature's first draft of artifacts noticed.** So a restaurant
 * can tick "Reservas" in its services, leave `reservationsEnabled` off, and ship
 * a profile that ADVERTISES reservations with no way to make one. That is
 * FR-034's problem exactly: the product stating something it cannot honour.
 *
 * The chip is therefore suppressed unless the switch is actually on. The service
 * stays declarable — a merchant who takes reservations by phone is telling the
 * truth about their business — but on this product's profile a chip reads as an
 * offer, and an offer with no control behind it is what FR-034 forbids.
 *
 * `'appointments'` (wellness-spa) gets the same treatment for the same reason.
 *
 * The alternative, renaming one of the two, was rejected: it trades a lie for a
 * vocabulary split, in a product whose taxonomy is admin-editable since feature
 * 010 and would drift.
 */
const RESERVATION_SERVICE_KEYS = new Set(['reservations', 'appointments']);

export function visibleServices(place: {
  services?: string[];
  source?: 'seed' | 'listing';
  reservationsEnabled?: boolean;
  covered?: boolean;
}): string[] {
  const all = place.services ?? [];
  if (offersReservations(place)) return all;
  return all.filter((key) => !RESERVATION_SERVICE_KEYS.has(key));
}

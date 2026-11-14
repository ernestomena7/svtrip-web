// Reservations, read side only (feature 020).
//
// **There is no write in this file, and that is deliberate rather than
// incidental.** `reservations` is `allow create, update, delete: if false`, and
// every write goes through the BFF (`core/src/apiClient.ts`). Two parties each
// permitted a different transition on one document would be the most complex
// rule in `firestore.rules`, on the one path where getting it wrong means a
// merchant reading another merchant's travelers.
//
// Reads DO come straight from the database, scoped by the policy
// `traveler_uid = uid or merchant_uid = uid`. That is what makes both lists live
// — FR-012's "appears immediately" without polling, and US3 scenario 5's card
// moving to Confirmadas on its own.
//
// Feature 023: the two composite indexes this list needed on Firestore
// (`travelerUid + at`, `merchantUid + at`) are `reservations_traveler_uid_idx` and
// `reservations_merchant_uid_idx` in the schema migration. Postgres runs an
// unindexed query anyway (slower), so the FAILED_PRECONDITION trap is gone — but
// the indexes stay, for the same reason they existed.
import { useEffect, useMemo, useState } from 'react';
import type { LocalizedText, Reservation, ReservationPlace, ReservationState, ReservationViewer } from '@svtrip/shared';
import { isUpcoming, resolveReservationState } from '@svtrip/shared';
import { supabase } from '../supabase';
import { rowsOf, subscribeLive, userTopic } from '../db/live';
import { fromRow } from '@svtrip/shared';

/** A reservation with its state already resolved, so no screen re-derives it. */
export interface ResolvedReservation extends Reservation, ReservationPlace {
  state: ReservationState;
}

// The place name is the listing's, joined at read time — not on the stored `Reservation` type, so
// a renamed business shows its new name on every reservation instead of a copy frozen at request time.
type ReservationRow = Record<string, unknown> & { listings?: { name: string | null; name_i18n: LocalizedText | null } | null };

/** A row with its embedded listing name, as the app value. */
export function withPlace(row: ReservationRow): Reservation & ReservationPlace {
  const { listings, ...rest } = row;
  const reservation = fromRow<Reservation>('reservations', rest);
  return {
    ...reservation,
    ...(listings?.name ? { placeName: listings.name } : {}),
    ...(listings?.name_i18n ? { placeNameI18n: listings.name_i18n } : {}),
  };
}

function resolveAll(docs: (Reservation & ReservationPlace)[], now: Date): ResolvedReservation[] {
  return docs.map((r) => ({ ...r, state: resolveReservationState(r.recorded, r.at, now) }));
}

function useReservationQuery(field: 'travelerUid' | 'merchantUid', uid: string | undefined) {
  const [reservations, setReservations] = useState<(Reservation & ReservationPlace)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) {
      setReservations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const column = field === 'travelerUid' ? 'traveler_uid' : 'merchant_uid';
    const unsub = subscribeLive(
      {
        table: 'reservations',
        topic: userTopic(uid),
        cacheKey: `reservations:${column}:${uid}`,
        read: async () =>
          // The place name rides along through the reservation -> listing foreign key (one query).
          rowsOf(
            await supabase
              .from('reservations')
              .select('*, listings(name, name_i18n)')
              .eq(column, uid)
              .order('at', { ascending: true }),
          ).map((r) => withPlace(r as ReservationRow)),
      },
      (rows) => {
        setReservations(rows);
        setLoading(false);
      },
      (err) => {
        // Surfaced rather than swallowed. Feature 010 is the cautionary tale: a
        // swallowed `permission-denied` made a fully built feature look like it
        // had nothing to show.
        setError(err as Error);
        setLoading(false);
      },
    );
    return unsub;
  }, [field, uid]);

  return { reservations, loading, error };
}

/**
 * The traveler's own reservations, ordered by moment (FR-015).
 *
 * `now` is a parameter so a screen can be tested at a fixed instant — and so
 * SC-005 ("reads correctly with nothing having run") can be exercised without
 * waiting for a date to pass.
 */
export function useMyReservations(uid: string | undefined, now: Date = new Date()) {
  const { reservations, loading, error } = useReservationQuery('travelerUid', uid);
  const resolved = useMemo(() => resolveAll(reservations, now), [reservations, now]);
  const upcoming = useMemo(() => resolved.filter((r) => isUpcoming(r.state)), [resolved]);
  // Pasadas newest first: a traveler scanning their history wants the most
  // recent thing, while Próximas wants the soonest. Same data, opposite ends.
  const past = useMemo(
    () => resolved.filter((r) => !isUpcoming(r.state)).slice().reverse(),
    [resolved],
  );
  return { upcoming, past, loading, error };
}

/**
 * The single nearest upcoming reservation, for the Explorar card (FR-016).
 *
 * **The nearest ONE, never a list.** The query is already ordered by `at`, so
 * this is the first element of `upcoming` — and returning the array would invite
 * a screen to render three cards and call it the same requirement.
 */
export function useNextReservation(uid: string | undefined, now: Date = new Date()) {
  const { upcoming, loading, error } = useMyReservations(uid, now);
  return { next: upcoming[0] ?? null, loading, error };
}

/**
 * The merchant's inbox (FR-018).
 *
 * The three groups read the **derived** state, not `recorded`. On `recorded`
 * alone every lapsed request would sit in Pendientes forever, waiting for an
 * answer nobody can usefully give — and the merchant's pending count would keep
 * climbing with work that cannot be done.
 */
export function useReservationInbox(uid: string | undefined, now: Date = new Date()) {
  const { reservations, loading, error } = useReservationQuery('merchantUid', uid);
  const resolved = useMemo(() => resolveAll(reservations, now), [reservations, now]);
  const pending = useMemo(() => resolved.filter((r) => r.state === 'pendiente'), [resolved]);
  const confirmed = useMemo(() => resolved.filter((r) => r.state === 'confirmada'), [resolved]);
  const history = useMemo(
    () => resolved.filter((r) => r.state !== 'pendiente' && r.state !== 'confirmada').slice().reverse(),
    [resolved],
  );
  return { pending, confirmed, history, pendingCount: pending.length, loading, error };
}

/** Which label a reservation shows, from one side's point of view (FR-029). */
export type { ReservationViewer };

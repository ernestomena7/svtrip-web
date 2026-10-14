// Reservations, read side only (feature 020).
//
// **There is no write in this file, and that is deliberate rather than
// incidental.** `reservations` is `allow create, update, delete: if false`, and
// every write goes through the BFF (`core/src/apiClient.ts`). Two parties each
// permitted a different transition on one document would be the most complex
// rule in `firestore.rules`, on the one path where getting it wrong means a
// merchant reading another merchant's travelers.
//
// Reads DO come straight from Firestore, scoped by
// `travelerUid == uid || merchantUid == uid`. That is what makes both lists live
// — FR-012's "appears immediately" without polling, and US3 scenario 5's card
// moving to Confirmadas on its own.
//
// **Both queries need a composite index** (`travelerUid ASC + at ASC` and
// `merchantUid ASC + at ASC`, in `firestore/firestore.indexes.json`). A missing
// one fails at none of this repo's gates — not build, not typecheck, not a unit
// test, not the rules emulator — and then fails in production with
// `FAILED_PRECONDITION`, as a list that never loads.
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { Reservation, ReservationState, ReservationViewer } from '@svtrip/shared';
import { isUpcoming, resolveReservationState } from '@svtrip/shared';
import { db } from '../firebase';

/** A reservation with its state already resolved, so no screen re-derives it. */
export interface ResolvedReservation extends Reservation {
  state: ReservationState;
}

function resolveAll(docs: Reservation[], now: Date): ResolvedReservation[] {
  return docs.map((r) => ({ ...r, state: resolveReservationState(r.recorded, r.at, now) }));
}

function useReservationQuery(field: 'travelerUid' | 'merchantUid', uid: string | undefined) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
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
    const q = query(collection(db, 'reservations'), where(field, '==', uid), orderBy('at'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReservations(snap.docs.map((d) => ({ ...(d.data() as Reservation), reservationId: d.id })));
        setLoading(false);
      },
      (err) => {
        // Surfaced rather than swallowed. A missing composite index arrives here
        // as `failed-precondition`, and feature 010 is the cautionary tale: a
        // swallowed `permission-denied` made a fully built feature look like it
        // had nothing to show.
        setError(err);
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

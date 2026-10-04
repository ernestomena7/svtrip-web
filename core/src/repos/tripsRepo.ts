// Trips, and the stops inside them (feature 016).
//
// Written by the CLIENT, directly, under `isOwner(uid)` — the same way
// `favorites`, `conversations` and `shown` are, because it is the same kind of
// data: private to one traveler and uninteresting to anyone else.
//
// **`server/` gains nothing from this feature, and that is load-bearing rather
// than incidental.** With no BFF route, SC-008 ("the guide's per-turn cost is
// unchanged") holds by construction instead of by discipline, and Principle
// III's contract-test obligation is discharged by absence rather than
// forgotten. The guide's plan is already in the client's hands when a traveler
// chooses to keep it; nothing has to be asked of a model to save it.
//
// Two things this file deliberately does NOT do, each with a task of its own:
//   - It never calls `recordShown` (exposureRepo). That record stops the guide
//     repeating itself and belongs to a deliberate recommendation; filing a
//     place away is not one (FR-017).
//   - It never calls `recordEngagement`. A business must not learn it appears
//     in someone's Trip — the spec puts that in Out of Scope, and the symmetry
//     with favorites is a temptation, not an argument.
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import type { GeneratedPlan, Trip, TripStop, TripOrigin } from '@svtrip/shared';
import { tripOrder } from '@svtrip/shared';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthProvider';

const TRIPS = 'trips';
const STOPS = 'stops';

function tripsCol(uid: string) {
  return collection(db, 'users', uid, TRIPS);
}
function tripRef(uid: string, tripId: string) {
  return doc(db, 'users', uid, TRIPS, tripId);
}
function stopsCol(uid: string, tripId: string) {
  return collection(db, 'users', uid, TRIPS, tripId, STOPS);
}
function stopRef(uid: string, tripId: string, stopId: string) {
  return doc(db, 'users', uid, TRIPS, tripId, STOPS, stopId);
}

/** Touch the Trip so the list can order by recency, per the data model. */
async function touch(uid: string, tripId: string): Promise<void> {
  await updateDoc(tripRef(uid, tripId), { updatedAt: Date.now() });
}

// --- Trips -----------------------------------------------------------------

export interface NewTrip {
  name: string;
  startDate: string;
  origin?: TripOrigin;
  sourceMessageId?: string;
}

/**
 * Create a Trip and return its id.
 *
 * The id is generated rather than derived from the name: two Trips may share a
 * name, and a traveler renaming one must not move it.
 */
export async function createTrip(uid: string, input: NewTrip): Promise<string> {
  const ref = doc(tripsCol(uid));
  const now = Date.now();
  const trip: Trip = {
    tripId: ref.id,
    name: input.name.trim(),
    startDate: input.startDate,
    origin: input.origin ?? 'manual',
    createdAt: now,
    updatedAt: now,
  };
  // `sourceMessageId` is written only when there is one. An `undefined` field
  // is rejected by the SDK, and an empty string would make FR-041's "already
  // kept?" lookup match every hand-made Trip at once.
  if (input.sourceMessageId) trip.sourceMessageId = input.sourceMessageId;
  await setDoc(ref, trip);
  return ref.id;
}

/** Rename a Trip, or move its start date (FR-004). */
export async function updateTrip(
  uid: string,
  tripId: string,
  patch: { name?: string; startDate?: string },
): Promise<void> {
  const fields: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.name !== undefined) fields.name = patch.name.trim();
  if (patch.startDate !== undefined) fields.startDate = patch.startDate;
  await updateDoc(tripRef(uid, tripId), fields);
}

/**
 * Delete a Trip AND every stop inside it (T017).
 *
 * A subcollection does not go with its parent. Deleting only the Trip document
 * leaves its stops behind, unreachable through any screen and permanent — the
 * traveler sees the Trip disappear and the data stays. Firestore has no
 * recursive delete from a client, so the stops are read and removed first.
 *
 * Stops go first deliberately: if the batch fails half-way, a Trip with missing
 * stops is visible and fixable, while orphaned stops under a deleted Trip are
 * neither.
 */
export async function deleteTrip(uid: string, tripId: string): Promise<void> {
  const snap = await getDocs(stopsCol(uid, tripId));
  const batch = writeBatch(db);
  for (const d of snap.docs) batch.delete(d.ref);
  batch.delete(tripRef(uid, tripId));
  await batch.commit();
}

/** Has this assistant turn already been kept? (FR-041) */
export async function tripForMessage(uid: string, messageId: string): Promise<Trip | null> {
  if (!messageId) return null;
  const snap = await getDocs(query(tripsCol(uid), where('sourceMessageId', '==', messageId)));
  return snap.empty ? null : (snap.docs[0].data() as Trip);
}

/**
 * Keep a guide plan as a Trip (US3, FR-037 / FR-038 / FR-039).
 *
 * NO MODEL CALL, NO BFF ROUTE, NO SERVER WORK (FR-048). The plan is already in
 * the client's hands when the traveler chooses to keep it — it was streamed,
 * rendered and persisted on this device. That is what makes SC-008 ("the
 * guide's per-turn cost is unchanged") structural rather than a promise.
 *
 * THE MAPPING IS TOTAL: every stop the guide produced becomes a stop, none
 * dropped (FR-038). `PlanStop` is `{ catalogId, order, reason }` and all three
 * travel — the order becomes `position`, so the Trip opens in the order the
 * guide proposed.
 *
 * TWO FIELDS DELIBERATELY DO NOT TRAVEL:
 *   - `intro` frames a conversational reply ("Aqui tenes un plan para...") and
 *     reads oddly on a saved artifact the traveler will return to next week.
 *   - `outcome` describes the REPLY, not the Trip. Keeping a plan creates a
 *     Trip FROM the reply; it does not convert one into the other, which is the
 *     same distinction FR-049 draws when it forbids renaming `outcome: 'plan'`.
 *
 * Kept stops arrive UNSCHEDULED and are editable, schedulable, reorderable and
 * removable exactly like hand-added ones (FR-039). Origin is remembered in the
 * Trip; it changes nothing about what can be done to it.
 */
export async function createTripFromPlan(
  uid: string,
  input: { name: string; startDate: string },
  plan: GeneratedPlan,
  sourceMessageId: string,
): Promise<string> {
  const tripId = await createTrip(uid, {
    ...input,
    origin: 'guide',
    sourceMessageId,
  });

  const now = Date.now();
  const batch = writeBatch(db);
  for (const stop of [...plan.stops].sort((a, b) => a.order - b.order)) {
    const ref = doc(stopsCol(uid, tripId));
    const doc_: TripStop = {
      stopId: ref.id,
      catalogId: stop.catalogId,
      // The catalog decides what a stop IS; the plan only says which one. Guide
      // stops are catalog places, and `kind` narrows the resolve at read time.
      kind: 'place',
      // The guide's order becomes the arrangement, so the Trip opens the way
      // the plan read. `order` is contiguous from 1 (FR-011); `position` is
      // zero-based here only because `addStop` appends from the max.
      position: stop.order,
      addedAt: now,
    };
    // Absent rather than empty when the guide gave none: a hand-added stop must
    // not render an empty quotation.
    if (stop.reason) doc_.reason = stop.reason;
    batch.set(ref, doc_);
  }
  await batch.commit();
  return tripId;
}

// --- Stops -----------------------------------------------------------------

export interface NewStop {
  catalogId: string;
  kind: TripStop['kind'];
  date?: string;
  time?: string;
  reason?: string;
}

/**
 * Is this place already in that Trip?
 *
 * **This REVERSES FR-014**, which says the same place must be addable more than
 * once. The product owner asked for the opposite after using it: a place filed
 * twice reads as a mistake, not as two visits.
 *
 * Enforced as a RULE rather than by keying the document on `catalogId`. Keying
 * would make duplicates structurally impossible — which is exactly what it does
 * to favorites — and that is a one-way door: the day someone wants the same
 * beach on Saturday and on Sunday, a generated `stopId` still allows it and a
 * keyed one never will. The check costs one query, only when a place is added.
 */
export async function tripHasPlace(
  uid: string,
  tripId: string,
  catalogId: string,
): Promise<boolean> {
  const snap = await getDocs(query(stopsCol(uid, tripId), where('catalogId', '==', catalogId)));
  return !snap.empty;
}

/**
 * Add a stop, appended to the END of the unscheduled group (FR-032).
 *
 * Never inserted into an arrangement the traveler made by hand. The position is
 * computed from what is already there rather than from a stored count — the
 * data model has no `stopCount` on purpose, and a derived value that is only
 * ever read once is cheaper to compute than to keep in step.
 */
export async function addStop(uid: string, tripId: string, input: NewStop): Promise<string> {
  const existing = await getDocs(stopsCol(uid, tripId));
  const maxPosition = existing.docs.reduce(
    (max, d) => Math.max(max, (d.data() as TripStop).position ?? 0),
    -1,
  );
  const ref = doc(stopsCol(uid, tripId));
  const stop: TripStop = {
    stopId: ref.id,
    catalogId: input.catalogId,
    kind: input.kind,
    position: maxPosition + 1,
    addedAt: Date.now(),
  };
  if (input.date) stop.date = input.date;
  // A time without a date places nothing (FR-021), so it is dropped rather than
  // stored as an orphan the ordering would never read.
  if (input.date && input.time) stop.time = input.time;
  if (input.reason) stop.reason = input.reason;
  await setDoc(ref, stop);
  await touch(uid, tripId);
  return ref.id;
}

/**
 * Set or clear a stop's date and time (FR-022, FR-023).
 *
 * TWO effects from one act: clearing the date also clears the time, and the
 * stop returns to the unscheduled group. Missing the second leaves an orphan
 * time on a stop that renders as unscheduled — invisible until someone re-dates
 * it and an hour they do not remember choosing reappears.
 *
 * `position` is deliberately NOT touched. A scheduled stop keeps the place it
 * had among the unscheduled ones, so clearing its date returns it there rather
 * than to an arbitrary spot in an arrangement the traveler made.
 */
export async function scheduleStop(
  uid: string,
  tripId: string,
  stopId: string,
  when: { date?: string; time?: string },
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (when.date) {
    fields.date = when.date;
    fields.time = when.time ? when.time : deleteField();
  } else {
    fields.date = deleteField();
    fields.time = deleteField();
  }
  await updateDoc(stopRef(uid, tripId, stopId), fields);
  await touch(uid, tripId);
}

/** Remove one stop (FR-016). */
export async function removeStop(uid: string, tripId: string, stopId: string): Promise<void> {
  await deleteDoc(stopRef(uid, tripId, stopId));
  await touch(uid, tripId);
}

/**
 * Move a stop to a new place in the unscheduled group (FR-030).
 *
 * ONE write, not a renumbering: the stop is positioned BETWEEN its new
 * neighbours by taking the midpoint of their positions. Renumbering the whole
 * group would turn one drag into as many writes as there are stops.
 *
 * `unscheduledInOrder` is the group as the traveler currently sees it, and
 * `toIndex` is where the stop lands in that same list.
 */
export async function repositionStop(
  uid: string,
  tripId: string,
  stopId: string,
  unscheduledInOrder: readonly TripStop[],
  toIndex: number,
): Promise<void> {
  const others = unscheduledInOrder.filter((s) => s.stopId !== stopId);
  const before = others[toIndex - 1];
  const after = others[toIndex];

  let position: number;
  if (!before && !after) position = 0;
  else if (!before) position = after.position - 1;
  else if (!after) position = before.position + 1;
  else position = (before.position + after.position) / 2;

  await updateDoc(stopRef(uid, tripId, stopId), { position });
  await touch(uid, tripId);
}

// --- Live views ------------------------------------------------------------

/** The traveler's Trips, most recently touched first. */
export function useTrips(): { trips: Trip[]; loading: boolean } {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }
    // Cleared BEFORE subscribing, not only on sign-out: on a switch from one
    // account to another this effect re-runs with the new uid while `trips`
    // still holds the previous traveler's list, and with `loading` false the
    // screen presents it as the new one's. The same reasoning `exposureRepo`
    // carries, and it matters as much here — a Trip names where someone is
    // going.
    setTrips([]);
    setLoading(true);
    return onSnapshot(
      tripsCol(user.uid),
      (snap) => {
        setTrips(
          snap.docs.map((d) => d.data() as Trip).sort((a, b) => b.updatedAt - a.updatedAt),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [user]);

  return { trips, loading };
}

/**
 * One Trip's stops, already ordered.
 *
 * The ordering comes from `shared/`'s `tripOrder` and is NOT re-implemented
 * here or in any screen — FR-044 puts the same Trip on two surfaces, and two
 * implementations of "chronological first" will not stay identical.
 */
export function useTripStops(tripId: string | undefined): {
  stops: TripStop[];
  loading: boolean;
} {
  const { user } = useAuth();
  const [raw, setRaw] = useState<TripStop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !tripId) {
      setRaw([]);
      setLoading(false);
      return;
    }
    setRaw([]);
    setLoading(true);
    return onSnapshot(
      stopsCol(user.uid, tripId),
      (snap) => {
        setRaw(snap.docs.map((d) => d.data() as TripStop));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [user, tripId]);

  const stops = useMemo(() => tripOrder(raw), [raw]);
  return { stops, loading };
}

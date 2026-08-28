// The traveler's own record of what the guide has shown them (feature 013, T005).
//
// Written by the CLIENT, directly, under `isOwner(uid)` — the same way
// `favorites` and `conversations` are written, because it is the same kind of
// data: private, per-traveler, uninteresting to anyone else.
//
// Not written by the BFF, and the contrast is the reasoning. Engagement metrics
// go through the Admin SDK because a client must not be able to inflate a
// business's numbers. Nobody has an incentive to lie about what they themselves
// have been shown, and a lie would only change what that same traveler sees
// next.
//
// **Every write here is fire-and-forget.** A failed write costs a slightly
// staler ranking; a failed REPLY costs the traveler their answer (FR-006). The
// two are not close, so nothing in this file is ever awaited on the path that
// produces an answer.
import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { ExposureEntry } from '@svtrip/shared';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthProvider';

const COLLECTION = 'shown';

/**
 * How many entries travel with a guide request.
 *
 * Bounded because an unbounded list would grow on every request for the rest of
 * a traveler's life. The ranking only asks "what have I seen lately", and the
 * catalog is 36 entries, so this covers it comfortably while staying a cap
 * rather than an accident.
 */
export const SEEN_LIMIT = 60;

function ref(uid: string, catalogId: string) {
  return doc(db, 'users', uid, COLLECTION, catalogId);
}

/**
 * Record that an entry appeared in a reply.
 *
 * `merge: true` so a repeat appearance updates the timestamp without erasing
 * `takenUpAt` — losing that would turn "visited once" back into "never acted
 * on", which is the distinction FR-002 exists for.
 */
export function recordShown(uid: string, catalogIds: readonly string[]): void {
  if (!uid || !catalogIds.length) return;
  const now = Date.now();
  const batch = writeBatch(db);
  for (const catalogId of catalogIds) {
    batch.set(
      ref(uid, catalogId),
      { catalogId, shownAt: now, shownCount: 1 },
      { merge: true },
    );
  }
  // Deliberately not awaited — see the note at the top of this file.
  void batch.commit().catch(() => undefined);
}

/** Record that the traveler opened, saved, or routed to an entry (FR-002). */
export function recordTakenUp(uid: string, catalogId: string): void {
  if (!uid || !catalogId) return;
  const now = Date.now();
  void setDoc(
    ref(uid, catalogId),
    { catalogId, takenUpAt: now, shownAt: now },
    { merge: true },
  ).catch(() => undefined);
}

/** Read the record once, most recent first, bounded for the wire. */
export async function loadExposure(uid: string, limit = SEEN_LIMIT): Promise<ExposureEntry[]> {
  if (!uid) return [];
  try {
    const snap = await getDocs(collection(db, 'users', uid, COLLECTION));
    return snap.docs
      .map((d) => d.data() as ExposureEntry)
      .sort((a, b) => b.shownAt - a.shownAt)
      .slice(0, limit);
  } catch {
    // A traveler with no readable record is served as one with no record at
    // all (FR-007), which is exactly today's behaviour.
    return [];
  }
}

/** Live view of the record, for the screen that lets a traveler see it (FR-005). */
export function useExposure(): { entries: ExposureEntry[]; loading: boolean } {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ExposureEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    return onSnapshot(
      collection(db, 'users', user.uid, COLLECTION),
      (snap) => {
        setEntries(
          snap.docs
            .map((d) => d.data() as ExposureEntry)
            .sort((a, b) => b.shownAt - a.shownAt),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [user]);

  return { entries, loading };
}

/**
 * Clear the whole record (FR-005).
 *
 * Awaited, unlike the writes above: this one is a deliberate action the
 * traveler is waiting on, and it needs to either finish or say it did not.
 */
export async function clearExposure(uid: string): Promise<void> {
  if (!uid) return;
  const snap = await getDocs(collection(db, 'users', uid, COLLECTION));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

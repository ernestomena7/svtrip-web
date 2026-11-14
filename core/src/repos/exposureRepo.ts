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
import type { ExposureEntry } from '@svtrip/shared';
import { supabase } from '../supabase';
import { rowsOf, subscribeLive, userTopic } from '../db/live';
import { fromRow, toRow } from '@svtrip/shared';
import { useAuth } from '../auth/AuthProvider';


/**
 * How many entries travel with a guide request.
 *
 * Bounded because an unbounded list would grow on every request for the rest of
 * a traveler's life. The ranking only asks "what have I seen lately", and the
 * catalog is 36 entries, so this covers it comfortably while staying a cap
 * rather than an accident.
 */
export const SEEN_LIMIT = 60;

const TABLE = 'shown';
const entriesOf = (rows: Record<string, unknown>[]) => rows.map((r) => fromRow<ExposureEntry>(TABLE, r));

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
  // One upsert, and it keeps the merge semantics above: it sets only the columns it names, so a
  // `taken_up_at` already on the row survives.
  const rows = catalogIds.map((catalogId) => ({ profile_id: uid, ...toRow(TABLE, { catalogId, shownAt: now, shownCount: 1 }) }));
  // Deliberately not awaited — see the note at the top of this file.
  void supabase.from(TABLE).upsert(rows, { onConflict: 'profile_id,catalog_id' }).then(() => undefined, () => undefined);
}

/** Record that the traveler opened, saved, or routed to an entry (FR-002). */
export function recordTakenUp(uid: string, catalogId: string): void {
  if (!uid || !catalogId) return;
  const now = Date.now();
  void supabase
    .from(TABLE)
    .upsert({ profile_id: uid, ...toRow(TABLE, { catalogId, takenUpAt: now, shownAt: now }) }, { onConflict: 'profile_id,catalog_id' })
    .then(() => undefined, () => undefined);
}

/** Read the record once, most recent first, bounded for the wire. */
export async function loadExposure(uid: string, limit = SEEN_LIMIT): Promise<ExposureEntry[]> {
  if (!uid) return [];
  try {
    return entriesOf(rowsOf(await supabase.from(TABLE).select('*').eq('profile_id', uid)))
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
    // Clear BEFORE subscribing, not only on sign-out.
    //
    // On a switch from one account to another this effect re-runs with the
    // new uid while `entries` still holds the previous traveler's history —
    // and with `loading` false, the screen presents it as the new one's. This
    // is the record of what the guide has shown a specific person; it must
    // never be on screen for anybody else, not even for the moment a
    // snapshot takes to arrive.
    setEntries([]);
    setLoading(true);
    return subscribeLive(
      {
        table: TABLE,
        topic: userTopic(user.uid),
        read: async () => entriesOf(rowsOf(await supabase.from(TABLE).select('*').eq('profile_id', user.uid))),
      },
      (list) => {
        setEntries(list.sort((a, b) => b.shownAt - a.shownAt));
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
  const { error } = await supabase.from(TABLE).delete().eq('profile_id', uid);
  if (error) throw error;
}

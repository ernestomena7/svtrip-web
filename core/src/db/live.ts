// Live queries (feature 023, R5) — the replacement for Firestore's `onSnapshot`, used by every one of
// the 14 screens that update live.
//
// The pattern: run the query; listen for a PING that the table changed; on every ping, run the query
// again. Re-reading instead of patching the previous result in place is the deliberate choice — at
// this product's scale it costs one small query per change, and it cannot apply a partial row
// wrongly, mis-order a list, or miss a row that RLS newly reveals.
//
// PINGS, NOT `postgres_changes`, and the reason is a measured leak: with `postgres_changes` a second
// account received another traveler's deleted favorite, uid and place included — RLS is not applied
// to DELETE events. The database now sends an EMPTY broadcast (event = table name) to a PRIVATE
// topic only the right accounts may join (supabase/migrations/*_realtime_023.sql):
//
//   user:<uid>   the row's owner(s)            → userTopic(uid)
//   place:<id>   a catalog entry, its reviews  → placeTopic(id)
//
// So a ping can make a screen re-query; it can never tell it anything. What the screen shows still
// comes from a read RLS decides.
//
// Every successful result is remembered (offlineCache), and an initial read that fails while
// offline is answered from it — FR-019.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { readThrough, remember } from './offlineCache';

export interface LiveSpec<T> {
  /** The table whose changes re-run the query — the ping's event name. */
  table: string;
  /** Who hears about that table's changes: `userTopic(uid)` or `placeTopic(id)`. */
  topic: string;
  /** Runs the query and maps rows to app values. Throw to report an error. */
  read: () => Promise<T>;
  /** Offline-cache key; omit for data that must not be cached. */
  cacheKey?: string;
}

/** The private topic of one account: its own rows, and the reservations/claims it is party to. */
export const userTopic = (uid: string) => `user:${uid}`;
/** The topic of one catalog entry (a listing or a place) and its reviews. */
export const placeTopic = (id: string) => `place:${id}`;

interface Listener {
  table: string;
  rerun: () => void;
}
interface Hub {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
  joinedOnce: boolean;
}

// ONE channel per topic, shared and reference-counted. Not a nicety: `supabase.channel(topic)`
// returns the EXISTING channel for a topic already open (realtime-js), so two screens each opening
// and later removing "their" channel would have the first removal silence the other screen.
const hubs = new Map<string, Hub>();

function hubFor(topic: string): Hub {
  const open = hubs.get(topic);
  if (open) return open;
  const hub: Hub = { channel: supabase.channel(topic, { config: { private: true } }), listeners: new Set(), joinedOnce: false };
  hub.channel
    .on('broadcast', { event: '*' }, (msg) => {
      for (const l of hub.listeners) if (l.table === msg.event) l.rerun();
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      // A RE-join re-reads everything on the topic. Pings are fire-and-forget — `realtime.send`
      // swallows its own errors, and none are delivered while the socket is down — so a change made
      // during a disconnect would otherwise never reach the screen. Measured: after a database
      // restart the first pings are lost while the writes succeed. The first join needs no re-read:
      // every listener has just run its initial one.
      if (hub.joinedOnce) for (const l of hub.listeners) l.rerun();
      hub.joinedOnce = true;
    });
  hubs.set(topic, hub);
  return hub;
}

export function subscribeLive<T>(spec: LiveSpec<T>, onData: (value: T) => void, onError?: (err: unknown) => void): () => void {
  let closed = false;
  const run = async (first: boolean) => {
    try {
      const value = first && spec.cacheKey ? await readThrough(spec.cacheKey, spec.read) : await spec.read();
      if (!first && spec.cacheKey) remember(spec.cacheKey, value);
      if (!closed) onData(value);
    } catch (err) {
      if (!closed) onError?.(err);
    }
  };

  void run(true);

  const hub = hubFor(spec.topic);
  const listener: Listener = { table: spec.table, rerun: () => void run(false) };
  hub.listeners.add(listener);

  return () => {
    if (closed) return;
    closed = true;
    hub.listeners.delete(listener);
    if (hub.listeners.size === 0) {
      // Only if it is still THE hub for this topic: a repeated close must not drop a newer one.
      if (hubs.get(spec.topic) === hub) hubs.delete(spec.topic);
      void supabase.removeChannel(hub.channel);
    }
  };
}

/** Unwraps a PostgREST result: throws its error, returns its rows. */
export function rowsOf<R>(res: { data: R[] | null; error: { message: string } | null }): R[] {
  if (res.error) throw Object.assign(new Error(res.error.message), res.error);
  return res.data ?? [];
}

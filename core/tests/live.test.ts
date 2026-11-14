// subscribeLive on private ping channels (feature 023, T055).
//
// NEW FILE. The three behaviours here are the ones a "simplify it" edit would quietly lose: two
// screens on one topic share ONE channel (realtime-js hands back the open one, so per-screen removal
// would silence the other screen), a ping re-runs only the listeners for ITS table, and a re-join
// re-reads — because a ping missed while disconnected is otherwise never made up.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createFakeSupabase, flush } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));

const live = await import('../src/db/live');
const { userTopic, placeTopic } = live;

// Every subscription is closed after each case: the hub map is MODULE state, so one left open would
// still be attached to its topic in the next case (found by these cases failing that way).
const open: (() => void)[] = [];
const subscribeLive: typeof live.subscribeLive = (...args) => {
  const close = live.subscribeLive(...args);
  let done = false;
  const once = () => {
    if (!done) close();
    done = true;
  };
  open.push(once);
  return once;
};

beforeEach(() => fake.reset());
afterEach(() => {
  for (const close of open.splice(0)) close();
});

function counter() {
  let n = 0;
  return { read: async () => ++n, get reads() { return n; } };
}

describe('subscribeLive', () => {
  it('joins the topic as a PRIVATE channel', async () => {
    subscribeLive({ table: 'favorites', topic: userTopic('u1'), read: async () => 1 }, () => {});
    expect(fake.channels).toHaveLength(1);
    expect(fake.channels[0].topic).toBe('user:u1');
    expect(fake.channels[0].config).toEqual({ private: true });
  });

  it('re-reads on a ping for its table, and ONLY for its table', async () => {
    const favs = counter();
    const trips = counter();
    subscribeLive({ table: 'favorites', topic: userTopic('u1'), read: favs.read }, () => {});
    subscribeLive({ table: 'trips', topic: userTopic('u1'), read: trips.read }, () => {});
    await flush();
    expect([favs.reads, trips.reads]).toEqual([1, 1]);

    fake.emit('user:u1', 'favorites');
    await flush();
    expect([favs.reads, trips.reads]).toEqual([2, 1]);
  });

  it('two screens on one topic share ONE channel, and closing one does not silence the other', async () => {
    const a = counter();
    const b = counter();
    const closeA = subscribeLive({ table: 'reviews', topic: placeTopic('el-tunco'), read: a.read }, () => {});
    subscribeLive({ table: 'reviews', topic: placeTopic('el-tunco'), read: b.read }, () => {});
    expect(fake.channels.filter((c) => !c.removed)).toHaveLength(1);

    closeA();
    fake.emit('place:el-tunco', 'reviews');
    await flush();
    expect(b.reads).toBe(2);
    expect(fake.channels[0].removed).toBe(false);
  });

  it('removes the channel when its LAST listener closes', async () => {
    const close1 = subscribeLive({ table: 'trips', topic: userTopic('u1'), read: async () => 1 }, () => {});
    const close2 = subscribeLive({ table: 'trip_stops', topic: userTopic('u1'), read: async () => 1 }, () => {});
    close1();
    expect(fake.channels[0].removed).toBe(false);
    close2();
    expect(fake.channels[0].removed).toBe(true);
  });

  it('re-reads every listener on a RE-join, not on the first join', async () => {
    const r = counter();
    subscribeLive({ table: 'reservations', topic: userTopic('u1'), read: r.read }, () => {});
    await flush();
    fake.status('user:u1', 'SUBSCRIBED'); // the first join: the initial read already ran
    await flush();
    expect(r.reads).toBe(1);
    fake.status('user:u1', 'CHANNEL_ERROR');
    fake.status('user:u1', 'SUBSCRIBED'); // back after a disconnect: pings may have been missed
    await flush();
    expect(r.reads).toBe(2);
  });

  it('a closed subscription never delivers again', async () => {
    const seen: number[] = [];
    const r = counter();
    const close = subscribeLive({ table: 'favorites', topic: userTopic('u1'), read: r.read }, (v) => seen.push(v));
    subscribeLive({ table: 'favorites', topic: userTopic('u1'), read: async () => 0 }, () => {});
    await flush();
    close();
    fake.emit('user:u1', 'favorites');
    await flush();
    expect(seen).toEqual([1]);
  });
});

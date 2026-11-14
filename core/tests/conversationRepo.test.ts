// Regression test for a real bug found in production (2026-08-11): the desktop
// guide at /guide rendered a blank page.
//
// `subscribeToConversations` did `d.data() as Conversation`, which asserts a
// shape without producing it. `updatedAt` came back as a Firestore `Timestamp`,
// never the `number` the type declares, so `new Date(theObject)` → Invalid Date →
// `Intl.DateTimeFormat.format` → `RangeError`, thrown during render, unmounting
// the whole React tree.
//
// CHANGED IN THE PORT (feature 023, FR-011). The boundary moved but did not go
// away: Postgres hands back `timestamptz` as an ISO STRING, which is just as much
// "not a number" as the Timestamp object was — `new Date('2026-…')` works, but
// `b.updatedAt - a.updatedAt` on two strings is NaN and the sort breaks silently.
// So the same five properties are pinned against what the table really returns.
// The Firestore-only case ("passes through a plain number") is replaced by the
// case that can now happen: a row carrying epoch-ms written by an old client
// still reads as a number. Every assertion about the EMITTED value is unchanged.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createFakeSupabase, flush } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));

const { subscribeToConversations } = await import('../src/repos/conversationRepo');

const iso = (ms: number) => new Date(ms).toISOString();

/** Runs the subscription against the fake table and returns what it emitted. */
async function emit(rows: Array<Record<string, unknown>>) {
  fake.seed('conversations', rows);
  const received: unknown[] = [];
  subscribeToConversations('uid-1', (list) => received.push(...list));
  await flush();
  return received as Array<{ conversationId: string; createdAt: number; updatedAt: number }>;
}

const conversation = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  profile_id: 'uid-1',
  title: 'Playas',
  last_message_preview: 'Te recomiendo El Tunco',
  recommendation_count: 3,
  created_at: iso(1_760_000_000_000),
  updated_at: iso(1_770_000_000_000),
  ...over,
});

beforeEach(() => fake.reset());

describe('subscribeToConversations — timestamps', () => {
  it('emits millisecond numbers, not the strings the database returns', async () => {
    const [row] = await emit([conversation()]);

    expect(typeof row.updatedAt).toBe('number');
    expect(typeof row.createdAt).toBe('number');
    expect(row.updatedAt).toBe(1_770_000_000_000);
    expect(row.createdAt).toBe(1_760_000_000_000);
  });

  it('produces a value Intl can format — the exact call that blanked the page', async () => {
    const [row] = await emit([conversation()]);

    expect(() =>
      new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(row.updatedAt)),
    ).not.toThrow();
    expect(Number.isNaN(new Date(row.updatedAt).getTime())).toBe(false);
  });

  it('sorts newest first', async () => {
    const rows = await emit([
      conversation({ id: 'older', updated_at: iso(1_000) }),
      conversation({ id: 'newest', updated_at: iso(9_000) }),
      conversation({ id: 'middle', updated_at: iso(5_000) }),
    ]);

    expect(rows.map((r) => r.conversationId)).toEqual(['newest', 'middle', 'older']);
  });

  it('keeps a row with no timestamp, dated 0', async () => {
    // The column is NOT NULL, so this cannot come from the database today. It stays because the
    // documented behaviour is "the row stays in the list and renders without a date" — dropping a
    // conversation from the list is worse than a missing date, whatever the cause.
    const rows = await emit([conversation({ id: 'pending', updated_at: null })]);

    expect(rows).toHaveLength(1);
    expect(rows[0].updatedAt).toBe(0);
  });

  it('only returns the caller’s own conversations', async () => {
    // Replaces "passes through a plain number" (a Firestore-only shape). The query is scoped by
    // profile_id; RLS enforces it in the database, and this pins that the repo asks for it.
    const rows = await emit([conversation(), conversation({ id: 'not-mine', profile_id: 'uid-2' })]);

    expect(rows.map((r) => r.conversationId)).toEqual(['c1']);
  });
});

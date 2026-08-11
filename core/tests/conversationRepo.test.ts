// Regression test for a real bug found in production (2026-08-11): the desktop
// guide at /guide rendered a blank page.
//
// `subscribeToConversations` did `d.data() as Conversation`, which asserts a
// shape without producing it. `updatedAt` is written with `serverTimestamp()`
// and comes back as a Firestore `Timestamp`, never the `number` the type
// declares, so every reader downstream was handed an object the compiler had
// promised was a number.
//
// What made it hard to spot is that it did not fail where it was wrong. The
// consumer guarded with `updatedAt > 0` and that guard PASSED, because
// `Timestamp.valueOf()` returns a sortable numeric string. It failed one step
// later, in `new Date(theObject)` → Invalid Date → `Intl.DateTimeFormat.format`
// → `RangeError: Invalid time value`. Thrown during render, that unmounts the
// whole React tree, so the symptom was an empty page rather than a missing date
// on one row.
//
// These tests pin the conversion at the boundary, where the type contract
// should have been honoured in the first place.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/firebase', () => ({ db: {} }));

const onSnapshotMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

const { subscribeToConversations } = await import('../src/repos/conversationRepo');

/**
 * Stands in for a Firestore `Timestamp`. `valueOf` returning a sortable string
 * is not incidental detail — it is the exact reason the original bug slipped
 * past a `> 0` guard, so a fake without it would test a friendlier world than
 * the real one.
 */
class FakeTimestamp {
  constructor(private readonly ms: number) {}
  toMillis(): number {
    return this.ms;
  }
  valueOf(): string {
    return String(this.ms).padStart(20, '0');
  }
}

function snapshotDoc(data: Record<string, unknown>) {
  return { data: () => data, get: (key: string) => data[key] };
}

/** Runs the subscription against one fake snapshot and returns what it emitted. */
function emit(docs: Array<Record<string, unknown>>) {
  const received: unknown[] = [];
  subscribeToConversations('uid-1', (rows) => received.push(...rows));
  const onNext = onSnapshotMock.mock.calls[0][1] as (snap: unknown) => void;
  onNext({ docs: docs.map(snapshotDoc) });
  return received as Array<{ conversationId: string; createdAt: number; updatedAt: number }>;
}

const conversation = (over: Record<string, unknown> = {}) => ({
  conversationId: 'c1',
  title: 'Playas',
  lastMessagePreview: 'Te recomiendo El Tunco',
  recommendationCount: 3,
  createdAt: new FakeTimestamp(1_760_000_000_000),
  updatedAt: new FakeTimestamp(1_770_000_000_000),
  ...over,
});

beforeEach(() => {
  onSnapshotMock.mockReset();
});

describe('subscribeToConversations — server timestamps', () => {
  it('emits millisecond numbers, not the Timestamp objects Firestore returns', () => {
    const [row] = emit([conversation()]);

    expect(typeof row.updatedAt).toBe('number');
    expect(typeof row.createdAt).toBe('number');
    expect(row.updatedAt).toBe(1_770_000_000_000);
    expect(row.createdAt).toBe(1_760_000_000_000);
  });

  it('produces a value Intl can format — the exact call that blanked the page', () => {
    const [row] = emit([conversation()]);

    // Pre-fix this threw `RangeError: Invalid time value` here, uncaught during
    // render. Asserting the formatter rather than just the type is the point:
    // the type was never the thing that broke.
    expect(() =>
      new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(row.updatedAt)),
    ).not.toThrow();
    expect(Number.isNaN(new Date(row.updatedAt).getTime())).toBe(false);
  });

  // NOT a regression test, and deliberately kept anyway. It was written as one,
  // on the assumption that `object - object` was NaN and the ordering had been
  // silently wrong all along. Run against the pre-fix code it PASSED: because
  // `Timestamp.valueOf()` yields a numeric string, subtraction coerced both
  // sides and sorted correctly. The assumption was wrong and only running it
  // against the old code revealed that. It stays as a behavioural pin on the
  // ordering, which nothing else asserts.
  it('sorts newest first', () => {
    const rows = emit([
      { ...conversation(), conversationId: 'older', updatedAt: new FakeTimestamp(1_000) },
      { ...conversation(), conversationId: 'newest', updatedAt: new FakeTimestamp(9_000) },
      { ...conversation(), conversationId: 'middle', updatedAt: new FakeTimestamp(5_000) },
    ]);

    expect(rows.map((r) => r.conversationId)).toEqual(['newest', 'middle', 'older']);
  });

  it('keeps a row whose server timestamp has not landed yet, dated 0', () => {
    // `serverTimestamp()` reads back as null on the writer's own device until
    // the server confirms. The documented behaviour is that such a row stays in
    // the list and simply renders without a date — dropping it would make a
    // conversation vanish for a moment right after it was created.
    const rows = emit([{ ...conversation(), conversationId: 'pending', updatedAt: null }]);

    expect(rows).toHaveLength(1);
    expect(rows[0].updatedAt).toBe(0);
  });

  it('passes through a plain number, so a non-serverTimestamp field still works', () => {
    const [row] = emit([{ ...conversation(), updatedAt: 1_234_567 }]);

    expect(row.updatedAt).toBe(1_234_567);
  });
});

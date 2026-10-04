// T016 (feature 016): the writes `tripsRepo` makes, and the two it must not.
//
// Firestore is mocked, so what is under test is the DECISIONS — which fields
// are written, which are deleted, where a new stop lands, and what deleting a
// Trip takes with it. Those are the parts a screen cannot check and a rules
// test does not reach.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/firebase', () => ({ db: {} }));
vi.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));

const setDocMock = vi.fn(async () => undefined);
const updateDocMock = vi.fn(async () => undefined);
const deleteDocMock = vi.fn(async () => undefined);
const getDocsMock = vi.fn(async () => ({ docs: [], empty: true }));
const batchDelete = vi.fn();
const batchCommit = vi.fn(async () => undefined);

/** A sentinel the tests can recognise, standing in for Firestore's `deleteField()`. */
const DELETE = Symbol('deleteField');

let generatedId = 0;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...path: unknown[]) => ({ path })),
  doc: vi.fn((...args: unknown[]) => {
    // `doc(col)` with no id is the generate-an-id form the repo uses for both
    // Trips and stops; `doc(db, ...segments)` is the addressing form.
    if (args.length === 1) return { id: `generated-${++generatedId}` };
    return { id: String(args[args.length - 1]), path: args };
  }),
  setDoc: (...a: unknown[]) => setDocMock(...(a as [])),
  updateDoc: (...a: unknown[]) => updateDocMock(...(a as [])),
  deleteDoc: (...a: unknown[]) => deleteDocMock(...(a as [])),
  getDocs: (...a: unknown[]) => getDocsMock(...(a as [])),
  onSnapshot: vi.fn(),
  query: vi.fn((...a: unknown[]) => ({ q: a })),
  where: vi.fn((...a: unknown[]) => ({ w: a })),
  writeBatch: vi.fn(() => ({ delete: batchDelete, commit: batchCommit })),
  deleteField: vi.fn(() => DELETE),
}));

const repo = await import('../src/repos/tripsRepo');

const UID = 'alice';
const TRIP = 'trip-1';

/** The document body handed to `setDoc`, from the most recent call. */
function lastWritten(): Record<string, unknown> {
  return setDocMock.mock.calls.at(-1)![1] as Record<string, unknown>;
}
/**
 * The field map handed to the FIRST `updateDoc`, which is the stop patch.
 *
 * Not the last: every mutation also calls `touch()`, whose `{ updatedAt }`
 * would otherwise be what every assertion here reads.
 */
function firstPatched(): Record<string, unknown> {
  return updateDocMock.mock.calls[0]![1] as Record<string, unknown>;
}

function stopDocs(...stops: Array<{ stopId: string; position: number }>) {
  return {
    docs: stops.map((s) => ({ data: () => s, ref: { id: s.stopId } })),
    empty: stops.length === 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDocsMock.mockResolvedValue({ docs: [], empty: true } as never);
});

describe('creating a Trip', () => {
  it('writes a manual origin by default and no sourceMessageId at all', async () => {
    await repo.createTrip(UID, { name: '  Costa  ', startDate: '2026-10-10' });
    const written = lastWritten();
    expect(written.origin).toBe('manual');
    // Absent, not undefined and not empty: the SDK rejects `undefined`, and an
    // empty string would make FR-041's "already kept?" lookup match every
    // hand-made Trip at once.
    expect('sourceMessageId' in written).toBe(false);
  });

  it('trims the name', async () => {
    await repo.createTrip(UID, { name: '  Costa  ', startDate: '2026-10-10' });
    expect(lastWritten().name).toBe('Costa');
  });

  it('keeps the start date as the calendar day it was given', async () => {
    // Not parsed, not re-serialised. The moment this becomes a timestamp the
    // FR-020 comparison acquires a timezone it has no business having.
    await repo.createTrip(UID, { name: 'Costa', startDate: '2026-10-10' });
    expect(lastWritten().startDate).toBe('2026-10-10');
  });

  it('records the source turn when a guide plan is kept', async () => {
    await repo.createTrip(UID, {
      name: 'Del guia',
      startDate: '2026-10-10',
      origin: 'guide',
      sourceMessageId: 'msg-7',
    });
    expect(lastWritten()).toMatchObject({ origin: 'guide', sourceMessageId: 'msg-7' });
  });
});

describe('adding a stop', () => {
  it('appends to the END of the group, never into the arrangement (FR-032)', async () => {
    getDocsMock.mockResolvedValue(
      stopDocs({ stopId: 'a', position: 0 }, { stopId: 'b', position: 5 }) as never,
    );
    await repo.addStop(UID, TRIP, { catalogId: 'el-tunco', kind: 'place' });
    expect(lastWritten().position).toBe(6);
  });

  it('starts at 0 in an empty Trip', async () => {
    await repo.addStop(UID, TRIP, { catalogId: 'el-tunco', kind: 'place' });
    expect(lastWritten().position).toBe(0);
  });

  it('drops a time that arrives without a date (FR-021)', async () => {
    // A time with no day places nothing. Stored, it would be an orphan the
    // ordering never reads and a later date would resurrect.
    await repo.addStop(UID, TRIP, { catalogId: 'el-tunco', kind: 'place', time: '09:00' });
    const written = lastWritten();
    expect('time' in written).toBe(false);
    expect('date' in written).toBe(false);
  });

  it('keeps a time that arrives with a date', async () => {
    await repo.addStop(UID, TRIP, {
      catalogId: 'el-tunco',
      kind: 'place',
      date: '2026-10-11',
      time: '09:00',
    });
    expect(lastWritten()).toMatchObject({ date: '2026-10-11', time: '09:00' });
  });

  it('carries the guide reason only when there is one', async () => {
    await repo.addStop(UID, TRIP, { catalogId: 'el-tunco', kind: 'place' });
    expect('reason' in lastWritten()).toBe(false);
    await repo.addStop(UID, TRIP, { catalogId: 'el-tunco', kind: 'place', reason: 'Ideal al atardecer' });
    expect(lastWritten().reason).toBe('Ideal al atardecer');
  });

  it('generates the stop id and never uses the catalog id (FR-014)', async () => {
    // Keyed by place, the same place could not appear twice in one Trip —
    // exactly what keying does to favorites.
    await repo.addStop(UID, TRIP, { catalogId: 'el-tunco', kind: 'place' });
    expect(lastWritten().stopId).not.toBe('el-tunco');
    expect(String(lastWritten().stopId)).toMatch(/^generated-/);
  });
});

describe('scheduling and clearing (FR-023)', () => {
  it('clearing the date clears the time as well', async () => {
    await repo.scheduleStop(UID, TRIP, 'stop-1', {});
    const patch = firstPatched();
    expect(patch.date).toBe(DELETE);
    expect(patch.time).toBe(DELETE);
  });

  it('setting a date without a time removes any time that was there', async () => {
    await repo.scheduleStop(UID, TRIP, 'stop-1', { date: '2026-10-11' });
    const patch = firstPatched();
    expect(patch.date).toBe('2026-10-11');
    expect(patch.time).toBe(DELETE);
  });

  it('never touches position, so clearing a date returns the stop where it was', async () => {
    await repo.scheduleStop(UID, TRIP, 'stop-1', { date: '2026-10-11', time: '09:00' });
    expect('position' in firstPatched()).toBe(false);
  });
});

describe('deleting a Trip (T017)', () => {
  it('deletes every stop as well, not just the Trip document', async () => {
    // A subcollection does not go with its parent. Orphaned stops under a
    // deleted Trip are unreachable through any screen and permanent.
    getDocsMock.mockResolvedValue(
      stopDocs({ stopId: 'a', position: 0 }, { stopId: 'b', position: 1 }) as never,
    );
    await repo.deleteTrip(UID, TRIP);
    expect(batchDelete).toHaveBeenCalledTimes(3); // two stops plus the Trip
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });
});

describe('repositioning (FR-030)', () => {
  const group = [
    { stopId: 'a', position: 0 },
    { stopId: 'b', position: 1 },
    { stopId: 'c', position: 2 },
  ] as never;

  it('lands between its new neighbours in ONE write, without renumbering', async () => {
    await repo.repositionStop(UID, TRIP, 'c', group, 1);
    expect(updateDocMock).toHaveBeenCalledTimes(2); // the stop, then the Trip touch
    expect(lastUpdateOf('position')).toBe(0.5);
  });

  it('goes below the first stop when moved to the top', async () => {
    await repo.repositionStop(UID, TRIP, 'c', group, 0);
    expect(lastUpdateOf('position')).toBe(-1);
  });

  it('goes above the last stop when moved to the end', async () => {
    await repo.repositionStop(UID, TRIP, 'a', group, 2);
    expect(lastUpdateOf('position')).toBe(3);
  });
});

/** The value written for `field` by the first `updateDoc` of the last call pair. */
function lastUpdateOf(field: string): unknown {
  for (const call of updateDocMock.mock.calls) {
    const patch = call[1] as Record<string, unknown>;
    if (field in patch) return patch[field];
  }
  return undefined;
}

// T016 (feature 016): the writes `tripsRepo` makes, and the two it must not.
//
// What is under test is the DECISIONS — which fields are written, which are cleared, where a new
// stop lands, and what deleting a Trip takes with it. Those are the parts a screen cannot check and
// an access-policy test does not reach.
//
// CHANGED IN THE PORT (feature 023, FR-011). The Firestore mocks (setDoc/updateDoc/writeBatch) are
// replaced by the shared Supabase fake; assertions read the INSERT/UPDATE the repo sends, converted
// back to app field names. Three mechanisms changed, each named where it is asserted:
//   * a generated id now comes from the DATABASE (the insert carries none), not from `doc(col)`;
//   * Firestore's `deleteField()` is a column set to `null`;
//   * deleting a Trip is ONE delete — `trip_stops` cascades from `trips` in the schema, proven
//     against the real database in supabase/tests/trips.rls.test.ts.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));
vi.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));

const repo = await import('../src/repos/tripsRepo');
const { fromRow } = await import('@svtrip/shared');

const UID = 'alice';
const TRIP = 'trip-1';

/** What `deleteField()` used to be: the column cleared. */
const DELETE = null;

/** The app value of the most recent INSERT to trips or trip_stops. */
function lastWritten(): Record<string, unknown> {
  const w = fake.writes.filter((x) => x.op === 'insert' && (x.table === 'trips' || x.table === 'trip_stops')).at(-1)!;
  return fromRow(w.table as 'trips', w.values as Record<string, unknown>) as Record<string, unknown>;
}
/**
 * The column map of the FIRST update to `trip_stops`, which is the stop patch. Not the last write:
 * every mutation also calls `touch()` on the Trip, whose `{ updated_at }` would otherwise be what
 * every assertion here reads.
 */
function firstPatched(): Record<string, unknown> {
  return fake.writes.find((x) => x.op === 'update' && x.table === 'trip_stops')!.values as Record<string, unknown>;
}

function seedStops(...stops: Array<{ stopId: string; position: number }>) {
  fake.seed('trip_stops', stops.map((s) => ({ trip_id: TRIP, id: s.stopId, position: s.position })));
}

beforeEach(() => {
  fake.reset();
  fake.seed('trips', [{ id: TRIP, profile_id: UID }]);
});

describe('creating a Trip', () => {
  it('writes a manual origin by default and no sourceMessageId at all', async () => {
    await repo.createTrip(UID, { name: '  Costa  ', startDate: '2026-10-10' });
    const written = lastWritten();
    expect(written.origin).toBe('manual');
    // Absent, not empty: an empty string would make FR-041's "already kept?"
    // lookup match every hand-made Trip at once.
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
    seedStops({ stopId: 'a', position: 0 }, { stopId: 'b', position: 5 });
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
    // exactly what keying does to favorites. The DATABASE generates the id now:
    // the insert carries none, and what comes back is not the catalog id.
    const id = await repo.addStop(UID, TRIP, { catalogId: 'el-tunco', kind: 'place' });
    const insert = fake.writes.filter((x) => x.table === 'trip_stops' && x.op === 'insert').at(-1)!;
    expect('id' in (insert.values as object)).toBe(false);
    expect(id).not.toBe('el-tunco');
    expect(id).toMatch(/^gen-/);
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
  it('is ONE delete of the Trip — its stops go with it by cascade, never left behind', async () => {
    // On Firestore a subcollection did not go with its parent, so this test counted a stop delete per
    // stop plus the Trip. Now the stops cascade from the Trip in the schema; what this pins is that
    // the repo does not delete stops one by one (wasted writes) and does delete the Trip itself.
    seedStops({ stopId: 'a', position: 0 }, { stopId: 'b', position: 1 });
    await repo.deleteTrip(UID, TRIP);
    const deletes = fake.writes.filter((x) => x.op === 'delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toMatchObject({ table: 'trips', filters: [['id', TRIP]] });
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
    expect(fake.writes.filter((x) => x.op === 'update')).toHaveLength(2); // the stop, then the Trip touch
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

/** The value written for `field` by the first update to a stop. */
function lastUpdateOf(field: string): unknown {
  for (const w of fake.writes) {
    if (w.op !== 'update' || w.table !== 'trip_stops') continue;
    const patch = w.values as Record<string, unknown>;
    if (field in patch) return patch[field];
  }
  return undefined;
}

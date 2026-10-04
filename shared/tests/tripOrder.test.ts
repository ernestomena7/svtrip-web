// T013 (feature 016): the ten rows of contracts/trip-ordering.md.
//
// A sorting function is the kind of code that looks obviously correct and is
// wrong in one case. Rows 3 and 10 are that case, and the rest exist so that a
// sabotage of one rule cannot hide behind another still passing.
//
// Cheap on purpose: `tripOrder` is pure, so none of this needs a browser, a
// clock or a database.
import { describe, it, expect } from 'vitest';
import { tripOrder } from '../src/tripOrder.js';
import type { TripStop } from '../src/types.js';

/** A stop with only what the ordering reads. `addedAt` defaults apart so ties are deliberate. */
function stop(partial: Partial<TripStop> & { stopId: string }): TripStop {
  return {
    catalogId: 'el-tunco',
    kind: 'place',
    position: 0,
    addedAt: 1_000,
    ...partial,
  };
}

const ids = (stops: TripStop[]) => stops.map((s) => s.stopId);

describe('scheduled before unscheduled (row 1, FR-025, SC-003)', () => {
  it('puts all four scheduled stops ahead of all four unscheduled ones', () => {
    const list = [
      stop({ stopId: 'u1', position: 0, addedAt: 1 }),
      stop({ stopId: 's1', date: '2026-10-11', addedAt: 2 }),
      stop({ stopId: 'u2', position: 1, addedAt: 3 }),
      stop({ stopId: 's2', date: '2026-10-12', addedAt: 4 }),
      stop({ stopId: 'u3', position: 2, addedAt: 5 }),
      stop({ stopId: 's3', date: '2026-10-13', addedAt: 6 }),
      stop({ stopId: 'u4', position: 3, addedAt: 7 }),
      stop({ stopId: 's4', date: '2026-10-14', addedAt: 8 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['s1', 's2', 's3', 's4', 'u1', 'u2', 'u3', 'u4']);
  });
});

describe('scheduled stops among themselves (FR-026)', () => {
  it('orders three stops on the same day by time (row 2)', () => {
    const list = [
      stop({ stopId: 'tarde', date: '2026-10-11', time: '18:00', addedAt: 1 }),
      stop({ stopId: 'manana', date: '2026-10-11', time: '09:00', addedAt: 2 }),
      stop({ stopId: 'medio', date: '2026-10-11', time: '13:00', addedAt: 3 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['manana', 'medio', 'tarde']);
  });

  // ROW 3 — the reason this contract exists.
  it('keeps a dated stop with NO time inside its own day (row 3, FR-027)', () => {
    const list = [
      stop({ stopId: 'el-13', date: '2026-10-13', time: '10:00', addedAt: 1 }),
      stop({ stopId: 'el-12-sin-hora', date: '2026-10-12', addedAt: 2 }),
      stop({ stopId: 'el-11', date: '2026-10-11', time: '20:00', addedAt: 3 }),
    ];
    // Not first, not last: on the 12th, between the 11th and the 13th. A
    // combined date+time key with a missing time sorts it out of its own date.
    expect(ids(tripOrder(list))).toEqual(['el-11', 'el-12-sin-hora', 'el-13']);
  });

  it('breaks an exact date-and-time tie by when the stop was added (row 4)', () => {
    const list = [
      stop({ stopId: 'segundo', date: '2026-10-11', time: '09:00', addedAt: 200 }),
      stop({ stopId: 'primero', date: '2026-10-11', time: '09:00', addedAt: 100 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['primero', 'segundo']);
  });

  it('handles a Trip where every stop is scheduled (row 8)', () => {
    const list = [
      stop({ stopId: 'c', date: '2026-10-13', addedAt: 1 }),
      stop({ stopId: 'a', date: '2026-10-11', addedAt: 2 }),
      stop({ stopId: 'b', date: '2026-10-12', addedAt: 3 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['a', 'b', 'c']);
  });
});

describe('unscheduled stops among themselves (FR-028)', () => {
  it('orders by position (row 5)', () => {
    const list = [
      stop({ stopId: 'tercero', position: 3, addedAt: 1 }),
      stop({ stopId: 'primero', position: 1, addedAt: 2 }),
      stop({ stopId: 'segundo', position: 2, addedAt: 3 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['primero', 'segundo', 'tercero']);
  });

  it('breaks an equal position by when the stop was added (row 6)', () => {
    const list = [
      stop({ stopId: 'despues', position: 1, addedAt: 200 }),
      stop({ stopId: 'antes', position: 1, addedAt: 100 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['antes', 'despues']);
  });

  it('leaves an all-unscheduled Trip in its arranged order (row 7)', () => {
    const list = [
      stop({ stopId: 'a', position: 0, addedAt: 1 }),
      stop({ stopId: 'b', position: 1, addedAt: 2 }),
      stop({ stopId: 'c', position: 2, addedAt: 3 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['a', 'b', 'c']);
  });
});

describe('the edges', () => {
  it('returns an empty list for an empty list, and does not throw (row 9)', () => {
    expect(tripOrder([])).toEqual([]);
  });

  it('sorts a stop dated before the Trip start by its own date (row 10, FR-034)', () => {
    // The Trip starts on the 10th. This stop says the 8th, which is reachable
    // by moving the start date later. FR-034 says MARK it, and marking is the
    // surface's job — the order does not flinch.
    const list = [
      stop({ stopId: 'normal', date: '2026-10-11', addedAt: 1 }),
      stop({ stopId: 'en-conflicto', date: '2026-10-08', addedAt: 2 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['en-conflicto', 'normal']);
  });

  it('never mutates the list it was given', () => {
    // These lists come from a live subscription. Sorting one in place changes a
    // component's props under it without a re-render.
    const list = [
      stop({ stopId: 'b', date: '2026-10-12', addedAt: 1 }),
      stop({ stopId: 'a', date: '2026-10-11', addedAt: 2 }),
    ];
    const before = ids(list);
    tripOrder(list);
    expect(ids(list)).toEqual(before);
  });

  it('treats a date cleared to an empty string as unscheduled', () => {
    // `<input type="date">` clears to '', not to undefined. A half-cleared stop
    // must not sort as though scheduled for the year zero.
    const list = [
      stop({ stopId: 'vaciado', date: '', position: 0, addedAt: 1 }),
      stop({ stopId: 'con-fecha', date: '2026-10-11', addedAt: 2 }),
    ];
    expect(ids(tripOrder(list))).toEqual(['con-fecha', 'vaciado']);
  });
});

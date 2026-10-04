// The category benchmark (feature 018, FR-040/FR-041).
//
// WHAT THIS COMPARES AGAINST, and why it is not a geographic zone.
//
// The source document says "comparativo con la zona". `zone` exists nowhere in
// this repository — feature 015 recorded exactly that, and used it to explain
// why the guide's itinerary mode stays shut. Both candidate peer groups were
// measured against the real catalog (`baseline-live.txt`) and they TIE on
// coverage while differing completely on cost:
//
//   businessType      attraction 10, outdoor-activity 10, restaurant-cafe 8,
//                     lodging 3, bar-brewery 2       -> 28 of 33 have 5+ peers
//   radius 30 km      median 10 neighbours           -> 28 of 33
//   radius 5 km       10 entries with NO neighbour   ->  1 of 33
//
// So the category wins on everything else: it is actionable (a restaurant
// against restaurants, not against a hotel and a public beach 12 km away) and
// it costs NO new field, because `businessType` is already set on 33 of 33 and
// is already an admin-managed vocabulary from feature 010.
//
// The numbers above are why the refusal cases here are not defensive branches
// for a hypothetical future: `lodging` and `bar-brewery` are refused TODAY.
import { describe, it, expect } from 'vitest';
import { MIN_PEERS, benchmarkFor, peersOf, type BenchmarkEntry } from '../src/benchmark.js';

/** The live distribution, so these cases describe the real catalog. */
const CATALOG: BenchmarkEntry[] = [
  ...Array.from({ length: 10 }, (_, i) => entry(`attraction-${i}`, 'attraction', 100 + i)),
  ...Array.from({ length: 10 }, (_, i) => entry(`outdoor-${i}`, 'outdoor-activity', 50 + i)),
  ...Array.from({ length: 8 }, (_, i) => entry(`resto-${i}`, 'restaurant-cafe', 200 + i)),
  ...Array.from({ length: 3 }, (_, i) => entry(`lodging-${i}`, 'lodging', 10 + i)),
  ...Array.from({ length: 2 }, (_, i) => entry(`bar-${i}`, 'bar-brewery', 5 + i)),
];

function entry(id: string, businessType: string | undefined, value: number): BenchmarkEntry {
  return { id, businessType, value };
}

describe('peers are others of the same category, never the business itself', () => {
  it('excludes the business from its own peer group', () => {
    const peers = peersOf('resto-0', CATALOG);
    expect(peers).toHaveLength(7);
    expect(peers.map((p) => p.id)).not.toContain('resto-0');
  });

  it('includes nothing from another category', () => {
    const peers = peersOf('resto-0', CATALOG);
    expect(peers.every((p) => p.businessType === 'restaurant-cafe')).toBe(true);
  });

  it('returns nothing for an entry that is not in the catalog', () => {
    expect(peersOf('nobody', CATALOG)).toEqual([]);
  });
});

describe('a comparison states WHAT it compared against and HOW MANY', () => {
  // FR-041. A number with no stated basis reads as insight and carries none.
  it('names the category and the peer count', () => {
    const r = benchmarkFor('attraction-0', CATALOG);
    expect(r.comparable).toBe(true);
    if (!r.comparable) return;
    expect(r.category).toBe('attraction');
    expect(r.peerCount).toBe(9);
  });

  it('averages the peers and NOT the business itself', () => {
    // attraction values are 100..109. Excluding `attraction-0` (100), the nine
    // peers average 105 — including it would give 104.5, so this pins the
    // exclusion rather than trusting it.
    const r = benchmarkFor('attraction-0', CATALOG);
    if (!r.comparable) throw new Error('expected comparable');
    expect(r.peerAverage).toBe(105);
  });

  it('reports how far above or below the peer average this business is', () => {
    // 100 against a peer average of 105 is 4.76% below.
    const r = benchmarkFor('attraction-0', CATALOG);
    if (!r.comparable) throw new Error('expected comparable');
    expect(r.value).toBe(100);
    expect(r.deltaPercent).toBeCloseTo(-4.76, 1);
  });

  it('reports 0% when a business sits exactly on its peer average', () => {
    const flat: BenchmarkEntry[] = Array.from({ length: 6 }, (_, i) =>
      entry(`same-${i}`, 'attraction', 42),
    );
    const r = benchmarkFor('same-0', flat);
    if (!r.comparable) throw new Error('expected comparable');
    expect(r.deltaPercent).toBe(0);
  });
});

describe('it REFUSES rather than showing a number that means nothing', () => {
  // These two fire against the real catalog TODAY, which is what makes the
  // refusal a product state and not a defensive branch.
  it('refuses lodging — 3 entries, so 2 peers', () => {
    const r = benchmarkFor('lodging-0', CATALOG);
    expect(r.comparable).toBe(false);
    if (r.comparable) return;
    expect(r.reason).toBe('too_few_peers');
    // The count is part of the refusal: "compared against 2" is what lets the
    // screen explain itself instead of showing a dash.
    expect(r.peerCount).toBe(2);
    expect(r.category).toBe('lodging');
  });

  it('refuses bar-brewery — 2 entries, so 1 peer', () => {
    const r = benchmarkFor('bar-0', CATALOG);
    expect(r.comparable).toBe(false);
    if (r.comparable) return;
    expect(r.peerCount).toBe(1);
  });

  it('refuses an entry with no category at all', () => {
    const catalog = [...CATALOG, entry('untyped', undefined, 1)];
    const r = benchmarkFor('untyped', catalog);
    expect(r.comparable).toBe(false);
    if (r.comparable) return;
    expect(r.reason).toBe('no_category');
  });

  it('refuses an entry that is not in the catalog', () => {
    const r = benchmarkFor('nobody', CATALOG);
    expect(r.comparable).toBe(false);
  });

  it('comparing needs MIN_PEERS peers, and the boundary is pinned on both sides', () => {
    const exactly = Array.from({ length: MIN_PEERS + 1 }, (_, i) =>
      entry(`e-${i}`, 'attraction', 10),
    );
    expect(benchmarkFor('e-0', exactly).comparable).toBe(true);

    const oneShort = exactly.slice(0, MIN_PEERS);
    expect(benchmarkFor('e-0', oneShort).comparable).toBe(false);
  });
});

describe('the measured catalog: 28 of 33 are comparable', () => {
  // The claim `baseline-live.txt` makes, asserted rather than quoted. If the
  // threshold or the exclusion rule changes, this is what says the recorded
  // number stopped being true.
  it('matches the audit script', () => {
    const comparable = CATALOG.filter((e) => benchmarkFor(e.id, CATALOG).comparable);
    expect(CATALOG).toHaveLength(33);
    expect(comparable).toHaveLength(28);
  });
});

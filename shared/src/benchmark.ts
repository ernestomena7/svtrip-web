// Comparing a business against its peers (feature 018, FR-040/FR-041).
//
// THE PEER GROUP IS THE CATEGORY, NOT A GEOGRAPHIC ZONE, and that deviates
// from the source document's wording ("comparativo con la zona") on measured
// grounds rather than preference.
//
// `zone` exists nowhere in this repository. Feature 015 recorded that and used
// it to explain why the guide's itinerary mode stays shut. Both candidates were
// measured against the real catalog and they TIE on coverage:
//
//   businessType   -> 28 of 33 entries have 5+ peers
//   radius 30 km   -> 28 of 33
//   radius 15 km   -> 24 of 33
//   radius  5 km   ->  1 of 33   (10 entries with no neighbour at all)
//
// The category wins on everything else. It is ACTIONABLE — "your 120 visits
// against the average restaurant" tells a restaurant something it can act on,
// where "against the average of what sits within 15 km" averages a hotel, a
// public beach and a craft shop. And it costs NOTHING NEW: `businessType` is
// already set on 33 of 33 entries and is already an admin-managed vocabulary
// from feature 010, administered on the very screen FR-036 adds plan
// management to. A zone would be a new field, a new derivation, and a new
// thing to keep correct on 33 real businesses.
//
// Pure, so the BFF runs it: `metricsService` groups engagement by category.
// No React, no DOM, no I/O.

/** What a comparison needs to know about one business. */
export interface BenchmarkEntry {
  id: string;
  /** The peer group. Absent means this entry cannot be compared at all. */
  businessType?: string;
  /** The metric being compared — visits, contacts, whatever the caller picked. */
  value: number;
}

/**
 * How many peers a comparison needs before it means anything.
 *
 * Five, and the number has a measured consequence rather than being round: at
 * five, 28 of the 33 live catalog entries can be compared and 5 cannot
 * (`lodging` has 3 entries, `bar-brewery` has 2). So the refusal below is a
 * state the product reaches TODAY, not a branch written against a hypothetical.
 */
export const MIN_PEERS = 5;

export type BenchmarkRefusal = 'too_few_peers' | 'no_category' | 'not_in_catalog';

export type BenchmarkResult =
  | {
      comparable: true;
      /** Stated, because FR-041 requires saying what the comparison is against. */
      category: string;
      peerCount: number;
      peerAverage: number;
      value: number;
      /** How far above (+) or below (−) the peer average, as a percentage. */
      deltaPercent: number;
    }
  | {
      comparable: false;
      reason: BenchmarkRefusal;
      /** Present when the entry HAS a category — the screen says which. */
      category?: string;
      peerCount: number;
    };

/**
 * Everyone else of the same category.
 *
 * Excludes the business itself, which is not a detail: including it drags the
 * average toward the value being compared, and the more extreme that value the
 * more it flatters itself.
 */
export function peersOf(id: string, catalog: readonly BenchmarkEntry[]): BenchmarkEntry[] {
  const self = catalog.find((e) => e.id === id);
  if (!self || self.businessType === undefined) return [];
  return catalog.filter((e) => e.id !== id && e.businessType === self.businessType);
}

/**
 * The comparison, or a refusal that says why.
 *
 * Never returns a number it cannot stand behind. A business compared against
 * one peer is a number that reads as insight and carries none, which is the
 * whole of FR-041 — and the reason the refusal carries `peerCount` is so the
 * screen can explain itself ("compared against 2") instead of showing a dash.
 */
export function benchmarkFor(id: string, catalog: readonly BenchmarkEntry[]): BenchmarkResult {
  const self = catalog.find((e) => e.id === id);
  if (!self) return { comparable: false, reason: 'not_in_catalog', peerCount: 0 };

  if (self.businessType === undefined) {
    return { comparable: false, reason: 'no_category', peerCount: 0 };
  }

  const peers = peersOf(id, catalog);
  if (peers.length < MIN_PEERS) {
    return {
      comparable: false,
      reason: 'too_few_peers',
      category: self.businessType,
      peerCount: peers.length,
    };
  }

  const peerAverage = peers.reduce((sum, p) => sum + p.value, 0) / peers.length;
  // Guarded, because a peer group that averages zero is a real case — a
  // category where nobody has had a visit yet — and dividing by it would hand
  // the screen `Infinity` to render.
  const deltaPercent =
    peerAverage === 0 ? 0 : ((self.value - peerAverage) / peerAverage) * 100;

  return {
    comparable: true,
    category: self.businessType,
    peerCount: peers.length,
    peerAverage,
    value: self.value,
    deltaPercent,
  };
}

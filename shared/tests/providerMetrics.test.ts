// The expanded metrics' aggregation (feature 018, FR-013/FR-039).
//
// Pure functions over daily documents — no Firestore, no React, no mocks.
//
// They started in `core/src/repos/metricsRepo.ts` and this test could not run:
// that file imports `core/firebase`, which initialises a real app at import
// time, so the suite died with `auth/invalid-api-key` before any assertion.
// Moving them is feature 017's lesson applied rather than re-learned.
//
// The case that matters most here is NOT ATTRIBUTABLE. Every day recorded
// before this feature has no `byOrigin` and no `byDeal`, and reporting that as
// a row of zeros would tell a merchant nobody came from any surface and nobody
// looked at any promotion. The data does not say that; it says nothing. Feature
// 006 drew this exact distinction for `byListing` and this follows it.
import { describe, it, expect } from 'vitest';
import {
  dealBreakdown,
  originBreakdown,
  type DailyMetricInput,
  type ProviderMetricsInput,
} from '../src/providerMetrics.js';

function day(over: Partial<DailyMetricInput> = {}): DailyMetricInput {
  return {
    date: '20261002',
    profileViews: 0,
    favoriteClicks: 0,
    directionsClicks: 0,
    ...over,
  };
}

function metrics(daily: DailyMetricInput[]): ProviderMetricsInput {
  return daily.reduce<ProviderMetricsInput>(
    (acc, d) => {
      acc.profileViews += d.profileViews;
      acc.favoriteClicks += d.favoriteClicks;
      acc.directionsClicks += d.directionsClicks;
      return acc;
    },
    { profileViews: 0, favoriteClicks: 0, directionsClicks: 0, daily },
  );
}

describe('originBreakdown: history written before this feature is NOT zero', () => {
  it('reports not-attributable when no day carries an origin breakdown', () => {
    const m = metrics([day({ profileViews: 40 }), day({ date: '20261001', profileViews: 12 })]);
    const r = originBreakdown(m);
    expect(r.attributable).toBe(false);
    expect(r.rows).toEqual([]);
    // All 52 views exist and none can be placed. Saying "0 from Discover"
    // would be a claim; saying "52 unattributed" is the data.
    expect(r.unattributed).toBe(52);
  });

  it('reports attributable once any day carries one', () => {
    const m = metrics([
      day({ profileViews: 10, byOrigin: { discover: { profileViews: 10 } } }),
      day({ date: '20261001', profileViews: 5 }),
    ]);
    const r = originBreakdown(m);
    expect(r.attributable).toBe(true);
    // The older day's 5 stay unattributed rather than being folded into
    // Discover, which is the whole point of the distinction.
    expect(r.unattributed).toBe(5);
  });
});

describe('originBreakdown: the surfaces', () => {
  it('sums one surface across days and orders by volume', () => {
    const m = metrics([
      day({
        profileViews: 12,
        byOrigin: { discover: { profileViews: 7 }, guide: { profileViews: 5 } },
      }),
      day({
        date: '20261001',
        profileViews: 9,
        byOrigin: { guide: { profileViews: 6 }, deals: { profileViews: 3 } },
      }),
    ]);
    const r = originBreakdown(m);
    expect(r.rows).toEqual([
      { origin: 'guide', profileViews: 11 },
      { origin: 'discover', profileViews: 7 },
      { origin: 'deals', profileViews: 3 },
    ]);
    expect(r.unattributed).toBe(0);
  });

  it('never reports a negative unattributed count', () => {
    // A day whose breakdown exceeds its total should not put a negative number
    // on a merchant's screen. Understating is survivable; a negative is not.
    const m = metrics([day({ profileViews: 2, byOrigin: { discover: { profileViews: 9 } } })]);
    expect(originBreakdown(m).unattributed).toBe(0);
  });

  it('has no bucket for Trips or favorites, deliberately', () => {
    // Feature 016's FR-017 forbids a business learning it appears in someone's
    // Trip, and an aggregate "12 visits came from Trips" tells them exactly
    // that. Those arrivals are not instrumented, so they land in
    // `unattributed` — imprecise on purpose, never false.
    const m = metrics([day({ profileViews: 10, byOrigin: { discover: { profileViews: 4 } } })]);
    const r = originBreakdown(m);
    expect(r.rows.map((x) => x.origin)).not.toContain('trips');
    expect(r.rows.map((x) => x.origin)).not.toContain('favorites');
    expect(r.unattributed).toBe(6);
  });
});

describe('dealBreakdown: the metric research R7 corrected', () => {
  // It was described during clarification as derivable from `byListing`. It is
  // not: `byListing` attributes to a BUSINESS, not to a promotion, and `dealId`
  // was recorded nowhere in the engagement path.
  it('reports not-attributable with no deal breakdown anywhere', () => {
    const r = dealBreakdown(metrics([day({ profileViews: 5 })]));
    expect(r.attributable).toBe(false);
    expect(r.rows).toEqual([]);
  });

  it('sums views and clicks per promotion across days', () => {
    const m = metrics([
      day({ byDeal: { 'deal-a': { promotionViews: 10, promotionClicks: 2 } } }),
      day({
        date: '20261001',
        byDeal: {
          'deal-a': { promotionViews: 5, promotionClicks: 1 },
          'deal-b': { promotionViews: 20, promotionClicks: 0 },
        },
      }),
    ]);
    const r = dealBreakdown(m);
    expect(r.attributable).toBe(true);
    expect(r.rows[0]).toEqual({ dealId: 'deal-b', views: 20, clicks: 0, clickRate: 0 });
    expect(r.rows[1]).toEqual({ dealId: 'deal-a', views: 15, clicks: 3, clickRate: 0.2 });
  });

  it('gives a promotion nobody saw a NULL click rate, not 0%', () => {
    // 0% reads as "everybody ignored it". A promotion with no views has no
    // click rate at all, and the screen has to be able to tell those apart.
    const m = metrics([day({ byDeal: { 'deal-x': { promotionViews: 0, promotionClicks: 0 } } })]);
    expect(dealBreakdown(m).rows[0].clickRate).toBeNull();
  });
});

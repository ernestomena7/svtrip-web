// Aggregating a provider's daily metrics (feature 018, FR-013/FR-039).
//
// WHY THESE LIVE IN `shared/` AND NOT BESIDE THE REPO THAT READS THEM.
//
// They were written in `core/src/repos/metricsRepo.ts` first, and their test
// could not run: that file imports `db` from `../firebase`, which initialises a
// real Firebase app AT IMPORT TIME, so the suite died with
// `auth/invalid-api-key` before reaching an assertion.
//
// Feature 017 hit this exactly and wrote the lesson down: `MoodTileGrid`
// imported the taxonomy hook, which imported `core/firebase`, so `visibleMoods`
// moved into its own module "with nothing else in its graph — eleven cases, no
// mocks". This is that, for the third time in this feature.
//
// `shared/` specifically, by feature 016's reading of the workspace rule: not
// "does the Node server run it?" — nothing server-side calls these — but
// because BOTH CLIENT SURFACES must agree. Two dashboards computing "where did
// my visits come from" two ways would drift the moment one of them rounded
// differently.
//
// Pure: no React, no DOM, no I/O, no clock.

/** The shape these read, declared here so nothing is imported to get it. */
export interface DailyMetricInput {
  date: string;
  profileViews: number;
  favoriteClicks: number;
  directionsClicks: number;
  /** Per-business; absent before feature 006. */
  byListing?: Record<string, Record<string, number>>;
  /** Per-SURFACE; absent before feature 018. */
  byOrigin?: Record<string, Record<string, number>>;
  /** Per-promotion; absent before feature 018. */
  byDeal?: Record<string, Record<string, number>>;
}

export interface ProviderMetricsInput {
  profileViews: number;
  daily: readonly DailyMetricInput[];
}

// ---------------------------------------------------------------------------
// Where visits came from
// ---------------------------------------------------------------------------

export interface OriginRow {
  origin: string;
  profileViews: number;
}

export interface OriginBreakdown {
  rows: OriginRow[];
  /**
   * False when NO day carries an origin breakdown — everything recorded
   * predates feature 018.
   *
   * Reporting that as zeros would tell a merchant nobody came from any surface.
   * The data does not say that; it says nothing. Feature 006 drew the same
   * distinction for `byListing` and the dashboard says it out loud.
   */
  attributable: boolean;
  /** Views the product cannot place. A real bucket, not a rounding error. */
  unattributed: number;
}

/**
 * Where visits came from.
 *
 * `unattributed` carries weight beyond refreshes and pasted links: arrivals
 * from a traveler's Trip or favorites are **deliberately not instrumented**.
 * Feature 016's FR-017 forbids a business learning it appears in someone's
 * Trip, and an aggregate "12 visits came from Trips" tells them exactly that.
 * Those land here — imprecise on purpose, never false.
 */
export function originBreakdown(metrics: ProviderMetricsInput): OriginBreakdown {
  const totals = new Map<string, number>();
  let attributable = false;
  let attributed = 0;

  for (const day of metrics.daily) {
    const by = day.byOrigin;
    if (by && Object.keys(by).length > 0) attributable = true;
    for (const [origin, counters] of Object.entries(by ?? {})) {
      const views = Number(counters.profileViews ?? 0);
      totals.set(origin, (totals.get(origin) ?? 0) + views);
      attributed += views;
    }
  }

  const rows = [...totals]
    .map(([origin, profileViews]) => ({ origin, profileViews }))
    .sort((a, b) => b.profileViews - a.profileViews || a.origin.localeCompare(b.origin));

  return {
    rows,
    attributable,
    // Clamped at zero: a negative "unattributed" on a merchant's screen is
    // worse than an understated one.
    unattributed: Math.max(0, metrics.profileViews - attributed),
  };
}

// ---------------------------------------------------------------------------
// How each promotion performed
// ---------------------------------------------------------------------------

export interface DealRow {
  dealId: string;
  views: number;
  clicks: number;
  /** Clicks over views, or `null` when nothing was viewed. */
  clickRate: number | null;
}

export interface DealBreakdown {
  rows: DealRow[];
  attributable: boolean;
}

/**
 * Per-promotion performance.
 *
 * This is the metric research R7 corrected. It was described during
 * clarification as derivable from `byListing`, and it was not: `byListing`
 * attributes a count to a BUSINESS, not to a promotion, and `dealId` was
 * recorded nowhere in the engagement path. It needed an event of its own.
 */
export function dealBreakdown(metrics: ProviderMetricsInput): DealBreakdown {
  const views = new Map<string, number>();
  const clicks = new Map<string, number>();
  let attributable = false;

  for (const day of metrics.daily) {
    const by = day.byDeal;
    if (by && Object.keys(by).length > 0) attributable = true;
    for (const [dealId, counters] of Object.entries(by ?? {})) {
      views.set(dealId, (views.get(dealId) ?? 0) + Number(counters.promotionViews ?? 0));
      clicks.set(dealId, (clicks.get(dealId) ?? 0) + Number(counters.promotionClicks ?? 0));
    }
  }

  const rows = [...new Set([...views.keys(), ...clicks.keys()])]
    .map((dealId) => {
      const v = views.get(dealId) ?? 0;
      const c = clicks.get(dealId) ?? 0;
      // `null`, not 0: a promotion nobody saw has no click rate, and 0% reads
      // as "everybody ignored it". The screen has to tell those apart.
      return { dealId, views: v, clicks: c, clickRate: v === 0 ? null : c / v };
    })
    .sort((a, b) => b.views - a.views || a.dealId.localeCompare(b.dealId));

  return { rows, attributable };
}

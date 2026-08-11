// Dashboard metrics (T087). The owner reads their own aggregated daily counters
// from providerProfiles/{uid}/metricsDaily (owner-read, Admin-write per rules).
// Totals are summed client-side across day docs so no composite index is needed;
// the per-day series powers the Ultra-only advanced analytics view (T093).
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface DailyMetric {
  date: string; // yyyymmdd
  profileViews: number;
  favoriteClicks: number;
  directionsClicks: number;
  /** Per-business breakdown; absent for days recorded before feature 006. */
  byListing?: Record<string, Record<string, number>>;
}

export interface ProviderMetrics {
  profileViews: number;
  favoriteClicks: number;
  directionsClicks: number;
  daily: DailyMetric[]; // ascending by date
}

const ZERO: ProviderMetrics = {
  profileViews: 0,
  favoriteClicks: 0,
  directionsClicks: 0,
  daily: [],
};

/** Live totals + per-day series across every daily metric doc for this provider. */
export function subscribeToMetrics(
  uid: string,
  cb: (m: ProviderMetrics) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(collection(db, 'providerProfiles', uid, 'metricsDaily'), (snap) => {
    const daily: DailyMetric[] = snap.docs
      .map((doc) => {
        const d = doc.data();
        const byListing = (d.byListing ?? {}) as Record<string, Record<string, number>>;
        return {
          date: String(d.date ?? doc.id),
          profileViews: Number(d.profileViews ?? 0),
          favoriteClicks: Number(d.favoriteClicks ?? 0),
          directionsClicks: Number(d.directionsClicks ?? 0),
          // Absent on documents written before feature 006. Their counts stay in
          // the totals above and are simply not attributable to a business — the
          // Dashboard says so rather than showing a per-business zero that looks
          // like nobody visited (FR-027).
          byListing,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const totals = daily.reduce<ProviderMetrics>(
      (acc, d) => {
        acc.profileViews += d.profileViews;
        acc.favoriteClicks += d.favoriteClicks;
        acc.directionsClicks += d.directionsClicks;
        return acc;
      },
      { profileViews: 0, favoriteClicks: 0, directionsClicks: 0, daily },
    );
    cb(totals);
  }, onError);
}

/**
 * The same totals, narrowed to one business (FR-027).
 *
 * `attributable` is false when no day carries a per-business breakdown at all —
 * i.e. everything recorded predates the breakdown. Reporting a bare zero there
 * would tell a manager nobody visited, which is not what the data says.
 */
export function metricsForListing(
  metrics: ProviderMetrics,
  listingId: string,
): ProviderMetrics & { attributable: boolean } {
  const daily = metrics.daily.map((d) => {
    const own = d.byListing?.[listingId] ?? {};
    return {
      date: d.date,
      profileViews: Number(own.profileViews ?? 0),
      favoriteClicks: Number(own.favoriteClicks ?? 0),
      directionsClicks: Number(own.directionsClicks ?? 0),
    };
  });
  const totals = daily.reduce(
    (acc, d) => ({
      profileViews: acc.profileViews + d.profileViews,
      favoriteClicks: acc.favoriteClicks + d.favoriteClicks,
      directionsClicks: acc.directionsClicks + d.directionsClicks,
    }),
    { profileViews: 0, favoriteClicks: 0, directionsClicks: 0 },
  );
  return {
    ...totals,
    daily,
    attributable: metrics.daily.some((d) => d.byListing && Object.keys(d.byListing).length > 0),
  };
}

export { ZERO as ZERO_METRICS };

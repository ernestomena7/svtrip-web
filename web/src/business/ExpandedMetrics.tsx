// The three expanded metrics, desktop (feature 018, FR-013). Premium only.
//
// Parity with `client/src/features/provider/ExpandedMetrics.tsx`. Per-surface
// rather than shared in `core/`, which is how this product already treats
// provider screens — and the AGGREGATION both call is in
// `@svtrip/shared/providerMetrics`, so the two cannot disagree about the
// numbers even though they lay them out differently.
//
// WHAT RESEARCH R7 CORRECTED, because it changes how this file reads: during
// clarification these were described as "two need new data and one is
// derivable". All three needed new data, and the one that looked like the
// blocker — the category benchmark — turned out to be the cheapest, because
// `businessType` was already set on 33 of 33 entries.
//
// Each block refuses rather than showing a number it cannot stand behind:
//
//  - Origin reports "not attributable yet" for history written before this
//    feature, instead of a row of zeros. A zero says "nobody came from there"
//    and the data says nothing at all. Feature 006 drew this distinction for
//    `byListing` first.
//  - The benchmark refuses below five peers AND SAYS WHY WITH THE COUNT
//    (FR-041). That minimum is a privacy boundary as much as a meaningfulness
//    one: with one peer, "the average restaurant gets 120 views" IS that
//    peer's number (research R13).
//  - A promotion nobody saw gets "no views yet", not "0% click rate", which
//    would read as everybody ignoring it.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  dealBreakdown,
  originBreakdown,
  type BenchmarkResult,
  type EngagementOrigin,
} from '@svtrip/shared';
import type { ProviderMetrics } from '@svtrip/core/repos/metricsRepo';
import { fetchBenchmark, type BenchmarkResponse } from '@svtrip/core/apiClient';
import { Card, Spinner } from '../components/ui';
import { Icon } from '@svtrip/core/Icon';

const ORIGIN_LABEL: Record<EngagementOrigin, string> = {
  discover: 'metrics.originDiscover',
  search: 'metrics.originSearch',
  guide: 'metrics.originGuide',
  deals: 'metrics.originDeals',
  landing: 'metrics.originLanding',
  direct: 'metrics.originDirect',
};

export function ExpandedMetrics({
  metrics,
  listingId,
}: {
  metrics: ProviderMetrics;
  /** When set, the benchmark shown is this one place's. */
  listingId?: string;
}) {
  const { t } = useTranslation();
  const origins = originBreakdown(metrics);
  const deals = dealBreakdown(metrics);
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [benchmarkFailed, setBenchmarkFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Server-side by necessity, not by preference: it compares against PEERS'
    // metrics, and `providerProfiles/{uid}/metricsDaily` is `isOwner(uid)`
    // (research R13).
    fetchBenchmark()
      .then((b) => alive && setBenchmark(b))
      .catch(() => alive && setBenchmarkFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const mine = listingId
    ? benchmark?.byListing.find((b) => b.listingId === listingId)
    : benchmark?.byListing[0];

  return (
    <div className="space-y-4">
      {/* --- 1. Where visits come from (FR-039) --- */}
      <Card className="p-5">
        <Header icon="navigation" title={t('metrics.originTitle')} hint={t('metrics.originHint')} />

        {!origins.attributable ? (
          <p className="mt-3 text-sm text-muted">{t('metrics.notAttributableYet')}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {origins.rows.map((row) => (
              <Bar
                key={row.origin}
                label={t(ORIGIN_LABEL[row.origin as EngagementOrigin] ?? row.origin)}
                value={row.profileViews}
                max={Math.max(1, origins.rows[0]?.profileViews ?? 1, origins.unattributed)}
              />
            ))}
            {origins.unattributed > 0 && (
              <Bar
                label={t('metrics.unattributed')}
                value={origins.unattributed}
                max={Math.max(1, origins.rows[0]?.profileViews ?? 1, origins.unattributed)}
                muted
              />
            )}
          </ul>
        )}

        {origins.unattributed > 0 && (
          // Named honestly. The bucket holds pasted links, reloads AND — on
          // purpose — arrivals from a traveler's Trips, which are not
          // instrumented because feature 016's FR-017 forbids a business
          // learning it appears in one. Calling it "direct" would be a claim.
          <p className="mt-3 text-xs text-muted">{t('metrics.unattributedHint')}</p>
        )}
      </Card>

      {/* --- 2. How you compare to your category (FR-040/FR-041) --- */}
      <Card className="p-5">
        <Header icon="sparkles" title={t('metrics.benchmarkTitle')} />
        {benchmarkFailed ? (
          <p className="mt-3 text-sm text-muted">{t('common.somethingWrong')}</p>
        ) : !benchmark ? (
          <div className="mt-4 flex justify-center">
            <Spinner />
          </div>
        ) : !mine ? (
          <p className="mt-3 text-sm text-muted">{t('metrics.benchmarkNoCategory')}</p>
        ) : (
          <BenchmarkBlock result={mine.result} />
        )}
      </Card>

      {/* --- 3. How each promotion performed (research R7) --- */}
      <Card className="p-5">
        <Header icon="ticket" title={t('metrics.dealsTitle')} />
        {!deals.attributable ? (
          <p className="mt-3 text-sm text-muted">{t('metrics.dealsNotAttributable')}</p>
        ) : deals.rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t('metrics.dealsNone')}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {deals.rows.map((row) => (
              <li key={row.dealId} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-text">
                  {row.dealId}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {row.views} {t('metrics.dealsViews')} · {row.clicks} {t('metrics.dealsClicks')} ·{' '}
                  {/* `null` and 0 are different answers: a promotion nobody saw
                      has no click rate, and "0%" would read as everybody
                      ignoring it. */}
                  {row.clickRate === null
                    ? t('metrics.dealsNoRate')
                    : t('metrics.dealsRate', { percent: Math.round(row.clickRate * 100) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function BenchmarkBlock({ result }: { result: BenchmarkResult }) {
  const { t } = useTranslation();

  if (!result.comparable) {
    if (result.reason === 'no_category') {
      return <p className="mt-3 text-sm text-muted">{t('metrics.benchmarkNoCategory')}</p>;
    }
    // FR-041: the refusal NAMES the count. A refusal without it is a dash with
    // better wording, and the number is what makes the reason credible.
    return (
      <p className="mt-3 text-sm text-muted">
        {t('metrics.benchmarkRefused', {
          count: result.peerCount,
          category: result.category ?? '',
        })}
      </p>
    );
  }

  const pct = Math.abs(Math.round(result.deltaPercent));
  const key =
    pct === 0
      ? 'metrics.benchmarkEven'
      : result.deltaPercent > 0
        ? 'metrics.benchmarkAbove'
        : 'metrics.benchmarkBelow';

  return (
    <>
      <p className="mt-3 text-sm font-bold text-text">
        {t(key, { percent: pct, category: result.category })}
      </p>
      {/* FR-041's other half: say what the comparison is against. */}
      <p className="mt-1 text-xs text-muted">
        {t('metrics.benchmarkBasis', { count: result.peerCount })}
      </p>
    </>
  );
}

function Header({ icon, title, hint }: { icon: 'navigation' | 'sparkles' | 'ticket'; title: string; hint?: string }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-accent">
          <Icon name={icon} size={18} />
        </span>
        <h2 className="font-display text-base font-extrabold text-text">{title}</h2>
      </div>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </>
  );
}

function Bar({
  label,
  value,
  max,
  muted = false,
}: {
  label: string;
  value: number;
  max: number;
  muted?: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-xs font-bold text-muted">{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span
          className={muted ? 'block h-full rounded-full bg-border' : 'block h-full rounded-full bg-sunset'}
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-sm font-extrabold tabular-nums text-text">
        {value}
      </span>
    </li>
  );
}

// Business dashboard (feature 007, T096 — FR-030).
//
// Reach metrics, and one honesty rule carried over from the mobile app: a zero
// is information, but only when it is TRUE. When a specific business is selected
// and nothing recorded carries a per-business breakdown, the honest answer is
// "we cannot attribute this history yet" — not "nobody visited you".
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Deal } from '@svtrip/shared';
import { resolveLocalized } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useUiStore } from '@svtrip/core/uiStore';
import {
  metricsForListing,
  subscribeToMetrics,
  ZERO_METRICS,
  type ProviderMetrics,
} from '@svtrip/core/repos/metricsRepo';
import { subscribeToMyDeals } from '@svtrip/core/repos/providerDealsRepo';
import { useManagedBusinesses } from '@svtrip/core/repos/useManagedBusinesses';
import { useEntitlements } from '@svtrip/core/repos/useEntitlements';
import { Icon, type IconName } from '@svtrip/core/Icon';
import { Button, Card, ErrorState, Spinner, cx } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';

export function DashboardScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const language = useUiStore((s) => s.language);
  const { entitlements } = useEntitlements();
  const { listings } = useManagedBusinesses();

  const [metrics, setMetrics] = useState<ProviderMetrics>(ZERO_METRICS);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selected, setSelected] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(false);
    const fail = () => {
      setError(true);
      setLoading(false);
    };
    const stopMetrics = subscribeToMetrics(
      user.uid,
      (m) => {
        setMetrics(m);
        setLoading(false);
      },
      fail,
    );
    const stopDeals = subscribeToMyDeals(user.uid, setDeals, fail);
    return () => {
      stopMetrics();
      stopDeals();
    };
  }, [user]);

  const activePromotions = useMemo(() => {
    const now = Date.now();
    const scoped = selected === 'all' ? deals : deals.filter((d) => d.listingId === selected);
    return scoped.filter((d) => d.activeFrom <= now && now <= d.activeTo).length;
  }, [deals, selected]);

  const scoped = selected === 'all' ? null : metricsForListing(metrics, selected);
  const shown = scoped ?? metrics;

  const tiles: Array<{ icon: IconName; label: string; value: number; tone: string }> = [
    { icon: 'user', label: t('dashboard.profileViews'), value: shown.profileViews, tone: 'text-navy' },
    { icon: 'heart', label: t('dashboard.favoriteClicks'), value: shown.favoriteClicks, tone: 'text-primary' },
    { icon: 'navigation', label: t('dashboard.directionsClicks'), value: shown.directionsClicks, tone: 'text-navy' },
    { icon: 'ticket', label: t('dashboard.activePromotions'), value: activePromotions, tone: 'text-accent' },
  ];
  const allZero = tiles.every((tile) => tile.value === 0);

  return (
    <DesktopLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
        {t('nav.dashboard')}
      </h1>

      {error && <ErrorState message={t('common.somethingWrong')} />}
      {!error && loading && <Spinner label={t('common.loading')} />}

      {!error && !loading && (
        <div className="mt-8 space-y-8">
          {/* Only when there is a choice to make — most providers manage one
              business and would just see a pointless control. */}
          {(listings?.length ?? 0) > 1 && (
            <div className="flex flex-wrap gap-2">
              {[{ id: 'all', label: t('dashboard.allBusinesses') }, ...(listings ?? []).map((l) => ({
                id: l.listingId,
                label: resolveLocalized(l.name, l.nameI18n, language),
              }))].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelected(opt.id)}
                  aria-pressed={selected === opt.id}
                  className={cx(
                    'rounded-pill px-3.5 py-2 text-sm font-bold transition',
                    selected === opt.id ? 'bg-sunset text-white shadow-red' : 'bg-surface-2 text-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Card key={tile.label} className="flex flex-col gap-2 p-5">
                <span className={tile.tone}>
                  <Icon name={tile.icon} size={22} />
                </span>
                <span className="font-display text-3xl font-extrabold tabular-nums text-text">
                  {tile.value.toLocaleString()}
                </span>
                <span className="text-sm font-bold leading-tight text-muted">{tile.label}</span>
              </Card>
            ))}
          </div>

          {allZero && (
            <p className="text-sm text-muted">
              {scoped && !scoped.attributable
                ? t('dashboard.notAttributableYet')
                : t('dashboard.zeroHint')}
            </p>
          )}

          {entitlements.analyticsDepth !== 'advanced' && (
            <Card className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <span className="text-accent">
                  <Icon name="sparkles" size={22} />
                </span>
                <div>
                  <h2 className="font-display text-base font-extrabold text-text">
                    {t('dashboard.advancedTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{t('dashboard.advancedLockedHint')}</p>
                </div>
              </div>
              <Button variant="accent" iconLeft="sparkles" onClick={() => navigate('/subscription')}>
                {t('dashboard.upgrade')}
              </Button>
            </Card>
          )}
        </div>
      )}
    </DesktopLayout>
  );
}

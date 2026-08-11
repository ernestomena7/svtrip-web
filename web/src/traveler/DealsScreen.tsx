// Promotions (feature 007, T082 — FR-025).
//
// `fetchActiveDeals()` filters expired promotions out at the source, so an
// expired deal cannot reach this screen. That filtering stays in the repo rather
// than here on purpose: a promotion whose end date has passed must be invisible
// on every surface, and a per-screen filter is how one surface starts showing
// what another hides.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Deal, Place } from '@svtrip/shared';
import { resolveLocalized } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { fetchActiveDeals } from '@svtrip/core/repos/dealsRepo';
import { fetchPlaces } from '@svtrip/core/repos/discoverRepo';
import { Icon } from '@svtrip/core/Icon';
import { Button, Card, EmptyState, ErrorState, Spinner } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';

function money(amount: number, currency: string): string {
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

export function DealsScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const language = useUiStore((s) => s.language);
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchActiveDeals(), fetchPlaces()])
      .then(([d, p]) => {
        if (cancelled) return;
        setDeals(d);
        setPlaces(p);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const nameFor = useMemo(() => {
    const byId = new Map(places.map((p) => [p.placeId, p]));
    return (listingId: string) => {
      const place = byId.get(listingId);
      return place ? resolveLocalized(place.name, place.nameI18n, language) : undefined;
    };
  }, [places, language]);

  return (
    <DesktopLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
        {t('nav.deals')}
      </h1>

      <div className="mt-8">
        {error && (
          <ErrorState
            message={t('common.somethingWrong')}
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                {t('common.retry')}
              </Button>
            }
          />
        )}

        {!error && deals === null && <Spinner label={t('common.loading')} />}

        {!error && deals !== null && deals.length === 0 && (
          <EmptyState icon="ticket" title={t('deals.emptyTitle')} />
        )}

        {!error && deals && deals.length > 0 && (
          <div className="grid gap-[22px] md:grid-cols-2 xl:grid-cols-3">
            {deals.map((deal) => {
              const placeName = deal.listingId ? nameFor(deal.listingId) : undefined;
              const until = new Intl.DateTimeFormat(i18n.language, {
                day: 'numeric',
                month: 'short',
              }).format(new Date(deal.activeTo));

              return (
                <Card key={deal.dealId} className="overflow-hidden">
                  <div className="flex items-center gap-2 bg-sunset px-5 py-3 text-white">
                    <Icon name="ticket" size={18} filled />
                    <span className="text-sm font-extrabold">
                      {money(deal.cost.amount, deal.cost.currency)}
                    </span>
                    {deal.cost.original != null && (
                      <span className="text-sm font-bold text-white/70 line-through">
                        {money(deal.cost.original, deal.cost.currency)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 p-5">
                    <h2 className="font-display text-base font-extrabold text-text">
                      {resolveLocalized(deal.title, deal.titleI18n, language)}
                    </h2>
                    <p className="text-sm leading-relaxed text-muted">
                      {resolveLocalized(deal.description, deal.descriptionI18n, language)}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                      <Icon name="clock" size={13} />
                      {t('deals.validUntil', { date: until })}
                    </p>
                    {placeName && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => deal.listingId && navigate(`/place/${deal.listingId}`)}
                      >
                        {placeName}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}

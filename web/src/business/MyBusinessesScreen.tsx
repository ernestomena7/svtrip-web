// The businesses this account manages (feature 007, T097/T106 — FR-032, FR-035).
//
// List, edit, and run promotions. The form and the deal form open in place
// rather than as overlays: on a desktop there is room, and a full-page form is
// easier to fill than a modal that has to be scrolled inside another scroll.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Deal, Listing } from '@svtrip/shared';
import { resolveLocalized, publicVisibility } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useUiStore } from '@svtrip/core/uiStore';
import { subscribeToMyListings, deleteListing } from '@svtrip/core/repos/listingsRepo';
import { subscribeToMyDeals, deleteDeal } from '@svtrip/core/repos/providerDealsRepo';
import { coverImage } from '@svtrip/shared';
import { Icon } from '@svtrip/core/Icon';
import { Button, Card, EmptyState, ErrorState, Spinner, cx } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';
import { ListingForm } from './ListingForm';
import { DealForm } from './DealForm';

type Editor =
  | { kind: 'listing'; value: Listing | null }
  | { kind: 'deal'; listingId: string; value: Deal | null }
  | null;

export function MyBusinessesScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const language = useUiStore((s) => s.language);

  const [listings, setListings] = useState<Listing[] | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(true);
    const stopListings = subscribeToMyListings(user.uid, setListings, fail);
    const stopDeals = subscribeToMyDeals(user.uid, setDeals, fail);
    return () => {
      stopListings();
      stopDeals();
    };
  }, [user]);

  if (editor?.kind === 'listing') {
    return (
      <DesktopLayout>
        <ListingForm existing={editor.value} onClose={() => setEditor(null)} />
      </DesktopLayout>
    );
  }

  if (editor?.kind === 'deal') {
    return (
      <DesktopLayout>
        <DealForm
          listingId={editor.listingId}
          existing={editor.value}
          onClose={() => setEditor(null)}
        />
      </DesktopLayout>
    );
  }

  const fmt = (ms: number) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(ms));

  return (
    <DesktopLayout>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
          {t('nav.services')}
        </h1>
        <Button iconLeft="plus" onClick={() => setEditor({ kind: 'listing', value: null })}>
          {t('services.new')}
        </Button>
      </div>

      {error && <ErrorState message={t('common.somethingWrong')} />}
      {!error && listings === null && <Spinner label={t('common.loading')} />}

      {!error && listings?.length === 0 && (
        <EmptyState
          icon="map-pin"
          title={t('services.emptyTitle')}
          body={t('services.emptyBody')}
          action={
            <Button iconLeft="plus" onClick={() => setEditor({ kind: 'listing', value: null })}>
              {t('services.new')}
            </Button>
          }
        />
      )}

      {!error && listings && listings.length > 0 && (
        <div className="mt-8 space-y-5">
          {listings.map((listing) => {
            const live = publicVisibility(listing);
            const mine = deals.filter((d) => d.listingId === listing.listingId);
            const cover = coverImage(listing);
            return (
              <Card key={listing.listingId} className="overflow-hidden">
                <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
                  <div className="h-24 w-32 shrink-0 overflow-hidden rounded-md bg-sunset">
                    {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-extrabold text-text">
                        {resolveLocalized(listing.name, listing.nameI18n, language)}
                      </h2>
                      <span
                        className={cx(
                          'rounded-pill px-2.5 py-1 text-xs font-extrabold',
                          live ? 'bg-surface-2 text-primary' : 'bg-surface-2 text-muted',
                        )}
                      >
                        {live ? t('publication.live') : t('publication.notLive')}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        iconLeft="settings"
                        onClick={() => setEditor({ kind: 'listing', value: listing })}
                      >
                        {t('services.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        iconLeft="ticket"
                        onClick={() =>
                          setEditor({ kind: 'deal', listingId: listing.listingId, value: null })
                        }
                      >
                        {t('services.newDeal')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t('services.confirmDelete'))) {
                            void deleteListing(listing.listingId);
                          }
                        }}
                      >
                        {t('services.delete')}
                      </Button>
                    </div>
                  </div>
                </div>

                {mine.length > 0 && (
                  <ul className="divide-y divide-border border-t border-border">
                    {mine.map((deal) => (
                      <li
                        key={deal.dealId}
                        className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
                      >
                        <span className="text-accent">
                          <Icon name="ticket" size={16} />
                        </span>
                        <span className="font-bold text-text">
                          {resolveLocalized(deal.title, deal.titleI18n, language)}
                        </span>
                        <span className="text-muted">
                          {fmt(deal.activeFrom)} — {fmt(deal.activeTo)}
                        </span>
                        <span className="ml-auto flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditor({ kind: 'deal', listingId: listing.listingId, value: deal })
                            }
                          >
                            {t('services.edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteDeal(deal.dealId)}
                          >
                            {t('services.delete')}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </DesktopLayout>
  );
}

// A business profile, desktop edition (feature 007, T077/T078 — FR-023, FR-028).
//
// From `ui_kits/web/WebDetail.jsx`: full-bleed banner, then a two-column body —
// the story on the left, the practical facts (contact, hours, actions) parked in
// a sticky rail on the right where they stay reachable while the visitor reads.
// The mobile app stacks all of that; on a wide screen stacking wastes the half
// of the viewport the facts should be occupying.
//
// Reviews are read from Firestore and written through the BFF. There is no
// client write path, and there must not be: that is what makes it impossible for
// a business owner to delete a review about their own business (FR-028).
//
// The score is subscribed to, not read once: the server writes it after a review
// lands, so a screen that trusted its first read would show "I just reviewed
// this and nothing changed" (SC-009).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Deal, Place } from '@svtrip/shared';
import { DEFAULT_BUSINESS_TYPE, resolveLocalized, scoreSignalFor } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { useFavorites } from '@svtrip/core/repos/useFavorites';
import { recordEngagement } from '@svtrip/core/repos/engagementClient';
import {
  fetchProfileDeals,
  fetchProfileTarget,
  subscribeToTargetScore,
  type ProfileTargetKind,
} from '@svtrip/core/repos/placeProfileRepo';
import { Icon } from '@svtrip/core/Icon';
import { ScoreBadge } from '../components/ScoreBadge';
import { Button, Card, ErrorState, Spinner } from '../components/ui';
import { GalleryViewer } from './GalleryViewer';
import { ReviewsSection } from './ReviewsSection';
import { DesktopLayout } from '../shell/DesktopLayout';

export function PlaceProfileScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const language = useUiStore((s) => s.language);
  const { isFavorite, toggle } = useFavorites();

  const [place, setPlace] = useState<Place | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [kind, setKind] = useState<ProfileTargetKind | null>(null);
  const [unfinished, setUnfinished] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState('loading');
    fetchProfileTarget(id)
      .then((target) => {
        if (cancelled) return;
        if (!target) {
          // Reachable from a promotion or a saved plan after the business was
          // deactivated: say it is gone rather than render an empty frame.
          setState('missing');
          return;
        }
        setPlace(target.place);
        setKind(target.kind);
        setUnfinished(target.unfinished === true);
        setState('ready');
        if (target.kind === 'listing') recordEngagement(target.place.placeId, 'profile_view');
        return fetchProfileDeals(id).then((d) => !cancelled && setDeals(d));
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !kind) return;
    return subscribeToTargetScore(id, kind, (score) => {
      setPlace((prev) =>
        prev && prev.placeId === id
          ? { ...prev, ratingAvg: score.ratingAvg, ratingCount: score.ratingCount }
          : prev,
      );
    });
  }, [id, kind]);

  const gallery = useMemo(() => {
    if (!place) return [];
    const shots = place.gallery?.length ? place.gallery : (place.photos ?? []);
    return shots.filter((url) => url && url !== place.bannerURL);
  }, [place]);

  if (state === 'loading') {
    return (
      <DesktopLayout>
        <Spinner label={t('common.loading')} />
      </DesktopLayout>
    );
  }

  if (state !== 'ready' || !place) {
    return (
      <DesktopLayout>
        <ErrorState
          message={state === 'missing' ? t('profile.notFound') : t('common.somethingWrong')}
          action={
            <Button variant="secondary" onClick={() => navigate('/discover')}>
              {t('nav.discover')}
            </Button>
          }
        />
      </DesktopLayout>
    );
  }

  if (unfinished) {
    return (
      <DesktopLayout>
        <ErrorState message={t('publication.notPublicYet')} />
      </DesktopLayout>
    );
  }

  const score = scoreSignalFor(place);
  const name = resolveLocalized(place.name, place.nameI18n, language);
  const businessType = place.businessType ?? DEFAULT_BUSINESS_TYPE;
  const saved = isFavorite(place.placeId);

  function openDirections() {
    if (!place) return;
    if (place.source === 'listing') recordEngagement(place.placeId, 'directions_click');
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <DesktopLayout>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-text"
      >
        <Icon name="chevron-left" size={16} />
        {t('profile.back')}
      </button>

      <div className="overflow-hidden rounded-xl bg-sunset shadow-lg">
        <div className="relative h-56 w-full md:h-72">
          {place.bannerURL && (
            <img src={place.bannerURL} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <header className="space-y-3">
            <p className="eyebrow">{t(`businessTypes.${businessType}`)}</p>
            <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-text">
              {name}
            </h1>
            <ScoreBadge signal={score} className="text-base" />
            <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
              {resolveLocalized(place.description, place.descriptionI18n, language)}
            </p>
          </header>

          {gallery.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-extrabold text-text">
                {t('profile.gallery.title', 'Fotos')}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {gallery.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setViewerIndex(i)}
                    aria-label={t('profile.gallery.open', 'Ver foto')}
                    className="overflow-hidden rounded-md transition hover:opacity-90"
                  >
                    <img src={url} alt="" loading="lazy" className="h-40 w-full object-cover" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <ReviewsSection targetId={place.placeId} />

          {deals.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-extrabold text-text">{t('nav.deals')}</h2>
              <div className="mt-4 space-y-3">
                {deals.map((deal) => (
                  <Card key={deal.dealId} className="p-5">
                    <p className="font-display font-extrabold text-text">
                      {resolveLocalized(deal.title, deal.titleI18n, language)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {resolveLocalized(deal.description, deal.descriptionI18n, language)}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* The practical column. Sticky so it stays with the reader — on a tall
            desktop page the contact details would otherwise scroll away exactly
            when someone has decided to go. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4 p-6">
            <Button fullWidth iconLeft="navigation" onClick={openDirections}>
              {t('profile.directions', 'Cómo llegar')}
            </Button>
            <Button
              fullWidth
              variant="secondary"
              iconLeft="heart"
              onClick={() =>
                void toggle(place.placeId, place.source === 'listing' ? 'listing' : 'place')
              }
            >
              {saved ? t('discover.unsave') : t('discover.save')}
            </Button>

            {(place.phone || place.whatsapp) && (
              <div className="space-y-2 border-t border-border pt-4">
                {place.phone && (
                  <a
                    href={`tel:${place.phone}`}
                    className="flex items-center gap-2 text-sm font-bold text-text"
                  >
                    <Icon name="bell" size={16} />
                    {place.phone}
                  </a>
                )}
                {place.whatsapp && (
                  <a
                    href={`https://wa.me/${place.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-bold text-text"
                  >
                    <Icon name="send" size={16} />
                    WhatsApp
                  </a>
                )}
              </div>
            )}
          </Card>
        </aside>
      </div>

      <GalleryViewer
        images={gallery}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </DesktopLayout>
  );
}

// Feature 024 (T022, FR-009): a place's profile for a visitor with no session — where an AI
// assistant's link lands.
//
// A SEPARATE screen from the signed-in PlaceProfileScreen on purpose: that one is built from things
// only an account has (favorites, the live review form, Trips, the reservation dialog), and making it
// branch on "signed in?" at every one of them would leave a signed-out visitor one missed branch away
// from a broken control. This screen reads ONE thing — the BFF's public projection
// (`/api/public/places/:id`, field by field, no owner, no plan) — and reuses the same visual pieces:
// ScoreBadge, GalleryViewer, LocationPreviewMap, Card, the shared PublicHeader.
//
// Account actions are not disabled controls that explain nothing: they are ONE invitation, with the
// way back to this page (`next`). Nothing here records engagement — a public endpoint that writes
// metrics is an amplifier (contracts/public-place.md).
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { displayHours, resolveLocalized, DEFAULT_BUSINESS_TYPE, type OpeningHour, type LocalizedText, type ScoreSignal } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { Icon } from '@svtrip/core/Icon';
import { ScoreBadge } from '../components/ScoreBadge';
import { ButtonLink, Card, EmptyState, ErrorState, Spinner, Button } from '../components/ui';
import { API_BASE_URL } from '../config';
import { GalleryViewer } from '../traveler/GalleryViewer';
import { LocationPreviewMap } from '../traveler/LocationPreviewMap';
import { PublicHeader } from './PublicHeader';

export interface PublicPlace {
  id: string;
  name: string;
  nameI18n: LocalizedText | null;
  description: string;
  descriptionI18n: LocalizedText | null;
  businessType: string | null;
  bannerURL: string | null;
  gallery: string[];
  lat: number;
  lng: number;
  openingHours: OpeningHour[];
  phone: string | null;
  whatsapp: string | null;
  score: ScoreSignal;
  reservable: boolean;
}

interface PublicPayload {
  place: PublicPlace;
  promotions: { id: string; title: string; titleI18n?: LocalizedText; description: string; descriptionI18n?: LocalizedText }[];
  reviews: { id: string; authorName: string; rating: number; comment: string | null; reply: { text: string } | null }[];
}

export function PublicPlaceScreen() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const language = useUiStore((s) => s.language);
  const [data, setData] = useState<PublicPayload | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetch(`${API_BASE_URL}/public/places/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404 || res.status === 400) return setState('missing');
        if (!res.ok) return setState('error');
        setData((await res.json()) as PublicPayload);
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const here = `/place/${id}`;
  const hours = useMemo(() => displayHours(data?.place.openingHours), [data]);

  let body;
  if (state === 'loading') {
    body = <Spinner label={t('common.loading')} />;
  } else if (state === 'missing') {
    body = (
      <EmptyState
        icon="compass"
        title={t('place.public.notAvailableTitle')}
        body={t('place.public.notAvailableBody')}
        action={<ButtonLink href="/discover">{t('place.public.explore')}</ButtonLink>}
      />
    );
  } else if (state === 'error' || !data) {
    body = (
      <ErrorState
        message={t('common.somethingWrong')}
        action={
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t('common.retry', 'Reintentar')}
          </Button>
        }
      />
    );
  } else {
    const { place, promotions, reviews } = data;
    const name = resolveLocalized(place.name, place.nameI18n ?? undefined, language);
    body = (
      <>
        {place.bannerURL && (
          <div className="overflow-hidden rounded-xl bg-sunset shadow-lg">
            <img src={place.bannerURL} alt="" className="h-48 w-full object-cover md:h-72" />
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-8">
            <header className="space-y-3">
              <p className="eyebrow">{t(`businessTypes.${place.businessType ?? DEFAULT_BUSINESS_TYPE}`)}</p>
              <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-text">{name}</h1>
              <ScoreBadge signal={place.score} className="text-base" />
              <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
                {resolveLocalized(place.description, place.descriptionI18n ?? undefined, language)}
              </p>
            </header>

            {place.gallery.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-extrabold text-text">{t('profile.gallery.title', 'Fotos')}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {place.gallery.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setViewerIndex(i)}
                      aria-label={t('profile.gallery.open')}
                      className="overflow-hidden rounded-md transition hover:opacity-90"
                    >
                      <img src={url} alt="" loading="lazy" className="h-32 w-full object-cover md:h-40" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {hours.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-extrabold text-text">{t('services.openingHours')}</h2>
                <Card className="mt-4 space-y-1 p-5">
                  {hours.map((row) => (
                    <div
                      key={row.day}
                      className={row.isToday ? 'flex items-center justify-between text-sm font-bold text-text' : 'flex items-center justify-between text-sm text-muted'}
                    >
                      <span>{t(`days.${row.dayKey}`)}</span>
                      <span>{row.closed ? t('services.closed') : `${row.open} – ${row.close}`}</span>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            <section>
              <h2 className="font-display text-lg font-extrabold text-text">{t('reviews.title')}</h2>
              {reviews.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{t('profile.noReviewsYet')}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {reviews.map((r) => (
                    <Card key={r.id} className="space-y-2 p-5" data-testid="review">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-text">{r.authorName}</p>
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-text">
                          <Icon name="star" size={14} /> {r.rating}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-muted">{r.comment}</p>}
                      {r.reply && (
                        <p className="border-l-2 border-border pl-3 text-sm text-muted">
                          <span className="font-bold text-text">{t('reviews.ownerReplyLabel')}: </span>
                          {r.reply.text}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {promotions.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-extrabold text-text">{t('nav.deals')}</h2>
                <div className="mt-4 space-y-3">
                  {promotions.map((d) => (
                    <Card key={d.id} className="p-5">
                      <p className="font-display font-extrabold text-text">{resolveLocalized(d.title, d.titleI18n, language)}</p>
                      <p className="mt-1 text-sm text-muted">{resolveLocalized(d.description, d.descriptionI18n, language)}</p>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="space-y-4 p-6">
              <LocationPreviewMap lat={place.lat} lng={place.lng} />
              <ButtonLink
                fullWidth
                variant="secondary"
                iconLeft="navigation"
                href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('profile.directions')}
              </ButtonLink>

              {/* The account actions, as ONE invitation with the way back here (FR-009). */}
              <div className="space-y-3 border-t border-border pt-4" data-testid="public-sign-in">
                <p className="font-display font-extrabold text-text">
                  {t(place.reservable ? 'place.public.signInReserveTitle' : 'place.public.signInTitle')}
                </p>
                <ButtonLink fullWidth href={`/sign-in?next=${encodeURIComponent(here)}`}>
                  {t('web.preview.cta')}
                </ButtonLink>
              </div>

              {(place.phone || place.whatsapp) && (
                <div className="space-y-2 border-t border-border pt-4">
                  {place.phone && (
                    <a href={`tel:${place.phone}`} className="flex items-center gap-2 text-sm font-bold text-text">
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

        <GalleryViewer images={place.gallery} index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
      </>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <PublicHeader next={here} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-10 md:py-12">{body}</main>
    </div>
  );
}

// What a visitor with no session sees (feature 007, T068 — FR-018, FR-018b).
//
// The limited preview the product owner chose: a curated handful of places,
// then a clear invitation. It reads the SAME endpoint the landing page does, so
// the two can never disagree about what is featured.
//
// FR-018b is the part that matters most here. A visitor must never hit a wall
// with no explanation: the boundary between "what you can see" and "what needs
// an account" is stated, and the way in is right next to it. A blank screen or a
// silent redirect would technically satisfy "gated" and fail the requirement.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { resolveLocalized, type LocalizedText, type ScoreSignal } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { ActivityCard } from '../components/ActivityCard';
import { Button, ButtonLink, Card, ErrorState, Spinner } from '../components/ui';
import { API_BASE_URL } from '../config';

interface FeaturedPlace {
  placeId: string;
  name: string;
  nameI18n?: LocalizedText;
  description: string;
  coverImage?: string;
  moods: string[];
  score: ScoreSignal;
}

const WORDMARK = '/svtrip-wordmark.png';

export function PreviewScreen() {
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);
  const [places, setPlaces] = useState<FeaturedPlace[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/public/featured`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { places: FeaturedPlace[] }) => !cancelled && setPlaces(data.places ?? []))
      // Unlike the landing's showcase, this screen DOES report failure: the
      // preview is the entire content here, so its absence would leave a blank
      // page — which the constitution forbids outright.
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <header className="border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center px-5 md:px-10">
          <img src={WORDMARK} alt="SVTrip" className="h-9 w-auto" />
          <div className="ml-auto flex items-center gap-2">
            <Link to="/register">
              <Button variant="secondary">{t('web.preview.register')}</Button>
            </Link>
            <Link to="/sign-in">
              <Button>{t('web.preview.cta')}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 md:px-10 md:py-14">
        <p className="eyebrow">{t('web.preview.eyebrow')}</p>
        <h1 className="mt-2 max-w-2xl font-display text-3xl font-extrabold tracking-[-0.02em] text-text md:text-4xl">
          {t('web.preview.title')}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          {t('web.preview.body')}
        </p>

        {failed && (
          <ErrorState
            message={t('common.somethingWrong')}
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                {t('common.retry', 'Reintentar')}
              </Button>
            }
          />
        )}

        {!failed && !places && <Spinner label={t('common.loading')} />}

        {!failed && places && places.length > 0 && (
          <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-[22px]">
            {places.map((place) => (
              <ActivityCard
                key={place.placeId}
                image={place.coverImage}
                title={resolveLocalized(place.name, place.nameI18n, language)}
                score={place.score}
              />
            ))}
          </div>
        )}

        {/* The boundary, stated. FR-018b: a visitor must know what lies beyond
            the preview and how to reach it, never just run out of content. */}
        <Card className="mt-10 flex flex-col items-start gap-4 p-7 md:flex-row md:items-center md:justify-between md:p-9">
          <div>
            <h2 className="font-display text-xl font-extrabold text-text">
              {t('web.preview.moreTitle')}
            </h2>
            <p className="mt-1.5 max-w-xl text-[15px] text-muted">{t('web.preview.moreBody')}</p>
          </div>
          <ButtonLink href="/sign-in" size="lg" className="shrink-0">
            {t('web.preview.cta')}
          </ButtonLink>
        </Card>
      </main>
    </div>
  );
}

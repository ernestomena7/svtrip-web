// Saved places (feature 007, T081 — FR-024).
//
// FR-024 asks for two things: that a traveler can save a place, and that they
// can SEE what they saved. The card's heart does the first; without this screen
// the second has nowhere to happen.
//
// Reads through the same `useFavorites` hook the mobile app uses, so the two
// interfaces show one account's saved places rather than two lists (FR-014).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Place } from '@svtrip/shared';
import { coverImage, resolveLocalized, scoreSignalFor } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { useFavorites } from '@svtrip/core/repos/useFavorites';
import { fetchPlaces } from '@svtrip/core/repos/discoverRepo';
import { ActivityCard } from '../components/ActivityCard';
import { Button, EmptyState, ErrorState, Spinner } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';

export function FavoritesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useUiStore((s) => s.language);
  const { isFavorite, toggle } = useFavorites();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPlaces()
      .then((p) => !cancelled && setPlaces(p))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const saved = useMemo(
    () => (places ?? []).filter((p) => isFavorite(p.placeId)),
    [places, isFavorite],
  );

  return (
    <DesktopLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
        {t('web.saved.title')}
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

        {!error && places === null && <Spinner label={t('common.loading')} />}

        {!error && places !== null && saved.length === 0 && (
          <EmptyState
            icon="heart"
            title={t('web.saved.empty')}
            body={t('web.saved.emptyBody')}
            action={
              <Button variant="secondary" onClick={() => navigate('/discover')}>
                {t('nav.discover')}
              </Button>
            }
          />
        )}

        {!error && saved.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-[22px]">
            {saved.map((place) => (
              <ActivityCard
                key={place.placeId}
                image={coverImage(place)}
                title={resolveLocalized(place.name, place.nameI18n, language)}
                category={place.moods[0] ? t(`moods.${place.moods[0]}`) : undefined}
                score={scoreSignalFor(place)}
                saved
                onToggleSave={() =>
                  void toggle(place.placeId, place.source === 'listing' ? 'listing' : 'place')
                }
                onClick={() => navigate(`/place/${place.placeId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}

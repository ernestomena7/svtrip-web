// Discover, desktop edition (feature 007, T073–T076 — FR-011, FR-020, SC-004).
//
// The layout the whole feature exists for: a wide hero, a horizontal category
// rail and a card grid, from `ui_kits/web/WebHome.jsx` with its actual metrics —
// 280px minimum column, 22px gutter. Where the mobile app shows one card at a
// time, this shows six.
//
// Every card's image comes from `coverImage()` and every score from
// `scoreSignalFor()`, both in `@svtrip/shared` (FR-021, FR-022). This screen
// never computes either.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Mood, Place } from '@svtrip/shared';
import { MOODS, coverImage, resolveLocalized, scoreSignalFor } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useFavorites } from '@svtrip/core/repos/useFavorites';
import { fetchPlaces, forYou, byMood } from '@svtrip/core/repos/discoverRepo';
import { MOOD_ICON } from '@svtrip/core/moodIcons';
import { ActivityCard } from '../components/ActivityCard';
import { Chip, EmptyState, ErrorState, Button, Spinner } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';

export function DiscoverScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useUiStore((s) => s.language);
  const { profile } = useAuth();
  const { isFavorite, toggle } = useFavorites();

  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState(false);
  const [mood, setMood] = useState<Mood | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetchPlaces()
      .then((p) => !cancelled && setPlaces(p))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const vibes = profile?.preferences.vibes ?? [];

  const list = useMemo(() => {
    if (!places) return [];
    // Personalization first (FR-020): with no mood selected and no search, the
    // order follows the account's own vibes rather than catalog order.
    let result = mood ? byMood(places, mood) : forYou(places, vibes);
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((p) => {
        const name = resolveLocalized(p.name, p.nameI18n, language).toLowerCase();
        const description = resolveLocalized(p.description, p.descriptionI18n, language).toLowerCase();
        return (
          name.includes(query) ||
          description.includes(query) ||
          p.moods.some((m) => m.toLowerCase().includes(query))
        );
      });
    }
    return result;
  }, [places, mood, search, vibes, language]);

  return (
    <DesktopLayout search={search} onSearchChange={setSearch}>
      <section className="relative overflow-hidden rounded-xl bg-dusk px-7 py-12 shadow-lg md:px-12 md:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sunset opacity-30 blur-2xl" />
        <p className="relative text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">
          {t('landing.hero.eyebrow')}
        </p>
        <h1 className="relative mt-3 max-w-2xl font-display text-3xl font-extrabold tracking-[-0.02em] text-white md:text-4xl">
          {t('discover.forYou')}
        </h1>
      </section>

      {/* Category rail — the kit's horizontal scroller, kept horizontal on
          desktop too because the mood set is short and browsing it sideways is
          faster than reading a wrapped block of twelve chips. */}
      <div className="mt-8 flex snap-x gap-2 overflow-x-auto pb-2">
        <Chip active={mood === null} onClick={() => setMood(null)}>
          {t('discover.allMoods', 'Todos')}
        </Chip>
        {MOODS.map((m) => (
          <Chip key={m} active={mood === m} onClick={() => setMood(m)} iconLeft={MOOD_ICON[m]}>
            {t(`moods.${m}`)}
          </Chip>
        ))}
      </div>

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

        {!error && places !== null && list.length === 0 && (
          <EmptyState
            icon="compass"
            title={search ? t('search.noResults') : t('discover.noResults')}
            action={
              search ? (
                <Button variant="secondary" onClick={() => setSearch('')}>
                  {t('common.close')}
                </Button>
              ) : undefined
            }
          />
        )}

        {!error && list.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-[22px]">
            {list.map((place) => (
              <ActivityCard
                key={place.placeId}
                image={coverImage(place)}
                title={resolveLocalized(place.name, place.nameI18n, language)}
                category={place.moods[0] ? t(`moods.${place.moods[0]}`) : undefined}
                score={scoreSignalFor(place)}
                saved={isFavorite(place.placeId)}
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

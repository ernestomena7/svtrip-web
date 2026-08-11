// Live showcase from the catalog (feature 007, T050/T051 — FR-009, FR-009a).
//
// THE WHOLE SECTION IS AN ENHANCEMENT. If the endpoint is slow, blocked or down,
// this renders nothing at all and the page above and below it still explains the
// product and still offers its call to action (FR-009a). That is deliberate: a
// half-empty grid of broken cards is worse for a first-time visitor than no
// grid, and the landing's core message must never depend on the network.
//
// Two things this component must NOT do, both load-bearing:
//   - compute a cover image (FR-021) — the server already resolved it with the
//     same `coverImage()` every other surface uses;
//   - compute a rating (FR-022) — the server sends a `ScoreSignal`, and a card
//     that formatted its own number could disagree with the profile one tap
//     away, which is the exact failure SC-009 exists to prevent.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveLocalized, type LocalizedText } from '@svtrip/shared';
import { Icon } from '@svtrip/core/Icon';
import { useUiStore } from '@svtrip/core/uiStore';
import { ButtonLink } from '../components/Button';
import { API_BASE_URL, APP_SIGN_IN_URL } from '../config';

/** Mirrors the endpoint's contract. Deliberately no more fields than it sends. */
interface ScoreSignal {
  kind: 'average' | 'editorial' | 'none';
  value?: number;
  count?: number;
}
interface FeaturedPlace {
  placeId: string;
  name: string;
  nameI18n?: LocalizedText;
  description: string;
  descriptionI18n?: LocalizedText;
  coverImage?: string;
  moods: string[];
  score: ScoreSignal;
}

function Score({ score }: { score: ScoreSignal }) {
  const { t } = useTranslation();
  // A displayed average is always real. An editorial rating is a different kind
  // of claim, so it gets its own labelled treatment and never sits in the
  // average's slot (feature 005, FR-047/FR-048).
  if (score.kind === 'average' && typeof score.value === 'number') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-extrabold text-text">
        <span className="text-accent">
          <Icon name="star" size={14} filled />
        </span>
        {score.value.toFixed(1)}
        <span className="font-bold text-muted">({score.count})</span>
      </span>
    );
  }
  if (score.kind === 'editorial') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-extrabold text-muted">
        <Icon name="bookmark" size={12} />
        {t('profile.editorialPick', 'Selección del equipo')}
      </span>
    );
  }
  return null;
}

function PlaceCard({ place }: { place: FeaturedPlace }) {
  const language = useUiStore((s) => s.language);
  const name = resolveLocalized(place.name, place.nameI18n, language);

  return (
    <article className="overflow-hidden rounded-lg bg-surface shadow-md transition hover:-translate-y-[3px] hover:shadow-lg">
      {/* The brand sunset gradient IS the no-photo state — 18 of the 19 catalog
          entries have no image, so this is the common case, not the error case. */}
      <div className="h-40 w-full bg-sunset">
        {place.coverImage && (
          <img src={place.coverImage} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="font-display text-base font-extrabold leading-snug text-text">{name}</h3>
        <Score score={place.score} />
      </div>
    </article>
  );
}

export function Showcase() {
  const { t } = useTranslation();
  const [places, setPlaces] = useState<FeaturedPlace[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/public/featured`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { places: FeaturedPlace[] }) => {
        if (!cancelled) setPlaces(data.places ?? []);
      })
      // Swallowed on purpose. There is no error state here because there is no
      // error to report to a visitor: they came to read about the product, and
      // the showcase simply does not appear. Every other screen in SVTrip must
      // surface its failures; this one is the documented exception (FR-009a).
      .catch(() => {
        if (!cancelled) setPlaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Absent, not empty: no skeletons, no "could not load" box, no reserved gap.
  if (!places || places.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 md:px-10 md:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
            {t('landing.showcase.title')}
          </h2>
          <p className="mt-2 text-[15px] text-muted">{t('landing.showcase.subtitle')}</p>
        </div>
        <ButtonLink href={APP_SIGN_IN_URL} variant="secondary">
          {t('landing.showcase.cta')}
        </ButtonLink>
      </div>

      {/* The kit's grid metrics, carried across verbatim: 280px minimum column,
          22px gutter (ui_kits/web/WebHome.jsx). */}
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-[22px]">
        {places.map((place) => (
          <PlaceCard key={place.placeId} place={place} />
        ))}
      </div>
    </section>
  );
}

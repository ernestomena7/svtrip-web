// The signature content card, desktop edition (feature 007, T064).
//
// From `SVTrip_Design_System/components/cards/ActivityCard.jsx`, carrying its
// actual metrics across: 168px media, borderless surface, warm navy shadow, and
// the -3px hover lift the kit specifies for web.
//
// Two things it must never do:
//   - pick its own image: `coverImage()` in `@svtrip/shared` already decided
//     (FR-021). This card takes the answer;
//   - format its own rating: it takes a `ScoreSignal` and hands it to
//     `ScoreBadge` (FR-022, SC-009).
//
// No image is not an error state — 18 of the 19 catalog entries have none, so
// the brand sunset gradient IS what a place without a photo looks like.
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScoreSignal } from '@svtrip/shared';
import { Icon } from '@svtrip/core/Icon';
import { ScoreBadge } from './ScoreBadge';
import { cx } from './ui';

interface ActivityCardProps {
  image?: string;
  title: string;
  category?: string;
  score?: ScoreSignal;
  saved?: boolean;
  onToggleSave?: () => void;
  onClick?: () => void;
  className?: string;
}

export function ActivityCard({
  image,
  title,
  category,
  score,
  saved = false,
  onToggleSave,
  onClick,
  className,
}: ActivityCardProps) {
  const { t } = useTranslation();

  function handleSave(e: MouseEvent) {
    e.stopPropagation();
    onToggleSave?.();
  }

  return (
    <article
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cx(
        'group overflow-hidden rounded-lg bg-surface text-left shadow-md transition',
        onClick && 'cursor-pointer hover:-translate-y-[3px] hover:shadow-lg',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
    >
      <div className="relative h-[168px] w-full bg-sunset">
        {image && <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />}
        {onToggleSave && (
          <button
            type="button"
            onClick={handleSave}
            aria-pressed={saved}
            aria-label={saved ? t('discover.unsave', 'Quitar de guardados') : t('discover.save', 'Guardar')}
            className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-navy backdrop-blur transition hover:bg-white"
          >
            <span className={saved ? 'text-primary' : undefined}>
              <Icon name="heart" size={17} filled={saved} />
            </span>
          </button>
        )}
      </div>

      <div className="space-y-2 p-4">
        {category && <p className="eyebrow">{category}</p>}
        <h3 className="font-display text-base font-extrabold leading-snug text-text">{title}</h3>
        {score && <ScoreBadge signal={score} className="text-sm" />}
      </div>
    </article>
  );
}

// How a score renders, everywhere on the desktop app (feature 007).
//
// Takes a `ScoreSignal`, never a number. `scoreSignalFor()` in `@svtrip/shared`
// owns the decision; this only draws it. That split is what guarantees a card
// and the profile it links to can never disagree (SC-009).
//
// The team's rule, carried over from feature 005: **a displayed average is
// always real.** Zero reviews means no average — not 0.0, not the editorial
// rating standing in for one. A curated editorial rating is a different kind of
// claim, so it gets its own labelled badge and never the average's slot.
import { useTranslation } from 'react-i18next';
import type { ScoreSignal } from '@svtrip/shared';
import { Icon } from '@svtrip/core/Icon';
import { cx } from './ui';

export function ScoreBadge({ signal, className }: { signal: ScoreSignal; className?: string }) {
  const { t } = useTranslation();

  if (signal.kind === 'average') {
    return (
      <span className={cx('inline-flex items-center gap-1 font-extrabold text-text', className)}>
        <span className="text-accent">
          <Icon name="star" size={14} filled />
        </span>
        {signal.value.toFixed(1)}
        <span className="font-bold text-muted">({signal.count})</span>
      </span>
    );
  }

  if (signal.kind === 'editorial') {
    return (
      <span
        className={cx(
          'inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-extrabold text-muted',
          className,
        )}
      >
        <Icon name="bookmark" size={12} />
        {t('profile.editorialPick', 'Selección del equipo')}
      </span>
    );
  }

  // 'none' — render nothing at all rather than a placeholder that implies a zero.
  return null;
}
